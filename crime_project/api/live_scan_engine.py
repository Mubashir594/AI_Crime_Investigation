from django.utils.timezone import now
from crime_database.models import Criminal, RecognitionLog, AlertLog
from investigator_module.models import Investigator
import threading
import os
import base64
from django.core.files.base import ContentFile
from django.utils.text import slugify

LIVE_SCAN_STATE = {
    "status": "IDLE",
    "confidence": 0,
    "criminal": None,
    "criminals": [],
}

MIN_CONFIDENCE = float(
    os.environ.get(
        "LIVE_SCAN_MIN_CONFIDENCE",
        os.environ.get("FRAME_MATCH_CANDIDATE_CONFIDENCE", "70"),
    )
)
FACE_RESET_SECONDS = 6

RISK_MAP = {
    "terrorism": "CRITICAL",
    "murder": "HIGH",
    "fraud": "MEDIUM",
    "theft": "LOW",
}

_LAST_FACE_TIMES = {}
_LAST_FACE_SNAPSHOTS = {}
_LOCK = threading.Lock()


def _build_criminal_payload(criminal, confidence, current_time, snapshot=None):
    return {
        "name": criminal.name,
        "age": criminal.age,
        "gender": criminal.gender,
        "address": criminal.address,
        "crime_type": criminal.crime_type,
        "face_label": criminal.face_label,
        "photo": criminal.photo.url if criminal.photo else None,
        "confidence": confidence,
        "time": current_time.strftime("%H:%M:%S"),
        "snapshot": snapshot,
    }


def _prune_old_faces(current_time):
    stale_labels = [
        label
        for label, last_seen in _LAST_FACE_TIMES.items()
        if (current_time - last_seen).total_seconds() >= FACE_RESET_SECONDS
    ]
    for label in stale_labels:
        _LAST_FACE_TIMES.pop(label, None)


def process_live_scan_payload(payload):
    with _LOCK:
        status = str(payload.get("status", "SCANNING")).upper().strip()
        suppress_alerts = bool(payload.get("suppress_alerts"))
        investigator_id = payload.get("investigator_id")
        current_time = now()
        _prune_old_faces(current_time)

        investigator = None
        if investigator_id:
            try:
                investigator = Investigator.objects.get(id=investigator_id)
            except Investigator.DoesNotExist:
                investigator = None

        detections = payload.get("detections")
        if detections is None:
            face_label = payload.get("face_label")
            confidence = float(payload.get("confidence", 0))
            detections = [{"face_label": face_label, "confidence": confidence}]

        matched_criminals = []
        max_confidence = 0.0

        snapshot_data_url = payload.get("snapshot")

        for detection in detections:
            face_label = detection.get("face_label")
            confidence = float(detection.get("confidence", 0))

            if not face_label or confidence < MIN_CONFIDENCE:
                continue

            try:
                criminal = Criminal.objects.get(face_label=face_label)
            except Criminal.DoesNotExist:
                continue

            snapshot_for_face = _LAST_FACE_SNAPSHOTS.get(face_label) or snapshot_data_url
            matched_criminals.append(
                _build_criminal_payload(criminal, confidence, current_time, snapshot_for_face)
            )
            max_confidence = max(max_confidence, confidence)

            last_seen = _LAST_FACE_TIMES.get(face_label)
            is_cooldown = (
                last_seen is not None
                and (current_time - last_seen).total_seconds() < FACE_RESET_SECONDS
            )
            if is_cooldown:
                continue

            _LAST_FACE_TIMES[face_label] = current_time
            if snapshot_data_url:
                _LAST_FACE_SNAPSHOTS[face_label] = snapshot_data_url

            RecognitionLog.objects.create(
                investigator=investigator,
                criminal=criminal,
                face_label=criminal.face_label,
                confidence=confidence,
            )
            if not suppress_alerts:
                alert = AlertLog.objects.create(
                    investigator=investigator,
                    criminal=criminal,
                    crime_type=criminal.crime_type,
                    risk_level=RISK_MAP.get(criminal.crime_type.lower(), "LOW"),
                    confidence=confidence,
                    message=f"ALERT: {criminal.name} detected",
                )
                if snapshot_data_url:
                    _attach_snapshot(alert, snapshot_data_url, criminal.face_label)

        if matched_criminals:
            LIVE_SCAN_STATE["status"] = "MATCH"
            LIVE_SCAN_STATE["confidence"] = max_confidence
            LIVE_SCAN_STATE["criminal"] = matched_criminals[0]
            LIVE_SCAN_STATE["criminals"] = matched_criminals
        else:
            LIVE_SCAN_STATE["status"] = status
            LIVE_SCAN_STATE["confidence"] = 0
            LIVE_SCAN_STATE["criminal"] = None
            LIVE_SCAN_STATE["criminals"] = []

        return {"success": True}


def get_live_scan_state():
    with _LOCK:
        return {
            "status": LIVE_SCAN_STATE["status"],
            "confidence": LIVE_SCAN_STATE["confidence"],
            "criminal": LIVE_SCAN_STATE["criminal"],
            "criminals": list(LIVE_SCAN_STATE["criminals"]),
        }


def _attach_snapshot(alert, data_url, face_label):
    if not data_url:
        return
    if not isinstance(data_url, str):
        return
    if ";base64," not in data_url:
        return

    try:
        header, b64data = data_url.split(";base64,", 1)
        if not b64data:
            return
        ext = "jpg"
        if "image/png" in header:
            ext = "png"
        filename = f"match_{slugify(face_label) or 'unknown'}_{int(now().timestamp())}.{ext}"
        alert.snapshot.save(filename, ContentFile(base64.b64decode(b64data)), save=True)
    except Exception:
        # Snapshot is optional; do not fail the alert flow.
        return
