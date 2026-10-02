"""Run with .venv\\Scripts\\python -m unittest test_library -v."""
import importlib
import os
import tempfile
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


class LibraryFlow(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        os.environ["NOVELREAD_DB"] = str(Path(self.directory.name) / "test.db")
        from lib import platform
        self.p = importlib.reload(platform)
        app = FastAPI()
        app.include_router(platform.router)
        self.author = TestClient(app)
        self.reader = TestClient(app)
        self.guest = TestClient(app)
        for client, name in ((self.author, "author"), (self.reader, "reader")):
            response = client.post("/api/library/register", json={"email":name+"@example.com", "password":"test-pass-123", "name":name})
            self.assertEqual(response.status_code, 200)
        self.book = {"title":"เรื่องทดสอบ", "pen_name":"author", "tags":"เวทมนตร์", "category":"แฟนตาซี"}
        self.bid = self.author.post("/api/library/books", json=self.book).json()["id"]

    def tearDown(self):
        self.author.close()
        self.reader.close()
        self.guest.close()
        self.directory.cleanup()
        os.environ.pop("NOVELREAD_DB", None)

    def create_chapter(self, published=False):
        return self.author.post(f"/api/library/books/{self.bid}/chapters", json={"title":"บทแรก", "content":"เนื้อหา\nย่อหน้าใหม่", "published":published}).json()["id"]

    def test_draft_visibility_and_publish(self):
        cid = self.create_chapter()
        self.assertEqual(self.guest.get("/api/library/books").json(), [])
        self.assertEqual(self.guest.get(f"/api/library/chapters/{cid}").status_code,404)
        self.assertEqual(self.reader.get(f"/api/library/books/{self.bid}").status_code,404)
        self.assertEqual(self.author.get(f"/api/library/books/{self.bid}").status_code,200)
        self.author.put(f"/api/library/books/{self.bid}/chapters/{cid}",json={"title":"บทแรก", "content":"เผยแพร่แล้ว", "published":True})
        self.assertEqual(len(self.guest.get("/api/library/books?q=เวทมนตร์&category=แฟนตาซี").json()),1)
        self.assertEqual(self.guest.get(f"/api/library/chapters/{cid}").json()["content"],"เผยแพร่แล้ว")

    def test_ownership_and_login(self):
        cid=self.create_chapter()
        self.assertEqual(self.reader.put(f"/api/library/books/{self.bid}",json=self.book).status_code,403)
        self.assertEqual(self.reader.put(f"/api/library/books/{self.bid}/chapters/{cid}",json={"title":"hacked"}).status_code,403)
        self.assertEqual(self.guest.post("/api/library/books",json=self.book).status_code,401)
        self.author.post("/api/library/logout")
        self.assertIsNone(self.author.get("/api/library/me").json())
        self.assertEqual(self.author.post("/api/library/login",json={"email":"author@example.com","password":"wrong-pass"}).status_code,401)
        self.assertEqual(self.author.post("/api/library/login",json={"email":"author@example.com","password":"test-pass-123"}).status_code,200)

    def test_shelf_resume_and_isolation(self):
        cid=self.create_chapter(True)
        self.reader.put(f"/api/library/shelf/{self.bid}",json={"chapter_id":cid,"progress":.65})
        self.reader.put(f"/api/library/shelf/{self.bid}",json={"followed":True})
        saved=self.reader.get("/api/library/shelf").json()[0]
        self.assertEqual((saved["chapter_id"],saved["progress"],saved["followed"]),(cid,.65,1))
        self.assertEqual(self.author.get("/api/library/shelf").json(),[])
        self.reader.post("/api/library/logout")
        self.reader.post("/api/library/login",json={"email":"reader@example.com","password":"test-pass-123"})
        self.assertEqual(self.reader.get("/api/library/shelf").json()[0]["progress"],.65)
        self.assertEqual(self.reader.put(f"/api/library/shelf/{self.bid}",json={"chapter_id":9999}).status_code,400)

    def test_order_and_validation(self):
        first=self.create_chapter(True)
        second=self.create_chapter()
        self.assertEqual(self.author.put(f"/api/library/books/{self.bid}/order",json={"ids":[second,first]}).status_code,200)
        self.assertEqual(self.author.get(f"/api/library/books/{self.bid}").json()["chapters"][0]["id"],second)
        self.assertEqual(len(self.guest.get(f"/api/library/books/{self.bid}").json()["chapters"]),1)
        self.assertEqual(self.author.put(f"/api/library/books/{self.bid}/order",json={"ids":[first,first]}).status_code,400)
        self.assertEqual(self.author.post(f"/api/library/books/{self.bid}/chapters",json={"title":"empty","published":True}).status_code,400)
        self.assertEqual(self.author.put(f"/api/library/books/{self.bid}",json={**self.book,"cover":"javascript:alert(1)"}).status_code,400)
        self.assertEqual(self.author.put("/api/library/profile",json={"name":"new name"}).status_code,200)
        self.assertEqual(self.author.get("/api/library/me").json()["name"],"new name")

    def test_content_anchor_survives_follow_and_login(self):
        cid = self.create_chapter(True)
        anchor = {"paragraph": 3, "character": 17}
        self.reader.put(f"/api/library/shelf/{self.bid}", json={
            "chapter_id": cid, "progress": .42, "anchor": anchor})
        self.reader.put(f"/api/library/shelf/{self.bid}", json={"followed": True})
        self.reader.post("/api/library/logout")
        self.reader.post("/api/library/login", json={
            "email": "reader@example.com", "password": "test-pass-123"})
        saved = self.reader.get("/api/library/shelf").json()[0]
        self.assertEqual(saved["anchor"], anchor)
        self.assertGreater(saved["reading_updated"], 0)
        self.assertEqual(saved["progress"], .42)
        self.assertEqual(self.reader.put(f"/api/library/shelf/{self.bid}", json={
            "chapter_id": cid, "anchor": {"paragraph": -1, "character": 0}}).status_code, 422)

    def test_cross_origin_and_duplicate_account(self):
        self.assertEqual(self.author.put(f"/api/library/books/{self.bid}",json=self.book,headers={"Origin":"https://other.example"}).status_code,403)
        self.assertEqual(self.guest.post("/api/library/register",json={"email":"author@example.com","password":"test-pass-123","name":"copy"}).status_code,409)
        with self.p.connect() as db:
            password=db.execute("SELECT password FROM users LIMIT 1").fetchone()[0]
            token=db.execute("SELECT token FROM sessions LIMIT 1").fetchone()[0]
        self.assertNotIn("test-pass",password)
        self.assertNotEqual(token,self.author.cookies.get("novelread_session"))


if __name__ == "__main__":
    unittest.main()
