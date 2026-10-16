"""Offline preservation/network checks: python -m ml.python.test_ml_safety."""
import io
import json
import os
import tempfile
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd

from . import campaign, data, refresh


def test_refuse_real_latest():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        latest = root / "latest"
        latest.mkdir()
        sentinel = latest / "keep.txt"
        sentinel.write_text("original data")
        with patch.object(data, "RAW_DIR", root):
            try:
                data.save_dataset({}, {})
            except FileExistsError:
                pass
            else:
                raise AssertionError("real latest directory must be refused")
        assert latest.is_dir() and not latest.is_symlink()
        assert sentinel.read_text() == "original data"


def test_atomic_latest_and_failure():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        old = root / "old"
        old.mkdir()
        sentinel = old / "keep.txt"
        sentinel.write_text("original data")
        latest = root / "latest"
        latest.symlink_to("old")
        replace = os.replace

        def observed_replace(source, destination):
            assert latest.is_symlink() and os.readlink(latest) == "old"
            assert Path(source).is_symlink() and Path(source).parent == root
            assert Path(destination) == latest
            replace(source, destination)

        with patch.object(data, "RAW_DIR", root), patch("os.replace", side_effect=observed_replace) as call:
            saved = data.save_dataset({}, {})
        call.assert_called_once()
        assert latest.resolve() == saved and sentinel.read_text() == "original data"
        assert refresh.atomic_symlink is data.atomic_symlink
        before = set(root.iterdir())
        with patch("os.replace", side_effect=OSError("simulated replacement failure")):
            try:
                data.atomic_symlink(latest, "old")
            except OSError:
                pass
            else:
                raise AssertionError("replacement failure must propagate")
        assert latest.resolve() == saved and set(root.iterdir()) == before
        assert sentinel.read_text() == "original data"
        broken = root / "broken"
        broken.symlink_to("missing")
        data.atomic_symlink(broken, "old")
        assert broken.resolve() == old
        absent = root / "absent"
        data.atomic_symlink(absent, "old")
        assert absent.resolve() == old
        regular = root / "regular"
        regular.write_text("not a pointer")
        try:
            data.atomic_symlink(regular, "old")
        except FileExistsError:
            pass
        else:
            raise AssertionError("regular file must be refused")
        assert regular.read_text() == "not a pointer"


def _provider_result():
    timestamps = [int(pd.Timestamp(date, tz="UTC").timestamp())
                  for date in ("2010-01-04 14:30", "2010-01-05 14:30")]
    quotes = {"open": [10., 11.], "high": [12., 13.], "low": [9., 10.],
              "close": [11., 12.], "volume": [0, 100]}
    return {"timestamp": timestamps, "indicators": {"quote": [quotes]}}


def _acquire_mocked(out, payload):
    class Response(io.BytesIO):
        status = 200

        def read(self, size=-1):
            assert size == 8_000_001, "must read one extra byte to detect oversize"
            return super().read(size)

    def opened(request, timeout):
        assert timeout == 12
        return Response(payload)

    with patch("urllib.request.urlopen", side_effect=opened), \
            patch("urllib.request.build_opener", return_value=SimpleNamespace(open=opened)):
        return campaign.acquire_context(out, pd.Timestamp("2010-01-05"))


def test_reject_malformed_provider_before_persistence():
    bad = []
    for field, value in (("open", [10.]), ("high", [None, 13.]),
                         ("low", [float("nan"), 10.]), ("close", [float("inf"), 12.]),
                         ("open", ["10", 11.]), ("open", [True, 11.]),
                         ("volume", [-1, 100]), ("high", [8., 13.]),
                         ("close", [0., 12.])):
        result = _provider_result()
        result["indicators"]["quote"][0][field] = value
        bad.append(result)
    for timestamps in ([1262615400, 1262615400], [1262701800, 1262615400],
                       [1262615400, 1262788200], [True, 1262701800],
                       [1262615400, 1262619000], [], "not an array"):
        result = _provider_result()
        result["timestamp"] = timestamps
        bad.append(result)
    missing = _provider_result()
    del missing["indicators"]["quote"][0]["volume"]
    bad.append(missing)
    too_many = _provider_result()
    too_many["timestamp"] *= 3
    for field in too_many["indicators"]["quote"][0]:
        too_many["indicators"]["quote"][0][field] *= 3
    bad.append(too_many)
    with tempfile.TemporaryDirectory() as directory:
        for i, result in enumerate(bad):
            out = Path(directory) / str(i)
            payload = json.dumps({"chart": {"result": [result]}}).encode()
            assert _acquire_mocked(out, payload) == {}, f"accepted malformed case {i}"
            assert {p.name for p in out.iterdir()} == {"ACCESS.json"}, "persisted invalid provider bytes"
            records = json.loads((out / "ACCESS.json").read_text())
            assert all("error" in record for record in records)
        out = Path(directory) / "oversize"
        assert _acquire_mocked(out, b" " * 8_000_001) == {}
        assert {p.name for p in out.iterdir()} == {"ACCESS.json"}
        assert all("exceeds" in record["error"] for record in json.loads((out / "ACCESS.json").read_text()))


def test_valid_provider_and_redirect_allowlist():
    with tempfile.TemporaryDirectory() as directory:
        out = Path(directory) / "context"
        payload = json.dumps({"chart": {"result": [_provider_result()]}}).encode()
        raw = _acquire_mocked(out, payload)
        assert set(raw) == {"XLK", "XLF", "XLE", "^VIX"}
        assert all(len(frame) == 2 and frame.index.is_unique for frame in raw.values())
    handler = campaign.ContextRedirectHandler()
    request = urllib.request.Request("https://query1.finance.yahoo.com/start")
    for url in ("http://query1.finance.yahoo.com/x", "https://example.com/x",
                "https://query1.finance.yahoo.com.evil.test/x", "https://127.0.0.1/x",
                "https://user@query1.finance.yahoo.com/x", "https://query1.finance.yahoo.com:444/x"):
        try:
            handler.redirect_request(request, None, 302, "found", {}, url)
        except ValueError:
            pass
        else:
            raise AssertionError(f"accepted redirect {url}")
    allowed = "https://query2.finance.yahoo.com/x"
    assert handler.redirect_request(request, None, 302, "found", {}, allowed).full_url == allowed


def main():
    test_refuse_real_latest()
    test_atomic_latest_and_failure()
    test_reject_malformed_provider_before_persistence()
    test_valid_provider_and_redirect_allowlist()
    print("4 ML safety checks passed: directory preservation, atomic pointers, provider bounds, HTTPS redirects")


if __name__ == "__main__":
    main()
