import cv2
import threading
import os
from pathlib import Path
from collections import deque
from .facenet import recognize_face
from .live_scan_engine import process_live_scan_payload
import base64

try:
    from mtcnn.mtcnn import MTCNN
except Exception:
    MTCNN = None

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

camera = None
camera_active = False
lock = threading.Lock()
detector = None
ACTIVE_INVESTIGATOR_ID = None

FACE_DETECTION_CONFIDENCE = 0.35
MIN_BOX_SIZE = 40
FRAME_MATCH_CANDIDATE_CONFIDENCE = float(os.environ.get("FRAME_MATCH_CANDIDATE_CONFIDENCE", "70"))
TEMPORAL_VOTING_WINDOW = max(3, int(os.environ.get("TEMPORAL_VOTING_WINDOW", "7")))
TEMPORAL_VOTING_MIN_HITS = max(2, int(os.environ.get("TEMPORAL_VOTING_MIN_HITS", "4")))
LIVE_MOTION_THRESHOLD = float(os.environ.get("LIVE_MOTION_THRESHOLD", "1.8"))


def set_active_investigator(investigator_id):
    global ACTIVE_INVESTIGATOR_ID
    ACTIVE_INVESTIGATOR_ID = investigator_id


class FaceDetector:
    def __init__(self):
        self.mode = "NONE"
        self.model = None
        self.mtcnn = MTCNN() if MTCNN else None
        self._init_yolo()

    def _candidate_model_paths(self):
        root = Path(__file__).resolve().parent.parent
        from_env = os.environ.get("YOLO_FACE_MODEL", "").strip()
        defaults = [
            root / "face_recognition" / "models" / "yolov8n-face.pt",
            root / "face_recognition" / "models" / "yolov8n-face.onnx",
            root / "face_recognition" / "models" / "yolov11n-face.pt",
            root / "face_recognition" / "models" / "yolov11n-face.onnx",
        ]
        candidates = [Path(from_env)] if from_env else []
        candidates.extend(defaults)
        return [p for p in candidates if p.exists()]

    def _init_yolo(self):
        if YOLO is None:
            return

        for model_path in self._candidate_model_paths():
            try:
                self.model = YOLO(str(model_path))
                self.mode = "YOLO"
                print(f"[INFO] YOLO face detector loaded: {model_path}")
                return
            except Exception:
                continue

    def detect_faces(self, frame):
        if self.mode == "YOLO" and self.model is not None:
            return self._detect_with_yolo(frame)
        if self.mtcnn is not None:
            return self._detect_with_mtcnn(frame)
        return []

    def _detect_with_yolo(self, frame):
        boxes = []
        try:
            results = self.model(frame, verbose=False)
        except Exception:
            return boxes

        if not results:
            return boxes

        yolo_result = results[0]
        if yolo_result.boxes is None:
            return boxes

        for box in yolo_result.boxes:
            conf = float(box.conf[0]) if box.conf is not None else 0.0
            if conf < FACE_DETECTION_CONFIDENCE:
                continue
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            x1, y1 = max(0, int(x1)), max(0, int(y1))
            x2, y2 = max(0, int(x2)), max(0, int(y2))
            if (x2 - x1) < MIN_BOX_SIZE or (y2 - y1) < MIN_BOX_SIZE:
                continue
            boxes.append((x1, y1, x2, y2))
        return boxes

    def _detect_with_mtcnn(self, frame):
        boxes = []
        try:
            results = self.mtcnn.detect_faces(frame)
        except Exception:
            return boxes

        for face in results:
            x, y, w, h = face["box"]
            x, y = max(0, int(x)), max(0, int(y))
            w, h = int(w), int(h)
            if w < MIN_BOX_SIZE or h < MIN_BOX_SIZE:
                continue
            boxes.append((x, y, x + w, y + h))
        return boxes


def start_camera():
    global camera, camera_active, detector
    with lock:
        if camera_active:
            return
        camera = cv2.VideoCapture(0)
        detector = detector or FaceDetector()
        camera_active = True
        print("✅ Camera started")


