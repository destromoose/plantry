import SwiftUI
import SwiftData
import AudioToolbox

/// Immersive, one step at a time. Swipe or tap to move, timers run per step,
/// the screen stays awake, and finishing updates the pantry and the plan.
struct CookModeView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(Navigator.self) private var nav
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Environment(\.plantryReduceMotion) private var reduce
    @Query private var recipes: [RecipeModel]
    var request: CookRequest

    @State private var index = 0
    @State private var dir: CGFloat = 1
    @State private var drag: CGFloat = 0
    @State private var ingOpen = false
    @State private var finishOpen = false
    @State private var checked: Set<String> = []
    @State private var usePantry = true
    @State private var leftovers = false
    @State private var timers = Timers()

    private var recipe: RecipeModel? { recipes.first { $0.id == request.recipeId } }
    private var entry: PlanEntryModel? { request.date.flatMap { store.dinner(on: $0) } }

    var body: some View {
        ZStack {
            AmbientBackground()
            if let recipe, !recipe.steps.isEmpty {
                content(recipe)
            } else {
                EmptyState(systemImage: "fork.knife", title: recipe == nil ? "That recipe isn't here" : "No steps yet", body: recipe == nil ? "It may have been deleted, or the link is off." : "Add some steps to cook along.") {
                    Button("Back") { dismiss() }.pbutton()
                }
                .padding(20)
            }
        }
        .foregroundStyle(t.ink)
        .preferredColorScheme(t.colorScheme)
        .onAppear {
            leftovers = recipe?.leftovers ?? false
            #if canImport(UIKit)
            UIApplication.shared.isIdleTimerDisabled = true
            #endif
        }
        .onDisappear {
            timers.stop()
            #if canImport(UIKit)
            UIApplication.shared.isIdleTimerDisabled = false
            #endif
        }
    }

    private func content(_ recipe: RecipeModel) -> some View {
        let steps = recipe.steps
        let last = steps.count - 1
        let step = steps[min(index, last)]
        let active = steps.enumerated().filter { timers.state(for: $0.element.id).map { $0.endsAt != nil || $0.finished } ?? false }

        return VStack(spacing: 0) {
            // Header: close, progress, running timers
            VStack(spacing: 12) {
                HStack {
                    Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).iconButton() }
                        .accessibilityLabel("Close cook mode")
                    Spacer()
                    Text(recipe.title).font(Type.display(16)).lineLimit(1)
                    Spacer()
                    Color.clear.frame(width: 44, height: 44)
                }
                HStack(spacing: 4) {
                    ForEach(steps.indices, id: \.self) { i in
                        Capsule().fill(i <= index ? t.accent : t.line).frame(height: 4)
                    }
                }
                .motion(Motion.settle, value: index)
                .accessibilityHidden(true)
                if !active.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(active, id: \.element.id) { i, s in
                                let st = timers.state(for: s.id)!
                                Button { go(i) } label: {
                                    Text("Step \(i + 1) · \(st.finished ? "done" : formatClock(st.remaining(now: timers.now)))")
                                        .font(.system(size: 13, weight: .medium)).monospacedDigit()
                                        .foregroundStyle(st.finished ? Theme.cream : t.accentInk)
                                        .padding(.horizontal, 12).frame(height: 34)
                                        .background(st.finished ? Theme.danger : t.accent, in: Capsule())
                                }
                                .transition(.scale.combined(with: .opacity))
                            }
                        }
                    }
                    .motion(Motion.settle, value: active.map(\.element.id))
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            // The step
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Eyebrow(text: "Step \(index + 1) of \(steps.count)")
                    Text(step.text).font(Type.display(28, weight: .medium)).lineSpacing(2)
                    if let m = step.timerMinutes {
                        StepTimerView(minutes: m, state: timers.state(for: step.id), now: timers.now,
                                      onStart: { timers.start(step.id, minutes: m) }, onPause: { timers.pause(step.id) }, onReset: { timers.reset(step.id) })
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 28)
                .frame(maxWidth: .infinity, alignment: .leading)
                .id(step.id)
                .offset(x: drag)
                .transition(.asymmetric(insertion: .offset(x: dir * 48).combined(with: .opacity), removal: .offset(x: dir * -48).combined(with: .opacity)))
                .accessibilityLabel("Step \(index + 1) of \(steps.count). \(step.text)")
            }
            .motion(Motion.settle, value: index)
            .simultaneousGesture(
                DragGesture(minimumDistance: 16)
                    .onChanged { v in if abs(v.translation.width) > abs(v.translation.height) { drag = v.translation.width * 0.25 } }
                    .onEnded { v in
                        withAnimation(Motion.settle) { drag = 0 }
                        guard abs(v.translation.width) > abs(v.translation.height) else { return }
                        if v.translation.width < -80 || v.predictedEndTranslation.width < -200 { next(last) }
                        else if v.translation.width > 80 || v.predictedEndTranslation.width > 200 { prev() }
                    }
            )

            // Footer
            HStack(spacing: 10) {
                Button { ingOpen = true } label: { Label("Ingredients", systemImage: "list.bullet") }.pbutton(.glass, .lg)
                Spacer()
                Button { prev() } label: { Image(systemName: "chevron.left").frame(width: 52, height: 52) }.pbutton(.glass, .icon).disabled(index == 0).accessibilityLabel("Previous step")
                if index == last {
                    Button("Done") { next(last) }.pbutton(.primary, .lg)
                } else {
                    Button { next(last) } label: { Image(systemName: "chevron.right").frame(width: 52, height: 52) }.pbutton(.primary, .icon).accessibilityLabel("Next step")
                }
            }
            .padding(20)
        }
        .sheet(isPresented: $ingOpen) {
            SheetChrome(title: "Ingredients") {
                VStack(spacing: 4) {
                    ForEach(recipe.ingredients) { ing in
                        let on = checked.contains(ing.id)
                        Button {
                            if on { checked.remove(ing.id) } else { checked.insert(ing.id) }
                            Haptic.tap()
                        } label: {
                            HStack(spacing: 12) {
                                ZStack {
                                    Circle().fill(on ? t.secondary : .clear)
                                    Circle().strokeBorder(on ? .clear : t.ink3, lineWidth: 1.5)
                                    if on { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(t.secondaryInk).transition(.scale) }
                                }
                                .frame(width: 26, height: 26)
                                .motion(Motion.checkPop, value: on)
                                Text(ing.name + (ing.isOptional ? " (optional)" : "")).font(Type.body).strikethrough(on, color: t.ink3).foregroundStyle(on ? t.ink3 : t.ink)
                                Spacer()
                                Text(formatQuantity(ing.quantity, ing.unit)).font(Type.small).foregroundStyle(t.ink2)
                            }
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(on ? [.isSelected] : [])
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $finishOpen) {
            SheetChrome(title: nil) {
                VStack(alignment: .leading, spacing: 16) {
                    Image(systemName: "checkmark").font(.system(size: 22, weight: .bold)).foregroundStyle(t.secondaryInk)
                        .frame(width: 56, height: 56).background(t.secondary, in: Circle())
                        .transition(.scale)
                    Text("That's dinner.").font(Type.title)
                    if request.date != nil && entry != nil {
                        Toggle(isOn: $usePantry) { Text("Use up the fresh stuff from my pantry").font(Type.body) }.tint(t.accent)
                        Toggle(isOn: $leftovers) { Text("There are leftovers").font(Type.body) }.tint(t.accent)
                    }
                    Button(request.date != nil && entry != nil ? "Finish" : "Back to the recipe") { finish() }.pbutton(.primary, .lg, fill: true)
                }
            }
            .presentationDetents([.medium])
        }
    }

    private func go(_ to: Int) {
        guard let count = recipe?.steps.count else { return }
        let n = clamp(to, 0, count - 1)
        if n != index { dir = n > index ? 1 : -1 }
        withAnimation(reduce ? nil : Motion.settle) { index = n }
    }

    private func next(_ last: Int) {
        if index >= last { finishOpen = true } else { go(index + 1) }
        Haptic.tap()
    }

    private func prev() { go(index - 1) }

    private func finish() {
        finishOpen = false
        if let date = request.date, entry != nil {
            store.markCooked(date, leftovers: leftovers, usePantry: usePantry)
            ctxProvider.refresh()
            Haptic.success()
            toaster.show("Nice work.")
            nav.go(.tonight)
            nav.popToRoot()
        }
        dismiss()
    }
}

func formatClock(_ ms: Int) -> String {
    let s = Int((Double(ms) / 1000).rounded(.up))
    return String(format: "%d:%02d", s / 60, s % 60)
}

// MARK: - Timers

struct TimerState {
    var durationMs: Int
    /// Remaining time while paused or idle.
    var remainingMs: Int
    /// Wall-clock end while running, else nil.
    var endsAt: Date?
    var finished: Bool

    func remaining(now: Date) -> Int {
        if let endsAt { return max(0, Int(endsAt.timeIntervalSince(now) * 1000)) }
        return remainingMs
    }
}

/// Timers keyed by step id. Accurate via wall clock, independent of tick rate.
@MainActor
@Observable
final class Timers {
    private(set) var states: [String: TimerState] = [:]
    private(set) var now = Date()
    private var ticker: Task<Void, Never>?

    func state(for id: String) -> TimerState? { states[id] }

    func start(_ id: String, minutes: Int) {
        var t = states[id] ?? TimerState(durationMs: minutes * 60_000, remainingMs: minutes * 60_000, endsAt: nil, finished: false)
        guard t.endsAt == nil else { return }
        let rem = t.finished || t.remainingMs <= 0 ? t.durationMs : t.remainingMs
        t.remainingMs = rem
        t.endsAt = Date().addingTimeInterval(Double(rem) / 1000)
        t.finished = false
        states[id] = t
        tick()
    }

    func pause(_ id: String) {
        guard var t = states[id], let end = t.endsAt else { return }
        t.remainingMs = max(0, Int(end.timeIntervalSinceNow * 1000))
        t.endsAt = nil
        states[id] = t
    }

    func reset(_ id: String) {
        guard var t = states[id] else { return }
        t.remainingMs = t.durationMs; t.endsAt = nil; t.finished = false
        states[id] = t
    }

    func stop() { ticker?.cancel(); ticker = nil }

    private func tick() {
        guard ticker == nil else { return }
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                guard let self else { return }
                let n = Date()
                self.now = n
                var rang = false
                for (id, t) in self.states where t.endsAt != nil && t.endsAt! <= n {
                    self.states[id] = TimerState(durationMs: t.durationMs, remainingMs: 0, endsAt: nil, finished: true)
                    rang = true
                }
                if rang {
                    AudioServicesPlayAlertSound(SystemSoundID(1005))
                    Haptic.success()
                }
                if !self.states.values.contains(where: { $0.endsAt != nil }) { self.ticker = nil; return }
            }
        }
    }
}

struct StepTimerView: View {
    @Environment(\.theme) private var t
    var minutes: Int
    var state: TimerState?
    var now: Date
    var onStart: () -> Void
    var onPause: () -> Void
    var onReset: () -> Void

    var body: some View {
        let total = minutes * 60_000
        let remaining = state?.remaining(now: now) ?? total
        let running = state?.endsAt != nil
        let finished = state?.finished ?? false
        HStack(spacing: 16) {
            ProgressRing(value: 1 - Double(remaining) / Double(total), size: 72, stroke: 6, tone: finished ? .danger : .accent) {
                Text(formatClock(remaining)).font(Type.display(18)).monospacedDigit()
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(finished ? "Time's up" : running ? "Running" : "\(minutes) minute timer").font(Type.label)
                HStack(spacing: 8) {
                    if running {
                        Button("Pause", action: onPause).pbutton(.secondary, .sm)
                    } else {
                        Button(finished ? "Again" : state == nil || remaining == total ? "Start" : "Resume", action: onStart).pbutton(.primary, .sm)
                    }
                    if state != nil && !running { Button("Reset", action: onReset).pbutton(.ghost, .sm) }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .card()
        .accessibilityElement(children: .contain)
    }
}
