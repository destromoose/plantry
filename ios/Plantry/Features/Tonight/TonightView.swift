import SwiftUI
import SwiftData

/// The home screen. One honest answer for tonight, and nothing else that competes with it.
struct TonightView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    @Query private var pantry: [PantryItemModel]
    @Query private var plan: [PlanEntryModel]
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query(sort: \CookedModel.at, order: .reverse) private var cooked: [CookedModel]
    @Query private var settingsRows: [SettingsModel]

    private var ctx: AppContext { ctxProvider.context }
    private var today: String { ctxProvider.today }
    private var target: String { ctx.targetDate }
    private var settings: SettingsModel? { settingsRows.first }
    private var energy: Energy? { settings?.energyByDate[target] }
    private var entry: PlanEntryModel? { plan.first { $0.date == target && $0.slot == .dinner } }
    private var me: MemberModel? { members.first { $0.isMe } ?? members.first }
    private var todayDone: Bool { plan.first { $0.date == today && $0.slot == .dinner }?.done ?? false }

    private var ranked: [Scored] {
        suggest(SuggestInput(
            recipes: recipes.map(\.value),
            pantry: pantry.map(\.value),
            tastes: settings?.tastes ?? [],
            energy: energy,
            weatherLean: ctx.weatherLean,
            isWeekend: DateKey.isWeekend(target),
            today: today,
            recent: cooked.prefix(60).map(\.recipeId),
            avoid: Diet.householdAvoid(settingsAvoid: settings?.avoid ?? [], members: members.map(\.value))
        ))
    }

    private var greeting: String {
        switch ctx.mood {
        case .dawn: "Morning"
        case .day: "Afternoon"
        case .dusk: "Evening"
        case .night: "Late one"
        }
    }

    var body: some View {
        Page {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    Eyebrow(text: ctx.targetLabel)
                    if ctx.canStayTonight {
                        Button("Still tonight?") { ctxProvider.stayTonight() }
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(t.accent).frame(minHeight: 32)
                            .accessibilityHint("Keep planning for today instead of tomorrow")
                    }
                }
                Text(DateKey.longDate(target)).font(Type.title).lineSpacing(-2)
                Text(todayDone && target != today ? "Tonight's cooked. Here's tomorrow." : (me.map { "\(greeting), \($0.name)." } ?? "\(greeting)."))
                    .font(Type.body).foregroundStyle(t.ink2)
            }
            .reveal(0)

            EnergyPicker(energy: energy, label: ctx.targetLabel) { e in
                store.setEnergy(target, e)
                Haptic.tap()
            }
            .reveal(1)

            SinceLookedCard()
                .reveal(1)

            TonightTogether(date: target, label: ctx.targetLabel)
                .reveal(1)

            TonightHero(ranked: ranked, entry: entry, energy: energy, targetDate: target, today: today, reason: ctx.reason)
                .reveal(2)

            NudgeCard(nudge: ctx.nudge, targetDate: target, today: today, now: ctx.now, entry: entry)
                .reveal(3)

            VStack(alignment: .leading, spacing: 0) {
                SectionTitle("Next three days")
                NextDays(target: target)
            }
            .reveal(4)

            if ctx.isWeekend && ctx.hour < 13 {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Eyebrow(text: "Sunday ritual")
                        Text("Ten minutes now saves five decisions later.").font(Type.cardTitle)
                    }
                    Spacer()
                    Button("Plan the week") { nav.go(.week) }.pbutton(.secondary, .sm)
                }
                .padding(20)
                .card()
                .reveal(5)
            }

            if settings?.weatherEnabled == false && settings?.weatherDismissed == false {
                WeatherOptIn()
                    .reveal(6)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) { Logo(withWord: false, size: 24) }
            ToolbarItem(placement: .topBarTrailing) { SecondaryMenu() }
        }
        .onChange(of: plan.map(\.id)) { ctxProvider.refresh() }
        .onChange(of: plan.map(\.done)) { ctxProvider.refresh() }
    }
}

// MARK: - Energy

/// A compact row of three chips, so the dinner stays above the fold.
struct EnergyPicker: View {
    @Environment(\.theme) private var t
    var energy: Energy?
    var label: String
    var onSet: (Energy) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("How are you \(label.lowercased() == "tomorrow" ? "tomorrow" : "tonight")?").font(Type.heading)
            HStack(spacing: 8) {
                ForEach(Energy.allCases) { option in
                    let selected = option == energy
                    Button { onSet(option) } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(option.label).font(.system(size: 14, weight: .semibold)).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                            Text(option.hint).font(.system(size: 11)).foregroundStyle(selected ? t.accentInk.opacity(0.8) : t.ink3).lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .foregroundStyle(selected ? t.accentInk : t.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .frame(maxHeight: .infinity, alignment: .topLeading)
                        .frame(minHeight: 64)
                        .background(selected ? t.accent : t.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(selected ? t.accent : t.line, lineWidth: 1))
                    }
                    .buttonStyle(PlainPressStyle())
                    .accessibilityLabel("\(option.label). \(option.hint)")
                    .accessibilityAddTraits(selected ? [.isSelected] : [])
                }
            }
            .motion(Motion.settle, value: energy)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Your energy")
    }
}

// MARK: - Nudge

struct NudgeCard: View {
    @Environment(Store.self) private var store
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    @Query private var plan: [PlanEntryModel]
    var nudge: Nudge
    var targetDate: String
    var today: String
    var now: Date
    var entry: PlanEntryModel?
    @State private var hidden = false

