"""Crop Doctor on Groq: the API call is mocked, so these tests cost nothing and need no API key."""
import base64
import io
import json
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest import mock

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/d.db"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"

import groq  # noqa: E402
import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

import main  # noqa: E402
from config import ratelimit  # noqa: E402
from schemas.crop_doctor import CropDiagnosis, CropIssue, CropTreatment  # noqa: E402
from service.crop_doctor import LABEL_NOTE, scrub_amounts  # noqa: E402

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


def reply(content, finish="stop"):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content), finish_reason=finish)],
                           usage=SimpleNamespace(prompt_tokens=1200, completion_tokens=600))


def ok_reply(**kw):
    return reply(diagnosis(**kw).model_dump_json())


def err(cls, status):
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    return cls("boom", response=httpx.Response(status, request=request), body=None)


class FakeGroq:
    """Stands in for AsyncGroq. `results` is a list used one per call (an Exception is raised, anything else returned)."""
    def __init__(self, *results):
        self.results, self.calls = list(results), []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        self.calls.append(kwargs)
        r = self.results.pop(0) if len(self.results) > 1 else self.results[0]
        if isinstance(r, Exception):
            raise r
        return r


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
        self.env = mock.patch.dict(os.environ, {"GROQ_API_KEY": "test-key"})
        self.env.start()
        for k in ("CROP_DOCTOR_MODEL", "CROP_DOCTOR_PER_HOUR", "CROP_DOCTOR_MAX_IMAGES"):
            os.environ.pop(k, None)

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
        self.assertEqual((on["enabled"], on["max_images"], on["languages"]), (True, 3, ["English", "Telugu", "Hindi"]))
        os.environ.pop("GROQ_API_KEY", None)
        self.assertFalse(self.c.get("/crop-doctor/status").json()["enabled"])

    def test_requires_sign_in(self):
        r = self.c.post("/crop-doctor/diagnose", files=[("photos", ("a.jpg", photo(), "image/jpeg"))])
        self.assertEqual(r.status_code, 401)

    def test_clear_message_when_no_api_key(self):
        h = self.user(); fake = FakeGroq(ok_reply())
        os.environ.pop("GROQ_API_KEY", None)
        r = self.post(h, fake)
        self.assertEqual(r.status_code, 503)
        self.assertIn("Groq API key", r.json()["detail"])
        self.assertEqual(fake.calls, [])

    # ---- input validation (never reaches the API)
    def test_rejects_bad_input_before_calling_the_model(self):
        h = self.user(); fake = FakeGroq(ok_reply())
        ok = ("photos", ("a.jpg", photo((50, 50)), "image/jpeg"))
        self.assertEqual(self.post(h, fake, files=[ok] * 4).status_code, 400)                                   # over the 3-photo limit
        self.assertEqual(self.post(h, fake, language="Klingon").status_code, 400)
        self.assertEqual(self.post(h, fake, files=[("photos", ("x.png", b"<script>alert(1)</script>", "image/png"))]).status_code, 400)
        self.assertEqual(self.post(h, fake, files=[("photos", ("x.jpg", b"", "image/jpeg"))]).status_code, 400)
        self.assertEqual(self.post(h, fake, files=[("photos", ("x.gif", b"GIF89a", "image/gif"))]).status_code, 400)
        self.assertEqual(self.post(h, fake, notes="x" * 601).status_code, 422)
        self.assertEqual(fake.calls, [])

    def test_photo_limit_can_be_raised_for_models_that_allow_more(self):
        h = self.user(); fake = FakeGroq(ok_reply())
        os.environ["CROP_DOCTOR_MAX_IMAGES"] = "5"
        ok = ("photos", ("a.jpg", photo((50, 50)), "image/jpeg"))
        self.assertEqual(self.post(h, fake, files=[ok] * 5).status_code, 200)
        self.assertEqual(self.c.get("/crop-doctor/status").json()["max_images"], 5)

    # ---- the request sent to Groq
    def test_sends_clean_images_and_the_right_options(self):
        h = self.user(); fake = FakeGroq(ok_reply())
        files = [("photos", ("a.jpg", photo(exif=True), "image/jpeg")), ("photos", ("b.jpg", photo((800, 600)), "image/jpeg"))]
        r = self.post(h, fake, files=files, crop_name="Tomato", notes="Spots started 4 days ago after rain", language="Telugu")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["issues"][0]["name"], "Early blight")
        call = fake.calls[0]
        self.assertEqual(call["model"], "qwen/qwen3.8-27b")
        self.assertEqual(call["response_format"]["type"], "json_schema")
        self.assertTrue(call["response_format"]["json_schema"]["strict"])
        self.assertIs(call["response_format"]["json_schema"]["schema"]["additionalProperties"], False)
        system, user = call["messages"]
        self.assertEqual(system["role"], "system"); self.assertIn("India", system["content"])
        images = [b for b in user["content"] if b["type"] == "image_url"]
        self.assertEqual(len(images), 2)
        for b in images:
            url = b["image_url"]["url"]
            self.assertTrue(url.startswith("data:image/jpeg;base64,"))
            img = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1])))
            self.assertLessEqual(max(img.size), 1600)                  # shrunk
            self.assertEqual(len(img.getexif()), 0)                    # camera/GPS metadata stripped before it leaves the server
        text = user["content"][-1]["text"]
        self.assertIn("Telugu", text); self.assertIn("Tomato", text); self.assertIn("after rain", text)

    def test_model_can_be_changed_by_env(self):
        h = self.user(); fake = FakeGroq(ok_reply())
        os.environ["CROP_DOCTOR_MODEL"] = "some/other-vision-model"
        self.assertEqual(self.post(h, fake).status_code, 200)
        self.assertEqual(fake.calls[0]["model"], "some/other-vision-model")

    # ---- output handling
    def test_falls_back_to_plain_json_mode_when_schema_mode_is_rejected(self):
        h = self.user(); fake = FakeGroq(err(groq.BadRequestError, 400), ok_reply())
        r = self.post(h, fake)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual([c["response_format"]["type"] for c in fake.calls], ["json_schema", "json_object"])
        self.assertIn("JSON Schema", fake.calls[1]["messages"][0]["content"])   # the shape is spelled out when the API can't enforce it

    def test_reasoning_tags_and_code_fences_are_tolerated(self):
        h = self.user()
        wrapped = "<think>Looks like blight, let me check...</think>\n```json\n" + diagnosis().model_dump_json() + "\n```"
        self.assertEqual(self.post(h, FakeGroq(reply(wrapped))).status_code, 200)

    def test_invalid_answer_retries_once_then_fails_politely(self):
        h = self.user()
        fake = FakeGroq(reply("not json"), ok_reply())
        self.assertEqual(self.post(h, fake).status_code, 200)                       # second try succeeds
        bad = FakeGroq(reply('{"crop": "Tomato"}'))                                  # valid JSON, wrong shape, both times
        r = self.post(h, bad)
        self.assertEqual(r.status_code, 502); self.assertEqual(len(bad.calls), 2)
        self.assertEqual(self.post(h, FakeGroq(reply(diagnosis().model_dump_json(), "length"))).status_code, 502)   # cut off

    def test_unusable_photo_result_is_passed_through(self):
        h = self.user()
        r = self.post(h, FakeGroq(ok_reply(image_usable=False, crop="Unknown", issues=[], better_photos_tips=["Take a close-up of one leaf in daylight"])))
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["image_usable"]); self.assertTrue(r.json()["better_photos_tips"])

    def test_api_errors_are_mapped_not_leaked(self):
        h = self.user()
        cases = [(err(groq.AuthenticationError, 401), 503), (err(groq.RateLimitError, 429), 429),
                 (groq.APIConnectionError(request=httpx.Request("POST", "https://x")), 503),
                 (err(groq.InternalServerError, 500), 502)]
        for exc, expected in cases:
            r = self.post(h, FakeGroq(exc))
            self.assertEqual(r.status_code, expected, (type(exc).__name__, r.text))
            self.assertNotIn("boom", r.text)                           # raw SDK/API messages never reach the farmer
        both = FakeGroq(err(groq.BadRequestError, 400))                # rejected in both modes
        self.assertEqual(self.post(h, both).status_code, 502); self.assertEqual(len(both.calls), 2)

    # ---- the no-doses rule (prompt + server-side safety net)
    def test_prompt_forbids_doses_for_every_product(self):
        h = self.user(); fake = FakeGroq(ok_reply())
        self.post(h, fake)
        system = fake.calls[0]["messages"][0]["content"]
        self.assertIn("Never write doses", system); self.assertIn("ANY product", system)

    def test_scrub_removes_doses_rates_and_spray_schedules(self):
        for text in ["Spray a solution of Neem oil (5ml per liter of water) on the leaves. Repeat every 7-10 days.",
                     "Mancozeb 2.5 g/L water, spray twice a week", "Apply 250 g per acre of copper oxychloride",
                     "Use a 0.3% solution of copper fungicide", "Mix 2 tablespoons per 15 litre pump of neem oil",
                     "Spray 1-2 ml/l of neem oil", "Dissolve 20 g in 10 litres water and spray 3 times a week",
                     "నీమ్ ఆయిల్ 5 ml/లీటర్ పిచికారీ చేయండి"]:
            out = scrub_amounts(text)
            self.assertNotRegex(out, r"\d+\s*(ml|g\b|kg|l\b|litre|liter|%|tablespoon|times|days|sprays)", text)
            self.assertIn(LABEL_NOTE, out)
        self.assertIn("Spray a solution of Neem oil on the leaves", scrub_amounts("Spray a solution of Neem oil (5ml per liter of water) on the leaves. Repeat every 7-10 days."))
        kept = scrub_amounts("Carbendazim 50% WP at 1 g per litre, 2 sprays 10 days apart")
        self.assertIn("50% WP", kept)                                                      # the product's own strength is not a dose
        self.assertNotRegex(kept, r"1 g|sprays|days apart")

    def test_scrub_leaves_ordinary_advice_alone(self):
        for text in ["Neem oil spray in the evening, following the label", "Space plants 60 cm apart for airflow", "Mulch with straw to stop soil splash",
                     "Remove infected leaves from the 3 plants nearest the gate", "Rotate with non-solanaceous crops for 2 seasons"]:
            self.assertEqual(scrub_amounts(text), text)

    def test_doses_in_the_models_answer_never_reach_the_farmer(self):
        h = self.user()
        t = CropTreatment(do_now=["Spray neem 5 ml per litre every 7 days", "Water the plants 2 times a week in the morning", "Remove infected leaves"],
                          organic_options=["Neem oil (5ml per liter of water). Repeat every 7-10 days."],
                          chemical_options=["Mancozeb at 2.5 g/L, 3 sprays 10 days apart"])
        r = self.post(h, FakeGroq(ok_reply(treatment=t, prevention=["Spray copper fungicide 3 g per litre before the rains", "Stake plants 60 cm apart"]))).json()
        body = json.dumps(r["treatment"]) + json.dumps(r["prevention"])
        self.assertNotRegex(body, r"\d+\s*(ml|g/|g per|litre|liter|sprays|days apart)")
        self.assertIn("Water the plants 2 times a week in the morning", r["treatment"]["do_now"])   # non-pesticide advice untouched
        self.assertIn("Stake plants 60 cm apart", r["prevention"])

    # ---- cost control
    def test_hourly_quota_per_user(self):
        a, b = self.user(), self.user(); fake = FakeGroq(ok_reply())
        os.environ["CROP_DOCTOR_PER_HOUR"] = "2"
        self.assertEqual([self.post(a, fake).status_code for _ in range(3)], [200, 200, 429])
        self.assertEqual(self.post(b, fake).status_code, 200)         # another farmer is unaffected
        self.assertEqual(len(fake.calls), 3)                          # the blocked request never reached the model


if __name__ == "__main__":
    unittest.main()
