import SwiftUI
import SwiftData

struct ShopView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Query(sort: \ShopItemModel.order) private var shop: [ShopItemModel]
    @Query private var recipes: [RecipeModel]
    @State private var name = ""

    var body: some View {
        let unchecked = shop.filter { !$0.checked }.count
        let checked = shop.count - unchecked
        let titles = Dictionary(recipes.map { ($0.id, $0.title) }, uniquingKeysWith: { a, _ in a })
        let groups = Aisle.allCases.map { a in
            let items = shop.filter { $0.aisle == a }
            return (a, items.filter { !$0.checked } + items.filter { $0.checked })
        }.filter { !$0.1.isEmpty }

        Page {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Shop").font(Type.hero).lineSpacing(-2)
                    Text(shop.isEmpty ? "Nothing on the list" : "\(pluralize(unchecked, "thing")) to get\(checked > 0 ? ", \(checked) in the basket" : "")")
                        .font(Type.body).foregroundStyle(t.ink2)
                }
                if !shop.isEmpty {
                    HStack(spacing: 8) {
                        Button { fromPlan() } label: { Label("From my plan", systemImage: "calendar") }.pbutton(.secondary, .sm)
                        ShareLink(item: listText(groups)) { Label("Share", systemImage: "square.and.arrow.up") }.pbutton(.ghost, .sm)
                    }
                }
            }

            PField(placeholder: "Add something", text: $name) { add() }
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()

            if shop.isEmpty {
                EmptyState(systemImage: "basket", title: "Nothing to buy", body: "Plan a few dinners and the list writes itself.") {
                    Button { fromPlan() } label: { Label("From my plan", systemImage: "calendar") }.pbutton(.secondary)
                }
            } else {
                ForEach(groups, id: \.0) { aisle, items in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(aisle.label).font(Type.heading)
                        VStack(spacing: 6) {
                            ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                                ShopRow(item: item, fromTitle: item.fromRecipeIds.compactMap { titles[$0] }.first)
                                    .reveal(i)
                            }
                        }
                        .motion(Motion.settle, value: items.map(\.id))
                    }
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .bottom) {
            if checked > 0 {
                HStack(spacing: 8) {
                    Text("\(checked) in the basket").font(Type.small).foregroundStyle(t.ink2).lineLimit(1)
                    Spacer(minLength: 4)
                    Button("Clear") { store.clearChecked() }.pbutton(.ghost, .sm).fixedSize()
                    Button("Done shopping") { store.finishShopping(); toaster.show("Added to your pantry"); Haptic.success() }.pbutton(.primary, .sm).fixedSize()
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
    }

    private func add() {
        guard !name.isBlank else { return }
        store.addShopItem(name)
        Haptic.tap()
        name = ""
    }

    private func fromPlan() {
        let dates = (0..<7).map { DateKey.addDays(ctxProvider.context.targetDate, $0) }
        store.generateShop(dates: dates)
        let n = store.fetch(ShopItemModel.self).filter { !$0.fromRecipeIds.isEmpty }.count
        toaster.show("\(n) items from your plan")
    }

    private func listText(_ groups: [(Aisle, [ShopItemModel])]) -> String {
        groups.map { aisle, items in
            aisle.label + "\n" + items.map { i in
                let q = formatQuantity(i.quantity, i.unit)
                return "- \(i.name)" + (q.isEmpty ? "" : " (\(q))")
            }.joined(separator: "\n")
        }.joined(separator: "\n\n")
    }
}

struct ShopRow: View {
    @Environment(Store.self) private var store
    @Environment(\.theme) private var t
    var item: ShopItemModel
    var fromTitle: String?
    @State private var drag: CGFloat = 0

    var body: some View {
        let qty = formatQuantity(item.quantity, item.unit)
        HStack(spacing: 12) {
            Button { store.toggleShopItem(item); Haptic.tap() } label: {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(item.checked ? t.secondary : .clear)
                        Circle().strokeBorder(item.checked ? .clear : t.ink3, lineWidth: 2)
                        if item.checked {
                            Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(t.secondaryInk).transition(.scale)
                        }
                    }
                    .frame(width: 28, height: 28)
                    .motion(Motion.checkPop, value: item.checked)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(item.name).font(Type.label).foregroundStyle(item.checked ? t.ink3 : t.ink).strikethrough(item.checked, color: t.ink3)
                        HStack(spacing: 6) {
                            if !qty.isEmpty { Text(qty) }
                            if let fromTitle { Text("for \(fromTitle)") }
                        }
                        .font(.system(size: 12)).foregroundStyle(t.ink3).lineLimit(1)
                    }
                    Spacer()
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(item.checked ? [.isSelected] : [])
            .accessibilityLabel(item.name)
            Button { store.removeShopItem(item) } label: { Image(systemName: "xmark").font(.system(size: 12, weight: .semibold)).iconButton() }
                .foregroundStyle(t.ink3)
                .accessibilityLabel("Remove \(item.name)")
        }
        .padding(.leading, 12)
        .padding(.trailing, 2)
        .padding(.vertical, 6)
        .frame(minHeight: 52)
        .card()
        .offset(x: min(0, drag))
        .simultaneousGesture(
            DragGesture(minimumDistance: 16)
                .onChanged { v in if abs(v.translation.width) > abs(v.translation.height) { drag = v.translation.width * 0.6 } }
                .onEnded { v in
                    withAnimation(Motion.drift) { drag = 0 }
                    guard abs(v.translation.width) > abs(v.translation.height) else { return }
                    if v.translation.width < -90 { store.removeShopItem(item); Haptic.tap() }
                }
        )
    }
}
