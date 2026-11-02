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
    @State private var zone: PantryZone?
    @State private var search = ""
    @FocusState private var nameFocused: Bool

    private var today: String { ctxProvider.today }

    private var options: [(name: String, zone: PantryZone?)] {
        var seen: [String: (String, PantryZone?)] = [:]
        var order: [String] = []
        for s in Seed.staples where seen[s.key] == nil { seen[s.key] = (s.name, s.zone); order.append(s.key) }
        for r in recipes { for i in r.ingredients where seen[i.key] == nil { seen[i.key] = (i.name, nil); order.append(i.key) } }
        return order.map { seen[$0]! }
    }

    private var effectiveZone: PantryZone { zone ?? PantryGuess.zone(for: name) }

    var body: some View {
        let soon = pantry.filter { $0.isUseSoon(today: today) }.count
        let needle = search.trimmed.lowercased()
        let shown = needle.isEmpty ? pantry : pantry.filter { $0.name.lowercased().contains(needle) }
        let grouped = PantryZone.allCases.map { z in (z, shown.filter { $0.zone == z }.sorted { $0.freshness(today: today) < $1.freshness(today: today) }) }.filter { !$0.1.isEmpty }
        let q = name.trimmed.lowercased()
        let matches = q.isEmpty ? [] : Array(options.filter { $0.name.lowercased().contains(q) && $0.name.lowercased() != q }.prefix(6))

        Page {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Pantry").font(Type.hero).lineSpacing(-2)
                    Text(pantry.isEmpty ? "Nothing in it yet" : "\(pluralize(pantry.count, "thing")), \(soon == 0 ? "nothing on its last legs" : "\(soon) to use soon")").font(Type.body).foregroundStyle(t.ink2)
                }
                Button { cookOpen = true } label: { Label("Cook from what I have", systemImage: "frying.pan") }
                    .pbutton(.primary, .sm).disabled(pantry.isEmpty)
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    PField(placeholder: "Add something you have", text: $name) { add() }
                        .focused($nameFocused)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                    Button { add() } label: { Image(systemName: "plus").frame(width: 46, height: 46) }
                        .pbutton(name.isBlank ? .secondary : .primary, .icon).disabled(name.isBlank).accessibilityLabel("Add to pantry")
                }
                HStack(spacing: 6) {
                    ForEach(PantryZone.allCases) { z in
                        Chip(label: z.label, selected: effectiveZone == z, small: true) { zone = z }
                    }
                }
                .accessibilityLabel("Where it lives")
                if !matches.isEmpty {
                    FlowLayout(spacing: 6) {
                        ForEach(matches, id: \.name) { o in
                            Button(o.name) { name = o.name; zone = o.zone }
                                .font(.system(size: 13)).foregroundStyle(t.ink2)
                                .padding(.horizontal, 12).frame(height: 36)
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
                if pantry.count > 8 {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass").foregroundStyle(t.ink3)
                        TextField("Find something", text: $search).font(Type.body)
                        if !search.isEmpty { Button { search = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(t.ink3).frame(width: 44, height: 44) }.accessibilityLabel("Clear search") }
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 46)
                    .background(t.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(t.line, lineWidth: 1))
                }
                if grouped.isEmpty {
                    Text("Nothing matches.").font(Type.body).foregroundStyle(t.ink2)
                }
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
            PantryItemSheet(item: item)
                .presentationDetents([.large])
        }
        .sheet(isPresented: $cookOpen) {
            CookFromPantrySheet { cookOpen = false }
                .presentationDetents([.large])
        }
    }

    private func add() {
        let clean = name.trimmed
        guard !clean.isEmpty else { return }
        let result = store.addPantryItem(name: clean, zone: effectiveZone)
        toaster.show(result == .added ? "\(clean) is in the pantry" : "\(clean) was already there, so it's marked fresh")
        Haptic.tap()
        name = ""
        zone = nil
    }
}

