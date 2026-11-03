import SwiftUI
import SwiftData
import UIKit

// "Share with your household": puts this iPhone in the same household as the website
// and other phones. Start a new household, or join one with its code or invite link.

struct ShareCard: View {
    @Environment(HouseholdSync.self) private var sync
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]

    @State private var busy = false
    @State private var joining = false
    @State private var leaving = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionTitle("Share with your household")
            VStack(alignment: .leading, spacing: 14) {
                if let code = sync.code {
                    sharing(code)
                } else {
                    Text("Plan together on every phone. Your week, pantry and list stay the same for everyone, on iPhone and on the website.")
                        .font(Type.body).foregroundStyle(t.ink2)
                    HStack(spacing: 8) {
                        Button(busy ? "Starting…" : "Start sharing") { start() }.pbutton(.primary).disabled(busy)
                        Button("Join with a code") { joining = true }.pbutton(.secondary)
                    }
                }
                if let error { Text(error).font(Type.small).foregroundStyle(Theme.danger) }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
        }
        .sheet(isPresented: $joining) {
            JoinSheet().presentationDetents([.large])
        }
        .sheet(isPresented: $leaving) {
            SheetChrome(title: "Stop sharing on this phone?") {
                Text("Everything stays on this phone, and the others keep their copy. You can join again any time with the code.")
                    .font(Type.body).foregroundStyle(t.ink2)
                HStack(spacing: 8) {
                    Button("Stop sharing") { sync.leave(); leaving = false; toaster.show("This phone stopped sharing") }.pbutton(.danger)
                    Button("Keep sharing") { leaving = false }.pbutton(.ghost)
                }
                .padding(.top, 20)
            }
            .presentationDetents([.height(240)])
        }
    }

    @ViewBuilder private func sharing(_ code: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Household code").font(.system(size: 13, weight: .medium)).foregroundStyle(t.ink2)
            Text(HouseholdCode.format(code))
                .font(.system(size: 26, weight: .semibold, design: .monospaced))
                .foregroundStyle(t.ink)
                .textSelection(.enabled)
                .accessibilityLabel("Household code \(code.map(String.init).joined(separator: " "))")
            Text(statusLine).font(Type.small).foregroundStyle(t.ink3)
        }
        HStack(spacing: 8) {
            if let link = sync.joinLink {
                ShareLink(item: link, message: Text("Join our kitchen on Plantry. Open the link, or type the code \(HouseholdCode.format(code)) in the app.")) {
                    Label("Invite someone", systemImage: "square.and.arrow.up")
                }
                .pbutton(.primary)
            }
            Button("Copy code") {
                UIPasteboard.general.string = HouseholdCode.format(code)
                toaster.show("Code copied")
            }
            .pbutton(.secondary)
        }
        if members.count > 1 {
            VStack(alignment: .leading, spacing: 8) {
                Text("This phone is").font(.system(size: 13, weight: .medium)).foregroundStyle(t.ink2)
                FlowChips(members: members, selected: sync.meId ?? members.first { $0.isMe }?.id) { sync.setMe($0) }
            }
        }
        Button("Stop sharing on this phone") { leaving = true }.pbutton(.ghost, .sm)
    }

    private var statusLine: String {
        switch sync.status {
        case .syncing: return "Syncing…"
        case .offline: return "Offline. Changes stay here and sync when you're back."
        case .error(let m): return m
        default:
            guard let at = sync.lastSyncedAt else { return "Up to date" }
            return "Up to date, \(at.formatted(.relative(presentation: .named)))"
        }
    }

    private func start() {
        guard !busy else { return }
        busy = true; error = nil
        Task {
            do {
                let code = try await sync.startSharing()
                toaster.show("Shared. Code \(HouseholdCode.format(code))")
                Haptic.success()
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }
}

/// One chip per person, to say which of them holds this phone.
private struct FlowChips: View {
    var members: [MemberModel]
    var selected: String?
    var pick: (String) -> Void
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(members) { m in
                    Chip(label: m.name, selected: m.id == selected, small: true) { pick(m.id) }
                }
            }
        }
    }
}

/// Type or paste a code (or the whole invite link), see who's there, and pick who you are.
struct JoinSheet: View {
    @Environment(HouseholdSync.self) private var sync
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t

    @State private var input = ""
    @State private var peek: HouseholdSync.Peek?
    @State private var who: String?
    @State private var newName = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        SheetChrome(title: "Join a household") {
            VStack(alignment: .leading, spacing: 18) {
                if let peek {
                    Text("Who are you?").font(Type.cardTitle)
                    VStack(spacing: 8) {
                        ForEach(peek.members) { m in
                            Button { who = m.id; newName = "" } label: {
                                HStack(spacing: 12) {
                                    Text(String(m.name.prefix(1)).uppercased())
                                        .font(.system(size: 15, weight: .semibold, design: .serif)).foregroundStyle(.white)
                                        .frame(width: 36, height: 36).background(Theme.color(for: m.color), in: Circle())
                                    Text(m.name).font(Type.label)
                                    Spacer()
                                    if who == m.id { Image(systemName: "checkmark").foregroundStyle(t.secondary) }
                                }
                                .padding(.horizontal, 16).frame(minHeight: 56)
                            }
                            .buttonStyle(RowButtonStyle())
                            .accessibilityAddTraits(who == m.id ? [.isSelected] : [])
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Someone new").font(.system(size: 13, weight: .medium)).foregroundStyle(t.ink2)
                        PField(placeholder: "Your name", text: $newName)
                            .onChange(of: newName) { _, v in if !v.isBlank { who = nil } }
                    }
                    Text("This phone's plan, pantry and list are replaced by the household's. Recipes you added here are kept and shared.")
                        .font(Type.small).foregroundStyle(t.ink3)
                    Button("Join") { join(peek) }.pbutton(.primary, .lg).disabled(who == nil && newName.isBlank)
                } else {
                    Text("Ask whoever shared for the code, or paste the invite link they sent.").font(Type.body).foregroundStyle(t.ink2)
                    PField(placeholder: "ABCD-EFGH-JKMN", text: $input) { look() }
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    HStack(spacing: 8) {
                        Button(busy ? "Looking…" : "Next") { look() }.pbutton(.primary).disabled(busy || input.isBlank)
                        Button("Paste") { if let s = UIPasteboard.general.string { input = s; look() } }.pbutton(.secondary)
                    }
                }
                if let error { Text(error).font(Type.small).foregroundStyle(Theme.danger) }
            }
        }
    }

    private func look() {
        guard !busy, !input.isBlank else { return }
        busy = true; error = nil
        Task {
            do { peek = try await sync.peek(input) } catch { self.error = error.localizedDescription }
            busy = false
        }
    }

    private func join(_ p: HouseholdSync.Peek) {
        sync.join(p, as: newName.isBlank ? who : nil, newName: newName.isBlank ? nil : newName)
        Haptic.success()
        toaster.show("You're in. Everything here is shared now.")
        dismiss()
    }
}
