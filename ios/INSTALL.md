# Putting Plantry on your iPhone

Two free signing routes use your own Apple Account (Apple ID): Xcode on a Mac, or SideStore set up with a Windows PC. The paid route needs the Apple Developer Program and unlocks TestFlight and the App Store. The availability of the weekly IPA source is stated below.

## Free: install straight from Xcode (no developer account)

Apple lets any Apple ID sign apps for your own devices. The catch: the install expires after 7 days, so you re-run it from Xcode once a week (your data stays on the phone).

One-time setup:

1. Open `ios/Plantry.xcodeproj` in Xcode.
2. Xcode menu → Settings → Accounts → **+** → sign in with your Apple ID. Xcode creates a "Personal Team" for you.
3. In the project navigator click **Plantry** (the blue icon at the top), choose the **Plantry** target → **Signing & Capabilities**. Tick **Automatically manage signing** and pick your Personal Team.
4. If Xcode says the bundle identifier is taken, change `com.destromoose.plantry` to anything unique, like `com.yourname.plantry`.
5. On your iPhone: Settings → Privacy & Security → **Developer Mode** → on (iOS 16 and later). Plug the phone in with a cable the first time and tap **Trust** on the phone.

Every install:

1. Pick your iPhone in the device menu at the top of Xcode (it also works over Wi-Fi once paired).
2. Press **Run** (⌘R). The first time, the phone shows "Untrusted Developer": go to Settings → General → VPN & Device Management → your Apple ID → **Trust**.
3. Done. Plantry is on the home screen and works offline.

Limits of a free team: 3 self-signed apps active on the phone at once (Plantry counts as one; its widget is part of it), at most 10 App IDs registered at a time, each lasting a week (Plantry needs 2: the app and its widget), and the 7-day expiry. If the phone says it has reached the maximum number of apps using a free developer profile, delete one of your other self-installed apps. Plantry uses nothing a free team cannot sign: timers use local notifications, the Live Activity is updated from the phone (no push), the calendar export uses the phone's Calendar, and the widget reads tonight's dinner from a shared keychain item (keychain sharing works on a free team; App Groups do not).

## Free, with a Windows PC once: SideStore

SideStore signs apps with your free Apple Account. After setup, refresh runs on the phone over Wi-Fi with LocalDevVPN connected; the PC need not stay awake or share that network. Signing still expires after **7 days** unless refreshed. A computer can be needed again for recovery or an expired pairing file.

