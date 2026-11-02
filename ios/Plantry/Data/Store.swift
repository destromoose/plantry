import Foundation
import SwiftData
import Observation

// Every mutation in the app lives here, mirroring lib/store.ts in the web app.
// Views read with @Query and write through `Store`. Saves happen on each
// action so nothing is lost if the app is killed.

@MainActor
@Observable
final class Store {
    let container: ModelContainer
    let context: ModelContext
    /// Recipe ids seen by the shuffle today, so it does not repeat.
    var shuffleSeen: [String] = []

    init(container: ModelContainer) {
        self.container = container
        self.context = container.mainContext
        bootstrap()
    }

    // MARK: - Reads

    var settings: SettingsModel {
        if let s = try? context.fetch(FetchDescriptor<SettingsModel>()).first { return s }
        let s = SettingsModel()
        context.insert(s)
        save()
        return s
    }

    func fetch<T: PersistentModel>(_ type: T.Type, _ predicate: Predicate<T>? = nil) -> [T] {
        (try? context.fetch(FetchDescriptor<T>(predicate: predicate))) ?? []
    }

    func recipe(_ id: String?) -> RecipeModel? {
        guard let id else { return nil }
        return fetch(RecipeModel.self, #Predicate { $0.id == id }).first
    }

    func dinner(on date: String) -> PlanEntryModel? {
        fetch(PlanEntryModel.self, #Predicate { $0.date == date }).first { $0.slot == .dinner }
    }

    var members: [MemberModel] { fetch(MemberModel.self).sorted { $0.order < $1.order } }
    var me: MemberModel? { let m = members; return m.first { $0.isMe } ?? m.first }

    var pantryKeys: Set<String> { Set(fetch(PantryItemModel.self).map(\.key)) }

    /// Recipe ids cooked, most recent first.
    var recentlyCooked: [String] {
        var d = FetchDescriptor<CookedModel>(sortBy: [SortDescriptor(\.at, order: .reverse)])
        d.fetchLimit = 60
        return ((try? context.fetch(d)) ?? []).map(\.recipeId)
    }

    // MARK: - Bootstrap

    private func bootstrap() {
        let count = (try? context.fetchCount(FetchDescriptor<RecipeModel>())) ?? 0
        if count == 0 && !settings.onboarded {
            for r in Seed.recipes { context.insert(RecipeModel(r)) }
        }
        _ = settings
        save()
    }

    func save() {
        guard context.hasChanges else { return }
        do { try context.save() } catch { assertionFailure("save failed: \(error)") }
    }

    // MARK: - Settings and household

    func update(_ patch: (SettingsModel) -> Void) {
        patch(settings)
        save()
    }

    func completeOnboarding(names: [String], tastes: [Taste], pantryNames: [String]) {
        let now = ISO.now()
        let clean = names.map(\.trimmed).filter { !$0.isEmpty }
        let colors = MemberColor.allCases
        var i = 0
        for name in clean {
            context.insert(MemberModel(Member(id: IDs.make("m"), name: name, color: colors[i % colors.count], isMe: i == 0), order: i))
            i += 1
        }
        if clean.isEmpty {
            context.insert(MemberModel(Member(id: IDs.make("m"), name: "Me", color: .terracotta, isMe: true), order: 0))
        }
        for name in pantryNames { context.insert(PantryItemModel(makePantryItem(name, now: now))) }
        let s = settings
        s.onboarded = true
        s.tastes = tastes
        save()
    }

    func addMember(_ name: String) {
        let existing = members
        let colors = MemberColor.allCases
        context.insert(MemberModel(Member(id: IDs.make("m"), name: name.trimmed, color: colors[existing.count % colors.count], isMe: nil), order: existing.count))
        save()
    }

    func removeMember(_ m: MemberModel) { context.delete(m); save() }

    func renameMember(_ m: MemberModel, _ name: String) { m.name = name.trimmed; save() }

    func setWeather(_ w: Weather?) { settings.weather = w; save() }

    // MARK: - Recipes

    @discardableResult
    func addRecipe(_ r: Recipe) -> RecipeModel {
        var recipe = r
        if recipe.id.isEmpty { recipe.id = IDs.make("r") }
        recipe.createdAt = ISO.now()
        recipe.isFavorite = false
        recipe.custom = true
        let m = RecipeModel(recipe)
        context.insert(m)
        save()
        return m
    }

    func updateRecipe(_ m: RecipeModel, _ r: Recipe) {
        var patch = r
        patch.id = m.id
        patch.createdAt = m.createdAt
        patch.isFavorite = m.isFavorite
        patch.custom = true
        m.apply(patch)
        save()
    }

    func deleteRecipe(_ m: RecipeModel) {
        let id = m.id
        for p in fetch(PlanEntryModel.self, #Predicate { $0.recipeId == id }) {
            p.recipeId = nil
            if p.note == nil { p.note = "Removed recipe" }
        }
        context.delete(m)
        save()
    }

    func toggleFavorite(_ m: RecipeModel) { m.isFavorite.toggle(); save() }

    // MARK: - Pantry

    private func makePantryItem(_ name: String, now: String, zone: PantryZone? = nil, aisle: Aisle? = nil, quantity: Double? = nil, unit: String? = nil, softLifeDays: Int? = nil) -> PantryItem {
        let key = keyOf(name)
        let staple = Seed.staplesByKey[key]
        return PantryItem(
            id: IDs.make("p"),
            name: staple?.name ?? name.trimmed,
            key: key,
            zone: zone ?? staple?.zone ?? .cupboard,
            aisle: aisle ?? staple?.aisle ?? .other,
            quantity: quantity,
            unit: unit,
            addedAt: now,
            softLifeDays: softLifeDays ?? staple?.softLifeDays ?? 30,
            staple: staple?.staple
        )
    }

    func addPantryItem(name: String, zone: PantryZone? = nil, aisle: Aisle? = nil, quantity: Double? = nil, unit: String? = nil) {
        let key = keyOf(name)
        if let existing = fetch(PantryItemModel.self, #Predicate { $0.key == key }).first {
            restock(existing)
            return
        }
        context.insert(PantryItemModel(makePantryItem(name, now: ISO.now(), zone: zone, aisle: aisle, quantity: quantity, unit: unit)))
        save()
    }

    func removePantryItem(_ p: PantryItemModel) { context.delete(p); save() }
    func restock(_ p: PantryItemModel) { p.addedAt = ISO.now(); save() }
    func useUp(_ p: PantryItemModel) { context.delete(p); save() }

    // MARK: - Plan

    /// Replaces whatever dinner is on that date.
    @discardableResult
    func setDinner(_ date: String, recipeId: String? = nil, leftoversOf: String? = nil, note: String? = nil, servings: Int? = nil, cookId: String? = nil) -> PlanEntryModel {
        if let existing = dinner(on: date) { context.delete(existing) }
        let entry = PlanEntryModel(PlanEntry(id: IDs.make("pl"), date: date, slot: .dinner, recipeId: recipeId, leftoversOf: leftoversOf, note: note, servings: servings, cookId: cookId))
        context.insert(entry)
        save()
        return entry
    }

    func clearDinner(_ date: String) {
        if let e = dinner(on: date) { context.delete(e); save() }
    }

    func movePlanEntry(_ entry: PlanEntryModel, to date: String) {
        let from = entry.date
        if let displaced = dinner(on: date), displaced.id != entry.id { displaced.date = from }
        entry.date = date
        save()
    }

    func claimNight(_ date: String, cookId: String?) {
        if let e = dinner(on: date) { e.cookId = cookId }
        else { context.insert(PlanEntryModel(PlanEntry(id: IDs.make("pl"), date: date, slot: .dinner, cookId: cookId))) }
        save()
    }

    func markCooked(_ date: String, leftovers: Bool = false, usePantry: Bool = true) {
        guard let entry = dinner(on: date) else { return }
        let recipe = recipe(entry.recipeId)
        if usePantry, let recipe {
            let perishable = Set(recipe.ingredients.filter { !$0.isOptional && $0.aisle.isPerishable }.map(\.key))
            for p in fetch(PantryItemModel.self) where perishable.contains(p.key) && !p.staple {
                context.delete(p)
            }
        }
        entry.done = true
        if leftovers, let recipe {
            let next = DateKey.addDays(date, 1)
            let taken = dinner(on: next)
            if taken == nil || !(taken!.recipeId != nil || taken!.note != nil) {
                if let taken { context.delete(taken) }
                context.insert(PlanEntryModel(PlanEntry(id: IDs.make("pl"), date: next, slot: .dinner, leftoversOf: recipe.id, cookId: taken?.cookId)))
            }
        }
        context.insert(CookedModel(recipeId: entry.recipeId ?? entry.leftoversOf ?? "", date: date, cookId: entry.cookId))
        save()
    }

    func setEnergy(_ date: String, _ energy: Energy) {
        settings.energyByDate[date] = energy
        save()
    }

    // MARK: - Shop

    func generateShop(dates: [String]) {
        let dateSet = Set(dates)
        let keys = pantryKeys
        var needed: [String: ShopItem] = [:]
        var orderKeys: [String] = []
        for entry in fetch(PlanEntryModel.self) where dateSet.contains(entry.date) && !entry.done {
            guard let rid = entry.recipeId, let recipe = recipe(rid) else { continue }
            let scale = entry.servings.map { Double($0) / Double(max(recipe.servings, 1)) } ?? 1
            for ing in recipe.ingredients where !ing.isOptional && !keys.contains(ing.key) {
                if var prev = needed[ing.key] {
                    if prev.unit == ing.unit, let q = prev.quantity { prev.quantity = q + ing.quantity * scale }
                    if !prev.fromRecipeIds.contains(recipe.id) { prev.fromRecipeIds.append(recipe.id) }
                    needed[ing.key] = prev
                } else {
                    needed[ing.key] = ShopItem(id: IDs.make("sh"), name: ing.name, key: ing.key, quantity: ing.quantity * scale, unit: ing.unit, aisle: ing.aisle, checked: false, fromRecipeIds: [recipe.id])
                    orderKeys.append(ing.key)
                }
            }
        }
        let existing = fetch(ShopItemModel.self)
        let checked = Dictionary(existing.map { ($0.key, $0.checked) }, uniquingKeysWith: { a, _ in a })
        for item in existing where !item.fromRecipeIds.isEmpty { context.delete(item) }
        var order = 0
        for key in orderKeys {
            var item = needed[key]!
            item.checked = checked[key] ?? false
            context.insert(ShopItemModel(item, order: order))
            order += 1
        }
        save()
    }

    func addShopItem(_ name: String, aisle: Aisle? = nil) {
        let key = keyOf(name)
        guard fetch(ShopItemModel.self, #Predicate { $0.key == key }).isEmpty else { return }
        let staple = Seed.staplesByKey[key]
        let order = ((try? context.fetchCount(FetchDescriptor<ShopItemModel>())) ?? 0) + 1000
        context.insert(ShopItemModel(ShopItem(id: IDs.make("sh"), name: name.trimmed, key: key, quantity: nil, unit: nil, aisle: aisle ?? staple?.aisle ?? .other, checked: false, fromRecipeIds: []), order: order))
        save()
    }

    func toggleShopItem(_ item: ShopItemModel) { item.checked.toggle(); save() }
    func removeShopItem(_ item: ShopItemModel) { context.delete(item); save() }

    func clearChecked() {
        for item in fetch(ShopItemModel.self, #Predicate { $0.checked }) { context.delete(item) }
        save()
    }

    func finishShopping() {
        let now = ISO.now()
        let pantry = fetch(PantryItemModel.self)
        for item in fetch(ShopItemModel.self, #Predicate { $0.checked }) {
            if let existing = pantry.first(where: { $0.key == item.key }) {
                existing.addedAt = now
            } else {
                context.insert(PantryItemModel(makePantryItem(item.name, now: now, aisle: item.aisle, quantity: item.quantity, unit: item.unit)))
            }
            context.delete(item)
        }
        save()
    }

    // MARK: - Household

    func createHandoff(date: String, from: MemberModel, to: MemberModel, recipeId: String?, message: String?) {
        context.insert(HandoffModel(Handoff(id: IDs.make("h"), date: date, fromId: from.id, toId: to.id, recipeId: recipeId, message: message, createdAt: ISO.now(), accepted: nil)))
        if let e = dinner(on: date) { e.cookId = to.id }
        save()
    }

    func acceptHandoff(_ h: HandoffModel) { h.accepted = true; save() }

    // MARK: - Data

    struct ExportBundle: Codable {
        var version: Int = 1
        var exportedAt: String
        var settings: Settings
        var members: [Member]
        var recipes: [Recipe]
        var pantry: [PantryItem]
        var plan: [PlanEntry]
        var shop: [ShopItem]
        var handoffs: [Handoff]
        var energyByDate: [String: Energy]
        var cooked: [CookedEntry]
    }

    func exportJSON() -> Data {
        let s = settings
        let bundle = ExportBundle(
            exportedAt: ISO.now(),
            settings: s.value,
            members: members.map(\.value),
            recipes: fetch(RecipeModel.self).map(\.value),
            pantry: fetch(PantryItemModel.self).map(\.value),
            plan: fetch(PlanEntryModel.self).map(\.value),
            shop: fetch(ShopItemModel.self).sorted { $0.order < $1.order }.map(\.value),
            handoffs: fetch(HandoffModel.self).map(\.value),
            energyByDate: s.energyByDate,
            cooked: fetch(CookedModel.self).sorted { $0.at > $1.at }.map(\.value)
        )
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        return (try? enc.encode(bundle)) ?? Data()
    }

    private struct ImportBundle: Codable {
        var settings: Settings?
        var members: [Member]?
        var recipes: [Recipe]
        var pantry: [PantryItem]?
        var plan: [PlanEntry]?
        var shop: [ShopItem]?
        var handoffs: [Handoff]?
        var energyByDate: [String: Energy]?
        var cooked: [CookedEntry]?
    }

    enum ImportError: LocalizedError {
        case notPlantry, unreadable
        var errorDescription: String? {
            switch self {
            case .notPlantry: "That file does not look like a Plantry export."
            case .unreadable: "Could not read that file."
            }
        }
    }

    func importJSON(_ data: Data) throws {
        let bundle: ImportBundle
        do { bundle = try JSONDecoder().decode(ImportBundle.self, from: data) }
        catch { throw (try? JSONSerialization.jsonObject(with: data)) == nil ? ImportError.unreadable : ImportError.notPlantry }
        wipe(keepSettings: true)
        var s = bundle.settings ?? Settings()
        s.onboarded = true
        let sm = settings
        sm.apply(s)
        sm.energyByDate = bundle.energyByDate ?? [:]
        for (i, m) in (bundle.members ?? []).enumerated() { context.insert(MemberModel(m, order: i)) }
        for r in bundle.recipes { context.insert(RecipeModel(r)) }
        for p in bundle.pantry ?? [] { context.insert(PantryItemModel(p)) }
        for p in bundle.plan ?? [] { context.insert(PlanEntryModel(p)) }
        for (i, item) in (bundle.shop ?? []).enumerated() { context.insert(ShopItemModel(item, order: i)) }
        for h in bundle.handoffs ?? [] { context.insert(HandoffModel(h)) }
        for (i, c) in (bundle.cooked ?? []).enumerated() {
            context.insert(CookedModel(recipeId: c.recipeId, date: c.date, cookId: c.cookId, at: Date().addingTimeInterval(-Double(i))))
        }
        save()
    }

    private func wipe(keepSettings: Bool) {
        for m in fetch(RecipeModel.self) { context.delete(m) }
        for m in fetch(PantryItemModel.self) { context.delete(m) }
        for m in fetch(PlanEntryModel.self) { context.delete(m) }
        for m in fetch(ShopItemModel.self) { context.delete(m) }
        for m in fetch(MemberModel.self) { context.delete(m) }
        for m in fetch(HandoffModel.self) { context.delete(m) }
        for m in fetch(CookedModel.self) { context.delete(m) }
        if !keepSettings { for m in fetch(SettingsModel.self) { context.delete(m) } }
    }

    func resetAll() {
        wipe(keepSettings: false)
        shuffleSeen = []
        context.insert(SettingsModel())
        for r in Seed.recipes { context.insert(RecipeModel(r)) }
        save()
    }
}