    private var recipe: RecipeModel? { recipes.first { $0.id == entry?.recipeId } }

    var body: some View {
        if !hidden, let content = content {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(content.title).font(Type.cardTitle).lineSpacing(-1)
                    if let body = content.body { Text(body).font(Type.small).foregroundStyle(t.ink2) }
                }
                Spacer(minLength: 0)
                if let action = content.action {
                    Button(action.0, action: action.1).pbutton(.primary, .sm).fixedSize()
                }
                Button { withAnimation(Motion.settle) { hidden = true } } label: { Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).iconButton() }
                    .foregroundStyle(t.ink2)
                    .accessibilityLabel("Dismiss")
            }
            .padding(.leading, 18)
            .padding(.trailing, 6)
            .padding(.vertical, 16)
            .card()
            .overlay(alignment: .leading) {
                UnevenRoundedRectangle(topLeadingRadius: Radius.card, bottomLeadingRadius: Radius.card)
                    .fill(t.accent).frame(width: 4)
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .accessibilityElement(children: .combine)
        }
    }

    private struct Content { var title: String; var body: String?; var action: (String, () -> Void)? }

    private var content: Content? {
        switch nudge {
        case .none: return nil
        case .planWeek:
            return Content(title: "It's a good morning to plan the week", body: "A few minutes now and the weekday scramble mostly goes away.", action: ("Open the week", { nav.go(.week) }))
        case .defrost:
            guard let recipe, let ing = recipe.ingredients.first(where: { $0.aisle == .frozen || $0.aisle == .meatFish }) else { return nil }
            return Content(title: "Take the \(ing.name.lowercased()) out of the freezer", body: "For \(recipe.title). It will thank you by dinner.", action: nil)
        case .startNow:
            guard let recipe else { return nil }
            let eat = now.addingTimeInterval(Double(recipe.totalMinutes) * 60)
            let time = eat.formatted(date: .omitted, time: .shortened)
            return Content(title: "Start now and you'll eat by \(time)", body: "\(recipe.title) takes \(formatMinutes(recipe.totalMinutes)) start to finish.",
                           action: ("Cook", { nav.cooking = CookRequest(recipeId: recipe.id, date: targetDate) }))
        case .leftovers:
            let yesterday = DateKey.addDays(today, -1)
            guard let y = plan.first(where: { $0.date == yesterday && $0.slot == .dinner && $0.done }),
                  let r = recipes.first(where: { $0.id == y.recipeId && $0.leftovers }) else { return nil }
            let already = entry?.leftoversOf == r.id
            let rid = r.id
            let cookId = entry?.cookId
            let when = targetDate == today ? "tonight" : "tomorrow"
            var action: (String, () -> Void)? = nil
            if !already { action = ("Have it \(when)", { store.setDinner(targetDate, leftoversOf: rid, cookId: cookId) }) }
            return Content(title: "There's \(r.title) in the fridge from yesterday", body: "Already cooked. Tonight can be easy.", action: action)
        }
    }
}

// MARK: - Next days

struct NextDays: View {
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query private var plan: [PlanEntryModel]
    @Query private var recipes: [RecipeModel]
    @Query private var members: [MemberModel]
    var target: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(1...3, id: \.self) { n in
                    let d = DateKey.addDays(target, n)
                    let e = plan.first { $0.date == d && $0.slot == .dinner }
                    let r = recipes.first { $0.id == (e?.recipeId ?? e?.leftoversOf) }
                    let title: String? = e?.recipeId != nil ? r?.title : (e?.leftoversOf != nil ? "Leftovers: \(r?.title ?? "")" : e?.note)
                    let cook = members.first { $0.id == e?.cookId }
                    Button { nav.go(.week) } label: {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text(DateKey.shortDay(d).uppercased()).font(Type.eyebrow).kerning(1.4).foregroundStyle(t.ink3)
                                Spacer()
                                if let cook { Avatar(member: cook, size: 24) }
                            }
                            Text(title ?? "Nothing yet")
                                .font(title == nil ? Type.body : Type.display(16))
                                .foregroundStyle(title == nil ? t.ink3 : t.ink)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                        }
                        .padding(16)
                        .frame(width: 176, height: 108, alignment: .topLeading)
                        .card()
                    }
                    .buttonStyle(PlainPressStyle())
                    .accessibilityLabel("\(DateKey.dayLabel(d, today: target)): \(title ?? "Nothing yet")")
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
        }
        .padding(.horizontal, -20)
        .scrollTargetBehavior(.viewAligned)
    }
}

// MARK: - Weather opt in

struct WeatherOptIn: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(\.theme) private var t
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "cloud.sun").foregroundStyle(t.ink2)
            Text("Let Plantry peek at the weather? Rainy nights lean cozy. Only a rough location is sent.").font(Type.small).foregroundStyle(t.ink2)
            Spacer(minLength: 0)
            Button("Sure") { store.update { $0.weatherEnabled = true }; Task { await ctxProvider.refreshWeather() } }.pbutton(.secondary, .sm).fixedSize()
            Button { store.update { $0.weatherDismissed = true } } label: { Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).iconButton() }
                .foregroundStyle(t.ink2)
                .accessibilityLabel("Dismiss")
        }
        .padding(.leading, 16)
        .padding(.trailing, 4)
        .padding(.vertical, 8)
        .card()
    }
}
