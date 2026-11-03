import ActivityKit
import Foundation

// Keeps the cook-mode Live Activity in step with the saved cook session. It
// starts when cook mode opens, follows every step and timer change, and ends
// when the dinner is finished, the session expires, or cook mode is opened
// and closed again without starting.
//
// All local updates: nothing here needs push or a paid developer account.

extension Notification.Name {
    /// A Live Activity button changed the saved cook session; cook mode reloads it.
    static let plantryCookRemote = Notification.Name("plantryCookRemote")
}

@MainActor
enum CookLiveActivity {
    /// Updates run one after another, so a quick double tap can't land out of order.
    private static var queue: Task<Void, Never>?

    private static var current: [Activity<CookActivityAttributes>] {
        Activity<CookActivityAttributes>.activities.filter { $0.activityState == .active || $0.activityState == .stale }
    }

    /// Bring the Live Activity in line with `session`. Only cook mode (`live`)
    /// may start one or make a finished timer alert; everything else updates
    /// what is already there.
    @discardableResult
    static func sync(_ session: CookSession, live: Bool) -> Task<Void, Never> {
        enqueue { await apply(session, live: live) }
    }

    @discardableResult
    static func end() -> Task<Void, Never> {
        enqueue {
            for activity in Activity<CookActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    /// At launch and on foreground: match the session, or end a leftover activity.
    static func reconcile() {
        if let session = CookSession.load() { sync(session, live: false) } else { end() }
    }

    /// A few words from a step for a timer's name: "Simmer the sauce".
    static func label(_ text: String) -> String {
        text.split(separator: " ").prefix(3).joined(separator: " ").trimmingCharacters(in: .punctuationCharacters)
    }

    private static func enqueue(_ work: @escaping @MainActor () async -> Void) -> Task<Void, Never> {
        let previous = queue
        let task = Task { @MainActor in
            await previous?.value
            await work()
        }
        queue = task
        return task
    }

    private static func apply(_ session: CookSession, live: Bool) async {
        guard let state = session.liveState(), let title = session.title else {
            for activity in Activity<CookActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            return
        }
        let mine = current.first { $0.attributes.recipeId == session.recipeId }
        for other in Activity<CookActivityAttributes>.activities where other.id != mine?.id {
            await other.end(nil, dismissalPolicy: .immediate)
        }
        let ringing = state.timer?.ringing == true
        let content = ActivityContent(state: state, staleDate: nil, relevanceScore: ringing ? 100 : 50)

        if let mine {
            guard mine.content.state != state else { return }
            let wasRinging = mine.content.state.timer?.ringing == true
            var alert: AlertConfiguration?
            if live, ringing, !wasRinging, let t = state.timer {
                alert = AlertConfiguration(title: "Time's up", body: "\(t.label) · step \(t.step)", sound: .default)
            }
            await mine.update(content, alertConfiguration: alert)
        } else if live, ActivityAuthorizationInfo().areActivitiesEnabled {
            let attributes = CookActivityAttributes(recipeId: session.recipeId, recipeTitle: title)
            _ = try? Activity.request(attributes: attributes, content: content, pushType: nil)
        }
    }
}

/// Runs the Live Activity buttons. The intents run in the app's process, even
/// when Plantry is in the background or not running, and work on the saved
/// session; cook mode, if it's open, picks the change up straight away.
@MainActor
enum CookCommandHandler {
    static func handle(_ command: CookCommand) async {
        guard var session = CookSession.load(), let steps = session.steps, !steps.isEmpty else {
            await CookLiveActivity.end().value
            return
        }
        switch command {
        case .step(let delta):
            session.index = min(max(session.index + delta, 0), steps.count - 1)
        case .timer(let id):
            session.toggleTimer(id)
        }
        session.save(syncActivity: false)
        NotificationCenter.default.post(name: .plantryCookRemote, object: nil)
        await CookLiveActivity.sync(session, live: false).value
    }
}
