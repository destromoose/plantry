import SwiftUI
import SwiftData

// "Since you last looked" and "Pick together", ports of SinceLooked.tsx and PickTogether.tsx.

/// What the others changed since this person last looked, so nobody has to ask "did you see?".
struct SinceLookedCard: View {
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @AppStorage(ActivityLog.key) private var data = Data()
    @AppStorage(ActivityLog.seenKey) private var seenAt = ""

    var body: some View {
        let all = (try? JSONDecoder().decode([HouseActivity].self, from: data)) ?? []
        let fresh = all.filter { seenAt.isEmpty || $0.at > seenAt }
        if members.count > 1 && !fresh.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Label("Since you last looked", systemImage: "sparkles").font(Type.cardTitle)
                ForEach(fresh.prefix(5)) { a in
                    Button { go(a.place) } label: {
                        HStack(spacing: 10) {
                            if let by = members.first(where: { $0.id == a.by }) { Avatar(member: by, size: 24) } else { Color.clear.frame(width: 24, height: 24) }
                            Text(a.text).font(.system(size: 15, weight: a.forMe == true ? .semibold : .regular)).foregroundStyle(t.ink)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 4)
                            Text(Together.ago(a.at)).font(Type.sans(12)).foregroundStyle(t.ink3)
                        }
                        .frame(minHeight: 40)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if fresh.count > 5 { Text("and \(fresh.count - 5) more").font(Type.small).foregroundStyle(t.ink3) }
                Button("Got it") { withAnimation(Motion.settle) { seenAt = ISO.now() } }.pbutton(.secondary, .sm)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
        }
    }

    private func go(_ place: HouseActivity.Place?) {
        switch place {
        case .shop: nav.go(.shop)
        case .week: nav.go(.week)
        case .household: nav.push(.household)
        case .tonight, nil: break
        }
    }
}

/// Pick together: each person goes through the same few dinners on their own phone, yes or
/// no. A yes is an idea; a yes on something the other already liked is a match.
struct PickTogetherSheet: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    @Query private var pantry: [PantryItemModel]
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query(sort: \CookedModel.at, order: .reverse) private var cooked: [CookedModel]
    @Query private var settingsRows: [SettingsModel]
    @State private var deck: [Recipe] = []
    @State private var index = 0
    @State private var drag: CGFloat = 0

    var body: some View {
        SheetChrome(title: "Pick together") {
            VStack(alignment: .leading, spacing: 14) {
                Text("Say yes or no to a few dinners. The others do the same on their phones, and what you both like is a match in Ideas.")
                    .font(Type.small).foregroundStyle(t.ink2)
                if index < deck.count {
                    let card = deck[index]
                    let meId = members.first { $0.isMe }?.id
                    VStack(alignment: .leading, spacing: 0) {
                        Thumb(url: card.imageUrl, size: 320, radius: 0)
                            .frame(maxWidth: .infinity, maxHeight: 190).clipped()
                        VStack(alignment: .leading, spacing: 4) {
                            Text(card.title).font(Type.title).lineLimit(2)
                            Text("\(formatMinutes(card.activeMinutes)) hands-on"
                                 + (store.ideas.contains { $0.recipeId == card.id && $0.by != meId } ? " · Someone said yes" : ""))
                                .font(Type.small).foregroundStyle(t.ink3)
                        }
                        .padding(16)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    .offset(x: drag)
                    .rotationEffect(.degrees(Double(drag) / 30))
                    .gesture(DragGesture()
                        .onChanged { drag = $0.translation.width }
                        .onEnded { v in
                            if v.translation.width > 90 { answer(true) } else if v.translation.width < -90 { answer(false) }
                            withAnimation(Motion.drift) { drag = 0 }
                        })
                    .id(card.id)
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
                    .accessibilityElement(children: .combine)
                    .accessibilityAction(named: "Yes please") { answer(true) }
                    .accessibilityAction(named: "Not this") { answer(false) }

                    HStack(spacing: 12) {
                        Button { answer(false) } label: { Label("Not this", systemImage: "xmark") }.pbutton(.outline, .lg, fill: true)
                        Button { answer(true) } label: { Label("Yes please", systemImage: "heart") }.pbutton(.primary, .lg, fill: true)
                    }
                    Text("\(deck.count - index) left. Swipe right for yes, left for no.").font(Type.sans(12)).foregroundStyle(t.ink3)
                        .frame(maxWidth: .infinity)
                } else {
                    VStack(spacing: 8) {
                        Text("That's all for now").font(Type.cardTitle)
                        Text("Your yeses are in Ideas. Matches show at the top.").font(Type.small).foregroundStyle(t.ink2)
                        Button("Done") { dismiss() }.pbutton(.primary).padding(.top, 8)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                }
            }
            .animation(Motion.settle, value: index)
        }
        .onAppear(perform: makeDeck)
    }

    /// Ideas the others said yes to come first, so a match is quick to find.
    private func makeDeck() {
        guard deck.isEmpty else { return }
        let meId = members.first { $0.isMe }?.id
        let ideas = store.ideas
        let answered = Set(ideas.filter { $0.recipeId != nil && ($0.by == meId || ($0.votes ?? []).contains(meId ?? "")) }.compactMap(\.recipeId))
        let theirs = ideas.compactMap { i in i.recipeId.flatMap { id in answered.contains(id) ? nil : recipes.first { $0.id == id }?.value } }
        let settings = settingsRows.first
        let ranked = suggest(SuggestInput(recipes: recipes.map(\.value), pantry: pantry.map(\.value), tastes: settings?.tastes ?? [],
                                          weatherLean: ctxProvider.context.weatherLean, isWeekend: ctxProvider.context.isWeekend, today: ctxProvider.today,
                                          recent: cooked.prefix(60).map(\.recipeId),
                                          avoid: Diet.householdAvoid(settingsAvoid: settings?.avoid ?? [], members: members.map(\.value))))
            .map(\.recipe)
            .filter { r in !answered.contains(r.id) && !theirs.contains { $0.id == r.id } }
        deck = Array((theirs + ranked).prefix(12))
    }

    private func answer(_ yes: Bool) {
        guard index < deck.count else { return }
        let card = deck[index]
        index += 1
        Haptic.tap()
        guard yes else { return }
        let meId = members.first { $0.isMe }?.id
        if let theirs = store.ideas.first(where: { $0.recipeId == card.id && $0.by != meId && !($0.votes ?? []).contains(meId ?? "") }) {
            store.toggleIdeaVote(theirs.id)
            let who = members.first { $0.id == theirs.by }?.name ?? "Someone"
            Haptic.success()
            toaster.show("It's a match: \(card.title). \(who) fancies it too.")
        } else {
            store.addIdea(card.title)
        }
    }
}
