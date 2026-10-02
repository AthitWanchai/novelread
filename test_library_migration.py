"""An existing 1.0 database must retain reading history when anchors are added."""
import importlib
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


class ExistingLibraryMigration(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous = os.environ.get("NOVELREAD_DB")
        os.environ["NOVELREAD_DB"] = str(Path(self.temp.name) / "old-library.db")
        from lib import platform
        self.platform = importlib.reload(platform)
        app = FastAPI()
        app.include_router(platform.router)
        self.client = TestClient(app)
        self.client.post("/api/library/register", json={"email": "migration@example.com", "password": "migration-pass-123", "name": "นักเขียนเดิม"})
        self.bid = self.client.post("/api/library/books", json={"title": "นิยายเดิม", "pen_name": "นักเขียนเดิม"}).json()["id"]
        self.cid = self.client.post(f"/api/library/books/{self.bid}/chapters", json={"title": "ตอนเดิม", "content": "ข้อมูลที่ต้องยังอยู่หลังอัปเดต", "published": True}).json()["id"]
        self.client.put(f"/api/library/shelf/{self.bid}", json={"chapter_id": self.cid, "progress": .65, "followed": True})
        # This recreates the original shipped shelf schema while retaining its data.
        with closing(sqlite3.connect(self.platform.DB)) as db:
            with db:
                db.execute("ALTER TABLE shelf DROP COLUMN anchor")

    def tearDown(self):
        self.client.close()
        if self.previous is None:
            os.environ.pop("NOVELREAD_DB", None)
        else:
            os.environ["NOVELREAD_DB"] = self.previous
        self.temp.cleanup()

    def test_upgrade_retains_accounts_books_chapters_and_progress(self):
        self.platform.initialize()
        self.assertEqual(self.client.get("/api/library/me").json()["name"], "นักเขียนเดิม")
        self.assertEqual(self.client.get(f"/api/library/chapters/{self.cid}").json()["content"], "ข้อมูลที่ต้องยังอยู่หลังอัปเดต")
        saved = self.client.get("/api/library/shelf").json()[0]
        self.assertEqual((saved["chapter_id"], saved["progress"], saved["followed"], saved["anchor"]), (self.cid, .65, 1, None))
        anchor = {"paragraph": 2, "character": 3}
        self.assertEqual(self.client.put(f"/api/library/shelf/{self.bid}", json={"chapter_id": self.cid, "progress": .7, "anchor": anchor}).status_code, 200)
        self.assertEqual(self.client.get("/api/library/shelf").json()[0]["anchor"], anchor)

    def test_repeated_startup_is_idempotent(self):
        for _ in range(3):
            self.platform.initialize()
        self.assertEqual(len(self.client.get("/api/library/books").json()), 1)
        self.assertEqual(len(self.client.get(f"/api/library/books/{self.bid}").json()["chapters"]), 1)
        self.assertEqual(self.client.get("/api/library/shelf").json()[0]["progress"], .65)


if __name__ == "__main__":
    unittest.main()
