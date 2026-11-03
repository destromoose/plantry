import SwiftUI
import SwiftData

/// The answer. Planned dinner, leftovers, a note, the easy way out, or the shuffle deck.
struct TonightHero: View {
    @Environment(Store.self) private var store
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    var ranked: [Scored]
    var entry: PlanEntryModel?
    var energy: Energy?
    var targetDate: String
    var today: String
    var reason: String

    private var planned: RecipeModel? { recipes.first { $0.id == entry?.recipeId } }
    private var leftoverOf: RecipeModel? { recipes.first { $0.id == entry?.leftoversOf } }

    var body: some View {
        if recipes.isEmpty {
            EmptyState(systemImage: "fork.knife", title: "No recipes yet", body: "Add a recipe and Plantry can start deciding for you.") {
                Button("Open recipes") { nav.go(.recipes) }.pbutton()
            }
        } else if let note = entry?.note, planned == nil, leftoverOf == nil, !note.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: "Decided")
                Text(note).font(Type.title)
                Text("Dinner is handled. Nothing to wash.").font(Type.body).foregroundStyle(t.ink2)
                Button("Cook something instead") { store.clearDinner(targetDate) }
                    .pbutton(.secondary).padding(.top, 14)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
            .card()
        } else if let leftoverOf {
            VStack(alignment: .leading, spacing: 14) {
                Button { nav.push(.recipe(leftoverOf.id)) } label: {
                    RemoteImage(url: leftoverOf.imageUrl).frame(height: 112).clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(PlainPressStyle())
                .accessibilityLabel("Open \(leftoverOf.title)")
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow(text: "Calm night")
                    Text("Leftovers: \(leftoverOf.title)").font(Type.title).lineSpacing(-2)
                    Text("Already cooked. Heat, plate, done.").font(Type.body).foregroundStyle(t.ink2)
                }
                HStack(spacing: 8) {
                    if entry?.done != true {
                        Button("Eaten") { store.markCooked(targetDate, usePantry: false); Haptic.success() }.pbutton(.primary)
                    }
                    Button("Cook something else") { store.clearDinner(targetDate) }.pbutton(.outline)
                }
            }
            .padding(20)
            .card(tint: t.surface2)
        } else if let planned {
            HeroCard(recipe: planned, scored: nil, planned: true, entry: entry, targetDate: targetDate, today: today, onShuffle: nil)
        } else if energy == .cantTonight {
            CantTonight(ranked: ranked, targetDate: targetDate, today: today)
        } else if ranked.isEmpty {
            EmptyState(systemImage: "fork.knife", title: "Nothing fits tonight", body: "Try a different energy level, or check what the household avoids in Settings.")
        } else {
            Deck(ranked: ranked, entry: entry, targetDate: targetDate, today: today)
        }
    }
}

// MARK: - Deck

