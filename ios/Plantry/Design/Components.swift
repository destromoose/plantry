import SwiftUI

// The primitives every screen is built from: Card, buttons, Chip, Tag,
// Eyebrow, SectionTitle, ProgressRing, EmptyState, Avatar, Logo, Stepper,
// Toast, text fields and the ambient background.

// MARK: - Surfaces

struct CardModifier: ViewModifier {
    @Environment(\.theme) private var t
    var tint: Color?
    func body(content: Content) -> some View {
        content
            // The shadow is cast by the card shape alone, not the whole card with its
            // text and photo, so SwiftUI draws it without an offscreen pass per card.
            // That keeps long scrolling lists at full frame rate.
            .background {
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .fill(tint ?? t.surface)
                    .shadow(color: .black.opacity(t.isDark ? 0.3 : 0.06), radius: 12, y: 6)
            }
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(t.line.opacity(0.7), lineWidth: 1))
    }
}

extension View {
    func card(tint: Color? = nil) -> some View { modifier(CardModifier(tint: tint)) }
}

/// Three blurred radial glows that shift with the mood. The ambient kitchen light.
struct AmbientBackground: View {
    @Environment(\.theme) private var t
    @Environment(\.plantryReduceMotion) private var reduce
    @State private var drift = false

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            ZStack {
                t.canvas
                Circle().fill(t.glowA).frame(width: w * 1.2).blur(radius: 80)
                    .offset(x: -w * 0.3 + (drift ? w * 0.08 : 0), y: -w * 0.4 + (drift ? 30 : 0))
                Circle().fill(t.glowC).frame(width: w * 1.1).blur(radius: 80)
                    .offset(x: w * 0.4 - (drift ? w * 0.06 : 0), y: geo.size.height * 0.6 - (drift ? 40 : 0))
                Circle().fill(t.glowB).frame(width: w * 0.8).blur(radius: 70).opacity(0.6)
                    .offset(x: w * 0.2, y: geo.size.height * 0.1)
            }
            .animation(.easeInOut(duration: 0.8), value: t)
            .onAppear {
                guard !reduce else { return }
                withAnimation(.easeInOut(duration: 24).repeatForever(autoreverses: true)) { drift = true }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

// MARK: - Buttons

enum PButtonVariant { case primary, secondary, outline, ghost, danger, glass }
enum PButtonSize { case sm, md, lg, icon, iconSm }

struct PButtonStyle: ButtonStyle {
    @Environment(\.theme) private var t
    @Environment(\.isEnabled) private var enabled
    var variant: PButtonVariant = .primary
    var size: PButtonSize = .md
    var fill = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size == .sm || size == .iconSm ? .system(size: 13, weight: .semibold) : .system(size: size == .lg ? 16 : 15, weight: .semibold))
            .foregroundStyle(foreground)
            .padding(.horizontal, padding)
            .frame(maxWidth: fill ? .infinity : nil)
            .frame(minWidth: minSide, minHeight: minSide)
            .background(background, in: Capsule())
            .overlay(Capsule().strokeBorder(border, lineWidth: 1))
            .opacity(enabled ? 1 : 0.5)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(Motion.tap, value: configuration.isPressed)
            .contentShape(Capsule())
    }

    private var minSide: CGFloat {
        switch size {
        case .sm, .iconSm: 36
        case .md, .icon: 44
        case .lg: 52
        }
    }

    private var padding: CGFloat {
        switch size {
        case .icon, .iconSm: 0
        case .sm: 14
        case .md: 18
        case .lg: 22
        }
    }

    private var background: Color {
        switch variant {
        case .primary: t.accent
        case .secondary: t.surface2
        case .outline, .ghost: .clear
        case .danger: Theme.danger
        case .glass: t.surface.opacity(0.78)
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary: t.accentInk
        case .danger: Theme.cream
        default: t.ink
        }
    }

    private var border: Color {
        switch variant {
        case .outline: t.line
        case .glass: t.line.opacity(0.6)
        default: .clear
        }
    }
}

extension View {
    func pbutton(_ variant: PButtonVariant = .primary, _ size: PButtonSize = .md, fill: Bool = false) -> some View {
        buttonStyle(PButtonStyle(variant: variant, size: size, fill: fill))
    }
}

