import SwiftUI
import SwiftData

// Planning ahead together, a port of components/features/week/Ideas.tsx and Month.tsx:
// the household's pool of meal ideas, and the month at a glance.

/// "Craving tacos": what anyone in the household fancies, waiting for a night.
struct IdeasCard: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query private var settingsRows: [SettingsModel]
    var weekDates: [String]
    var today: String
    @State private var text = ""
    @State private var planning: MealIdea?
    @State private var picking = false

    var body: some View {
        let ideas = PlanAhead.rank(TogetherState.of(settingsRows).ideas ?? [])
        let meId = members.first { $0.isMe }?.id
        let together = members.count > 1
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Ideas", systemImage: "lightbulb").font(Type.cardTitle)
                Spacer()
                if together {
                    Button { picking = true } label: { Label("Pick together", systemImage: "shuffle") }.pbutton(.outline, .sm)
                }
            }
            Text(together ? "Fancy something? Add it here instead of texting. Tap Plan when there's a night for it."
                          : "Save meals you fancy, and plan them when there's a night for them.")
                .font(Type.small).foregroundStyle(t.ink2)
            HStack(spacing: 8) {
                PField(placeholder: "Tacos, that curry from Sunday…", text: $text) { add(together) }
                Button("Add") { add(together) }.pbutton(.secondary, .lg).disabled(text.isBlank)
            }
            ForEach(ideas) { idea in
                let title = store.ideaTitle(idea)
                let by = members.first { $0.id == idea.by }
                let mine = meId.map { idea.votes?.contains($0) ?? false } ?? false
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(title).font(Type.label).lineLimit(1)
                            if together && !(idea.votes ?? []).isEmpty {
                                Text("Match").font(Type.sans(11, weight: .bold)).foregroundStyle(t.accentInk)
                                    .padding(.horizontal, 7).padding(.vertical, 2).background(t.accent, in: Capsule())
                            }
                        }
                        HStack(spacing: 4) {
                            if together, let by { Text(by.id == meId ? "You ·" : "\(by.name) ·") }
                            Text(Together.ago(idea.at))
                            ForEach(idea.votes ?? [], id: \.self) { v in
                                if let m = members.first(where: { $0.id == v }) { Avatar(member: m, size: 18) }
                            }
                        }
                        .font(.system(size: 12)).foregroundStyle(t.ink3)
                    }
                    Spacer(minLength: 4)
                    if together && idea.by != meId {
                        Button { store.toggleIdeaVote(idea.id); Haptic.tap() } label: {
                            Label("Me too", systemImage: mine ? "heart.fill" : "heart")
                        }
                        .pbutton(.ghost, .sm).foregroundStyle(mine ? t.accent : t.ink2)
                        .accessibilityLabel(mine ? "Take back me too on \(title)" : "Me too on \(title)")
                    }
                    Button { planning = idea } label: { Label("Plan", systemImage: "calendar.badge.plus") }
                        .pbutton(.outline, .sm)
                        .accessibilityLabel("Plan \(title)")
                    Button {
                        let undo = store.undoable { store.removeIdea(idea.id) }
                        toaster.show("Idea removed") { undo() }
                    } label: { Image(systemName: "xmark").font(.system(size: 12, weight: .semibold)).frame(width: 36, height: 44) }
                        .foregroundStyle(t.ink3)
                        .accessibilityLabel("Remove \(title)")
                }
                .frame(minHeight: 52)
                if idea.id != ideas.last?.id { Divider().overlay(t.line) }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
        .sheet(isPresented: $picking) { PickTogetherSheet().presentationDetents([.large]) }
        .sheet(item: $planning) { idea in
            PlanIdeaSheet(idea: idea, weekDates: weekDates, today: today).presentationDetents([.medium, .large])
        }
    }

    private func add(_ together: Bool) {
        guard !text.isBlank else { return }
        store.addIdea(text)
        text = ""
        Haptic.tap()
        toaster.show(together ? "Added. The others can see it." : "Idea saved")
    }
}

