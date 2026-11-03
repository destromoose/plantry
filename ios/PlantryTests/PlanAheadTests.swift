import XCTest
@testable import Plantry

// Planning ahead together, ported from lib/planTogether.test.ts.

final class PlanAheadTests: XCTestCase {
    // 2026-11-03 is a Tuesday; its week runs Monday 2 to Sunday 8.
    private let today = "2026-11-03"
    private func e(_ date: String, _ slot: MealSlot = .dinner, recipe: String? = nil, lo: String? = nil, note: String? = nil, cook: String? = nil) -> PlanEntry {
        PlanEntry(id: "\(date)-\(slot.rawValue)", date: date, slot: slot, recipeId: recipe, leftoversOf: lo, note: note, cookId: cook)
    }

    func testCopyWeekFillsEmptySlotsFromToday() {
        let plan = [
            e("2026-10-26", recipe: "r-mon"),
            e("2026-10-27", recipe: "r-tue"),
            e("2026-10-28", lo: "r-tue"),
            e("2026-10-29", note: "Not cooking"),
            e("2026-10-30", note: "Takeout", cook: "m1"),
            e("2026-10-31", recipe: "r-sat"),
            e("2026-11-07", recipe: "r-planned"),
            e("2026-10-27", .lunch, recipe: "r-lunch"),
        ]
        let out = PlanAhead.copyWeek(plan, to: DateKey.weekOf(today), today: today)
        XCTAssertEqual(out.map { "\($0.date)|\($0.slot.rawValue)|\($0.recipeId ?? $0.note ?? "")" },
                       ["2026-11-03|lunch|r-lunch", "2026-11-03|dinner|r-tue", "2026-11-06|dinner|Takeout"])
        XCTAssertEqual(out[2].cookId, "m1")
    }

    func testWeeklyMealsFillOnlyEmptyFutureNights() {
        let pizza = RepeatMeal(id: "p", weekday: 5, slot: .dinner, note: "Pizza")
        XCTAssertEqual(PlanAhead.repeatFor([pizza], "2026-11-06", .dinner)?.note, "Pizza")
        XCTAssertNil(PlanAhead.repeatFor([pizza], "2026-11-05", .dinner))
        XCTAssertEqual(PlanAhead.repeatsInto([], [pizza], dates: DateKey.weekOf(today), today: today).count, 1)
        XCTAssertEqual(PlanAhead.repeatsInto([e("2026-11-06", recipe: "x")], [pizza], dates: DateKey.weekOf(today), today: today).count, 0)
        XCTAssertEqual(PlanAhead.repeatsInto([], [pizza], dates: DateKey.weekOf("2026-10-27"), today: today).count, 0)
    }

    func testIdeasRankByMeTooThenNewest() {
        let ideas = [
            MealIdea(id: "a", text: "Tacos", at: "2026-11-01T10:00:00Z"),
            MealIdea(id: "b", text: "Curry", at: "2026-11-02T10:00:00Z"),
            MealIdea(id: "c", text: "Ramen", at: "2026-10-30T10:00:00Z", votes: ["m1"]),
        ]
        XCTAssertEqual(PlanAhead.rank(ideas).map(\.id), ["c", "b", "a"])
    }

    func testMonthGridIsMondayFirst() {
        let g = PlanAhead.monthGrid(year: 2026, month: 11)
        XCTAssertEqual(g[0][0], "2026-10-26")
        XCTAssertEqual(g[0][6], "2026-11-01")
        XCTAssertEqual(g.last?.last, "2026-12-06")
        XCTAssertEqual(g.count, 6)
    }

    func testIdeasAndWeeklyMealsSyncById() {
        var local = SyncDoc.empty()
        local["ideas"] = .array([JSONValue.from(MealIdea(id: "a", text: "Tacos", at: "x"))])
        var remote = SyncDoc.empty()
        remote["repeats"] = .array([JSONValue.from(RepeatMeal(id: "p", weekday: 5, slot: .dinner, note: "Pizza"))])
        let merged = SyncDoc.merge(base: SyncDoc.empty(), local: local, remote: remote)
        XCTAssertEqual(merged["ideas"]?.array?.compactMap { $0["id"]?.string }, ["a"])
        XCTAssertEqual(merged["repeats"]?.array?.compactMap { $0["id"]?.string }, ["p"])
    }
}

final class ActivityTests: XCTestCase {
    private let now = "2026-11-03T18:00:00.000Z"

    func testDescribesWhatTheOthersChanged() {
        var before = SyncDoc.empty()
        before["members"] = .array([JSONValue.from(Member(id: "a", name: "Alex", color: .sage)), JSONValue.from(Member(id: "s", name: "Sara", color: .plum))])
        before["notes"] = .array([JSONValue.from(HouseNote(id: "n1", text: "Defrost the chicken", by: "a", at: now, on: .day, date: "2026-11-03"))])
        before["shopTrip"] = JSONValue.from(ShopTrip(by: "a", since: now))
        var after = before
        after["replies"] = .array([JSONValue.from(NoteReply(id: "p1", noteId: "n1", by: "s", text: "On it", at: now))])
        after["shop"] = .array([JSONValue.from(ShopItem(id: "i1", name: "Milk", key: "milk", quantity: nil, unit: nil, aisle: .dairy, checked: false, fromRecipeIds: [], addedBy: "s"))])
        after["ideas"] = .array([JSONValue.from(MealIdea(id: "d1", text: "Ramen", by: "s", at: now))])
        after["presence"] = .object(["2026-11-05|dinner|s": .string("out")])
        let out = ActivityLog.diff(before: before, after: after, meId: "a", now: now)
        let texts = out.map(\.text)
        XCTAssertTrue(texts.contains("Sara replied \"On it\""))
        XCTAssertTrue(texts.contains("Sara added Milk to the list"))
        XCTAssertTrue(texts.contains("Sara fancies Ramen"))
        XCTAssertTrue(texts.contains { $0.hasPrefix("Sara is out for dinner") })
        XCTAssertEqual(out.first { $0.text.hasPrefix("Sara replied") }?.forMe, true)
        XCTAssertEqual(out.first { $0.text.contains("to the list") }?.forMe, true)
    }

    func testLeavesOutYourOwnChanges() {
        var after = SyncDoc.empty()
        after["ideas"] = .array([JSONValue.from(MealIdea(id: "d1", text: "Ramen", by: "a", at: now))])
        XCTAssertTrue(ActivityLog.diff(before: SyncDoc.empty(), after: after, meId: "a", now: now).isEmpty)
    }
}
