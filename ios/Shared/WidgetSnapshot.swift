import Foundation

// What the home-screen widget shows. The app writes this small file into the
// shared App Group container whenever something relevant changes; the widget
// only ever reads it. Shared by both targets, so keep it free of app imports.

struct WidgetSnapshot: Codable, Equatable {
    /// "Tonight" or "Tomorrow".
    var label: String
    /// ISO date the dinner is for.
    var date: String
    /// The dish, "Leftovers: …", a note like "Takeout", or nil when nothing is decided.
    var title: String?
    var recipeId: String?
    /// "20 min hands-on · for 4".
    var meta: String?
    /// Who is cooking, if anyone.
    var cook: String?
    /// Who washes up, if anyone.
    var washer: String?
    /// Ingredients still missing from the pantry.
    var missing: Int
    /// True once the night is marked cooked.
    var done: Bool
    /// The step a cook in progress is on, 1-based, when a session is live.
    var stepIndex: Int?
    var stepCount: Int?
    var stepText: String?
    /// When a running timer ends, so the widget can count down.
    var timerEndsAt: Date?
    var timerLabel: String?
    /// A nudge like "Take the chicken out of the freezer".
    var nudge: String?
    var writtenAt: Date

    static let appGroup = "group.com.destromoose.plantry"
    static let fileName = "widget-snapshot.json"

    static var fileURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?.appendingPathComponent(fileName)
    }

    static func load() -> WidgetSnapshot? {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else { return nil }
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .iso8601
        return try? dec.decode(WidgetSnapshot.self, from: data)
    }

    func save() {
        guard let url = Self.fileURL else { return }
        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .iso8601
        if let data = try? enc.encode(self) { try? data.write(to: url, options: .atomic) }
    }

    /// Deep links the widget opens.
    static let openTonight = URL(string: "plantry://tonight")!
    static let openCook = URL(string: "plantry://cook")!

    static let placeholder = WidgetSnapshot(label: "Tonight", date: "2026-11-02", title: "Lemony chickpea skillet", recipeId: nil,
                                            meta: "20 min hands-on · for 4", cook: nil, washer: nil, missing: 1, done: false,
                                            stepIndex: nil, stepCount: nil, stepText: nil, timerEndsAt: nil, timerLabel: nil,
                                            nudge: nil, writtenAt: Date())
}
