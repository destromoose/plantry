import SwiftUI
import SwiftData

struct WeekView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Navigator.self) private var nav
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    @Query private var plan: [PlanEntryModel]
    @Query private var pantry: [PantryItemModel]
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query(sort: \CookedModel.at, order: .reverse) private var cooked: [CookedModel]
    @Query private var settingsRows: [SettingsModel]

    @State private var offset = 0
    @State private var active: DaySheet?
    @State private var mealPick: MealPick?

    private var today: String { ctxProvider.today }
    private var weekDates: [String] { DateKey.weekOf(DateKey.addDays(today, offset * 7)) }

    private func entry(for d: String) -> PlanEntryModel? { plan.first { $0.date == d && $0.slot == .dinner } }

    var body: some View {
        let dates = weekDates
        let decided = dates.filter { entry(for: $0)?.isDecided == true }.count
        Page {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: "\(DateKey.monthDay(dates[0])) to \(DateKey.monthDay(dates[6]))")
                Text("Your week").font(Type.hero).lineSpacing(-2)
                HStack(spacing: 4) {
                    Button { withAnimation(Motion.settle) { offset -= 1 } } label: { Image(systemName: "chevron.left").iconButton() }
                        .accessibilityLabel("Previous week")
                    Button { withAnimation(Motion.settle) { offset += 1 } } label: { Image(systemName: "chevron.right").iconButton() }
                        .accessibilityLabel("Next week")
                    if offset != 0 {
                        Button("This week") { withAnimation(Motion.settle) { offset = 0 } }.pbutton(.outline, .sm)
                    }
                    Spacer()
                    Button { fillWeek(dates) } label: { Label("Fill my week", systemImage: "sparkles") }.pbutton(.primary, .sm)
                }
                .foregroundStyle(t.ink)
                .padding(.top, 10)
            }

            VStack(spacing: 12) {
                ForEach(Array(dates.enumerated()), id: \.element) { i, date in
                    DayRow(date: date, today: today, entry: entry(for: date), onPick: { active = DaySheet(date: date, kind: .pick) }, onMenu: { active = DaySheet(date: date, kind: .menu) },
                           smallSlots: Meals.small(settingsRows.first?.meals ?? MealSlot.allCases), plan: plan, onMeal: { mealPick = MealPick(date: date, slot: $0) })
                        .reveal(i)
                }
            }
            .id(dates[0])

            HStack(spacing: 16) {
                ProgressRing(value: Double(decided) / 7, size: 56, stroke: 6, tone: decided == 7 ? .secondary : .accent) {
                    Text("\(decided)").font(Type.display(16))
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(decided) of 7 decided").font(Type.cardTitle)
                    Text(decided == 7 ? "Every night is handled." : "Undecided nights stay quiet until you want them.").font(Type.small).foregroundStyle(t.ink2)
                }
                Spacer(minLength: 0)
            }
            .padding(20)
            .card()
            .overlay(alignment: .bottomTrailing) { EmptyView() }

            Button("Make the shopping list") {
                let result = store.generateShop(dates: dates, today: today)
                if result.kept { toaster.show("Nothing left to buy for these nights") }
                nav.go(.shop)
            }
            .pbutton(decided == 0 ? .secondary : .primary, .lg, fill: true)
            .disabled(decided == 0)
            .padding(.top, -16)
        }
        .navigationTitle("Week")
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $active) { sheet in
            DaySheets(sheet: sheet, today: today, weekDates: dates, onCooked: cookDay) { active = $0 }
                .presentationDetents(sheet.kind == .pick ? [.large] : [.medium, .large])
        }
        .sheet(item: $mealPick) { p in
            MealSheet(pick: p, today: today).presentationDetents([.medium, .large])
        }
    }

    private func cookDay(_ date: String) {
        let e = entry(for: date)
        let r = recipes.first { $0.id == (e?.recipeId ?? e?.leftoversOf) }
        let undo = store.undoable { _ = store.markCooked(date, leftovers: (r?.leftovers ?? false) && e?.recipeId != nil) }
        ctxProvider.refresh()
        toaster.show("Cooked. Nicely done.") { undo(); ctxProvider.refresh() }
        Haptic.success()
    }

    private func fillWeek(_ dates: [String]) {
        guard TapGuard.allow("fill-week") else { return }
        let undo = store.undoable { fill(dates) }
        ctxProvider.refresh()
        Haptic.success()
        toaster.show(filledCount > 0 ? "Week filled. Shuffle anything you don't fancy." : "Nothing left to fill this week") { undo(); ctxProvider.refresh() }
    }

    @State private var filledCount = 0

    private func fill(_ dates: [String]) {
        let ctx = ctxProvider.context
        let settings = settingsRows.first
        let avoid = Diet.householdAvoid(settingsAvoid: settings?.avoid ?? [], members: members.map(\.value))
        var used = Set(plan.filter { dates.contains($0.date) && $0.slot == .dinner }.compactMap(\.recipeId))
        var filled = 0
        let recipeValues = recipes.map(\.value)
        let pantryValues = pantry.map(\.value)
        let recent = cooked.prefix(60).map(\.recipeId)
        for date in dates where date >= today {
            let current = store.dinner(on: date)
            if current?.isDecided == true { continue }
            let prev = store.dinner(on: DateKey.addDays(date, -1))
            if let prevRecipe = store.recipe(prev?.recipeId), prevRecipe.leftovers, date > today {
                store.setDinner(date, leftoversOf: prevRecipe.id, cookId: current?.cookId)
                filled += 1
                continue
            }
            // A little variety: pick from the top three instead of always the first.
            let ranked = suggest(SuggestInput(recipes: recipeValues, pantry: pantryValues, tastes: settings?.tastes ?? [], weatherLean: ctx.weatherLean, isWeekend: DateKey.isWeekend(date), today: today, recent: recent, exclude: used, avoid: avoid))
            let pick = ranked.prefix(3).randomElement() ?? suggest(SuggestInput(recipes: recipeValues, pantry: pantryValues, tastes: settings?.tastes ?? [], weatherLean: ctx.weatherLean, isWeekend: ctx.isWeekend, today: today, avoid: avoid)).first
            guard let pick else { continue }
            used.insert(pick.recipe.id)
            store.setDinner(date, recipeId: pick.recipe.id, cookId: current?.cookId)
            filled += 1
        }
        filledCount = filled
    }
}

