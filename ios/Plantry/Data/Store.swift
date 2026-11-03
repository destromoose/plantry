import Foundation
import SwiftData
import Observation

// Every mutation in the app lives here, mirroring lib/store.ts in the web app.
// Views read with @Query and write through `Store`. Saves happen on each
// action so nothing is lost if the app is killed. Destructive actions return
// an undo closure so the toast can offer it.

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
    var cooks: [MemberModel] { members.filter(\.cooks) }

    var pantryKeys: Set<String> { Set(fetch(PantryItemModel.self).map(\.key)) }

    /// Everything the household avoids: the shared list plus every person's.
    var householdAvoid: [String] { Diet.householdAvoid(settingsAvoid: settings.avoid, members: members.map(\.value)) }

    /// Recipe ids cooked, most recent first.
    var recentlyCooked: [String] {
        var d = FetchDescriptor<CookedModel>(sortBy: [SortDescriptor(\.at, order: .reverse)])
        d.fetchLimit = 60
        return ((try? context.fetch(d)) ?? []).map(\.recipeId)
    }

    /// One servings number, in order: the night's own, then the household size, then the recipe.
    func servings(for entry: PlanEntryModel?, recipe: RecipeModel) -> Int {
        entry?.servings ?? settings.cookingFor
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
        NotificationCenter.default.post(name: .plantryDataChanged, object: nil)
    }

    // MARK: - Undo

    /// What the collections looked like before a destructive action. Small enough to copy whole.
    struct Snapshot {
        var pantry: [PantryItem]
        var plan: [PlanEntry]
        var shop: [ShopItem]
        var cooked: [(CookedEntry, Date)]
        var members: [Member]
        var handoffs: [Handoff]
        var dismissed: [String]
    }

    func snapshot() -> Snapshot {
        Snapshot(pantry: fetch(PantryItemModel.self).map(\.value), plan: fetch(PlanEntryModel.self).map(\.value),
                 shop: fetch(ShopItemModel.self).sorted { $0.order < $1.order }.map(\.value),
                 cooked: fetch(CookedModel.self).map { ($0.value, $0.at) }, members: members.map(\.value),
                 handoffs: fetch(HandoffModel.self).map(\.value), dismissed: settings.shopDismissed)
    }

    func restore(_ s: Snapshot) {
        for m in fetch(PantryItemModel.self) { context.delete(m) }
        for m in fetch(PlanEntryModel.self) { context.delete(m) }
        for m in fetch(ShopItemModel.self) { context.delete(m) }
        for m in fetch(CookedModel.self) { context.delete(m) }
        for m in fetch(MemberModel.self) { context.delete(m) }
        for m in fetch(HandoffModel.self) { context.delete(m) }
        for p in s.pantry { context.insert(PantryItemModel(p)) }
        for p in s.plan { context.insert(PlanEntryModel(p)) }
        for (i, item) in s.shop.enumerated() { context.insert(ShopItemModel(item, order: i)) }
        for (c, at) in s.cooked { context.insert(CookedModel(recipeId: c.recipeId, date: c.date, cookId: c.cookId, at: at, rating: c.rating, note: c.note)) }
        for (i, m) in s.members.enumerated() { context.insert(MemberModel(m, order: i)) }
        for h in s.handoffs { context.insert(HandoffModel(h)) }
        settings.shopDismissed = s.dismissed
        save()
    }

    /// Runs an action and returns a closure that puts everything back.
    @discardableResult
    func undoable(_ action: () -> Void) -> () -> Void {
        let before = snapshot()
        action()
        return { [weak self] in self?.restore(before) }
    }

    // MARK: - Settings and household

    func update(_ patch: (SettingsModel) -> Void) {
        patch(settings)
        save()
    }

    private func nextColor() -> MemberColor {
        let existing = members
        let counts = MemberColor.allCases.map { c in existing.filter { $0.color == c }.count }
        let minCount = counts.min() ?? 0
        return MemberColor.allCases[counts.firstIndex(of: minCount) ?? 0]
    }

    func completeOnboarding(names: [String], tastes: [Taste], avoid: [String], pantryNames: [String]) {
        let now = ISO.now()
        let clean = names.map { String($0.trimmed.prefix(40)) }.filter { !$0.isEmpty }
        let colors = MemberColor.allCases
        for (i, name) in clean.enumerated() {
            context.insert(MemberModel(Member(id: IDs.make("m"), name: name, color: colors[i % colors.count], isMe: i == 0), order: i))
        }
        if clean.isEmpty {
            context.insert(MemberModel(Member(id: IDs.make("m"), name: "Me", color: .terracotta, isMe: true), order: 0))
        }
        for name in pantryNames { context.insert(PantryItemModel(makePantryItem(name, now: now))) }
        let s = settings
        s.onboarded = true
        s.tastes = tastes
        s.avoid = avoid
        s.cookingFor = max(1, clean.count)
        save()
    }

    func addMember(_ name: String) {
        let existing = members
        context.insert(MemberModel(Member(id: IDs.make("m"), name: String(name.trimmed.prefix(40)), color: nextColor(), isMe: nil), order: existing.count))
        save()
    }

    /// Removes a person and anything that pointed at them.
    func removeMember(_ m: MemberModel) {
        let id = m.id
        for p in fetch(PlanEntryModel.self) where p.cookId == id { p.cookId = nil }
        for h in fetch(HandoffModel.self) where h.fromId == id || h.toId == id { context.delete(h) }
        context.delete(m)
        save()
    }

    func renameMember(_ m: MemberModel, _ name: String) { m.name = String(name.trimmed.prefix(40)); save() }

    func setMemberAvoid(_ m: MemberModel, avoid: [String], diet: String?) { m.avoid = avoid; m.diet = diet; save() }

    func setMemberCooks(_ m: MemberModel, _ cooks: Bool) {
        m.cooks = cooks
        if !cooks {
            let id = m.id
            for p in fetch(PlanEntryModel.self) where p.cookId == id { p.cookId = nil }
            for h in fetch(HandoffModel.self) where h.toId == id { context.delete(h) }
        }
        save()
    }

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

    /// A copy of a built-in recipe that can be edited.
    @discardableResult
    func copyRecipe(_ m: RecipeModel) -> RecipeModel {
        var r = m.value
        r.id = ""
        r.title = "\(r.title) (my version)"
        r.ingredients = r.ingredients.map { var i = $0; i.id = IDs.make("i"); return i }
        r.steps = r.steps.map { var s = $0; s.id = IDs.make("s"); return s }
        r.source = "Copied from \(m.source ?? "Plantry")"
        return addRecipe(r)
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
        let z = zone ?? staple?.zone ?? PantryGuess.zone(for: name)
        return PantryItem(
            id: IDs.make("p"),
            name: name.trimmed.isEmpty ? (staple?.name ?? "") : String(name.trimmed.prefix(60)),
            key: key,
            zone: z,
            aisle: aisle ?? staple?.aisle ?? PantryGuess.aisle(for: name),
            quantity: quantity,
            unit: unit,
            addedAt: now,
            softLifeDays: softLifeDays ?? staple?.softLifeDays ?? PantryGuess.defaultLife(z),
            staple: staple?.staple
        )
    }

    enum AddResult { case added, restocked }

    @discardableResult
    func addPantryItem(name: String, zone: PantryZone? = nil, aisle: Aisle? = nil, quantity: Double? = nil, unit: String? = nil) -> AddResult {
        let key = keyOf(name)
        if let existing = fetch(PantryItemModel.self, #Predicate { $0.key == key }).first {
            restock(existing)
            if let quantity { existing.quantity = quantity; existing.unit = unit; save() }
            return .restocked
        }
        context.insert(PantryItemModel(makePantryItem(name, now: ISO.now(), zone: zone, aisle: aisle, quantity: quantity, unit: unit)))
        save()
        return .added
    }

    func removePantryItem(_ p: PantryItemModel) { context.delete(p); save() }
    func restock(_ p: PantryItemModel) { p.addedAt = ISO.now(); save() }

    /// Used it up: gone from the pantry, and staples go back on the list. Returns true if listed.
    @discardableResult
    func useUp(_ p: PantryItemModel) -> Bool {
        let value = p.value
        context.delete(p)
        save()
        guard value.isStaple else { return false }
        addShopItem(value.name, aisle: value.aisle)
        return true
    }

    func updatePantryItem(_ p: PantryItemModel, name: String? = nil, zone: PantryZone? = nil, quantity: Double?? = nil, unit: String?? = nil, softLifeDays: Int? = nil) {
        if let name, !name.isBlank { p.name = String(name.trimmed.prefix(60)); p.key = keyOf(name) }
        if let zone { p.zone = zone }
        if let quantity { p.quantity = quantity }
        if let unit { p.unit = unit }
        if let softLifeDays { p.softLifeDays = softLifeDays }
        save()
    }

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

    func meal(on date: String, _ slot: MealSlot) -> PlanEntryModel? {
        fetch(PlanEntryModel.self, #Predicate { $0.date == date }).first { $0.slot == slot }
    }

    /// Sets breakfast or lunch for a day: a recipe, last night's leftovers, or a short note.
    func setMeal(_ date: String, _ slot: MealSlot, recipeId: String? = nil, leftoversOf: String? = nil, note: String? = nil) {
        if slot == .dinner { setDinner(date, recipeId: recipeId, leftoversOf: leftoversOf, note: note, cookId: dinner(on: date)?.cookId); return }
        let was = meal(on: date, slot)
        if let was { context.delete(was) }
        context.insert(PlanEntryModel(PlanEntry(id: IDs.make("pl"), date: date, slot: slot, recipeId: recipeId, leftoversOf: leftoversOf, note: note, servings: was?.servings, cookId: was?.cookId)))
        save()
    }

    func clearMeal(_ date: String, _ slot: MealSlot) {
        if slot == .dinner { clearDinner(date); return }
        guard let e = meal(on: date, slot) else { return }
        context.delete(e)
        save()
    }

    func setServings(_ date: String, _ servings: Int) {
        if let e = dinner(on: date) { e.servings = servings; save() }
    }

    /// Clears a night. Its leftovers night the day after has nothing to be left over from any more.
    func clearDinner(_ date: String) {
        guard let e = dinner(on: date) else { return }
        if let rid = e.recipeId, let orphan = dinner(on: DateKey.addDays(date, 1)), orphan.leftoversOf == rid { context.delete(orphan) }
        context.delete(e)
        save()
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

    /// Marks the night cooked. Returns how many pantry items were used up. A second call does nothing.
    @discardableResult
    func markCooked(_ date: String, leftovers: Bool = false, usePantry: Bool = true, replaceTomorrow: Bool = false) -> Int {
        guard let entry = dinner(on: date), !entry.done else { return 0 }
        let recipe = recipe(entry.recipeId)
        var used = 0
        if usePantry, let recipe {
            let scale = Double(entry.servings ?? eaters(date, .dinner) ?? settings.cookingFor) / Double(max(recipe.servings, 1))
            for p in fetch(PantryItemModel.self) {
                guard let ing = recipe.ingredients.first(where: { !$0.isOptional && $0.key == p.key }) else { continue }
                // Known amount: take off what the recipe used.
                if let have = p.quantity, ing.quantity > 0,
                   let left = Quantity.subtract(Amount(quantity: have, unit: p.unit ?? ""), Amount(quantity: ing.quantity * scale, unit: ing.unit)) {
                    if left.quantity > 0.001 { p.quantity = left.quantity } else { context.delete(p); used += 1 }
                    continue
                }
                // No amount to go by: fresh things are used up, cupboard things stay.
                if p.softLifeDays <= 14 { context.delete(p); used += 1 }
            }
        }
        if let recipe {
            // The dinner is eaten, so its unbought list items can go.
            for item in fetch(ShopItemModel.self) where !item.checked && item.fromRecipeIds.contains(recipe.id) {
                if item.fromRecipeIds.count == 1 { context.delete(item) }
                else { item.fromRecipeIds.removeAll { $0 == recipe.id } }
            }
        }
        entry.done = true
        if leftovers, let recipe {
            let next = DateKey.addDays(date, 1)
            let taken = dinner(on: next)
            let busy = taken.map { $0.recipeId != nil || $0.note != nil } ?? false
            if !busy || replaceTomorrow {
                if let taken { context.delete(taken) }
                context.insert(PlanEntryModel(PlanEntry(id: IDs.make("pl"), date: next, slot: .dinner, leftoversOf: recipe.id, cookId: taken?.cookId)))
            }
        }
        context.insert(CookedModel(recipeId: entry.recipeId ?? entry.leftoversOf ?? "", date: date, cookId: entry.cookId))
        save()
        return used
    }

    func setEnergy(_ date: String, _ energy: Energy) {
        settings.energyByDate[date] = energy
        save()
    }

    func setStillTonight(_ date: String?) { settings.stillTonightDate = date; save() }

    // MARK: - Shop

    /// Builds the list from planned dinners still to come on these dates.
    /// `kept` means nothing was planned, so an existing list was left alone.
    @discardableResult
    func generateShop(dates: [String], today: String = DateKey.key(Date())) -> (fromPlan: Int, kept: Bool) {
        let dateSet = Set(dates)
        let dismissed = Set(settings.shopDismissed)
        let cookingFor = settings.cookingFor
        let tog = together
        let memberIds = members.map(\.id)
        var needed: [String: (item: ShopItem, amounts: [Amount])] = [:]
        var orderKeys: [String] = []
        for entry in fetch(PlanEntryModel.self).sorted(by: { $0.date < $1.date }) where dateSet.contains(entry.date) && entry.date >= today && !entry.done {
            guard let rid = entry.recipeId, let recipe = recipe(rid) else { continue }
            // Who's actually eating: nobody home means nothing to buy for that meal.
            let eaters = Together.eaters(tog, memberIds: memberIds, entry.date, entry.slot, cookingFor: cookingFor)
            if eaters == 0 { continue }
            let scale = Double(entry.servings ?? eaters ?? cookingFor) / Double(max(recipe.servings, 1))
            for ing in recipe.ingredients where !ing.isOptional && !dismissed.contains(ing.key) {
                var cur = needed[ing.key] ?? (ShopItem(id: IDs.make("sh"), name: ing.name, key: ing.key, quantity: nil, unit: nil, aisle: ing.aisle, checked: false, fromRecipeIds: []), [])
                if needed[ing.key] == nil { orderKeys.append(ing.key) }
                if ing.quantity > 0 { cur.amounts = Quantity.add(cur.amounts, Amount(quantity: ing.quantity * scale, unit: ing.unit)) }
                if !cur.item.fromRecipeIds.contains(recipe.id) { cur.item.fromRecipeIds.append(recipe.id) }
                needed[ing.key] = cur
            }
        }
        // Take off what the pantry already covers. Without a known amount, assume enough.
        let pantry = fetch(PantryItemModel.self)
        for key in orderKeys {
            guard var cur = needed[key], let have = pantry.first(where: { $0.key == key }) else { continue }
            guard let q = have.quantity, let i = cur.amounts.firstIndex(where: { Quantity.compatible($0.unit, have.unit ?? "") }) else {
                needed[key] = nil
                continue
            }
            let left = Quantity.subtract(cur.amounts[i], Amount(quantity: q, unit: have.unit ?? ""))
            if let left, left.quantity > 0.001 { cur.amounts[i] = left } else { cur.amounts.remove(at: i) }
            if cur.amounts.isEmpty { needed[key] = nil } else { needed[key] = cur }
        }
        let existing = fetch(ShopItemModel.self).sorted { $0.order < $1.order }
        let old = Dictionary(existing.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
        let generatedKeys = orderKeys.filter { needed[$0] != nil }
        // Never swap a list that has plan items for an empty one without asking.
        if generatedKeys.isEmpty && existing.contains(where: { !$0.fromRecipeIds.isEmpty }) { return (0, true) }
        for item in existing where !item.fromRecipeIds.isEmpty || generatedKeys.contains(item.key) { context.delete(item) }
        var order = 0
        for key in generatedKeys {
            let cur = needed[key]!
            var all = cur.amounts
            var item = cur.item
            // A manual row for the same thing merges in instead of showing twice.
            if let prev = old[key] {
                if prev.fromRecipeIds.isEmpty, let q = prev.quantity { all = Quantity.add(all, Amount(quantity: q, unit: prev.unit ?? "")) }
                item.id = prev.id
                item.checked = prev.checked
            }
            item.quantity = all.first?.quantity
            item.unit = all.first?.unit
            item.more = all.count > 1 ? Array(all.dropFirst()) : nil
            context.insert(ShopItemModel(item, order: order))
            order += 1
        }
        save()
        return (generatedKeys.count, false)
    }

    enum ShopAdd { case added, exists }

    @discardableResult
    func addShopItem(_ name: String, aisle: Aisle? = nil, quantity: Double? = nil, unit: String? = nil, recipeId: String? = nil) -> ShopAdd {
        let key = keyOf(name)
        settings.shopDismissed.removeAll { $0 == key }
        if let existing = fetch(ShopItemModel.self, #Predicate { $0.key == key }).first {
            // Already there: add the amount and the recipe instead of a second row.
            if let quantity { existing.apply(amounts: Quantity.add(existing.amounts, Amount(quantity: quantity, unit: unit ?? ""))) }
            if let recipeId, !existing.fromRecipeIds.contains(recipeId) { existing.fromRecipeIds.append(recipeId) }
            save()
            return .exists
        }
        let staple = Seed.staplesByKey[key]
        let order = ((try? context.fetchCount(FetchDescriptor<ShopItemModel>())) ?? 0) + 1000
        context.insert(ShopItemModel(ShopItem(id: IDs.make("sh"), name: String(name.trimmed.prefix(60)), key: key, quantity: quantity, unit: quantity == nil ? nil : (unit ?? ""), aisle: aisle ?? staple?.aisle ?? PantryGuess.aisle(for: name), checked: false, fromRecipeIds: recipeId.map { [$0] } ?? []), order: order))
        save()
        return .added
    }

    func toggleShopItem(_ item: ShopItemModel) { item.checked.toggle(); save() }

    /// Removes a row. A plan item stays off the list until the next shop or `restoreDismissed`.
    func removeShopItem(_ item: ShopItemModel) {
        if !item.fromRecipeIds.isEmpty, !settings.shopDismissed.contains(item.key) { settings.shopDismissed.append(item.key) }
        context.delete(item)
        save()
    }

    func restoreDismissed() { settings.shopDismissed = []; save() }

    func clearShop() {
        for item in fetch(ShopItemModel.self) { context.delete(item) }
        save()
    }

    func updateShopItem(_ item: ShopItemModel, name: String?, quantity: Double?, unit: String?) {
        if let name, !name.isBlank { item.name = String(name.trimmed.prefix(60)); item.key = keyOf(name) }
        // A typed amount replaces any amounts that were added up from recipes.
        item.quantity = quantity
        item.unit = quantity == nil ? nil : (unit ?? "")
        item.more = []
        save()
    }

    func clearChecked() {
        let checked = fetch(ShopItemModel.self, #Predicate { $0.checked })
        settings.bought = Usuals.recordTrip(settings.bought, items: checked.map(\.value), day: DateKey.key(Date()))
        for item in checked { context.delete(item) }
        save()
    }

    /// Bought on at least two trips, the last within six weeks, and not on the list now.
    func usuals(today: String) -> [(key: String, entry: BoughtEntry)] {
        Usuals.usuals(settings.bought, onList: Set(fetch(ShopItemModel.self).map(\.key)), today: today)
    }

    /// "milk, two onions and we're out of eggs": everything lands on the list, and what ran out leaves the pantry.
    @discardableResult
    func capture(_ text: String) -> (added: Int, already: Int, outOf: Int) {
        var added = 0, already = 0, outOf = 0
        for item in Capture.parse(text) {
            if addShopItem(item.name, quantity: item.quantity, unit: item.unit) == .added { added += 1 } else { already += 1 }
            if item.outOf {
                let key = keyOf(item.name)
                for p in fetch(PantryItemModel.self, #Predicate { $0.key == key }) { context.delete(p); outOf += 1 }
            }
        }
        save()
        return (added, already, outOf)
    }

    func washer(on date: String, cookId: String?) -> MemberModel? {
        Chores.washer(on: date, cookId: cookId, members: members, id: \.id)
    }

    func finishShopping() {
        let now = ISO.now()
        let pantry = fetch(PantryItemModel.self)
        let checked = fetch(ShopItemModel.self, #Predicate { $0.checked })
        settings.bought = Usuals.recordTrip(settings.bought, items: checked.map(\.value), day: DateKey.key(Date()))
        for item in checked {
            // Every amount on the row, in the first unit that adds up: 350 g + 2 tbsp becomes 350 g.
            let bought = item.amounts
            if let existing = pantry.first(where: { $0.key == item.key }) {
                existing.addedAt = now
                if let have = existing.quantity {
                    var list = [Amount(quantity: have, unit: existing.unit ?? "")]
                    for a in bought { list = Quantity.add(list, a) }
                    existing.apply(amount: list.first)
                } else if let first = bought.first {
                    existing.apply(amount: first)
                }
            } else {
                context.insert(PantryItemModel(makePantryItem(item.name, now: now, aisle: item.aisle, quantity: bought.first?.quantity, unit: bought.first?.unit)))
            }
            context.delete(item)
        }
        // Rows the person removed from the list stay off until they ask them back.
        save()
    }

    // MARK: - Household

    /// One hand-off per night: a new one replaces the old.
    func createHandoff(date: String, from: MemberModel, to: MemberModel, recipeId: String?, message: String?) {
        for h in fetch(HandoffModel.self, #Predicate { $0.date == date }) { context.delete(h) }
        context.insert(HandoffModel(Handoff(id: IDs.make("h"), date: date, fromId: from.id, toId: to.id, recipeId: recipeId, message: message, createdAt: ISO.now(), accepted: nil)))
        if let e = dinner(on: date) { e.cookId = to.id }
        save()
    }

    func handoff(on date: String) -> HandoffModel? { fetch(HandoffModel.self, #Predicate { $0.date == date }).first }

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
        var shopDismissed: [String]
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
            shopDismissed: s.shopDismissed,
            handoffs: fetch(HandoffModel.self).map(\.value),
            energyByDate: s.energyByDate,
            cooked: fetch(CookedModel.self).sorted { $0.at > $1.at }.map(\.value)
        )
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        return (try? enc.encode(bundle)) ?? Data()
    }

    /// What an import file holds, checked row by row so one bad row doesn't sink the file.
    struct ImportPreview {
        var settings: Settings?
        var members: [Member]
        var recipes: [Recipe]
        var pantry: [PantryItem]
        var plan: [PlanEntry]
        var shop: [ShopItem]
        var shopDismissed: [String]
        var handoffs: [Handoff]
        var energyByDate: [String: Energy]
        var cooked: [CookedEntry]
        /// Rows that could not be read and were left out.
        var dropped: Int
        var exportedAt: String?
    }

    enum ImportError: LocalizedError {
        case notPlantry, unreadable
        var errorDescription: String? {
            switch self {
            case .notPlantry: "That file does not look like a Plantry backup."
            case .unreadable: "Could not read that file."
            }
        }
    }

    /// Reads and checks a backup without changing anything.
    func checkImport(_ data: Data) throws -> ImportPreview {
        guard let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw ImportError.unreadable }
        guard raw["recipes"] is [Any] || raw["version"] != nil else { throw ImportError.notPlantry }
        var dropped = 0
        func rows<T: Decodable>(_ key: String, as: T.Type) -> [T] {
            guard let list = raw[key] as? [Any] else { return [] }
            return list.compactMap { row in
                guard let d = try? JSONSerialization.data(withJSONObject: row), let v = try? JSONDecoder().decode(T.self, from: d) else { dropped += 1; return nil }
                return v
            }
        }
        func one<T: Decodable>(_ key: String, as: T.Type) -> T? {
            guard let obj = raw[key], let d = try? JSONSerialization.data(withJSONObject: obj) else { return nil }
            return try? JSONDecoder().decode(T.self, from: d)
        }
        var recipes = rows("recipes", as: Recipe.self).filter { !$0.id.isEmpty && !$0.title.isBlank }
        if recipes.isEmpty { recipes = Seed.recipes }
        let members = rows("members", as: Member.self).filter { !$0.name.isBlank }
        let memberIds = Set(members.map(\.id))
        let recipeIds = Set(recipes.map(\.id))
        let plan = rows("plan", as: PlanEntry.self).filter { $0.date.count == 10 }.map { p in
            var e = p
            if let r = e.recipeId, !recipeIds.contains(r) { e.recipeId = nil; if e.note == nil { e.note = "Removed recipe" } }
            if let c = e.cookId, !memberIds.contains(c) { e.cookId = nil }
            return e
        }
        let pantry = rows("pantry", as: PantryItem.self).filter { !$0.name.isBlank }
        let shop = rows("shop", as: ShopItem.self).filter { !$0.name.isBlank }
        let handoffs = rows("handoffs", as: Handoff.self).filter { memberIds.contains($0.fromId) && memberIds.contains($0.toId) }
        let cooked = rows("cooked", as: CookedEntry.self)
        return ImportPreview(settings: one("settings", as: Settings.self), members: members, recipes: recipes, pantry: pantry, plan: plan, shop: shop,
                             shopDismissed: (raw["shopDismissed"] as? [String]) ?? [], handoffs: handoffs,
                             energyByDate: one("energyByDate", as: [String: Energy].self) ?? [:], cooked: cooked, dropped: dropped,
                             exportedAt: raw["exportedAt"] as? String)
    }

    /// Replaces everything with the checked file. Returns an undo closure that restores what was there.
    @discardableResult
    func applyImport(_ p: ImportPreview) -> () -> Void {
        let before = snapshot()
        let beforeSettings = settings.value
        let beforeRecipes = fetch(RecipeModel.self).map(\.value)
        let beforeEnergy = settings.energyByDate
        wipe(keepSettings: true)
        var s = p.settings ?? Settings()
        s.onboarded = true
        let sm = settings
        sm.apply(s)
        sm.energyByDate = p.energyByDate
        sm.shopDismissed = p.shopDismissed
        for (i, m) in p.members.enumerated() { context.insert(MemberModel(m, order: i)) }
        for r in p.recipes { context.insert(RecipeModel(r)) }
        for item in p.pantry { context.insert(PantryItemModel(item)) }
        for e in p.plan { context.insert(PlanEntryModel(e)) }
        for (i, item) in p.shop.enumerated() { context.insert(ShopItemModel(item, order: i)) }
        for h in p.handoffs { context.insert(HandoffModel(h)) }
        for (i, c) in p.cooked.enumerated() { context.insert(CookedModel(recipeId: c.recipeId, date: c.date, cookId: c.cookId, at: Date().addingTimeInterval(-Double(i)), rating: c.rating, note: c.note)) }
        shuffleSeen = []
        save()
        return { [weak self] in
            guard let self else { return }
            for m in self.fetch(RecipeModel.self) { self.context.delete(m) }
            for r in beforeRecipes { self.context.insert(RecipeModel(r)) }
            self.settings.apply(beforeSettings)
            self.settings.energyByDate = beforeEnergy
            self.restore(before)
        }
    }

    func importJSON(_ data: Data) throws {
        _ = applyImport(try checkImport(data))
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

extension PantryItemModel {
    func apply(amount: Amount?) {
        quantity = amount?.quantity
        unit = amount?.unit
    }
}
