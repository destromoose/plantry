import Foundation

// What a household shares between phones, and how two phones' changes are merged.
// A port of lib/syncDoc.ts. The document is kept as plain JSON so fields the web app
// knows and this app doesn't (prices, ratings, newer settings) pass through untouched.
//
// Merging is three-way. This phone remembers the last document it synced (the base), in
// its own shape. On sync it takes the server's latest and replays its own changes since
// the base on top: things it added, deleted and edited. Everything else comes from the
// server. When both phones edited the same item, the phone syncing now wins for that item.

/// Any JSON value. Numbers compare as doubles, objects by key, so key order never matters.
enum JSONValue: Codable, Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSONValue].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .number(let n):
            // Whole numbers go out as integers, the way the web app writes them.
            if n.rounded() == n && abs(n) < 9_007_199_254_740_992 { try c.encode(Int64(n)) } else { try c.encode(n) }
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }

    var object: [String: JSONValue]? { if case .object(let o) = self { return o }; return nil }
    var array: [JSONValue]? { if case .array(let a) = self { return a }; return nil }
    var string: String? { if case .string(let s) = self { return s }; return nil }
    var number: Double? { if case .number(let n) = self { return n }; return nil }
    subscript(key: String) -> JSONValue? { object?[key] }

    /// Any Encodable value as JSON.
    static func from<T: Encodable>(_ value: T) -> JSONValue {
        guard let data = try? JSONEncoder().encode(value),
              let v = try? JSONDecoder().decode(JSONValue.self, from: data) else { return .null }
        return v
    }

    /// Decode this JSON as a typed value, or nil when it doesn't fit.
    func decode<T: Decodable>(_ type: T.Type) -> T? {
        guard let data = try? JSONEncoder().encode(self) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}

enum SyncDoc {
    static let version = 1
    static let maxBytes = 2_000_000

    /// Settings the whole household shares. The rest stay on each phone.
    static let sharedSettingKeys = ["cookingFor", "avoid", "tastes", "householdWord", "cookingWithKids", "units",
                                    "currency", "priceLevel", "weeklyBudget", "meals"]

    /// The collections in the document and what identifies one item in each.
    static let lists: [(key: String, idOf: (JSONValue) -> String, newFirst: Bool)] = [
        ("members", { $0["id"]?.string ?? "" }, false),
        ("recipes", { $0["id"]?.string ?? "" }, true),
        ("pantry", { $0["id"]?.string ?? "" }, true),
        // One planned meal per date and slot, whichever phone made it.
        ("plan", { "\($0["date"]?.string ?? "")|\($0["slot"]?.string ?? "")" }, false),
        ("shop", { $0["id"]?.string ?? "" }, false),
        ("shopDismissed", { $0.string ?? "" }, false),
        ("handoffs", { $0["id"]?.string ?? "" }, true),
        ("cooked", { "\($0["date"]?.string ?? "")|\($0["recipeId"]?.string ?? "")|\($0["cookId"]?.string ?? "")" }, true),
    ]

    /// The fields this app reads for each kind of item. When this phone edits an item, only
    /// these fields are replaced; anything else the server has on it is kept.
    static let knownFields: [String: Set<String>] = [
        "members": ["id", "name", "color", "avoid", "diet", "cooks"],
        "recipes": ["id", "title", "description", "imageUrl", "activeMinutes", "totalMinutes", "servings", "ingredients",
                    "steps", "tastes", "weather", "leftovers", "source", "sourceUrl", "isFavorite", "createdAt", "custom"],
        "pantry": ["id", "name", "key", "zone", "aisle", "quantity", "unit", "addedAt", "softLifeDays", "staple"],
        "plan": ["id", "date", "slot", "recipeId", "leftoversOf", "note", "servings", "cookId", "done"],
        "shop": ["id", "name", "key", "quantity", "unit", "aisle", "checked", "fromRecipeIds", "more"],
        "handoffs": ["id", "date", "fromId", "toId", "recipeId", "message", "createdAt", "accepted"],
        "cooked": ["recipeId", "date", "cookId", "rating", "note"],
    ]

    static func empty() -> [String: JSONValue] {
        var d: [String: JSONValue] = ["v": .number(Double(version)), "settings": .object([:]), "energyByDate": .object([:])]
        for l in lists { d[l.key] = .array([]) }
        return d
    }

    /// Take what came from the server, filling in anything missing.
    static func clean(_ raw: JSONValue?) -> [String: JSONValue] {
        var d = empty()
        guard let o = raw?.object else { return d }
        for l in lists { if let a = o[l.key]?.array { d[l.key] = .array(a.filter { !l.idOf($0).isEmpty }) } }
        if let s = o["settings"]?.object { d["settings"] = .object(s) }
        if let e = o["energyByDate"]?.object { d["energyByDate"] = .object(e) }
        // Members carry no "this is me" flag: each phone remembers that itself.
        if let m = d["members"]?.array {
            d["members"] = .array(m.map { v in
                guard var o = v.object else { return v }
                o["isMe"] = nil
                return .object(o)
            })
        }
        return d
    }

