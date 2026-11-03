import SwiftUI
import SwiftData

// Shopping together, a port of components/features/shop/ShopTogether.tsx: "I'm at the shop",
// splitting the list by aisle, and "Just mine". Shown only when the household has two or more people.

struct ShopTogetherCard: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query private var settingsRows: [SettingsModel]
    var shop: [ShopItemModel]
    @Binding var mineOnly: Bool

    var body: some View {
        if members.count > 1 {
            TimelineView(.periodic(from: .now, by: 60)) { tl in
                content(trip: ShopTogether.active(TogetherState.of(settingsRows).shopTrip, now: tl.date))
            }
        }
    }

    @ViewBuilder
    private func content(trip: ShopTogether.Trip?) -> some View {
        let meId = members.first { $0.isMe }?.id
        let open = shop.filter { !$0.checked }
        let split = shop.contains { $0.splitTo != nil }
        let mine = open.filter { $0.splitTo == meId }.count
        VStack(alignment: .leading, spacing: 12) {
            if let trip {
                let shopper = members.first { $0.id == trip.by }
                let isMe = trip.by == meId
                HStack(alignment: .center, spacing: 12) {
                    if let shopper { Avatar(member: shopper, size: 36) }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(isMe ? "You're at the shop" : "\(shopper?.name ?? "Someone") is at the shop").font(Type.label)
                        Text("since \(trip.start.formatted(date: .omitted, time: .shortened))").font(.system(size: 12)).foregroundStyle(t.ink3)
                        Text(isMe ? "Anything the others add shows up here, marked New." : "Add anything now and it goes straight onto their list.")
                            .font(Type.small).foregroundStyle(t.ink2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if isMe {
                        Button("I'm done") { store.endShopTrip(); Haptic.tap() }.pbutton(.secondary, .sm).fixedSize()
                    }
                }
                .accessibilityElement(children: .combine)
            } else {
                FlowLayout(spacing: 8) {
                    Button {
                        store.startShopTrip(); Haptic.success()
                        toaster.show("The others can see you're at the shop")
                    } label: { Label("I'm at the shop", systemImage: "cart") }
                    .pbutton(.primary, .sm)
                    if !split && open.count >= 4 {
                        Button {
                            let n = store.splitShop()
                            if n > 0 { mineOnly = true; toaster.show("Split by aisle. Each of you has your own part of the shop.") }
                        } label: { Label("Split the list", systemImage: "person.2") }
                        .pbutton(.secondary, .sm)
                    }
                }
            }
            if split {
                if trip != nil { Divider().overlay(t.line) }
                FlowLayout(spacing: 8) {
                    Chip(label: "Just mine (\(mine))", selected: mineOnly, small: true) { mineOnly = true }
                    Chip(label: "Everything (\(open.count))", selected: !mineOnly, small: true) { mineOnly = false }
                    Button("Undo split") { store.clearSplit(); mineOnly = false }
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(t.ink2).frame(minHeight: 36)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(tint: trip != nil ? t.accent.opacity(0.08) : nil)
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
            .strokeBorder(trip != nil ? t.accent.opacity(0.4) : .clear, lineWidth: 1))
        .animation(Motion.settle, value: trip?.by)
    }
}

/// On Tonight: "Sam is at the shop. Need anything?" while someone else is shopping.
struct ShopperLink: View {
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query private var settingsRows: [SettingsModel]

    var body: some View {
        let meId = members.first { $0.isMe }?.id
        if let trip = ShopTogether.active(TogetherState.of(settingsRows).shopTrip), trip.by != meId,
           let shopper = members.first(where: { $0.id == trip.by }) {
            Button { nav.go(.shop) } label: {
                HStack(spacing: 8) {
                    Image(systemName: "cart").foregroundStyle(t.accent)
                    Text("\(shopper.name) is at the shop. Need anything?").foregroundStyle(t.accent)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(t.ink3)
                }
                .font(.system(size: 14, weight: .semibold))
                .frame(minHeight: 40)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }
}
