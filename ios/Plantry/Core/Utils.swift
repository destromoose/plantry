import Foundation

// Small pure helpers shared by the core, the store and the views.
// Dates are "YYYY-MM-DD" keys in the user's calendar, like the web app.

enum DateKey {
    nonisolated(unsafe) static var calendar: Calendar = {
        var c = Calendar.current
        return c
    }()

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func key(_ date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }

    static func date(_ key: String) -> Date {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return Date() }
        var c = DateComponents()
        c.year = parts[0]; c.month = parts[1]; c.day = parts[2]; c.hour = 12
        return calendar.date(from: c) ?? Date()
    }

    static func addDays(_ key: String, _ n: Int) -> String {
        let d = date(key)
        return self.key(calendar.date(byAdding: .day, value: n, to: d) ?? d)
    }

    static func daysBetween(_ a: String, _ b: String) -> Int {
        let da = calendar.startOfDay(for: date(a))
        let db = calendar.startOfDay(for: date(b))
        return calendar.dateComponents([.day], from: da, to: db).day ?? 0
    }

    /// Monday-start week containing the given date key.
    static func weekOf(_ key: String) -> [String] {
        let d = date(key)
        let weekday = calendar.component(.weekday, from: d) // 1 = Sunday
        let dow = (weekday + 5) % 7 // 0 = Monday
        let start = addDays(key, -dow)
        return (0..<7).map { addDays(start, $0) }
    }

    static func isWeekend(_ key: String) -> Bool {
        let weekday = calendar.component(.weekday, from: date(key))
        return weekday == 1 || weekday == 7
    }

    static func dayLabel(_ key: String, today: String) -> String {
        switch daysBetween(today, key) {
        case 0: return "Today"
        case 1: return "Tomorrow"
        case -1: return "Yesterday"
        default: return date(key).formatted(.dateTime.weekday(.wide))
        }
    }

    static func shortDay(_ key: String) -> String {
        date(key).formatted(.dateTime.weekday(.abbreviated))
    }

    static func dayNumber(_ key: String) -> Int {
        calendar.component(.day, from: date(key))
    }

    static func monthDay(_ key: String) -> String {
        date(key).formatted(.dateTime.month(.abbreviated).day())
    }

    static func longDate(_ key: String) -> String {
        date(key).formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    static func weekdayName(_ key: String) -> String {
        date(key).formatted(.dateTime.weekday(.wide))
    }
}

enum ISO {
    private static let formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func now() -> String { formatter.string(from: Date()) }
    static func string(_ d: Date) -> String { formatter.string(from: d) }
    static func date(_ s: String) -> Date? { formatter.date(from: s) ?? plain.date(from: s) ?? (s.count >= 10 ? DateKey.date(String(s.prefix(10))) : nil) }
}

enum IDs {
    nonisolated(unsafe) private static var counter = 0
    static func make(_ prefix: String = "id") -> String {
        counter += 1
        let t = String(Int(Date().timeIntervalSince1970 * 1000), radix: 36)
        let r = String(UInt32.random(in: 0...UInt32.max), radix: 36)
        return "\(prefix)_\(t)\(String(counter, radix: 36))\(r)"
    }
}

/// Lowercase, singularized-ish key for matching ingredients to pantry items.
func keyOf(_ name: String) -> String {
    var k = name.lowercased()
    k = k.replacingOccurrences(of: "\\(.*?\\)", with: "", options: .regularExpression)
    k = k.replacingOccurrences(of: "[^a-z\\s]", with: "", options: .regularExpression)
    k = k.trimmingCharacters(in: .whitespaces)
    k = k.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    if k.hasSuffix("oes") { return String(k.dropLast(2)) }
    if k.hasSuffix("ies") { return String(k.dropLast(3)) + "y" }
    if k.hasSuffix("s") && !k.hasSuffix("ss") { return String(k.dropLast()) }
    return k
}

func formatMinutes(_ min: Int) -> String {
    if min < 60 { return "\(min) min" }
    let h = min / 60, m = min % 60
    return m > 0 ? "\(h) h \(m) min" : "\(h) h"
}

func formatQuantity(_ q: Double?, _ unit: String?) -> String {
    guard let q, q != 0 else { return unit ?? "" }
    let nice = q == q.rounded() ? String(Int(q)) : fractionOf(q)
    if let unit, !unit.isEmpty { return "\(nice) \(unit)" }
    return nice
}

private func fractionOf(_ q: Double) -> String {
    let whole = Int(q.rounded(.down))
    let frac = q - Double(whole)
    let map: [(Double, String)] = [(0.25, "¼"), (0.33, "⅓"), (0.5, "½"), (0.66, "⅔"), (0.75, "¾")]
    guard let hit = map.first(where: { abs($0.0 - frac) < 0.08 }) else {
        let s = String(format: "%.1f", q)
        return s.hasSuffix(".0") ? String(s.dropLast(2)) : s
    }
    return whole > 0 ? "\(whole)\(hit.1)" : hit.1
}

func pluralize(_ n: Int, _ word: String, _ plural: String? = nil) -> String {
    "\(n) \(n == 1 ? word : (plural ?? word + "s"))"
}

func clamp<T: Comparable>(_ n: T, _ lo: T, _ hi: T) -> T { min(hi, max(lo, n)) }

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
    var isBlank: Bool { trimmed.isEmpty }
}
