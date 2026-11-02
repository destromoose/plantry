import Foundation

// Amounts: convert, add up, subtract and print them so lists read like a person wrote them.
// Ported from the web app's lib/quantity.ts.

struct Amount: Codable, Hashable, Sendable {
    var quantity: Double
    var unit: String
}

enum Quantity {
    private enum Dim { case mass, volume }
    private static let units: [String: (dim: Dim, factor: Double)] = [
        "g": (.mass, 1), "gram": (.mass, 1), "grams": (.mass, 1), "kg": (.mass, 1000), "oz": (.mass, 28.35), "lb": (.mass, 453.6),
        "ml": (.volume, 1), "l": (.volume, 1000), "litre": (.volume, 1000), "liter": (.volume, 1000),
        "tsp": (.volume, 5), "tbsp": (.volume, 15), "cup": (.volume, 240), "cups": (.volume, 240),
    ]

    /// Units that mean "a number of things": shown as whole numbers on a shopping list.
    private static let countUnits: Set<String> = ["", "whole", "clove", "slice", "can", "tin", "bunch", "piece", "pack", "jar", "head", "sprig", "stalk", "fillet", "handful", "pinch"]

    private static func norm(_ u: String) -> String {
        var s = u.trimmed.lowercased()
        if s.hasSuffix(".") { s.removeLast() }
        if s.hasSuffix("s"), units[s] == nil { s.removeLast() }
        return s
    }

    private static func info(_ unit: String) -> (dim: Dim, factor: Double)? {
        let u = unit.trimmed.lowercased()
        return units[u] ?? units[norm(u)]
    }

    static func isCountUnit(_ unit: String) -> Bool {
        countUnits.contains(norm(unit)) || countUnits.contains(unit.trimmed.lowercased())
    }

    /// Same kind of unit, so the two can be added up.
    static func compatible(_ a: String, _ b: String) -> Bool {
        if let x = info(a), let y = info(b) { return x.dim == y.dim }
        return info(a) == nil && info(b) == nil && norm(a) == norm(b)
    }

    private static func convert(_ q: Double, from: String, to: String) -> Double {
        guard let f = info(from), let t = info(to) else { return q }
        return q * f.factor / t.factor
    }

    /// Add an amount to a list, merging where the units allow and keeping a new line otherwise.
    static func add(_ list: [Amount], _ amount: Amount) -> [Amount] {
        guard let i = list.firstIndex(where: { compatible($0.unit, amount.unit) }) else { return list + [amount] }
        var out = list
        let base = out[i]
        let bf = info(base.unit)?.factor ?? 1, af = info(amount.unit)?.factor ?? 1
        let target = af > bf ? amount.unit : base.unit
        out[i] = Amount(quantity: convert(base.quantity, from: base.unit, to: target) + convert(amount.quantity, from: amount.unit, to: target), unit: target)
        return out
    }

    /// What is left to buy after using what you have. Nil when `have` can't be compared.
    static func subtract(_ need: Amount, _ have: Amount) -> Amount? {
        guard compatible(need.unit, have.unit) else { return nil }
        let left = need.quantity - convert(have.quantity, from: have.unit, to: need.unit)
        return Amount(quantity: max(0, left), unit: need.unit)
    }

    private static let fractions: [(Double, String)] = [
        (1.0 / 8, "⅛"), (1.0 / 4, "¼"), (1.0 / 3, "⅓"), (3.0 / 8, "⅜"), (1.0 / 2, "½"), (5.0 / 8, "⅝"), (2.0 / 3, "⅔"), (3.0 / 4, "¾"), (7.0 / 8, "⅞"),
    ]

    static func niceNumber(_ q: Double) -> String {
        if abs(q - q.rounded()) < 0.02 || q >= 10 { return String(Int(q.rounded())) }
        let whole = Int(q.rounded(.down))
        let frac = q - Double(whole)
        if let hit = fractions.first(where: { abs($0.0 - frac) < 0.02 }) { return whole > 0 ? "\(whole)\(hit.1)" : hit.1 }
        let s = String(format: "%.1f", q)
        return s.hasSuffix(".0") ? String(s.dropLast(2)) : s
    }

    private static let plural: [String: String] = [
        "clove": "cloves", "slice": "slices", "can": "cans", "tin": "tins", "bunch": "bunches", "piece": "pieces", "pack": "packs", "jar": "jars",
        "head": "heads", "sprig": "sprigs", "stalk": "stalks", "fillet": "fillets", "handful": "handfuls", "cup": "cups", "pinch": "pinches",
    ]

    /// "12 cloves", "2.4 kg", "1½ tbsp", "3" (for eggs). `forShopping` rounds things you count up.
    static func format(_ q: Double?, _ unit: String? = "", forShopping: Bool = false) -> String {
        let u = (unit ?? "").trimmed
        guard let q, q.isFinite, q > 0 else { return u == "whole" ? "" : u }
        var n = q
        var shown = u
        let lower = u.lowercased()
        if lower == "g" && n >= 1000 { n /= 1000; shown = "kg" }
        else if lower == "ml" && n >= 1000 { n /= 1000; shown = "l" }
        if forShopping && isCountUnit(u) { n = (n - 0.01).rounded(.up) }
        let num = niceNumber(n)
        if shown.isEmpty || lower == "whole" { return num }
        let many = n > 1 + 1e-9
        let word = many ? (plural[shown.lowercased()] ?? shown) : shown
        return "\(num) \(word)"
    }

    static func format(_ list: [Amount], forShopping: Bool = false) -> String {
        list.map { format($0.quantity, $0.unit, forShopping: forShopping) }.filter { !$0.isEmpty }.joined(separator: " + ")
    }

    private static let vulgar: [Character: Double] = ["½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1.0 / 3, "⅔": 2.0 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875]

    /// Read an amount someone typed: "2", "1.5", "1,5", "3/4", "1 1/2", "1½", "½". Nil for anything else.
    static func parse(_ input: String) -> Double? {
        let s = input.trimmed.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        if s.isEmpty { return nil }
        if let last = s.last, let v = vulgar[last] {
            let head = String(s.dropLast()).trimmed
            if head.isEmpty { return v }
            if let n = Int(head) { return Double(n) + v }
            return nil
        }
        let parts = s.split(separator: " ").map(String.init)
        if parts.count == 2, let whole = Int(parts[0]), let f = fraction(parts[1]) { return Double(whole) + f }
        if parts.count == 1 {
            if let f = fraction(parts[0]) { return f }
            let t = parts[0].replacingOccurrences(of: ",", with: ".")
            if t.range(of: "^(\\d+(\\.\\d+)?|\\.\\d+)$", options: .regularExpression) != nil { return Double(t) }
        }
        return nil
    }

    private static func fraction(_ s: String) -> Double? {
        let p = s.split(separator: "/")
        guard p.count == 2, let a = Double(p[0]), let b = Double(p[1]), b != 0 else { return nil }
        return a / b
    }
}

/// Kept for existing callers.
func formatQuantity(_ q: Double?, _ unit: String?) -> String { Quantity.format(q, unit) }