/// A list row that looks like a soft bordered tile and presses like a button.
struct RowButtonStyle: ButtonStyle {
    @Environment(\.theme) private var t
    var tint: Color?
    var dashed = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tint ?? t.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(dashed ? t.ink3 : t.line, style: StrokeStyle(lineWidth: 1, dash: dashed ? [5, 4] : [])))
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(Motion.tap, value: configuration.isPressed)
            .contentShape(RoundedRectangle(cornerRadius: 16))
    }
}

struct PlainPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(Motion.tap, value: configuration.isPressed)
    }
}

// MARK: - Chips and tags

struct Chip: View {
    @Environment(\.theme) private var t
    var label: String
    var hint: String? = nil
    var selected = false
    var tone: PButtonVariant = .primary
    var small = false
    var systemImage: String? = nil
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage { Image(systemName: systemImage).font(.system(size: 12, weight: .semibold)) }
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.system(size: small ? 13 : 15, weight: .medium))
                    if let hint { Text(hint).font(Type.sans(12)).opacity(0.8) }
                }
            }
            .foregroundStyle(selected ? (tone == .secondary ? t.secondaryInk : t.accentInk) : t.ink)
            .padding(.horizontal, small ? 12 : 16)
            .frame(minHeight: small ? 34 : (hint == nil ? 42 : 54))
            .padding(.vertical, hint == nil ? 0 : 6)
            .background(selected ? (tone == .secondary ? t.secondary : t.accent) : t.surface, in: Capsule())
            .overlay(Capsule().strokeBorder(selected ? .clear : t.line, lineWidth: 1))
        }
        .buttonStyle(PlainPressStyle())
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .motion(Motion.settle, value: selected)
    }
}

struct Tag: View {
    @Environment(\.theme) private var t
    var text: String
    var systemImage: String? = nil
    var body: some View {
        HStack(spacing: 4) {
            if let systemImage { Image(systemName: systemImage).font(.system(size: 10, weight: .semibold)) }
            Text(text)
        }
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(t.ink2)
        .padding(.horizontal, 10)
        .frame(height: 26)
        .background(t.surface2, in: Capsule())
    }
}

struct Eyebrow: View {
    @Environment(\.theme) private var t
    var text: String
    var body: some View {
        Text(text.uppercased())
            .font(Type.eyebrow)
            .kerning(1.6)
            .foregroundStyle(t.ink3)
    }
}

struct SectionTitle<Action: View>: View {
    var text: String
    @ViewBuilder var action: Action
    init(_ text: String, @ViewBuilder action: () -> Action = { EmptyView() }) {
        self.text = text
        self.action = action()
    }
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(text).font(Type.heading)
            Spacer()
            action
        }
        .padding(.bottom, 10)
    }
}

// MARK: - Rings and avatars

enum RingTone { case accent, secondary, danger }

struct ProgressRing<Content: View>: View {
    @Environment(\.theme) private var t
    var value: Double
    var size: CGFloat = 48
    var stroke: CGFloat = 5
    var tone: RingTone = .accent
    var label: String? = nil
    @ViewBuilder var content: Content

    private var color: Color {
        switch tone {
        case .accent: t.accent
        case .secondary: t.secondary
        case .danger: Theme.danger
        }
    }

    var body: some View {
        ZStack {
            Circle().stroke(t.line, lineWidth: stroke)
            Circle()
                .trim(from: 0, to: clamp(value, 0, 1))
                .stroke(color, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .motion(Motion.settle, value: value)
            content
        }
        .frame(width: size, height: size)
        .accessibilityLabel(label ?? "\(Int(value * 100)) percent")
    }
}

struct Avatar: View {
    var member: MemberModel
    var size: CGFloat = 36
    var body: some View {
        Text(String(member.name.prefix(1)).uppercased())
            .font(.system(size: size * 0.42, weight: .semibold, design: .serif))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Theme.color(for: member.color), in: Circle())
            .accessibilityLabel(member.name)
    }
}

/// The Plantry mark: a plate seen from above with a leaf.
struct Logo: View {
    @Environment(\.theme) private var t
    var withWord = true
    var size: CGFloat = 28
    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                Circle().stroke(lineWidth: size / 14)
                Circle().stroke(lineWidth: size / 19).opacity(0.5).frame(width: size * 0.5, height: size * 0.5)
                Leaf().fill().frame(width: size * 0.46, height: size * 0.46).offset(x: size * 0.12, y: size * 0.04)
            }
            .frame(width: size, height: size)
            if withWord { Text("Plantry").font(Type.display(size * 0.75)) }
        }
        .foregroundStyle(t.ink)
        .accessibilityLabel("Plantry")
    }

    struct Leaf: Shape {
        func path(in r: CGRect) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: r.minX, y: r.maxY))
            p.addCurve(to: CGPoint(x: r.maxX, y: r.minY), control1: CGPoint(x: r.minX, y: r.midY * 0.6), control2: CGPoint(x: r.midX, y: r.minY))
            p.addCurve(to: CGPoint(x: r.minX, y: r.maxY), control1: CGPoint(x: r.maxX, y: r.midY * 1.3), control2: CGPoint(x: r.midX * 1.2, y: r.maxY))
            return p
        }
    }
}

