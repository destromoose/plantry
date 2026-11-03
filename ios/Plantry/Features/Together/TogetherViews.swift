import SwiftUI
import SwiftData
import PhotosUI
import UIKit

// Who's home for each meal, and notes left on a day, a shopping item or the fridge board.
// The same screens as components/features/together on the website.

extension TogetherState {
    /// This phone's copy, read from the settings row so views update when it changes.
    static func of(_ rows: [SettingsModel]) -> TogetherState {
        guard let d = rows.first?.togetherData, let s = try? JSONDecoder().decode(TogetherState.self, from: d) else { return TogetherState() }
        return s
    }
}

// MARK: - Who's home

/// A face per person for one meal. Tap a face to go Home, Late, Out.
struct WhoHome: View {
    @Environment(Store.self) private var store
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query private var settingsRows: [SettingsModel]
    var date: String
    var slot: MealSlot
    var showLine = true

    var body: some View {
        let s = TogetherState.of(settingsRows)
        let me = members.first { $0.isMe }?.id
        if members.count > 1 {
            VStack(alignment: .leading, spacing: 8) {
                FlowLayout(spacing: 8) {
                    ForEach(members) { m in
                        let p = Together.presence(s, date, slot, m.id).value
                        Button {
                            Haptic.tap()
                            store.setPresence(date, slot, m.id, p.next)
                        } label: {
                            HStack(spacing: 8) {
                                Avatar(member: m, size: 26).opacity(p == .out ? 0.5 : 1)
                                (Text(m.name).foregroundStyle(p == .out ? t.ink3 : t.ink) + Text(" · \(p.label)").foregroundStyle(t.ink3))
                                    .font(.system(size: 14, weight: .medium))
                            }
                            .padding(.leading, 5).padding(.trailing, 12)
                            .frame(minHeight: 44)
                            .background(p == .late ? Color.orange.opacity(0.15) : (p == .out ? .clear : t.surface), in: Capsule())
                            .overlay(Capsule().strokeBorder(p == .late ? Color.orange.opacity(0.7) : (p == .out ? t.ink3 : t.line),
                                                            style: StrokeStyle(lineWidth: 1, dash: p == .out ? [4, 3] : [])))
                        }
                        .buttonStyle(PlainPressStyle())
                        .accessibilityLabel("\(m.name): \(p.label). Change to \(p.next.label)")
                    }
                }
                if showLine, let line = Together.line(s, members: members.map { ($0.id, $0.name) }, date, slot, meId: me) {
                    Text(line).font(Type.small).foregroundStyle(t.ink2)
                }
            }
        }
    }
}

/// The day sheet: who's home for each meal that day, and each person's usual week.
struct WhoHomeBody: View {
    @Environment(Store.self) private var store
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query private var settingsRows: [SettingsModel]
    var date: String

