import SwiftUI
import SwiftData

/// Chips for allergens and diets. Used in onboarding, Settings and per person.
struct AvoidPicker: View {
    @Environment(\.theme) private var t
    @Binding var value: [String]
    var small = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow(text: "Allergies")
                FlowLayout(spacing: 8) {
                    ForEach(Diet.allergenOptions) { o in
                        Chip(label: o.label, selected: value.contains(o.id), small: small) { toggle(o.id) }
                    }
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow(text: "Diets")
                FlowLayout(spacing: 8) {
                    ForEach(Diet.dietOptions) { o in
                        Chip(label: o.label, selected: value.contains(o.id), small: small) { toggle(o.id) }
                    }
                }
            }
        }
    }

    private func toggle(_ id: String) {
        Haptic.tap()
        if let i = value.firstIndex(of: id) { value.remove(at: i) } else { value.append(id) }
    }
}

/// What the whole household avoids, read live.
struct AvoidReader: DynamicProperty {
    @Query private var settingsRows: [SettingsModel]
    @Query private var members: [MemberModel]
    var avoid: [String] { Diet.householdAvoid(settingsAvoid: settingsRows.first?.avoid ?? [], members: members.map(\.value)) }
}

/// A clear warning when a recipe breaks a household allergy or diet.
struct AvoidWarning: View {
    @Environment(\.theme) private var t
    var reader = AvoidReader()
    var recipe: Recipe

    var body: some View {
        let c = Diet.conflicts(recipe, avoid: reader.avoid)
        if !c.isEmpty {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(c.blocking.isEmpty ? t.ink2 : Theme.danger).padding(.top, 2)
                VStack(alignment: .leading, spacing: 2) {
                    if !c.blocking.isEmpty {
                        Text("\(Diet.conflictText(c)). Not safe for this household: \(c.culprits.joined(separator: ", ").lowercased()).")
                            .font(Type.body).fontWeight(.medium)
                    }
                    if !c.leaveOut.isEmpty {
                        Text("Leave out the \(c.leaveOut.joined(separator: " and ").lowercased()) to keep it safe.").font(Type.small).foregroundStyle(t.ink2)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(c.blocking.isEmpty ? t.surface2 : Theme.danger.opacity(0.1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(c.blocking.isEmpty ? t.line : Theme.danger.opacity(0.4), lineWidth: 1))
            .accessibilityElement(children: .combine)
        }
    }
}

/// A small tag for recipe cards.
struct AvoidBadge: View {
    @Environment(\.theme) private var t
    var reader = AvoidReader()
    var recipe: Recipe

    var body: some View {
        let c = Diet.conflicts(recipe, avoid: reader.avoid)
        if !c.blocking.isEmpty {
            HStack(spacing: 4) {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 10, weight: .semibold))
                Text(c.blocking.map { Diet.label($0) }.joined(separator: ", ")).lineLimit(1).minimumScaleFactor(0.8)
            }
            .accessibilityLabel(Diet.conflictText(c))
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Theme.cream)
            .padding(.horizontal, 10)
            .frame(height: 26)
            .background(Theme.danger, in: Capsule())
        }
    }
}
