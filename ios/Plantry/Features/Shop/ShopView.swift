import SwiftUI
import SwiftData

struct ShopView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Query(sort: \ShopItemModel.order) private var shop: [ShopItemModel]
    @Query private var recipes: [RecipeModel]
    @Query private var settingsRows: [SettingsModel]
    @State private var name = ""
    @State private var editing: ShopItemModel?
    @State private var confirmClear = false
    @State private var mineOnly = false
    @Query(sort: \MemberModel.order) private var members: [MemberModel]

    var body: some View {
        let unchecked = shop.filter { !$0.checked }.count
        let checked = shop.count - unchecked
        let titles = Dictionary(recipes.map { ($0.id, $0.title) }, uniquingKeysWith: { a, _ in a })
        let meId = members.first { $0.isMe }?.id
        let split = shop.contains { $0.splitTo != nil }
        let trip = ShopTogether.active(TogetherState.of(settingsRows).shopTrip)
        let visible = mineOnly && split ? shop.filter { $0.splitTo == nil || $0.splitTo == meId } : Array(shop)
        let groups = Aisle.allCases.map { a in
            let items = visible.filter { $0.aisle == a }
            return (a, items.filter { !$0.checked } + items.filter { $0.checked })
        }.filter { !$0.1.isEmpty }
        let dismissed = settingsRows.first?.shopDismissed.count ?? 0
        let itemNotes = newestNotes()

        Page {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Shop").font(Type.hero).lineSpacing(-2)
                    Text(shop.isEmpty ? "Nothing on the list" : "\(pluralize(unchecked, "thing")) to get\(checked > 0 ? ", \(checked) in the basket" : "")")
                        .font(Type.body).foregroundStyle(t.ink2)
                }
                if !shop.isEmpty {
                    HStack(spacing: 8) {
                        Button { fromPlan() } label: { Label("Add this week's dinners", systemImage: "calendar") }.pbutton(.secondary, .sm)
                        ShareLink(item: listText(groups)) { Label("Share", systemImage: "square.and.arrow.up") }.pbutton(.ghost, .sm)
                        Menu {
                            if dismissed > 0 { Button { store.restoreDismissed(); fromPlan() } label: { Label("Show \(pluralize(dismissed, "removed item"))", systemImage: "arrow.uturn.backward") } }
                            Button(role: .destructive) { confirmClear = true } label: { Label("Clear the list", systemImage: "trash") }
                        } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }
                        .pbutton(.ghost, .icon)
                        .accessibilityLabel("More")
                    }
                }
            }

            ShopTogetherCard(shop: shop, mineOnly: $mineOnly)

            VStack(alignment: .leading, spacing: 8) {
                PField(placeholder: "Milk, two onions, we're out of eggs…", text: $name) { add() }
                    .textInputAutocapitalization(.sentences)
                Text("Type or dictate a few things at once. \"Out of\" also takes it off the pantry.").font(Type.sans(12)).foregroundStyle(t.ink3)
                let usual = store.usuals(today: ctxProvider.today)
                if !usual.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Eyebrow(text: "Your usuals")
                            Spacer()
                            Button("Add all") {
                                for u in usual { store.addShopItem(u.entry.name, aisle: u.entry.aisle) }
                                toaster.show("\(pluralize(usual.count, "usual")) added")
                            }
                            .font(.system(size: 13, weight: .semibold)).foregroundStyle(t.accent).frame(minHeight: 32)
                        }
                        FlowLayout(spacing: 6) {
                            ForEach(usual, id: \.key) { u in
                                Chip(label: u.entry.name, small: true, systemImage: "plus") {
                                    store.addShopItem(u.entry.name, aisle: u.entry.aisle); Haptic.tap()
                                }
                            }
                        }
                    }
                    .padding(.top, 4)
                }
            }

            if shop.isEmpty {
                EmptyState(systemImage: "basket", title: "Nothing to buy", body: "Plan a few dinners, then add them here and the list fills in.") {
                    Button { fromPlan() } label: { Label("Add this week's dinners", systemImage: "calendar") }.pbutton(.secondary)
                }
            } else {
                ForEach(groups, id: \.0) { aisle, items in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(aisle.label).font(Type.heading)
                        VStack(spacing: 6) {
                            ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                                ShopRow(item: item, fromTitles: item.fromRecipeIds.compactMap { titles[$0] }, note: itemNotes[item.key],
                                        late: ShopTogether.isLateAdd(item.value, trip), members: members.count > 1 ? members : [],
                                        meId: meId) { editing = item }
                                    .reveal(i)
                            }
                        }
                        .motion(Motion.settle, value: items.map(\.id))
                    }
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .modifier(PullToRefresh())
        .safeAreaInset(edge: .bottom) {
            if checked > 0 {
                HStack(spacing: 8) {
                    Text("\(checked) in the basket").font(Type.small).foregroundStyle(t.ink2).lineLimit(1)
                    Spacer(minLength: 4)
                    Button("Clear") {
                        let undo = store.undoable { store.clearChecked() }
                        toaster.show("Checked items cleared") { undo() }
                    }
                    .pbutton(.ghost, .sm).fixedSize()
                    Button("Done shopping") {
                        guard TapGuard.allow("done-shopping") else { return }
                        let undo = store.undoable { store.finishShopping() }
                        toaster.show("Added to your pantry") { undo() }
                        Haptic.success()
                    }
                    .pbutton(.primary, .sm).fixedSize()
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(t.line.opacity(0.6), lineWidth: 1))
                .shadow(color: .black.opacity(0.15), radius: 14, y: 8)
                .padding(.horizontal, 20)
                .padding(.bottom, 8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .motion(Motion.settle, value: checked > 0)
        .sheet(item: $editing) { item in
            ShopItemSheet(item: item).presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $confirmClear) {
            SheetChrome(title: "Clear the whole list?") {
                Text("Every row goes, bought or not. You can undo straight after.").font(Type.body).foregroundStyle(t.ink2)
                HStack(spacing: 8) {
                    Button("Clear it") {
                        confirmClear = false
                        let undo = store.undoable { store.clearShop() }
                        toaster.show("List cleared") { undo() }
                    }
                    .pbutton(.danger)
                    Button("Keep it") { confirmClear = false }.pbutton(.ghost)
                }
                .padding(.top, 20)
            }
            .presentationDetents([.height(220)])
        }
    }

    private func add() {
        guard !name.isBlank else { return }
        let r = store.capture(name)
        if r.added + r.already == 0 { toaster.show("Couldn't make out anything to add") ; return }
        var parts: [String] = []
        if r.added > 0 { parts.append("\(pluralize(r.added, "thing")) added") }
        if r.already > 0 { parts.append("\(r.already) already on the list") }
        if r.outOf > 0 { parts.append("\(r.outOf) taken off the pantry") }
        toaster.show(parts.joined(separator: ", "))
        Haptic.tap()
        name = ""
    }

    /// Same week window as the Week screen: Monday to Sunday around today.
    private func fromPlan() {
        let result = store.generateShop(dates: DateKey.weekOf(ctxProvider.today), today: ctxProvider.today)
        if result.kept { toaster.show("No dinners planned this week yet, so the list stayed as it was") }
        else { toaster.show(result.fromPlan == 0 ? "Nothing left to buy for this week" : "\(pluralize(result.fromPlan, "item")) from your plan") }
    }

    private func listText(_ groups: [(Aisle, [ShopItemModel])]) -> String {
        groups.map { aisle, items in
            aisle.label + "\n" + items.map { i in
                let q = Quantity.format(i.amounts, forShopping: true)
                return "- \(i.name)" + (q.isEmpty ? "" : " (\(q))")
            }.joined(separator: "\n")
        }.joined(separator: "\n\n")
    }
}

extension ShopView {
    /// The newest note on each item, shown under its name: "get the Barilla one".
    func newestNotes() -> [String: String] {
        var out: [String: String] = [:]
        for n in Together.notes(TogetherState.of(settingsRows), on: .shop) {
            if let k = n.itemKey, out[k] == nil { out[k] = n.text }
        }
        return out
    }
}

struct ShopRow: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    var item: ShopItemModel
    var fromTitles: [String]
    var note: String? = nil
    /// Added by someone else while this phone's person is out shopping.
    var late = false
    /// The household, when there's more than one person, to show who added and ticked what.
    var members: [MemberModel] = []
    var meId: String? = nil
    var onEdit: () -> Void
    @State private var drag: CGFloat = 0
    @State private var armed = false

    var body: some View {
        let qty = Quantity.format(item.amounts, forShopping: true)
        let from = fromTitles.isEmpty ? nil : (fromTitles.count == 1 ? "for \(fromTitles[0])" : "for \(fromTitles[0]) + \(fromTitles.count - 1) more")
        let byId = { (id: String?) in id.flatMap { i in members.first { $0.id == i } } }
        let adder = byId(item.addedBy)
        let who: String? = adder.flatMap { a in
            let name = a.id == meId ? "You" : a.name
            if item.usedUp { return "\(name) used the last of it" }
            return a.id == meId || from != nil ? nil : "Added by \(a.name)"
        }
        let badge = byId(item.checked ? item.checkedBy : item.splitTo)
        HStack(spacing: 12) {
            Button {
                guard TapGuard.allow("shop-\(item.id)") else { return }
                store.toggleShopItem(item); Haptic.tap()
            } label: {
                ZStack {
                    Circle().fill(item.checked ? t.secondary : .clear)
                    Circle().strokeBorder(item.checked ? .clear : t.ink3, lineWidth: 2)
                    if item.checked {
                        Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(t.secondaryInk).transition(.scale)
                    }
                }
                .frame(width: 28, height: 28)
                .frame(width: 44, height: 44)
                .motion(Motion.checkPop, value: item.checked)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(item.checked ? [.isSelected] : [])
            .accessibilityLabel("\(item.name)\(qty.isEmpty ? "" : ", \(qty)")")
            .accessibilityHint(item.checked ? "In the basket. Tap to put back." : "Tap when it's in the basket.")

            Button(action: onEdit) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(item.name).font(Type.label).foregroundStyle(item.checked ? t.ink3 : t.ink).strikethrough(item.checked, color: t.ink3)
                    HStack(spacing: 6) {
                        if late {
                            Text("New").font(Type.sans(11, weight: .bold)).foregroundStyle(t.accentInk)
                                .padding(.horizontal, 6).padding(.vertical, 1).background(t.accent, in: Capsule())
                        }
                        if !qty.isEmpty { Text(qty) }
                        if let who, note == nil { Text(who) } else if let from, note == nil { Text(from) }
                    }
                    .font(.system(size: 12)).foregroundStyle(t.ink3).lineLimit(1)
                    if let note {
                        Label(note, systemImage: "text.bubble").font(Type.sans(12, weight: .medium)).foregroundStyle(t.accent).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Change \(item.name) or leave a note\(note.map { ". Note: \($0)" } ?? "")\(late ? ". New" : "")\(who.map { ". \($0)" } ?? "")")

            if let badge {
                Avatar(member: badge, size: 22)
                    .accessibilityLabel(item.checked ? "In \(badge.name)'s basket" : "\(badge.name)'s part")
            }

            Button { remove() } label: { Image(systemName: "xmark").font(.system(size: 12, weight: .semibold)).frame(width: 44, height: 44) }
                .foregroundStyle(t.ink3)
                .accessibilityLabel("Remove \(item.name)")
        }
        .padding(.leading, 4)
        .padding(.trailing, 2)
        .padding(.vertical, 4)
        .frame(minHeight: 52)
        .card()
        .offset(x: min(0, drag))
        .simultaneousGesture(
            DragGesture(minimumDistance: 24)
                .onChanged { v in
                    guard abs(v.translation.width) > abs(v.translation.height) * 1.5 else { return }
                    drag = v.translation.width * 0.6
                    let past = v.translation.width < -110
                    if past != armed { armed = past; if past { Haptic.tap() } }
                }
                .onEnded { v in
                    withAnimation(Motion.drift) { drag = 0 }
                    armed = false
                    guard abs(v.translation.width) > abs(v.translation.height) * 1.5 else { return }
                    if v.translation.width < -110 { remove() }
                }
        )
        .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .contextMenu {
            Button(action: onEdit) { Label("Change or leave a note", systemImage: "pencil") }
            Button(role: .destructive) { remove() } label: { Label("Remove", systemImage: "trash") }
        }
    }

    private func remove() {
        let n = item.name
        let undo = store.undoable { store.removeShopItem(item) }
        Haptic.tap()
        toaster.show("\(n) removed") { undo() }
    }
}

/// Edit a row's name and amount.
struct ShopItemSheet: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    var item: ShopItemModel
    @State private var name = ""
    @State private var amount = ""
    @State private var unit = ""
    @State private var loaded = false

    var body: some View {
        SheetChrome(title: item.name) {
            VStack(alignment: .leading, spacing: 16) {
                field("Name") { PField(placeholder: "Name", text: $name) }
                HStack(spacing: 10) {
                    field("Amount") { PField(placeholder: "e.g. 2", text: $amount).keyboardType(.decimalPad) }
                    field("Unit") { PField(placeholder: "g, ml, cans", text: $unit).autocorrectionDisabled() }
                }
                if item.more.count > 0 {
                    Text("Added up from recipes as \(Quantity.format(item.amounts)). A typed amount replaces that.").font(Type.small).foregroundStyle(t.ink3)
                }
                Button("Save") {
                    let q = amount.isBlank ? nil : Quantity.parse(amount)
                    if !amount.isBlank && q == nil { toaster.show("That amount doesn't read as a number"); return }
                    store.updateShopItem(item, name: name, quantity: q, unit: unit.isBlank ? nil : unit.trimmed)
                    dismiss()
                }
                .pbutton(.primary, .lg, fill: true)
                VStack(alignment: .leading, spacing: 10) {
                    Text("Notes on this").font(Type.cardTitle)
                    NotesThread(place: .shop, itemKey: item.key, placeholder: "Get the Barilla one, not the cheap one…")
                }
                .padding(.top, 8)
            }
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            name = item.name
            amount = item.quantity.map { Quantity.niceNumber($0) } ?? ""
            unit = item.unit ?? ""
        }
    }

    private func field<C: View>(_ label: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(Type.sans(13, weight: .medium)).foregroundStyle(t.ink2)
            content()
        }
    }
}
