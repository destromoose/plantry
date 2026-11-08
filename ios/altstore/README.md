# Weekly IPA build for SideStore / AltStore sources

`.github/workflows/ios-altstore.yml` archives an unsigned app and widget, validates the IPA, and uploads the IPA, inspection metadata, and candidate source as CI artifacts. Pull requests and manual dispatches are artifact-only. No Apple credentials or signing certificates are required in CI. Pull requests also run the existing CI and iOS simulator test workflows with read-only tokens.

After an approved merge, pushes to `master` affecting iOS can publish releases. The Monday 05:17 UTC schedule can publish only after a separately approved change of the repository default branch to `master`; it is currently inactive because the default is `main`. Only the canonical repository's `master` ref can enter the write-permission publish job. Publishing is serialized separately from artifact-only runs. Build numbers are `run_number.run_attempt`; lower builds cannot replace a newer published build. A failed old retry may build an artifact but cannot downgrade the feed.

The canonical source URL is:

`https://github.com/destromoose/plantry/releases/download/altstore-source/altstore.json`

It is **not live until the first successful publishing run**. An artifact or an open PR does not make it available. A candidate feed uploaded by a PR contains future release URLs; those links are not published by the PR.

Publication checks the public IPA download's hash and size before replacing the stable source. Each versioned IPA release also keeps `altstore.json` with its source history before the stable source is replaced. GitHub asset replacement is not atomic: an upload failure can temporarily remove the stable asset. If the source release exists but its asset is missing, subsequent runs stop rather than reset history. An authorized maintainer must restore the source asset from the newest validated versioned release's `altstore.json`, then retry. API failures and invalid previous JSON also stop publishing. Do not delete the source release to bypass this guard.

Run the standard-library tests with:

```sh
python3 ios/altstore/test_altstore_feed.py -v
```

The archive and its widget packaging can be checked in CI. SideStore re-signing, shared keychain behavior, and refresh on a real phone still require device testing; the archive does not prove those work.

The repository default branch is currently `main`, which contains only the initial README. GitHub schedules run from the default branch, so the Monday schedule will not run on `master` until an owner separately approves changing the default branch to `master`. This change does not change the default branch. Approved iOS pushes to `master` can publish after merge; manual runs remain artifact-only.


## SideStore compatibility (checked 8 November 2026)

The Windows installation route is now [SideStore + iloader + LocalDevVPN](../INSTALL.md#free-with-a-windows-pc-once-sidestore). The workflow filename, `altstore-source` release tag, `altstore.json` asset and AltStore-format JSON remain unchanged so existing clients and links keep working. No generator change is needed for this route.

[SideStore's source guide](https://docs.sidestore.io/docs/advanced/app-sources) says it supports AltStore sources. More specifically, we inspected its actual decoder at [`6032424a0e56c1c319762e786099bdd9186a238b`](https://github.com/SideStore/SideStore/tree/6032424a0e56c1c319762e786099bdd9186a238b), the release selected by [iloader 2.4.1's **Install SideStore (Stable)** action](https://github.com/nab138/iloader/blob/9797ecaf6ccdcfc68bd2ef4e0b1123910dd847b6/src-tauri/src/sideload.rs#L98) on the checked date. GitHub's latest release is labelled **0.7.0-alpha**, despite `prerelease=false`; “Stable” is the installer's button label, not a guarantee about that release. Check the official release before an eventual installation. The decoder evidence is:

| Generated fields | Actual SideStore decoding path |
| --- | --- |
| Source `name`, `description`, `website`, `apps`, `news`; no `identifier` | [`Source.swift`](https://github.com/SideStore/SideStore/blob/6032424a0e56c1c319762e786099bdd9186a238b/AltStore/Core/Model/Source.swift) decodes these fields; its identity comes from the fetched source URL, with optional `identifier` for grouping. |
| App `bundleIdentifier`, `name`, `developerName`, `localizedDescription`, `iconURL`, `versions` | [`StoreApp.swift`](https://github.com/SideStore/SideStore/blob/6032424a0e56c1c319762e786099bdd9186a238b/AltStore/Core/Model/StoreApp.swift) accepts `versions`; app-level legacy `versionDate`/`downloadURL` fields are unnecessary when versions populate the app. |
| `appPermissions.entitlements` string array; `appPermissions.privacy` dictionary of full `NS…UsageDescription` keys | [`AppPermission.swift`](https://github.com/SideStore/SideStore/blob/6032424a0e56c1c319762e786099bdd9186a238b/AltStore/Core/Model/AppPermission.swift) accepts both representations. [`StoreApp.swift`](https://github.com/SideStore/SideStore/blob/6032424a0e56c1c319762e786099bdd9186a238b/AltStore/Core/Model/StoreApp.swift#L275) maps its internal property named `permissions` to JSON **`appPermissions`**; do not rename the JSON field. |
| Per-version `version`, `buildVersion`, `date`, `downloadURL`, `size`, `sha256`, `minOSVersion` | [`AppVersion.swift`](https://github.com/SideStore/SideStore/blob/6032424a0e56c1c319762e786099bdd9186a238b/AltStore/Core/Model/AppVersion.swift) decodes these keys. The generator emits UTC ISO-8601 timestamps and newest-first versions. |

The source omits `marketplaceID` and notarized `build` metadata. It remains a sideloading source, not an AltStore PAL marketplace listing. The widget stays inside the IPA; it is not a separate source app entry. Source permission metadata describes the archive; it does not prove that signing preserves shared-keychain access.

This is **static source-code compatibility inspection**, supported by the existing 24 feed/IPA tests and generated artifact checks. We did not execute SideStore's UIKit/CoreData decoder here, import the source on a phone, or test installation, widget data or refresh. No schema defect was found, so no speculative format change or duplicate schema test was added. The source remains unavailable until an approved merge and first publication.
