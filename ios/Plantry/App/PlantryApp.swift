import SwiftUI
import SwiftData

@main
struct PlantryApp: App {
    private let container: ModelContainer
    @State private var store: Store
    @State private var contextProvider = ContextProvider()
    @State private var toaster = Toaster()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        let config = ModelConfiguration("Plantry", isStoredInMemoryOnly: false)
        do {
            container = try ModelContainer(for: RecipeModel.self, PantryItemModel.self, PlanEntryModel.self, ShopItemModel.self,
                                           MemberModel.self, HandoffModel.self, CookedModel.self, SettingsModel.self,
                                           configurations: config)
        } catch {
            fatalError("Could not open the Plantry store: \(error)")
        }
        let s = Store(container: container)
        _store = State(initialValue: s)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(contextProvider)
                .environment(toaster)
                .modelContainer(container)
                .onAppear { contextProvider.attach(store) }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { contextProvider.becameActive() }
                }
        }
    }
}
