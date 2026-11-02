import Foundation

// The suggestion ranker. Pure and deterministic given its inputs, so a model
// can later replace it behind the same interface.

struct Scored: Identifiable, Hashable, Sendable {
    var recipe: Recipe
    var score: Double
    var have: Int
    var total: Int
    var missing: [String]
    var reasons: [String]
    var id: String { recipe.id }
}

struct Coverage: Hashable, Sendable {
    var have: Int
    var total: Int
    var missing: [String]
    var ratio: Double { total > 0 ? Double(have) / Double(total) : 0 }
    var complete: Bool { missing.isEmpty && total > 0 }

    /// "You have everything", "Only missing lime", "Missing 4 things".
    var line: String {
        if missing.isEmpty { return "You have everything" }
        if missing.count <= 2 { return "Only missing \(missing.joined(separator: " and "))" }
        return "Missing \(missing.count) things"
    }
}

/// Coverage of a recipe's required ingredients by a set of pantry keys.
func coverage(_ recipe: Recipe, pantryKeys: Set<String>) -> Coverage {
    let required = recipe.requiredIngredients
    let missing = required.filter { !pantryKeys.contains($0.key) }.map(\.name)
    return Coverage(have: required.count - missing.count, total: required.count, missing: missing)
}

func coverage(_ recipe: Recipe, pantry: [PantryItem]) -> Coverage {
    coverage(recipe, pantryKeys: Set(pantry.map(\.key)))
}

struct SuggestInput {
    var recipes: [Recipe]
    var pantry: [PantryItem]
    var tastes: [Taste]
    var energy: Energy? = nil
    var weatherLean: WeatherLean
    var isWeekend: Bool
    var today: String
    /// Recipe ids cooked recently, most recent first. Penalized so dinner does not repeat.
    var recent: [String] = []
    var exclude: Set<String> = []
}

func suggest(_ input: SuggestInput) -> [Scored] {
    let pantryKeys = Set(input.pantry.map(\.key))
    let aging = Set(
        input.pantry
            .filter { Double(DateKey.daysBetween(String($0.addedAt.prefix(10)), input.today)) >= Double($0.softLifeDays) * 0.6 }
            .map(\.key)
    )
    let tasteSet = Set(input.tastes)

    var out: [Scored] = []
    out.reserveCapacity(input.recipes.count)
    for recipe in input.recipes where !input.exclude.contains(recipe.id) {
        var reasons: [String] = []
        var score = 0.0

        let cov = coverage(recipe, pantryKeys: pantryKeys)
        score += cov.ratio * 40
        if cov.missing.isEmpty && cov.total > 0 { reasons.append("You have everything") }
        else if cov.missing.count <= 2 && cov.total > 0 { reasons.append("Only missing \(cov.missing.joined(separator: " and "))") }

        let usesAging = recipe.ingredients.filter { aging.contains($0.key) }
        if let first = usesAging.first {
            score += Double(min(usesAging.count, 3)) * 6
            reasons.append("Uses up your \(first.name.lowercased())")
        }

        let tasteHits = recipe.tastes.filter { tasteSet.contains($0) }.count
        score += Double(tasteHits) * 5

        switch input.energy {
        case .quick:
            if recipe.activeMinutes <= 20 { score += 15; reasons.append("Quick") }
            else { score -= Double(recipe.activeMinutes) }
        case .cantTonight:
            score += recipe.activeMinutes <= 10 ? 25 : -100
        case .upForIt:
            if recipe.totalMinutes >= 40 { score += 4 }
        case nil:
            score += recipe.activeMinutes <= 30 ? 4 : 0
        }

        if input.weatherLean != .any, recipe.weather == input.weatherLean {
            score += 10
            reasons.append(input.weatherLean == .warm ? "Good for a cold night" : "Nothing heavy")
        }
        if input.weatherLean != .any, let w = recipe.weather, w != .any, w != input.weatherLean { score -= 6 }

        if !input.isWeekend && recipe.totalMinutes > 60 { score -= 8 }
        if input.isWeekend && recipe.tastes.contains(.bigBatch) { score += 4 }

        if let idx = input.recent.firstIndex(of: recipe.id) { score -= max(0, 25 - Double(idx) * 5) }
        if recipe.isFavorite { score += 3 }

        out.append(Scored(recipe: recipe, score: score, have: cov.have, total: cov.total, missing: cov.missing, reasons: Array(reasons.prefix(2))))
    }
    return out.sorted { $0.score > $1.score }
}

/// Pseudo-random pick weighted toward the top so the shuffle feels fair but surprising.
func pickNext(_ ranked: [Scored], seen: [String]) -> Scored? {
    let fresh = ranked.filter { !seen.contains($0.recipe.id) }
    if fresh.isEmpty { return ranked.first }
    let pool = Array(fresh.prefix(5))
    let weights = pool.indices.map { 5 - $0 }
    let total = weights.reduce(0, +)
    var r = Double.random(in: 0..<Double(total))
    for i in pool.indices {
        r -= Double(weights[i])
        if r <= 0 { return pool[i] }
    }
    return pool.first
}