/// The swipeable suggestion. A clear sideways drag shuffles; a slip does nothing.
struct Deck: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Environment(\.plantryReduceMotion) private var reduce
    var ranked: [Scored]
    var entry: PlanEntryModel?
    var targetDate: String
    var today: String

    @State private var shownId: String?
    @State private var drag: CGSize = .zero
    @State private var flying: CGFloat = 0

    /// The shown card, skipping anything already passed over today when there is a choice.
    private var scored: Scored {
        if let s = ranked.first(where: { $0.recipe.id == shownId }) { return s }
        return ranked.first { !store.shuffleSeen.contains($0.recipe.id) } ?? ranked[0]
    }

    var body: some View {
        VStack(spacing: 12) {
            HeroCard(recipe: nil, scored: scored, planned: false, entry: entry, targetDate: targetDate, today: today, onShuffle: { shuffle(1) })
                .id(scored.recipe.id)
                .offset(x: drag.width + flying, y: drag.height * 0.2)
                .rotationEffect(.degrees(Double(drag.width + flying) / 30))
                .transition(.asymmetric(insertion: .scale(scale: 0.96).combined(with: .opacity).combined(with: .offset(y: 10)), removal: .identity))
                .simultaneousGesture(
                    DragGesture(minimumDistance: 24)
                        .onChanged { v in
                            guard abs(v.translation.width) > abs(v.translation.height) * 1.5 else { return }
                            drag = CGSize(width: v.translation.width, height: 0)
                        }
                        .onEnded { v in
                            if abs(v.translation.width) > 120 && abs(v.translation.width) > abs(v.translation.height) * 1.5 {
                                shuffle(v.translation.width > 0 ? 1 : -1)
                            } else {
                                withAnimation(Motion.drift) { drag = .zero }
                            }
                        }
                )
                .accessibilityAction(named: "Shuffle") { shuffle(1) }
            Text("Swipe the card sideways to shuffle").font(Type.small).foregroundStyle(t.ink2)
        }
        .motion(Motion.drift, value: scored.recipe.id)
    }

    private func shuffle(_ direction: CGFloat) {
        guard TapGuard.allow("shuffle", within: 0.5) else { return }
        guard ranked.count >= 2 else {
            toaster.show("That is the only one that fits tonight")
            withAnimation(Motion.drift) { drag = .zero }
            return
        }
        Haptic.tap()
        var seen = store.shuffleSeen
        if !seen.contains(scored.recipe.id) { seen.append(scored.recipe.id) }
        if seen.count >= ranked.count { seen = [scored.recipe.id] }
        let next = pickNext(ranked, seen: seen)
        store.shuffleSeen = seen
        let nextId = (next != nil && next!.recipe.id != scored.recipe.id) ? next!.recipe.id : ranked.first { $0.recipe.id != scored.recipe.id }?.recipe.id

        if reduce {
            drag = .zero; shownId = nextId
            return
        }
        withAnimation(Motion.drift) { flying = direction * 420 }
        Task {
            try? await Task.sleep(for: .milliseconds(140))
            drag = .zero
            flying = 0
            withAnimation(Motion.drift) { shownId = nextId }
        }
    }
}

// MARK: - The card

struct HeroCard: View {
    @Environment(Store.self) private var store
    @Environment(Navigator.self) private var nav
    @Environment(Toaster.self) private var toaster
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(\.theme) private var t
    @Query private var pantry: [PantryItemModel]
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query private var settingsRows: [SettingsModel]
    @Query private var handoffs: [HandoffModel]
    var recipe: RecipeModel?
    var scored: Scored?
    var planned: Bool
    var entry: PlanEntryModel?
    var targetDate: String
    var today: String
    var onShuffle: (() -> Void)?
    @State private var handoff = false
    @State private var save = false
    @State private var more = false

    private var value: Recipe { recipe?.value ?? scored!.recipe }
    private var canHandOff: Bool { members.filter(\.cooks).count > 1 }

