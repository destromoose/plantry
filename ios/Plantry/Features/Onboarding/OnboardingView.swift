import SwiftUI

struct OnboardingView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctx
    @Environment(\.theme) private var t
    @Environment(\.plantryReduceMotion) private var reduce

    private enum Step: Int, CaseIterable { case who, taste, pantry }

    @State private var step: Step = .who
    @State private var names: [String] = [""]
    @State private var tastes: [Taste] = []
    @State private var picked: Set<String> = Set(Seed.quickPicks.prefix(8))
    @FocusState private var focused: Int?

    private var canNext: Bool {
        switch step {
        case .who: names.contains { !$0.isBlank }
        case .taste: !tastes.isEmpty
        case .pantry: true
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Logo()
                Spacer()
                HStack(spacing: 6) {
                    ForEach(Step.allCases, id: \.rawValue) { s in
                        Capsule()
                            .fill(s.rawValue <= step.rawValue ? t.accent : t.line)
                            .frame(width: s.rawValue <= step.rawValue ? 32 : 12, height: 6)
                    }
                }
                .motion(Motion.settle, value: step)
                .accessibilityLabel("Step \(step.rawValue + 1) of \(Step.allCases.count)")
            }
            .padding(.bottom, 32)

            ScrollView {
                Group {
                    switch step {
                    case .who: who
                    case .taste: taste
                    case .pantry: pantry
                    }
                }
                .id(step)
                .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .move(edge: .leading).combined(with: .opacity)))
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            .motion(Motion.settle, value: step)

            HStack {
                Button("Back") { withAnimation(reduce ? nil : Motion.settle) { step = Step(rawValue: step.rawValue - 1) ?? .who } }
                    .pbutton(.ghost)
                    .opacity(step == .who ? 0 : 1)
                    .disabled(step == .who)
                Spacer()
                Button {
                    next()
                } label: {
                    HStack(spacing: 6) {
                        Text(step == .pantry ? "Show me tonight" : "Next")
                        Image(systemName: "arrow.right").font(.system(size: 14, weight: .semibold))
                    }
                }
                .pbutton(.primary, .lg)
                .disabled(!canNext)
            }
            .padding(.top, 16)
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .padding(.bottom, 16)
        .background(AmbientBackground())
        .onAppear { focused = 0 }
    }

    private func next() {
        Haptic.tap()
        focused = nil
        if let n = Step(rawValue: step.rawValue + 1) {
            withAnimation(reduce ? nil : Motion.settle) { step = n }
        } else {
            store.completeOnboarding(names: names, tastes: tastes, pantryNames: Array(picked))
            ctx.refresh()
            Haptic.success()
        }
    }

    private func heading(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(Type.hero).lineSpacing(-2)
            Text(body).font(Type.body).foregroundStyle(t.ink2)
        }
    }

    private var who: some View {
        VStack(alignment: .leading, spacing: 32) {
            heading("Who eats here?", "First names only. You first. Nobody signs in, nobody gets an email. This stays on your device.")
            VStack(spacing: 12) {
                ForEach(names.indices, id: \.self) { i in
                    HStack(spacing: 8) {
                        PField(placeholder: i == 0 ? "Your name" : "Another name", text: $names[i]) { if canNext { next() } }
                            .focused($focused, equals: i)
                            .textContentType(.givenName)
                            .accessibilityLabel(i == 0 ? "Your name" : "Household member \(i + 1)")
                        if i > 0 {
                            Button { names.remove(at: i) } label: { Image(systemName: "xmark").iconButton() }
                                .pbutton(.ghost, .icon)
                                .accessibilityLabel("Remove")
                        }
                    }
                    .reveal(i)
                }
                if names.count < 6 {
                    Button { names.append(""); focused = names.count - 1 } label: { Label("Add someone", systemImage: "plus") }
                        .pbutton(.ghost, .sm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var taste: some View {
        VStack(alignment: .leading, spacing: 32) {
            heading("How do you like to eat?", "Pick a few. These are tastes, not rules. No diets here.")
            FlowLayout(spacing: 10) {
                ForEach(Array(Taste.allCases.enumerated()), id: \.element) { i, taste in
                    Chip(label: taste.label, hint: taste.hint, selected: tastes.contains(taste)) {
                        Haptic.tap()
                        if let at = tastes.firstIndex(of: taste) { tastes.remove(at: at) } else { tastes.append(taste) }
                    }
                    .reveal(i)
                }
            }
        }
    }

    private var pantry: some View {
        VStack(alignment: .leading, spacing: 32) {
            heading("What's already in the kitchen?", "Tap what you have. Plantry uses this to suggest dinners you can make right now, and to shorten your list.")
            VStack(alignment: .leading, spacing: 16) {
                FlowLayout(spacing: 8) {
                    ForEach(Array(Seed.quickPicks.enumerated()), id: \.element) { i, name in
                        Chip(label: name, selected: picked.contains(name), tone: .secondary, small: true) {
                            Haptic.tap()
                            if picked.contains(name) { picked.remove(name) } else { picked.insert(name) }
                        }
                        .reveal(i)
                    }
                }
                Text("\(picked.count) picked. You can add anything else later.").font(Type.small).foregroundStyle(t.ink3)
            }
        }
    }
}

/// Wraps chips onto as many lines as they need.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 { x = 0; y += rowH + spacing; rowH = 0 }
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
        return CGSize(width: width, height: y + rowH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            s.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
    }
}
