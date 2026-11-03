import SwiftUI
import SwiftData

// Breakfast and lunch on the Week screen: small rows under each dinner, a sheet to pick one,
// and the Household card that says which meals the household plans.

struct MealPick: Identifiable, Hashable {
    var date: String
    var slot: MealSlot
    var id: String { "\(date)|\(slot.rawValue)" }
}

/// "+ Breakfast  + Lunch" when empty, "BREAKFAST  Oats" once planned.
struct MealLines: View {
    @Environment(\.theme) private var t
    var date: String
    var today: String
    var slots: [MealSlot]
    var plan: [PlanEntryModel]
    var recipes: [RecipeModel]
    var onTap: (MealSlot) -> Void

    private func label(_ slot: MealSlot) -> String? {
        guard let e = plan.first(where: { $0.date == date && $0.slot == slot }) else { return nil }
        if let id = e.recipeId { return recipes.first { $0.id == id }?.title }
        if let id = e.leftoversOf { return recipes.first { $0.id == id }.map { "Leftovers: \($0.title)" } }
        return e.note?.isEmpty == false ? e.note : nil
    }

    var body: some View {
        let filled = slots.compactMap { s in label(s).map { (s, $0) } }
        let empty = slots.filter { label($0) == nil }
        VStack(alignment: .leading, spacing: 0) {
            Divider().overlay(t.line).padding(.bottom, 4)
            ForEach(filled, id: \.0) { slot, what in
                Button { onTap(slot) } label: {
                    HStack(spacing: 10) {
                        Text(slot.label.uppercased()).font(Type.sans(11, weight: .semibold)).kerning(0.8).foregroundStyle(t.ink3)
                            .frame(width: 78, alignment: .leading)
                        Text(what).font(Type.sans(15, weight: .medium)).foregroundStyle(t.ink).lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: 40)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(slot.label) on \(DateKey.dayLabel(date, today: today)): \(what). Change it")
            }
            if !empty.isEmpty {
                HStack(spacing: 16) {
                    ForEach(empty, id: \.self) { slot in
                        Button { onTap(slot) } label: {
                            Label(slot.label, systemImage: "plus").font(Type.sans(14)).foregroundStyle(t.ink3)
                                .frame(minHeight: 40).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Add \(slot.label.lowercased()) for \(DateKey.dayLabel(date, today: today))")
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(.leading, 12)
        .padding(.trailing, 12)
        .padding(.bottom, 4)
    }
}

/// Pick breakfast or lunch: last night's leftovers, a usual, a note or a recipe.
struct MealSheet: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Query private var plan: [PlanEntryModel]
    @Query private var recipes: [RecipeModel]
    var pick: MealPick
    var today: String

    @State private var note = ""
    @State private var q = ""
    @State private var loaded = false

    private var entry: PlanEntryModel? { plan.first { $0.date == pick.date && $0.slot == pick.slot } }

    var body: some View {
        let usuals = Meals.usuals(plan: plan.map(\.value), recipes: recipes.map(\.value), slot: pick.slot, today: today)
        let prev = plan.first { $0.date == DateKey.addDays(pick.date, -1) && $0.slot == .dinner }
        let lastNight = pick.slot == .lunch ? recipes.first { $0.id == (prev?.recipeId ?? prev?.leftoversOf) } : nil
        let needle = q.trimmed.lowercased()
        let found = needle.isEmpty ? [] : Array(recipes.filter { $0.title.lowercased().contains(needle) }.prefix(8))

        SheetChrome(title: "\(pick.slot.label) on \(DateKey.dayLabel(pick.date, today: today))") {
            VStack(alignment: .leading, spacing: 18) {
                if let lastNight {
                    VStack(alignment: .leading, spacing: 8) {
                        Eyebrow(text: "From last night")
                        Chip(label: "Leftovers: \(lastNight.title)", selected: entry?.leftoversOf == lastNight.id, systemImage: "fork.knife") {
                            place(leftoversOf: lastNight.id)
                        }
                    }
                }
                if !usuals.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Eyebrow(text: "Your usuals")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(usuals, id: \.self) { u in
                                    Chip(label: u.label, selected: u.recipeId != nil ? entry?.recipeId == u.recipeId : entry?.note == u.note) {
                                        if let r = u.recipeId { place(recipeId: r) } else { place(note: u.note) }
                                    }
                                }
                            }
                        }
                    }
                }
                HStack(spacing: 8) {
                    PField(placeholder: pick.slot == .breakfast ? "Oats, toast, eggs…" : "Sandwiches, soup, out…", text: $note) { saveNote() }
                    Button("Save") { saveNote() }.pbutton(.primary).disabled(note.isBlank)
                }
                VStack(alignment: .leading, spacing: 4) {
                    PField(placeholder: "Or pick one of your recipes", text: $q)
                    ForEach(found) { r in
                        Button { place(recipeId: r.id) } label: {
                            Text(r.title).font(Type.body).foregroundStyle(t.ink).frame(maxWidth: .infinity, minHeight: 46, alignment: .leading)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        Divider().overlay(t.line)
                    }
                    if !needle.isEmpty && found.isEmpty {
                        Text("No recipe by that name. Save it as a note instead.").font(Type.small).foregroundStyle(t.ink3)
                    }
                }
                if entry != nil {
                    Button("Clear \(pick.slot.label.lowercased())") {
                        store.clearMeal(pick.date, pick.slot)
                        toaster.show("\(pick.slot.label) cleared")
                        dismiss()
                    }
                    .pbutton(.ghost)
                }
            }
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            note = entry?.note ?? ""
        }
    }

    private func saveNote() {
        guard !note.isBlank else { return }
        place(note: String(note.trimmed.prefix(80)))
    }

    private func place(recipeId: String? = nil, leftoversOf: String? = nil, note: String? = nil) {
        store.setMeal(pick.date, pick.slot, recipeId: recipeId, leftoversOf: leftoversOf, note: note)
        Haptic.tap()
        dismiss()
    }
}

/// Household: which meals we plan. Dinner is always on.
struct MealsCard: View {
    @Environment(Store.self) private var store
    @Environment(\.theme) private var t
    @Query private var settingsRows: [SettingsModel]

    var body: some View {
        let meals = Meals.planned(settingsRows.first?.meals ?? MealSlot.allCases)
        VStack(alignment: .leading, spacing: 0) {
            SectionTitle("Meals we plan")
            VStack(alignment: .leading, spacing: 12) {
                Text("Dinner is always on. Breakfast and lunch show as small rows on each day of the week.")
                    .font(Type.body).foregroundStyle(t.ink2)
                HStack(spacing: 8) {
                    ForEach([MealSlot.breakfast, .lunch], id: \.self) { m in
                        let on = meals.contains(m)
                        Chip(label: m.label, selected: on, systemImage: on ? "checkmark" : nil) {
                            store.update { $0.meals = Meals.planned(on ? meals.filter { $0 != m } : meals + [m]) }
                        }
                    }
                    Chip(label: MealSlot.dinner.label, selected: true, systemImage: "checkmark") {}
                        .disabled(true)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
        }
    }
}
