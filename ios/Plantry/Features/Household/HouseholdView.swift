import SwiftUI
import SwiftData

struct HouseholdView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query private var plan: [PlanEntryModel]
    @Query private var recipes: [RecipeModel]
    @Query(sort: \HandoffModel.createdAt, order: .reverse) private var handoffs: [HandoffModel]
    @Query private var cooked: [CookedModel]
    @Query private var settingsRows: [SettingsModel]

    @State private var newName = ""
    @State private var editing: MemberModel?
    @State private var editName = ""
    @State private var claimDate: String?

    private var today: String { ctxProvider.context.targetDate }
    private var word: String { (settingsRows.first?.householdWord ?? .household).label }

    private func member(_ id: String?) -> MemberModel? { members.first { $0.id == id } }
    private func dinner(_ date: String) -> PlanEntryModel? { plan.first { $0.date == date && $0.slot == .dinner } }
    private func describe(_ date: String) -> String {
        guard let e = dinner(date) else { return "Open" }
        if let id = e.recipeId { return recipes.first { $0.id == id }?.title ?? "Dinner" }
        if let id = e.leftoversOf { return "Leftovers: \(recipes.first { $0.id == id }?.title ?? "last night")" }
        return e.note ?? "Open"
    }

    var body: some View {
        let week = DateKey.weekOf(today)
        let weekSet = Set(week)
        let decided = plan.filter { $0.slot == .dinner && weekSet.contains($0.date) && $0.date <= today && $0.isDecided }.count
        let cookedThisWeek = cooked.filter { weekSet.contains($0.date) }
        let open = week.filter { $0 >= today && !(dinner($0)?.isDecided ?? false) }.count
        let byCook = Dictionary(grouping: cookedThisWeek, by: { $0.cookId ?? "" }).mapValues(\.count)

        Page {
            VStack(alignment: .leading, spacing: 4) {
                Text(word).font(Type.hero).lineSpacing(-2)
                Text("Everyone here is a person, not a shared password. Nights can be claimed or handed off.").font(Type.body).foregroundStyle(t.ink2)
            }

            VStack(alignment: .leading, spacing: 0) {
                SectionTitle("Who's cooking")
                VStack(spacing: 0) {
                    ForEach(members) { m in
                        HStack(spacing: 12) {
                            Avatar(member: m, size: 44)
                            if editing?.id == m.id {
                                PField(placeholder: "Name", text: $editName) { commitRename() }
                                    .onSubmit { commitRename() }
                            } else {
                                Button { editing = m; editName = m.name } label: {
                                    HStack(spacing: 8) {
                                        Text(m.name).font(Type.label).foregroundStyle(t.ink)
                                        if m.isMe { Text("you").font(Type.small).foregroundStyle(t.ink3) }
                                    }
                                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Rename \(m.name)")
                            }
                            if !m.isMe {
                                Button { store.removeMember(m) } label: { Image(systemName: "xmark").iconButton() }
                                    .foregroundStyle(t.ink2).accessibilityLabel("Remove \(m.name)")
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        Divider().overlay(t.line)
                    }
                    HStack(spacing: 8) {
                        PField(placeholder: "Add someone", text: $newName) { addMember() }
                        Button { addMember() } label: { Label("Add", systemImage: "plus") }.pbutton(.secondary).disabled(newName.isBlank)
                    }
                    .padding(8)
                }
                .card()
            }

            VStack(alignment: .leading, spacing: 0) {
                SectionTitle("This week")
                VStack(spacing: 0) {
                    ForEach(Array(week.enumerated()), id: \.element) { i, date in
                        let cook = member(dinner(date)?.cookId)
                        Button { claimDate = date } label: {
                            HStack(spacing: 12) {
                                Text(DateKey.shortDay(date)).font(.system(size: 14, weight: .semibold)).foregroundStyle(date == today ? t.accent : t.ink3).frame(width: 40, alignment: .leading)
                                Text(describe(date)).font(Type.body).foregroundStyle(t.ink).lineLimit(1)
                                Spacer()
                                if let cook { Avatar(member: cook, size: 28) } else { Text("Nobody yet").font(Type.small).foregroundStyle(t.ink3) }
                            }
                            .padding(.horizontal, 16)
                            .frame(minHeight: 56)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(DateKey.shortDay(date)): \(describe(date)). \(cook.map { "Cooking: \($0.name)" } ?? "Nobody yet"). Change who cooks.")
                        .reveal(i)
                        if i < 6 { Divider().overlay(t.line) }
                    }
                }
                .card()
            }

            VStack(alignment: .leading, spacing: 0) {
                SectionTitle("Hand-offs")
                if handoffs.isEmpty {
                    Text("No hand-offs yet. On the Tonight screen, tap Hand off to pass a night to someone.")
                        .font(Type.body).foregroundStyle(t.ink2).padding(20).frame(maxWidth: .infinity, alignment: .leading).card()
                } else {
                    VStack(spacing: 10) {
                        ForEach(handoffs.prefix(8)) { h in
                            let from = member(h.fromId), to = member(h.toId)
                            let title = recipes.first { $0.id == h.recipeId }?.title
                            HStack(alignment: .top, spacing: 12) {
                                if let to { Avatar(member: to, size: 36) }
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("\(DateKey.weekdayName(h.date))'s dinner").font(Type.label)
                                    if let title { Text(title).font(Type.cardTitle) }
                                    Text("\(from?.name ?? "Someone") → \(to?.name ?? "someone")").font(Type.small).foregroundStyle(t.ink2)
                                    if let m = h.message { Text("“\(m)”").font(Type.small).italic().foregroundStyle(t.ink2) }
                                }
                                Spacer()
                                if h.accepted {
                                    Image(systemName: "checkmark").foregroundStyle(t.secondary).accessibilityLabel("Accepted")
                                } else {
                                    Button("Got it") { store.acceptHandoff(h); toaster.show("Handed over. Done.") }.pbutton(.secondary, .sm)
                                }
                            }
                            .padding(16)
                            .card()
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 0) {
                SectionTitle("This week")
                VStack(alignment: .leading, spacing: 6) {
                    Text("You decided dinner \(pluralize(decided, "time")) this week.").font(Type.cardTitle)
                    ForEach(members) { m in
                        if let n = byCook[m.id], n > 0 {
                            Text("\(m.name) cooked \(pluralize(n, "night")).").font(Type.body).foregroundStyle(t.ink2)
                        }
                    }
                    Text(open == 0 ? "Every night is spoken for." : "\(pluralize(open, "night")) still open.").font(Type.body).foregroundStyle(t.ink2)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .card()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .sheet(isPresented: Binding(get: { claimDate != nil }, set: { if !$0 { claimDate = nil } })) {
            if let date = claimDate {
                SheetChrome(title: "Who is cooking \(DateKey.dayLabel(date, today: today).lowercased())?") {
                    VStack(spacing: 8) {
                        ForEach(members) { m in
                            Button {
                                store.claimNight(date, cookId: m.id); toaster.show("\(m.name) has it"); claimDate = nil
                            } label: {
                                HStack(spacing: 12) {
                                    Avatar(member: m); Text(m.name).font(Type.label); Spacer()
                                    if dinner(date)?.cookId == m.id { Image(systemName: "checkmark").foregroundStyle(t.secondary).accessibilityLabel("Current cook") }
                                }
                                .padding(.horizontal, 16).frame(minHeight: 56)
                            }
                            .buttonStyle(RowButtonStyle())
                        }
                        if dinner(date)?.cookId != nil {
                            Button("Nobody") { store.claimNight(date, cookId: nil); claimDate = nil }.pbutton(.ghost)
                        }
                    }
                }
                .presentationDetents([.medium, .large])
            }
        }
    }

    private func addMember() {
        guard !newName.isBlank else { return }
        store.addMember(newName)
        toaster.show("\(newName.trimmed) is in")
        newName = ""
    }

    private func commitRename() {
        if let m = editing, !editName.isBlank { store.renameMember(m, editName) }
        editing = nil
    }
}
