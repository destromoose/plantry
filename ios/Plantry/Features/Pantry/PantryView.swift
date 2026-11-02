import SwiftUI
import SwiftData

struct PantryView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Query private var pantry: [PantryItemModel]
    @Query private var recipes: [RecipeModel]

    @State private var cookOpen = false
    @State private var active: PantryItemModel?
    @State private var name = ""
    @State private var zone: PantryZone = .fridge
    @FocusState private var nameFocused: Bool

    private var today: String { ctxProvider.today }

    private var options: [(name: String, zone: PantryZone?)] {
        var seen: [String: (String, PantryZone?)] = [:]
        var order: [String] = []
        for s in Seed.staples where seen[s.key] == nil { seen[s.key] = (s.name, s.zone); order.append(s.key) }
        for r in recipes { for i in r.ingredients where seen[i.key] == nil { seen[i.key] = (i.name, nil); order.append(i.key) } }
        return order.map { seen[$0]! }
    }

    var body: some View {
        let soon = pantry.filter { $0.freshness(today: today) < 0.35 }.count
        let grouped = PantryZone.allCases.map { z in (z, pantry.filter { $0.zone == z }.sorted { $0.freshness(today: today) < $1.freshness(today: today) }) }.filter { !$0.1.isEmpty }
        let q = name.trimmed.lowercased()
        let matches = q.isEmpty ? [] : Array(options.filter { $0.name.lowercased().contains(q) && $0.name.lowercased() != q }.prefix(6))

        Page {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Pantry").font(Type.hero).lineSpacing(-2)
                    Text("\(pluralize(pantry.count, "thing")), \(soon) should be used soon").font(Type.body).foregroundStyle(t.ink2)
                }
                Button { cookOpen = true } label: { Label("Cook from what I have", systemImage: "frying.pan") }
                    .pbutton(.primary, .sm).disabled(pantry.isEmpty)
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    PField(placeholder: "Add something you have", text: $name) { add() }
                        .focused($nameFocused)
                        .onChange(of: name) { _, v in if let s = Seed.staple(for: v) { zone = s.zone } }
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                    Button { add() } label: { Image(systemName: "plus").frame(width: 46, height: 46) }
                        .pbutton(.primary, .icon).disabled(name.isBlank).accessibilityLabel("Add to pantry")
                }
                HStack(spacing: 6) {
                    ForEach(PantryZone.allCases) { z in
                        Chip(label: z.label, selected: zone == z, small: true) { zone = z }
                    }
                }
                if !matches.isEmpty {
                    FlowLayout(spacing: 6) {
                        ForEach(matches, id: \.name) { o in
                            Button(o.name) { name = o.name; if let z = o.zone { zone = z } }
                                .font(.system(size: 13)).foregroundStyle(t.ink2)
                                .padding(.horizontal, 12).frame(height: 32)
                                .background(t.surface.opacity(0.7), in: Capsule())
                                .overlay(Capsule().strokeBorder(t.line, lineWidth: 1))
                        }
                    }
                    .accessibilityLabel("Suggestions")
                }
            }

            if pantry.isEmpty {
                EmptyState(systemImage: "refrigerator", title: "Your pantry is empty", body: "Add a few staples and Plantry can tell you what you can make tonight.") {
                    Button("Add 12 staples") {
                        Seed.quickPicks.prefix(12).forEach { store.addPantryItem(name: $0) }
                        toaster.show("Twelve staples added")
                    }
                    .pbutton()
                }
            } else {
                ForEach(grouped, id: \.0) { zone, items in
                    VStack(alignment: .leading, spacing: 12) {
                        Text(zone.label).font(Type.heading)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                            ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                                PantryTile(item: item, today: today) { active = item }
                                    .reveal(i)
                            }
                        }
                        .motion(Motion.settle, value: items.map(\.id))
                    }
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $active) { item in
            SheetChrome(title: item.name) {
                VStack(spacing: 8) {
                    Button("Restock (just bought more)") { store.restock(item); toaster.show("\(item.name) restocked"); active = nil }.pbutton(.secondary, .lg, fill: true)
                    Button("Used it up") { store.useUp(item); toaster.show("\(item.name) used up"); active = nil }.pbutton(.secondary, .lg, fill: true)
                    Button("Remove") { store.removePantryItem(item); toaster.show("\(item.name) removed"); active = nil }.pbutton(.danger, .lg, fill: true)
                }
            }
            .presentationDetents([.height(280)])
        }
        .sheet(isPresented: $cookOpen) {
            CookFromPantrySheet { cookOpen = false }
                .presentationDetents([.large])
        }
    }

    private func add() {
        let clean = name.trimmed
        guard !clean.isEmpty else { return }
        store.addPantryItem(name: clean, zone: zone)
        toaster.show("\(clean) is in the pantry")
        Haptic.tap()
        name = ""
    }
}

