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
                Button("Pick something to cook instead") { store.clearDinner(targetDate) }
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
                Button("Cook something else") { store.clearDinner(targetDate) }.pbutton(.outline)
            }
            .padding(20)
            .card(tint: t.surface2)
        } else if let planned {
            HeroCard(recipe: planned, scored: nil, planned: true, entry: entry, targetDate: targetDate, today: today, onShuffle: nil)
        } else if energy == .cantTonight {
            CantTonight(ranked: ranked, targetDate: targetDate, today: today)
        } else if ranked.isEmpty {
            EmptyState(systemImage: "fork.knife", title: "Nothing fits tonight", body: "Try a different energy level.")
        } else {
            Deck(ranked: ranked, entry: entry, targetDate: targetDate, today: today)
        }
    }
}

// MARK: - Deck

/// The swipeable suggestion. Drag past 100pt to shuffle; the card flies off and the next settles in.
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

    private var scored: Scored { ranked.first { $0.recipe.id == shownId } ?? ranked[0] }

    var body: some View {
        VStack(spacing: 12) {
            HeroCard(recipe: nil, scored: scored, planned: false, entry: entry, targetDate: targetDate, today: today, onShuffle: { shuffle(1) })
                .id(scored.recipe.id)
                .offset(x: drag.width + flying, y: drag.height * 0.2)
                .rotationEffect(.degrees(Double(drag.width + flying) / 30))
                .transition(.asymmetric(insertion: .scale(scale: 0.96).combined(with: .opacity).combined(with: .offset(y: 10)), removal: .identity))
                .simultaneousGesture(
                    DragGesture(minimumDistance: 16)
                        .onChanged { v in
                            guard abs(v.translation.width) > abs(v.translation.height) else { return }
                            drag = CGSize(width: v.translation.width, height: 0)
                        }
                        .onEnded { v in
                            if abs(v.translation.width) > 100 && abs(v.translation.width) > abs(v.translation.height) {
                                shuffle(v.translation.width > 0 ? 1 : -1)
                            } else {
                                withAnimation(Motion.drift) { drag = .zero }
                            }
                        }
                )
                .accessibilityAction(named: "Shuffle") { shuffle(1) }
            Text("Swipe the card to shuffle").font(.system(size: 12)).foregroundStyle(t.ink3)
        }
        .motion(Motion.drift, value: scored.recipe.id)
    }

    private func shuffle(_ direction: CGFloat) {
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
    @Environment(\.theme) private var t
    @Query private var pantry: [PantryItemModel]
    @Query private var members: [MemberModel]
    var recipe: RecipeModel?
    var scored: Scored?
    var planned: Bool
    var entry: PlanEntryModel?
    var targetDate: String
    var today: String
    var onShuffle: (() -> Void)?
    @State private var handoff = false
    @State private var save = false

    private var value: Recipe { recipe?.value ?? scored!.recipe }

    var body: some View {
        let r = value
        let cov = coverage(r, pantry: pantry.map(\.value))
        let tags = (scored?.reasons ?? []).filter { !$0.hasPrefix("Only missing") && $0 != "You have everything" }
        let cook = members.first { $0.id == entry?.cookId }

        VStack(alignment: .leading, spacing: 0) {
            Button { nav.push(.recipe(r.id)) } label: {
                RemoteImage(url: r.imageUrl).aspectRatio(4 / 3, contentMode: .fit).frame(maxHeight: 360)
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
                            Label("Serves \(r.servings)", systemImage: "person.2")
                        }
                        .font(Type.small).foregroundStyle(t.ink2)
                    }
                    Spacer(minLength: 0)
                    ProgressRing(value: cov.ratio, size: 48, stroke: 5, tone: cov.missing.isEmpty ? .secondary : .accent) {
                        Text("\(cov.have)").font(Type.display(14))
                    }
                }

                (Text("You have \(cov.have) of \(cov.total).").fontWeight(.medium) + Text(" \(cov.line).").foregroundColor(t.ink2))
                    .font(Type.body)

                if !tags.isEmpty {
                    HStack(spacing: 8) { ForEach(tags, id: \.self) { Tag(text: $0) } }
                        .accessibilityLabel("Why this one: \(tags.joined(separator: ", "))")
                }
                if planned, let cook { Text("\(cook.name) is cooking.").font(Type.small).foregroundStyle(t.ink3) }

                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        if planned {
                            Button { nav.cooking = CookRequest(recipeId: r.id, date: targetDate) } label: { Label("Cook", systemImage: "arrow.right") }
                                .pbutton(.primary, .lg)
                        } else {
                            Button { lockIn(r) } label: { Label("Lock it in", systemImage: "lock") }.pbutton(.primary, .lg)
                            Button { onShuffle?() } label: { Label("Shuffle", systemImage: "arrow.2.squarepath") }.pbutton(.secondary, .lg)
                        }
                    }
                    HStack(spacing: 4) {
                        Button { handoff = true } label: { Label("Hand off", systemImage: "hand.wave") }.pbutton(.ghost, .sm)
                        if planned {
                            Button("Not feeling it") { store.clearDinner(targetDate) }.pbutton(.ghost, .sm)
                        } else {
                            Button("Save for another night") { save = true }.pbutton(.ghost, .sm)
                        }
                    }
                }
                .padding(.top, 6)
            }
            .padding(20)
        }
        .card()
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
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
        store.setDinner(targetDate, recipeId: r.id, cookId: entry?.cookId)
        store.shuffleSeen = []
        Haptic.success()
        if !quiet { toaster.show("Tonight's handled.") }
    }
}

// MARK: - Can't tonight

struct CantTonight: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
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
                        store.setDinner(targetDate, leftoversOf: lo.id); toaster.show("Leftovers it is")
                    } label: {
                        option(thumb: lo.imageUrl, icon: nil, title: "Leftovers", sub: "\(lo.title), already made")
                    }
                    .buttonStyle(RowButtonStyle(tint: t.surface2))
                }
                ForEach(Array(easy)) { s in
                    Button {
                        store.setDinner(targetDate, recipeId: s.recipe.id); toaster.show("Tonight's handled.")
                    } label: {
                        option(thumb: s.recipe.imageUrl, icon: nil, title: s.recipe.title, sub: "\(formatMinutes(s.recipe.activeMinutes)) hands-on")
                    }
                    .buttonStyle(RowButtonStyle())
                }
                Button {
                    store.setDinner(targetDate, note: "Takeout"); toaster.show("Takeout, sorted")
                } label: {
                    option(thumb: nil, icon: "takeoutbag.and.cup.and.straw", title: "Order in, no guilt", sub: "We'll mark tonight as takeout.")
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
