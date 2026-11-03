import Foundation
import Observation
import AudioToolbox
import UserNotifications

// The cook session lives outside the SwiftData store: it changes every second
// while a timer runs, and only matters for the dinner being cooked right now.
// It survives closing cook mode, backgrounding and relaunch for 12 hours.

struct TimerState: Codable, Equatable {
    var durationMs: Int
    /// Remaining time while paused or idle.
    var remainingMs: Int
    /// Wall-clock end while running, else nil.
    var endsAt: Date?
    var finished: Bool
    /// True once the finished alarm has been dismissed.
    var acknowledged = false

    func remaining(now: Date) -> Int {
        if let endsAt { return max(0, Int(endsAt.timeIntervalSince(now) * 1000)) }
        return remainingMs
    }
}

struct CookSession: Codable, Equatable {
    var recipeId: String
    var date: String?
    var index: Int
    var servings: Int?
    var checked: [String] = []
    var timers: [String: TimerState] = [:]
    var savedAt: Date = Date()
    /// What the Live Activity needs to draw and drive the cook without opening
    /// the store: the dish, its steps and how many it's for. Missing in sessions
    /// saved before the Live Activity existed.
    var title: String? = nil
    var steps: [Step]? = nil
    var people: Int? = nil

    static let key = "plantry-cook"
    static let maxAge: TimeInterval = 12 * 60 * 60

    static func load(recipeId: String? = nil) -> CookSession? {
        guard let data = UserDefaults.standard.data(forKey: key), let s = try? JSONDecoder().decode(CookSession.self, from: data) else { return nil }
        if Date().timeIntervalSince(s.savedAt) > maxAge { clear(); return nil }
        if let recipeId, s.recipeId != recipeId { return nil }
        return s
    }

    /// Saves and brings the Live Activity up to date. `live` is true when cook
    /// mode itself is saving: only then may a Live Activity start, or a finished
    /// timer light up the Dynamic Island.
    func save(live: Bool = false, syncActivity: Bool = true) {
        var s = self
        s.savedAt = Date()
        if let data = try? JSONEncoder().encode(s) { UserDefaults.standard.set(data, forKey: Self.key) }
        NotificationCenter.default.post(name: .plantryDataChanged, object: nil)
        if syncActivity { Task { @MainActor in CookLiveActivity.sync(s, live: live) } }
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
        Notifications.cancelAll()
        NotificationCenter.default.post(name: .plantryDataChanged, object: nil)
        Task { @MainActor in CookLiveActivity.end() }
    }

    /// Start, pause, resume or silence one step's timer, the same way the
    /// buttons in cook mode do. Used by the Live Activity, which works on the
    /// saved session because cook mode may not be open.
    mutating func toggleTimer(_ id: String, now: Date = Date()) {
        guard let step = steps?.first(where: { $0.id == id }), let minutes = step.timerMinutes else { return }
        let full = minutes * 60_000
        var t = timers[id] ?? TimerState(durationMs: full, remainingMs: full, endsAt: nil, finished: false)
        if let end = t.endsAt, end <= now {
            t = TimerState(durationMs: t.durationMs, remainingMs: 0, endsAt: nil, finished: true, acknowledged: false)
        }
        if t.finished && !t.acknowledged {
            t.acknowledged = true
            Notifications.cancel(id: id)
        } else if let end = t.endsAt {
            t.remainingMs = max(0, Int(end.timeIntervalSince(now) * 1000))
            t.endsAt = nil
            Notifications.cancel(id: id)
        } else {
            let rem = t.finished || t.remainingMs <= 0 ? t.durationMs : t.remainingMs
            let end = now.addingTimeInterval(Double(rem) / 1000)
            t.remainingMs = rem
            t.endsAt = end
            t.finished = false
            t.acknowledged = false
            Notifications.schedule(id: id, at: end, body: CookLiveActivity.label(step.text))
        }
        timers[id] = t
    }

    /// What the Live Activity shows for this session, or nil when there is nothing to cook.
    func liveState(now: Date = Date()) -> CookActivityAttributes.ContentState? {
        guard let steps, !steps.isEmpty else { return nil }
        let i = min(max(index, 0), steps.count - 1)
        let step = steps[i]
        var live: [LiveTimer] = []
        for (n, s) in steps.enumerated() {
            guard let t = timers[s.id] else { continue }
            let expired = t.endsAt.map { $0 <= now } ?? false
            let ringing = (t.finished || expired) && !t.acknowledged
            let running = t.endsAt != nil && !expired
            let paused = t.endsAt == nil && !t.finished && t.remainingMs > 0 && t.remainingMs < t.durationMs
            guard ringing || running || paused else { continue }
            live.append(LiveTimer(stepId: s.id, step: n + 1, label: CookLiveActivity.label(s.text),
                                  duration: Double(t.durationMs) / 1000, endsAt: ringing ? nil : t.endsAt,
                                  remaining: ringing ? 0 : Double(t.remaining(now: now)) / 1000, ringing: ringing))
        }
        func rank(_ t: LiveTimer) -> Int { t.ringing ? 0 : t.running ? 1 : 2 }
        live.sort { a, b in
            if rank(a) != rank(b) { return rank(a) < rank(b) }
            if let x = a.endsAt, let y = b.endsAt { return x < y }
            return a.step < b.step
        }
        let top = live.first
        let othersRunning = live.dropFirst().filter { $0.running || $0.ringing }.count
        let hasOwn = live.contains { $0.stepId == step.id }
        let text = step.text.count > 280 ? String(step.text.prefix(279)) + "…" : step.text
        return CookActivityAttributes.ContentState(step: i + 1, stepCount: steps.count, stepText: Safety.withFahrenheit(text), stepId: step.id,
                                                   stepTimerMinutes: hasOwn ? nil : step.timerMinutes, timer: top,
                                                   moreTimers: othersRunning, servings: people ?? servings ?? 2)
    }
}