// MARK: - Inputs

struct PField: View {
    @Environment(\.theme) private var t
    var placeholder: String
    @Binding var text: String
    var submit: (() -> Void)? = nil
    var body: some View {
        TextField(placeholder, text: $text)
            .font(Type.body)
            .padding(.horizontal, 14)
            .frame(height: 46)
            .background(t.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(t.line, lineWidth: 1))
            .onSubmit { submit?() }
            .submitLabel(submit == nil ? .done : .go)
    }
}

struct Stepper: View {
    @Environment(\.theme) private var t
    @Binding var value: Int
    var range: ClosedRange<Int>
    var label: String
    var body: some View {
        HStack(spacing: 0) {
            Button { value = max(range.lowerBound, value - 1) } label: { Image(systemName: "minus").frame(width: 44, height: 44) }
                .disabled(value <= range.lowerBound)
                .accessibilityLabel("Fewer \(label)")
            Text("\(value)")
                .font(Type.display(17))
                .frame(minWidth: 36)
                .contentTransition(.numericText())
                .motion(Motion.settle, value: value)
            Button { value = min(range.upperBound, value + 1) } label: { Image(systemName: "plus").frame(width: 44, height: 44) }
                .disabled(value >= range.upperBound)
                .accessibilityLabel("More \(label)")
        }
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(t.ink)
        .buttonStyle(.plain)
        .frame(height: 44)
        .padding(.horizontal, 2)
        .background(t.surface2, in: Capsule())
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(label): \(value)")
    }
}

extension View {
    /// Minimum touch target with a tappable square around icon buttons.
    func iconButton() -> some View {
        frame(width: 44, height: 44).contentShape(Rectangle())
    }
}

// MARK: - Empty state

struct EmptyState<Action: View>: View {
    @Environment(\.theme) private var t
    var systemImage: String
    var title: String
    var body_: String
    @ViewBuilder var action: Action

    init(systemImage: String, title: String, body: String, @ViewBuilder action: () -> Action = { EmptyView() }) {
        self.systemImage = systemImage
        self.title = title
        self.body_ = body
        self.action = action()
    }

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(t.ink2)
                .frame(width: 56, height: 56)
                .background(t.surface2, in: Circle())
            Text(title).font(Type.cardTitle).multilineTextAlignment(.center)
            Text(body_).font(Type.body).foregroundStyle(t.ink2).multilineTextAlignment(.center)
            action.padding(.top, 6)
        }
        .frame(maxWidth: .infinity)
        .padding(28)
        .card()
    }
}

// MARK: - Toast

@MainActor
@Observable
final class Toaster {
    struct Toast: Equatable {
        var text: String
        var undo: (() -> Void)?
        static func == (a: Toast, b: Toast) -> Bool { a.text == b.text && (a.undo == nil) == (b.undo == nil) }
    }
    var toast: Toast?
    var message: String? { toast?.text }
    private var task: Task<Void, Never>?

    func show(_ text: String) { present(Toast(text: text, undo: nil), for: 2.2) }

    /// A toast with an Undo button, for every action that takes something away.
    func show(_ text: String, undo: @escaping () -> Void) { present(Toast(text: text, undo: undo), for: 8) }

    private func present(_ t: Toast, for seconds: Double) {
        task?.cancel()
        toast = t
        task = Task {
            try? await Task.sleep(for: .seconds(seconds))
            if !Task.isCancelled { toast = nil }
        }
    }

    func dismiss() { task?.cancel(); toast = nil }
}

