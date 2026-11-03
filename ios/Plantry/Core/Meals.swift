import Foundation

// Breakfast and lunch next to dinner. A port of lib/meals.ts.

enum Meals {
    /// The meals a household plans, in day order. Dinner is always there.
    static func planned(_ meals: [MealSlot]) -> [MealSlot] {
        let set = Set(meals + [.dinner])
        return MealSlot.allCases.filter { set.contains($0) }
    }

    /// The small meals (not dinner) shown on each day.
    static func small(_ meals: [MealSlot]) -> [MealSlot] { planned(meals).filter { $0 != .dinner } }

    struct Usual: Hashable {
        var recipeId: String?
        var note: String?
        var label: String
        var count: Int
    }

    /// What this household usually has for a meal: notes and recipes put in that slot in the
    /// last eight weeks, most often first.
    static func usuals(plan: [PlanEntry], recipes: [Recipe], slot: MealSlot, today: String, limit: Int = 6) -> [Usual] {
        let since = DateKey.addDays(today, -56)
        var seen: [String: (u: Usual, last: String)] = [:]
        for p in plan where p.slot == slot && p.date >= since && p.leftoversOf == nil {
            var key: String
            var u: Usual
            if let rid = p.recipeId {
                guard let r = recipes.first(where: { $0.id == rid }) else { continue }
                key = "r:\(r.id)"; u = Usual(recipeId: r.id, label: r.title, count: 0)
            } else if let note = p.note?.trimmed, !note.isEmpty {
                key = "n:\(note.lowercased())"; u = Usual(note: note, label: note, count: 0)
            } else { continue }
            let was = seen[key]
            var next = was?.u ?? u
            next.count += 1
            seen[key] = (next, max(was?.last ?? "", p.date))
        }
        return seen.values
            .sorted { $0.u.count != $1.u.count ? $0.u.count > $1.u.count : $0.last > $1.last }
            .prefix(limit).map(\.u)
    }
}
