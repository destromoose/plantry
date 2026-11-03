import XCTest
import SwiftData
@testable import Plantry

// Ports of the web app's vitest suites for the context engine, ranker and parser,
// plus a SwiftData round trip for the store. Run with ⌘U or `xcodebuild test`.

final class ContextEngineTests: XCTestCase {
    private func date(_ y: Int, _ mo: Int, _ d: Int, _ h: Int, _ mi: Int = 0) -> Date {
        var c = DateComponents(); c.year = y; c.month = mo; c.day = d; c.hour = h; c.minute = mi
        return DateKey.calendar.date(from: c)!
    }

    private func recipe(_ id: String, aisle: Aisle = .produce) -> Recipe {
        Recipe(id: id, title: id, description: "", imageUrl: nil, activeMinutes: 20, totalMinutes: 30, servings: 2,
               ingredients: [Ingredient(id: "\(id)-i1", name: "Thing", key: "thing", quantity: 1, unit: "", aisle: aisle, optional: nil)],
               steps: [], tastes: [], weather: nil, leftovers: nil, source: nil, sourceUrl: nil, isFavorite: false, createdAt: "2026-01-01", custom: nil)
    }

    private func dinner(_ date: String, _ rid: String) -> PlanEntry { PlanEntry(id: "pl-\(date)", date: date, slot: .dinner, recipeId: rid) }

    func testMoodBoundaries() {
        XCTAssertEqual(ContextEngine.mood(forHour: 4), .night)
        XCTAssertEqual(ContextEngine.mood(forHour: 5), .dawn)
        XCTAssertEqual(ContextEngine.mood(forHour: 9), .dawn)
        XCTAssertEqual(ContextEngine.mood(forHour: 10), .day)
        XCTAssertEqual(ContextEngine.mood(forHour: 16), .day)
        XCTAssertEqual(ContextEngine.mood(forHour: 17), .dusk)
        XCTAssertEqual(ContextEngine.mood(forHour: 20), .dusk)
        XCTAssertEqual(ContextEngine.mood(forHour: 21), .night)
        XCTAssertEqual(ContextEngine.mood(forHour: 0), .night)
    }

    func testTargetsTomorrowAfterTen() {
        let nine = ContextEngine.build(.init(now: date(2026, 11, 3, 21, 30), settings: Settings(), weather: nil, plan: [], recipes: []))
        XCTAssertEqual(nine.targetLabel, "Tonight", "the cutoff moved to 10 pm")
        let late = ContextEngine.build(.init(now: date(2026, 11, 3, 22, 30), settings: Settings(), weather: nil, plan: [], recipes: []))
        XCTAssertEqual(late.targetLabel, "Tomorrow")
        XCTAssertEqual(late.targetDate, "2026-11-04")
        XCTAssertTrue(late.canStayTonight)
        let stay = ContextEngine.build(.init(now: date(2026, 11, 3, 22, 30), settings: Settings(), weather: nil, plan: [], recipes: [], stillTonight: true))
        XCTAssertEqual(stay.targetLabel, "Tonight")
        // Past midnight the date has rolled over, so the new day's dinner is the target.
        let small = ContextEngine.build(.init(now: date(2026, 11, 4, 0, 30), settings: Settings(), weather: nil, plan: [], recipes: []))
        XCTAssertEqual(small.targetLabel, "Tonight")
        XCTAssertEqual(small.targetDate, "2026-11-04")
        let evening = ContextEngine.build(.init(now: date(2026, 11, 3, 18), settings: Settings(), weather: nil, plan: [], recipes: []))
        XCTAssertEqual(evening.targetLabel, "Tonight")
        XCTAssertEqual(evening.targetDate, "2026-11-03")
    }

