import XCTest
@testable import Plantry

// The household merge, ported from lib/syncDoc.test.ts's ideas: edits on different items
// both survive, deletes stick, and fields this app doesn't know pass through untouched.

final class SyncDocTests: XCTestCase {
    private func doc(_ shop: [JSONValue], settings: [String: JSONValue] = [:]) -> [String: JSONValue] {
        var d = SyncDoc.empty()
        d["shop"] = .array(shop)
        d["settings"] = .object(settings)
        return d
    }
    private func item(_ id: String, _ name: String, checked: Bool = false, extra: [String: JSONValue] = [:]) -> JSONValue {
        var o: [String: JSONValue] = ["id": .string(id), "name": .string(name), "key": .string(name), "aisle": .string("other"),
                                      "checked": .bool(checked), "fromRecipeIds": .array([])]
        for (k, v) in extra { o[k] = v }
        return .object(o)
    }
    private func names(_ d: [String: JSONValue]) -> [String] { (d["shop"]?.array ?? []).compactMap { $0["name"]?.string } }

    func testBothPhonesAddAndOneDeletes() {
        let base = doc([item("a", "milk"), item("b", "eggs")])
        let local = doc([item("a", "milk"), item("c", "rice")])          // deleted eggs, added rice
        let remote = doc([item("a", "milk"), item("b", "eggs"), item("d", "limes")]) // the other phone added limes
        XCTAssertEqual(names(SyncDoc.merge(base: base, local: local, remote: remote)), ["milk", "limes", "rice"])
    }

    func testEditKeepsFieldsThisAppDoesNotKnow() {
        let base = doc([item("a", "milk")])
        let local = doc([item("a", "milk", checked: true)])
        let remote = doc([item("a", "milk", extra: ["addedBy": .string("m1")])])
        let merged = SyncDoc.merge(base: base, local: local, remote: remote)
        let a = merged["shop"]?.array?.first
        XCTAssertEqual(a?["checked"], .bool(true))
        XCTAssertEqual(a?["addedBy"], .string("m1"))
    }

    func testClearedFieldIsRemoved() {
        let base = doc([item("a", "milk", extra: ["quantity": .number(2)])])
        let local = doc([item("a", "milk")])
        let remote = doc([item("a", "milk", extra: ["quantity": .number(2)])])
        XCTAssertNil(SyncDoc.merge(base: base, local: local, remote: remote)["shop"]?.array?.first?["quantity"])
    }

    func testSettingsThisAppDoesNotHavePassThrough() {
        let base = doc([], settings: ["cookingFor": .number(2)])
        let local = doc([], settings: ["cookingFor": .number(3)])
        let remote = doc([], settings: ["cookingFor": .number(2), "currency": .string("EUR")])
        let s = SyncDoc.merge(base: base, local: local, remote: remote)["settings"]?.object
        XCTAssertEqual(s?["cookingFor"], .number(3))
        XCTAssertEqual(s?["currency"], .string("EUR"))
    }

    func testOneMealPerDateAndSlot() {
        var base = SyncDoc.empty(); base["plan"] = .array([])
        var local = SyncDoc.empty()
        local["plan"] = .array([.object(["id": .string("x"), "date": .string("2026-11-03"), "slot": .string("lunch"), "note": .string("Soup")])])
        var remote = SyncDoc.empty()
        remote["plan"] = .array([.object(["id": .string("y"), "date": .string("2026-11-03"), "slot": .string("lunch"), "note": .string("Out")])])
        let plan = SyncDoc.merge(base: base, local: local, remote: remote)["plan"]?.array ?? []
        XCTAssertEqual(plan.count, 1)
        XCTAssertEqual(plan.first?["note"], .string("Soup"))
    }

    func testJSONRoundTripKeepsWholeNumbers() throws {
        let v: JSONValue = .object(["n": .number(2), "f": .number(0.5), "b": .bool(true), "s": .string("x"), "z": .null])
        let data = try JSONEncoder().encode(v)
        XCTAssertTrue(String(decoding: data, as: UTF8.self).contains("\"n\":2"))
        XCTAssertEqual(try JSONDecoder().decode(JSONValue.self, from: data), v)
    }

    func testCodes() {
        XCTAssertEqual(HouseholdCode.normalize("abcd-efgh-jkmn"), "ABCDEFGHJKMN")
        XCTAssertEqual(HouseholdCode.normalize("https://plantry.astrolabworks.com/join?code=ABCDEFGHJKMN"), "ABCDEFGHJKMN")
        XCTAssertNil(HouseholdCode.normalize("ABCD-EFGH-JKM0"))
        XCTAssertEqual(HouseholdCode.format("ABCDEFGHJKMN"), "ABCD-EFGH-JKMN")
    }

    func testMealUsuals() {
        let plan = [
            PlanEntry(id: "1", date: "2026-11-01", slot: .breakfast, note: "Oats"),
            PlanEntry(id: "2", date: "2026-11-02", slot: .breakfast, note: "oats"),
            PlanEntry(id: "3", date: "2026-11-02", slot: .lunch, note: "Soup"),
        ]
        let u = Meals.usuals(plan: plan, recipes: [], slot: .breakfast, today: "2026-11-03")
        XCTAssertEqual(u.map(\.label), ["Oats"])
        XCTAssertEqual(u.first?.count, 2)
        XCTAssertEqual(Meals.planned([.lunch]), [.lunch, .dinner])
    }
}
