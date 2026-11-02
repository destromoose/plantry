import Foundation

// Allergens and diets. Recipes are checked from their ingredient names, so a recipe
// someone adds is covered too. This is a safety net, not a guarantee: always check
// packaging for allergens. Ported from the web app's lib/diet.ts.

struct AvoidOption: Identifiable, Hashable {
    var id: String
    var label: String
}

enum Diet {
    static let allergenOptions: [AvoidOption] = [
        .init(id: "peanut", label: "Peanuts"), .init(id: "tree-nut", label: "Tree nuts"), .init(id: "dairy", label: "Dairy"),
        .init(id: "egg", label: "Eggs"), .init(id: "gluten", label: "Gluten"), .init(id: "soy", label: "Soy"),
        .init(id: "sesame", label: "Sesame"), .init(id: "fish", label: "Fish"), .init(id: "shellfish", label: "Shellfish"),
    ]

    static let dietOptions: [AvoidOption] = [
        .init(id: "vegetarian", label: "Vegetarian"), .init(id: "vegan", label: "Vegan"), .init(id: "no-pork", label: "No pork"),
        .init(id: "no-beef", label: "No beef"), .init(id: "mild", label: "Not spicy"),
    ]

    static func label(_ id: String) -> String {
        (allergenOptions + dietOptions).first { $0.id == id }?.label ?? id
    }

    static func isDiet(_ id: String) -> Bool { dietOptions.contains { $0.id == id } }

    enum Tag: String, CaseIterable {
        case peanut, treeNut = "tree-nut", dairy, egg, gluten, soy, sesame, fish, shellfish, meat, pork, beef, honey
    }

    private static let words: [Tag: [String]] = [
        .peanut: ["peanut", "peanuts", "peanut butter", "satay"],
        .treeNut: ["cashew", "almond", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "pine nut", "brazil nut", "nut", "nuts", "praline", "marzipan", "pesto"],
        .dairy: ["milk", "butter", "cheese", "cheddar", "feta", "parmesan", "mozzarella", "yogurt", "yoghurt", "cream", "ghee", "paneer", "ricotta", "halloumi", "mascarpone", "buttermilk", "creme fraiche", "pesto"],
        .egg: ["egg", "eggs", "mayonnaise", "mayo", "aioli"],
        .gluten: ["bread", "pasta", "spaghetti", "penne", "noodle", "noodles", "tortilla", "flour", "soy sauce", "couscous", "barley", "wheat", "breadcrumb", "breadcrumbs", "panko", "pita", "naan", "bun", "buns", "toast", "teriyaki", "udon", "ramen", "lasagne", "lasagna", "gnocchi", "bulgur", "seitan"],
        .soy: ["soy", "soy sauce", "tofu", "edamame", "miso", "tempeh", "teriyaki"],
        .sesame: ["sesame", "sesame oil", "tahini", "hummus"],
        .fish: ["fish", "salmon", "tuna", "cod", "anchovy", "anchovies", "sardine", "mackerel", "haddock", "trout", "fish sauce", "curry paste", "worcestershire"],
        .shellfish: ["prawn", "prawns", "shrimp", "crab", "lobster", "mussel", "mussels", "clam", "clams", "scallop", "scallops", "oyster", "squid", "calamari", "curry paste"],
        .meat: ["chicken", "beef", "pork", "lamb", "bacon", "ham", "sausage", "turkey", "mince", "prosciutto", "chorizo", "pancetta", "duck", "steak", "veal", "gelatin", "lard"],
        .pork: ["pork", "bacon", "ham", "prosciutto", "chorizo", "pancetta", "lard", "sausage", "salami", "pepperoni"],
        .beef: ["beef", "steak", "veal", "brisket"],
        .honey: ["honey"],
    ]

    // Names that contain a word above but are fine.
    private static let exceptions: [Tag: [String]] = [
        .dairy: ["peanut butter", "almond butter", "nut butter", "cocoa butter", "coconut milk", "coconut cream", "oat milk", "soy milk", "almond milk", "rice milk", "butter bean", "butter beans", "cream of tartar"],
        .treeNut: ["coconut", "nutmeg", "butternut", "peanut", "peanuts", "peanut butter", "pine nuts free", "doughnut", "donut"],
        .egg: ["eggplant", "egg noodle-free"],
        .gluten: ["rice noodle", "rice noodles", "corn tortilla", "corn tortillas", "gluten-free", "gluten free", "tamari"],
        .meat: ["chicken of the woods", "vegetable stock", "veggie sausage", "vegan sausage"],
        .pork: ["veggie sausage", "vegan sausage"],
    ]

