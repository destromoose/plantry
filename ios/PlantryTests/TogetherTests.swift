import XCTest
@testable import Plantry

// Who's home and notes, ported from lib/together.test.ts.

final class TogetherTests: XCTestCase {
    // 2026-11-03 is a Tuesday.
    private let tue = "2026-11-03"
    private let people: [(id: String, name: String)] = [("a", "Alex"), ("s", "Sara")]

    func testDayAnswerThenUsualWeekThenHome() {
        var s = TogetherState()
        XCTAssertEqual(Together.weekday(tue), 2)
        s.presenceWeekly[Together.weeklyKey(2, .dinner, "s")] = .out
        XCTAssertEqual(Together.presence(s, tue, .dinner, "s"), .init(value: .out, usual: true, set: true))
        s.presence[Together.presenceKey(tue, .dinner, "s")] = .home
        XCTAssertEqual(Together.presence(s, tue, .dinner, "s").value, .home)
        XCTAssertEqual(Together.presence(s, tue, .dinner, "a"), .init(value: .home, usual: false, set: false))
        XCTAssertEqual(Presence.allCases.map(\.next), [.late, .out, .home])
    }

    func testCountsWhoEatsKeepingPeopleWhoAreNotMembers() {
        var s = TogetherState()
        XCTAssertNil(Together.eaters(s, memberIds: ["a", "s"], tue, .dinner, cookingFor: 2))
        s.presence[Together.presenceKey(tue, .dinner, "s")] = .out
        XCTAssertEqual(Together.eaters(s, memberIds: ["a", "s"], tue, .dinner, cookingFor: 2), 1)
        XCTAssertEqual(Together.eaters(s, memberIds: ["a", "s"], tue, .dinner, cookingFor: 4), 3)
        s.presence[Together.presenceKey(tue, .dinner, "a")] = .out
        XCTAssertEqual(Together.eaters(s, memberIds: ["a", "s"], tue, .dinner, cookingFor: 2), 0)
    }

    func testSaysItInOneLine() {
        func line(_ k: String, _ p: Presence) -> String? {
            var s = TogetherState()
            s.presence[Together.presenceKey(tue, .dinner, k)] = p
            return Together.line(s, members: people, tue, .dinner, meId: "a")
        }
        XCTAssertNil(Together.line(TogetherState(), members: people, tue, .dinner, meId: "a"))
        XCTAssertEqual(line("s", .out), "Just you")
        XCTAssertEqual(line("a", .out), "Just Sara")
        XCTAssertEqual(line("s", .late), "Sara home late")
        XCTAssertEqual(line("s", .home), "Everyone home")
    }

    func testBoardKeepsAWeekUnlessPinnedAndOldNotesGo() {
        var s = TogetherState()
        s.notes = [
            HouseNote(id: "new", text: "new", at: "2026-11-02T10:00:00.000Z", on: .board),
            HouseNote(id: "old", text: "old", at: "2026-10-01T10:00:00.000Z", on: .board),
            HouseNote(id: "pinned", text: "p", at: "2026-09-01T10:00:00.000Z", on: .board, pinned: true),
            HouseNote(id: "gone", text: "g", at: "2026-08-01T10:00:00.000Z", on: .day, date: "2026-08-01"),
        ]
        s.replies = [NoteReply(id: "r", noteId: "gone", text: "ok", at: "")]
        XCTAssertEqual(Together.board(s, today: tue).map(\.id), ["new", "pinned"])
        Together.prune(&s, today: tue)
        XCTAssertEqual(s.notes.map(\.id), ["new", "old", "pinned"])
        XCTAssertTrue(s.replies.isEmpty)
    }

    func testNotesKeepTheWebShape() throws {
        let n = HouseNote(id: "n", text: "Get the Barilla one", by: "a", at: "2026-11-03T10:00:00.000Z", on: .shop, itemKey: "pasta")
        let v = JSONValue.from(n)
        XCTAssertEqual(v["on"]?.string, "shop")
        XCTAssertEqual(v["itemKey"]?.string, "pasta")
        XCTAssertNil(v["pinned"])
        XCTAssertEqual(v.decode(HouseNote.self), n)
    }
}