    var body: some View {
        let r = value
        let cov = coverage(r, pantry: pantry.map(\.value))
        let tags = (scored?.reasons ?? []).filter { !$0.hasPrefix("Only missing") && $0 != "You have everything" }
        let cook = members.first { $0.id == entry?.cookId }
        let people = (planned ? entry?.servings : nil) ?? settingsRows.first?.cookingFor ?? r.servings
        let note = handoffs.first { $0.date == targetDate }
        let when = targetDate == today ? "tonight" : "tomorrow"

        VStack(alignment: .leading, spacing: 0) {
            Button { nav.push(.recipe(r.id)) } label: {
                RemoteImage(url: r.imageUrl).aspectRatio(16 / 10, contentMode: .fit).frame(maxHeight: 300)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open \(r.title)")

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Button { nav.push(.recipe(r.id)) } label: {
                            Text(r.title).font(Type.title).lineSpacing(-2).multilineTextAlignment(.leading).foregroundStyle(t.ink)
                        }
                        .buttonStyle(.plain)
                        HStack(spacing: 12) {
                            Label("\(formatMinutes(r.activeMinutes)) hands-on", systemImage: "clock")
                            Label("For \(people)", systemImage: "person.2")
                        }
                        .font(Type.small).foregroundStyle(t.ink2)
                    }
                    Spacer(minLength: 0)
                    ProgressRing(value: cov.ratio, size: 48, stroke: 5, tone: cov.missing.isEmpty ? .secondary : .accent, label: "\(cov.have) of \(cov.total) ingredients at home") {
                        Text("\(cov.have)").font(Type.display(14))
                    }
                }

                AvoidWarning(recipe: r)

                VStack(alignment: .leading, spacing: 4) {
                    (Text("You have \(cov.have) of \(cov.total).").fontWeight(.medium) + Text(" \(cov.line).").foregroundColor(t.ink2))
                        .font(Type.body)
                    if !cov.missing.isEmpty {
                        Button { addMissing(r, people: people) } label: { Label("Add \(cov.missing.count) to the list", systemImage: "plus").font(.system(size: 13, weight: .semibold)) }
                            .foregroundStyle(t.accent).frame(minHeight: 36)
                    }
                }

                if !tags.isEmpty {
                    HStack(spacing: 8) { ForEach(tags, id: \.self) { Tag(text: $0) } }
                        .accessibilityLabel("Why this one: \(tags.joined(separator: ", "))")
                }
                if planned, let note, let to = members.first(where: { $0.id == note.toId }) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(to.name) is cooking.").font(Type.small).foregroundStyle(t.ink2)
                        if let m = note.message, let from = members.first(where: { $0.id == note.fromId }) {
                            Text("\(from.name) says: “\(m)”").font(Type.small).italic().foregroundStyle(t.ink2)
                        }
                    }
                } else if planned, let cook {
                    let washer = store.washer(on: targetDate, cookId: cook.id)
                    Text(washer.map { "\(cook.name) is cooking, \($0.name) washes up." } ?? "\(cook.name) is cooking.").font(Type.small).foregroundStyle(t.ink3)
                }

                HStack(spacing: 8) {
                    if planned {
                        Button { nav.cooking = CookRequest(recipeId: r.id, date: targetDate) } label: { Label("Cook", systemImage: "arrow.right") }
                            .pbutton(.primary, .lg)
                    } else {
                        Button { lockIn(r) } label: { Label("Cook this \(when)", systemImage: "checkmark").lineLimit(1) }.pbutton(.primary, .lg)
                        Button { onShuffle?() } label: { Image(systemName: "arrow.2.squarepath").frame(width: 52, height: 52) }.pbutton(.secondary, .icon)
                            .accessibilityLabel("Shuffle")
                    }
                    Spacer(minLength: 0)
                    Button { more = true } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }.pbutton(.ghost, .icon)
                        .accessibilityLabel("More options")
                }
                .padding(.top, 6)
            }
            .padding(20)
        }
        .card()
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .sheet(isPresented: $more) {
            SheetChrome(title: r.title) {
                VStack(spacing: 8) {
                    if canHandOff {
                        Button { more = false; handoff = true } label: { Label("Ask someone else to cook", systemImage: "hand.wave") }.pbutton(.secondary, .lg, fill: true)
                    }
                    if planned {
                        Button("Not feeling it") {
                            more = false
                            var seen = store.shuffleSeen; seen.append(r.id); store.shuffleSeen = seen
                            let undo = store.undoable { store.clearDinner(targetDate) }
                            ctxProvider.refresh()
                            toaster.show("Cleared \(when). Pick another.") { undo(); ctxProvider.refresh() }
                        }
                        .pbutton(.secondary, .lg, fill: true)
                    } else {
                        Button("Save for another night") { more = false; save = true }.pbutton(.secondary, .lg, fill: true)
                    }
                    Button("Open the recipe") { more = false; nav.push(.recipe(r.id)) }.pbutton(.ghost, .lg, fill: true)
                }
            }
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $handoff) {
            HandoffSheet(recipe: r, date: targetDate) { if !planned { lockIn(r, quiet: true) } }
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $save) {
            SaveSheet(recipe: r, targetDate: targetDate, today: today) { onShuffle?() }
                .presentationDetents([.large])
        }
    }

    private func lockIn(_ r: Recipe, quiet: Bool = false) {
        guard TapGuard.allow("lock-in") else { return }
        store.setDinner(targetDate, recipeId: r.id, servings: settingsRows.first?.cookingFor, cookId: entry?.cookId)
        store.shuffleSeen = []
        ctxProvider.refresh()
        Haptic.success()
        if !quiet { toaster.show(targetDate == today ? "Planned for tonight" : "Planned for tomorrow") }
    }

    private func addMissing(_ r: Recipe, people: Int) {
        let keys = Set(pantry.map(\.key))
        let scale = Double(people) / Double(max(r.servings, 1))
        var added = 0
        for i in r.ingredients where !i.isOptional && !keys.contains(i.key) {
            if store.addShopItem(i.name, aisle: i.aisle, quantity: i.quantity > 0 ? i.quantity * scale : nil, unit: i.unit, recipeId: r.id) == .added { added += 1 }
        }
        toaster.show(added > 0 ? "\(added) added to your list" : "Already on your list")
    }
}

