import Foundation

// Living together: who's home for which meal, and notes left where they belong instead of
// in a messaging app. A port of lib/together.ts. Pure helpers and the shapes that sync.

/// Whether someone is eating a meal at home.
enum Presence: String, Codable, CaseIterable, Sendable {
    case home, late, out

    var label: String {
        switch self {
        case .home: "Home"
        case .late: "Late"
        case .out: "Out"
        }
    }

    var next: Presence {
        switch self {
        case .home: .late
        case .late: .out
        case .out: .home
        }
    }
}

/// A note left for the household on a day, a list item, or the fridge board.
struct HouseNote: Codable, Identifiable, Hashable, Sendable {
    enum Place: String, Codable, Sendable { case day, shop, board }
    var id: String
    var text: String
    var by: String?
    var at: String
    var on: Place
    var date: String?
    var slot: MealSlot?
    /// The list item's key, for a note on the shop list ("get the Barilla one").
    var itemKey: String?
    /// A small JPEG, as a data URL.
    var photo: String?
    var pinned: Bool?

    var isPinned: Bool { pinned ?? false }
}

/// A quick reply to a note: "Sounds good", "I'll cook", or a few words.
struct NoteReply: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var noteId: String
    var by: String?
    var text: String
    var at: String
}

/// Everything about living together that syncs, kept as one value on this phone.
struct TogetherState: Codable, Hashable, Sendable {
    var notes: [HouseNote] = []
    var replies: [NoteReply] = []
    /// `date|slot|memberId` to an answer for that one meal.
    var presence: [String: Presence] = [:]
    /// `weekday|slot|memberId` (0 is Sunday) to a usual answer.
    var presenceWeekly: [String: Presence] = [:]
}

enum Together {
    static func presenceKey(_ date: String, _ slot: MealSlot, _ memberId: String) -> String { "\(date)|\(slot.rawValue)|\(memberId)" }
    static func weeklyKey(_ weekday: Int, _ slot: MealSlot, _ memberId: String) -> String { "\(weekday)|\(slot.rawValue)|\(memberId)" }

    /// 0 for Sunday through 6 for Saturday, the way the web app counts.
    static func weekday(_ date: String) -> Int {
        Calendar(identifier: .gregorian).component(.weekday, from: DateKey.date(date)) - 1
    }

    struct Answer: Equatable { var value: Presence; var usual: Bool; var set: Bool }

    /// Someone's answer for a meal: what they said for that day, else their usual week, else home.
    static func presence(_ s: TogetherState, _ date: String, _ slot: MealSlot, _ memberId: String) -> Answer {
        if let d = s.presence[presenceKey(date, slot, memberId)] { return Answer(value: d, usual: false, set: true) }
        if let w = s.presenceWeekly[weeklyKey(weekday(date), slot, memberId)] { return Answer(value: w, usual: true, set: true) }
        return Answer(value: .home, usual: false, set: false)
    }

    /// How many people eat, when anyone said they're out. Nil means "as usual".
    /// The household cooks for `cookingFor` (kids may not be members), less whoever's out.
    static func eaters(_ s: TogetherState, memberIds: [String], _ date: String, _ slot: MealSlot, cookingFor: Int) -> Int? {
        guard !memberIds.isEmpty else { return nil }
        let out = memberIds.filter { presence(s, date, slot, $0).value == .out }.count
        guard out > 0 else { return nil }
        return max(0, max(cookingFor, memberIds.count) - out)
    }

    /// One plain line about who's eating: "Just you", "Sam home late".
    static func line(_ s: TogetherState, members: [(id: String, name: String)], _ date: String, _ slot: MealSlot, meId: String?) -> String? {
        guard members.count > 1 else { return nil }
        let answers = members.map { (m: $0, a: presence(s, date, slot, $0.id)) }
        guard answers.contains(where: { $0.a.set }) else { return nil }
        let home = answers.filter { $0.a.value != .out }
        let late = answers.filter { $0.a.value == .late }
        let out = answers.filter { $0.a.value == .out }
        if home.isEmpty { return "Everyone is out" }
        if home.count == 1 && !out.isEmpty { return home[0].m.id == meId ? "Just you" : "Just \(home[0].m.name)" }
        if !late.isEmpty { return "\(late.map(\.m.name).joined(separator: ", ")) home late" }
        if !out.isEmpty { return "\(out.map(\.m.name).joined(separator: ", ")) out" }
        return "Everyone home"
    }

    static func notes(_ s: TogetherState, on place: HouseNote.Place, date: String? = nil, itemKey: String? = nil) -> [HouseNote] {
        s.notes
            .filter { $0.on == place && (date == nil || $0.date == date) && (itemKey == nil || $0.itemKey == itemKey) }
            .sorted { $0.at > $1.at }
    }

    /// Fridge board: pinned notes, and the rest for a week.
    static func board(_ s: TogetherState, today: String) -> [HouseNote] {
        let since = DateKey.addDays(today, -7)
        return notes(s, on: .board).filter { $0.isPinned || String($0.at.prefix(10)) >= since }
    }

    static func replies(_ s: TogetherState, to noteId: String) -> [NoteReply] {
        s.replies.filter { $0.noteId == noteId }.sorted { $0.at < $1.at }
    }

    /// Notes go 60 days after their day unless pinned, and their replies with them.
    static func prune(_ s: inout TogetherState, today: String) {
        let cutoff = DateKey.addDays(today, -60)
        s.notes = s.notes.filter { $0.isPinned || ($0.date ?? String($0.at.prefix(10))) >= cutoff }
        let ids = Set(s.notes.map(\.id))
        s.replies = s.replies.filter { ids.contains($0.noteId) }
    }

    /// One-tap answers, fitting where the note sits.
    static func quickReplies(_ place: HouseNote.Place) -> [String] {
        switch place {
        case .day: ["Sounds good", "I'll cook", "Not tonight", "I'll pick it up"]
        case .shop: ["I'll pick it up", "Got it"]
        case .board: ["Sounds good", "On it"]
        }
    }

    static func ago(_ iso: String, now: Date = Date()) -> String {
        guard let d = ISO.date(iso) else { return "" }
        let mins = Int(now.timeIntervalSince(d) / 60)
        if mins < 1 { return "just now" }
        if mins < 60 { return "\(mins) min ago" }
        let h = Int((Double(mins) / 60).rounded())
        if h < 24 { return "\(h) h ago" }
        return d.formatted(.dateTime.month(.abbreviated).day())
    }
}