    var body: some View {
        let s = TogetherState.of(settingsRows)
        let slots = Meals.planned(settingsRows.first?.meals ?? MealSlot.allCases)
        let dow = Together.weekday(date)
        let dayName = DateKey.date(date).formatted(.dateTime.weekday(.wide))
        if members.count < 2 {
            Text("Add the people you live with in Household, then each of you can say when you are out.")
                .font(Type.body).foregroundStyle(t.ink2)
        } else {
            VStack(alignment: .leading, spacing: 22) {
                ForEach(slots, id: \.self) { slot in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(slot.label).font(Type.cardTitle)
                        WhoHome(date: date, slot: slot)
                        ForEach(members) { m in
                            let a = Together.presence(s, date, slot, m.id)
                            if a.value != .home {
                                let usual = s.presenceWeekly[Together.weeklyKey(dow, slot, m.id)] == a.value
                                Toggle(isOn: Binding(get: { usual }, set: { store.setWeeklyPresence(dow, slot, m.id, $0 ? a.value : nil) })) {
                                    Text("\(m.name) is \(a.value.label.lowercased()) every \(dayName)").font(Type.small).foregroundStyle(t.ink2)
                                }
                                .tint(t.accent)
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Tonight's card: who's eating, and the newest note for the day.
struct TonightTogether: View {
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    @Query private var settingsRows: [SettingsModel]
    var date: String
    var label: String
    @State private var notesOpen = false

    var body: some View {
        let s = TogetherState.of(settingsRows)
        let dayNotes = Together.notes(s, on: .day, date: date)
        if members.count > 1 {
            VStack(alignment: .leading, spacing: 12) {
                Text("Who's eating \(label.lowercased())").font(Type.cardTitle)
                WhoHome(date: date, slot: .dinner)
                ShopperLink()
                Divider().overlay(t.line)
                Button { notesOpen = true } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "text.bubble").foregroundStyle(t.ink3)
                        if let n = dayNotes.first {
                            let who = members.first { $0.id == n.by }?.name ?? "Someone"
                            (Text("\(who): ").fontWeight(.semibold).foregroundStyle(t.ink) + Text(n.text).foregroundStyle(t.ink2)
                             + Text(dayNotes.count > 1 ? " · \(dayNotes.count) notes" : "").foregroundStyle(t.ink3))
                                .lineLimit(1)
                        } else {
                            Text("Leave a note for today").foregroundStyle(t.ink2)
                        }
                        Spacer(minLength: 0)
                    }
                    .font(Type.small)
                    .frame(minHeight: 40)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
            .sheet(isPresented: $notesOpen) {
                SheetChrome(title: "Notes for \(label.lowercased())") {
                    NotesThread(place: .day, date: date, placeholder: "Defrost the chicken, back at 8…")
                }
                .presentationDetents([.medium, .large])
            }
        }
    }
}

// MARK: - Notes

/// The notes in one place, with replies, and a box to leave a new one.
struct NotesThread: View {
    @Environment(\.theme) private var t
    @Query private var settingsRows: [SettingsModel]
    var place: HouseNote.Place
    var date: String? = nil
    var itemKey: String? = nil
    var placeholder: String
    var canPin = false
    var showEmpty = true

    var body: some View {
        let s = TogetherState.of(settingsRows)
        let list = place == .board
            ? Together.board(s, today: DateKey.key(Date()))
            : Together.notes(s, on: place, date: date, itemKey: itemKey)
        VStack(alignment: .leading, spacing: 12) {
            if list.isEmpty && showEmpty {
                Text("No notes yet. Leave one and the others see it here.").font(Type.small).foregroundStyle(t.ink3)
            }
            ForEach(list) { n in NoteCard(note: n, replies: Together.replies(s, to: n.id), canPin: canPin) }
            NoteComposer(place: place, date: date, itemKey: itemKey, placeholder: placeholder)
        }
    }
}

struct NoteCard: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]
    var note: HouseNote
    var replies: [NoteReply]
    var canPin = false
    @State private var writing = false
    @State private var text = ""

    var body: some View {
        let author = members.first { $0.id == note.by }
        let me = members.first { $0.isMe }
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                if let author { Avatar(member: author, size: 26) } else { Circle().fill(t.surface2).frame(width: 26, height: 26) }
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(author?.name ?? "Someone") · \(Together.ago(note.at))\(note.isPinned ? " · Pinned" : "")")
                        .font(.system(size: 12)).foregroundStyle(t.ink3)
                    Text(note.text).font(Type.body).foregroundStyle(t.ink).fixedSize(horizontal: false, vertical: true)
                    if let img = NotePhoto.image(note.photo) {
                        Image(uiImage: img).resizable().scaledToFit().frame(maxHeight: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .accessibilityLabel("Photo with the note")
                    }
                }
                Spacer(minLength: 0)
                if canPin {
                    Button { store.togglePin(note.id) } label: { Image(systemName: note.isPinned ? "pin.slash" : "pin").iconButton() }
                        .foregroundStyle(t.ink3)
                        .accessibilityLabel(note.isPinned ? "Unpin" : "Pin to the board")
                }
                if note.by == nil || note.by == me?.id {
                    Button { store.removeNote(note.id) } label: { Image(systemName: "trash").iconButton() }
                        .foregroundStyle(t.ink3)
                        .accessibilityLabel("Delete note")
                }
            }
            if !replies.isEmpty {
                Divider().overlay(t.line)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(replies) { r in
                        (Text(members.first { $0.id == r.by }?.name ?? "Someone").fontWeight(.semibold).foregroundStyle(t.ink)
                         + Text(" \(r.text)").foregroundStyle(t.ink2)
                         + Text("  \(Together.ago(r.at))").font(Type.sans(11)).foregroundStyle(t.ink3))
                            .font(Type.small)
                    }
                }
                .padding(.leading, 36)
            }
            FlowLayout(spacing: 6) {
                ForEach(Together.quickReplies(note.on), id: \.self) { q in
                    Chip(label: q, small: true) { send(q) }
                }
                if !writing { Chip(label: "Reply…", small: true) { writing = true } }
            }
            .padding(.leading, 36)
            if writing {
                HStack(spacing: 8) {
                    PField(placeholder: "Reply…", text: $text) { send(text) }
                    Button("Send") { send(text) }.pbutton(.secondary, .sm).disabled(text.isBlank)
                }
                .padding(.leading, 36)
            }
        }
        .padding(12)
        .background(t.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(t.line, lineWidth: 1))
    }

    private func send(_ s: String) {
        guard !s.isBlank else { return }
        store.reply(to: note, s)
        Haptic.tap()
        if s == "I'll cook", note.on == .day { toaster.show("You're cooking that night") }
        text = ""; writing = false
    }
}

struct NoteComposer: View {
    @Environment(Store.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.theme) private var t
    var place: HouseNote.Place
    var date: String?
    var itemKey: String?
    var placeholder: String
    @State private var text = ""
    @State private var photo: String?
    @State private var picked: PhotosPickerItem?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let img = NotePhoto.image(photo) {
                ZStack(alignment: .topTrailing) {
                    Image(uiImage: img).resizable().scaledToFill().frame(width: 80, height: 80)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Button { photo = nil } label: {
                        Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(t.surface)
                            .frame(width: 24, height: 24).background(t.ink, in: Circle())
                    }
                    .offset(x: 8, y: -8)
                    .accessibilityLabel("Remove photo")
                }
            }
            HStack(spacing: 8) {
                PField(placeholder: placeholder, text: $text) { leave() }
                PhotosPicker(selection: $picked, matching: .images) {
                    Image(systemName: "camera").font(.system(size: 16, weight: .medium)).foregroundStyle(t.ink)
                        .frame(width: 46, height: 46).background(t.surface2, in: Circle())
                }
                .accessibilityLabel("Add a photo")
                Button("Leave it") { leave() }.pbutton(.primary).disabled(text.isBlank && photo == nil)
            }
        }
        .onChange(of: picked) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let p = NotePhoto.shrink(data) { photo = p }
                else { toaster.show("Couldn't read that photo") }
                picked = nil
            }
        }
    }

    private func leave() {
        guard !text.isBlank || photo != nil else { return }
        store.addNote(text.isBlank ? "Photo" : text, on: place, date: date, itemKey: itemKey, photo: photo)
        Haptic.tap()
        text = ""; photo = nil
    }
}

