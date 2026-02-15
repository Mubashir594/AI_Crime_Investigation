from django.http import JsonResponse, StreamingHttpResponse
from django.db import connection
from django.utils import timezone
from django.db.models import Count
from datetime import timedelta
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import FileSystemStorage
from crime_database.models import Criminal, RecognitionLog, AlertLog
from investigator_module.models import Investigator
import json
import base64
import cv2
import os
from .live_scan_engine import process_live_scan_payload, get_live_scan_state
from .facenet import recognize_face

# =====================================================
# BASIC TEST & DASHBOARD STATUS
# =====================================================

def test_api(request):
    return JsonResponse({"message": "API is working"})


def _session_investigator(request):
    investigator_id = request.session.get("investigator_id")
    if not investigator_id:
        return None
    try:
        return Investigator.objects.get(id=investigator_id)
    except Investigator.DoesNotExist:
        return None


def _is_admin_session(request):
    return bool(request.session.get("admin_user_id"))


def dashboard_status(request):
    investigator = _session_investigator(request)
    is_admin = _is_admin_session(request)
    if not investigator and not is_admin:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    live_state = get_live_scan_state()
    logs_qs = RecognitionLog.objects.all()
    alerts_qs = AlertLog.objects.all()
    if investigator and not is_admin:
        logs_qs = logs_qs.filter(investigator=investigator)
        alerts_qs = alerts_qs.filter(investigator=investigator)

    total_detections = logs_qs.count()
    total_matches = logs_qs.values("face_label").distinct().count()
    total_crimes_flagged = alerts_qs.count()
    total_registered_faces = Criminal.objects.count()

    return JsonResponse({
        "camera_status": "ON-DEMAND",
        "ai_model": "FACENET",
        "session": live_state.get("status", "IDLE"),
        "faces_detected": total_detections,
        "matches_found": total_matches,
        "crimes_flagged": total_crimes_flagged,
        "registered_faces": total_registered_faces,
    })


def system_health(request):
    investigator = _session_investigator(request)
    is_admin = _is_admin_session(request)
    if not investigator and not is_admin:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        db_ok = False

    cpu_percent = None
    try:
        import psutil

        cpu_percent = float(psutil.cpu_percent(interval=0.1))
    except Exception:
        cpu_percent = None

    score = 100.0
    if not db_ok:
        score -= 40.0

    if cpu_percent is not None:
        cpu_penalty = max(0.0, (cpu_percent - 60.0) / 40.0 * 25.0)
        score -= min(25.0, cpu_penalty)

    score = max(0.0, min(100.0, score))

    return JsonResponse({
        "health_percent": round(score),
        "cpu_percent": cpu_percent,
        "db_ok": db_ok,
    })


def activity_radar(request):
    investigator = _session_investigator(request)
    is_admin = _is_admin_session(request)
    if not investigator and not is_admin:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    today = timezone.localdate()

    logs_qs = RecognitionLog.objects.filter(detected_at__date=today)
    alerts_qs = AlertLog.objects.filter(triggered_at__date=today)

    if investigator and not is_admin:
        logs_qs = logs_qs.filter(investigator=investigator)
        alerts_qs = alerts_qs.filter(investigator=investigator)

    total_scans_today = logs_qs.count()
    matches_found = logs_qs.exclude(criminal__isnull=True).count()
    alerts_today = alerts_qs.count()

    if investigator and not is_admin:
        active_investigations = 1 if total_scans_today > 0 else 0
    else:
        active_investigations = logs_qs.values("investigator_id") \
            .exclude(investigator_id__isnull=True) \
            .distinct() \
            .count()

    scan_score = min(total_scans_today / 50.0, 1.0)
    match_score = min(matches_found / 10.0, 1.0)
    alert_score = min(alerts_today / 5.0, 1.0)
    active_score = min(active_investigations / 5.0, 1.0)

    intensity = round(
        (scan_score * 0.4 + match_score * 0.25 + alert_score * 0.2 + active_score * 0.15)
        * 100
    )

    return JsonResponse({
        "intensity_percent": intensity,
        "total_scans_today": total_scans_today,
        "active_investigations": active_investigations,
        "alerts_today": alerts_today,
        "matches_found": matches_found,
    })


