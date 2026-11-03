import SwiftUI
import SwiftData

/// Add or edit a recipe. Paste text and Plantry sorts it, or fill the form.
struct RecipeEditorView: View {
    @Environment(Store.self) private var store
    @Environment(Navigator.self) private var nav
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    var recipeId: String?

    private enum Mode: String, CaseIterable { case paste = "Paste", type = "Type it in" }

    struct IngRow: Identifiable, Hashable { var id = IDs.make("i"); var name = ""; var quantity = ""; var unit = ""; var aisle: Aisle = .other; var optional = false }
    struct StepRow: Identifiable, Hashable { var id = IDs.make("s"); var text = "" }

    @State private var mode: Mode = .paste
    @State private var pasteText = ""
    @State private var pasteNote: String?
    @State private var title = ""
    @State private var summary = ""
    @State private var imageUrl = ""
    @State private var active = 20
    @State private var total = 30
    @State private var servings = 4
    @State private var tastes: [Taste] = []
    @State private var leftovers = false
    @State private var ings: [IngRow] = [IngRow()]
    @State private var steps: [StepRow] = [StepRow()]
    @State private var tried = false
    @State private var loaded = false

    private var existing: RecipeModel? { recipes.first { $0.id == recipeId } }

    private var errors: (title: String?, ingredients: String?, steps: String?) {
        (title.isBlank ? "Give it a name." : title.trimmed.count > 80 ? "Keep the name under 80 characters." : nil,
         ings.contains { !$0.name.isBlank } ? nil : "Add at least one ingredient.",
         steps.contains { !$0.text.isBlank } ? nil : "Add at least one step.")
    }
    private var hasErrors: Bool { errors.title != nil || errors.ingredients != nil || errors.steps != nil }