/// Freshness ring, name, amount, and a clear sideways swipe: right restocks, left uses up (with undo).
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
        let amount = Quantity.format(item.quantity, item.unit)
        Button(action: onOpen) {
            HStack(spacing: 12) {
                ProgressRing(value: f, size: 40, stroke: 4, tone: tone, label: "\(Int(f * 100)) percent fresh") {
                    Image(systemName: "leaf").font(.system(size: 13)).foregroundStyle(t.ink2)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.name).font(Type.label).foregroundStyle(t.ink).lineLimit(1)
                    HStack(spacing: 6) {
                        if !amount.isEmpty { Text(amount).font(.system(size: 12)).foregroundStyle(t.ink2) }
                        if item.isUseSoon(today: today) { Tag(text: "Use soon") }
                    }
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
            DragGesture(minimumDistance: 24)
                .onChanged { v in if abs(v.translation.width) > abs(v.translation.height) * 1.5 { drag = v.translation.width * 0.6 } }
                .onEnded { v in
                    withAnimation(Motion.drift) { drag = 0 }
                    guard abs(v.translation.width) > abs(v.translation.height) * 1.5 else { return }
                    if v.translation.width < -110 { useUp() }
                    else if v.translation.width > 110 { store.restock(item); toaster.show("\(item.name) restocked"); Haptic.tap() }
                }
        )
        .accessibilityLabel("\(item.name), \(Int(f * 100)) percent fresh\(amount.isEmpty ? "" : ", \(amount)")")
        .accessibilityAction(named: "Restock") { store.restock(item) }
        .accessibilityAction(named: "Used up") { useUp() }
    }

    private func useUp() {
        let name = item.name
        var listed = false
        let undo = store.undoable { listed = store.useUp(item) }
        Haptic.tap()
        toaster.show(listed ? "\(name) used up and back on your list" : "\(name) used up") { undo() }
    }
}

/// Edit one item: name, amount, where it lives, how long it keeps. Plus restock, used up, remove.
struct PantryItemSheet: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    var item: PantryItemModel
    @State private var name = ""
    @State private var amount = ""
    @State private var unit = ""
    @State private var zone: PantryZone = .fridge
    @State private var life = 7
    @State private var loaded = false

    var body: some View {
        SheetChrome(title: item.name) {
            VStack(alignment: .leading, spacing: 18) {
                field("Name") { PField(placeholder: "Name", text: $name) }
                HStack(spacing: 10) {
                    field("Amount") { PField(placeholder: "e.g. 500", text: $amount).keyboardType(.decimalPad) }
                    field("Unit") { PField(placeholder: "g, ml, whole", text: $unit).autocorrectionDisabled() }
                }
                field("Where it lives") {
                    FlowLayout(spacing: 6) { ForEach(PantryZone.allCases) { z in Chip(label: z.label, selected: zone == z, small: true) { zone = z } } }
                }
                field("Keeps for about") {
                    HStack {
                        Text("\(pluralize(life, "day"))").font(Type.body)
                        Spacer()
                        Stepper(value: $life, range: 1...365, label: "days")
                    }
                }
                Button("Save") { save() }.pbutton(.primary, .lg, fill: true)
                Divider().overlay(t.line)
                HStack(spacing: 8) {
                    Button("Restocked") { store.restock(item); toaster.show("\(item.name) restocked"); dismiss() }.pbutton(.secondary)
                    Button("Used it up") {
                        let n = item.name
                        var listed = false
                        let undo = store.undoable { listed = store.useUp(item) }
                        toaster.show(listed ? "\(n) used up and back on your list" : "\(n) used up") { undo() }
                        dismiss()
                    }
                    .pbutton(.secondary)
                    Spacer()
                    Button("Remove") {
                        let n = item.name
                        let undo = store.undoable { store.removePantryItem(item) }
                        toaster.show("\(n) removed") { undo() }
                        dismiss()
                    }
                    .pbutton(.danger, .sm)
                }
            }
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            name = item.name; amount = item.quantity.map { Quantity.niceNumber($0) } ?? ""; unit = item.unit ?? ""
            zone = item.zone; life = item.softLifeDays
        }
    }

    private func field<C: View>(_ label: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 13, weight: .medium)).foregroundStyle(t.ink2)
            content()
        }
    }

    private func save() {
        let q = amount.isBlank ? nil : Quantity.parse(amount)
        if !amount.isBlank && q == nil { toaster.show("That amount doesn't read as a number"); return }
        store.updatePantryItem(item, name: name, zone: zone, quantity: .some(q), unit: .some(unit.isBlank ? nil : unit.trimmed), softLifeDays: life)
        Haptic.success()
        dismiss()
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
    @Query private var members: [MemberModel]
    var onPick: () -> Void

    var body: some View {
        let ctx = ctxProvider.context
        let avoid = Diet.householdAvoid(settingsAvoid: settingsRows.first?.avoid ?? [], members: members.map(\.value))
        let results = suggest(SuggestInput(recipes: recipes.map(\.value), pantry: pantry.map(\.value), tastes: settingsRows.first?.tastes ?? [],
                                           weatherLean: ctx.weatherLean, isWeekend: ctx.isWeekend, today: ctxProvider.today, recent: cooked.prefix(60).map(\.recipeId), avoid: avoid))
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
