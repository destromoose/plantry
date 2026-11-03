import Foundation

// Turns what someone says or types into shopping list items:
// "we're out of eggs and milk, and get two onions" -> eggs, milk (gone from the pantry), 2 onions.
// No network and no model, so it works offline. Ported from the web app's lib/capture.ts.

struct CapturedItem: Equatable {
    var name: String
    var quantity: Double?
    var unit: String?
    /// Said as "out of" or "used up": it should also leave the pantry.
    var outOf: Bool
}

enum Capture {
    private static let numberWords: [String: Double] = [
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12, "dozen": 12, "a dozen": 12, "half a dozen": 6, "couple": 2, "a couple": 2, "a couple of": 2,
        "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9,
        "diez": 10, "once": 11, "doce": 12, "docena": 12, "una docena": 12, "una docena de": 12,
    ]

    private static let outLeads = [
        "we're out of", "we are out of", "we've run out of", "we ran out of", "ran out of", "run out of", "out of", "used up",
        "used up the", "finished the", "no more", "se acabó el", "se acabó la", "se acabaron los", "se acabaron las", "se acabó",
        "se acabaron", "no queda", "no quedan", "no hay", "nos quedamos sin",
    ]

    private static let needLeads = [
        "we need", "we also need", "i need", "need to get", "need to buy", "need", "get some", "get", "buy", "grab", "pick up",
        "add", "put", "also", "plus", "necesitamos", "necesito", "nos falta", "nos faltan", "falta", "faltan", "comprar", "compra",
        "añade", "agrega", "pon", "también",
    ]

    private static let fillers = [
        "please", "can you", "could you", "and", "y", "some", "a few", "a bit of", "a little", "a", "an", "the", "more", "of",
        "unos", "unas", "algo de", "un poco de", "más", "el", "la", "los", "las", "de", "por favor",
    ]

    private static let keepTogether = [
        "mac and cheese", "macaroni and cheese", "salt and pepper", "half and half", "sweet and sour", "fish and chips", "salt and vinegar", "pan y queso",
    ]