    var body: some View {
        Page {
            VStack(alignment: .leading, spacing: 4) {
                Text(existing == nil ? "Add a recipe" : "Edit recipe").font(Type.hero).lineSpacing(-2)
                Text(existing == nil ? "Paste it in and Plantry will sort it. Or type it, your call." : "Change anything. Nights you planned it for keep up.")
                    .font(Type.body).foregroundStyle(t.ink2)
            }

            if existing == nil {
                HStack(spacing: 8) {
                    ForEach(Mode.allCases, id: \.self) { m in
                        Chip(label: m.rawValue, selected: mode == m) { withAnimation(Motion.settle) { mode = m } }
                    }
                }
            }

            if mode == .paste && existing == nil {
                VStack(alignment: .leading, spacing: 12) {
                    TextEditor(text: $pasteText)
                        .font(Type.body)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 220)
                        .padding(10)
                        .background(t.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(t.line, lineWidth: 1))
                        .overlay(alignment: .topLeading) {
                            if pasteText.isEmpty {
                                Text("Lemon pasta\n\nIngredients\n200 g spaghetti\n2 cloves garlic\n\nMethod\n1. Boil the pasta for 10 minutes.")
                                    .font(Type.body).foregroundStyle(t.ink3).padding(18).allowsHitTesting(false)
                            }
                        }
                        .accessibilityLabel("Recipe text")
                    if let pasteNote { Text(pasteNote).font(Type.small).foregroundStyle(Theme.danger) }
                    Button { sortOut() } label: { Label("Sort it out", systemImage: "wand.and.stars") }.pbutton(.primary, .lg)
                }
            } else {
                form
            }
        }
        .navigationTitle(existing == nil ? "New recipe" : "Edit")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if mode == .type || existing != nil {
                    Button("Save") { save() }.fontWeight(.semibold)
                }
            }
        }
        .onAppear { load() }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 24) {
            field("Name", error: tried ? errors.title : nil) { PField(placeholder: "Lemon pasta", text: $title) }
            field("Description") { PField(placeholder: "One line that says why you'd want it", text: $summary) }
            field("Image link (optional, https)") { PField(placeholder: "https://...", text: $imageUrl).keyboardType(.URL).textInputAutocapitalization(.never) }

            HStack(spacing: 16) {
                field("Active min") { Stepper(value: $active, range: 1...600, label: "active minutes") }
                field("Total min") { Stepper(value: $total, range: 1...900, label: "total minutes") }
                field("Serves") { Stepper(value: $servings, range: 1...24, label: "servings") }
            }

            field("Tastes") {
                FlowLayout(spacing: 8) {
                    ForEach(Taste.allCases) { taste in
                        Chip(label: taste.label, selected: tastes.contains(taste), small: true) {
                            if let i = tastes.firstIndex(of: taste) { tastes.remove(at: i) } else { tastes.append(taste) }
                        }
                    }
                }
            }

            Toggle(isOn: $leftovers) { Text("Makes leftovers worth planning the next day").font(Type.body) }.tint(t.accent)

            VStack(alignment: .leading, spacing: 10) {
                SectionTitle("Ingredients")
                if tried, let e = errors.ingredients { Text(e).font(Type.small).foregroundStyle(Theme.danger) }
                ForEach($ings) { $row in
                    VStack(spacing: 8) {
                        HStack(spacing: 8) {
                            PField(placeholder: "Name", text: $row.name)
                                .onChange(of: row.name) { _, v in if row.aisle == .other { row.aisle = PantryGuess.aisle(for: v) } }
                            Button { ings.removeAll { $0.id == row.id }; if ings.isEmpty { ings = [IngRow()] } } label: { Image(systemName: "trash").iconButton() }
                                .foregroundStyle(t.ink2).accessibilityLabel("Remove ingredient")
                        }
                        HStack(spacing: 8) {
                            PField(placeholder: "Qty", text: $row.quantity).keyboardType(.decimalPad).frame(width: 80)
                            PField(placeholder: "Unit", text: $row.unit).frame(width: 90)
                            Picker("Aisle", selection: $row.aisle) { ForEach(Aisle.allCases) { Text($0.label).tag($0) } }
                                .tint(t.ink).frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(12)
                    .background(t.surface2.opacity(0.5), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                Button { ings.append(IngRow()) } label: { Label("Add ingredient", systemImage: "plus") }.pbutton(.ghost, .sm)
            }

            VStack(alignment: .leading, spacing: 10) {
                SectionTitle("Steps")
                if tried, let e = errors.steps { Text(e).font(Type.small).foregroundStyle(Theme.danger) }
                ForEach(Array($steps.enumerated()), id: \.element.id) { i, $row in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(i + 1)").font(Type.display(15)).frame(width: 30, height: 30).background(t.surface2, in: Circle()).padding(.top, 8)
                        TextField("What to do", text: $row.text, axis: .vertical)
                            .font(Type.body).lineLimit(2...6)
                            .padding(12)
                            .background(t.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(t.line, lineWidth: 1))
                        VStack(spacing: 2) {
                            if let m = RecipeParser.detectTimer(row.text) { Tag(text: "\(m)m", systemImage: "timer") }
                            Button { steps.removeAll { $0.id == row.id }; if steps.isEmpty { steps = [StepRow()] } } label: { Image(systemName: "trash").iconButton() }
                                .foregroundStyle(t.ink2).accessibilityLabel("Remove step")
                        }
                    }
                }
                Button { steps.append(StepRow()) } label: { Label("Add step", systemImage: "plus") }.pbutton(.ghost, .sm)
            }

            Button(existing == nil ? "Add recipe" : "Save changes") { save() }.pbutton(.primary, .lg, fill: true)
        }
    }

    private func field<C: View>(_ label: String, error: String? = nil, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(Type.sans(13, weight: .medium)).foregroundStyle(t.ink2)
            content()
            if let error { Text(error).font(Type.small).foregroundStyle(Theme.danger) }
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        guard let r = existing else { return }
        mode = .type
        title = r.title; summary = r.summary; imageUrl = r.imageUrl ?? ""
        active = r.activeMinutes; total = r.totalMinutes; servings = r.servings
        tastes = r.tastes; leftovers = r.leftovers
        ings = r.ingredients.map { IngRow(id: $0.id, name: $0.name, quantity: $0.quantity == 0 ? "" : formatQuantity($0.quantity, nil), unit: $0.unit, aisle: $0.aisle, optional: $0.isOptional) }
        steps = r.steps.map { StepRow(id: $0.id, text: $0.text) }
    }

    private func sortOut() {
        let text = pasteText.trimmed
        if text.isEmpty { pasteNote = "Paste something first."; return }
        if text.range(of: "^https?://\\S+$", options: [.regularExpression, .caseInsensitive]) != nil {
            pasteNote = "Plantry can't fetch pages yet. Paste the recipe text instead and it'll sort it out."
            return
        }
        let parsed = RecipeParser.parse(text)
        if parsed.ingredients.isEmpty && parsed.steps.isEmpty {
            pasteNote = "Couldn't find ingredients or steps in that. Try adding \"Ingredients\" and \"Method\" headings."
            return
        }
        if let t = parsed.title { title = String(t.prefix(80)) }
        if let sv = parsed.servings { servings = sv }
        if let a = parsed.activeMinutes { active = clamp(a, 1, 600) }
        if let tt = parsed.totalMinutes { total = clamp(tt, 1, 900) }
        if !parsed.ingredients.isEmpty {
            ings = parsed.ingredients.map { IngRow(name: $0.name, quantity: $0.quantity == 0 ? "" : Quantity.niceNumber($0.quantity), unit: $0.unit, aisle: PantryGuess.aisle(for: $0.name)) }
        }
        if !parsed.steps.isEmpty { steps = parsed.steps.map { StepRow(text: $0.text) } }
        pasteNote = nil
        withAnimation(Motion.settle) { mode = .type }
        toaster.show("Sorted. Check the details.")
    }

    private func save() {
        tried = true
        guard !hasErrors else { return }
        let ingredients: [Ingredient] = ings.filter { !$0.name.isBlank }.map {
            Ingredient(id: $0.id, name: String($0.name.trimmed.prefix(60)), key: keyOf($0.name), quantity: parseQty($0.quantity), unit: String($0.unit.trimmed.prefix(12)), aisle: $0.aisle == .other ? PantryGuess.aisle(for: $0.name) : $0.aisle, optional: $0.optional ? true : nil)
        }
        let stepList: [Step] = steps.filter { !$0.text.isBlank }.map { Step(id: $0.id, text: $0.text.trimmed, timerMinutes: RecipeParser.detectTimer($0.text)) }
        let image = imageUrl.trimmed
        let recipe = Recipe(id: existing?.id ?? "", title: String(title.trimmed.prefix(80)), description: String(summary.trimmed.prefix(300)), imageUrl: image.lowercased().hasPrefix("https://") ? image : nil,
                            activeMinutes: active, totalMinutes: max(total, active), servings: servings, ingredients: ingredients, steps: stepList,
                            tastes: tastes, weather: .any, leftovers: leftovers ? true : nil, source: "You", sourceUrl: nil,
                            isFavorite: existing?.isFavorite ?? false, createdAt: existing?.createdAt ?? ISO.now(), custom: true)
        Haptic.success()
        if let existing {
            store.updateRecipe(existing, recipe)
            toaster.show("Recipe saved")
            dismiss()
        } else {
            let m = store.addRecipe(recipe)
            toaster.show("Recipe added")
            dismiss()
            nav.push(.recipe(m.id))
        }
    }

    private func parseQty(_ s: String) -> Double {
        s.isBlank ? 1 : (Quantity.parse(s) ?? 1)
    }
}
