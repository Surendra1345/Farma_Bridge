"""Shape of a Crop Doctor diagnosis. Also used as the structured-output schema sent to Claude, so every field is
required and uses simple types (strings, booleans, lists, enums)."""
from typing import Literal

from pydantic import BaseModel


class CropIssue(BaseModel):
    name: str                      # e.g. "Early blight (Alternaria)"
    kind: Literal["disease", "pest", "nutrient_deficiency", "water_or_weather_stress", "other"]
    confidence: Literal["high", "medium", "low"]
    severity: Literal["mild", "moderate", "severe"]
    symptoms_seen: list[str]       # what is visible in the photo that points to this
    likely_cause: str              # why it happens, and how it can be told apart from look-alikes


class CropTreatment(BaseModel):
    do_now: list[str]              # first practical steps (remove infected leaves, drainage, isolate...)
    organic_options: list[str]
    chemical_options: list[str]    # active ingredient / product class only, never doses


class CropDiagnosis(BaseModel):
    image_usable: bool             # false when the photos are not a crop, too blurry or too dark to judge
    crop: str                      # identified crop, or "Unknown"
    overall_health: Literal["healthy", "minor_problem", "needs_attention", "urgent"]
    summary: str                   # 2-3 simple sentences for the farmer
    issues: list[CropIssue]        # most likely first; empty when healthy
    treatment: CropTreatment
    prevention: list[str]
    better_photos_tips: list[str]  # what extra photo or detail would sharpen the answer
    see_an_expert: bool
    expert_reason: str             # empty when see_an_expert is false


class CropDoctorStatus(BaseModel):
    enabled: bool
    max_images: int
    max_per_hour: int
    languages: list[str]
