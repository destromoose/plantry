import SwiftUI
import SwiftData

struct DaySheet: Identifiable, Hashable {
    enum Kind { case pick, menu, claim, move }
    var date: String
    var kind: Kind
    var id: String { date + String(describing: kind) }
}

/// All the per-day sheets: pick a dinner, row menu, claim a night, move to another day.
struct DaySheets: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss
    var sheet: DaySheet
    var today: String
    var weekDates: [String]
    var onCooked: (String) -> Void
    var setSheet: (DaySheet?) -> Void

    private var title: String {
        switch sheet.kind {
        case .pick: "Dinner for \(DateKey.dayLabel(sheet.date, today: today))"
        case .claim: "Who is cooking?"
        case .move: "Move to which night?"
        case .menu: "\(DateKey.dayLabel(sheet.date, today: today)), \(DateKey.monthDay(sheet.date))"
        }
    }

    var body: some View {
        let entry = store.dinner(on: sheet.date)
        SheetChrome(title: title) {
            switch sheet.kind {
            case .pick: PickBody(date: sheet.date, today: today, entry: entry)
            case .menu: MenuBody(date: sheet.date, entry: entry, onCooked: onCooked) { setSheet(DaySheet(date: sheet.date, kind: $0)) }
            case .claim: ClaimBody(date: sheet.date, entry: entry)
            case .move: if let entry { MoveBody(date: sheet.date, entry: entry, weekDates: weekDates, today: today) }
            }
        }
    }
}

struct PickBody: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    @Query private var pantry: [PantryItemModel]
    @Query(sort: \CookedModel.at, order: .reverse) private var cooked: [CookedModel]
    @Query private var settingsRows: [SettingsModel]
    var date: String
    var today: String
    var entry: PlanEntryModel?
    @State private var q = ""
    @State private var filters: [Taste] = []
    @State private var note = ""

    private var ranked: [Scored] {
        suggest(SuggestInput(recipes: recipes.map(\.value), pantry: pantry.map(\.value), tastes: settingsRows.first?.tastes ?? [],
                             weatherLean: ctxProvider.context.weatherLean, isWeekend: DateKey.isWeekend(date), today: today,
                             recent: cooked.prefix(60).map(\.recipeId)))
    }

    private var leftovers: [RecipeModel] {
        var seen = Set<String>()
        return cooked
            .filter { DateKey.daysBetween($0.date, today) >= 0 && DateKey.daysBetween($0.date, today) <= 3 }
            .compactMap { c in recipes.first { $0.id == c.recipeId } }
            .filter { $0.leftovers && seen.insert($0.id).inserted }
    }

    private func place(recipeId: String? = nil, leftoversOf: String? = nil, note: String? = nil) {
        store.setDinner(date, recipeId: recipeId, leftoversOf: leftoversOf, note: note, cookId: entry?.cookId)
        ctxProvider.refresh()
        Haptic.tap()
        dismiss()
    }

    var body: some View {
        let needle = q.trimmed.lowercased()
        let list = ranked.filter { s in
            if !filters.isEmpty && !filters.allSatisfy({ s.recipe.tastes.contains($0) }) { return false }
            if needle.isEmpty { return true }
            return s.recipe.title.lowercased().contains(needle) || s.recipe.ingredients.contains { $0.name.lowercased().contains(needle) }
        }
        VStack(alignment: .leading, spacing: 20) {
            PField(placeholder: "Search recipes or ingredients", text: $q)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Taste.allCases) { taste in
                        Chip(label: taste.label, selected: filters.contains(taste), small: true) {
                            if let i = filters.firstIndex(of: taste) { filters.remove(at: i) } else { filters.append(taste) }
                        }
                    }
                }
                .padding(.horizontal, 24)
            }
            .padding(.horizontal, -24)

            if !leftovers.isEmpty && needle.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Eyebrow(text: "Leftovers of...")
                    ForEach(leftovers) { r in
                        Button { place(leftoversOf: r.id) } label: {
                            HStack(spacing: 12) { Thumb(url: r.imageUrl, size: 44, radius: 12); Text(r.title).font(Type.label) }
                                .padding(10).frame(minHeight: 56)
                        }
                        .buttonStyle(RowButtonStyle(tint: t.surface2))
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Eyebrow(text: "Suggestions")
                if list.isEmpty {
                    Text("Nothing matches. Try fewer filters.").font(Type.body).foregroundStyle(t.ink2).padding(.vertical, 12)
                } else {
                    ForEach(list) { s in
                        Button { place(recipeId: s.recipe.id) } label: {
                            HStack(spacing: 12) {
                                Thumb(url: s.recipe.imageUrl)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.recipe.title).font(Type.label).lineLimit(1)
                                    Text("\(formatMinutes(s.recipe.activeMinutes)) · \(s.have) of \(s.total)").font(Type.small).foregroundStyle(t.ink2)
                                }
                            }
                            .padding(10).frame(minHeight: 64)
                        }
                        .buttonStyle(RowButtonStyle())
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Eyebrow(text: "Something else")
                HStack(spacing: 8) {
                    PField(placeholder: "Takeout, Out, Dinner at Sam's", text: $note) { if !note.isBlank { place(note: note.trimmed) } }
                    Button("Add") { place(note: note.trimmed) }.pbutton(.secondary, .lg).disabled(note.isBlank)
                }
            }
        }
    }
}

