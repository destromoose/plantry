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

// MARK: - Planning ahead together

extension Store {
    var ideas: [MealIdea] { together.ideas ?? [] }
    var repeats: [RepeatMeal] { together.repeats ?? [] }

    private func changePlanAhead(_ change: (inout [MealIdea], inout [RepeatMeal]) -> Void) {
        var s = together
        var ideas = s.ideas ?? [], repeats = s.repeats ?? []
        change(&ideas, &repeats)
        s.ideas = ideas.isEmpty ? nil : ideas
        s.repeats = repeats.isEmpty ? nil : repeats
        together = s
        save()
    }

    /// Typing a recipe's name links the idea to it, so planning it brings the recipe.
    @discardableResult
    func addIdea(_ text: String) -> MealIdea? {
        let clean = String(text.trimmed.prefix(120))
        guard !clean.isEmpty else { return nil }
        let match = fetch(RecipeModel.self).first { $0.title.lowercased() == clean.lowercased() }
        if let dupe = ideas.first(where: { match != nil ? $0.recipeId == match?.id : $0.text?.lowercased() == clean.lowercased() }) { return dupe }
        let idea = MealIdea(id: IDs.make("id"), text: match == nil ? clean : nil, recipeId: match?.id,
                            by: members.first { $0.isMe }?.id, at: ISO.now())
        changePlanAhead { ideas, _ in ideas = Array(([idea] + ideas).prefix(60)) }
        return idea
    }

    func removeIdea(_ id: String) { changePlanAhead { ideas, _ in ideas.removeAll { $0.id == id } } }

    func toggleIdeaVote(_ id: String) {
        guard let me = members.first(where: { $0.isMe })?.id else { return }
        changePlanAhead { ideas, _ in
            guard let i = ideas.firstIndex(where: { $0.id == id }) else { return }
            var v = ideas[i].votes ?? []
            if let j = v.firstIndex(of: me) { v.remove(at: j) } else { v.append(me) }
            ideas[i].votes = v.isEmpty ? nil : v
        }
    }

    func ideaTitle(_ idea: MealIdea) -> String {
        if let rid = idea.recipeId { return recipe(rid)?.title ?? "A recipe" }
        return idea.text ?? ""
    }

    /// Put an idea on a night's dinner; it leaves the pool.
    func planIdea(_ idea: MealIdea, on date: String) {
        setDinner(date, recipeId: idea.recipeId, note: idea.recipeId == nil ? idea.text : nil, cookId: dinner(on: date)?.cookId)
        removeIdea(idea.id)
    }

    /// Have this night's dinner every week on this weekday.
    func repeatEveryWeek(_ date: String) {
        guard let e = dinner(on: date), e.recipeId != nil || (e.note?.isEmpty == false) else { return }
        let weekday = Together.weekday(date)
        let r = RepeatMeal(id: IDs.make("rp"), weekday: weekday, slot: .dinner, recipeId: e.recipeId,
                           note: e.recipeId == nil ? e.note : nil, by: members.first { $0.isMe }?.id)
        changePlanAhead { _, repeats in
            repeats.removeAll { $0.weekday == weekday && $0.slot == .dinner }
            repeats.append(r)
        }
    }

    func stopRepeat(_ id: String) { changePlanAhead { _, repeats in repeats.removeAll { $0.id == id } } }

    /// Weekly meals and last week's onto these dates' empty slots. Returns how many.
    @discardableResult
    func copyLastWeek(_ dates: [String], today: String) -> Int {
        let plan = fetch(PlanEntryModel.self).map(\.value)
        let weekly = PlanAhead.repeatsInto(plan, repeats, dates: dates, today: today)
        let copied = PlanAhead.copyWeek(plan + weekly, to: dates, today: today)
        let add = weekly + copied
        for e in add {
            if e.slot == .dinner { setDinner(e.date, recipeId: e.recipeId, note: e.note, cookId: e.cookId) }
            else { setMeal(e.date, e.slot, recipeId: e.recipeId, note: e.note) }
        }
        return add.count
    }
}
