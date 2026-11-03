import Foundation

// Planning further ahead together, a port of lib/planTogether.ts: meals that repeat every
// week, copying last week, the household's pool of ideas, and the month at a glance.

/// "We should have tacos soon": a meal someone fancies, waiting for a night.
struct MealIdea: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var text: String?
    var recipeId: String?
    var by: String?
    var at: String
    /// Members who said "me too".
    var votes: [String]?
}

/// A meal the household has every week: "Pizza every Friday".
struct RepeatMeal: Codable, Identifiable, Hashable, Sendable {
    var id: String
    /// 0 is Sunday, the way the web app counts.
    var weekday: Int
    var slot: MealSlot
    var recipeId: String?
    var note: String?
    var by: String?
}

enum PlanAhead {
    private static func decided(_ e: PlanEntry?) -> Bool {
        guard let e else { return false }
        return e.recipeId != nil || e.leftoversOf != nil || (e.note?.isEmpty == false)
    }

    static func repeatFor(_ repeats: [RepeatMeal], _ date: String, _ slot: MealSlot) -> RepeatMeal? {
        let dow = Together.weekday(date)
        return repeats.first { $0.weekday == dow && $0.slot == slot }
    }

    /// Last week's meals onto this week's empty slots, from today on. Leftovers and nights
    /// off are left out.
    static func copyWeek(_ plan: [PlanEntry], to dates: [String], today: String) -> [PlanEntry] {
        func at(_ d: String, _ s: MealSlot) -> PlanEntry? { plan.first { $0.date == d && $0.slot == s } }
        var out: [PlanEntry] = []
        for date in dates where date >= today {
            for slot in MealSlot.allCases {
                if decided(at(date, slot)) { continue }
                guard let was = at(DateKey.addDays(date, -7), slot), was.recipeId != nil || (was.note?.isEmpty == false),
                      was.note != "Not cooking" else { continue }
                out.append(PlanEntry(id: IDs.make("pl"), date: date, slot: slot, recipeId: was.recipeId,
                                     note: was.recipeId == nil ? was.note : nil, cookId: at(date, slot)?.cookId ?? was.cookId))
            }
        }
        return out
    }

    /// Weekly meals onto these dates' empty slots, from today on.
    static func repeatsInto(_ plan: [PlanEntry], _ repeats: [RepeatMeal], dates: [String], today: String) -> [PlanEntry] {
        var out: [PlanEntry] = []
        for date in dates where date >= today {
            // Two phones can each set a weekly meal for the same night before syncing: the
            // first wins, as in repeatFor.
            var seen = Set<MealSlot>()
            for r in repeats where r.weekday == Together.weekday(date) && seen.insert(r.slot).inserted {
                let cur = plan.first { $0.date == date && $0.slot == r.slot }
                if decided(cur) { continue }
                out.append(PlanEntry(id: IDs.make("pl"), date: date, slot: r.slot, recipeId: r.recipeId, note: r.note, cookId: cur?.cookId))
            }
        }
        return out
    }

    /// Most "me too" first, then the newest.
    static func rank(_ ideas: [MealIdea]) -> [MealIdea] {
        ideas.sorted { a, b in
            let x = a.votes?.count ?? 0, y = b.votes?.count ?? 0
            return x != y ? x > y : a.at > b.at
        }
    }

    /// Monday-first weeks covering a month: 5 or 6 rows of 7 date keys. Month is 1 to 12.
    static func monthGrid(year: Int, month: Int) -> [[String]] {
        let first = String(format: "%04d-%02d-01", year, month)
        let lead = (Together.weekday(first) + 6) % 7
        let start = DateKey.addDays(first, -lead)
        let days = Calendar(identifier: .gregorian).range(of: .day, in: .month, for: DateKey.date(first))?.count ?? 30
        let rows = Int((Double(lead + days) / 7).rounded(.up))
        return (0..<rows).map { w in (0..<7).map { DateKey.addDays(start, w * 7 + $0) } }
    }
}
