import SwiftUI

// Plantry's color system. Four moods follow the clock (dawn, day, dusk,
// night) and are the same RGB values as app/globals.css in the web app.
// Views only ever use the semantic tokens on `Theme`, never raw colors.

struct Theme: Equatable {
    var mood: Mood
    var canvas: Color
    var surface: Color
    var surface2: Color
    var ink: Color
    var ink2: Color
    var ink3: Color
    var line: Color
    var accent: Color
    var accentInk: Color
    var secondary: Color
    var secondaryInk: Color
    var glowA: Color
    var glowB: Color
    var glowC: Color

    var isDark: Bool { mood == .night }
    var colorScheme: ColorScheme { isDark ? .dark : .light }

    static let danger = Color(red: 192 / 255, green: 57 / 255, blue: 43 / 255)
    static let cream = rgb(250, 244, 234)

    static func rgb(_ r: Double, _ g: Double, _ b: Double) -> Color {
        Color(red: r / 255, green: g / 255, blue: b / 255)
    }

    static func color(for member: MemberColor) -> Color {
        switch member {
        case .terracotta: rgb(200, 85, 47)
        case .saffron: rgb(233, 162, 59)
        case .sage: rgb(122, 158, 126)
        case .plum: rgb(74, 44, 79)
        }
    }

    static func forMood(_ mood: Mood) -> Theme {
        switch mood {
        case .day:
            Theme(mood: .day, canvas: rgb(250, 244, 234), surface: rgb(255, 252, 247), surface2: rgb(243, 235, 221),
                  ink: rgb(42, 31, 26), ink2: rgb(94, 78, 70), ink3: rgb(150, 134, 124), line: rgb(226, 214, 196),
                  accent: rgb(200, 85, 47), accentInk: rgb(255, 250, 244), secondary: rgb(122, 158, 126), secondaryInk: .white,
                  glowA: rgb(255, 214, 170), glowB: rgb(250, 244, 234), glowC: rgb(214, 232, 214))
        case .dawn:
            Theme(mood: .dawn, canvas: rgb(252, 241, 230), surface: rgb(255, 251, 246), surface2: rgb(247, 230, 214),
                  ink: rgb(42, 31, 26), ink2: rgb(94, 78, 70), ink3: rgb(150, 134, 124), line: rgb(226, 214, 196),
                  accent: rgb(214, 101, 62), accentInk: rgb(255, 250, 244), secondary: rgb(122, 158, 126), secondaryInk: .white,
                  glowA: rgb(255, 196, 160), glowB: rgb(255, 236, 214), glowC: rgb(246, 214, 190))
        case .dusk:
            Theme(mood: .dusk, canvas: rgb(247, 236, 222), surface: rgb(255, 250, 242), surface2: rgb(240, 224, 204),
                  ink: rgb(42, 31, 26), ink2: rgb(94, 78, 70), ink3: rgb(150, 134, 124), line: rgb(226, 214, 196),
                  accent: rgb(221, 146, 44), accentInk: rgb(42, 31, 26), secondary: rgb(110, 70, 112), secondaryInk: .white,
                  glowA: rgb(255, 190, 110), glowB: rgb(247, 236, 222), glowC: rgb(196, 160, 196))
        case .night:
            Theme(mood: .night, canvas: rgb(30, 22, 32), surface: rgb(42, 32, 44), surface2: rgb(56, 44, 58),
                  ink: rgb(250, 244, 234), ink2: rgb(214, 202, 196), ink3: rgb(156, 142, 148), line: rgb(70, 56, 72),
                  accent: rgb(233, 162, 59), accentInk: rgb(30, 22, 32), secondary: rgb(140, 176, 144), secondaryInk: rgb(30, 22, 32),
                  glowA: rgb(90, 50, 80), glowB: rgb(30, 22, 32), glowC: rgb(40, 60, 60))
        }
    }
}

private struct ThemeKey: EnvironmentKey {
    static let defaultValue = Theme.forMood(.day)
}

extension EnvironmentValues {
    var theme: Theme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}

// MARK: - Type

// Display type is the system serif (New York) so the app ships no font files
// and renders instantly; body is San Francisco. Sizes follow the web app.
enum Type {
    static func display(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }
    static let hero = display(40)          // text-fluid-2xl on a phone
    static let title = display(30)         // text-fluid-xl
    static let heading = display(22)       // text-xl
    static let cardTitle = display(19)     // text-lg
    static let body = Font.system(size: 15)
    static let bodyLarge = Font.system(size: 16)
    static let small = Font.system(size: 13)
    static let eyebrow = Font.system(size: 12, weight: .semibold)
    static let label = Font.system(size: 15, weight: .medium)
}

enum Radius {
    static let card: CGFloat = 20
    static let sheet: CGFloat = 28
    static let tile: CGFloat = 14
}

// MARK: - Motion

// Plantry's motion signature. Every animation uses one of these so the
// product has one body language. Only transform and opacity are animated.
enum Motion {
    /// Cards entering, sheets opening, selection pills.
    static let settle = Animation.interpolatingSpring(mass: 0.8, stiffness: 400, damping: 30)
    /// Drag and drop, reorder, the shuffle deck.
    static let drift = Animation.interpolatingSpring(mass: 1, stiffness: 170, damping: 26)
    /// The check pop used by the shop list and cook steps.
    static let checkPop = Animation.interpolatingSpring(mass: 1, stiffness: 600, damping: 18)
    /// Lists and grids on mount.
    static let reveal = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.24)
    static let tap = Animation.easeOut(duration: 0.12)
    static let crossfade = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.2)

    static func staggered(_ index: Int) -> Animation {
        reveal.delay(Double(min(index, 12)) * 0.04)
    }
}

private struct ReduceMotionKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True when either the system or the Plantry setting asks for less motion.
    var plantryReduceMotion: Bool {
        get { self[ReduceMotionKey.self] }
        set { self[ReduceMotionKey.self] = newValue }
    }
}

extension View {
    /// Animates only when motion is allowed. Use for everything that is not a direct response to a drag.
    func motion<V: Equatable>(_ animation: Animation, value: V) -> some View {
        modifier(MotionModifier(animation: animation, value: value))
    }
}

private struct MotionModifier<V: Equatable>: ViewModifier {
    @Environment(\.plantryReduceMotion) private var reduce
    var animation: Animation
    var value: V
    func body(content: Content) -> some View {
        content.animation(reduce ? nil : animation, value: value)
    }
}

/// Mount animation for list rows: fades and lifts in with a per-row delay.
struct Reveal: ViewModifier {
    @Environment(\.plantryReduceMotion) private var reduce
    var index: Int
    @State private var shown = false
    func body(content: Content) -> some View {
        content
            .opacity(shown || reduce ? 1 : 0)
            .offset(y: shown || reduce ? 0 : 12)
            .onAppear {
                guard !shown else { return }
                withAnimation(Motion.staggered(index)) { shown = true }
            }
    }
}

extension View {
    func reveal(_ index: Int = 0) -> some View { modifier(Reveal(index: index)) }
}
