import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// Cook mode on the Lock Screen and in the Dynamic Island. Built the way the
// system Timer and Maps do it: the clock ticks on its own, the compact view is
// an icon and a number, the expanded view adds the step and a couple of big
// buttons, and a finished timer turns red until someone taps Stop.

private enum Palette {
    /// The Island is always black, so it gets the night accent and cream ink.
    static let amber = Color(red: 233 / 255, green: 162 / 255, blue: 59 / 255)
    static let terracotta = Color(red: 174 / 255, green: 74 / 255, blue: 41 / 255)
    static let cream = Color(red: 250 / 255, green: 244 / 255, blue: 234 / 255)
    static let cocoa = Color(red: 42 / 255, green: 31 / 255, blue: 26 / 255)
    static let plum = Color(red: 30 / 255, green: 22 / 255, blue: 32 / 255)
    static let ring = Color(red: 235 / 255, green: 87 / 255, blue: 70 / 255)
}

struct CookLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CookActivityAttributes.self) { context in
            CookLockScreenView(title: context.attributes.recipeTitle, state: context.state)
        } dynamicIsland: { context in
            let state = context.state
            let tint = state.timer?.ringing == true ? Palette.ring : Palette.amber
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    TimerGlyph(timer: state.timer, size: 44, tint: tint, idleIcon: "frying.pan.fill")
                        .padding(.leading, 4)
                        .padding(.top, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let timer = state.timer {
                        VStack(alignment: .trailing, spacing: 0) {
                            Countdown(timer: timer)
                                .font(.system(size: 30, weight: .semibold, design: .rounded))
                                .foregroundStyle(tint)
                            Text(timer.ringing ? "Time's up" : timer.paused ? "Paused" : "Step \(timer.step)")
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(Palette.cream.opacity(0.6))
                        }
                        .padding(.trailing, 4)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 1) {
                        Text("Step \(state.step) of \(state.stepCount)")
                            .font(.caption2.weight(.semibold))
                            .textCase(.uppercase)
                            .kerning(0.8)
                            .foregroundStyle(Palette.cream.opacity(0.6))
                        Text(context.attributes.recipeTitle)
                            .font(.system(size: 15, weight: .semibold, design: .serif))
                            .foregroundStyle(Palette.cream)
                            .lineLimit(1)
                    }
                    .padding(.top, 2)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(state.stepText)
                            .font(.system(size: 14))
                            .foregroundStyle(Palette.cream.opacity(0.85))
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        CookControls(state: state, ink: Palette.cream, accent: tint, onAccent: Palette.cocoa, height: 38)
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 2)
                }
            } compactLeading: {
                TimerGlyph(timer: state.timer, size: 22, tint: tint, idleIcon: "frying.pan.fill")
                    .padding(.leading, 2)
            } compactTrailing: {
                if let timer = state.timer {
                    Countdown(timer: timer)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(timer.paused ? Palette.cream.opacity(0.6) : tint)
                        .frame(maxWidth: 52, alignment: .trailing)
                } else {
                    Text("\(state.step)/\(state.stepCount)")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Palette.amber)
                }
            } minimal: {
                TimerGlyph(timer: state.timer, size: 22, tint: tint, idleIcon: "frying.pan.fill")
            }
            .widgetURL(WidgetSnapshot.openCook)
            .keylineTint(tint)
        }
    }
}

// MARK: - Lock Screen

struct CookLockScreenView: View {
    @Environment(\.colorScheme) private var scheme
    var title: String
    var state: CookActivityAttributes.ContentState