struct MenuBody: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    var date: String
    var entry: PlanEntryModel?
    var onCooked: (String) -> Void
    var setKind: (DaySheet.Kind) -> Void

    var body: some View {
        let hasMeal = entry?.hasMeal ?? false
        let hasContent = entry?.isDecided ?? false
        VStack(spacing: 2) {
            row("pencil", hasContent ? "Change" : "Pick something") { setKind(.pick) }
            if hasMeal, entry?.done != true {
                row("checkmark", "Mark cooked") { onCooked(date); dismiss() }
            }
            row("person", "Claim night") { setKind(.claim) }
            if hasContent { row("arrow.left.arrow.right", "Move to...") { setKind(.move) } }
            if entry != nil {
                row("trash", "Remove", danger: true) { store.clearDinner(date); ctxProvider.refresh(); dismiss() }
            }
        }
    }

    private func row(_ icon: String, _ label: String, danger: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: icon)
                .font(Type.label)
                .foregroundStyle(danger ? Theme.danger : t.ink)
                .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                .padding(.horizontal, 12)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct ClaimBody: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    var date: String
    var entry: PlanEntryModel?

    var body: some View {
        if members.isEmpty {
            Text("Add someone to your household first.").font(Type.body).foregroundStyle(t.ink2)
        } else {
            VStack(spacing: 8) {
                ForEach(members) { m in
                    Button {
                        store.claimNight(date, cookId: m.id); toaster.show("\(m.name) has the night"); dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            Avatar(member: m)
                            Text(m.name).font(Type.label)
                            Spacer()
                            if entry?.cookId == m.id { Image(systemName: "checkmark").foregroundStyle(t.secondary).accessibilityLabel("Current cook") }
                        }
                        .padding(.horizontal, 16).frame(minHeight: 56)
                    }
                    .buttonStyle(RowButtonStyle())
                }
                if entry?.cookId != nil {
                    Button("Unclaim") { store.claimNight(date, cookId: nil); dismiss() }.pbutton(.ghost).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

struct MoveBody: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Query private var plan: [PlanEntryModel]
    @Query private var recipes: [RecipeModel]
    var date: String
    var entry: PlanEntryModel
    var weekDates: [String]
    var today: String

    var body: some View {
        VStack(spacing: 8) {
            ForEach(weekDates.filter { $0 != date }, id: \.self) { d in
                let other = plan.first { $0.date == d && $0.slot == .dinner }
                let label: String? = other?.recipeId != nil ? recipes.first { $0.id == other?.recipeId }?.title : other?.note
                Button {
                    store.movePlanEntry(entry, to: d)
                    toaster.show(label != nil ? "Swapped with \(DateKey.dayLabel(d, today: today))" : "Moved to \(DateKey.dayLabel(d, today: today))")
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "calendar").foregroundStyle(t.ink3)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(DateKey.shortDay(d)) \(DateKey.dayNumber(d))").font(Type.label)
                            if let label { Text("Swaps with \(label)").font(Type.small).foregroundStyle(t.ink2).lineLimit(1) }
                        }
                    }
                    .padding(.horizontal, 16).frame(minHeight: 56)
                }
                .buttonStyle(RowButtonStyle())
            }
        }
    }
}
