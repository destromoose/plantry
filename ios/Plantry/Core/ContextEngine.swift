import Foundation

// The adaptive context engine. A pure function so it is easy to test and so
// the UI can re-run it at launch or on a clear change (hour band, foreground)
// and never continuously. Mirrors the web app's lib/context.ts.

enum ContextEngine {
    /// After this hour, Tonight starts thinking about tomorrow, unless tonight is still open.
    static let tomorrowFromHour = 22

    static func mood(forHour hour: Int) -> Mood {
        if hour >= 5 && hour < 10 { return .dawn }
        if hour >= 10 && hour < 17 { return .day }
        if hour >= 17 && hour < 21 { return .dusk }
        return .night
    }

    static func lean(for weather: Weather?) -> WeatherLean {
        guard let weather else { return .any }
        if weather.precipitation || weather.tempC <= 12 { return .warm }
        if weather.tempC >= 26 { return .light }
        return .any
    }

    /// The next moment the context can change: a mood band, the cutoff or midnight.
    static func nextChange(after now: Date) -> Date {
        let cal = DateKey.calendar
        let hour = cal.component(.hour, from: now)
        let marks = [5, 10, 17, 21, tomorrowFromHour, 24]
        let h = marks.first { $0 > hour } ?? 24
        var comps = cal.dateComponents([.year, .month, .day], from: now)
        comps.hour = h; comps.minute = 0; comps.second = 5
        let next = cal.date(from: comps) ?? now.addingTimeInterval(3600)
        return max(next, now.addingTimeInterval(1))
    }

    struct Input {
        var now: Date
        var settings: Settings
        var weather: Weather?
        var plan: [PlanEntry]
        var recipes: [Recipe]
        /// The person said they are still eating tonight, so don't jump to tomorrow yet.
        var stillTonight = false
        /// The device is set to dark mode. Used by the 'system' mood.
        var prefersDark = false
    }

    static func build(_ input: Input) -> AppContext {
        let cal = DateKey.calendar
        let hour = cal.component(.hour, from: input.now)
        let weekday = cal.component(.weekday, from: input.now)
        let isWeekend = weekday == 1 || weekday == 7
        let today = DateKey.key(input.now)

        // Late evening: look at tomorrow, unless tonight's dinner is planned and not yet cooked
        // or the person asked to stay on tonight. After midnight, "tonight" is the new day.
        let todayEntry = input.plan.first { $0.date == today && $0.slot == .dinner }
        let tonightOpen = todayEntry.map { !$0.isDone && ($0.recipeId != nil || $0.leftoversOf != nil) } ?? false
        let tonightDone = todayEntry?.isDone ?? false
        let lateNight = !input.stillTonight && ((hour >= tomorrowFromHour && !tonightOpen) || tonightDone)
        let targetDate = lateNight ? DateKey.addDays(today, 1) : today
        let targetLabel = lateNight ? "Tomorrow" : "Tonight"

        let mood: Mood = switch input.settings.mood {
        case .auto: mood(forHour: hour)
        case .system: input.prefersDark ? .night : .day
        default: Mood(rawValue: input.settings.mood.rawValue) ?? .day
        }
        let lean = input.settings.weatherEnabled ? lean(for: input.weather) : .any

        let tonight = input.plan.first { $0.date == targetDate && $0.slot == .dinner }
        let tonightRecipe = tonight?.recipeId.flatMap { id in input.recipes.first { $0.id == id } }
        let yesterday = DateKey.addDays(today, -1)
        let yesterdayBigBatch = input.plan.contains { p in
            p.date == yesterday && p.slot == .dinner && p.isDone
                && (input.recipes.first { $0.id == p.recipeId }?.makesLeftovers ?? false)
        }
        let weekPlanned = countPlannedDinners(input.plan, today: today)

        var nudge: Nudge = .none
        if isWeekend && hour >= 7 && hour < 13 && weekPlanned < 3 {
            nudge = .planWeek
        } else if hour >= 7 && hour < 12,
                  let r = tonightRecipe,
                  r.ingredients.contains(where: { $0.aisle == .frozen || $0.aisle == .meatFish }) {
            nudge = .defrost
        } else if hour >= 16 && hour < 20 && tonightRecipe != nil {
            nudge = .startNow
        } else if (hour >= 20 || lateNight) && yesterdayBigBatch {
            nudge = .leftovers
        }

        let reason = describe(mood: mood, isWeekend: isWeekend, lean: lean, weather: input.weather, lateNight: lateNight)

        return AppContext(
            now: input.now, mood: mood, hour: hour, isWeekend: isWeekend,
            targetDate: targetDate, targetLabel: targetLabel, canStayTonight: lateNight && !tonightDone,
            weather: input.weather, weatherLean: lean, nudge: nudge, reason: reason
        )
    }

    private static func countPlannedDinners(_ plan: [PlanEntry], today: String) -> Int {
        let week = Set((0..<7).map { DateKey.addDays(today, $0) })
        return plan.filter { $0.slot == .dinner && week.contains($0.date) && $0.isDecided }.count
    }

    private static func describe(mood: Mood, isWeekend: Bool, lean: WeatherLean, weather: Weather?, lateNight: Bool) -> String {
        let day = isWeekend ? "weekend" : "weekday"
        let time: String = switch mood {
        case .dawn: "morning"
        case .day: "afternoon"
        case .dusk: "evening"
        case .night: "late night"
        }
        var w = ""
        if let weather {
            if weather.precipitation { w = "Rainy " }
            else if weather.tempC <= 12 { w = "Chilly " }
            else if weather.tempC >= 26 { w = "Hot " }
        }
        let leanText = lean == .warm ? ", so I leaned cozy" : lean == .light ? ", so I kept it light" : ""
        let target = lateNight ? " Thinking about tomorrow." : ""
        let dayText = w.isEmpty ? day.prefix(1).uppercased() + day.dropFirst() : day
        return "\(w)\(dayText) \(time)\(leanText).\(target)"
    }
}
