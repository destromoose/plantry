import Foundation
import Security

// What the home-screen widget shows. The app writes this small snapshot whenever
// something relevant changes; the widget only ever reads it. Shared by both
// targets, so keep it free of app imports.
//
// It travels through a shared keychain item, not an App Group: a free Apple ID
// (Personal Team) cannot sign App Groups, but it can sign keychain sharing. Both
// targets list the same group first in keychain-access-groups, so the default
// access group is the shared one and no team prefix is needed in code.

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

    static let keychainService = "com.destromoose.plantry.widget-snapshot"
    static let keychainAccount = "tonight"

    private static var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: keychainService,
         kSecAttrAccount as String: keychainAccount]
    }

    static func load() -> WidgetSnapshot? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .iso8601
        return try? dec.decode(WidgetSnapshot.self, from: data)
    }

    func save() {
        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .iso8601
        guard let data = try? enc.encode(self) else { return }
        // Readable after first unlock so the widget can refresh on a locked phone.
        let attrs: [String: Any] = [kSecValueData as String: data,
                                    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock]
        let status = SecItemUpdate(Self.baseQuery as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var add = Self.baseQuery
            add.merge(attrs) { $1 }
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    /// Deep links the widget opens.
    static let openTonight = URL(string: "plantry://tonight")!
    static let openCook = URL(string: "plantry://cook")!

    static let placeholder = WidgetSnapshot(label: "Tonight", date: "2026-11-02", title: "Lemony chickpea skillet", recipeId: nil,
                                            meta: "20 min hands-on · for 4", cook: nil, washer: nil, missing: 1, done: false,
                                            stepIndex: nil, stepCount: nil, stepText: nil, timerEndsAt: nil, timerLabel: nil,
                                            nudge: nil, writtenAt: Date())
}