/// Which night for an idea: this week's nights from today, the free ones first.
struct PlanIdeaSheet: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    var idea: MealIdea
    var weekDates: [String]
    var today: String

    var body: some View {
        let nights = weekDates.filter { $0 >= today }
        let what: (String) -> String? = { d in
            guard let e = store.dinner(on: d) else { return nil }
            if let lo = e.leftoversOf { return "Leftovers: \(store.recipe(lo)?.title ?? "")" }
            return store.recipe(e.recipeId)?.title ?? e.note
        }
        let sorted = nights.sorted { a, b in
            let x = what(a) != nil, y = what(b) != nil
            return x != y ? !x : a < b
        }
        SheetChrome(title: "Which night for \(store.ideaTitle(idea))?") {
            if nights.isEmpty {
                Text("No nights left this week. Move to next week to plan it.").font(Type.body).foregroundStyle(t.ink2)
            } else {
                VStack(spacing: 2) {
                    ForEach(sorted, id: \.self) { d in
                        let now = what(d)
                        Button {
                            let undo = store.undoable { store.planIdea(idea, on: d) }
                            ctxProvider.refresh()
                            Haptic.success()
                            toaster.show("Planned for \(DateKey.dayLabel(d, today: today))") { undo(); ctxProvider.refresh() }
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                (Text(DateKey.dayLabel(d, today: today)).font(Type.label)
                                 + Text("  \(DateKey.monthDay(d))").font(Type.small).foregroundStyle(t.ink3))
                                Text(now.map { "Instead of \($0)" } ?? "Free")
                                    .font(.system(size: 13, weight: now == nil ? .semibold : .regular))
                                    .foregroundStyle(now == nil ? t.secondary : t.ink3)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
                            .padding(.horizontal, 12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

/// The month at a glance: each night's dinner, who cooks, and weekly meals still to come.
/// Tapping a day opens its week.
struct MonthView: View {
    @Environment(\.theme) private var t
    @Query private var plan: [PlanEntryModel]
    @Query private var recipes: [RecipeModel]
    @Query private var members: [MemberModel]
    @Query private var settingsRows: [SettingsModel]
    var today: String
    var onPickWeek: (String) -> Void
    @State private var shift = 0

    var body: some View {
        let cal = Calendar(identifier: .gregorian)
        let base = cal.date(byAdding: .month, value: shift, to: DateKey.date(today)) ?? Date()
        let year = cal.component(.year, from: base), month = cal.component(.month, from: base)
        let weeks = PlanAhead.monthGrid(year: year, month: month)
        let repeats = TogetherState.of(settingsRows).repeats ?? []
        let inMonth: (String) -> Bool = { cal.component(.month, from: DateKey.date($0)) == month }
        let dinner: (String) -> PlanEntryModel? = { d in plan.first { $0.date == d && $0.slot == .dinner } }
        let planned = weeks.joined().filter { inMonth($0) && dinner($0)?.isDecided == true }.count
        let cols = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

        VStack(spacing: 10) {
            HStack {
                Button { withAnimation(Motion.settle) { shift -= 1 } } label: { Image(systemName: "chevron.left").iconButton() }
                    .accessibilityLabel("Previous month")
                Spacer()
                Text(base.formatted(.dateTime.month(.wide).year())).font(Type.heading)
                Spacer()
                Button { withAnimation(Motion.settle) { shift += 1 } } label: { Image(systemName: "chevron.right").iconButton() }
                    .accessibilityLabel("Next month")
            }
            .foregroundStyle(t.ink)
            Text("\(planned) dinners planned this month").font(Type.small).foregroundStyle(t.ink2)
            LazyVGrid(columns: cols, spacing: 4) {
                ForEach(Array(weeks[0].enumerated()), id: \.offset) { _, d in
                    Text(DateKey.date(d).formatted(.dateTime.weekday(.narrow))).font(Type.sans(11, weight: .semibold)).foregroundStyle(t.ink3)
                }
                ForEach(Array(weeks.joined()), id: \.self) { d in
                    let e = dinner(d)
                    let r = recipes.first { $0.id == (e?.recipeId ?? e?.leftoversOf) }
                    let label = r.map { e?.leftoversOf != nil ? "Leftovers" : $0.title } ?? e?.note
                    let weekly = label == nil && d >= today ? PlanAhead.repeatFor(repeats, d, .dinner) : nil
                    let weeklyLabel = weekly.map { w in recipes.first { $0.id == w.recipeId }?.title ?? w.note ?? "" }
                    let cook = members.first { $0.id == e?.cookId }
                    let isToday = d == today
                    Button { onPickWeek(d) } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 0) {
                                Text("\(DateKey.dayNumber(d))").font(Type.sans(12, weight: .semibold))
                                    .foregroundStyle(isToday ? t.accent : t.ink2)
                                Spacer(minLength: 0)
                                if let cook { Circle().fill(Theme.color(for: cook.color)).frame(width: 7, height: 7) }
                            }
                            if let label {
                                Text(label).font(Type.sans(10)).lineLimit(3).foregroundStyle(e?.done == true ? t.ink3 : t.ink)
                            } else if let weeklyLabel {
                                (Text(Image(systemName: "repeat")) + Text(" \(weeklyLabel)")).font(.system(size: 10)).lineLimit(2).foregroundStyle(t.ink3)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(4)
                        .frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading)
                        .background(inMonth(d) ? (e?.done == true ? t.surface2 : t.surface) : .clear, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(isToday ? t.accent : (inMonth(d) ? t.line : .clear), lineWidth: isToday ? 2 : 1))
                        .opacity(inMonth(d) ? 1 : 0.5)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(DateKey.longDate(d)): \(label ?? weeklyLabel.map { "\($0), every week" } ?? "nothing planned")\(cook.map { ", \($0.name) cooks" } ?? "")")
                }
            }
        }
    }
}