/// Note photos travel as small JPEG data URLs, the same as on the website.
enum NotePhoto {
    static func shrink(_ data: Data, max: CGFloat = 640) -> String? {
        guard let img = UIImage(data: data) else { return nil }
        let scale = min(1, max / Swift.max(img.size.width, img.size.height))
        let size = CGSize(width: (img.size.width * scale).rounded(), height: (img.size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let small = UIGraphicsImageRenderer(size: size, format: format).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
        guard let jpeg = small.jpegData(compressionQuality: 0.7), jpeg.count < 290_000 else { return nil }
        return "data:image/jpeg;base64," + jpeg.base64EncodedString()
    }

    static func image(_ url: String?) -> UIImage? {
        guard let url, let comma = url.firstIndex(of: ","), url.hasPrefix("data:image") else { return nil }
        guard let data = Data(base64Encoded: String(url[url.index(after: comma)...])) else { return nil }
        return UIImage(data: data)
    }
}

// MARK: - Fridge board

/// The fridge door: notes for everyone that aren't about one meal or item.
struct FridgeBoard: View {
    @Environment(\.theme) private var t
    @Query(sort: \MemberModel.order) private var members: [MemberModel]

    var body: some View {
        if members.count > 1 {
            VStack(alignment: .leading, spacing: 0) {
                SectionTitle("Fridge board")
                Text("Notes for the whole house. They clear after a week unless you pin them.")
                    .font(Type.small).foregroundStyle(t.ink3).padding(.top, -6).padding(.bottom, 10)
                NotesThread(place: .board, placeholder: "Bins go out Thursday…", canPin: true, showEmpty: false)
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
            }
        }
    }
}
