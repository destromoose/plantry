# Putting Plantry on your iPhone

Two free signing routes use your own Apple ID: Xcode on a Mac, or AltStore Classic from a Windows PC. The paid route needs the Apple Developer Program and unlocks TestFlight and the App Store. The availability of the weekly IPA source is stated below.

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

## Free, from a Windows PC: AltStore Classic

No Mac or Xcode needed. A workflow builds an unsigned `Plantry.ipa` from master every Monday (and on every iOS change merged to master) and publishes it with an AltStore source:

`https://github.com/destromoose/plantry/releases/download/altstore-source/altstore.json`

**Availability:** the source is not live until the workflow is merged into `master` and the first publishing build succeeds. Branch and manual builds upload CI artifacts only.

One-time setup, following [AltStore's Windows guide](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows):

1. Install iTunes and iCloud **from Apple's website**, not the Microsoft Store (the guide links both), then [AltServer for Windows](https://altstore.io). Run AltServer as administrator.
2. Plug the iPhone in with a cable once, unlock it and tap **Trust**. In iTunes, sign in, open the phone → **Summary** → tick **Sync with this iPhone over Wi-Fi** → **Apply**.
3. Click the AltServer tray icon → **Install AltStore** → your iPhone, and type your Apple ID and password into AltServer (it sends them only to Apple).
4. On the phone: Settings → General → VPN & Device Management → your Apple ID → **Trust**, and Settings → Privacy & Security → **Developer Mode** → on (the phone restarts).
5. In AltStore: **Browse** → **Sources** → **+**, paste the source URL above, then tap **FREE** next to Plantry.

What happens after that:

- **Refresh (the 7-day expiry).** AltStore re-signs installed apps in the background, but only when the phone can reach AltServer: the PC is on and awake, AltServer is running, both are on the same Wi-Fi, and Background App Refresh is on for AltStore. If any of that fails for a week the apps stop opening; open AltStore → **My Apps** → **Refresh All** with the PC reachable. Keep AltServer starting with Windows.
- **New versions are not installed by themselves.** When a new weekly build is in the source, AltStore shows an update in **My Apps**; tap **Update** to install it (your data stays). Refreshing keeps the build you already have.
- AltStore itself uses one of the 3 active-app slots and its own App IDs. Check **My Apps → View App IDs** for the actual registered count.
- The widget is part of the app, so it costs no extra active-app slot, but it does use a second App ID each week.
- Not yet checked on a phone: the IPA is unsigned, so it carries no entitlements and AltStore signs it with your free profile's defaults. The widget finds tonight's dinner through a keychain group shared with the app; if the widget stays empty after you open Plantry once, that sharing did not survive AltStore's re-signing.

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

The repository default branch is currently `main`, which contains only the initial README. GitHub schedules run from the default branch, so the Monday schedule will not run on `master` until an owner separately approves changing the default branch to `master`. This change does not change the default branch. Approved iOS pushes to `master` can publish after merge; manual runs remain artifact-only.