    private var dark: Bool { scheme == .dark }
    private var ink: Color { dark ? Palette.cream : Palette.cocoa }
    private var accent: Color { state.timer?.ringing == true ? Palette.ring : (dark ? Palette.amber : Palette.terracotta) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 10) {
                TimerGlyph(timer: state.timer, size: 34, tint: accent, idleIcon: "frying.pan.fill")
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold, design: .serif))
                        .lineLimit(1)
                    Text(caption)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(ink.opacity(0.62))
                        .lineLimit(1)
                }
                Spacer(minLength: 6)
                if let timer = state.timer {
                    Countdown(timer: timer)
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                        .foregroundStyle(timer.paused ? ink.opacity(0.55) : accent)
                        .frame(maxWidth: 110, alignment: .trailing)
                }
            }
            Text(state.stepText)
                .font(.system(size: 14))
                .foregroundStyle(ink.opacity(0.85))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            CookControls(state: state, ink: ink, accent: accent, onAccent: dark ? Palette.cocoa : Palette.cream, height: 32)
        }
        .foregroundStyle(ink)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .activityBackgroundTint(dark ? Palette.plum.opacity(0.92) : Palette.cream.opacity(0.94))
        .activitySystemActionForegroundColor(ink)
        .widgetURL(WidgetSnapshot.openCook)
    }

    private var caption: String {
        var parts = ["Step \(state.step) of \(state.stepCount)", "for \(state.servings)"]
        if let timer = state.timer {
            parts = ["Step \(state.step) of \(state.stepCount)"]
            parts.append(timer.ringing ? "\(timer.label) is done" : timer.paused ? "\(timer.label), paused" : timer.label)
            if state.moreTimers > 0 { parts.append("+\(state.moreTimers) more") }
        }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Pieces

/// Back, the timer, and Next (or Finish on the last step). Each runs in the app
/// without opening it, except Finish, which opens cook mode to log the dinner.
struct CookControls: View {
    var state: CookActivityAttributes.ContentState
    var ink: Color
    var accent: Color
    var onAccent: Color
    var height: CGFloat

    var body: some View {
        HStack(spacing: 8) {
            if state.step > 1 {
                Button(intent: CookStepIntent(forward: false)) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: height, height: height)
                        .background(ink.opacity(0.12), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Previous step")
            }
            if let action = timerAction {
                Button(intent: CookTimerIntent(stepId: action.stepId)) {
                    Label(action.title, systemImage: action.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .labelStyle(.titleAndIcon)
                        .lineLimit(1)
                        .padding(.horizontal, 14)
                        .frame(height: height)
                        .foregroundStyle(action.ringing ? onAccent : accent)
                        .background(action.ringing ? accent : accent.opacity(0.18), in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(action.spoken)
            }
            Spacer(minLength: 0)
            if state.step >= state.stepCount {
                Link(destination: WidgetSnapshot.openCook) {
                    Label("Finish", systemImage: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .padding(.horizontal, 16)
                        .frame(height: height)
                        .foregroundStyle(onAccent)
                        .background(accent, in: Capsule())
                }
                .accessibilityLabel("Finish cooking in Plantry")
            } else {
                Button(intent: CookStepIntent(forward: true)) {
                    HStack(spacing: 4) {
                        Text("Next")
                        Image(systemName: "chevron.right")
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .padding(.horizontal, 16)
                    .frame(height: height)
                    .foregroundStyle(onAccent)
                    .background(accent, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Next step")
            }
        }
    }

    private struct TimerAction {
        var stepId: String
        var title: String
        var icon: String
        var spoken: String
        var ringing = false
    }

    /// The timer on screen wins; otherwise offer to start the current step's.
    private var timerAction: TimerAction? {
        if let t = state.timer {
            if t.ringing { return TimerAction(stepId: t.stepId, title: "Stop", icon: "bell.slash.fill", spoken: "Stop the \(t.label) timer", ringing: true) }
            if t.running { return TimerAction(stepId: t.stepId, title: "Pause", icon: "pause.fill", spoken: "Pause the \(t.label) timer") }
            return TimerAction(stepId: t.stepId, title: "Resume", icon: "play.fill", spoken: "Resume the \(t.label) timer")
        }
        if let m = state.stepTimerMinutes {
            return TimerAction(stepId: state.stepId, title: "\(m) min", icon: "timer", spoken: "Start a \(m) minute timer")
        }
        return nil
    }
}

/// A ring that drains as the timer runs, with an icon inside. Static when paused,
/// full and red when ringing, a pan when nothing is timing.
struct TimerGlyph: View {
    var timer: LiveTimer?
    var size: CGFloat
    var tint: Color
    var idleIcon: String

    var body: some View {
        let line = max(2, size * 0.1)
        ZStack {
            if let timer {
                if timer.running {
                    ProgressView(timerInterval: timer.interval, countsDown: true) {
                        EmptyView()
                    } currentValueLabel: {
                        EmptyView()
                    }
                    .progressViewStyle(.circular)
                    .tint(tint)
                } else {
                    Circle().stroke(tint.opacity(0.25), lineWidth: line)
                    Circle()
                        .trim(from: 0, to: timer.ringing ? 1 : max(0.02, timer.remaining / max(timer.duration, 1)))
                        .stroke(tint, style: StrokeStyle(lineWidth: line, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                Image(systemName: timer.ringing ? "bell.fill" : timer.paused ? "pause.fill" : "timer")
                    .font(.system(size: size * 0.38, weight: .semibold))
                    .foregroundStyle(tint)
            } else {
                Image(systemName: idleIcon)
                    .font(.system(size: size * 0.55, weight: .semibold))
                    .foregroundStyle(tint)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// The time left: ticking on its own while running, fixed when paused, 0:00 when done.
struct Countdown: View {
    var timer: LiveTimer

    var body: some View {
        Group {
            if timer.running {
                Text(timerInterval: timer.interval, countsDown: true)
            } else {
                Text(timer.ringing ? "0:00" : timer.remainingText)
            }
        }
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
}

// MARK: - Previews

extension CookActivityAttributes {
    static let preview = CookActivityAttributes(recipeId: "preview", recipeTitle: "Lemony chickpea skillet")
}

extension CookActivityAttributes.ContentState {
    static let previewStep = CookActivityAttributes.ContentState(
        step: 2, stepCount: 6, stepText: "Add the garlic and cumin and stir for a minute, until it smells toasty.",
        stepId: "s2", stepTimerMinutes: 12, timer: nil, moreTimers: 0, servings: 4)
    static let previewTimer = CookActivityAttributes.ContentState(
        step: 3, stepCount: 6, stepText: "Tip in the chickpeas and tomatoes, cover and simmer until thick.",
        stepId: "s3", stepTimerMinutes: nil,
        timer: LiveTimer(stepId: "s3", step: 3, label: "Tip in the", duration: 720, endsAt: Date().addingTimeInterval(512), remaining: 512, ringing: false),
        moreTimers: 0, servings: 4)
}

#Preview("Lock Screen", as: .content, using: CookActivityAttributes.preview) {
    CookLiveActivityWidget()
} contentStates: {
    CookActivityAttributes.ContentState.previewStep
    CookActivityAttributes.ContentState.previewTimer
}

#Preview("Island expanded", as: .dynamicIsland(.expanded), using: CookActivityAttributes.preview) {
    CookLiveActivityWidget()
} contentStates: {
    CookActivityAttributes.ContentState.previewTimer
}

#Preview("Island compact", as: .dynamicIsland(.compact), using: CookActivityAttributes.preview) {
    CookLiveActivityWidget()
} contentStates: {
    CookActivityAttributes.ContentState.previewTimer
    CookActivityAttributes.ContentState.previewStep
}
