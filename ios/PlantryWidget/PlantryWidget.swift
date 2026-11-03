import WidgetKit
import SwiftUI

// Tonight's dinner on the home screen and the lock screen, with the step a cook
// is on, so nobody has to open the app to know what's for dinner. Reads the
// snapshot the app writes; never touches the database. The bundle also carries
// the cook-mode Live Activity (CookLiveActivityWidget.swift).

@main
struct PlantryWidgetBundle: WidgetBundle {
    var body: some Widget {
        TonightWidget()
        CookLiveActivityWidget()
    }
}

struct TonightEntry: TimelineEntry {
    var date: Date
    var snapshot: WidgetSnapshot?
}

struct TonightProvider: TimelineProvider {
    func placeholder(in context: Context) -> TonightEntry { TonightEntry(date: Date(), snapshot: .placeholder) }

    func getSnapshot(in context: Context, completion: @escaping (TonightEntry) -> Void) {
        completion(TonightEntry(date: Date(), snapshot: context.isPreview ? .placeholder : WidgetSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TonightEntry>) -> Void) {
        let snap = WidgetSnapshot.load()
        let now = Date()
        var entries = [TonightEntry(date: now, snapshot: snap)]
        // A running timer counts down minute by minute; otherwise refresh at the next hour mark.
        if let end = snap?.timerEndsAt, end > now {
            var t = now
            while t < end {
                t = t.addingTimeInterval(60)
                entries.append(TonightEntry(date: min(t, end), snapshot: snap))
            }
        }
        let nextHour = Calendar.current.nextDate(after: now, matching: DateComponents(minute: 0), matchingPolicy: .nextTime) ?? now.addingTimeInterval(3600)
        completion(Timeline(entries: entries, policy: .after(nextHour)))
    }
}

struct TonightWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "com.destromoose.plantry.tonight", provider: TonightProvider()) { entry in
            TonightWidgetView(entry: entry)
                .containerBackground(for: .widget) { WidgetBackground() }
        }
        .configurationDisplayName("Tonight")
        .description("What's for dinner, who's cooking, and the step you're on.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

struct WidgetBackground: View {
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        let dark = scheme == .dark
        ZStack {
            (dark ? Color(red: 30 / 255, green: 22 / 255, blue: 32 / 255) : Color(red: 250 / 255, green: 244 / 255, blue: 234 / 255))
            RadialGradient(colors: [(dark ? Color(red: 90 / 255, green: 50 / 255, blue: 80 / 255) : Color(red: 1, green: 214 / 255, blue: 170 / 255)).opacity(0.9), .clear],
                           center: .topLeading, startRadius: 0, endRadius: 220)
        }
    }
}

struct TonightWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    var entry: TonightEntry

    private var ink: Color { scheme == .dark ? Color(red: 250 / 255, green: 244 / 255, blue: 234 / 255) : Color(red: 42 / 255, green: 31 / 255, blue: 26 / 255) }
    private var ink2: Color { ink.opacity(0.72) }
    private var accent: Color { scheme == .dark ? Color(red: 233 / 255, green: 162 / 255, blue: 59 / 255) : Color(red: 174 / 255, green: 74 / 255, blue: 41 / 255) }

    var body: some View {
        switch family {
        case .accessoryInline: inline
        case .accessoryRectangular: rectangular
        case .systemMedium: medium
        default: small
        }
    }

    private var snap: WidgetSnapshot? { entry.snapshot }
    private var cooking: Bool { snap?.stepIndex != nil && snap?.done == false }

    private var timerText: String? {
        guard let end = snap?.timerEndsAt else { return nil }
        let left = Int(end.timeIntervalSince(entry.date).rounded(.up))
        if left <= 0 { return "Timer's up" }
        return "\(max(1, left / 60)) min left"
    }

    private var secondLine: String {
        guard let s = snap else { return "Open Plantry" }
        if s.done { return "Cooked. Nicely done." }
        if cooking, let i = s.stepIndex, let n = s.stepCount { return "Step \(i) of \(n)" + (timerText.map { " · \($0)" } ?? "") }
        if s.title == nil { return "Nothing decided yet" }
        if let nudge = s.nudge { return nudge }
        if s.missing > 0 { return "Missing \(s.missing) thing\(s.missing == 1 ? "" : "s")" }
        return "You have everything"
    }

    private var who: String? {
        guard let s = snap, let cook = s.cook else { return nil }
        return s.washer.map { "\(cook) cooks, \($0) washes up" } ?? "\(cook) is cooking"
    }

    private var link: URL { cooking || (snap?.title != nil && snap?.done == false && snap?.recipeId != nil) ? WidgetSnapshot.openCook : WidgetSnapshot.openTonight }

    private var small: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text((snap?.label ?? "Tonight").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(1.2).foregroundStyle(ink2)
            Text(snap?.title ?? "Dinner, decided.").font(.system(size: 17, weight: .semibold, design: .serif)).foregroundStyle(ink).lineLimit(3).minimumScaleFactor(0.85)
            Spacer(minLength: 2)
            if cooking, let text = snap?.stepText {
                Text(text).font(.system(size: 11)).foregroundStyle(ink2).lineLimit(2)
            }
            Text(secondLine).font(.system(size: 11, weight: .medium)).foregroundStyle(cooking ? accent : ink2).lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(link)
    }

    private var medium: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text((snap?.label ?? "Tonight").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(1.2).foregroundStyle(ink2)
                Text(snap?.title ?? "Dinner, decided.").font(.system(size: 19, weight: .semibold, design: .serif)).foregroundStyle(ink).lineLimit(2).minimumScaleFactor(0.85)
                if let meta = snap?.meta { Text(meta).font(.system(size: 11)).foregroundStyle(ink2).lineLimit(1) }
                Spacer(minLength: 2)
                if let who { Text(who).font(.system(size: 11)).foregroundStyle(ink2).lineLimit(1) }
                Text(secondLine).font(.system(size: 12, weight: .medium)).foregroundStyle(cooking ? accent : ink2).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if cooking, let text = snap?.stepText {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Now").font(.system(size: 10, weight: .semibold)).kerning(1.2).foregroundStyle(ink2)
                    Text(text).font(.system(size: 12)).foregroundStyle(ink).lineLimit(5)
                }
                .padding(10)
                .frame(width: 130).frame(maxHeight: .infinity, alignment: .topLeading)
                .background(ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(link)
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(snap?.label ?? "Tonight").font(.system(size: 12, weight: .semibold))
            Text(snap?.title ?? "Dinner, decided.").font(.system(size: 14, weight: .semibold, design: .serif)).lineLimit(2)
            Text(cooking && snap?.stepText != nil ? "Step \(snap!.stepIndex!): \(snap!.stepText!)" : secondLine).font(.system(size: 11)).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(link)
    }

    private var inline: some View {
        Text(cooking ? "Step \(snap!.stepIndex!) of \(snap!.stepCount!)" : "\(snap?.label ?? "Tonight"): \(snap?.title ?? "nothing yet")")
            .widgetURL(link)
    }
}