struct ToastHost: ViewModifier {
    @Environment(\.theme) private var t
    @Environment(Toaster.self) private var toaster

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if let toast = toaster.toast {
                HStack(spacing: 12) {
                    Text(toast.text).font(Type.sans(14, weight: .medium)).foregroundStyle(t.ink).lineLimit(2)
                    if let undo = toast.undo {
                        Button("Undo") { undo(); toaster.dismiss(); Haptic.tap() }
                            .font(.system(size: 14, weight: .semibold)).foregroundStyle(t.accent)
                            .frame(minHeight: 44)
                    }
                }
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(t.line.opacity(0.6), lineWidth: 1))
                .shadow(color: .black.opacity(0.15), radius: 14, y: 8)
                .padding(.bottom, 70)
                .padding(.horizontal, 20)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .accessibilityElement(children: .contain)
                .accessibilityAddTraits(.updatesFrequently)
            }
        }
        .motion(Motion.settle, value: toaster.toast)
    }
}

/// Ignores a repeat tap within 300 ms, so a double tap can't save twice or skip a step.
@MainActor
enum TapGuard {
    private static var last: [String: Date] = [:]
    static func allow(_ key: String, within seconds: Double = 0.3) -> Bool {
        let now = Date()
        if let l = last[key], now.timeIntervalSince(l) < seconds { return false }
        last[key] = now
        return true
    }
}

// MARK: - Sheet chrome

struct SheetChrome<Content: View>: View {
    @Environment(\.theme) private var t
    @Environment(\.dismiss) private var dismiss
    var title: String?
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline) {
                    if let title { Text(title).font(Type.heading) }
                    Spacer()
                    Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 14, weight: .semibold)).iconButton() }
                        .accessibilityLabel("Close")
                        .foregroundStyle(t.ink2)
                }
                .padding(.bottom, title == nil ? 0 : 14)
                content
            }
            .padding(.horizontal, 24)
            .padding(.top, 18)
            .padding(.bottom, 28)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .background(t.surface)
        .foregroundStyle(t.ink)
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Radius.sheet)
        .presentationBackground(t.surface)
    }
}

// MARK: - Images

/// A remote image with a memory and disk cache, no third-party loader.
///
/// A photo already in memory is drawn on the very first frame, so a card that
/// scrolls back into view never flashes an empty tile. A photo that is still
/// loading shows a surface-colored placeholder, or a smaller copy while the
/// sharp one decodes.
struct RemoteImage: View {
    @Environment(\.theme) private var t
    var url: String?
    var size: ImagePipeline.Size
    @State private var image: Image?
    /// The url and size `image` is the finished picture for. Nil while it is a stand-in or empty.
    @State private var exactFor: String?
    @State private var failed = false

    init(url: String?, size: ImagePipeline.Size = .full) {
        self.url = url
        self.size = size
        let hit = Self.parse(url).flatMap { ImagePipeline.shared.bestCached($0, size) }
        _image = State(initialValue: hit?.image)
        _exactFor = State(initialValue: hit?.exact == true ? Self.tag(url, size) : nil)
    }

    var body: some View {
        Color.clear
            .overlay {
                if let image {
                    image.resizable().scaledToFill().transition(.opacity)
                } else if failed || url == nil {
                    Image(systemName: "fork.knife").font(.system(size: 22)).foregroundStyle(t.ink3)
                }
            }
            .background(t.surface2)
            .clipped()
        .task(id: Self.tag(url, size)) { await load() }
        .motion(.easeOut(duration: 0.2), value: image == nil)
    }

    private static func tag(_ url: String?, _ size: ImagePipeline.Size) -> String { "\(size.rawValue)|\(url ?? "")" }
    private static func parse(_ url: String?) -> URL? {
        guard let url, let u = URL(string: url), u.scheme?.hasPrefix("http") == true else { return nil }
        return u
    }

    private func load() async {
        let tag = Self.tag(url, size)
        if exactFor == tag, image != nil { return }
        failed = false
        guard let u = Self.parse(url) else { image = nil; exactFor = nil; failed = true; return }
        if let hit = ImagePipeline.shared.bestCached(u, size) {
            image = hit.image
            if hit.exact { exactFor = tag; return }
        } else {
            // A new url must not keep showing the last one's picture.
            image = nil
        }
        exactFor = nil
        let loaded = await ImagePipeline.shared.load(u, size)
        guard !Task.isCancelled else { return }
        if let loaded {
            image = loaded
            exactFor = tag
        } else if image == nil {
            failed = true
        }
    }
}

struct Thumb: View {
    var url: String?
    var size: CGFloat = 48
    var radius: CGFloat = 12
    var body: some View {
        RemoteImage(url: url, size: .fitting(points: size))
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

#if canImport(UIKit)
import UIKit
enum Haptic {
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
}
#else
enum Haptic {
    static func tap() {}
    static func success() {}
}
#endif