    func testNudges() {
        let sat = ContextEngine.build(.init(now: date(2026, 11, 7, 9), settings: Settings(), weather: nil, plan: [], recipes: []))
        XCTAssertTrue(sat.isWeekend)
        XCTAssertEqual(sat.nudge, .planWeek)

        let tue = ContextEngine.build(.init(now: date(2026, 11, 3, 17, 30), settings: Settings(), weather: nil, plan: [dinner("2026-11-03", "soup")], recipes: [recipe("soup")]))
        XCTAssertEqual(tue.nudge, .startNow)

        let morning = ContextEngine.build(.init(now: date(2026, 11, 3, 9), settings: Settings(), weather: nil, plan: [dinner("2026-11-03", "chicken")], recipes: [recipe("chicken", aisle: .meatFish)]))
        XCTAssertEqual(morning.nudge, .defrost)
    }

    func testWeatherLean() {
        XCTAssertEqual(ContextEngine.lean(for: Weather(tempC: 5, precipitation: true, fetchedAt: "")), .warm)
        XCTAssertEqual(ContextEngine.lean(for: Weather(tempC: 30, precipitation: false, fetchedAt: "")), .light)
        XCTAssertEqual(ContextEngine.lean(for: Weather(tempC: 18, precipitation: false, fetchedAt: "")), .any)
        XCTAssertEqual(ContextEngine.lean(for: nil), .any)
    }

    func testDateHelpers() {
        XCTAssertEqual(DateKey.addDays("2026-11-03", 1), "2026-11-04")
        XCTAssertEqual(DateKey.daysBetween("2026-11-01", "2026-11-05"), 4)
        XCTAssertEqual(DateKey.weekOf("2026-11-04").first, "2026-11-02")
        XCTAssertEqual(DateKey.weekOf("2026-11-01").first, "2026-10-26")
        XCTAssertEqual(keyOf("Tomatoes"), "tomato")
        XCTAssertEqual(keyOf("Berries"), "berry")
        XCTAssertEqual(keyOf("Garlic (minced)"), "garlic")
        XCTAssertEqual(formatQuantity(1.5, "cup"), "1½ cups")
        XCTAssertEqual(formatMinutes(75), "1 h 15 min")
    }
}

final class SuggestTests: XCTestCase {
    private func recipe(_ id: String, active: Int = 20, ingredients: [Ingredient] = []) -> Recipe {
        Recipe(id: id, title: id, description: "", imageUrl: nil, activeMinutes: active, totalMinutes: active + 10, servings: 2,
               ingredients: ingredients, steps: [], tastes: [], weather: nil, leftovers: nil, source: nil, sourceUrl: nil, isFavorite: false, createdAt: "2026-01-01", custom: nil)
    }

    private func ing(_ name: String, optional: Bool = false) -> Ingredient {
        Ingredient(id: name, name: name, key: keyOf(name), quantity: 1, unit: "", aisle: .produce, optional: optional ? true : nil)
    }

    func testCoverageCountsRequiredOnly() {
        let r = recipe("x", ingredients: [ing("garlic"), ing("rice"), ing("lime"), ing("parsley", optional: true)])
        let pantry = [PantryItem(id: "p", name: "Garlic", key: "garlic", zone: .counter, aisle: .produce, quantity: nil, unit: nil, addedAt: "2026-11-01", softLifeDays: 21, staple: true)]
        let c = coverage(r, pantry: pantry)
        XCTAssertEqual(c.total, 3)
        XCTAssertEqual(c.have, 1)
        XCTAssertEqual(c.missing, ["rice", "lime"])
    }

    func testQuickFirstWhenCantTonight() {
        let out = suggest(SuggestInput(recipes: [recipe("slow", active: 45), recipe("quick", active: 8)], pantry: [], tastes: [], energy: .cantTonight, weatherLean: .any, isWeekend: false, today: "2026-11-03"))
        XCTAssertEqual(out.map(\.recipe.id), ["quick", "slow"])
    }

