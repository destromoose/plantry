# Weekly AltStore build

`.github/workflows/ios-altstore.yml` archives an unsigned app and widget, validates the IPA, and uploads the IPA, inspection metadata, and candidate source as CI artifacts. Pull requests, the review branch, and manual dispatches are artifact-only. No Apple credentials or signing certificates are required in CI.

After an approved merge, pushes to `main` affecting iOS and the Monday 05:17 UTC schedule can publish releases. Only the canonical repository's `main` ref can enter the write-permission publish job. Publishing is serialized separately from artifact-only runs. Build numbers are `run_number.run_attempt`; lower builds cannot replace a newer published build. A failed old retry may build an artifact but cannot downgrade the feed.

The canonical source URL is:

`https://github.com/destromoose/plantry/releases/download/altstore-source/altstore.json`

It is **not live until the first successful publishing run**. An artifact or an open PR does not make it available. A candidate feed uploaded by a PR contains future release URLs; those links are not published by the PR.

Publication checks the public IPA download's hash and size before replacing the stable source. Each versioned IPA release also keeps `altstore.json` with its source history before the stable source is replaced. GitHub asset replacement is not atomic: an upload failure can temporarily remove the stable asset. If the source release exists but its asset is missing, subsequent runs stop rather than reset history. An authorized maintainer must restore the source asset from the newest validated versioned release's `altstore.json`, then retry. API failures and invalid previous JSON also stop publishing. Do not delete the source release to bypass this guard.

Run the standard-library tests with:

```sh
python3 ios/altstore/test_altstore_feed.py -v
```

The archive and its widget packaging can be checked in CI. AltStore re-signing, shared keychain behavior, and refresh on a real phone still require device testing; the archive does not prove those work.
