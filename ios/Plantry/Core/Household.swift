import Foundation

// "Your usuals": the things this kitchen buys trip after trip, learnt from finished shops.
// And "whoever cooks doesn't wash up". Both ported from the web app (lib/usuals.ts, lib/chores.ts).

struct BoughtEntry: Codable, Hashable, Sendable {
    var name: String
    var aisle: Aisle
    /// Days (YYYY-MM-DD) it was bought, newest first, at most six.
    var trips: [String]
}

enum Usuals {
    static let maxTrips = 6
    static let maxEntries = 200

    /// Count one trip for each item bought. Buying the same thing twice in a day is one trip.
    static func recordTrip(_ bought: [String: BoughtEntry], items: [ShopItem], day: String) -> [String: BoughtEntry] {
        if items.isEmpty { return bought }
        var next = bought
        for i in items {
            let was = next[i.key]
            let trips = (was?.trips.contains(day) ?? false) ? was!.trips : Array(([day] + (was?.trips ?? [])).prefix(maxTrips))
            next[i.key] = BoughtEntry(name: i.name, aisle: i.aisle, trips: trips)
        }
        // Keep it small: forget the things bought longest ago.
        if next.count > maxEntries {
            let drop = next.keys.sorted { (next[$0]!.trips.first ?? "") < (next[$1]!.trips.first ?? "") }.prefix(next.count - maxEntries)
            for k in drop { next[k] = nil }
        }
        return next
    }

    /// Bought on at least two trips, the last within six weeks, and not on the list now. Most often bought first.
    static func usuals(_ bought: [String: BoughtEntry], onList: Set<String>, today: String, limit: Int = 8) -> [(key: String, entry: BoughtEntry)] {
        bought.filter { key, e in
            e.trips.count >= 2 && !onList.contains(key) && DateKey.daysBetween(e.trips[0], today) <= 42
        }
        .sorted { a, b in
            if a.value.trips.count != b.value.trips.count { return a.value.trips.count > b.value.trips.count }
            return a.value.trips[0] > b.value.trips[0]
        }
        .prefix(limit)
        .map { (key: $0.key, entry: $0.value) }
    }
}

enum Chores {
    private static func dayNumber(_ date: String) -> Int {
        Int(DateKey.date(date).timeIntervalSince1970 / 86_400)
    }

    /// Who washes up on this date, given who cooks. Nobody when there's no one else.
    /// Worked out from the date alone, so every phone agrees without saving anything.
    static func washer<M>(on date: String, cookId: String?, members: [M], id: (M) -> String) -> M? {
        guard let cookId else { return nil }
        let others = members.filter { id($0) != cookId }.sorted { id($0) < id($1) }
        if others.isEmpty { return nil }
        return others[((dayNumber(date) % others.count) + others.count) % others.count]
    }
}