    func testPenalizesRecent() {
        let out = suggest(SuggestInput(recipes: [recipe("a"), recipe("b")], pantry: [], tastes: [], weatherLean: .any, isWeekend: false, today: "2026-11-03", recent: ["a"]))
        XCTAssertEqual(out.first?.recipe.id, "b")
    }

    func testPickNextSkipsSeen() {
        let ranked = suggest(SuggestInput(recipes: ["a", "b", "c", "d"].map { recipe($0) }, pantry: [], tastes: [], weatherLean: .any, isWeekend: false, today: "2026-11-03"))
        for _ in 0..<20 {
            let pick = pickNext(ranked, seen: ["a", "b"])
            XCTAssertTrue(["c", "d"].contains(pick?.recipe.id ?? ""))
        }
    }

    func testSeedLoads() {
        XCTAssertEqual(Seed.recipes.count, 40)
        XCTAssertEqual(Seed.staples.count, 36)
        XCTAssertEqual(Seed.quickPicks.count, 30)
    }
}

final class RecipeParserTests: XCTestCase {
    func testHeadings() {
        let r = RecipeParser.parse("""
        Lemon Garlic Pasta

        Ingredients
        200g spaghetti
        2 cloves garlic, minced
        1/2 cup parmesan
        ½ tsp chili flakes
        2 tbsp olive oil
        1 lemon

        Method
        1. Boil the pasta in salted water for 10 minutes.
        Drain, keep a cup of the water.
        2. Fry the garlic for 2-3 minutes.
        3. Toss everything together and serve.
        """)
        XCTAssertEqual(r.title, "Lemon Garlic Pasta")
        XCTAssertEqual(r.ingredients.count, 6)
        XCTAssertEqual(r.steps.count, 3)
        let byName = Dictionary(r.ingredients.map { ($0.name, $0) }, uniquingKeysWith: { a, _ in a })
        XCTAssertEqual(byName["spaghetti"], ParsedIngredient(name: "spaghetti", quantity: 200, unit: "g"))
        XCTAssertEqual(byName["parmesan"], ParsedIngredient(name: "parmesan", quantity: 0.5, unit: "cup"))
        XCTAssertEqual(byName["chili flakes"], ParsedIngredient(name: "chili flakes", quantity: 0.5, unit: "tsp"))
        XCTAssertEqual(byName["lemon"], ParsedIngredient(name: "lemon", quantity: 1, unit: ""))
        XCTAssertEqual(r.steps[0].text, "Boil the pasta in salted water for 10 minutes. Drain, keep a cup of the water.")
        XCTAssertEqual(r.steps[0].timerMinutes, 10)
        XCTAssertEqual(r.steps[1].timerMinutes, 3)
        XCTAssertNil(r.steps[2].timerMinutes)
    }

    func testWithoutHeadings() {
        let r = RecipeParser.parse("Quick Beans\n- 1 can chickpeas\n- 1 tbsp olive oil\n- 1 lemon\nWarm the chickpeas in the oil for 8 minutes.\nSqueeze over the lemon and eat.")
        XCTAssertEqual(r.title, "Quick Beans")
        XCTAssertEqual(r.ingredients.map(\.name), ["chickpeas", "olive oil", "lemon"])
        XCTAssertEqual(r.steps.count, 2)
        XCTAssertEqual(r.steps[0].timerMinutes, 8)
    }

    func testNumericFirstLineIsNotTitle() {
        let r = RecipeParser.parse("2 eggs\n1 tbsp butter\nWhisk the eggs. Cook in butter for 4 minutes.")
        XCTAssertNil(r.title)
        XCTAssertEqual(r.ingredients.count, 2)
        XCTAssertEqual(r.steps[0].timerMinutes, 4)
    }

    func testEmpty() {
        XCTAssertEqual(RecipeParser.parse("  \n "), ParsedRecipe())
        XCTAssertEqual(RecipeParser.parseIngredientLine("2 cloves garlic, minced"), ParsedIngredient(name: "garlic", quantity: 2, unit: "cloves"))
    }
}

