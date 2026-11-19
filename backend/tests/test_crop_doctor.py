"""Crop Doctor: the Claude call is mocked, so these tests cost nothing and need no API key."""
import base64
import io
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest import mock

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/d.db"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"

import anthropic  # noqa: E402
import httpx2  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

import main  # noqa: E402
from config import ratelimit  # noqa: E402
from schemas.crop_doctor import CropDiagnosis, CropIssue, CropTreatment  # noqa: E402

SENT = {}


async def fake_send(to_email, otp, user_name="User"):
    SENT[to_email] = otp
    return True


def photo(size=(2400, 1800), exif=False) -> bytes:
    img = Image.new("RGB", size, (30, 120, 40))
    buf = io.BytesIO()
    if exif:
        e = Image.Exif()
        e[0x010F] = "TestCameraMaker"
        e[0x8825] = {1: "N", 2: (16.0, 30.0, 0.0)}   # GPS block
        img.save(buf, "JPEG", exif=e)
    else:
        img.save(buf, "JPEG")
    return buf.getvalue()


def diagnosis(**kw) -> CropDiagnosis:
    base = dict(
        image_usable=True, crop="Tomato", overall_health="needs_attention", summary="Brown spots with rings on lower leaves.",
        issues=[CropIssue(name="Early blight", kind="disease", confidence="high", severity="moderate",
                          symptoms_seen=["Concentric brown rings"], likely_cause="Fungus Alternaria solani in humid weather")],
        treatment=CropTreatment(do_now=["Remove infected leaves"], organic_options=["Neem oil spray"], chemical_options=["Mancozeb (follow label)"]),
        prevention=["Rotate crops"], better_photos_tips=[], see_an_expert=False, expert_reason="",
    )
    base.update(kw)
    return CropDiagnosis(**base)


