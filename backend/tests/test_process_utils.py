from __future__ import annotations

import os
import unittest

from app.services.process_utils import build_pythonpath_env


class ProcessUtilsTest(unittest.TestCase):
    def test_build_pythonpath_env_prepends_when_existing(self) -> None:
        env = build_pythonpath_env(prepend_path="/tmp/backend", base_env={"PYTHONPATH": "/tmp/current", "A": "1"})
        self.assertEqual(env["PYTHONPATH"], f"/tmp/backend{os.pathsep}/tmp/current")
        self.assertEqual(env["A"], "1")

    def test_build_pythonpath_env_sets_when_missing(self) -> None:
        env = build_pythonpath_env(prepend_path="/tmp/backend", base_env={"A": "1"})
        self.assertEqual(env["PYTHONPATH"], "/tmp/backend")
        self.assertEqual(env["A"], "1")


if __name__ == "__main__":
    unittest.main()