    private static func leadRegex(_ words: [String]) -> NSRegularExpression {
        let alts = words.sorted { $0.count > $1.count }.map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "|")
        return try! NSRegularExpression(pattern: "^(?:\(alts))\\b\\s*", options: .caseInsensitive)
    }

    private static let outRe = leadRegex(outLeads)
    private static let needRe = leadRegex(needLeads)
    private static let fillerRe = leadRegex(fillers)
    private static let numberRe: NSRegularExpression = {
        let alts = numberWords.keys.sorted { $0.count > $1.count }.map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "|")
        return try! NSRegularExpression(pattern: "^(\(alts))\\b\\s*(?:of\\s+|de\\s+)?", options: .caseInsensitive)
    }()
    private static let endings = try! NSRegularExpression(pattern: "\\b(?:that'?s (?:it|all)|and that'?s it|thanks?|thank you|eso es todo|nada más|gracias)\\b", options: .caseInsensitive)

    private static func strip(_ re: NSRegularExpression, from s: String) -> String? {
        guard let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)), let r = Range(m.range, in: s) else { return nil }
        return String(s[r.upperBound...])
    }

    private static let trailingRe = try! NSRegularExpression(pattern: "\\s*\\b(?:please|por favor|thanks?)\\s*$", options: .caseInsensitive)

    /// Drop filler words: "and some milk please" -> "milk".
    private static func trimFiller(_ s: String) -> String {
        var out = s.trimmed
        for _ in 0..<6 {
            guard let next = strip(fillerRe, from: out) else { break }
            out = next.trimmed
        }
        out = trailingRe.stringByReplacingMatches(in: out, range: NSRange(out.startIndex..., in: out), withTemplate: "").trimmed
        return out
    }

    /// Split a sentence into the things in it, without breaking "mac and cheese".
    private static func pieces(_ sentence: String) -> [String] {
        var s = sentence
        var saved: [String] = []
        for phrase in keepTogether {
            guard let re = try? NSRegularExpression(pattern: "\\b\(NSRegularExpression.escapedPattern(for: phrase))\\b", options: .caseInsensitive) else { continue }
            for m in re.matches(in: s, range: NSRange(s.startIndex..., in: s)).reversed() {
                guard let r = Range(m.range, in: s) else { continue }
                saved.append(String(s[r]))
                s.replaceSubrange(r, with: "\u{0}\(saved.count - 1)\u{0}")
            }
        }
        let splitter = try! NSRegularExpression(pattern: "\\s*(?:,|;|&|\\+|\\band\\b|\\by\\b|\\bplus\\b|\\balso\\b|\\btambién\\b)\\s*", options: .caseInsensitive)
        let ns = s as NSString
        var parts: [String] = []
        var last = 0
        for m in splitter.matches(in: s, range: NSRange(location: 0, length: ns.length)) {
            parts.append(ns.substring(with: NSRange(location: last, length: m.range.location - last)))
            last = m.range.location + m.range.length
        }
        parts.append(ns.substring(from: last))
        return parts.map { p in
            var out = p
            for (i, v) in saved.enumerated() { out = out.replacingOccurrences(of: "\u{0}\(i)\u{0}", with: v) }
            return out.trimmed
        }.filter { !$0.isEmpty }
    }

    /// Read a spoken or typed brain dump. Each sentence starts out as things to buy; "out of"
    /// switches the rest of that sentence to things that ran out, and "need" or "get" switches back.
    static func parse(_ text: String, limit: Int = 30) -> [CapturedItem] {
        var out: [CapturedItem] = []
        var seen = Set<String>()
        // Phone keyboards type curly apostrophes ("we’re"); the lead phrases use straight ones.
        let straight = text.replacingOccurrences(of: "’", with: "'").replacingOccurrences(of: "‘", with: "'")
        let cleaned = endings.stringByReplacingMatches(in: straight, range: NSRange(straight.startIndex..., in: straight), withTemplate: "")
        let sentences = cleaned.components(separatedBy: CharacterSet(charactersIn: "\n.!?¡¿")).map { $0.trimmed }.filter { !$0.isEmpty }
        for sentence in sentences {
            var outOf = false
            for raw in pieces(sentence) {
                var p = trimFiller(raw)
                // A lead phrase can come after filler ("and we're out of"), so look twice.
                for _ in 0..<2 {
                    if let rest = strip(outRe, from: p) { outOf = true; p = trimFiller(rest) }
                    else if let rest = strip(needRe, from: p) { outOf = false; p = trimFiller(rest) }
                }
                if p.isEmpty { continue }
                // "two onions" -> "2 onions", so the recipe line reader can take the amount.
                if let m = numberRe.firstMatch(in: p, range: NSRange(p.startIndex..., in: p)), let whole = Range(m.range, in: p), let wr = Range(m.range(at: 1), in: p),
                   let n = numberWords[String(p[wr]).lowercased()] {
                    p = "\(Quantity.niceNumber(n)) \(trimFiller(String(p[whole.upperBound...])))"
                }
                let parsed = RecipeParser.parseIngredientLine(p)
                var name = (parsed?.name.isEmpty == false ? parsed!.name : p).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmed
                name = String(name.prefix(60))
                if name.isEmpty || name.range(of: "^\\d+$", options: .regularExpression) != nil { continue }
                let key = name.lowercased()
                if seen.contains(key) { continue }
                seen.insert(key)
                let hasAmount = (parsed?.quantity ?? 0) > 0 && p.range(of: "^\\d", options: .regularExpression) != nil
                out.append(CapturedItem(name: name.prefix(1).uppercased() + name.dropFirst(), quantity: hasAmount ? parsed?.quantity : nil,
                                        unit: hasAmount && !(parsed?.unit ?? "").isEmpty ? parsed?.unit : nil, outOf: outOf))
                if out.count >= limit { return out }
            }
        }
        return out
    }
}