def detection_analytics(request):
    investigator = _session_investigator(request)
    is_admin = _is_admin_session(request)
    if not investigator and not is_admin:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    today = timezone.localdate()
    now = timezone.localtime()

    logs_qs = RecognitionLog.objects.all()
    alerts_qs = AlertLog.objects.all()

    if investigator and not is_admin:
        logs_qs = logs_qs.filter(investigator=investigator)
        alerts_qs = alerts_qs.filter(investigator=investigator)

    detections_today = logs_qs.filter(detected_at__date=today).count()

    weekly_trend = []
    for day_offset in range(6, -1, -1):
        day = today - timedelta(days=day_offset)
        count = logs_qs.filter(detected_at__date=day).count()
        weekly_trend.append({
            "date": day.isoformat(),
            "detections": count,
        })

    crimes_by_type_qs = alerts_qs.filter(triggered_at__date=today) \
        .values("crime_type") \
        .annotate(count=Count("id")) \
        .order_by("-count")[:6]

    crimes_by_type = [
        {"crime_type": row["crime_type"], "count": row["count"]}
        for row in crimes_by_type_qs
    ]

    scan_activity = []
    for hour_offset in range(11, -1, -1):
        slot = now - timedelta(hours=hour_offset)
        slot_start = slot.replace(minute=0, second=0, microsecond=0)
        slot_end = slot_start + timedelta(hours=1)
        scans = logs_qs.filter(detected_at__gte=slot_start, detected_at__lt=slot_end).count()
        scan_activity.append({
            "time": slot_start.strftime("%H:%M"),
            "scans": scans,
        })

    return JsonResponse({
        "detections_today": detections_today,
        "weekly_trend": weekly_trend,
        "crimes_by_type": crimes_by_type,
        "scan_activity": scan_activity,
    })


# =====================================================
# 🎥 WEBCAM CONTROL (OPTION B – EXPLICIT)
# =====================================================

from .webcam_service import generate_frames, stop_camera, set_active_investigator

def video_feed(request):
    investigator = _session_investigator(request)
    is_admin = _is_admin_session(request)
    if not investigator and not is_admin:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)
    set_active_investigator(investigator.id if investigator else None)
    return StreamingHttpResponse(
        generate_frames(),
        content_type="multipart/x-mixed-replace; boundary=frame"
    )

def start_webcam_api(request):
    investigator = _session_investigator(request)
    is_admin = _is_admin_session(request)
    if not investigator and not is_admin:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)
    set_active_investigator(investigator.id if investigator else None)
    return JsonResponse({"success": True})

def stop_webcam_api(request):
    investigator = _session_investigator(request)
    is_admin = _is_admin_session(request)
    if not investigator and not is_admin:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)
    set_active_investigator(None)
    stop_camera()
    return JsonResponse({"success": True})