def stop_camera():
    global camera, camera_active
    with lock:
        if camera is not None:
            camera.release()
            camera = None
        camera_active = False
        process_live_scan_payload({"status": "IDLE", "detections": []})
        print("⛔ Camera HARD stopped")


def generate_frames():
    global camera, camera_active, detector

    start_camera()
    recent_candidates = deque(maxlen=TEMPORAL_VOTING_WINDOW)
    prev_gray = None
    read_failures = 0
    max_read_failures = 8

    try:
        while camera_active:
            success, frame = camera.read()
            if not success:
                read_failures += 1
                if read_failures >= max_read_failures:
                    break
                continue
            read_failures = 0

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            motion_score = 0.0
            if prev_gray is not None:
                motion_score = float(cv2.absdiff(gray, prev_gray).mean())
            prev_gray = gray
            liveness_ok = motion_score >= LIVE_MOTION_THRESHOLD

            active_detector = detector or FaceDetector()
            boxes = active_detector.detect_faces(frame)
            frame_candidates = []

            for (x1, y1, x2, y2) in boxes:
                face = frame[y1:y2, x1:x2]
                try:
                    face_label, confidence, details = recognize_face(face, return_details=True)
                except Exception:
                    continue
                confidence = float(confidence)
                is_candidate = face_label != "unknown" and confidence >= FRAME_MATCH_CANDIDATE_CONFIDENCE

                fallback_name = str(details.get("best_candidate") or "unknown")
                fallback_confidence = float(details.get("best_candidate_confidence", 0.0))
                shown_name = face_label if face_label != "unknown" else fallback_name
                shown_confidence = confidence if face_label != "unknown" else fallback_confidence

                color = (0, 255, 0) if is_candidate else (0, 170, 255)
                text = f"{shown_name} | {shown_confidence:.1f}%"

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    frame,
                    text,
                    (x1, max(20, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    color,
                    2,
                    cv2.LINE_AA,
                )

                if is_candidate:
                    frame_candidates.append({"face_label": face_label, "confidence": confidence})

            recent_candidates.append(frame_candidates)
            stable_matches = _aggregate_temporal_matches(recent_candidates)
            if not liveness_ok:
                stable_matches = []

            status = "MATCH" if stable_matches else ("SCANNING" if liveness_ok else "LOW_MOTION")

            try:
                snapshot = None
                if stable_matches:
                    snapshot = _encode_frame_as_data_url(frame)
                process_live_scan_payload(
                    {
                        "status": status,
                        "detections": stable_matches,
                        "investigator_id": ACTIVE_INVESTIGATOR_ID,
                        "snapshot": snapshot,
                    }
                )
            except Exception:
                # Keep stream alive even if DB/logging has transient failures.
                pass

            cv2.putText(
                frame,
                f"MOTION:{motion_score:.2f}",
                (10, 24),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0) if liveness_ok else (0, 180, 255),
                2,
                cv2.LINE_AA,
            )

            ret, buffer = cv2.imencode(".jpg", frame)
            frame = buffer.tobytes()

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame
                + b"\r\n"
            )
    finally:
        stop_camera()


def _aggregate_temporal_matches(history):
    counts = {}
    max_conf = {}
    score_sum = {}

    for frame_candidates in history:
        seen_in_frame = set()
        for item in frame_candidates:
            label = item.get("face_label")
            confidence = float(item.get("confidence", 0.0))
            if not label or label in seen_in_frame:
                continue

            seen_in_frame.add(label)
            counts[label] = counts.get(label, 0) + 1
            max_conf[label] = max(max_conf.get(label, 0.0), confidence)
            score_sum[label] = score_sum.get(label, 0.0) + confidence

    stable = []
    for label, hit_count in counts.items():
        if hit_count < TEMPORAL_VOTING_MIN_HITS:
            continue
        averaged = score_sum[label] / max(1, hit_count)
        stable.append(
            {
                "face_label": label,
                "confidence": max(max_conf[label], averaged),
            }
        )

    stable.sort(key=lambda item: float(item.get("confidence", 0.0)), reverse=True)
    return stable


def _encode_frame_as_data_url(frame):
    ok, encoded = cv2.imencode(".jpg", frame)
    if not ok:
        return None
    b64 = base64.b64encode(encoded.tobytes()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"
