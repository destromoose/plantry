import SwiftUI
import SwiftData

struct RecipeDetailView: View {
    @Environment(Store.self) private var store
    @Environment(Navigator.self) private var nav
    @Environment(Toaster.self) private var toaster
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Query private var recipes: [RecipeModel]
    @Query private var pantry: [PantryItemModel]
    var recipeId: String

    @State private var servings: Int?
    @State private var planOpen = false
    @State private var deleteOpen = false

    private var recipe: RecipeModel? { recipes.first { $0.id == recipeId } }

    var body: some View {
        if let recipe {
            content(recipe)
        } else {
            Page {
                EmptyState(systemImage: "fork.knife", title: "That recipe isn't here", body: "It may have been deleted, or the link is off.") {
                    Button("Back to recipes") { dismiss() }.pbutton()
                }
            }
            .navigationBarBackButtonHidden(false)
        }
    }

    private func content(_ recipe: RecipeModel) -> some View {
        let pantryKeys = Set(pantry.map(\.key))
        let current = servings ?? recipe.servings
        let scale = Double(current) / Double(max(recipe.servings, 1))
        let missing = recipe.ingredients.filter { !$0.isOptional && !pantryKeys.contains($0.key) }
        let today = ctxProvider.today

        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(url: recipe.imageUrl)
                    .aspectRatio(4 / 3, contentMode: .fill)
                    .frame(maxHeight: 420)
                    .clipped()
                    .overlay(alignment: .topTrailing) {
                        Button { store.toggleFavorite(recipe); Haptic.tap() } label: {
                            Image(systemName: recipe.isFavorite ? "heart.fill" : "heart")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(recipe.isFavorite ? t.accent : t.ink)
                                .frame(width: 44, height: 44)
                                .background(.ultraThinMaterial, in: Circle())
                        }
                        .padding(16)
                        .accessibilityLabel(recipe.isFavorite ? "Remove from favorites" : "Add to favorites")
                    }

                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(recipe.title).font(Type.hero).lineSpacing(-2)
                        if !recipe.summary.isEmpty { Text(recipe.summary).font(Type.bodyLarge).foregroundStyle(t.ink2) }
                        FlowLayout(spacing: 6) {
                            ForEach(recipe.tastes) { Tag(text: $0.label) }
                            if recipe.leftovers { Tag(text: "Leftovers") }
                        }
                        HStack(spacing: 20) {
                            stat("flame", "Active", formatMinutes(recipe.activeMinutes))
                            stat("clock", "Total", formatMinutes(recipe.totalMinutes))
                            stat("person.2", "Serves", "\(recipe.servings)")
                        }
                        .padding(.top, 6)
                        if recipe.custom {
                            HStack(spacing: 8) {
                                Button { nav.push(.editRecipe(recipe.id)) } label: { Label("Edit", systemImage: "pencil") }.pbutton(.ghost, .sm)
                                Button { deleteOpen = true } label: { Label("Delete", systemImage: "trash") }.pbutton(.danger, .sm)
                            }
                        }
                    }
                    .reveal(0)

