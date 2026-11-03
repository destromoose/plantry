// The Live Activity buttons run their intents in the app's process, where the
// real CookCommandHandler lives (Plantry/Features/Cook/CookLiveActivity.swift).
// The widget extension only needs the name to compile the shared intents.
enum CookCommandHandler {
    static func handle(_ command: CookCommand) async {}
}
