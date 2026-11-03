import Foundation
import WidgetKit

// Builds the widget's snapshot from the store and the live cook session, and
// asks WidgetKit to redraw. Called after every context refresh, which the
// store triggers on each save, so the home screen never lags the app.

extension Notification.Name {
    static let plantryDataChanged = Notification.Name("plantryDataChanged")
}

@MainActor
enum WidgetBridge {
    private static var last: WidgetSnapshot?

    static func update(store: Store, context: AppContext) {
        let target = context.targetDate
        let entry = store.dinner(on: target)
        let recipe = store.recipe(entry?.recipeId)
        let leftovers = store.recipe(entry?.leftoversOf)
        let members = store.members
        let cook = members.first { $0.id == entry?.cookId }
        let washer = Chores.washer(on: target, cookId: entry?.cookId, members: members, id: \.id)

        var title: String?
        var meta: String?
        var missing = 0
        if let recipe {
            title = recipe.title
            let people = entry?.servings ?? store.settings.cookingFor
            meta = "\(formatMinutes(recipe.activeMinutes)) hands-on · for \(people)"
            missing = coverage(recipe.value, pantryKeys: store.pantryKeys).missing.count
        } else if let leftovers {
            title = "Leftovers: \(leftovers.title)"
            meta = "Already cooked. Heat, plate, done."
        } else if let note = entry?.note, !note.isEmpty {
            title = note
        }

        var nudge: String?
        switch context.nudge {
        case .defrost:
            if let ing = recipe?.ingredients.first(where: { $0.aisle == .frozen || $0.aisle == .meatFish }) { nudge = "Take the \(ing.name.lowercased()) out of the freezer" }
        case .startNow:
            if let recipe { nudge = "Start now and you'll eat by \(context.now.addingTimeInterval(Double(recipe.totalMinutes) * 60).formatted(date: .omitted, time: .shortened))" }
        case .planWeek: nudge = "A good morning to plan the week"
        default: break
        }

        var snap = WidgetSnapshot(label: context.targetLabel, date: target, title: title, recipeId: recipe?.id, meta: meta,
                                  cook: cook?.name, washer: washer?.name, missing: missing, done: entry?.done ?? false,
                                  stepIndex: nil, stepCount: nil, stepText: nil, timerEndsAt: nil, timerLabel: nil, nudge: nudge, writtenAt: Date())

        if let session = CookSession.load(), let cooking = store.recipe(session.recipeId), !cooking.steps.isEmpty, (entry?.done ?? false) == false {
            let i = min(session.index, cooking.steps.count - 1)
            snap.stepIndex = i + 1
            snap.stepCount = cooking.steps.count
            snap.stepText = cooking.steps[i].text
            if session.recipeId != recipe?.id { snap.title = cooking.title; snap.recipeId = cooking.id }
            if let running = session.timers.values.compactMap(\.endsAt).filter({ $0 > Date() }).min() { snap.timerEndsAt = running }
        }

        var comparable = snap
        comparable.writtenAt = last?.writtenAt ?? snap.writtenAt
        guard comparable != last else { return }
        last = snap
        snap.save()
        WidgetCenter.shared.reloadAllTimelines()
    }
}
