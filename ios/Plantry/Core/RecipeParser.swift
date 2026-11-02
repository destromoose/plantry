import Foundation

// A forgiving, heuristic parser for pasted recipe text. No network, no model.
// Ported line for line from the web app's lib/parseRecipe.ts.

struct ParsedIngredient: Equatable {
    var name: String
    var quantity: Double
    var unit: String
}

struct ParsedStep: Equatable {
    var text: String
    var timerMinutes: Int?
}

struct ParsedRecipe: Equatable {
    var title: String?
    var ingredients: [ParsedIngredient] = []
    var steps: [ParsedStep] = []
}

enum RecipeParser {
    private static let units: Set<String> = [
        "kg", "g", "ml", "l", "tsp", "tbsp", "cups", "cup", "cloves", "clove", "cans", "can",
        "bunch", "slices", "slice", "whole", "oz", "lb",
    ]
    private static let vulgar: [Character: Double] = ["½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1.0 / 3, "⅔": 2.0 / 3]

    private static func matches(_ pattern: String, _ s: String) -> Bool {
        s.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    private static func isIngredientHeading(_ l: String) -> Bool {
        matches("^\\s*(?:#+\\s*)?ingredients?\\b\\s*:?\\s*$", l)
    }

    private static func isStepHeading(_ l: String) -> Bool {
        matches("^\\s*(?:#+\\s*)?(?:method|instructions?|directions?|steps?|preparation)\\b\\s*:?\\s*$", l)
    }

    /// Finds a timer in step text: "12 minutes", "10-12 min" (takes the upper bound).
    static func detectTimer(_ text: String) -> Int? {
        let re = try! NSRegularExpression(pattern: "(\\d+)\\s*(?:-|–|to)?\\s*(\\d+)?\\s*(?:min|minute)", options: .caseInsensitive)
        guard let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
        func group(_ i: Int) -> String? {
            let r = m.range(at: i)
            guard r.location != NSNotFound, let range = Range(r, in: text) else { return nil }
            return String(text[range])
        }
        let n = Int(group(2) ?? group(1) ?? "") ?? 0
        return n > 0 && n < 600 ? n : nil
    }

    private static func parseQuantityToken(_ tok: String) -> Double? {
        if tok.count == 1, let v = vulgar[tok.first!] { return v }
        if tok.count == 2, let last = tok.last, let v = vulgar[last], let whole = Int(String(tok.dropLast())) { return Double(whole) + v }
        if let m = capture("^(\\d+(?:\\.\\d+)?)\\s*[-–]\\s*(\\d+(?:\\.\\d+)?)$", tok) { return Double(m[0]) }
        if let m = capture("^(\\d+)/(\\d+)$", tok), let a = Double(m[0]), let b = Double(m[1]), b != 0 { return a / b }
        if matches("^\\d+(?:\\.\\d+)?$", tok) { return Double(tok) }
        return nil
    }

    private static func capture(_ pattern: String, _ s: String) -> [String]? {
        guard let re = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
        return (1..<m.numberOfRanges).map { i in
            let r = m.range(at: i)
            guard r.location != NSNotFound, let range = Range(r, in: s) else { return "" }
            return String(s[range])
        }
    }

    static func parseIngredientLine(_ raw: String) -> ParsedIngredient? {
        var line = raw.replacingOccurrences(of: "^\\s*(?:[-*•–]\\s+|\\d+[.)]\\s+(?=\\D))", with: "", options: .regularExpression).trimmed
        // "1 1/2" mixed number: merge into one token
        if let m = capture("^(\\d+)\\s+(\\d+/\\d+)", line), let a = Double(m[0]), let b = parseQuantityToken(m[1]) {
            let merged = a + b
            let text = merged == merged.rounded() ? String(Int(merged)) : String(merged)
            line = line.replacingOccurrences(of: "^(\\d+)\\s+(\\d+/\\d+)", with: text, options: .regularExpression)
        }
        if line.isEmpty { return nil }
        let parts = line.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        var quantity = 1.0
        var idx = 0
        if let q = parseQuantityToken(parts[0]) {
            quantity = (q * 100).rounded() / 100
            idx = 1
        } else if let m = capture("^(\\d+(?:\\.\\d+)?)([a-z]+)$", parts[0]), units.contains(m[1].lowercased()) {
            return finish(Double(m[0]) ?? 1, m[1].lowercased(), Array(parts.dropFirst()))
        }
        var unit = ""
        if idx > 0, idx < parts.count {
            let u = parts[idx].lowercased().replacingOccurrences(of: "[.,]$", with: "", options: .regularExpression)
            if units.contains(u) { unit = u; idx += 1 }
        }
        return finish(quantity, unit, Array(parts.dropFirst(idx)))
    }

    private static func finish(_ quantity: Double, _ unit: String, _ nameParts: [String]) -> ParsedIngredient? {
        var name = nameParts.joined(separator: " ").replacingOccurrences(of: "^of\\s+", with: "", options: [.regularExpression, .caseInsensitive])
        name = String(name.split(separator: ",", omittingEmptySubsequences: false).first ?? "")
        name = name.replacingOccurrences(of: "\\(.*?\\)", with: "", options: .regularExpression)
        name = name.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmed
        if name.isEmpty { return nil }
        return ParsedIngredient(name: name, quantity: quantity, unit: unit)
    }

    private static func cleanStep(_ line: String) -> String {
        line.replacingOccurrences(of: "^\\s*(?:step\\s*\\d+\\s*[:.)-]?|\\d+\\s*[.)])\\s*", with: "", options: [.regularExpression, .caseInsensitive]).trimmed
    }

    private static func isStepStart(_ line: String) -> Bool {
        matches("^\\s*(?:step\\s*\\d+|\\d+\\s*[.)])\\s*", line)
    }

    private static func buildSteps(_ lines: [String]) -> [ParsedStep] {
        var steps: [String] = []
        let numbered = lines.contains(where: isStepStart)
        for line in lines {
            let text = cleanStep(line)
            if text.isEmpty { continue }
            if numbered {
                if isStepStart(line) || steps.isEmpty { steps.append(text) }
                else { steps[steps.count - 1] += " \(text)" }
            } else {
                // Unnumbered: a line that does not start in lower case begins a new step.
                if !steps.isEmpty, let f = text.first, f.isLowercase,
                   !(steps[steps.count - 1].last.map { ".!?".contains($0) } ?? false) {
                    steps[steps.count - 1] += " \(text)"
                } else {
                    steps.append(text)
                }
            }
        }
        return steps.map { ParsedStep(text: $0, timerMinutes: detectTimer($0)) }
    }

    private static func startsLikeIngredient(_ l: String) -> Bool {
        matches("^\\s*(?:[-*•–]|\\d|[½¼¾⅓⅔])", l)
    }

    static func parse(_ text: String) -> ParsedRecipe {
        let lines = text.replacingOccurrences(of: "\r", with: "").components(separatedBy: "\n").map { $0.trimmed }
        let nonEmpty = lines.filter { !$0.isEmpty }
        var out = ParsedRecipe()
        guard let first = nonEmpty.first else { return out }

        var body = lines
        if first.count < 80, !matches("^\\d", first), !isIngredientHeading(first), !isStepHeading(first) {
            out.title = first.replacingOccurrences(of: "^#+\\s*", with: "", options: .regularExpression)
            if let at = lines.firstIndex(of: first) { body = Array(lines[(at + 1)...]) }
        }

        let ingAt = body.firstIndex(where: isIngredientHeading)
        let stepAt = body.firstIndex(where: isStepHeading)

        var ingLines: [String]
        var stepLines: [String]
        if ingAt != nil || stepAt != nil {
            if let ingAt {
                let end = (stepAt ?? -1) > ingAt ? stepAt! : body.count
                ingLines = Array(body[(ingAt + 1)..<end])
                stepLines = (stepAt ?? -1) > ingAt ? Array(body[(stepAt! + 1)...]) : []
            } else {
                ingLines = Array(body[0..<stepAt!])
                stepLines = Array(body[(stepAt! + 1)...])
            }
        } else {
            let clean = body.filter { !$0.isEmpty }
            var i = 0
            while i < clean.count, startsLikeIngredient(clean[i]), clean[i].count <= 60 { i += 1 }
            if i == 0, let firstIng = clean.firstIndex(where: startsLikeIngredient), firstIng > 0 {
                var j = firstIng
                while j < clean.count, startsLikeIngredient(clean[j]), clean[j].count <= 60 { j += 1 }
                return fill(out, Array(clean[firstIng..<j]), Array(clean[j...]))
            }
            ingLines = Array(clean[0..<i])
            stepLines = Array(clean[i...])
        }
        return fill(out, ingLines, stepLines)
    }

    private static func fill(_ base: ParsedRecipe, _ ingLines: [String], _ stepLines: [String]) -> ParsedRecipe {
        var out = base
        out.ingredients = ingLines.filter { !$0.isEmpty }.compactMap(parseIngredientLine)
        out.steps = buildSteps(stepLines.filter { !$0.isEmpty })
        return out
    }
}
