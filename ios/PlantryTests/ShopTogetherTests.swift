import XCTest
@testable import Plantry

// Shopping together, ported from lib/shopTogether.test.ts.

final class ShopTogetherTests: XCTestCase {
    private func item(_ id: String, _ aisle: Aisle, checked: Bool = false, by: String? = nil, at: String? = nil) -> ShopItem {
        ShopItem(id: id, name: id, key: id, quantity: nil, unit: nil, aisle: aisle, checked: checked, fromRecipeIds: [],
                 addedBy: by, addedAt: at)
    }

    func testTripLastsThreeHours() {
        let start = ISO.date("2026-11-03T17:00:00.000Z")!
        let trip = ShopTrip(by: "a", since: "2026-11-03T17:00:00.000Z")
        XCTAssertNotNil(ShopTogether.active(trip, now: start.addingTimeInterval(2 * 3600)))
        XCTAssertNil(ShopTogether.active(trip, now: start.addingTimeInterval(4 * 3600)))
        XCTAssertNil(ShopTogether.active(ShopTrip(), now: start))
        XCTAssertNil(ShopTogether.active(nil, now: start))
    }

    func testLateAddsAreOnlyOtherPeoplesAfterSettingOff() {
        let trip = ShopTogether.active(ShopTrip(by: "a", since: "2026-11-03T17:00:00.000Z"),
                                       now: ISO.date("2026-11-03T17:30:00.000Z")!)
        XCTAssertTrue(ShopTogether.isLateAdd(item("x", .dairy, by: "s", at: "2026-11-03T17:10:00.000Z"), trip))
        XCTAssertFalse(ShopTogether.isLateAdd(item("x", .dairy, by: "a", at: "2026-11-03T17:10:00.000Z"), trip))
        XCTAssertFalse(ShopTogether.isLateAdd(item("x", .dairy, by: "s", at: "2026-11-03T16:50:00.000Z"), trip))
        XCTAssertFalse(ShopTogether.isLateAdd(item("x", .dairy, by: "s", at: "2026-11-03T17:10:00.000Z"), nil))
    }

    func testSplitByAisleBalancesAndSkipsTicked() {
        let items = [
            item("milk", .dairy), item("eggs", .dairy), item("cheese", .dairy),
            item("bread", .bakery), item("pasta", .pantry), item("apples", .produce),
            item("done", .frozen, checked: true),
        ]
        let who = ShopTogether.splitByAisle(items, people: ["a", "s"])
        XCTAssertNil(who["done"])
        XCTAssertEqual(who["milk"], "a")
        XCTAssertEqual(who["eggs"], "a")
        XCTAssertEqual(who["cheese"], "a")
        XCTAssertEqual(Set(["bread", "pasta", "apples"].compactMap { who[$0] }), ["s"])
        XCTAssertEqual(ShopTogether.splitByAisle(items, people: ["a"]), [:])
    }

    func testTripMergesAsOneValue() {
        let base = SyncDoc.empty()
        var local = SyncDoc.empty()
        var remote = SyncDoc.empty()
        // Nobody changed it here: the server's trip comes through.
        remote["shopTrip"] = JSONValue.from(ShopTrip(by: "s", since: "2026-11-03T17:00:00.000Z"))
        XCTAssertEqual(SyncDoc.merge(base: base, local: local, remote: remote)["shopTrip"], remote["shopTrip"])
        // This phone ended it: that wins.
        var b2 = base; b2["shopTrip"] = remote["shopTrip"]
        local["shopTrip"] = .object([:])
        XCTAssertEqual(SyncDoc.merge(base: b2, local: local, remote: remote)["shopTrip"], .object([:]))
        // A server document from an older phone with no trip reads as nobody shopping.
        XCTAssertEqual(SyncDoc.clean(.object(["v": .number(1)]))["shopTrip"], .object([:]))
    }

    func testNewShopFieldsSurviveAnEditHere() {
        let theirs = JSONValue.from(ShopItem(id: "1", name: "Milk", key: "milk", quantity: nil, unit: nil, aisle: .dairy, checked: false,
                                             fromRecipeIds: [], addedBy: "s", addedAt: "2026-11-03T17:10:00.000Z"))
        var base = SyncDoc.empty(); base["shop"] = .array([theirs])
        var mine = ShopItem(id: "1", name: "Milk", key: "milk", quantity: nil, unit: nil, aisle: .dairy, checked: true,
                            fromRecipeIds: [], addedBy: "s", addedAt: "2026-11-03T17:10:00.000Z")
        mine.checkedBy = "a"
        var local = SyncDoc.empty(); local["shop"] = .array([JSONValue.from(mine)])
        let merged = SyncDoc.merge(base: base, local: local, remote: base)["shop"]?.array?.first
        XCTAssertEqual(merged?["checkedBy"]?.string, "a")
        XCTAssertEqual(merged?["addedBy"]?.string, "s")
    }
}
