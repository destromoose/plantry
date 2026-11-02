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

    static let key = "plantry-cook"
    static let maxAge: TimeInterval = 12 * 60 * 60

    static func load(recipeId: String? = nil) -> CookSession? {
        guard let data = UserDefaults.standard.data(forKey: key), let s = try? JSONDecoder().decode(CookSession.self, from: data) else { return nil }
        if Date().timeIntervalSince(s.savedAt) > maxAge { clear(); return nil }
        if let recipeId, s.recipeId != recipeId { return nil }
        return s
    }

    func save() {
        var s = self
        s.savedAt = Date()
        if let data = try? JSONEncoder().encode(s) { UserDefaults.standard.set(data, forKey: Self.key) }
    }

    static func clear() { UserDefaults.standard.removeObject(forKey: key) }
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
        if self.states.values.contains(where: { $0.endsAt != nil }) { tick() }
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
}

func formatClock(_ ms: Int) -> String {
    let s = Int((Double(ms) / 1000).rounded(.up))
    return String(format: "%d:%02d", s / 60, s % 60)
}