    private static let regexCache: [Tag: [NSRegularExpression]] = {
        var out: [Tag: [NSRegularExpression]] = [:]
        for (tag, list) in words {
            out[tag] = list.compactMap { w in
                try? NSRegularExpression(pattern: "(^|[^a-z])\(NSRegularExpression.escapedPattern(for: w))(s|es)?([^a-z]|$)")
            }
        }
        return out
    }()

    private static func has(_ text: String, _ tag: Tag) -> Bool {
        var t = " \(text) "
        for e in exceptions[tag] ?? [] { t = t.replacingOccurrences(of: e, with: " ") }
        let range = NSRange(t.startIndex..., in: t)
        return (regexCache[tag] ?? []).contains { $0.firstMatch(in: t, range: range) != nil }
    }

    static func tags(for ingredient: Ingredient) -> Set<Tag> {
        let text = "\(ingredient.name) \(ingredient.key)".lowercased()
        var out = Set<Tag>()
        for tag in Tag.allCases where has(text, tag) { out.insert(tag) }
        // Meat stock is meat; a plain "stock" is left to the cook.
        if text.range(of: "(chicken|beef|pork|lamb|fish) stock", options: .regularExpression) != nil { out.insert(.meat) }
        return out
    }

    /// Which ingredient tags break this rule.
    private static func blocked(by rule: String) -> [Tag] {
        switch rule {
        case "vegetarian": [.meat, .fish, .shellfish]
        case "vegan": [.meat, .fish, .shellfish, .dairy, .egg, .honey]
        case "no-pork": [.pork]
        case "no-beef": [.beef]
        case "mild": []
        default: Tag(rawValue: rule).map { [$0] } ?? []
        }
    }

    struct Conflict: Hashable {
        /// Rules this recipe breaks even after leaving out optional ingredients.
        var blocking: [String] = []
        /// Optional ingredients to leave out to stay safe.
        var leaveOut: [String] = []
        /// Required ingredient names that break a rule.
        var culprits: [String] = []
        var isEmpty: Bool { blocking.isEmpty && leaveOut.isEmpty }
    }

    static func conflicts(ingredients: [Ingredient], tastes: [Taste], avoid: [String]) -> Conflict {
        var c = Conflict()
        if avoid.isEmpty { return c }
        var blocking: [String] = [], leaveOut: [String] = [], culprits: [String] = []
        func add(_ s: String, to list: inout [String]) { if !list.contains(s) { list.append(s) } }
        if avoid.contains("mild") && tastes.contains(.spicy) { add("mild", to: &blocking); add("chili heat", to: &culprits) }
        for ing in ingredients {
            let t = tags(for: ing)
            for rule in avoid where blocked(by: rule).contains(where: { t.contains($0) }) {
                if ing.isOptional { add(ing.name, to: &leaveOut) }
                else { add(rule, to: &blocking); add(ing.name, to: &culprits) }
            }
        }
        c.blocking = blocking; c.leaveOut = leaveOut; c.culprits = culprits
        return c
    }

    static func conflicts(_ recipe: Recipe, avoid: [String]) -> Conflict {
        conflicts(ingredients: recipe.ingredients, tastes: recipe.tastes, avoid: avoid)
    }

    static func isSafe(_ recipe: Recipe, avoid: [String]) -> Bool {
        conflicts(recipe, avoid: avoid).blocking.isEmpty
    }

    /// Everything the household avoids: the shared list plus every person's.
    static func householdAvoid(settingsAvoid: [String], members: [Member]) -> [String] {
        var all: [String] = []
        func add(_ s: String) { if !all.contains(s) { all.append(s) } }
        settingsAvoid.forEach(add)
        for m in members {
            (m.avoid ?? []).forEach(add)
            if let d = m.diet { add(d) }
        }
        return all
    }

    /// A short warning like "Has peanuts and dairy".
    static func conflictText(_ c: Conflict) -> String {
        if c.blocking.isEmpty { return "" }
        let allergens = c.blocking.filter { !isDiet($0) }.map { label($0).lowercased() }
        var parts: [String] = []
        if !allergens.isEmpty { parts.append("Has \(allergens.joined(separator: " and "))") }
        for d in c.blocking where isDiet(d) { parts.append(d == "mild" ? "Spicy" : "Not \(label(d).lowercased())") }
        return parts.joined(separator: " · ")
    }
}
