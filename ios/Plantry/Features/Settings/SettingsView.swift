import SwiftUI
import SwiftData
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(Navigator.self) private var nav
    @Environment(\.theme) private var t
    @Query private var settingsRows: [SettingsModel]
    @Query(sort: \MemberModel.order) private var members: [MemberModel]

    @State private var confirmReset = false
    @State private var importing = false
    @State private var exportDoc: ExportDocument?
    @State private var preview: Store.ImportPreview?

    private var s: SettingsModel? { settingsRows.first }

    var body: some View {
        Page {
            VStack(alignment: .leading, spacing: 4) {
                Text("Settings").font(Type.hero).lineSpacing(-2)
                Text("Everything lives on this phone. Nothing is sent anywhere unless you turn on the weather, and then only a rough location.").font(Type.body).foregroundStyle(t.ink2)
            }

            section("Cooking for") {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Usual number of people at dinner").font(Type.body)
                        Text("Recipes, the shopping list and cook mode scale to this. Change it per night on the week.").font(Type.small).foregroundStyle(t.ink2)
                    }
                    Spacer()
                    Stepper(value: Binding(get: { s?.cookingFor ?? 2 }, set: { v in store.update { $0.cookingFor = v } }), range: 1...24, label: "people")
                }
                Toggle(isOn: Binding(get: { s?.cookingWithKids ?? false }, set: { v in store.update { $0.cookingWithKids = v } })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Cooking with kids").font(Type.body)
                        Text("Adds \"ask a grown-up\" notes on hot and sharp steps.").font(Type.small).foregroundStyle(t.ink2)
                    }
                }
                .tint(t.accent)
                .padding(.top, 12)
            }

            section("Allergies and diets") {
                Text("For the whole household. Dinners that break one are never suggested. Set per-person rules in \((s?.householdWord ?? .household).label).")
                    .font(Type.small).foregroundStyle(t.ink2).padding(.bottom, 12)
                AvoidPicker(value: Binding(get: { s?.avoid ?? [] }, set: { v in store.update { $0.avoid = v } }), small: true)
                let personal = members.flatMap { $0.avoid + ($0.diet.map { [$0] } ?? []) }
                if !personal.isEmpty {
                    Text("Also, per person: \(Array(Set(personal)).sorted().map { Diet.label($0).lowercased() }.joined(separator: ", ")).").font(Type.small).foregroundStyle(t.ink3).padding(.top, 10)
                }
                Button("Edit people") { nav.push(.household) }.pbutton(.ghost, .sm).padding(.top, 6)
            }

            section("Mood") {
                choice(MoodSetting.allCases, selected: s?.mood ?? .auto) { v in store.update { $0.mood = v }; ctxProvider.refresh() }
                HStack(spacing: 6) {
                    ForEach([t.canvas, t.surface, t.accent, t.secondary], id: \.self) { c in
                        RoundedRectangle(cornerRadius: 6).fill(c).frame(width: 28, height: 28).overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(t.line, lineWidth: 1))
                    }
                    Text(ctxProvider.context.reason).font(Type.small).italic().foregroundStyle(t.ink3).padding(.leading, 6)
                }
                .padding(.top, 10)
                .accessibilityHidden(true)
            }

            section("Motion") {
                choice(MotionSetting.allCases, selected: s?.reducedMotion ?? .system) { v in store.update { $0.reducedMotion = v } }
                Text("Text size follows your phone's setting.").font(Type.small).foregroundStyle(t.ink3).padding(.top, 10)
            }

            section("Weather") {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Let the weather nudge dinner toward cozy or light.").font(Type.body).foregroundStyle(t.ink2)
                        Text("Sends your location rounded to about 10 km to Open-Meteo, nothing else.").font(Type.small).foregroundStyle(t.ink3)
                        if s?.weatherEnabled == true, let w = s?.weather {
                            Text("Right now: \(Int(w.tempC.rounded()))°\(w.precipitation ? ", rain" : "")").font(Type.small).foregroundStyle(t.ink3)
                        }
                    }
                    Spacer()
                    Toggle("Use the weather", isOn: Binding(get: { s?.weatherEnabled ?? false }, set: { v in store.update { $0.weatherEnabled = v; if !v { $0.weather = nil } }; if v { Task { await ctxProvider.refreshWeather() } } else { ctxProvider.refresh() } }))
                        .labelsHidden().tint(t.accent)
                }
            }

            section("Tastes") {
                FlowLayout(spacing: 8) {
                    ForEach(Taste.allCases) { taste in
                        let on = s?.tastes.contains(taste) ?? false
                        Chip(label: taste.label, selected: on) {
                            store.update { m in if on { m.tastes.removeAll { $0 == taste } } else { m.tastes.append(taste) } }
                        }
                    }
                }
            }

            section("Words") {
                choice(HouseholdWord.allCases, selected: s?.householdWord ?? .household) { v in store.update { $0.householdWord = v } }
            }

            section("Your data") {
                HStack(spacing: 8) {
                    Button { exportDoc = ExportDocument(data: store.exportJSON()) } label: { Label("Back up", systemImage: "square.and.arrow.up") }.pbutton(.outline)
                    Button { importing = true } label: { Label("Restore", systemImage: "square.and.arrow.down") }.pbutton(.outline)
                }
                Text("A backup is one file you keep. It is the same file the Plantry web app reads, so you can move between the two. Restoring shows what will change and can be undone.").font(Type.small).foregroundStyle(t.ink3).padding(.top, 10)
                Button("Start over") { confirmReset = true }.pbutton(.danger, .sm).padding(.top, 12)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .fileExporter(isPresented: Binding(get: { exportDoc != nil }, set: { if !$0 { exportDoc = nil } }), document: exportDoc, contentType: .json, defaultFilename: "plantry-backup-\(DateKey.key(Date()))") { result in
            if case .success = result { toaster.show("Backed up") }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            guard case .success(let url) = result else { return }
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            do {
                preview = try store.checkImport(try Data(contentsOf: url))
            } catch {
                toaster.show(error.localizedDescription)
            }
        }
        .sheet(isPresented: Binding(get: { preview != nil }, set: { if !$0 { preview = nil } })) {
            if let p = preview { importSheet(p) }
        }
        .sheet(isPresented: $confirmReset) {
            SheetChrome(title: "Start over?") {
                Text("This clears your household, pantry, plan and your own recipes from this phone. The 24 starter recipes come back. Back up first if you might want any of it.").font(Type.body).foregroundStyle(t.ink2)
                HStack(spacing: 8) {
                    Button("Yes, clear everything") {
                        confirmReset = false
                        store.resetAll()
                        ctxProvider.refresh()
                        nav.popToRoot()
                    }
                    .pbutton(.danger)
                    Button("Keep it") { confirmReset = false }.pbutton(.ghost)
                }
                .padding(.top, 20)
            }
            .presentationDetents([.height(260)])
        }
    }

    private func importSheet(_ p: Store.ImportPreview) -> some View {
        let date = p.exportedAt.flatMap(ISO.date).map { $0.formatted(date: .abbreviated, time: .shortened) }
        return SheetChrome(title: "Restore this backup?") {
            VStack(alignment: .leading, spacing: 10) {
                if let date { Text("Saved \(date).").font(Type.small).foregroundStyle(t.ink3) }
                Text("It replaces what is on this phone with:").font(Type.body).foregroundStyle(t.ink2)
                VStack(alignment: .leading, spacing: 4) {
                    row("\(pluralize(p.members.count, "person", "people")): \(p.members.map(\.name).joined(separator: ", "))")
                    row(pluralize(p.recipes.count, "recipe"))
                    row("\(pluralize(p.pantry.count, "pantry item"))")
                    row("\(pluralize(p.plan.count, "planned night"))")
                    row("\(pluralize(p.shop.count, "shopping item"))")
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(t.surface2, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                if p.dropped > 0 { Text("\(pluralize(p.dropped, "row")) could not be read and will be left out.").font(Type.small).foregroundStyle(Theme.danger) }
                HStack(spacing: 8) {
                    Button("Restore") {
                        preview = nil
                        let undo = store.applyImport(p)
                        ctxProvider.refresh()
                        nav.popToRoot()
                        toaster.show("Welcome back. Everything is restored.") { undo(); ctxProvider.refresh() }
                    }
                    .pbutton(.primary)
                    Button("Cancel") { preview = nil }.pbutton(.ghost)
                }
                .padding(.top, 10)
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func row(_ text: String) -> some View {
        Label(text, systemImage: "circle.fill").font(Type.small).imageScale(.small)
    }

    private func section<C: View>(_ title: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionTitle(title)
            content()
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func choice<T: Identifiable & Hashable & LabeledOption>(_ options: [T], selected: T, onChange: @escaping (T) -> Void) -> some View {
        FlowLayout(spacing: 8) {
            ForEach(options) { o in
                Chip(label: o.label, selected: o == selected) { onChange(o) }
            }
        }
    }
}

protocol LabeledOption { var label: String { get } }
extension MoodSetting: LabeledOption {}
extension MotionSetting: LabeledOption {}
extension Units: LabeledOption {}
extension HouseholdWord: LabeledOption {}

struct ExportDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.json]
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