// MARK: - Can't tonight

struct CantTonight: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    @Query(sort: \CookedModel.at, order: .reverse) private var cooked: [CookedModel]
    var ranked: [Scored]
    var targetDate: String
    var today: String

    private var leftoverRecipe: RecipeModel? {
        cooked.filter { DateKey.daysBetween($0.date, today) >= 0 && DateKey.daysBetween($0.date, today) <= 2 }
            .compactMap { c in recipes.first { $0.id == c.recipeId } }
            .first { $0.leftovers }
    }

    var body: some View {
        let easy = ranked.filter { $0.recipe.activeMinutes <= 15 }.prefix(2)
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: "Can't tonight")
            Text("Fair. Here's the easy way out.").font(Type.title).lineSpacing(-2)
            Text("Pick whichever takes the least from you.").font(Type.body).foregroundStyle(t.ink2)
            VStack(spacing: 10) {
                if let lo = leftoverRecipe {
                    Button {
                        store.setDinner(targetDate, leftoversOf: lo.id); ctxProvider.refresh(); toaster.show("Leftovers it is")
                    } label: {
                        option(thumb: lo.imageUrl, icon: nil, title: "Leftovers", sub: "\(lo.title), already made")
                    }
                    .buttonStyle(RowButtonStyle(tint: t.surface2))
                }
                ForEach(Array(easy)) { s in
                    Button {
                        store.setDinner(targetDate, recipeId: s.recipe.id); ctxProvider.refresh(); toaster.show("Planned")
                    } label: {
                        option(thumb: s.recipe.imageUrl, icon: nil, title: s.recipe.title, sub: "\(formatMinutes(s.recipe.activeMinutes)) hands-on")
                    }
                    .buttonStyle(RowButtonStyle())
                }
                Button {
                    store.setDinner(targetDate, note: "Takeout"); ctxProvider.refresh(); toaster.show("Takeout, sorted")
                } label: {
                    option(thumb: nil, icon: "takeoutbag.and.cup.and.straw", title: "Order in tonight", sub: "We'll mark tonight as takeout.")
                }
                .buttonStyle(RowButtonStyle(dashed: true))
            }
            .padding(.top, 16)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .card()
    }

    private func option(thumb: String?, icon: String?, title: String, sub: String) -> some View {
        HStack(spacing: 12) {
            if let icon {
                Image(systemName: icon).foregroundStyle(t.ink2).frame(width: 48, height: 48).background(t.surface2, in: RoundedRectangle(cornerRadius: 12))
            } else {
                Thumb(url: thumb)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Type.label).foregroundStyle(t.ink)
                Text(sub).font(Type.small).foregroundStyle(t.ink2)
            }
            .lineLimit(1)
        }
        .padding(10)
        .frame(minHeight: 64)
    }
}
