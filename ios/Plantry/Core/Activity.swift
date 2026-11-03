import Foundation

// "Since you last looked", a port of lib/activity.ts: what the rest of the household changed,
// worked out from what came in on a sync. Nothing extra is synced; each phone keeps its own list.

struct HouseActivity: Codable, Identifiable, Hashable, Sendable {
    enum Place: String, Codable, Sendable { case tonight, week, shop, household }
    var id: String
    var at: String
    var text: String
    var by: String?
    var place: Place?
    /// It's about this person: a reply to their note, a night handed to them, an add while they shop.
    var forMe: Bool?
}

enum ActivityLog {
    static let key = "plantry-activity"
    static let seenKey = "plantry-activity-seen"
    static let days = 14
    static let max = 40

    static func diff(before: [String: JSONValue], after: [String: JSONValue], meId: String?, now: String = ISO.now()) -> [HouseActivity] {
        func items<T: Decodable>(_ d: [String: JSONValue], _ k: String, _ t: T.Type) -> [T] { (d[k]?.array ?? []).compactMap { $0.decode(T.self) } }
        let members = items(after, "members", Member.self)
        let recipes = items(after, "recipes", Recipe.self)
        func name(_ id: String?) -> String { members.first { $0.id == id }?.name ?? "Someone" }
        func title(_ id: String?) -> String? { recipes.first { $0.id == id }?.title }
        func notMe(_ by: String?) -> Bool { by == nil || by != meId }
        func weekday(_ d: String) -> String { DateKey.weekdayName(d) }
        var out: [HouseActivity] = []
        func push(_ text: String, by: String? = nil, _ place: HouseActivity.Place, forMe: Bool = false) {
            out.append(HouseActivity(id: "\(now)-\(out.count)", at: now, text: text, by: by, place: place, forMe: forMe ? true : nil))
        }
        func placeOf(_ n: HouseNote?) -> HouseActivity.Place { n?.on == .shop ? .shop : n?.on == .board ? .household : .week }

        let notes = items(after, "notes", HouseNote.self)
        let oldNotes = Set(items(before, "notes", HouseNote.self).map(\.id))
        for n in notes where !oldNotes.contains(n.id) && notMe(n.by) {
            push("\(name(n.by)) left a note: \(n.text)", by: n.by, placeOf(n))
        }
        let oldReplies = Set(items(before, "replies", NoteReply.self).map(\.id))
        for r in items(after, "replies", NoteReply.self) where !oldReplies.contains(r.id) && notMe(r.by) {
            let note = notes.first { $0.id == r.noteId }
            push("\(name(r.by)) replied \"\(r.text)\"", by: r.by, placeOf(note), forMe: meId != nil && note?.by == meId)
        }

        let was = Dictionary(items(before, "plan", PlanEntry.self).map { ("\($0.date)|\($0.slot.rawValue)", $0) }, uniquingKeysWith: { a, _ in a })
        for p in items(after, "plan", PlanEntry.self) where p.slot == .dinner {
            let old = was["\(p.date)|\(p.slot.rawValue)"]
            let what = title(p.recipeId) ?? (p.leftoversOf != nil ? "leftovers" : p.note)
            let changed = old == nil || old?.recipeId != p.recipeId || old?.note != p.note || old?.leftoversOf != p.leftoversOf
            if let what, changed { push("\(weekday(p.date)): \(what)", .week) }
            if let old, let cook = p.cookId, cook != old.cookId, notMe(cook) {
                push("\(name(cook)) is cooking \(weekday(p.date))", by: cook, .week)
            }
        }

        let oldHandoffs = Set(items(before, "handoffs", Handoff.self).map(\.id))
        for h in items(after, "handoffs", Handoff.self) where !oldHandoffs.contains(h.id) && notMe(h.fromId) {
            push("\(name(h.fromId)) asked you to cook \(weekday(h.date))", by: h.fromId, .tonight, forMe: h.toId == meId)
        }

        let oldShop = Set(items(before, "shop", ShopItem.self).map(\.id))
        let added = items(after, "shop", ShopItem.self).filter { !oldShop.contains($0.id) && notMe($0.addedBy) }
        let trip = after["shopTrip"]?.decode(ShopTrip.self)
        if let first = added.first {
            let list = added.prefix(3).map(\.name).joined(separator: ", ")
            let more = added.count > 3 ? " and \(added.count - 3) more" : ""
            let who = first.addedBy.flatMap { id in members.first { $0.id == id }?.name }
            push(who.map { "\($0) added \(list)\(more) to the list" } ?? "Added to the list: \(list)\(more)", by: first.addedBy, .shop,
                 forMe: meId != nil && trip?.by == meId)
        }
        let oldTrip = before["shopTrip"]?.decode(ShopTrip.self)
        if let by = trip?.by, by != oldTrip?.by, notMe(by) { push("\(name(by)) is at the shop", by: by, .shop) }

        let oldIdeas = Dictionary(items(before, "ideas", MealIdea.self).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for i in items(after, "ideas", MealIdea.self) {
            let label = title(i.recipeId) ?? i.text ?? ""
            if let old = oldIdeas[i.id] {
                for v in i.votes ?? [] where !(old.votes ?? []).contains(v) && notMe(v) {
                    push("\(name(v)) also fancies \(label)", by: v, .week, forMe: i.by == meId)
                }
            } else if notMe(i.by) {
                push("\(name(i.by)) fancies \(label)", by: i.by, .week)
            }
        }

        let oldPresence = before["presence"]?.object ?? [:]
        for (k, v) in after["presence"]?.object ?? [:] where oldPresence[k] != v {
            let parts = k.split(separator: "|").map(String.init)
            guard parts.count == 3, parts[1] == "dinner", notMe(parts[2]), let p = v.string, p != "home" else { continue }
            push(p == "out" ? "\(name(parts[2])) is out for dinner \(weekday(parts[0]))" : "\(name(parts[2])) is home late \(weekday(parts[0]))",
                 by: parts[2], .week)
        }
        return out
    }

    static func keep(_ list: [HouseActivity], _ fresh: [HouseActivity], now: Date = Date()) -> [HouseActivity] {
        let cutoff = now.addingTimeInterval(-Double(days) * 86_400)
        return Array((fresh + list).filter { (ISO.date($0.at) ?? now) >= cutoff }.prefix(max))
    }

    static func load() -> [HouseActivity] {
        guard let d = UserDefaults.standard.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([HouseActivity].self, from: d)) ?? []
    }

    static func add(_ fresh: [HouseActivity]) {
        guard !fresh.isEmpty else { return }
        let next = keep(load(), fresh)
        UserDefaults.standard.set(try? JSONEncoder().encode(next), forKey: key)
    }
}
