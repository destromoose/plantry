# Putting Plantry on your iPhone

Two routes. The free one works today with any Apple ID; the paid one needs the Apple Developer Program ($99/year) and unlocks TestFlight and the App Store.

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

Limits of a free team: up to 3 app IDs installed at once (Plantry uses 2: the app and its widget), 10 device registrations per week, and the 7-day expiry. If the phone says it has reached the maximum number of apps using a free developer profile, delete one of your other self-installed apps. Plantry uses nothing a free team cannot sign: timers use local notifications, the calendar export uses the phone's Calendar, and the widget reads tonight's dinner from a shared keychain item (keychain sharing works on a free team; App Groups do not).

## The home-screen widget

After the first install, long-press the home screen, tap **+** (or **Edit → Add Widget**), search for Plantry and add **Tonight**. It shows tonight's dinner, who cooks and washes up, what's missing, and the step you're on while cooking (with the timer). Tap it to jump into cook mode. It also works on the lock screen as a rectangular or inline widget.

## Paid: TestFlight and the App Store

Once you enrol in the Apple Developer Program:

1. Xcode → Signing & Capabilities → switch the team to your paid team. Keep **Automatically manage signing**.
2. App Store Connect → My Apps → **+** → New App. Bundle ID `com.destromoose.plantry`, name Plantry, SKU anything.
3. Xcode → Product → **Archive**, then **Distribute App** → TestFlight & App Store. The export-compliance key is already set (no non-exempt encryption), so there is no prompt.
4. In App Store Connect → TestFlight, add yourself and family as internal testers. Builds there last 90 days and need no weekly re-install.
5. For the public listing you need: the 1024 px icon (included), screenshots from the Simulator (6.9" and 6.5" iPhone), a privacy policy URL (the app collects nothing, so one paragraph), and the Age Rating questionnaire. The privacy manifest (`PrivacyInfo.xcprivacy`) is already in the app and declares coarse location (weather, optional) and the APIs used.
