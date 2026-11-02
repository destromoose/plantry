import Foundation

// Plain safety notes for steps, so someone new to cooking (or a 13-year-old on their own)
// knows what to watch. Derived from the step text; a step can also carry its own caution.

enum CautionKind: String { case hot, oven, boil, sharp, raw }

struct Caution: Hashable, Identifiable {
    var kind: CautionKind
    var note: String
    var id: String { kind.rawValue + note }
}

enum Safety {
    private static let rules: [(CautionKind, NSRegularExpression, String)] = [
        (.oven, re("\\b(oven|bake|baking|roast|roasting|grill|broil|tray)\\b"), "Oven: use oven gloves, and open the door away from your face."),
        (.hot, re("\\b(fry|frying|fried|sear|searing|saut[eé]\\w*|hot oil|smoking|sizzl\\w*|pan|skillet|wok|pot|medium heat|high heat)\\b"), "Hot pan: turn the handle inward and keep water away from hot oil."),
        (.boil, re("\\b(boil\\w*|simmer\\w*|drain|steam\\w*|blanch\\w*)\\b"), "Boiling water: pour away from you and use a lid as a shield."),
        (.sharp, re("\\b(chop|chopping|slice|slicing|dice|dicing|cut|cutting|knife|grate|grating|peel|peeling|zest|zesting|mince|mincing)\\b"), "Sharp: curl your fingertips under and cut away from you."),
        (.raw, re("\\b(raw|chicken|pork|beef|mince|salmon|prawns?|fish)\\b"), "Raw meat or fish: wash hands, board and knife after."),
    ]

    private static func re(_ p: String) -> NSRegularExpression {
        try! NSRegularExpression(pattern: p, options: .caseInsensitive)
    }

    /// Cautions for one step, most serious first, at most two.
    static func cautions(for text: String, own: String? = nil) -> [Caution] {
        var out: [Caution] = own.map { [Caution(kind: .hot, note: $0)] } ?? []
        let range = NSRange(text.startIndex..., in: text)
        for (kind, regex, note) in rules where regex.firstMatch(in: text, range: range) != nil && !out.contains(where: { $0.kind == kind }) {
            out.append(Caution(kind: kind, note: note))
        }
        return Array(out.prefix(2))
    }

    /// True for steps where a younger cook should get help.
    static func needsGrownUp(_ c: [Caution]) -> Bool { c.contains { $0.kind != .raw } }

    /// "Bake at 200°C" -> "Bake at 200°C (390°F)". Rounds to the nearest 5 like oven dials.
    static func withFahrenheit(_ text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "(\\d{2,3})\\s?°\\s?C\\b(?!\\s*\\()") else { return text }
        var out = text
        for m in regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).reversed() {
            guard let whole = Range(m.range, in: text), let cr = Range(m.range(at: 1), in: text), let c = Double(text[cr]) else { continue }
            let f = Int(((c * 9 / 5 + 32) / 5).rounded() * 5)
            out.replaceSubrange(whole, with: "\(text[whole]) (\(f)°F)")
        }
        return out
    }
}

/// A best guess at where something lives, so new items don't all land in the fridge.
enum PantryGuess {
    private static let zoneWords: [(PantryZone, [String])] = [
        (.freezer, ["frozen", "ice cream", "ice"]),
        (.fridge, ["milk", "cheese", "cheddar", "feta", "parmesan", "mozzarella", "yogurt", "butter", "cream", "egg", "chicken", "beef", "pork", "lamb", "mince", "bacon", "ham", "sausage", "fish", "salmon", "cod", "prawn", "tofu", "lettuce", "spinach", "kale", "rocket", "cilantro", "parsley", "basil", "mint", "scallion", "carrot", "celery", "cucumber", "zucchini", "bell pepper", "broccoli", "mushroom", "berry", "grape", "lemon", "lime", "hummus", "juice", "kimchi", "tortilla"]),
        (.counter, ["banana", "bread", "tomato", "avocado", "onion", "garlic", "potato", "sweet potato", "apple", "orange", "mango", "pear", "squash", "ginger"]),
    ]

    static func zone(for name: String) -> PantryZone {
        let key = keyOf(name)
        if let s = Seed.staplesByKey[key] { return s.zone }
        for (zone, words) in zoneWords where words.contains(where: { key.contains($0) }) { return zone }
        return .cupboard
    }

    private static let aisleWords: [(Aisle, [String])] = [
        (.pantry, ["peanut butter", "coconut milk", "tomato paste", "stock cube"]),
        (.frozen, ["frozen", "ice cream"]),
        (.meatFish, ["chicken", "beef", "pork", "lamb", "mince", "bacon", "ham", "sausage", "fish", "salmon", "cod", "tuna", "prawn", "shrimp", "turkey"]),
        (.dairy, ["milk", "cheese", "cheddar", "feta", "parmesan", "mozzarella", "yogurt", "yoghurt", "butter", "cream", "egg"]),
        (.bakery, ["bread", "bun", "roll", "bagel", "pitta", "pita", "naan", "tortilla", "wrap", "baguette"]),
        (.spices, ["cumin", "paprika", "chili flake", "chilli flake", "turmeric", "oregano", "cinnamon", "pepper flake", "curry powder", "garam masala", "thyme", "salt", "black pepper"]),
        (.drinks, ["juice", "wine", "beer", "soda", "coffee", "tea"]),
        (.pantry, ["rice", "pasta", "spaghetti", "noodle", "flour", "sugar", "oil", "vinegar", "stock", "broth", "tin", "can", "bean", "lentil", "chickpea", "oat", "sauce", "honey", "passata"]),
        (.produce, ["onion", "garlic", "tomato", "potato", "carrot", "celery", "lemon", "lime", "apple", "banana", "spinach", "kale", "lettuce", "herb", "parsley", "cilantro", "coriander", "basil", "mint", "ginger", "pepper", "chili", "chilli", "mushroom", "courgette", "zucchini", "broccoli", "cabbage", "avocado", "cucumber", "squash", "leek", "scallion", "spring onion", "berry", "orange", "pea"]),
    ]

    /// A best guess at which aisle an ingredient is in, so the shopping list sorts well.
    static func aisle(for name: String) -> Aisle {
        let key = keyOf(name)
        if key.isEmpty { return .other }
        if let s = Seed.staplesByKey[key] { return s.aisle }
        for (aisle, words) in aisleWords where words.contains(where: { key.contains($0) }) { return aisle }
        return .other
    }

    /// How long something usually keeps where it lives, in days.
    static func defaultLife(_ zone: PantryZone) -> Int {
        switch zone {
        case .fridge: 7
        case .counter: 7
        case .freezer: 90
        case .cupboard: 180
        }
    }
}
