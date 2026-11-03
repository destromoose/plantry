import SwiftUI
import SwiftData

/// Immersive, one step at a time. Swipe or tap to move, timers run per step and
/// keep ringing until tapped, the screen stays awake, progress survives leaving,
/// and finishing updates the pantry, the list and the plan.
struct CookModeView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(Navigator.self) private var nav
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Environment(\.plantryReduceMotion) private var reduce
    @Query private var recipes: [RecipeModel]
    @Query private var settingsRows: [SettingsModel]
    var request: CookRequest

    @State private var index = 0
    @State private var dir: CGFloat = 1
    @State private var drag: CGFloat = 0
    @State private var ingOpen = false
    @State private var finishOpen = false
    @State private var leaveOpen = false
    @State private var checked: Set<String> = []
    @State private var people: Int?
    @State private var usePantry = true
    @State private var leftovers = false
    @State private var replaceTomorrow = false
    @State private var timers = Timers()
    @State private var loaded = false
    @State private var resumed = false

    private var recipe: RecipeModel? { recipes.first { $0.id == request.recipeId } }
    /// The night this cook belongs to: the one it was opened for, else Tonight's target.
    private var cookDate: String { request.date ?? ctxProvider.context.targetDate }
    private var entry: PlanEntryModel? { store.dinner(on: cookDate) }
    private var settings: SettingsModel? { settingsRows.first }
    private var kids: Bool { settings?.cookingWithKids ?? false }
    /// Done already when the night is marked cooked, or (from a recipe page) that night was cooked with this very recipe.
    private var alreadyDone: Bool {
        guard let entry, entry.done else { return false }
        return request.date != nil || entry.recipeId == request.recipeId
    }

    /// One servings number, in order: changed here, passed in, the plan, the household.
    private var count: Int {
        guard let recipe else { return 2 }
        return people ?? request.servings ?? entry?.servings ?? settings?.cookingFor ?? recipe.servings
    }

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
        .onAppear { load() }
        .onDisappear {
            timers.stop()
            #if canImport(UIKit)
            UIApplication.shared.isIdleTimerDisabled = false
            #endif
        }
        .onChange(of: index) { persist() }
        .onChange(of: checked) { persist() }
        .onChange(of: people) { persist() }
        .onReceive(NotificationCenter.default.publisher(for: .plantryCookRemote)) { _ in adoptRemoteChange() }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        leftovers = recipe?.leftovers ?? false
        #if canImport(UIKit)
        UIApplication.shared.isIdleTimerDisabled = true
        #endif
        if let saved = CookSession.load(recipeId: request.recipeId) {
            index = clamp(saved.index, 0, max(0, (recipe?.steps.count ?? 1) - 1))
            people = saved.servings
            checked = Set(saved.checked)
            timers = Timers(states: saved.timers)
            resumed = saved.index > 0 || !saved.timers.isEmpty
            if resumed { toaster.show("Picked up where you left off.") }
        }
        timers.onChange = { persist() }
        // Timers can be started from the Lock Screen or the Dynamic Island, where
        // Plantry can't ask for notifications, so ask here for recipes that have one.
        if recipe?.steps.contains(where: { $0.timerMinutes != nil }) == true {
            Notifications.requestOnce(asked: settings?.askedNotifications ?? false) { store.update { $0.askedNotifications = true } }
        }
        // Save straight away so the widget and the Live Activity show the step as soon as cooking starts.
        persist()
    }

    private func persist(live: Bool = true) {
        guard let recipe else { return }
        CookSession(recipeId: recipe.id, date: request.date, index: index, servings: people, checked: Array(checked), timers: timers.states,
                    title: recipe.title, steps: recipe.steps, people: count)
            .save(live: live)
    }

    /// A button on the Lock Screen or in the Dynamic Island moved the step or
    /// touched a timer while cook mode was open: follow it.
    private func adoptRemoteChange() {
        guard let saved = CookSession.load(recipeId: request.recipeId) else { return }
        if saved.timers != timers.states {
            timers.stop()
            timers = Timers(states: saved.timers)
            timers.onChange = { persist() }
        }
        let n = clamp(saved.index, 0, max(0, (recipe?.steps.count ?? 1) - 1))
        if n != index { go(n) }
    }

    private func content(_ recipe: RecipeModel) -> some View {
        let steps = recipe.steps
        let last = steps.count - 1
        let step = steps[min(index, last)]
        let scale = Double(count) / Double(max(recipe.servings, 1))
        let active = steps.enumerated().filter { timers.state(for: $0.element.id).map { $0.endsAt != nil || ($0.finished && !$0.acknowledged) || ($0.endsAt == nil && $0.remainingMs < $0.durationMs && !$0.finished) } ?? false }
        let cautions = Safety.cautions(for: step.text, own: step.caution)

        return VStack(spacing: 0) {
            VStack(spacing: 12) {
                HStack {
                    Button { leaveOrClose() } label: { Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).iconButton() }
                        .accessibilityLabel("Close cook mode")
                    Spacer()
                    VStack(spacing: 1) {
                        Text(recipe.title).font(Type.display(16)).lineLimit(1)
                        Text("For \(count) · screen stays on").font(.system(size: 11)).foregroundStyle(t.ink3)
                    }
                    Spacer()
                    Color.clear.frame(width: 44, height: 44)
                }
                HStack(spacing: 4) {
                    ForEach(steps.indices, id: \.self) { i in Capsule().fill(i <= index ? t.accent : t.line).frame(height: 4) }
                }
                .motion(Motion.settle, value: index)
                .accessibilityHidden(true)
                if !active.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(active, id: \.element.id) { i, s in
                                let st = timers.state(for: s.id)!
                                let ringing = st.finished && !st.acknowledged
                                Button {
                                    if ringing { timers.acknowledge(s.id) }
                                    go(i)
                                } label: {
                                    Text("\(stepWords(s.text)) · \(st.finished ? "done" : st.endsAt == nil ? "paused \(formatClock(st.remainingMs))" : formatClock(st.remaining(now: timers.now)))")
                                        .font(.system(size: 13, weight: .medium)).monospacedDigit().lineLimit(1)
                                        .foregroundStyle(ringing ? Theme.cream : t.accentInk)
                                        .padding(.horizontal, 12).frame(height: 36)
                                        .background(ringing ? Theme.danger : (st.endsAt == nil ? t.accent.opacity(0.6) : t.accent), in: Capsule())
                                }
                                .accessibilityLabel(ringing ? "Timer for \(stepWords(s.text)) finished. Tap to dismiss." : "Timer for \(stepWords(s.text)), \(formatClock(st.remaining(now: timers.now))) left. Go to step.")
                                .transition(.scale.combined(with: .opacity))
                            }
                        }
                    }
                    .motion(Motion.settle, value: active.map(\.element.id))
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Eyebrow(text: "Step \(index + 1) of \(steps.count)")
                    Text(Safety.withFahrenheit(step.text)).font(Type.display(28, weight: .medium)).lineSpacing(2)
                    if !cautions.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(cautions) { c in
                                Label(c.note, systemImage: icon(for: c.kind)).font(Type.small).foregroundStyle(t.ink2)
                            }
                            if kids && Safety.needsGrownUp(cautions) {
                                Label("New to this? Ask a grown-up to help with this step.", systemImage: "person.2").font(.system(size: 13, weight: .medium)).foregroundStyle(t.accent)
                            }
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(t.surface2.opacity(0.7), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .accessibilityElement(children: .combine)
                    }
                    if let m = step.timerMinutes {
                        StepTimerView(minutes: m, state: timers.state(for: step.id), now: timers.now,
                                      onStart: { startTimer(step, minutes: m) }, onPause: { timers.pause(step.id) }, onReset: { timers.reset(step.id) },
                                      onDismiss: { timers.acknowledge(step.id) })
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 28)
                .frame(maxWidth: .infinity, alignment: .leading)
                .id(step.id)
                .offset(x: drag)
                .transition(.asymmetric(insertion: .offset(x: dir * 48).combined(with: .opacity), removal: .offset(x: dir * -48).combined(with: .opacity)))
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Step \(index + 1) of \(steps.count). \(step.text)")
            }
            .motion(Motion.settle, value: index)
            .simultaneousGesture(
                DragGesture(minimumDistance: 24)
                    .onChanged { v in if abs(v.translation.width) > abs(v.translation.height) { drag = v.translation.width * 0.25 } }
                    .onEnded { v in
                        withAnimation(Motion.settle) { drag = 0 }
                        guard abs(v.translation.width) > abs(v.translation.height) * 1.5 else { return }
                        if v.translation.width < -100 { next(last) } else if v.translation.width > 100 { prev() }
                    }
            )

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
        .sheet(isPresented: $ingOpen) { ingredientsSheet(recipe, scale: scale) }
        .sheet(isPresented: $finishOpen) { finishSheet(recipe) }
        .sheet(isPresented: $leaveOpen) {
            SheetChrome(title: "A timer is still running") {
                Text("Leave now and it keeps counting in the background. You can come back any time from Tonight.").font(Type.body).foregroundStyle(t.ink2)
                HStack(spacing: 8) {
                    Button("Keep cooking") { leaveOpen = false }.pbutton(.primary)
                    Button("Leave for now") { leaveOpen = false; close() }.pbutton(.ghost)
                }
                .padding(.top, 20)
            }
            .presentationDetents([.height(220)])
        }
    }

    private func ingredientsSheet(_ recipe: RecipeModel, scale: Double) -> some View {
        SheetChrome(title: "Ingredients") {
            HStack {
                Text("Cooking for").font(Type.label)
                Spacer()
                Stepper(value: Binding(get: { count }, set: { people = $0 }), range: 1...24, label: "people")
            }
            .padding(.bottom, 12)
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
                            Text(Quantity.format(ing.quantity * scale, ing.unit)).font(Type.small).foregroundStyle(t.ink2)
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? [.isSelected] : [])
                    .accessibilityLabel("\(ing.name), \(Quantity.format(ing.quantity * scale, ing.unit))")
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func finishSheet(_ recipe: RecipeModel) -> some View {
        let tomorrow = request.date.map { DateKey.addDays($0, 1) }
        let tomorrowBusy = tomorrow.flatMap { store.dinner(on: $0) }.map { $0.recipeId != nil || $0.note != nil } ?? false
        return SheetChrome(title: nil) {
            VStack(alignment: .leading, spacing: 16) {
                Image(systemName: "checkmark").font(.system(size: 22, weight: .bold)).foregroundStyle(t.secondaryInk)
                    .frame(width: 56, height: 56).background(t.secondary, in: Circle())
                Text(alreadyDone ? "Already logged." : "That's dinner.").font(Type.title)
                if alreadyDone {
                    Text("This night is already marked cooked, so nothing is counted twice.").font(Type.body).foregroundStyle(t.ink2)
                } else if entry != nil {
                    Toggle(isOn: $usePantry) { Text("Use up the fresh stuff from my pantry").font(Type.body) }.tint(t.accent)
                    Toggle(isOn: $leftovers) { Text("There are leftovers").font(Type.body) }.tint(t.accent)
                    if leftovers && tomorrowBusy {
                        Toggle(isOn: $replaceTomorrow) { Text("Swap tomorrow's plan for these leftovers").font(Type.body) }.tint(t.accent)
                    }
                } else {
                    Text("Log it as \(cookDate == ctxProvider.today ? "tonight's" : "tomorrow's") dinner so the week and the pantry keep up.").font(Type.body).foregroundStyle(t.ink2)
                    Toggle(isOn: $usePantry) { Text("Use up the fresh stuff from my pantry").font(Type.body) }.tint(t.accent)
                    Toggle(isOn: $leftovers) { Text("There are leftovers").font(Type.body) }.tint(t.accent)
                }
                Button(alreadyDone ? "Back to Tonight" : "Finish") { finish() }.pbutton(.primary, .lg, fill: true)
                    .accessibilityHint(alreadyDone ? "" : "Marks the night cooked and updates the pantry")
            }
        }
        .presentationDetents([.medium])
    }

    private func stepWords(_ text: String) -> String {
        let words = text.split(separator: " ").prefix(3).joined(separator: " ")
        return words.trimmingCharacters(in: .punctuationCharacters)
    }

    private func icon(for kind: CautionKind) -> String {
        switch kind {
        case .hot: "flame"
        case .oven: "oven"
        case .boil: "drop"
        case .sharp: "scissors"
        case .raw: "hand.raised"
        }
    }

    private func startTimer(_ step: Step, minutes: Int) {
        guard TapGuard.allow("timer-\(step.id)") else { return }
        Notifications.requestOnce(asked: settings?.askedNotifications ?? false) { store.update { $0.askedNotifications = true } }
        timers.start(step.id, minutes: Double(minutes), label: stepWords(step.text))
    }

    private func go(_ to: Int) {
        guard let count = recipe?.steps.count else { return }
        let n = clamp(to, 0, count - 1)
        if n != index { dir = n > index ? 1 : -1 }
        withAnimation(reduce ? nil : Motion.settle) { index = n }
        #if canImport(UIKit)
        UIAccessibility.post(notification: .announcement, argument: "Step \(n + 1) of \(count)")
        #endif
    }

    private func next(_ last: Int) {
        guard TapGuard.allow("cook-next") else { return }
        if index >= last { finishOpen = true } else { go(index + 1) }
        Haptic.tap()
    }

    private func prev() { go(index - 1) }

    private func leaveOrClose() {
        if timers.anyRunning { leaveOpen = true } else { close() }
    }

    /// Back to where you came from, keeping the session so it can be resumed.
    private func close() {
        // Just looked and left: don't leave a Live Activity behind for a cook that never started.
        let started = index > 0 || !timers.states.isEmpty
        persist(live: started)
        if !started { CookLiveActivity.end() }
        dismiss()
    }

    private func finish() {
        guard TapGuard.allow("cook-finish") else { return }
        finishOpen = false
        guard let recipe else { dismiss(); return }
        if alreadyDone {
            CookSession.clear()
            dismiss()
            nav.go(.tonight)
            return
        }
        let date = cookDate
        if request.date != nil, entry != nil {
            store.setServings(date, count)
            let undo = store.undoable { _ = store.markCooked(date, leftovers: leftovers, usePantry: usePantry, replaceTomorrow: replaceTomorrow) }
            ctxProvider.refresh()
            toaster.show("Nice work.") { undo(); ctxProvider.refresh() }
        } else {
            // Cooking straight from a recipe: log it as the dinner Tonight is about, unless that night is already cooked.
            if entry?.done == true { CookSession.clear(); dismiss(); nav.go(.tonight); return }
            let undo = store.undoable {
                store.setDinner(date, recipeId: recipe.id, servings: count, cookId: entry?.cookId)
                _ = store.markCooked(date, leftovers: leftovers, usePantry: usePantry)
            }
            ctxProvider.refresh()
            toaster.show("Logged as \(date == ctxProvider.today ? "tonight's" : "tomorrow's") dinner. Nice work.") { undo(); ctxProvider.refresh() }
        }
        Haptic.success()
        CookSession.clear()
        dismiss()
        nav.go(.tonight)
        nav.popToRoot()
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
    var onDismiss: () -> Void

    var body: some View {
        let total = minutes * 60_000
        let remaining = state?.remaining(now: now) ?? total
        let running = state?.endsAt != nil
        let finished = state?.finished ?? false
        let ringing = finished && !(state?.acknowledged ?? true)
        HStack(spacing: 16) {
            ProgressRing(value: 1 - Double(remaining) / Double(total), size: 72, stroke: 6, tone: finished ? .danger : .accent, label: finished ? "Timer finished" : "\(formatClock(remaining)) left") {
                Text(formatClock(remaining)).font(Type.display(18)).monospacedDigit()
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(ringing ? "Time's up" : finished ? "Done" : running ? "Running" : "\(minutes) minute timer").font(Type.label)
                HStack(spacing: 8) {
                    if ringing {
                        Button("Stop ringing", action: onDismiss).pbutton(.danger, .sm)
                    } else if running {
                        Button("Pause", action: onPause).pbutton(.secondary, .sm)
                    } else {
                        Button(finished ? "Again" : state == nil || remaining == total ? "Start" : "Resume", action: onStart).pbutton(.primary, .sm)
                        if state != nil { Button("Reset", action: onReset).pbutton(.ghost, .sm) }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .card()
        .accessibilityElement(children: .contain)
    }
}