    /// This phone's edit of an item laid over the server's copy: known fields from this
    /// phone (a field this phone cleared is removed), everything else from the server.
    private static func overlay(_ mine: JSONValue, on theirs: JSONValue?, known: Set<String>?) -> JSONValue {
        guard let known, let m = mine.object, let t = theirs?.object else { return mine }
        var out = t
        for k in known { out[k] = m[k] }
        for (k, v) in m where !known.contains(k) { out[k] = v }
        return .object(out)
    }

    /// Three-way merge of a list whose items have an identity.
    static func mergeList(base: [JSONValue], local: [JSONValue], remote: [JSONValue], idOf: (JSONValue) -> String,
                          newFirst: Bool, known: Set<String>? = nil) -> [JSONValue] {
        let b = Dictionary(base.map { (idOf($0), $0) }, uniquingKeysWith: { a, _ in a })
        let l = Dictionary(local.map { (idOf($0), $0) }, uniquingKeysWith: { a, _ in a })
        var order: [String] = []
        var out: [String: JSONValue] = [:]
        for item in remote {
            let id = idOf(item)
            if out[id] == nil { order.append(id) }
            out[id] = item
        }
        var added: [(String, JSONValue)] = []
        var seen = Set<String>()
        for mine in local {
            let id = idOf(mine)
            guard seen.insert(id).inserted else { continue } // first copy of a duplicate id only
            if let was = b[id] {
                if was != mine, out[id] != nil { out[id] = overlay(mine, on: out[id], known: known) }
                else if was != mine { added.append((id, mine)) } // edited here, deleted there: keep the edit
            } else if out[id] == nil {
                added.append((id, mine))
            } else {
                out[id] = overlay(mine, on: out[id], known: known)
            }
        }
        for id in b.keys where l[id] == nil { out[id] = nil }
        let kept = order.compactMap { out[$0] }
        let fresh = added.map(\.1)
        return newFirst ? fresh + kept : kept + fresh
    }

    static func mergeRecord(base: [String: JSONValue], local: [String: JSONValue], remote: [String: JSONValue]) -> [String: JSONValue] {
        var out = remote
        for (k, v) in local where base[k] != v { out[k] = v }
        for k in base.keys where local[k] == nil { out[k] = nil }
        return out
    }

    /// Replay this phone's changes since `base` onto the server's `remote`.
    static func merge(base: [String: JSONValue]?, local: [String: JSONValue], remote: [String: JSONValue]) -> [String: JSONValue] {
        let b = base ?? empty()
        var out: [String: JSONValue] = ["v": .number(Double(version))]
        out["settings"] = .object(mergeRecord(base: b["settings"]?.object ?? [:], local: local["settings"]?.object ?? [:],
                                              remote: remote["settings"]?.object ?? [:]))
        out["energyByDate"] = .object(mergeRecord(base: b["energyByDate"]?.object ?? [:], local: local["energyByDate"]?.object ?? [:],
                                                  remote: remote["energyByDate"]?.object ?? [:]))
        for l in lists {
            var merged = mergeList(base: b[l.key]?.array ?? [], local: local[l.key]?.array ?? [], remote: remote[l.key]?.array ?? [],
                                   idOf: l.idOf, newFirst: l.newFirst, known: knownFields[l.key])
            if l.key == "cooked" {
                merged.sort { ($0["date"]?.string ?? "") > ($1["date"]?.string ?? "") }
            }
            out[l.key] = .array(merged)
        }
        return out
    }

    static func equal(_ a: [String: JSONValue], _ b: [String: JSONValue]) -> Bool { JSONValue.object(a) == JSONValue.object(b) }
}

/// Household codes: 12 characters without look-alikes, shown as ABCD-EFGH-JKMN.
enum HouseholdCode {
    static let alphabet = Set("ABCDEFGHJKMNPQRSTUVWXYZ23456789")

    /// Reads a code the way people type or paste it: any case, with spaces or dashes, or a whole join link.
    static func normalize(_ input: String) -> String? {
        var text = input
        if let r = text.range(of: "code=") { text = String(text[r.upperBound...].prefix { $0 != "&" && $0 != "#" }) }
        let c = text.uppercased().filter { !$0.isWhitespace && $0 != "-" }
        return c.count == 12 && c.allSatisfy { alphabet.contains($0) } ? c : nil
    }

    static func format(_ code: String) -> String {
        stride(from: 0, to: code.count, by: 4).map { i -> String in
            let s = code.index(code.startIndex, offsetBy: i)
            let e = code.index(s, offsetBy: min(4, code.count - i))
            return String(code[s..<e])
        }.joined(separator: "-")
    }
}