@MainActor
final class StoreTests: XCTestCase {
    private func makeStore() throws -> Store {
        let container = try ModelContainer(for: RecipeModel.self, PantryItemModel.self, PlanEntryModel.self, ShopItemModel.self, MemberModel.self, HandoffModel.self, CookedModel.self, SettingsModel.self,
                                           configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        return Store(container: container)
    }

    func testOnboardingSeedsHouseholdAndPantry() throws {
        let store = try makeStore()
        XCTAssertEqual(store.fetch(RecipeModel.self).count, 40)
        store.completeOnboarding(names: ["Alex", "Sam"], tastes: [.fast], avoid: [], pantryNames: ["Garlic", "Rice"])
        XCTAssertTrue(store.settings.onboarded)
        XCTAssertEqual(store.members.map(\.name), ["Alex", "Sam"])
        XCTAssertTrue(store.me?.isMe ?? false)
        XCTAssertEqual(store.fetch(PantryItemModel.self).count, 2)
    }

    func testLockInCookAndLeftovers() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], avoid: [], pantryNames: ["Spinach", "Feta"])
        let recipe = store.fetch(RecipeModel.self).first { $0.leftovers }!
        store.setDinner("2026-11-03", recipeId: recipe.id)
        XCTAssertEqual(store.dinner(on: "2026-11-03")?.recipeId, recipe.id)
        store.markCooked("2026-11-03", leftovers: true, usePantry: true)
        XCTAssertTrue(store.dinner(on: "2026-11-03")?.done ?? false)
        XCTAssertEqual(store.dinner(on: "2026-11-04")?.leftoversOf, recipe.id)
        XCTAssertEqual(store.recentlyCooked.first, recipe.id)
    }

    func testShopFromPlanAndFinishShopping() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], avoid: [], pantryNames: ["Olive oil"])
        let recipe = store.fetch(RecipeModel.self).first!
        store.setDinner("2026-11-05", recipeId: recipe.id)
        store.generateShop(dates: ["2026-11-05"])
        let needed = recipe.requiredIngredients.filter { $0.key != "olive oil" }.count
        XCTAssertEqual(store.fetch(ShopItemModel.self).count, needed)
        for item in store.fetch(ShopItemModel.self) { store.toggleShopItem(item) }
        store.finishShopping()
        XCTAssertEqual(store.fetch(ShopItemModel.self).count, 0)
        XCTAssertEqual(store.fetch(PantryItemModel.self).count, needed + 1)
    }

    func testExportImportRoundTrip() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [.cozy], avoid: [], pantryNames: ["Rice"])
        store.setDinner("2026-11-03", note: "Takeout")
        let data = store.exportJSON()
        let other = try makeStore()
        try other.importJSON(data)
        XCTAssertEqual(other.members.map(\.name), ["Alex"])
        XCTAssertEqual(other.settings.tastes, [.cozy])
        XCTAssertEqual(other.dinner(on: "2026-11-03")?.note, "Takeout")
        XCTAssertEqual(other.fetch(RecipeModel.self).count, 40)
        XCTAssertThrowsError(try other.importJSON(Data("{\"nope\":1}".utf8)))
    }

    func testShopSubtractsPantryAndMergesManualRows() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], avoid: [], pantryNames: [])
        let recipe = store.fetch(RecipeModel.self).first { $0.title == "Mushroom and spinach frittata" }!
        let eggs = recipe.ingredients.first { $0.key == "egg" }!
        store.addPantryItem(name: "Eggs", quantity: 4, unit: "whole")
        store.addShopItem("Mushrooms")
        store.setDinner("2026-11-05", recipeId: recipe.id, servings: recipe.servings)
        store.generateShop(dates: ["2026-11-05"], today: "2026-11-03")
        let shop = store.fetch(ShopItemModel.self)
        let eggRow = shop.first { $0.key == "egg" }
        XCTAssertEqual(eggRow?.quantity, eggs.quantity - 4)
        XCTAssertEqual(shop.filter { $0.key == "mushroom" }.count, 1, "manual row merged into the plan row")
        XCTAssertEqual(store.generateShop(dates: ["2026-11-20"], today: "2026-11-03").kept, true, "an empty plan never wipes the list")
    }

    func testDismissedRowsStayOffAndUndoRestores() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], avoid: [], pantryNames: [])
        let recipe = store.fetch(RecipeModel.self).first!
        store.setDinner("2026-11-05", recipeId: recipe.id)
        store.generateShop(dates: ["2026-11-05"], today: "2026-11-03")
        let before = store.fetch(ShopItemModel.self).count
        let row = store.fetch(ShopItemModel.self).first!
        let undo = store.undoable { store.removeShopItem(row) }
        store.generateShop(dates: ["2026-11-05"], today: "2026-11-03")
        XCTAssertEqual(store.fetch(ShopItemModel.self).count, before - 1)
        undo()
        XCTAssertEqual(store.fetch(ShopItemModel.self).count, before)
    }

    func testCookedTwiceLogsOnceAndTrimsNothing() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], avoid: [], pantryNames: [])
        let recipe = store.fetch(RecipeModel.self).first!
        store.setDinner("2026-11-03", recipeId: recipe.id)
        store.markCooked("2026-11-03")
        store.markCooked("2026-11-03")
        XCTAssertEqual(store.fetch(CookedModel.self).count, 1)
    }

    func testAllergyFilterReachesSuggestions() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], avoid: ["peanut"], pantryNames: [])
        XCTAssertEqual(store.householdAvoid, ["peanut"])
        let out = suggest(SuggestInput(recipes: store.fetch(RecipeModel.self).map(\.value), pantry: [], tastes: [], weatherLean: .any, isWeekend: false, today: "2026-11-03", avoid: store.householdAvoid))
        XCTAssertFalse(out.contains { $0.recipe.title == "Peanut chicken noodles" })
    }

    func testImportPreviewDropsBadRowsAndKeepsGoodOnes() throws {
        let store = try makeStore()
        let json = """
        {"version":1,"recipes":[],"members":[{"id":"m1","name":"Sam","color":"sage"},{"bad":true}],"plan":[{"id":"p1","date":"2026-11-03","slot":"dinner","note":"Takeout"}]}
        """
        let p = try store.checkImport(Data(json.utf8))
        XCTAssertEqual(p.members.map(\.name), ["Sam"])
        XCTAssertEqual(p.dropped, 1)
        XCTAssertEqual(p.recipes.count, 40, "an empty recipe list falls back to the starters")
        XCTAssertThrowsError(try store.checkImport(Data("not json".utf8)))
        XCTAssertThrowsError(try store.checkImport(Data("{\"nope\":1}".utf8)))
    }

    func testUndoRestoresAClearedNight() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], avoid: [], pantryNames: [])
        let recipe = store.fetch(RecipeModel.self).first!
        store.setDinner("2026-11-03", recipeId: recipe.id, servings: 3)
        let undo = store.undoable { store.clearDinner("2026-11-03") }
        XCTAssertNil(store.dinner(on: "2026-11-03"))
        undo()
        XCTAssertEqual(store.dinner(on: "2026-11-03")?.recipeId, recipe.id)
        XCTAssertEqual(store.dinner(on: "2026-11-03")?.servings, 3)
    }

    func testFinishShoppingKeepsDismissedAndFoldsAmounts() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], avoid: [], pantryNames: [])
        store.addPantryItem(name: "Yogurt", quantity: 100, unit: "g")
        store.addShopItem("Yogurt", quantity: 350, unit: "g")
        store.addShopItem("Yogurt", quantity: 2, unit: "tbsp")
        store.settings.shopDismissed = ["lime"]
        for item in store.fetch(ShopItemModel.self) { store.toggleShopItem(item) }
        store.finishShopping()
        let yogurt = store.fetch(PantryItemModel.self).first { $0.key == "yogurt" }
        XCTAssertEqual(yogurt?.quantity, 450)
        XCTAssertEqual(store.settings.shopDismissed, ["lime"])
    }

    func testAmountParserReadsEveryFractionItPrints() {
        for q in [0.125, 0.375, 0.625, 0.875, 1.5, 2.25] {
            XCTAssertEqual(Quantity.parse(Quantity.niceNumber(q)) ?? -1, q, accuracy: 0.001)
        }
    }

    func testCaptureReadsABrainDump() {
        let items = Capture.parse("we're out of eggs and milk, and get two onions. Also some rice please, that's it")
        XCTAssertEqual(items.map(\.name), ["Eggs", "Milk", "Onions", "Rice"])
        XCTAssertEqual(items.map(\.outOf), [true, true, false, false])
        XCTAssertEqual(items[2].quantity, 2)
        XCTAssertEqual(Capture.parse("mac and cheese, salt and pepper").map(\.name), ["Mac and cheese", "Salt and pepper"])
        XCTAssertEqual(Capture.parse("necesitamos dos limones y no queda leche").map(\.outOf), [false, true])
    }

    func testUsualsNeedTwoTripsAndStayOffWhileListed() {
        var bought: [String: BoughtEntry] = [:]
        let milk = ShopItem(id: "a", name: "Milk", key: "milk", quantity: nil, unit: nil, aisle: .dairy, checked: true, fromRecipeIds: [])
        bought = Usuals.recordTrip(bought, items: [milk], day: "2026-10-01")
        XCTAssertTrue(Usuals.usuals(bought, onList: [], today: "2026-10-20").isEmpty)
        bought = Usuals.recordTrip(bought, items: [milk], day: "2026-10-10")
        bought = Usuals.recordTrip(bought, items: [milk], day: "2026-10-10")
        XCTAssertEqual(bought["milk"]?.trips, ["2026-10-10", "2026-10-01"])
        XCTAssertEqual(Usuals.usuals(bought, onList: [], today: "2026-10-20").map(\.key), ["milk"])
        XCTAssertTrue(Usuals.usuals(bought, onList: ["milk"], today: "2026-10-20").isEmpty)
        XCTAssertTrue(Usuals.usuals(bought, onList: [], today: "2027-01-01").isEmpty, "forgotten after six weeks")
    }

    func testWasherIsNeverTheCookAndRotatesFairly() {
        let members = ["a", "b", "c"]
        var counts: [String: Int] = [:]
        for d in 0..<14 {
            let date = DateKey.addDays("2026-11-02", d)
            let w = Chores.washer(on: date, cookId: "a", members: members, id: { $0 })
            XCTAssertNotEqual(w, "a")
            counts[w ?? "none", default: 0] += 1
        }
        XCTAssertEqual(counts["b"], 7)
        XCTAssertEqual(counts["c"], 7)
        XCTAssertNil(Chores.washer(on: "2026-11-02", cookId: "a", members: ["a"], id: { $0 }))
        XCTAssertNil(Chores.washer(on: "2026-11-02", cookId: nil, members: members, id: { $0 }))
    }

    func testFinishShoppingRecordsATrip() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], avoid: [], pantryNames: [])
        store.addShopItem("Milk")
        for item in store.fetch(ShopItemModel.self) { store.toggleShopItem(item) }
        store.finishShopping()
        XCTAssertEqual(store.settings.bought["milk"]?.trips.count, 1)
        let r = store.capture("we're out of milk, get bread")
        XCTAssertEqual(r.added, 2)
        XCTAssertEqual(r.outOf, 1)
        XCTAssertTrue(store.fetch(PantryItemModel.self).isEmpty)
    }
}
