import Foundation
import ActivityKit
import AppIntents

// The cook-mode Live Activity: the step you're on and the timer that matters
// most, on the Lock Screen and in the Dynamic Island. Shared by both targets:
// the app starts and updates it, the widget extension draws it.
//
// Everything here is local. No push, no App Group, no server, so a free Apple
// ID (Personal Team) can sign it. Countdowns tick on their own through
// Text(timerInterval:) and ProgressView(timerInterval:), so the app does not
// need to run for the clock to move.

struct CookActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// 1-based step number and the step count.
        var step: Int
        var stepCount: Int
        var stepText: String
        /// Id of the step on screen, for its timer button.
        var stepId: String
        /// Minutes on the current step's timer, when it has one that hasn't started.
        var stepTimerMinutes: Int?
        /// The timer that matters most right now: ringing, then soonest to end, then paused.
        var timer: LiveTimer?
        /// Other timers running besides that one.
        var moreTimers: Int
        /// How many people this cook is for.
        var servings: Int
    }

    var recipeId: String
    var recipeTitle: String
}

struct LiveTimer: Codable, Hashable {
    var stepId: String
    /// 1-based step the timer belongs to.
    var step: Int
    /// A few words from the step, like "Simmer the sauce".
    var label: String
    var duration: TimeInterval
    /// Wall-clock end while running.
    var endsAt: Date?
    /// Seconds left while paused.
    var remaining: TimeInterval
    /// Finished and still ringing.
    var ringing: Bool

    var running: Bool { endsAt != nil && !ringing }
    var paused: Bool { endsAt == nil && !ringing }

    /// The interval the system clock counts down, start to end.
    var interval: ClosedRange<Date> {
        let end = endsAt ?? Date().addingTimeInterval(remaining)
        return end.addingTimeInterval(-duration)...end
    }

    /// "4:05", for a paused timer.
    var remainingText: String {
        let s = Int(remaining.rounded(.up))
        return s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60) : String(format: "%d:%02d", s / 60, s % 60)
    }
}

/// What a Live Activity button asks the app to do.
enum CookCommand: Equatable, Sendable {
    case step(Int)
    case timer(String)
}

// LiveActivityIntent runs in the app's process, so the handler can touch the
// cook session. The widget extension compiles a no-op handler of the same name.

struct CookStepIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Change cooking step"
    static var description = IntentDescription("Moves cook mode to the next or previous step.")
    static var isDiscoverable = false

    @Parameter(title: "Forward") var forward: Bool

    init() {}
    init(forward: Bool) { self.forward = forward }

    func perform() async throws -> some IntentResult {
        await CookCommandHandler.handle(.step(forward ? 1 : -1))
        return .result()
    }
}

struct CookTimerIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Start, pause or stop a cooking timer"
    static var description = IntentDescription("Starts, pauses, resumes or silences the timer on a cooking step.")
    static var isDiscoverable = false

    @Parameter(title: "Step") var stepId: String

    init() {}
    init(stepId: String) { self.stepId = stepId }

    func perform() async throws -> some IntentResult {
        await CookCommandHandler.handle(.timer(stepId))
        return .result()
    }
}