/// Timers keyed by step id. Accurate via wall clock, independent of tick rate.
/// Rings until dismissed, and posts a local notification so a locked phone still hears it.
@MainActor
@Observable
final class Timers {
    private(set) var states: [String: TimerState] = [:]
    private(set) var now = Date()
    private var ticker: Task<Void, Never>?
    var onChange: (() -> Void)?

    init(states: [String: TimerState] = [:]) {
        self.states = states
        // Anything that ended while the app was away is finished now.
        let n = Date()
        for (id, t) in self.states where t.endsAt != nil && t.endsAt! <= n {
            self.states[id] = TimerState(durationMs: t.durationMs, remainingMs: 0, endsAt: nil, finished: true)
        }
        // Keep ringing for anything that finished while away, and counting for anything still running.
        if anyRunning || anyRinging { tick() }
    }

    func state(for id: String) -> TimerState? { states[id] }
    var anyRunning: Bool { states.values.contains { $0.endsAt != nil } }
    var anyRinging: Bool { states.values.contains { $0.finished && !$0.acknowledged } }

    func start(_ id: String, minutes: Double, label: String) {
        var t = states[id] ?? TimerState(durationMs: Int(minutes * 60_000), remainingMs: Int(minutes * 60_000), endsAt: nil, finished: false)
        guard t.endsAt == nil else { return }
        let rem = t.finished || t.remainingMs <= 0 ? t.durationMs : t.remainingMs
        t.remainingMs = rem
        t.endsAt = Date().addingTimeInterval(Double(rem) / 1000)
        t.finished = false
        t.acknowledged = false
        states[id] = t
        Notifications.schedule(id: id, at: t.endsAt!, body: label)
        tick()
        onChange?()
    }

    func pause(_ id: String) {
        guard var t = states[id], let end = t.endsAt else { return }
        t.remainingMs = max(0, Int(end.timeIntervalSinceNow * 1000))
        t.endsAt = nil
        states[id] = t
        Notifications.cancel(id: id)
        onChange?()
    }

    func reset(_ id: String) {
        guard var t = states[id] else { return }
        t.remainingMs = t.durationMs; t.endsAt = nil; t.finished = false; t.acknowledged = true
        states[id] = t
        Notifications.cancel(id: id)
        onChange?()
    }

    func acknowledge(_ id: String) {
        guard var t = states[id] else { return }
        t.acknowledged = true
        states[id] = t
        onChange?()
    }

    func stop() { ticker?.cancel(); ticker = nil }

    private func tick() {
        guard ticker == nil else { return }
        ticker = Task { [weak self] in
            var lastRing = Date.distantPast
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                guard let self else { return }
                let n = Date()
                self.now = n
                var changed = false
                for (id, t) in self.states where t.endsAt != nil && t.endsAt! <= n {
                    self.states[id] = TimerState(durationMs: t.durationMs, remainingMs: 0, endsAt: nil, finished: true)
                    changed = true
                }
                if changed { self.onChange?() }
                // Ring every two seconds until someone taps the timer.
                if self.anyRinging, n.timeIntervalSince(lastRing) >= 2 {
                    AudioServicesPlayAlertSound(SystemSoundID(1005))
                    Haptic.success()
                    lastRing = n
                }
                if !self.anyRunning && !self.anyRinging { self.ticker = nil; return }
            }
        }
    }
}

/// Local notifications for timers that end while the phone is locked.
enum Notifications {
    static func requestOnce(asked: Bool, markAsked: @escaping () -> Void) {
        guard !asked else { return }
        markAsked()
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    static func schedule(id: String, at date: Date, body: String) {
        let content = UNMutableNotificationContent()
        content.title = "Timer's up"
        content.body = body
        content.sound = .default
        let seconds = max(1, date.timeIntervalSinceNow)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "timer-\(id)", content: content, trigger: trigger))
    }

    static func cancel(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["timer-\(id)"])
    }

    /// Timers are the only notifications Plantry schedules.
    static func cancelAll() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
}

func formatClock(_ ms: Int) -> String {
    let s = Int((Double(ms) / 1000).rounded(.up))
    return String(format: "%d:%02d", s / 60, s % 60)
}
