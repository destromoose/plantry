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

    @State private var confirmReset = false
    @State private var importing = false
    @State private var exportDoc: ExportDocument?

    private var s: SettingsModel? { settingsRows.first }

    var body: some View {
        Page {
            VStack(alignment: .leading, spacing: 4) {
                Text("Settings").font(Type.hero).lineSpacing(-2)
                Text("Everything lives on this phone and exports as one file.").font(Type.body).foregroundStyle(t.ink2)
            }

            section("Mood") {
                choice(MoodSetting.allCases, selected: s?.mood ?? .auto) { v in store.update { $0.mood = v } }
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
            }

            section("Weather") {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Let the weather nudge dinner toward cozy or light.").font(Type.body).foregroundStyle(t.ink2)
                        if s?.weatherEnabled == true, let w = s?.weather {
                            Text("Right now: \(Int(w.tempC.rounded()))°\(w.precipitation ? ", rain" : "")").font(Type.small).foregroundStyle(t.ink3)
                        }
                    }
                    Spacer()
                    Toggle("Use the weather", isOn: Binding(get: { s?.weatherEnabled ?? false }, set: { v in store.update { $0.weatherEnabled = v } }))
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

            section("Units") {
                choice(Units.allCases, selected: s?.units ?? .metric) { v in store.update { $0.units = v } }
            }

            section("Words") {
                choice(HouseholdWord.allCases, selected: s?.householdWord ?? .household) { v in store.update { $0.householdWord = v } }
            }

            section("Your data") {
                HStack(spacing: 8) {
                    Button { exportDoc = ExportDocument(data: store.exportJSON()) } label: { Label("Export", systemImage: "square.and.arrow.up") }.pbutton(.outline)
                    Button { importing = true } label: { Label("Import", systemImage: "square.and.arrow.down") }.pbutton(.outline)
                    Button("Start over") { confirmReset = true }.pbutton(.danger)
                }
                Text("The export is the same JSON the web app reads, so you can move between the two.").font(Type.small).foregroundStyle(t.ink3).padding(.top, 10)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .fileExporter(isPresented: Binding(get: { exportDoc != nil }, set: { if !$0 { exportDoc = nil } }), document: exportDoc, contentType: .json, defaultFilename: "plantry-export-\(DateKey.key(Date()))") { result in
            if case .success = result { toaster.show("Exported") }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            guard case .success(let url) = result else { return }
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            do {
                try store.importJSON(try Data(contentsOf: url))
                ctxProvider.refresh()
                toaster.show("Imported")
            } catch {
                toaster.show(error.localizedDescription)
            }
        }
        .sheet(isPresented: $confirmReset) {
            SheetChrome(title: "Start over?") {
                Text("This clears your household, pantry, plan and custom recipes from this phone. The 24 starter recipes come back.").font(Type.body).foregroundStyle(t.ink2)
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
            .presentationDetents([.height(240)])
        }
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