                    VStack(alignment: .leading, spacing: 0) {
                        SectionTitle("Ingredients") {
                            Stepper(value: Binding(get: { current }, set: { servings = $0 }), range: 1...24, label: "servings")
                        }
                        VStack(spacing: 0) {
                            ForEach(recipe.ingredients) { ing in
                                let have = pantryKeys.contains(ing.key)
                                HStack(spacing: 12) {
                                    ZStack {
                                        Circle().fill(have ? t.secondary : .clear)
                                        Circle().strokeBorder(have ? .clear : t.line, lineWidth: 1)
                                        if have { Image(systemName: "checkmark").font(.system(size: 10, weight: .bold)).foregroundStyle(t.secondaryInk) }
                                    }
                                    .frame(width: 24, height: 24)
                                    VStack(alignment: .leading, spacing: 1) {
                                        (Text(ing.name) + Text(ing.isOptional ? " (optional)" : "").foregroundColor(t.ink3))
                                            .font(Type.body)
                                        if have { Text("You have it").font(.system(size: 12)).foregroundStyle(t.secondary) }
                                    }
                                    Spacer()
                                    Text(formatQuantity(ing.quantity * scale, ing.unit)).font(Type.small).foregroundStyle(t.ink2)
                                }
                                .padding(.vertical, 10)
                                .accessibilityElement(children: .combine)
                                Divider().overlay(t.line)
                            }
                        }
                        if !missing.isEmpty {
                            Button {
                                missing.forEach { store.addShopItem($0.name, aisle: $0.aisle) }
                                toaster.show("\(missing.count) added to your list")
                            } label: { Label("Add missing to list (\(missing.count))", systemImage: "basket") }
                            .pbutton(.outline, .sm)
                            .padding(.top, 14)
                        }
                    }
                    .reveal(1)

                    VStack(alignment: .leading, spacing: 0) {
                        SectionTitle("Steps")
                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(Array(recipe.steps.enumerated()), id: \.element.id) { i, step in
                                HStack(alignment: .top, spacing: 14) {
                                    Text("\(i + 1)").font(Type.display(15))
                                        .frame(width: 30, height: 30)
                                        .background(t.surface2, in: Circle())
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(step.text).font(Type.bodyLarge)
                                        if let m = step.timerMinutes { Tag(text: "\(m) min", systemImage: "timer") }
                                    }
                                }
                            }
                        }
                    }
                    .reveal(2)
                }
                .padding(20)
                .padding(.bottom, 90)
            }
        }
        .ignoresSafeArea(.container, edges: .top)
        .background(AmbientBackground())
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left").font(.system(size: 15, weight: .semibold)).foregroundStyle(t.ink)
                        .frame(width: 40, height: 40).background(.ultraThinMaterial, in: Circle())
                }
                .accessibilityLabel("Back")
            }
        }
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 10) {
                Button { planOpen = true } label: { Label("Plan it", systemImage: "calendar.badge.plus") }.pbutton(.glass, .lg, fill: true)
                Button("Cook") { nav.cooking = CookRequest(recipeId: recipe.id, date: nil) }.pbutton(.primary, .lg, fill: true)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
        }
        .sheet(isPresented: $planOpen) {
            SheetChrome(title: "Plan it for dinner") {
                VStack(spacing: 8) {
                    ForEach(0..<7, id: \.self) { i in
                        let key = DateKey.addDays(today, i)
                        Button(DateKey.dayLabel(key, today: today)) {
                            store.setDinner(key, recipeId: recipe.id, servings: current)
                            ctxProvider.refresh()
                            planOpen = false
                            toaster.show("Planned for \(DateKey.dayLabel(key, today: today))")
                        }
                        .pbutton(.secondary, .lg, fill: true)
                    }
                }
            }
            .presentationDetents([.large])
        }
        .sheet(isPresented: $deleteOpen) {
            SheetChrome(title: "Delete this recipe?") {
                Text("\(recipe.title) will be removed from your recipes. Any night you planned it for goes back to empty.").font(Type.body).foregroundStyle(t.ink2)
                HStack(spacing: 8) {
                    Button("Delete") { deleteOpen = false; store.deleteRecipe(recipe); toaster.show("Recipe deleted"); dismiss() }.pbutton(.danger)
                    Button("Keep it") { deleteOpen = false }.pbutton(.ghost)
                }
                .padding(.top, 20)
            }
            .presentationDetents([.height(220)])
        }
    }

    private func stat(_ icon: String, _ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Label(label, systemImage: icon).font(.system(size: 12, weight: .medium)).foregroundStyle(t.ink3)
            Text(value).font(Type.display(18))
        }
        .accessibilityElement(children: .combine)
    }
}
