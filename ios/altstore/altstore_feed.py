#!/usr/bin/env python3
"""Check a built Plantry.ipa and write the AltStore Classic source for it.

Everything in the source comes from the IPA itself: bundle ids, version, build,
minimum iOS, privacy strings and the entitlements embedded in the binaries.
AltStore refuses to install an app whose IPA does not match its source listing,
so nothing here is typed in by hand.

    altstore_feed.py inspect Plantry.ipa
    altstore_feed.py feed Plantry.ipa --download-url URL --previous old.json --out new.json

Standard library only, so it runs on the macOS build runner, the Linux publish
runner and in the unit tests alike.
"""

import argparse
import datetime
import hashlib
import json
import plistlib
import re
import struct
import sys
import zipfile

APP_BUNDLE_ID = "com.destromoose.plantry"
WIDGET_BUNDLE_ID = "com.destromoose.plantry.widget"
APP_PATH = "Payload/Plantry.app/"
WIDGET_RE = re.compile(r"^Payload/Plantry\.app/PlugIns/(PlantryWidget[^/]*\.appex)/$")
# Apple: up to three period-separated non-negative integers.
VERSION_RE = re.compile(r"^\d+(\.\d+){0,2}$")
# What AltStore counts as a privacy permission (VerifyAppOperation.swift).
PRIVACY_RE = re.compile(r"^NS\w*UsageDescription$")
# AltStore ignores these two when matching entitlements.
IGNORED_ENTITLEMENTS = {"application-identifier", "com.apple.developer.team-identifier"}
# Embedded entitlements blob inside an LC_CODE_SIGNATURE superblob.
ENTITLEMENTS_MAGIC = b"\xfa\xde\x71\x71"
KEEP_VERSIONS = 10

SOURCE_META = {
    "name": "Plantry",
    "subtitle": "Dinner, decided.",
    "description": "Weekly builds of Plantry for iPhone, straight from the master branch.",
    "website": "https://github.com/destromoose/plantry",
    "tintColor": "#C8552F",
}
APP_META = {
    "name": "Plantry",
    "developerName": "destromoose",
    "subtitle": "Dinner, decided.",
    "localizedDescription": (
        "Plantry picks tonight's dinner from your recipes, your pantry and the week ahead, "
        "and walks you through cooking it. Includes the Tonight home-screen widget and the "
        "cook-mode Live Activity. Works offline, with optional household sync."
    ),
    "iconURL": "https://raw.githubusercontent.com/destromoose/plantry/master/ios/Plantry/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png",
    "tintColor": "#C8552F",
    "category": "lifestyle",
}


class FeedError(Exception):
    pass


def embedded_entitlements(binary):
    """Entitlements a Mach-O was signed with, or {} for an unsigned binary.

    Reads the XML entitlements blob (magic 0xfade7171, big-endian length that
    includes the 8-byte header) the same way `codesign -d --entitlements` does.
    """
    found = {}
    start = 0
    while True:
        i = binary.find(ENTITLEMENTS_MAGIC, start)
        if i < 0:
            return found
        if i + 8 > len(binary):
            raise FeedError(f"truncated entitlements header at offset {i}")
        (length,) = struct.unpack(">I", binary[i + 4:i + 8])
        if length < 8 or i + length > len(binary):
            raise FeedError(f"invalid entitlements length at offset {i}: {length}")
        payload = binary[i + 8:i + length]
        start = i + 4
        if not payload.lstrip().startswith(b"<?xml"):
            continue
        try:
            found.update(plistlib.loads(payload))
        except Exception as e:
            raise FeedError(f"unreadable entitlements blob at offset {i}: {e}")


