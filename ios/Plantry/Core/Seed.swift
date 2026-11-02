import Foundation

// The 24 weeknight recipes and 36 pantry staples, bundled as JSON that is
// generated straight from the web app's lib/seed so both apps stay identical.

struct Staple: Codable, Hashable, Sendable {
    var name: String
    var key: String
    var zone: PantryZone
    var aisle: Aisle
    var quantity: Double?
    var unit: String?
    var softLifeDays: Int
    var staple: Bool?
}

private struct StapleFile: Codable {
    var staples: [Staple]
    var quickPicks: [String]
}

enum Seed {
    private static func load<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    static let recipes: [Recipe] = load("seed-recipes", as: [Recipe].self) ?? []

    private static let stapleFile: StapleFile = load("seed-staples", as: StapleFile.self) ?? StapleFile(staples: [], quickPicks: [])

    static let staples: [Staple] = stapleFile.staples

    /// The 30 most common staples, in the order the onboarding grid shows them.
    static let quickPicks: [String] = stapleFile.quickPicks

    static let staplesByKey: [String: Staple] = Dictionary(staples.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })

    static func staple(for name: String) -> Staple? { staplesByKey[keyOf(name)] }
}
