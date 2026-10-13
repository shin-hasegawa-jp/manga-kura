"""Deployment orchestration tests with fake cloud CLIs; no GCP calls."""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MOCK = """#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ['CALL_LOG'], 'a') as out:
    out.write(json.dumps([name, *args]) + '\\n')
mode = os.environ['MODE']
if name == 'gcloud':
    if args[:3] == ['run', 'services', 'describe']:
        print(json.dumps({'status': {'url': 'https://wrong.run.app' if mode == 'wrong-url' else 'https://api.run.app', 'traffic': [{'revisionName': 'old', 'percent': 100}, {'tag': 'cd-candidate', 'url': 'https://candidate.run.app'}]}}))
    elif args[:4] == ['artifacts', 'docker', 'images', 'describe']:
        print('sha256:' + 'a' * 64)
    elif args[:2] == ['auth', 'print-access-token']:
        print('fake-token')
elif name == 'curl':
    if 'https://candidate.run.app/health' in args and mode == 'bad-health':
        print('{"status":"broken"}')
    elif any('/health' in a for a in args):
        print('{"status":"ok"}')
    elif any('firebasehosting.googleapis.com' in a for a in args):
        print('{"releases":[{"version":{"name":"old-hosting-version"}}]}')
elif name == 'firebase' and mode == 'hosting-failure':
    sys.exit(1)
"""


class DeploymentTest(unittest.TestCase):
    def run_deploy(self, mode):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            for name in ("gcloud", "docker", "curl", "firebase"):
                cli = base / name
                cli.write_text(MOCK)
                cli.chmod(0o755)
            env = dict(
                os.environ,
                PATH=f"{base}:{os.environ['PATH']}",
                PROJECT_ID="manga-kura",
                REGION="asia-northeast1",
                SERVICE="api-prod",
                API_URL="https://api.run.app",
                WEB_URL="https://manga-kura.web.app",
                GITHUB_SHA="b" * 40,
                GITHUB_RUN_ID="123",
                GITHUB_RUN_ATTEMPT="2",
                GITHUB_STEP_SUMMARY=str(base / "summary"),
                CALL_LOG=str(base / "calls"),
                MODE=mode,
            )
            result = subprocess.run(
                ["bash", "scripts/deploy-production.sh"],
                cwd=ROOT,
                env=env,
                check=False,
                capture_output=True,
                text=True,
            )
            calls = [
                json.loads(line) for line in (base / "calls").read_text().splitlines()
            ]
            summary = (
                (base / "summary").read_text() if (base / "summary").exists() else ""
            )
            return result, calls, summary

    def test_success_order_and_digest(self):
        result, calls, summary = self.run_deploy("ok")
        self.assertEqual(result.returncode, 0, result.stderr)
        deploy = next(c for c in calls if c[:3] == ["gcloud", "run", "deploy"])
        self.assertIn("--no-traffic", deploy)
        self.assertIn("--revision-suffix=cd-123-2", deploy)
        self.assertTrue(any("@sha256:" in arg for arg in deploy))
        health = next(
            i for i, c in enumerate(calls) if "https://candidate.run.app/health" in c
        )
        promote = next(
            i
            for i, c in enumerate(calls)
            if c[:4] == ["gcloud", "run", "services", "update-traffic"]
        )
        hosting = next(i for i, c in enumerate(calls) if c[0] == "firebase")
        self.assertLess(health, promote)
        self.assertLess(promote, hosting)
        self.assertIn("hosting:prod", calls[hosting])
        self.assertIn("old-hosting-version", summary)
        self.assertIn("old", summary)
        self.assertNotIn("fake-token", summary)

    def test_wrong_target_stops_before_push(self):
        result, calls, _ = self.run_deploy("wrong-url")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(c[0] in ("docker", "firebase") for c in calls))

    def test_candidate_failure_does_not_promote_or_publish(self):
        result, calls, _ = self.run_deploy("bad-health")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(
            any(c[:4] == ["gcloud", "run", "services", "update-traffic"] for c in calls)
        )
        self.assertFalse(any(c[0] == "firebase" for c in calls))

    def test_hosting_failure_records_partial_release(self):
        result, _, summary = self.run_deploy("hosting-failure")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("API promoted", summary)
        self.assertNotIn("Hosting published", summary)


if __name__ == "__main__":
    unittest.main()