def read_bundle(zf, root):
    try:
        info = plistlib.loads(zf.read(root + "Info.plist"))
    except KeyError:
        raise FeedError(f"{root}Info.plist missing")
    exe = info.get("CFBundleExecutable")
    if not exe:
        raise FeedError(f"{root}Info.plist has no CFBundleExecutable")
    try:
        binary = zf.read(root + exe)
    except KeyError:
        raise FeedError(f"{root}{exe} (executable) missing")
    return {
        "path": root,
        "bundleIdentifier": info.get("CFBundleIdentifier"),
        "version": info.get("CFBundleShortVersionString"),
        "buildVersion": info.get("CFBundleVersion"),
        "minOSVersion": info.get("MinimumOSVersion"),
        "privacy": {k: v for k, v in info.items() if PRIVACY_RE.match(k)},
        "entitlements": embedded_entitlements(binary),
    }


def build_key(build):
    return tuple(int(p) for p in build.split("."))


def inspect_ipa(path):
    """Open the IPA, check it is a complete Plantry build, and describe it."""
    try:
        zf = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, FileNotFoundError) as e:
        raise FeedError(f"{path} is not a readable IPA (zip): {e}")
    with zf:
        names = zf.namelist()
        dirs = set(names) | {n[: n.rfind("/") + 1] for n in names}
        # Every ancestor directory, so a zip without explicit dir entries still works.
        for n in list(dirs):
            parts = n.split("/")
            for k in range(1, len(parts)):
                dirs.add("/".join(parts[:k]) + "/")
        if APP_PATH not in dirs:
            raise FeedError("Payload/Plantry.app missing")
        widgets = sorted(m.group(1) for d in dirs if (m := WIDGET_RE.match(d)))
        if not widgets:
            raise FeedError("Payload/Plantry.app/PlugIns/PlantryWidget*.appex missing")
        app = read_bundle(zf, APP_PATH)
        exts = [read_bundle(zf, f"{APP_PATH}PlugIns/{w}/") for w in widgets]

    if app["bundleIdentifier"] != APP_BUNDLE_ID:
        raise FeedError(f"app bundle id is {app['bundleIdentifier']!r}, expected {APP_BUNDLE_ID!r}")
    if [e["bundleIdentifier"] for e in exts] != [WIDGET_BUNDLE_ID]:
        raise FeedError(f"widget bundle ids are {[e['bundleIdentifier'] for e in exts]}, expected [{WIDGET_BUNDLE_ID!r}]")
    version, build = app["version"], app["buildVersion"]
    if not isinstance(version, str) or not VERSION_RE.match(version):
        raise FeedError(f"CFBundleShortVersionString {version!r} is not 1-3 numeric components")
    if not isinstance(build, str) or not VERSION_RE.match(build):
        raise FeedError(f"CFBundleVersion {build!r} is not 1-3 numeric components")
    for e in exts:
        if (e["version"], e["buildVersion"]) != (version, build):
            raise FeedError(
                f"widget is {e['version']} ({e['buildVersion']}) but app is {version} ({build}); they must match"
            )
    if not app["minOSVersion"]:
        raise FeedError("app has no MinimumOSVersion")

    entitlements = set(app["entitlements"])
    privacy = dict(app["privacy"])
    for e in exts:
        entitlements |= set(e["entitlements"])
        for k, v in e["privacy"].items():
            privacy.setdefault(k, v)
    with open(path, "rb") as f:
        data = f.read()
    return {
        "bundleIdentifier": app["bundleIdentifier"],
        "extensions": [{"path": e["path"], "bundleIdentifier": e["bundleIdentifier"]} for e in exts],
        "version": version,
        "buildVersion": build,
        "minOSVersion": app["minOSVersion"],
        "privacy": privacy,
        "entitlements": sorted(entitlements - IGNORED_ENTITLEMENTS),
        "rawEntitlements": {
            "app": app["entitlements"],
            **{e["bundleIdentifier"]: e["entitlements"] for e in exts},
        },
        "size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def make_feed(ipa, download_url, previous=None, date=None, notes=None):
    """Source JSON with this build first, older builds after, newest to oldest.

    Re-running for a build already in the feed replaces that entry (a retried
    publish is a no-op). A build lower than the newest already published is an
    error: AltStore only looks at the first entry, so it would read as a downgrade.
    """
    if not download_url.startswith("https://"):
        raise FeedError(f"downloadURL must be https, got {download_url!r}")
    if not download_url.endswith(".ipa"):
        raise FeedError(f"downloadURL must point at the .ipa, got {download_url!r}")
    entry = {
        "version": ipa["version"],
        "buildVersion": ipa["buildVersion"],
        "date": date or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "localizedDescription": notes or f"Build {ipa['buildVersion']} from master.",
        "downloadURL": download_url,
        "size": ipa["size"],
        "sha256": ipa["sha256"],
        "minOSVersion": ipa["minOSVersion"],
    }
    older = []
    if previous is not None:
        try:
            apps = [a for a in previous["apps"] if a["bundleIdentifier"] == ipa["bundleIdentifier"]]
            if len(apps) != 1 or not isinstance(apps[0]["versions"], list) or not apps[0]["versions"]:
                raise ValueError("expected one Plantry app with published versions")
            check_feed({"apps": apps})
            older = apps[0]["versions"]
        except (KeyError, IndexError, TypeError, ValueError, AttributeError, FeedError) as e:
            raise FeedError(f"invalid previous source: {e}") from e
    older = [v for v in older if v.get("buildVersion") != ipa["buildVersion"]]
    if older:
        newest = max(older, key=lambda v: build_key(v["buildVersion"]))
        if build_key(ipa["buildVersion"]) < build_key(newest["buildVersion"]):
            raise FeedError(
                f"build {ipa['buildVersion']} is older than published build {newest['buildVersion']}"
            )
    versions = sorted([entry] + older, key=lambda v: build_key(v["buildVersion"]), reverse=True)
    app = dict(APP_META)
    app.update(
        bundleIdentifier=ipa["bundleIdentifier"],
        versions=versions[:KEEP_VERSIONS],
        appPermissions={"entitlements": ipa["entitlements"], "privacy": ipa["privacy"]},
    )
    return dict(SOURCE_META, apps=[app], news=[])


def check_feed(feed):
    """The invariants the tests and the publish job rely on."""
    app = feed["apps"][0]
    versions = app["versions"]
    keys = [build_key(v["buildVersion"]) for v in versions]
    if keys != sorted(keys, reverse=True) or len(set(keys)) != len(keys):
        raise FeedError("versions are not unique and newest first")
    for v in versions:
        for field in ("version", "buildVersion", "date", "downloadURL", "size"):
            if field not in v:
                raise FeedError(f"version entry missing {field}")
        if not v["downloadURL"].startswith("https://") or not v["downloadURL"].endswith(".ipa"):
            raise FeedError(f"bad downloadURL {v['downloadURL']!r}")
    return True


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("inspect", help="validate an IPA and print what it contains")
    i.add_argument("ipa")
    f = sub.add_parser("feed", help="write the AltStore source for an IPA")
    f.add_argument("ipa")
    f.add_argument("--download-url", required=True)
    f.add_argument("--previous", help="currently published source JSON, if any")
    f.add_argument("--name", help="override the source name (preview feeds)")
    f.add_argument("--notes")
    f.add_argument("--out", required=True)
    args = p.parse_args(argv)
    try:
        ipa = inspect_ipa(args.ipa)
        if args.cmd == "inspect":
            json.dump(ipa, sys.stdout, indent=2, default=str)
            print()
            return 0
        previous = None
        if args.previous:
            with open(args.previous) as fh:
                previous = json.load(fh)
            if not isinstance(previous, dict):
                raise FeedError("previous source must be a JSON object")
        feed = make_feed(ipa, args.download_url, previous, notes=args.notes)
        if args.name:
            feed["name"] = args.name
        check_feed(feed)
        with open(args.out, "w") as fh:
            json.dump(feed, fh, indent=2)
            fh.write("\n")
        print(f"{args.out}: {ipa['version']} ({ipa['buildVersion']}) {ipa['size']} bytes sha256 {ipa['sha256']}")
        return 0
    except FeedError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