class FakeClient:
    """Stands in for AsyncAnthropic. `result` is returned (or raised, if it is an exception)."""
    def __init__(self, result):
        self.result, self.calls = result, []
        self.beta = SimpleNamespace(messages=SimpleNamespace(parse=self._parse))

    async def _parse(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def reply(parsed=None, stop="end_turn"):
    return SimpleNamespace(stop_reason=stop, parsed_output=parsed, usage=SimpleNamespace(input_tokens=1200, output_tokens=600))


def err(cls, status):
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("boom", response=httpx2.Response(status, request=request), body=None)


class CropDoctorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patch = mock.patch("service.user_service.send_otp_email", fake_send)
        cls.patch.start()
        cls.c = TestClient(main.app)
        cls.n = 0

    @classmethod
    def tearDownClass(cls):
        cls.patch.stop()

    def setUp(self):
        ratelimit.reset()
        self.env = mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"})
        self.env.start()
        os.environ.pop("CROP_DOCTOR_MODEL", None)
        os.environ.pop("CROP_DOCTOR_PER_HOUR", None)

    def tearDown(self):
        self.env.stop()

    def user(self):
        type(self).n += 1
        email = f"doc{self.n}@example.com"
        self.assertEqual(self.c.post("/users/register", json=dict(name="Doc Farmer", phone_number=f"99000{self.n:05d}", email=email, address="a", location="Guntur", roles=["farmer"])).status_code, 201)
        return {"Authorization": "Bearer " + self.c.post("/users/verify-otp", json=dict(email=email, otp=SENT[email])).json()["access_token"]}

    def post(self, h, client, files=None, **data):
        files = files if files is not None else [("photos", ("leaf.jpg", photo(), "image/jpeg"))]
        with mock.patch("service.crop_doctor.get_client", return_value=client):
            return self.c.post("/crop-doctor/diagnose", headers=h, data=data, files=files)

    # ---- availability & access
    def test_status_reports_whether_it_is_set_up(self):
        on = self.c.get("/crop-doctor/status").json()
        self.assertEqual((on["enabled"], on["max_images"], on["languages"]), (True, 4, ["English", "Telugu", "Hindi"]))
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ANTHROPIC_API_KEY", None); os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)
            self.assertFalse(self.c.get("/crop-doctor/status").json()["enabled"])

    def test_requires_sign_in(self):
        r = self.c.post("/crop-doctor/diagnose", files=[("photos", ("a.jpg", photo(), "image/jpeg"))])
        self.assertEqual(r.status_code, 401)

    def test_clear_message_when_no_api_key(self):
        h = self.user(); fake = FakeClient(reply(diagnosis()))
        os.environ.pop("ANTHROPIC_API_KEY", None); os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)
        r = self.post(h, fake)
        self.assertEqual(r.status_code, 503)
        self.assertIn("API key", r.json()["detail"])
        self.assertEqual(fake.calls, [])

    # ---- input validation (never reaches the paid API)
    def test_rejects_bad_input_before_calling_claude(self):
        h = self.user(); fake = FakeClient(reply(diagnosis()))
        ok = ("photos", ("a.jpg", photo((50, 50)), "image/jpeg"))
        self.assertEqual(self.post(h, fake, files=[ok] * 5).status_code, 400)                                   # too many
        self.assertEqual(self.post(h, fake, language="Klingon").status_code, 400)
        self.assertEqual(self.post(h, fake, files=[("photos", ("x.png", b"<script>alert(1)</script>", "image/png"))]).status_code, 400)  # not an image
        self.assertEqual(self.post(h, fake, files=[("photos", ("x.jpg", b"", "image/jpeg"))]).status_code, 400)       # empty
        self.assertEqual(self.post(h, fake, files=[("photos", ("x.gif", b"GIF89a", "image/gif"))]).status_code, 400)  # wrong type
        self.assertEqual(self.post(h, fake, notes="x" * 601).status_code, 422)                                  # notes too long
        self.assertEqual(fake.calls, [])

    # ---- the request sent to Claude
    def test_sends_clean_images_and_the_right_options(self):
        h = self.user(); fake = FakeClient(reply(diagnosis()))
        files = [("photos", ("a.jpg", photo(exif=True), "image/jpeg")), ("photos", ("b.jpg", photo((800, 600)), "image/jpeg"))]
        r = self.post(h, fake, files=files, crop_name="Tomato", notes="Spots started 4 days ago after rain", language="Telugu")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["issues"][0]["name"], "Early blight")
        call = fake.calls[0]
        self.assertEqual(call["model"], "claude-opus-5-5")
        self.assertIs(call["output_format"], CropDiagnosis)
        self.assertEqual(call["fallbacks"], "default")
        self.assertIn("server-side-fallback-2026-07-01", call["betas"])
        self.assertEqual(call["output_config"], {"effort": "medium"})
        self.assertIn("India", call["system"])
        blocks = call["messages"][0]["content"]
        images = [b for b in blocks if b["type"] == "image"]
        self.assertEqual(len(images), 2)
        for b in images:
            self.assertEqual(b["source"]["media_type"], "image/jpeg")
            img = Image.open(io.BytesIO(base64.b64decode(b["source"]["data"])))
            self.assertLessEqual(max(img.size), 1600)                  # shrunk
            self.assertEqual(len(img.getexif()), 0)                    # camera/GPS metadata stripped before it leaves the server
        text = blocks[-1]["text"]
        self.assertIn("Telugu", text); self.assertIn("Tomato", text); self.assertIn("after rain", text)

    def test_model_can_be_changed_by_env(self):
        h = self.user(); fake = FakeClient(reply(diagnosis()))
        os.environ["CROP_DOCTOR_MODEL"] = "claude-sonnet-5-5"
        self.assertEqual(self.post(h, fake).status_code, 200)
        self.assertEqual(fake.calls[0]["model"], "claude-sonnet-5-5")

    # ---- results & failures
    def test_unusable_photo_result_is_passed_through(self):
        h = self.user()
        r = self.post(h, FakeClient(reply(diagnosis(image_usable=False, crop="Unknown", issues=[], better_photos_tips=["Take a close-up of one leaf in daylight"]))))
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["image_usable"])
        self.assertTrue(r.json()["better_photos_tips"])

    def test_refusal_and_unusable_responses_become_friendly_errors(self):
        h = self.user()
        self.assertEqual(self.post(h, FakeClient(reply(None, "refusal"))).status_code, 422)
        self.assertEqual(self.post(h, FakeClient(reply(None, "max_tokens"))).status_code, 502)
        self.assertEqual(self.post(h, FakeClient(reply(None, "end_turn"))).status_code, 502)

    def test_api_errors_are_mapped_not_leaked(self):
        h = self.user()
        cases = [(err(anthropic.AuthenticationError, 401), 503), (err(anthropic.RateLimitError, 429), 429),
                 (anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x")), 503),
                 (err(anthropic.InternalServerError, 500), 502), (err(anthropic.BadRequestError, 400), 502)]
        for exc, expected in cases:
            r = self.post(h, FakeClient(exc))
            self.assertEqual(r.status_code, expected, (type(exc).__name__, r.text))
            self.assertNotIn("boom", r.text)                           # raw SDK/API messages never reach the farmer

    # ---- cost control
    def test_hourly_quota_per_user(self):
        a, b = self.user(), self.user(); fake = FakeClient(reply(diagnosis()))
        os.environ["CROP_DOCTOR_PER_HOUR"] = "2"
        self.assertEqual([self.post(a, fake).status_code for _ in range(3)], [200, 200, 429])
        self.assertEqual(self.post(b, fake).status_code, 200)         # another farmer is unaffected
        self.assertEqual(len(fake.calls), 3)                          # the blocked request never reached Claude


if __name__ == "__main__":
    unittest.main()