The current route is [SideStore's prerequisites](https://docs.sidestore.io/docs/installation/prerequisites) and [installation guide](https://docs.sidestore.io/docs/installation/install), checked 8 November 2026. This replaces the earlier AltServer/legacy iCloud route. SideStore's older “alternative” installation page is labelled outdated. Do not replace Microsoft Store iCloud to satisfy those old instructions. On an existing PC, check with whoever administers the PC that iTunes and Apple device support work before setup and retain unrelated Apple components. The current official requirements list iloader and iTunes rather than legacy iCloud or AltServer.

**Build preparation:** the workflow described in [PR31](https://github.com/destromoose/plantry/pull/31) builds an unsigned app/widget IPA and an AltStore-format source, which SideStore can read. CI packaging and source checks do not prove a phone installation or widget sharing works. See [source compatibility and build details](altstore/README.md).

**Source availability:** before adding Plantry, check that the intended source returns JSON and its IPA link downloads:

`https://github.com/destromoose/plantry/releases/download/altstore-source/altstore.json`

Last checked 8 November 2026: HTTP 404, not live. It becomes usable only after the workflow is merged into `master` and the first publishing build succeeds. **Merging this iOS change into `master` triggers that publishing workflow**, so owner approval for the merge must also cover first publication. PRs and manual builds upload artifacts only. The Monday 05:17 UTC schedule also requires a separately approved default-branch change from `main` to `master`. Merge, publication and default-branch changes require owner approval.

### One-time setup, done by the phone owner

Allow **15–25 minutes** after the PC is prepared, plus extra time for downloads, restarts or troubleshooting. This is an estimate, not a measured install time. SideStore supports iOS 15+ with a passcode; **Plantry needs iOS 17+**.

1. Use a prepared Windows PC with iTunes and [iloader](https://github.com/nab138/iloader). The official SideStore guide links [nab138/iloader's Windows x64 MSI](https://github.com/nab138/iloader/releases/latest/download/iloader-windows-x64.msi). iTunes from Apple is recommended; the guide also permits Microsoft Store iTunes and suggests Apple Devices if neither works. Avoid similarly named third-party installer sites. You or the PC administrator should check the official download and approve any installer before running it.
2. On the phone, join Wi-Fi and install **LocalDevVPN** using the App Store link in [SideStore's prerequisites](https://docs.sidestore.io/docs/installation/prerequisites). Allow its VPN configuration and connect. This connects to services on your own device; it is not an internet privacy VPN. It must be connected when installing, updating or refreshing through SideStore. Cellular alone is insufficient. App Store availability depends on your region and has not been tested here.
3. Connect the phone by USB, unlock it and accept **Trust This Computer** yourself. Open iloader, sign in to your own Apple Account, select the phone, then **Install SideStore (Stable)**. On the checked date this button selects the upstream latest release tagged `0.7.0-alpha` (`prerelease=false`); the button label is not a stability guarantee. See the pinned release details in the source compatibility notes. Only the owner enters the password or any verification code into the official app. Never send credentials or the device pairing file to an agent, a chat or the repository.
4. On the phone, Settings → General → **VPN & Device Management** → your Apple Account → trust the developer. iOS 18+ uses **Allow & Restart**; follow the prompts yourself. On iOS 16+, also enable Settings → Privacy & Security → **Developer Mode**, complete its restart and confirm it after unlocking.
5. Reconnect LocalDevVPN and Wi-Fi. Open SideStore and sign in with the **same Apple Account used in iloader**. In **My Apps**, tap SideStore's expiry counter (initially **7 DAYS**) to refresh SideStore itself. Complete any certificate prompt described in the official guide. Wait for it to reopen successfully. **Do this before installing Plantry or any other app.**
6. Enable Background App Refresh for SideStore in iOS settings and leave SideStore's own **Background Refresh** setting enabled. Once the live-source check above has passed, add the exact source URL in SideStore, then install Plantry. The [official source guide](https://docs.sidestore.io/docs/advanced/app-sources) also documents its add-source link format. Review any permissions prompt. Open Plantry once before adding its widget.

### Keeping it working

- Keep Wi-Fi and LocalDevVPN available for refresh. SideStore attempts background refresh, but iOS does not guarantee it will run in time. Check **My Apps** regularly and use **Refresh All** while days remain; confirm the counters reset. You do not need an always-on PC or its Wi-Fi network for routine refresh.
- Free signing is still seven days, not a permanent signature. If SideStore itself expires, return to the computer/iloader to reinstall it and follow the [current troubleshooting guide](https://docs.sidestore.io/docs/troubleshooting/common-issues). Avoid deleting Plantry as a troubleshooting step: deleting the app can remove its data. A pairing file may also expire after an iOS update/reset or unexpectedly; use the [official pairing-file guide](https://docs.sidestore.io/docs/advanced/pairing-file) when needed, privately with the owner. Background refresh and recovery have not been tested on a phone here.
- A new Plantry build is separate from refreshing its signature. When SideStore offers an update, install it with Wi-Fi and LocalDevVPN connected. Refreshing alone keeps the installed build. The publishing schedule does not refresh the phone's signatures.
- A free account permits **3 active sideloaded apps including SideStore** and **10 App IDs per week**. SideStore and Plantry occupy two app slots. Plantry's widget shares its app slot but needs another App ID; SideStore and other extensions consume additional IDs. Check SideStore's App ID list rather than assuming two total. See the [SideStore FAQ](https://docs.sidestore.io/docs/faq).
- Still unverified on a phone: source import, re-signing, extension preservation, shared keychain data, widget display and refresh/recovery. If the widget stays empty after opening Plantry once, shared-keychain access is one thing to check; do not delete the app to troubleshoot it. Keep the widget extension when installing if offered a choice; CI verifies packaging, not the phone result.

## The home-screen widget

After the first install, long-press the home screen, tap **+** (or **Edit → Add Widget**), search for Plantry and add **Tonight**. It shows tonight's dinner, who cooks and washes up, what's missing, and the step you're on while cooking (with the timer). Tap it to jump into cook mode. It also works on the lock screen as a rectangular or inline widget.

## Cooking on the Lock Screen and in the Dynamic Island

Open cook mode and Plantry starts a Live Activity. Lock the phone or go to another app and the step you're on stays on the Lock Screen, and on iPhones with a Dynamic Island it sits in the island: a pan while you cook, a draining ring and the countdown once a timer runs, red when it's done. Long-press the island (or look at the Lock Screen) for the step itself and three buttons: back, the timer (start, pause, resume, stop ringing) and next. They work without opening the app. On the last step, Finish opens Plantry so the dinner gets logged.

It ends by itself when you finish, or if you open cook mode and close it again without starting. Nothing extra to sign: Live Activities updated by the app itself need no push and no paid account. To turn it off, Settings → Plantry → Live Activities.

## Paid: TestFlight and the App Store

Once you enrol in the Apple Developer Program:

1. Xcode → Signing & Capabilities → switch the team to your paid team. Keep **Automatically manage signing**.
2. App Store Connect → My Apps → **+** → New App. Bundle ID `com.destromoose.plantry`, name Plantry, SKU anything.
3. Xcode → Product → **Archive**, then **Distribute App** → TestFlight & App Store. The export-compliance key is already set (no non-exempt encryption), so there is no prompt.
4. In App Store Connect → TestFlight, add yourself and family as internal testers. Builds there last 90 days and need no weekly re-install.
5. For the public listing you need: the 1024 px icon (included), screenshots from the Simulator (6.9" and 6.5" iPhone), a privacy policy URL (the app collects nothing, so one paragraph), and the Age Rating questionnaire. The privacy manifest (`PrivacyInfo.xcprivacy`) is already in the app and declares coarse location (weather, optional) and the APIs used.