def _detect_faces_haar(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
    return [(int(x), int(y), int(x + w), int(y + h)) for (x, y, w, h) in faces]


def _encode_frame_as_data_url(frame):
    ok, encoded = cv2.imencode(".jpg", frame)
    if not ok:
        return None
    b64 = base64.b64encode(encoded.tobytes()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def _draw_detection_boxes(frame, detection_boxes):
    annotated = frame.copy()
    for box in detection_boxes:
        x1, y1, x2, y2 = box["x1"], box["y1"], box["x2"], box["y2"]
        is_match = bool(box.get("is_match"))
        color = (0, 255, 0) if is_match else (0, 170, 255)
        label = box.get("face_label") or "unknown"
        confidence = float(box.get("confidence", 0))
        text = f"{label} | {confidence:.1f}%"

        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            annotated,
            text,
            (x1, max(20, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            color,
            2,
            cv2.LINE_AA,
        )
    return annotated


def _collect_matches_from_frame(frame, detector):
    boxes = detector.detect_faces(frame) if detector is not None else []
    if not boxes:
        boxes = _detect_faces_haar(frame)

    candidate_threshold = float(os.environ.get("FRAME_MATCH_CANDIDATE_CONFIDENCE", "70"))
    detections = {}
    detection_boxes = []
    for (x1, y1, x2, y2) in boxes:
        face = frame[y1:y2, x1:x2]
        if face is None or face.size == 0:
            continue

        face_label, confidence = recognize_face(face)
        confidence = float(confidence)
        is_match = face_label != "unknown" and confidence >= candidate_threshold

        detection_boxes.append({
            "x1": int(x1),
            "y1": int(y1),
            "x2": int(x2),
            "y2": int(y2),
            "face_label": face_label,
            "confidence": confidence,
            "is_match": is_match,
        })

        if not is_match:
            continue

        previous_confidence = detections.get(face_label, 0.0)
        detections[face_label] = max(previous_confidence, confidence)

    return detections, detection_boxes


def _collect_matches_from_image(file_path, detector):
    frame = cv2.imread(file_path)
    if frame is None:
        return {}, [], None

    detections, detection_boxes = _collect_matches_from_frame(frame, detector)
    preview_image = _encode_frame_as_data_url(_draw_detection_boxes(frame, detection_boxes))
    return detections, detection_boxes, preview_image


def _collect_matches_from_video(file_path, detector):
    capture = cv2.VideoCapture(file_path)
    if not capture.isOpened():
        return {}, [], None

    frame_candidate_labels = []
    per_label_max_confidence = {}
    best_preview_frame = None
    best_preview_boxes = []
    best_score = (-1, -1.0)
    frame_index = 0
    max_frames = 600
    sample_every_n_frames = 6
    min_hits = max(2, int(os.environ.get("UPLOAD_TEMPORAL_VOTING_MIN_HITS", "3")))

    try:
        while frame_index < max_frames:
            ok, frame = capture.read()
            if not ok:
                break

            if frame_index % sample_every_n_frames == 0:
                frame_detections, detection_boxes = _collect_matches_from_frame(frame, detector)
                for face_label, confidence in frame_detections.items():
                    per_label_max_confidence[face_label] = max(
                        per_label_max_confidence.get(face_label, 0.0),
                        confidence,
                    )

                frame_candidate_labels.append(set(frame_detections.keys()))

                matched_boxes = [box for box in detection_boxes if box.get("is_match")]
                score = (
                    len(matched_boxes),
                    sum(float(box.get("confidence", 0)) for box in matched_boxes),
                )
                if score > best_score:
                    best_score = score
                    best_preview_frame = frame.copy()
                    best_preview_boxes = detection_boxes

            frame_index += 1
    finally:
        capture.release()

    preview_image = None
    if best_preview_frame is not None:
        preview_image = _encode_frame_as_data_url(
            _draw_detection_boxes(best_preview_frame, best_preview_boxes)
        )

    label_hits = {}
    for labels in frame_candidate_labels:
        for label in labels:
            label_hits[label] = label_hits.get(label, 0) + 1

    detections = {}
    for label, hits in label_hits.items():
        if hits < min_hits:
            continue
        detections[label] = per_label_max_confidence.get(label, 0.0)

    return detections, best_preview_boxes, preview_image


# =====================================================
# VIDEO UPLOAD API
# =====================================================

@csrf_exempt
def upload_video_api(request):
    if request.method == "POST":
        media = request.FILES.get("media") or request.FILES.get("video")
        if not media:
            return JsonResponse({"success": False, "message": "No media uploaded"})

        fs = FileSystemStorage(location="uploaded_videos")
        saved_name = fs.save(media.name, media)
        saved_path = fs.path(saved_name)

        from .webcam_service import FaceDetector

        detector = FaceDetector()
        extension = saved_name.rsplit(".", 1)[-1].lower() if "." in saved_name else ""
        image_exts = {"jpg", "jpeg", "png", "bmp", "webp"}
        video_exts = {"mp4", "avi", "mov", "mkv", "webm", "m4v"}

        if extension in image_exts:
            match_map, detection_boxes, preview_image = _collect_matches_from_image(saved_path, detector)
        elif extension in video_exts:
            match_map, detection_boxes, preview_image = _collect_matches_from_video(saved_path, detector)
        else:
            return JsonResponse({
                "success": False,
                "message": "Unsupported file type. Upload an image or video file.",
            })

        detections = [
            {"face_label": label, "confidence": confidence}
            for label, confidence in match_map.items()
        ]

        process_live_scan_payload({
            "status": "MATCH" if detections else "NO_MATCH",
            "detections": detections,
            "suppress_alerts": False,
            "investigator_id": request.session.get("investigator_id"),
            "snapshot": preview_image,
        })
        live_state = get_live_scan_state()

        return JsonResponse({
            "success": True,
            "message": "Media processed successfully.",
            "status": live_state.get("status", "IDLE"),
            "confidence": live_state.get("confidence", 0),
            "criminal": live_state.get("criminal"),
            "criminals": live_state.get("criminals", []),
            "detection_boxes": detection_boxes,
            "preview_image": preview_image,
        })

    return JsonResponse({"success": False})


# =====================================================
# FACE RECOGNITION RESULT API
# =====================================================

def recognition_result(request):
    face_label = request.GET.get("label")
    confidence = request.GET.get("confidence", "N/A")

    if not face_label:
        return JsonResponse({"match": False})

    try:
        criminal = Criminal.objects.get(face_label=face_label)
        return JsonResponse({
            "match": True,
            "confidence": confidence,
            "criminal": {
                "name": criminal.name,
                "age": criminal.age,
                "gender": criminal.gender,
                "address": criminal.address,
                "crime_type": criminal.crime_type,
                "status": "WANTED",
                "face_label": criminal.face_label,
                "photo": criminal.photo.url if criminal.photo else None
            }
        })
    except Criminal.DoesNotExist:
        return JsonResponse({"match": False})


@csrf_exempt
def live_scan(request):
    if request.method == "POST":
        data = json.loads(request.body.decode("utf-8"))
        if "investigator_id" not in data and request.session.get("investigator_id"):
            data["investigator_id"] = request.session.get("investigator_id")
        return JsonResponse(process_live_scan_payload(data))

    return JsonResponse(get_live_scan_state())


# =====================================================
# 📜 DATABASE LOG APIs
# =====================================================

def recognition_log(request):
    investigator = _session_investigator(request)
    is_admin = _is_admin_session(request)
    if not investigator and not is_admin:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    logs = RecognitionLog.objects.select_related("criminal", "investigator") \
        .order_by("-detected_at")
    if investigator and not is_admin:
        logs = logs.filter(investigator=investigator)

    return JsonResponse({
        "identified_criminals": logs.exclude(criminal__isnull=True).values("criminal_id").distinct().count(),
        "records": [
            {
                "id": log.id,
                "investigator_id": log.investigator.id if log.investigator else None,
                "investigator_name": log.investigator.full_name if log.investigator else None,
                "name": log.criminal.name if log.criminal else "Unknown",
                "face_label": log.face_label,
                "age": log.criminal.age if log.criminal else None,
                "gender": log.criminal.gender if log.criminal else None,
                "address": log.criminal.address if log.criminal else None,
                "crime_type": log.criminal.crime_type if log.criminal else "Unknown",
                "confidence": log.confidence,
                "time": log.detected_at.strftime("%Y-%m-%d %H:%M:%S"),
                "detected_at": log.detected_at.isoformat(),
            }
            for log in logs
        ]
    })


def alert_feed(request):
    investigator = _session_investigator(request)
    is_admin = _is_admin_session(request)
    if not investigator and not is_admin:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    alerts = AlertLog.objects.select_related("criminal", "investigator").order_by("-triggered_at")
    if investigator and not is_admin:
        alerts = alerts.filter(investigator=investigator)
    alerts = alerts[:30]

    return JsonResponse({
        "alerts": [
            {
                "id": alert.id,
                "investigator_id": alert.investigator.id if alert.investigator else None,
                "investigator_name": alert.investigator.full_name if alert.investigator else None,
                "message": alert.message,
                "crime_type": alert.crime_type,
                "risk_level": alert.risk_level,
                "confidence": alert.confidence,
                "time": alert.triggered_at.strftime("%Y-%m-%d %H:%M:%S"),
                "name": alert.criminal.name if alert.criminal else "Unknown",
                "face_label": alert.criminal.face_label if alert.criminal else None,
                "photo": alert.criminal.photo.url if alert.criminal and alert.criminal.photo else None,
                "snapshot": alert.snapshot.url if alert.snapshot else None,
            }
            for alert in alerts
        ]
    })


def criminal_list(request):
    criminals = Criminal.objects.all().annotate(
        crime_record_count=Count("crimerecord", distinct=True),
        evidence_count=Count("crimerecord__evidence", distinct=True),
    ).order_by("name")

    return JsonResponse({
        "criminals": [
            {
                "id": criminal.id,
                "name": criminal.name,
                "face_label": criminal.face_label,
                "age": criminal.age,
                "gender": criminal.gender,
                "address": criminal.address,
                "crime_type": criminal.crime_type,
                "crime_record_count": criminal.crime_record_count,
                "evidence_count": criminal.evidence_count,
                "photo": criminal.photo.url if criminal.photo else None,
                "created_at": criminal.created_at.isoformat() if criminal.created_at else None,
            }
            for criminal in criminals
        ]
    })
