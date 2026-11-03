import SwiftUI
import SwiftData

struct RecipeLibraryView: View {
    @Environment(Store.self) private var store
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query(sort: \RecipeModel.createdAt, order: .reverse) private var recipes: [RecipeModel]
    @Query private var pantry: [PantryItemModel]

    @State private var query = ""
    @State private var tastes: [Taste] = []
    @State private var favOnly = false
    @State private var canMake = false

    private var pantryKeys: Set<String> { Set(pantry.map(\.key)) }

    private var filtered: [(RecipeModel, Coverage)] {
        let needle = query.trimmed.lowercased()
        let keys = pantryKeys
        return recipes.compactMap { r in
            let cov = coverage(r.value, pantryKeys: keys)
            if favOnly && !r.isFavorite { return nil }
            if canMake && !cov.complete { return nil }
            if !tastes.isEmpty && !tastes.allSatisfy({ r.tastes.contains($0) }) { return nil }
            if !needle.isEmpty {
                let hay = ([r.title, r.summary] + r.ingredients.map(\.name)).joined(separator: " ").lowercased()
                if !hay.contains(needle) { return nil }
            }
            return (r, cov)
        }
    }

    private var hasFilters: Bool { !query.isEmpty || !tastes.isEmpty || favOnly || canMake }

    var body: some View {
        let list = filtered
        Page {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Recipes").font(Type.hero).lineSpacing(-2)
                    Text(pluralize(recipes.count, "recipe")).font(Type.body).foregroundStyle(t.ink2)
                }
                Spacer()
                Button { nav.push(.editRecipe(nil)) } label: { Label("Add", systemImage: "plus") }.pbutton(.primary, .sm)
            }

            VStack(spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").foregroundStyle(t.ink3)
                    TextField("Search recipes or ingredients", text: $query).font(Type.body)
                    if !query.isEmpty {
                        Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(t.ink3) }.accessibilityLabel("Clear search")
                    }
                }
                .padding(.horizontal, 14)
                .frame(height: 46)
                .background(t.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(t.line, lineWidth: 1))

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        Chip(label: "Can make now", selected: canMake, tone: .secondary, small: true) { canMake.toggle() }
                        Chip(label: "Favorites", selected: favOnly, small: true, systemImage: "heart") { favOnly.toggle() }
                        ForEach(Taste.allCases) { taste in
                            Chip(label: taste.label, selected: tastes.contains(taste), small: true) {
                                if let i = tastes.firstIndex(of: taste) { tastes.remove(at: i) } else { tastes.append(taste) }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.horizontal, -20)
            }

            if list.isEmpty {
                EmptyState(systemImage: "magnifyingglass", title: "Nothing matches", body: hasFilters ? "Try fewer filters, or a different word." : "Add your first recipe to get going.") {
                    if hasFilters {
                        Button("Clear filters") { query = ""; tastes = []; favOnly = false; canMake = false }.pbutton(.secondary)
                    } else {
                        Button("Add a recipe") { nav.push(.editRecipe(nil)) }.pbutton()
                    }
                }
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                    ForEach(Array(list.enumerated()), id: \.element.0.id) { i, pair in
                        RecipeTile(recipe: pair.0, cov: pair.1).reveal(i)
                    }
                }
                .motion(Motion.settle, value: list.map(\.0.id))
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct RecipeTile: View {
    @Environment(Store.self) private var store
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    var reader = AvoidReader()
    var recipe: RecipeModel
    var cov: Coverage

    var body: some View {
        Button { nav.push(.recipe(recipe.id)) } label: {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(url: recipe.imageUrl).aspectRatio(4 / 3, contentMode: .fit)
                VStack(alignment: .leading, spacing: 6) {
                    Text(recipe.title).font(Type.display(16)).lineLimit(2).lineSpacing(-1).multilineTextAlignment(.leading).frame(minHeight: 38, alignment: .top)
                    HStack(spacing: 6) {
                        Text(formatMinutes(recipe.activeMinutes))
                        Text("·")
                        Circle().fill(cov.complete ? t.secondary : t.ink3.opacity(0.6)).frame(width: 7, height: 7)
                        Text("\(cov.have) of \(cov.total)")
                    }
                    .font(.system(size: 12)).foregroundStyle(t.ink2)
                    if Diet.conflicts(recipe.value, avoid: reader.avoid).blocking.isEmpty {
                        HStack(spacing: 6) { ForEach(recipe.tastes.prefix(2)) { Tag(text: $0.label) } }
                    } else {
                        AvoidBadge(recipe: recipe.value)
                    }
                }
                .padding(12)
            }
            .foregroundStyle(t.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
        .buttonStyle(PlainPressStyle())
        .overlay(alignment: .topTrailing) {
            Button { store.toggleFavorite(recipe); Haptic.tap() } label: {
                Image(systemName: recipe.isFavorite ? "heart.fill" : "heart")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(recipe.isFavorite ? t.accent : t.ink)
                    .frame(width: 40, height: 40)
                    .background(.ultraThinMaterial, in: Circle())
                    .frame(width: 44, height: 44)
            }
            .padding(6)
            .accessibilityLabel(recipe.isFavorite ? "Remove \(recipe.title) from favorites" : "Add \(recipe.title) to favorites")
        }
        .accessibilityElement(children: .contain)
        .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .contextMenu {
            Button { nav.cooking = CookRequest(recipeId: recipe.id, date: nil) } label: { Label("Cook now", systemImage: "frying.pan") }
            Button { store.toggleFavorite(recipe); Haptic.tap() } label: {
                Label(recipe.isFavorite ? "Remove from favorites" : "Add to favorites", systemImage: recipe.isFavorite ? "heart.slash" : "heart")
            }
            Button { nav.push(.editRecipe(recipe.id)) } label: { Label("Edit", systemImage: "pencil") }
        }
    }
}
