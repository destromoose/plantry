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

    func testTargetsTomorrowAfterNine() {
        let late = ContextEngine.build(.init(now: date(2026, 11, 3, 21, 30), settings: Settings(), weather: nil, plan: [], recipes: []))
        XCTAssertEqual(late.targetLabel, "Tomorrow")
        XCTAssertEqual(late.targetDate, "2026-11-04")
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
        XCTAssertEqual(formatQuantity(1.5, "cup"), "1½ cup")
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
        XCTAssertEqual(Seed.recipes.count, 24)
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
        XCTAssertEqual(store.fetch(RecipeModel.self).count, 24)
        store.completeOnboarding(names: ["Alex", "Sam"], tastes: [.fast], pantryNames: ["Garlic", "Rice"])
        XCTAssertTrue(store.settings.onboarded)
        XCTAssertEqual(store.members.map(\.name), ["Alex", "Sam"])
        XCTAssertTrue(store.me?.isMe ?? false)
        XCTAssertEqual(store.fetch(PantryItemModel.self).count, 2)
    }

    func testLockInCookAndLeftovers() throws {
        let store = try makeStore()
        store.completeOnboarding(names: ["Alex"], tastes: [], pantryNames: ["Spinach", "Feta"])
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
        store.completeOnboarding(names: ["Alex"], tastes: [], pantryNames: ["Olive oil"])
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
        store.completeOnboarding(names: ["Alex"], tastes: [.cozy], pantryNames: ["Rice"])
        store.setDinner("2026-11-03", note: "Takeout")
        let data = store.exportJSON()
        let other = try makeStore()
        try other.importJSON(data)
        XCTAssertEqual(other.members.map(\.name), ["Alex"])
        XCTAssertEqual(other.settings.tastes, [.cozy])
        XCTAssertEqual(other.dinner(on: "2026-11-03")?.note, "Takeout")
        XCTAssertEqual(other.fetch(RecipeModel.self).count, 24)
        XCTAssertThrowsError(try other.importJSON(Data("{\"nope\":1}".utf8)))
    }
}
