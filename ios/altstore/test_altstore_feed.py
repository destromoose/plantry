"""Tests for altstore_feed.py on small synthetic IPAs (zip + Info.plist + stub binary)."""

import json
import os
import plistlib
import struct
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import altstore_feed as af  # noqa: E402

URL = "https://github.com/destromoose/plantry/releases/download/plantry-ios-0.1.0-41.1/Plantry.ipa"


def entitlements_blob(ents):
    xml = plistlib.dumps(ents, fmt=plistlib.FMT_XML)
    return b"\x00" * 16 + af.ENTITLEMENTS_MAGIC + struct.pack(">I", len(xml) + 8) + xml + b"\x00" * 8


def info(bundle_id, exe, version="0.1.0", build="41.1", **extra):
    d = {
        "CFBundleIdentifier": bundle_id,
        "CFBundleExecutable": exe,
        "CFBundleShortVersionString": version,
        "CFBundleVersion": build,
        "MinimumOSVersion": "17.0",
    }
    d.update(extra)
    return plistlib.dumps(d)


class IPABuilder:
    def __init__(self, tmp):
        self.tmp = tmp
        self.n = 0

    def make(self, app_info=None, widget_info=None, widget_dir="PlantryWidget.appex", app_bin=b"\xcf\xfa\xed\xfe",
             widget_bin=b"\xcf\xfa\xed\xfe", with_widget=True, app_dir="Plantry.app"):
        self.n += 1
        path = os.path.join(self.tmp, f"t{self.n}.ipa")
        root = f"Payload/{app_dir}/"
        with zipfile.ZipFile(path, "w") as z:
            z.writestr(root + "Info.plist", app_info or info(
                af.APP_BUNDLE_ID, "Plantry",
                NSLocationWhenInUseUsageDescription="weather",
                NSCalendarsFullAccessUsageDescription="calendar"))
            z.writestr(root + "Plantry", app_bin)
            if with_widget:
                w = f"{root}PlugIns/{widget_dir}/"
                z.writestr(w + "Info.plist", widget_info or info(af.WIDGET_BUNDLE_ID, "PlantryWidget"))
                z.writestr(w + "PlantryWidget", widget_bin)
        return path


class InspectTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.b = IPABuilder(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_good_ipa(self):
        ipa = af.inspect_ipa(self.b.make())
        self.assertEqual(ipa["version"], "0.1.0")
        self.assertEqual(ipa["buildVersion"], "41.1")
        self.assertEqual(ipa["minOSVersion"], "17.0")
        self.assertEqual([e["bundleIdentifier"] for e in ipa["extensions"]], [af.WIDGET_BUNDLE_ID])
        self.assertEqual(set(ipa["privacy"]), {"NSLocationWhenInUseUsageDescription", "NSCalendarsFullAccessUsageDescription"})
        self.assertEqual(ipa["entitlements"], [])
        self.assertEqual(len(ipa["sha256"]), 64)

    def test_missing_widget(self):
        with self.assertRaisesRegex(af.FeedError, "PlantryWidget"):
            af.inspect_ipa(self.b.make(with_widget=False))

    def test_widget_outside_plugins_is_missing(self):
        path = os.path.join(self._tmp.name, "flat.ipa")
        with zipfile.ZipFile(path, "w") as z:
            z.writestr("Payload/Plantry.app/Info.plist", info(af.APP_BUNDLE_ID, "Plantry"))
            z.writestr("Payload/Plantry.app/Plantry", b"x")
            z.writestr("Payload/PlantryWidget.appex/Info.plist", info(af.WIDGET_BUNDLE_ID, "W"))
        with self.assertRaisesRegex(af.FeedError, "PlantryWidget"):
            af.inspect_ipa(path)

    def test_missing_app(self):
        with self.assertRaisesRegex(af.FeedError, "Plantry.app missing"):
            af.inspect_ipa(self.b.make(app_dir="Other.app"))

    def test_not_a_zip(self):
        path = os.path.join(self._tmp.name, "page.ipa")
        with open(path, "w") as f:
            f.write("<html>Not Found</html>")
        with self.assertRaisesRegex(af.FeedError, "not a readable IPA"):
            af.inspect_ipa(path)

    def test_wrong_app_bundle_id(self):
        with self.assertRaisesRegex(af.FeedError, "app bundle id"):
            af.inspect_ipa(self.b.make(app_info=info("com.example.plantry", "Plantry")))

    def test_wrong_widget_bundle_id(self):
        with self.assertRaisesRegex(af.FeedError, "widget bundle ids"):
            af.inspect_ipa(self.b.make(widget_info=info("com.destromoose.other", "PlantryWidget")))

    def test_widget_version_mismatch(self):
        with self.assertRaisesRegex(af.FeedError, "must match"):
            af.inspect_ipa(self.b.make(widget_info=info(af.WIDGET_BUNDLE_ID, "PlantryWidget", build="40.1")))

    def test_bad_versions(self):
        for v in ("1.2.3.4", "1.0-beta", "", "abc"):
            with self.subTest(v=v), self.assertRaisesRegex(af.FeedError, "CFBundleShortVersionString"):
                af.inspect_ipa(self.b.make(
                    app_info=info(af.APP_BUNDLE_ID, "Plantry", version=v),
                    widget_info=info(af.WIDGET_BUNDLE_ID, "PlantryWidget", version=v)))
        for b in ("6c8a636", "1.2.3.4"):
            with self.subTest(b=b), self.assertRaisesRegex(af.FeedError, "CFBundleVersion"):
                af.inspect_ipa(self.b.make(
                    app_info=info(af.APP_BUNDLE_ID, "Plantry", build=b),
                    widget_info=info(af.WIDGET_BUNDLE_ID, "PlantryWidget", build=b)))

    def test_embedded_entitlements_are_read_and_merged(self):
        app = entitlements_blob({"application-identifier": "T.com.destromoose.plantry",
                                 "keychain-access-groups": ["T.com.destromoose.plantry.shared"]})
        widget = entitlements_blob({"com.apple.developer.team-identifier": "T", "get-task-allow": True})
        ipa = af.inspect_ipa(self.b.make(app_bin=app, widget_bin=widget))
        self.assertEqual(ipa["entitlements"], ["get-task-allow", "keychain-access-groups"])

    def test_widget_privacy_strings_included(self):
        ipa = af.inspect_ipa(self.b.make(widget_info=info(
            af.WIDGET_BUNDLE_ID, "PlantryWidget", NSLocationWhenInUseUsageDescription="w",
            NSMicrophoneUsageDescription="mic")))
        self.assertEqual(ipa["privacy"]["NSLocationWhenInUseUsageDescription"], "weather")
        self.assertEqual(ipa["privacy"]["NSMicrophoneUsageDescription"], "mic")


class FeedTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.b = IPABuilder(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def ipa(self, build):
        return af.inspect_ipa(self.b.make(
            app_info=info(af.APP_BUNDLE_ID, "Plantry", build=build, NSLocationWhenInUseUsageDescription="weather"),
            widget_info=info(af.WIDGET_BUNDLE_ID, "PlantryWidget", build=build)))

    def url(self, build):
        return f"https://github.com/destromoose/plantry/releases/download/plantry-ios-0.1.0-{build}/Plantry.ipa"

    def test_first_feed_matches_ipa(self):
        ipa = self.ipa("41.1")
        feed = af.make_feed(ipa, self.url("41.1"), date="2026-11-07")
        self.assertTrue(af.check_feed(feed))
        app = feed["apps"][0]
        self.assertEqual(app["bundleIdentifier"], af.APP_BUNDLE_ID)
        v = app["versions"][0]
        self.assertEqual((v["version"], v["buildVersion"], v["size"], v["sha256"], v["minOSVersion"]),
                         (ipa["version"], ipa["buildVersion"], ipa["size"], ipa["sha256"], "17.0"))
        self.assertEqual(app["appPermissions"], {"entitlements": [], "privacy": {"NSLocationWhenInUseUsageDescription": "weather"}})
        json.dumps(feed)  # serialisable

    def test_new_build_goes_first(self):
        old = af.make_feed(self.ipa("41.1"), self.url("41.1"))
        new = af.make_feed(self.ipa("42.1"), self.url("42.1"), previous=old)
        self.assertEqual([v["buildVersion"] for v in new["apps"][0]["versions"]], ["42.1", "41.1"])

    def test_numeric_not_string_ordering(self):
        old = af.make_feed(self.ipa("9.1"), self.url("9.1"))
        new = af.make_feed(self.ipa("10.1"), self.url("10.1"), previous=old)
        self.assertEqual(new["apps"][0]["versions"][0]["buildVersion"], "10.1")

    def test_retry_attempt_is_newer(self):
        old = af.make_feed(self.ipa("41.1"), self.url("41.1"))
        new = af.make_feed(self.ipa("41.2"), self.url("41.2"), previous=old)
        self.assertEqual([v["buildVersion"] for v in new["apps"][0]["versions"]], ["41.2", "41.1"])

    def test_republishing_same_build_is_idempotent(self):
        ipa = self.ipa("41.1")
        once = af.make_feed(ipa, self.url("41.1"), date="d")
        twice = af.make_feed(ipa, self.url("41.1"), previous=once, date="d")
        self.assertEqual(once, twice)

    def test_older_build_rejected(self):
        new = af.make_feed(self.ipa("42.1"), self.url("42.1"))
        with self.assertRaisesRegex(af.FeedError, "older than published"):
            af.make_feed(self.ipa("41.3"), self.url("41.3"), previous=new)

    def test_history_is_capped(self):
        feed = None
        for n in range(1, 15):
            feed = af.make_feed(self.ipa(f"{n}.1"), self.url(f"{n}.1"), previous=feed)
        builds = [v["buildVersion"] for v in feed["apps"][0]["versions"]]
        self.assertEqual(len(builds), af.KEEP_VERSIONS)
        self.assertEqual(builds[0], "14.1")

    def test_download_url_must_be_https_ipa(self):
        ipa = self.ipa("41.1")
        for bad in ("http://example.com/Plantry.ipa", "https://github.com/destromoose/plantry/releases/latest",
                    "https://example.com/index.html"):
            with self.subTest(bad=bad), self.assertRaises(af.FeedError):
                af.make_feed(ipa, bad)

    def test_check_feed_catches_unordered(self):
        feed = af.make_feed(self.ipa("41.1"), self.url("41.1"))
        feed["apps"][0]["versions"].append(dict(feed["apps"][0]["versions"][0], buildVersion="42.1"))
        with self.assertRaises(af.FeedError):
            af.check_feed(feed)

    def test_cli_writes_feed(self):
        path = self.b.make()
        out = os.path.join(self._tmp.name, "feed.json")
        self.assertEqual(af.main(["feed", path, "--download-url", URL, "--out", out]), 0)
        with open(out) as f:
            feed = json.load(f)
        self.assertEqual(feed["apps"][0]["versions"][0]["downloadURL"], URL)
        self.assertEqual(af.main(["inspect", os.path.join(self._tmp.name, "missing.ipa")]), 1)


if __name__ == "__main__":
    unittest.main()
