"""Cover upload integration tests: real image decoding and account permissions."""
import base64
import importlib
import io
import os
import tempfile
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image


class CoverUploadFlow(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous = os.environ.get("NOVELREAD_DB")
        os.environ["NOVELREAD_DB"] = str(Path(self.temp.name) / "library.db")
        from lib import platform, covers
        self.platform = importlib.reload(platform)
        self.covers = importlib.reload(covers)
        app = FastAPI()
        app.include_router(platform.router)
        app.include_router(covers.router)
        self.author = TestClient(app)
        self.guest = TestClient(app)
        self.author.post("/api/library/register", json={"email": "cover@example.com", "password": "test-cover-123", "name": "ทดสอบปก"})

    def tearDown(self):
        self.author.close()
        self.guest.close()
        if self.previous is None:
            os.environ.pop("NOVELREAD_DB", None)
        else:
            os.environ["NOVELREAD_DB"] = self.previous
        self.temp.cleanup()

    @staticmethod
    def image(format="PNG"):
        buffer = io.BytesIO()
        Image.new("RGB", (20, 30), color=(40, 83, 61)).save(buffer, format=format)
        return buffer.getvalue()

    def upload(self, content, client=None):
        return (client or self.author).post("/api/library/covers", json={"data": base64.b64encode(content).decode()})

    def test_supported_images_roundtrip_and_deduplicate(self):
        for format, suffix, media in (("PNG", "png", "image/png"), ("JPEG", "jpg", "image/jpeg"), ("WEBP", "webp", "image/webp")):
            with self.subTest(format=format):
                content = self.image(format)
                first = self.upload(content)
                self.assertEqual(first.status_code, 200)
                url = first.json()["url"]
                self.assertTrue(url.endswith("." + suffix))
                second = self.upload(content)
                self.assertEqual(url, second.json()["url"])
                downloaded = self.guest.get(url)
                self.assertEqual(downloaded.status_code, 200)
                self.assertEqual(downloaded.content, content)
                self.assertEqual(downloaded.headers["content-type"], media)
                self.assertEqual(downloaded.headers["x-content-type-options"], "nosniff")

    def test_requires_account_and_same_origin(self):
        self.assertEqual(self.upload(self.image(), self.guest).status_code, 401)
        response = self.author.post("/api/library/covers", json={"data": base64.b64encode(self.image()).decode()}, headers={"Origin": "https://other.example"})
        self.assertEqual(response.status_code, 403)

    def test_invalid_base64_unsupported_and_corrupt_images(self):
        self.assertEqual(self.author.post("/api/library/covers", json={"data": "not base64!"}).status_code, 400)
        self.assertEqual(self.upload(b"<svg xmlns='http://www.w3.org/2000/svg'></svg>").status_code, 400)
        self.assertEqual(self.upload(self.image("GIF")).status_code, 400)
        self.assertEqual(self.upload(self.image()[:30]).status_code, 400)

    def test_size_and_file_path_boundaries(self):
        self.assertIn(self.upload(b"x" * (self.covers.MAX_BYTES + 1)).status_code, (413, 422))
        self.assertEqual(self.guest.get("/api/library/covers/not-a-cover.png").status_code, 404)
        self.assertEqual(self.guest.get("/api/library/covers/" + "0" * 64 + ".png").status_code, 404)


if __name__ == "__main__":
    unittest.main()
