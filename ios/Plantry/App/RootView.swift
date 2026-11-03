import SwiftUI
import SwiftData

/// Applies the mood theme and motion preference, then shows onboarding or the shell.
struct RootView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctx
    @Environment(\.accessibilityReduceMotion) private var systemReduce
    @Environment(\.colorScheme) private var systemScheme
    @Query private var settingsRows: [SettingsModel]

    private var settings: SettingsModel? { settingsRows.first }

    private var theme: Theme {
        let mood: Mood
        switch settings?.mood ?? .auto {
        case .auto: mood = ctx.context.mood
        case .system: mood = systemScheme == .dark ? .night : .day
        case let m: mood = Mood(rawValue: m.rawValue) ?? .day
        }
        return Theme.forMood(mood)
    }

    private var reduceMotion: Bool {
        switch settings?.reducedMotion ?? .system {
        case .system: systemReduce
        case .on: true
        case .off: false
        }
    }

    var body: some View {
        Group {
            if settings?.onboarded == true {
                AppShell()
                    .transition(.opacity)
            } else {
                OnboardingView()
                    .transition(.opacity)
            }
        }
        .environment(\.theme, theme)
        .environment(\.plantryReduceMotion, reduceMotion)
        .preferredColorScheme(theme.colorScheme)
        .tint(theme.accent)
        .foregroundStyle(theme.ink)
        .modifier(ToastHost())
        .animation(.easeInOut(duration: 0.3), value: settings?.onboarded)
        .onChange(of: settings?.mood) { ctx.refresh() }
        .onChange(of: systemScheme, initial: true) { ctx.prefersDark = systemScheme == .dark }
        .onChange(of: settings?.weatherEnabled) { ctx.refresh(); Task { await ctx.refreshWeather() } }
    }
}

enum Tab: String, CaseIterable, Identifiable {
    case tonight, week, recipes, pantry, shop
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
    var icon: String {
        switch self {
        case .tonight: "sparkles"
        case .week: "calendar"
        case .recipes: "book.closed"
        case .pantry: "refrigerator"
        case .shop: "basket"
        }
    }
}

/// Navigation destinations pushed from any tab.
enum Route: Hashable {
    case recipe(String)
    case editRecipe(String?)
    case household
    case settings
}

@MainActor
@Observable
final class Navigator {
    var tab: Tab = .tonight
    var paths: [Tab: [Route]] = [:]
    /// Cook mode is immersive: a full screen cover over everything.
    var cooking: CookRequest?

    func path(for tab: Tab) -> Binding<[Route]> {
        Binding(get: { self.paths[tab] ?? [] }, set: { self.paths[tab] = $0 })
    }

    func push(_ route: Route) { paths[tab, default: []].append(route) }
    func go(_ tab: Tab) { self.tab = tab }
    func popToRoot() { paths[tab] = [] }
}

struct CookRequest: Identifiable, Hashable {
    var recipeId: String
    var date: String?
    var servings: Int? = nil
    var id: String { recipeId + (date ?? "") }
}

struct AppShell: View {
    @Environment(\.theme) private var t
    @State private var nav = Navigator()

    var body: some View {
        TabView(selection: $nav.tab) {
            ForEach(Tab.allCases) { tab in
                NavigationStack(path: nav.path(for: tab)) {
                    screen(for: tab)
                        .navigationDestination(for: Route.self) { route in destination(route) }
                }
                .tabItem { Label(tab.label, systemImage: tab.icon) }
                .tag(tab)
            }
        }
        .environment(nav)
        .fullScreenCover(item: $nav.cooking) { req in
            CookModeView(request: req)
                .environment(nav)
        }
        .onOpenURL { url in open(url) }
    }

    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctx

    /// plantry://tonight and plantry://cook, from the widget and calendar events.
    private func open(_ url: URL) {
        guard url.scheme == "plantry" else { return }
        nav.cooking = nil
        nav.go(.tonight)
        nav.popToRoot()
        guard url.host == "cook" else { return }
        let date = ctx.context.targetDate
        if let session = CookSession.load() {
            nav.cooking = CookRequest(recipeId: session.recipeId, date: session.date, servings: session.servings)
        } else if let entry = store.dinner(on: date), let rid = entry.recipeId, !entry.done {
            nav.cooking = CookRequest(recipeId: rid, date: date)
        }
    }

    @ViewBuilder
    private func screen(for tab: Tab) -> some View {
        switch tab {
        case .tonight: TonightView()
        case .week: WeekView()
        case .recipes: RecipeLibraryView()
        case .pantry: PantryView()
        case .shop: ShopView()
        }
    }

    @ViewBuilder
    private func destination(_ route: Route) -> some View {
        switch route {
        case .recipe(let id): RecipeDetailView(recipeId: id)
        case .editRecipe(let id): RecipeEditorView(recipeId: id)
        case .household: HouseholdView()
        case .settings: SettingsView()
        }
    }
}

/// Shared page scaffolding: ambient background, 20pt gutters, scrolling content.
struct Page<Content: View>: View {
    @Environment(\.theme) private var t
    @ViewBuilder var content: Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) { content }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 32)
                .frame(maxWidth: 720)
                .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(AmbientBackground())
        .toolbarBackground(.hidden, for: .navigationBar)
    }
}

/// Toolbar menu to the secondary screens, shown on the Tonight tab.
struct SecondaryMenu: View {
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    var body: some View {
        Menu {
            Button { nav.push(.household) } label: { Label("Household", systemImage: "person.2") }
            Button { nav.push(.settings) } label: { Label("Settings", systemImage: "gearshape") }
        } label: {
            Image(systemName: "ellipsis.circle").font(.system(size: 20, weight: .medium)).foregroundStyle(t.ink)
        }
        .accessibilityLabel("More")
    }
}
