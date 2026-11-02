import SwiftUI
import SwiftData

/// Lists the next seven days after the target date; picking one plans the recipe there.
struct SaveSheet: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Query private var plan: [PlanEntryModel]
    @Query private var recipes: [RecipeModel]
    var recipe: Recipe
    var targetDate: String
    var today: String
    var onSaved: () -> Void

    var body: some View {
        SheetChrome(title: "Save for another night") {
            Text("\(recipe.title) will be waiting. Which night?").font(Type.body).foregroundStyle(t.ink2).padding(.bottom, 16)
            VStack(spacing: 8) {
                ForEach(1...7, id: \.self) { i in
                    let d = DateKey.addDays(targetDate, i)
                    let entry = plan.first { $0.date == d && $0.slot == .dinner }
                    let taken: String? = entry?.recipeId != nil ? recipes.first { $0.id == entry?.recipeId }?.title
                        : (entry?.note ?? (entry?.leftoversOf != nil ? "Leftovers" : nil))
                    Button {
                        store.setDinner(d, recipeId: recipe.id, cookId: entry?.cookId)
                        toaster.show("Saved for \(DateKey.dayLabel(d, today: today))")
                        onSaved()
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(DateKey.dayLabel(d, today: today)).font(Type.label)
                                Text(DateKey.monthDay(d)).font(Type.small).foregroundStyle(t.ink3)
                            }
                            Spacer()
                            Text(taken.map { "Replaces \($0)" } ?? "Free").font(Type.small).foregroundStyle(t.ink2).lineLimit(1)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .frame(minHeight: 56)
                    }
                    .buttonStyle(RowButtonStyle())
                }
            }
        }
    }
}

struct HandoffSheet: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(Navigator.self) private var nav
    @Environment(\.dismiss) private var dismiss
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    var recipe: Recipe?
    var date: String
    /// Called first so an unplanned suggestion is locked in before it is handed over.
    var onBeforeHandoff: (() -> Void)? = nil
    @State private var message = ""

    private var me: MemberModel? { members.first { $0.isMe } ?? members.first }

    var body: some View {
        let others = members.filter { $0.id != me?.id && $0.cooks }
        SheetChrome(title: "Ask someone else to cook") {
            if others.isEmpty || me == nil {
                Text("Add someone who cooks to your household first. Nothing is sent anywhere: the note shows on this phone's Tonight screen.").font(Type.body).foregroundStyle(t.ink2)
                Button("Go to household") { dismiss(); nav.push(.household) }.pbutton().padding(.top, 20)
            } else {
                Text(recipe.map { "Ask someone to cook \($0.title). The note shows on Tonight for that night." } ?? "Ask someone to cook tonight.").font(Type.body).foregroundStyle(t.ink2).padding(.bottom, 16)
                Text("Add a note (optional)").font(.system(size: 13, weight: .medium)).foregroundStyle(t.ink2).padding(.bottom, 6)
                PField(placeholder: "Rice is already washed", text: $message).padding(.bottom, 16)
                VStack(spacing: 8) {
                    ForEach(others) { m in
                        Button {
                            onBeforeHandoff?()
                            store.createHandoff(date: date, from: me!, to: m, recipeId: recipe?.id, message: message.isBlank ? nil : message.trimmed)
                            toaster.show("\(m.name) is cooking")
                            Haptic.success()
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                Avatar(member: m)
                                Text(m.name).font(Type.label)
                            }
                            .padding(.horizontal, 16)
                            .frame(minHeight: 56)
                        }
                        .buttonStyle(RowButtonStyle())
                    }
                }
            }
        }
    }
}
