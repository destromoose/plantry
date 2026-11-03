import SwiftUI
import SwiftData
import EventKit

// "Dinners in your calendar": the household's planned dinners as all-day events
// in the phone's own Calendar app, titled with the dish and who cooks and washes
// up. Re-running replaces Plantry's own events (found by their plantry:// link)
// and never touches anything else in the calendar.

@MainActor
enum CalendarExport {
    static let marker = "plantry-dinner"

    enum Outcome { case added(Int), denied, nothing }

    static func run(store: Store, today: String) async -> Outcome {
        let eventStore = EKEventStore()
        let ok = (try? await eventStore.requestFullAccessToEvents()) ?? false
        guard ok else { return .denied }

        let members = store.members
        let dates = (-14...60).map { DateKey.addDays(today, $0) }
        let entries = store.fetch(PlanEntryModel.self).filter { dates.contains($0.date) && $0.slot == .dinner && $0.isDecided }
        guard !entries.isEmpty else { return .nothing }
        guard let calendar = eventStore.defaultCalendarForNewEvents else { return .denied }

        // Clear what Plantry put there before, then write the current plan.
        let range = eventStore.predicateForEvents(withStart: DateKey.date(dates.first!).addingTimeInterval(-86_400), end: DateKey.date(dates.last!).addingTimeInterval(86_400), calendars: nil)
        for old in eventStore.events(matching: range) where old.url?.scheme == "plantry" {
            try? eventStore.remove(old, span: .thisEvent, commit: false)
        }
        var count = 0
        for e in entries {
            let recipe = store.recipe(e.recipeId)
            let dish: String = recipe?.title ?? store.recipe(e.leftoversOf).map { "Leftovers: \($0.title)" } ?? (e.note ?? "Dinner")
            let cook = members.first { $0.id == e.cookId }
            let washer = Chores.washer(on: e.date, cookId: e.cookId, members: members, id: \.id)
            var title = dish
            if let cook { title += " · \(cook.name) cooks" }
            if let washer { title += ", \(washer.name) washes up" }
            let event = EKEvent(eventStore: eventStore)
            event.calendar = calendar
            event.title = title
            event.isAllDay = true
            event.startDate = DateKey.date(e.date)
            event.endDate = DateKey.date(e.date)
            event.availability = .free
            event.url = URL(string: "plantry://tonight?date=\(e.date)")
            var notes = "Planned in Plantry."
            if let recipe {
                notes += " \(formatMinutes(recipe.totalMinutes)) start to finish."
                if recipe.ingredients.contains(where: { $0.aisle == .frozen || $0.aisle == .meatFish }) { notes += " Take anything frozen out in the morning." }
            }
            event.notes = notes
            if (try? eventStore.save(event, span: .thisEvent, commit: false)) != nil { count += 1 }
        }
        try? eventStore.commit()
        return .added(count)
    }
}

/// The card shown in Settings and on the Household page.
struct CalendarCard: View {
    @Environment(Store.self) private var store
    @Environment(ContextProvider.self) private var ctxProvider
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @State private var busy = false

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Dinners in your calendar").font(Type.cardTitle)
                Text("Puts the next two months of planned dinners in the phone's Calendar as all-day events, with who cooks and who washes up. Run it again after planning to update them.").font(Type.small).foregroundStyle(t.ink2)
            }
            Spacer()
            Button(busy ? "Adding…" : "Add") {
                guard !busy, TapGuard.allow("calendar") else { return }
                busy = true
                Task {
                    let outcome = await CalendarExport.run(store: store, today: ctxProvider.today)
                    busy = false
                    switch outcome {
                    case .added(let n): toaster.show("\(pluralize(n, "dinner")) in your calendar"); Haptic.success()
                    case .denied: toaster.show("Calendar access is off. Allow it in Settings → Privacy → Calendars.")
                    case .nothing: toaster.show("Plan a few dinners first")
                    }
                }
            }
            .pbutton(.secondary, .sm).fixedSize().disabled(busy)
        }
        .padding(16)
        .card()
    }
}
