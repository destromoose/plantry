import Foundation
import SwiftData
import Observation

// Household sync for the iPhone app: the same household, server and merge rules as the web
// app (lib/sync.ts, docs/SYNC.md), so an iPhone and a browser share one plan, pantry, list,
// recipes and history. Nothing leaves the phone until someone shares or joins.
//
// When it syncs: 1.5 s after a change, on opening the app, and every 20 s while it's open
// (every 4 s while someone in the household is out shopping).

@MainActor
@Observable
final class HouseholdSync {
    static let server = URL(string: "https://plantry.astrolabworks.com")!
    static let pullEvery: TimeInterval = 20
    static let shoppingEvery: TimeInterval = 4
    static let pushAfter: TimeInterval = 1.5

    enum Status: Equatable { case off, idle, syncing, offline, error(String) }

    private(set) var code: String?
    private(set) var status: Status = .off
    private(set) var lastSyncedAt: Date?
    /// Which household member is the person holding this phone.
    private(set) var meId: String?

    private let store: Store
    private var observer: NSObjectProtocol?
    private var pushTask: Task<Void, Never>?
    private var pullTimer: Timer?
    private var lastPull = Date.distantPast
    private var running = false
    private var again = false
    private var applying = false
    private var lastLocal: [String: JSONValue]?

    private struct Meta: Codable {
        var code: String
        var rev: Int
        /// The last document both this phone and the server agreed on, in this phone's shape.
        var base: JSONValue
        var meId: String?
        var lastSyncedAt: Date?
    }

    private static let metaKey = "plantry-sync"

