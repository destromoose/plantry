import Foundation

// Who's home and notes: the actions, mirroring lib/store.ts. The state lives on the
// settings record as one JSON value, so it saves and syncs with everything else.

extension Store {
    var together: TogetherState {
        get {
            guard let d = settings.togetherData, let s = try? JSONDecoder().decode(TogetherState.self, from: d) else { return TogetherState() }
            return s
        }
        set {
            let data = try? JSONEncoder().encode(newValue)
            if data != settings.togetherData { settings.togetherData = data }
        }
    }

    private func changeTogether(_ change: (inout TogetherState) -> Void) {
        var s = together
        change(&s)
        together = s
        save()
    }

    /// Someone's answer for one meal. Home is stored too, so it can override a usual week.
    func setPresence(_ date: String, _ slot: MealSlot, _ memberId: String, _ p: Presence?) {
        changeTogether { $0.presence[Together.presenceKey(date, slot, memberId)] = p }
    }

    /// Someone's usual week. Home clears it.
    func setWeeklyPresence(_ weekday: Int, _ slot: MealSlot, _ memberId: String, _ p: Presence?) {
        changeTogether { $0.presenceWeekly[Together.weeklyKey(weekday, slot, memberId)] = p == .home ? nil : p }
    }

    func eaters(_ date: String, _ slot: MealSlot) -> Int? {
        Together.eaters(together, memberIds: members.map(\.id), date, slot, cookingFor: settings.cookingFor)
    }

    @discardableResult
    func addNote(_ text: String, on place: HouseNote.Place, date: String? = nil, slot: MealSlot? = nil, itemKey: String? = nil, photo: String? = nil) -> HouseNote {
        let note = HouseNote(id: IDs.make("nt"), text: String(text.trimmed.prefix(500)), by: me?.id, at: ISO.now(),
                             on: place, date: date, slot: slot, itemKey: itemKey, photo: photo)
        changeTogether {
            $0.notes.insert(note, at: 0)
            Together.prune(&$0, today: DateKey.key(Date()))
        }
        return note
    }

    func removeNote(_ id: String) {
        changeTogether { s in
            s.notes.removeAll { $0.id == id }
            s.replies.removeAll { $0.noteId == id }
        }
    }

    func togglePin(_ id: String) {
        changeTogether { s in
            if let i = s.notes.firstIndex(where: { $0.id == id }) { s.notes[i].pinned = s.notes[i].isPinned ? nil : true }
        }
    }

    /// Reply to a note. "I'll cook" on a day's note claims that night.
    func reply(to note: HouseNote, _ text: String) {
        let t = String(text.trimmed.prefix(200))
        guard !t.isEmpty else { return }
        changeTogether { $0.replies.append(NoteReply(id: IDs.make("rp"), noteId: note.id, by: me?.id, text: t, at: ISO.now())) }
        if t == "I'll cook", note.on == .day, let date = note.date, note.slot == nil || note.slot == .dinner, let me {
            claimNight(date, cookId: me.id)
        }
    }

    // MARK: - Shopping together

    var shopTrip: ShopTogether.Trip? { ShopTogether.active(together.shopTrip) }

    /// "I'm at the shop": the others see it, and what they add shows up marked New.
    func startShopTrip() {
        changeTogether { $0.shopTrip = ShopTrip(by: me?.id, since: ISO.now()) }
    }

    func endShopTrip() {
        changeTogether { $0.shopTrip = ShopTrip() }
    }

    /// Split the open list by aisle between the cooks (or everyone). Returns how many were shared out.
    @discardableResult
    func splitShop() -> Int {
        let cooks = members.filter(\.cooks).map(\.id)
        let people = cooks.count > 1 ? cooks : members.map(\.id)
        let rows = fetch(ShopItemModel.self)
        let who = ShopTogether.splitByAisle(rows.sorted { $0.order < $1.order }.map(\.value), people: people)
        for r in rows { if let m = who[r.id] { r.splitTo = m } }
        if !who.isEmpty { save() }
        return who.count
    }

    func clearSplit() {
        for r in fetch(ShopItemModel.self) where r.splitTo != nil { r.splitTo = nil }
        save()
    }
}