/// Freshness ring, name, and a swipe: right restocks, left uses up.
struct PantryTile: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    var item: PantryItemModel
    var today: String
    var onOpen: () -> Void
    @State private var drag: CGFloat = 0

    var body: some View {
        let f = item.freshness(today: today)
        let tone: RingTone = f > 0.5 ? .secondary : f >= 0.2 ? .accent : .danger
        Button(action: onOpen) {
            HStack(spacing: 12) {
                ProgressRing(value: f, size: 40, stroke: 4, tone: tone) {
                    Image(systemName: "leaf").font(.system(size: 13)).foregroundStyle(t.ink2)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name).font(Type.label).foregroundStyle(t.ink).lineLimit(1)
                    if f < 0.35 { Tag(text: "Use soon") }
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(minHeight: 72)
            .card()
        }
        .buttonStyle(PlainPressStyle())
        .offset(x: drag)
        .background(alignment: drag < 0 ? .trailing : .leading) {
            if abs(drag) > 20 {
                Image(systemName: drag < 0 ? "trash" : "arrow.counterclockwise")
                    .foregroundStyle(drag < 0 ? Theme.danger : t.secondary)
                    .padding(.horizontal, 14)
            }
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 16)
                .onChanged { v in if abs(v.translation.width) > abs(v.translation.height) { drag = v.translation.width * 0.6 } }
                .onEnded { v in
                    withAnimation(Motion.drift) { drag = 0 }
                    guard abs(v.translation.width) > abs(v.translation.height) else { return }
                    if v.translation.width < -90 { store.useUp(item); toaster.show("\(item.name) used up"); Haptic.tap() }
                    else if v.translation.width > 90 { store.restock(item); toaster.show("\(item.name) restocked"); Haptic.tap() }
                }
        )
        .accessibilityLabel("\(item.name), \(Int(f * 100)) percent fresh")
        .accessibilityAction(named: "Restock") { store.restock(item) }
        .accessibilityAction(named: "Used up") { store.useUp(item) }
    }
}

struct CookFromPantrySheet: View {
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    @Query private var pantry: [PantryItemModel]
    @Query(sort: \CookedModel.at, order: .reverse) private var cooked: [CookedModel]
    @Query private var settingsRows: [SettingsModel]
    var onPick: () -> Void

    var body: some View {
        let ctx = ctxProvider.context
        let results = suggest(SuggestInput(recipes: recipes.map(\.value), pantry: pantry.map(\.value), tastes: settingsRows.first?.tastes ?? [],
                                           weatherLean: ctx.weatherLean, isWeekend: ctx.isWeekend, today: ctxProvider.today, recent: cooked.prefix(60).map(\.recipeId)))
            .sorted { a, b in
                let ra = Double(a.have) / Double(max(a.total, 1)), rb = Double(b.have) / Double(max(b.total, 1))
                return ra != rb ? ra > rb : a.score > b.score
            }
            .prefix(6)
        SheetChrome(title: "Cook from what I have") {
            if results.isEmpty {
                Text("Nothing to cook from yet. Add a few things first.").font(Type.body).foregroundStyle(t.ink2)
            } else {
                VStack(spacing: 4) {
                    ForEach(Array(results)) { s in
                        Button { onPick(); nav.push(.recipe(s.recipe.id)) } label: {
                            HStack(spacing: 12) {
                                Thumb(url: s.recipe.imageUrl, size: 64, radius: 16)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.recipe.title).font(Type.cardTitle).lineLimit(1)
                                    Text("You have \(s.have) of \(s.total)").font(Type.small).foregroundStyle(t.ink2)
                                    if !s.missing.isEmpty { Text("Missing \(s.missing.joined(separator: ", "))").font(.system(size: 12)).foregroundStyle(t.ink3).lineLimit(1) }
                                }
                                Spacer()
                            }
                            .padding(8)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}