    init(store: Store) {
        self.store = store
        if let m = readMeta() {
            code = m.code; meId = m.meId; lastSyncedAt = m.lastSyncedAt; status = .idle
        }
        observer = NotificationCenter.default.addObserver(forName: .plantryDataChanged, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.localChanged() }
        }
    }

    var isSharing: Bool { code != nil }

    // MARK: - Lifecycle

    /// Call when the app comes to the front.
    func becameActive() {
        guard isSharing else { return }
        startTimer()
        syncNow()
    }

    /// Call when the app goes to the background.
    func wentToBackground() {
        pullTimer?.invalidate(); pullTimer = nil
    }

    private func startTimer() {
        pullTimer?.invalidate()
        // Ticks every 4 s but only pulls every 20 s, unless someone is out shopping, so ticks
        // and late adds show up on the other phone almost at once.
        pullTimer = Timer.scheduledTimer(withTimeInterval: Self.shoppingEvery, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                let every = ShopTogether.active(self.store.together.shopTrip) != nil ? Self.shoppingEvery : Self.pullEvery
                guard Date().timeIntervalSince(self.lastPull) >= every - 0.5 else { return }
                self.lastPull = Date()
                self.syncNow()
            }
        }
    }

    private func localChanged() {
        guard isSharing, !applying else { return }
        let doc = localDoc()
        if let last = lastLocal, SyncDoc.equal(last, doc) { return }
        lastLocal = doc
        pushTask?.cancel()
        pushTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.pushAfter))
            guard !Task.isCancelled else { return }
            self?.syncNow()
        }
    }

    // MARK: - The shared document

    /// The shared part of this phone's data, as JSON.
    func localDoc() -> [String: JSONValue] {
        let s = store.settings
        var settings: [String: JSONValue] = [
            "cookingFor": .number(Double(s.cookingFor)),
            "avoid": .array(s.avoid.map { .string($0) }),
            "tastes": .array(s.tastes.map { .string($0.rawValue) }),
            "householdWord": .string(s.householdWord.rawValue),
            "cookingWithKids": .bool(s.cookingWithKids),
            "units": .string(s.units.rawValue),
        ]
        settings["meals"] = .array(s.meals.map { .string($0.rawValue) })
        let tog = store.together
        let members: [JSONValue] = store.members.map { m in
            var v = m.value
            v.isMe = nil
            return JSONValue.from(v)
        }
        return [
            "v": .number(Double(SyncDoc.version)),
            "settings": .object(settings),
            "members": .array(members),
            "recipes": .array(store.fetch(RecipeModel.self).sorted { $0.createdAt > $1.createdAt }.map { JSONValue.from($0.value) }),
            "pantry": .array(store.fetch(PantryItemModel.self).map { JSONValue.from($0.value) }),
            "plan": .array(store.fetch(PlanEntryModel.self).map { JSONValue.from($0.value) }),
            "shop": .array(store.fetch(ShopItemModel.self).sorted { $0.order < $1.order }.map { JSONValue.from($0.value) }),
            "shopDismissed": .array(s.shopDismissed.map { .string($0) }),
            "handoffs": .array(store.fetch(HandoffModel.self).map { JSONValue.from($0.value) }),
            "cooked": .array(store.fetch(CookedModel.self).sorted { $0.at > $1.at }.map { JSONValue.from($0.value) }),
            "energyByDate": .object(s.energyByDate.mapValues { .string($0.rawValue) }),
            "notes": .array(tog.notes.map { JSONValue.from($0) }),
            "replies": .array(tog.replies.map { JSONValue.from($0) }),
            "presence": .object(tog.presence.mapValues { .string($0.rawValue) }),
            "presenceWeekly": .object(tog.presenceWeekly.mapValues { .string($0.rawValue) }),
            "shopTrip": JSONValue.from(tog.shopTrip ?? ShopTrip()),
            "ideas": .array((tog.ideas ?? []).map { JSONValue.from($0) }),
            "repeats": .array((tog.repeats ?? []).map { JSONValue.from($0) }),
        ]
    }

    /// Put the household's data into this phone, keeping this phone's own settings.
    /// Items are updated in place by id, so open screens keep working.
    private func apply(_ doc: [String: JSONValue]) {
        applying = true
        defer { applying = false }
        let ctx = store.context
        let s = store.settings

        if let o = doc["settings"]?.object {
            if let n = o["cookingFor"]?.number { s.cookingFor = max(1, min(24, Int(n))) }
            if let a = o["avoid"]?.decode([String].self) { s.avoid = a }
            if let a = o["tastes"]?.array { s.tastes = a.compactMap { $0.string.flatMap(Taste.init(rawValue:)) } }
            if let w = o["householdWord"]?.string.flatMap(HouseholdWord.init(rawValue:)) { s.householdWord = w }
            if case .bool(let b)? = o["cookingWithKids"] { s.cookingWithKids = b }
            if let u = o["units"]?.string.flatMap(Units.init(rawValue:)) { s.units = u }
            if let a = o["meals"]?.array {
                let m = Set(a.compactMap { $0.string.flatMap(MealSlot.init(rawValue:)) } + [.dinner])
                s.meals = MealSlot.allCases.filter { m.contains($0) }
            }
        }
        s.shopDismissed = (doc["shopDismissed"]?.array ?? []).compactMap(\.string)
        s.energyByDate = (doc["energyByDate"]?.object ?? [:]).compactMapValues { $0.string.flatMap(Energy.init(rawValue:)) }

        func items<T: Decodable>(_ key: String, _ type: T.Type) -> [T] { (doc[key]?.array ?? []).compactMap { $0.decode(T.self) } }

        // Members, with this phone's person marked.
        let members = items("members", Member.self)
        var byId = Dictionary(store.fetch(MemberModel.self).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for (i, m) in members.enumerated() {
            if let have = byId.removeValue(forKey: m.id) {
                have.name = m.name; have.color = m.color; have.order = i
                have.avoid = m.avoid ?? []; have.diet = m.diet; have.cooks = m.cooks ?? true
                have.isMe = m.id == meId
            } else {
                var mine = m
                mine.isMe = m.id == meId ? true : nil
                ctx.insert(MemberModel(mine, order: i))
            }
        }
        for gone in byId.values { ctx.delete(gone) }

        // Recipes. An empty list from the server never wipes this phone's.
        let recipes = items("recipes", Recipe.self)
        if !recipes.isEmpty {
            var have = Dictionary(store.fetch(RecipeModel.self).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
            for r in recipes {
                if let m = have.removeValue(forKey: r.id) { if m.value != r { m.apply(r) } } else { ctx.insert(RecipeModel(r)) }
            }
            for gone in have.values { ctx.delete(gone) }
        }

        var pantry = Dictionary(store.fetch(PantryItemModel.self).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for p in items("pantry", PantryItem.self) {
            if let m = pantry.removeValue(forKey: p.id) {
                if m.value != p {
                    m.name = p.name; m.key = p.key; m.zone = p.zone; m.aisle = p.aisle; m.quantity = p.quantity; m.unit = p.unit
                    m.addedAt = p.addedAt; m.softLifeDays = p.softLifeDays; m.staple = p.isStaple
                }
            } else { ctx.insert(PantryItemModel(p)) }
        }
        for gone in pantry.values { ctx.delete(gone) }

        // One meal per date and slot. Matched by id first, so a meal moved to another day
        // on the other phone moves here too instead of being deleted and made again.
        let havePlan = store.fetch(PlanEntryModel.self)
        let planById = Dictionary(havePlan.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var keep = Set<ObjectIdentifier>()
        let incoming = items("plan", PlanEntry.self)
        let incomingIds = Set(incoming.map(\.id))
        for p in incoming {
            if let m = planById[p.id] {
                keep.insert(ObjectIdentifier(m))
                if m.value != p {
                    m.date = p.date; m.slot = p.slot; m.recipeId = p.recipeId; m.leftoversOf = p.leftoversOf; m.note = p.note
                    m.servings = p.servings; m.cookId = p.cookId; m.done = p.isDone
                }
            } else {
                for m in havePlan where m.date == p.date && m.slot == p.slot && !incomingIds.contains(m.id) { ctx.delete(m) }
                let m = PlanEntryModel(p)
                ctx.insert(m)
                keep.insert(ObjectIdentifier(m))
            }
        }
        for m in havePlan where !keep.contains(ObjectIdentifier(m)) && !m.isDeleted { ctx.delete(m) }

        var shop = Dictionary(store.fetch(ShopItemModel.self).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for (i, item) in items("shop", ShopItem.self).enumerated() {
            if let m = shop.removeValue(forKey: item.id) {
                m.update(from: item, order: i)
            } else { ctx.insert(ShopItemModel(item, order: i)) }
        }
        for gone in shop.values { ctx.delete(gone) }

        var handoffs = Dictionary(store.fetch(HandoffModel.self).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for h in items("handoffs", Handoff.self) {
            if let m = handoffs.removeValue(forKey: h.id) {
                m.date = h.date; m.fromId = h.fromId; m.toId = h.toId; m.recipeId = h.recipeId
                m.message = h.message; m.createdAt = h.createdAt; m.accepted = h.accepted ?? false
            } else { ctx.insert(HandoffModel(h)) }
        }
        for gone in handoffs.values { ctx.delete(gone) }

        // Who's home and notes. Notes the app can't read are left out here; the server keeps them.
        var tog = TogetherState()
        tog.notes = items("notes", HouseNote.self)
        tog.replies = items("replies", NoteReply.self)
        tog.presence = (doc["presence"]?.object ?? [:]).compactMapValues { $0.string.flatMap(Presence.init(rawValue:)) }
        tog.presenceWeekly = (doc["presenceWeekly"]?.object ?? [:]).compactMapValues { $0.string.flatMap(Presence.init(rawValue:)) }
        tog.shopTrip = doc["shopTrip"]?.decode(ShopTrip.self) ?? ShopTrip()
        let ideas = items("ideas", MealIdea.self), repeats = items("repeats", RepeatMeal.self)
        tog.ideas = ideas.isEmpty ? nil : ideas
        tog.repeats = repeats.isEmpty ? nil : repeats
        store.together = tog

        // History has no ids: replace it when it differs, newest first.
        let cooked = items("cooked", CookedEntry.self)
        let haveCooked = store.fetch(CookedModel.self).sorted { $0.at > $1.at }.map(\.value)
        if haveCooked != cooked {
            for m in store.fetch(CookedModel.self) { ctx.delete(m) }
            let now = Date()
            for (i, c) in cooked.enumerated() {
                ctx.insert(CookedModel(recipeId: c.recipeId, date: c.date, cookId: c.cookId, at: now.addingTimeInterval(-Double(i)), rating: c.rating, note: c.note))
            }
        }
        store.save()
        lastLocal = localDoc()
    }

    // MARK: - Talking to the server

    private struct Remote: Decodable { var rev: Int; var doc: JSONValue? }
    private struct Created: Decodable { var code: String; var rev: Int }

    enum SyncError: LocalizedError {
        case badCode, notFound, notSetUp, tooBig, offline, server(Int)
        var errorDescription: String? {
            switch self {
            case .badCode: "That code should be 12 letters and numbers."
            case .notFound: "No household has that code. Check it and try again."
            case .notSetUp: "Sharing is not set up on the server yet."
            case .tooBig: "Too much data to share. Remove some photos or old recipes."
            case .offline: "Could not reach the server. Try again."
            case .server: "Could not reach the server. Try again."
            }
        }
    }

    private func call(_ method: String, _ path: String, body: Data? = nil) async throws -> (Int, Data) {
        var req = URLRequest(url: Self.server.appendingPathComponent(path))
        req.httpMethod = method
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.timeoutInterval = 15
        if let body { req.httpBody = body; req.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        do {
            let (data, res) = try await URLSession.shared.data(for: req)
            return ((res as? HTTPURLResponse)?.statusCode ?? 0, data)
        } catch {
            throw SyncError.offline
        }
    }

    private func encode(_ value: some Encodable) -> Data { (try? JSONEncoder().encode(value)) ?? Data() }

    /// Pull the household's latest, merge this phone's changes in, and push if anything changed.
    func syncNow() {
        guard isSharing else { return }
        if running { again = true; return }
        running = true
        Task {
            await run()
            running = false
            if again { again = false; syncNow() }
        }
    }

    private func run() async {
        guard var meta = readMeta() else { return }
        status = .syncing
        do {
            for _ in 0..<4 {
                let (code, data) = try await call("GET", "api/sync/\(meta.code)")
                if code == 404 { fail("This household is gone from the server. Share again to start a new one."); return }
                if code == 503 { status = .error(SyncError.notSetUp.localizedDescription); return }
                guard code == 200, let got = try? JSONDecoder().decode(Remote.self, from: data) else { throw SyncError.server(code) }
                let remote = SyncDoc.clean(got.doc)
                let local = localDoc()
                let merged = SyncDoc.merge(base: meta.base.object, local: local, remote: remote)
                var rev = got.rev
                if !SyncDoc.equal(merged, remote) {
                    let payload: [String: JSONValue] = ["baseRev": .number(Double(got.rev)), "doc": .object(merged)]
                    let body = encode(payload)
                    if body.count > SyncDoc.maxBytes { status = .error(SyncError.tooBig.localizedDescription); return }
                    let (put, putData) = try await call("PUT", "api/sync/\(meta.code)", body: body)
                    if put == 409 { continue } // Another phone saved first: merge again.
                    if put == 413 { status = .error(SyncError.tooBig.localizedDescription); return }
                    guard put == 200, let ok = try? JSONDecoder().decode(Remote.self, from: putData) else { throw SyncError.server(put) }
                    rev = ok.rev
                }
                finish(&meta, rev: rev, merged: merged, localWas: local)
                return
            }
            throw SyncError.server(409)
        } catch SyncError.offline {
            status = .offline
        } catch {
            status = .error("Could not reach the server. Changes stay on this phone and sync later.")
        }
    }

    private func finish(_ meta: inout Meta, rev: Int, merged: [String: JSONValue], localWas: [String: JSONValue]) {
        // Changes made on this phone while the request was out are replayed on top.
        let now = localDoc()
        let next = SyncDoc.equal(now, localWas) ? merged : SyncDoc.merge(base: localWas, local: now, remote: merged)
        apply(next)
        meta.rev = rev
        // The base is what this phone now holds, in its own shape, so the next merge only
        // sees edits made here, never fields this app can't store.
        meta.base = .object(SyncDoc.equal(now, localWas) ? localDoc() : localWas)
        meta.lastSyncedAt = Date()
        writeMeta(meta)
        lastSyncedAt = meta.lastSyncedAt
        status = .idle
        if !SyncDoc.equal(now, localWas) { syncNow() }
    }

    private func fail(_ message: String) {
        writeMeta(nil)
        code = nil
        status = .error(message)
        wentToBackground()
    }

    // MARK: - Sharing, joining, leaving

    /// Start sharing this phone's data as a new household. Returns the code.
    @discardableResult
    func startSharing() async throws -> String {
        let doc = localDoc()
        let payload: [String: JSONValue] = ["doc": .object(doc)]
        let (code, data) = try await call("POST", "api/sync", body: encode(payload))
        if code == 503 { throw SyncError.notSetUp }
        if code == 413 { throw SyncError.tooBig }
        guard code == 200, let made = try? JSONDecoder().decode(Created.self, from: data) else { throw SyncError.server(code) }
        let me = store.me?.id
        writeMeta(Meta(code: made.code, rev: made.rev, base: .object(doc), meId: me, lastSyncedAt: Date()))
        self.code = made.code; meId = me; lastSyncedAt = Date(); status = .idle
        lastLocal = doc
        startTimer()
        return made.code
    }

    struct Peek {
        var code: String
        var rev: Int
        var doc: [String: JSONValue]
        var members: [Member] { (doc["members"]?.array ?? []).compactMap { $0.decode(Member.self) } }
    }

    /// Look at a household before joining, to show who's in it.
    func peek(_ input: String) async throws -> Peek {
        guard let c = HouseholdCode.normalize(input) else { throw SyncError.badCode }
        let (status, data) = try await call("GET", "api/sync/\(c)")
        if status == 404 { throw SyncError.notFound }
        if status == 503 { throw SyncError.notSetUp }
        guard status == 200, let got = try? JSONDecoder().decode(Remote.self, from: data) else { throw SyncError.server(status) }
        return Peek(code: c, rev: got.rev, doc: SyncDoc.clean(got.doc))
    }

    /// Join a household as one of its people, or as someone new. This phone's plan, pantry,
    /// list and history are replaced by the household's; recipes added on this phone that
    /// the household doesn't have are kept and shared.
    func join(_ p: Peek, as memberId: String?, newName: String? = nil) {
        var doc = p.doc
        var me = memberId
        if let name = newName?.trimmed, !name.isEmpty {
            let taken = Set(p.members.map(\.color))
            let color = MemberColor.allCases.first { !taken.contains($0) } ?? .terracotta
            let m = Member(id: IDs.make("m"), name: String(name.prefix(40)), color: color)
            doc["members"] = .array((doc["members"]?.array ?? []) + [JSONValue.from(m)])
            me = m.id
        }
        let theirs = Set((doc["recipes"]?.array ?? []).compactMap { $0["id"]?.string })
        let mine = store.fetch(RecipeModel.self).filter { $0.custom && !theirs.contains($0.id) }.map { JSONValue.from($0.value) }
        doc["recipes"] = .array(mine + (doc["recipes"]?.array ?? []))
        meId = me
        code = p.code
        apply(doc)
        store.update { $0.onboarded = true }
        // The base is the household's copy as this phone now holds it, minus the recipes kept
        // from this phone and the new person, so those count as additions and go up on the
        // first sync. Anything this app couldn't read stays out of the base and is left alone.
        var base = localDoc()
        let keptIds = Set(mine.compactMap { $0["id"]?.string })
        base["recipes"] = .array((base["recipes"]?.array ?? []).filter { !keptIds.contains($0["id"]?.string ?? "") })
        if newName?.trimmed.isEmpty == false, let me {
            base["members"] = .array((base["members"]?.array ?? []).filter { $0["id"]?.string != me })
        }
        writeMeta(Meta(code: p.code, rev: p.rev, base: .object(base), meId: me, lastSyncedAt: nil))
        status = .idle
        startTimer()
        syncNow()
    }

    /// Stop syncing. Everything stays on this phone.
    func leave() {
        writeMeta(nil)
        code = nil; lastSyncedAt = nil; status = .off
        wentToBackground()
    }

    /// Which member this phone is, kept across syncs.
    func setMe(_ id: String) {
        meId = id
        for m in store.members { m.isMe = m.id == id }
        store.save()
        if var m = readMeta() { m.meId = id; writeMeta(m) }
    }

    /// A link that opens the website's join page with the code filled in.
    var joinLink: URL? {
        guard let code else { return nil }
        return URL(string: "\(Self.server.absoluteString)/join?code=\(code)")
    }

    // MARK: - Saved state

    private func readMeta() -> Meta? {
        guard let d = UserDefaults.standard.data(forKey: Self.metaKey) else { return nil }
        return try? JSONDecoder().decode(Meta.self, from: d)
    }

    private func writeMeta(_ m: Meta?) {
        if let m, let d = try? JSONEncoder().encode(m) { UserDefaults.standard.set(d, forKey: Self.metaKey) }
        else { UserDefaults.standard.removeObject(forKey: Self.metaKey) }
    }
}