struct DayRow: View {
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    @Query private var members: [MemberModel]
    var date: String
    var today: String
    var entry: PlanEntryModel?
    var onPick: () -> Void
    var onMenu: () -> Void
    var smallSlots: [MealSlot] = []
    var plan: [PlanEntryModel] = []
    var onMeal: (MealSlot) -> Void = { _ in }

    var body: some View {
        let recipe = recipes.first { $0.id == entry?.recipeId }
        let lo = recipes.first { $0.id == entry?.leftoversOf }
        let cook = members.first { $0.id == entry?.cookId }
        let isToday = date == today
        let past = date < today
        let done = entry?.done ?? false
        let decided = entry?.isDecided ?? false

        VStack(spacing: 0) {
        HStack(spacing: 12) {
            VStack(spacing: 1) {
                Text(DateKey.shortDay(date).uppercased()).font(.system(size: 11, weight: .semibold)).kerning(1)
                Text("\(DateKey.dayNumber(date))").font(Type.display(21))
            }
            .frame(width: 56, height: 56)
            .background(isToday ? t.accent : t.surface2, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .foregroundStyle(isToday ? t.accentInk : t.ink)

            if decided {
                Button {
                    if let recipe { nav.push(.recipe(recipe.id)) } else { onMenu() }
                } label: {
                    HStack(spacing: 12) {
                        if let recipe {
                            Thumb(url: recipe.imageUrl, size: 56, radius: 12)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(recipe.title).font(Type.cardTitle).lineSpacing(-1).lineLimit(2).foregroundStyle(done ? t.ink3 : t.ink)
                                Text("\(formatMinutes(recipe.activeMinutes)) hands-on").font(Type.small).foregroundStyle(t.ink3)
                            }
                        } else if let lo {
                            Thumb(url: lo.imageUrl, size: 56, radius: 12).opacity(0.8)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Leftovers: \(lo.title)").font(Type.cardTitle).lineSpacing(-1).lineLimit(2)
                                Text("Easy night").font(Type.small).foregroundStyle(t.ink3)
                            }
                        } else {
                            Text(entry?.note ?? "").font(Type.cardTitle)
                        }
                        Spacer(minLength: 0)
                    }
                    .multilineTextAlignment(.leading)
                    .frame(minHeight: 56)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .transition(.opacity.combined(with: .offset(y: 6)))
            } else {
                Button(action: onPick) {
                    Label("Pick something", systemImage: "plus")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(t.ink2)
                        .frame(maxWidth: .infinity, minHeight: 56)
                }
                .buttonStyle(RowButtonStyle(tint: .clear, dashed: true))
                .transition(.opacity.combined(with: .offset(y: 6)))
            }

            if done {
                Image(systemName: "checkmark").font(.system(size: 15, weight: .bold)).foregroundStyle(t.secondary)
                    .transition(.scale)
                    .accessibilityLabel("Cooked")
            }
            if let cook { Avatar(member: cook, size: 28) }
            Button(action: onMenu) { Image(systemName: "ellipsis").iconButton() }
                .foregroundStyle(t.ink2)
                .accessibilityLabel("Options for \(DateKey.dayLabel(date, today: today))")
        }
        .padding(.leading, 12)
        .padding(.trailing, 4)
        .padding(.vertical, 12)
        .opacity(past || done ? 0.7 : 1)
        if !smallSlots.isEmpty {
            MealLines(date: date, today: today, slots: smallSlots, plan: plan, recipes: recipes, onTap: onMeal)
                .opacity(past ? 0.8 : 1)
        }
        }
        .card()
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(isToday ? t.accent : .clear, lineWidth: 2))
        .motion(Motion.checkPop, value: done)
        .motion(Motion.settle, value: decided)
    }
}
