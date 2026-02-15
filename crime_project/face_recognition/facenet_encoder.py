import cv2
import numpy as np
from mtcnn.mtcnn import MTCNN
from keras_facenet import FaceNet

# Initialize models once.
detector = MTCNN()
embedder = FaceNet()

FACE_SIZE = (160, 160)
MIN_FACE_SIZE = 60
MIN_FACE_SIZE_CROPPED = 40
MIN_BRIGHTNESS = 40.0
MAX_BRIGHTNESS = 220.0
MIN_LAPLACIAN_VAR = 75.0
RELAXED_MIN_LAPLACIAN_VAR = 35.0
MAX_ROLL_ANGLE = 30.0
BOX_MARGIN_RATIO = 0.18


def _l2_normalize(vec):
    norm = np.linalg.norm(vec)
    if norm <= 1e-12:
        return vec
    return vec / norm


def _largest_face(results):
    if not results:
        return None
    return max(results, key=lambda f: int(f["box"][2]) * int(f["box"][3]))


def _safe_crop(frame, x1, y1, x2, y2):
    h, w = frame.shape[:2]
    x1, y1 = max(0, int(x1)), max(0, int(y1))
    x2, y2 = min(w, int(x2)), min(h, int(y2))
    if x2 <= x1 or y2 <= y1:
        return None
    crop = frame[y1:y2, x1:x2]
    return crop if crop.size else None


def _extract_face_with_margin(frame, face_box):
    x, y, w, h = face_box
    x, y = int(x), int(y)
    w, h = int(w), int(h)

    margin_x = int(w * BOX_MARGIN_RATIO)
    margin_y = int(h * BOX_MARGIN_RATIO)

    x1 = x - margin_x
    y1 = y - margin_y
    x2 = x + w + margin_x
    y2 = y + h + margin_y

    return _safe_crop(frame, x1, y1, x2, y2), (x1, y1)


def _align_face_by_eyes(face_crop, keypoints, crop_origin):
    if not keypoints:
        return face_crop, 0.0

    left_eye = keypoints.get("left_eye")
    right_eye = keypoints.get("right_eye")
    if not left_eye or not right_eye:
        return face_crop, 0.0

    left_eye = np.array(left_eye, dtype=np.float32)
    right_eye = np.array(right_eye, dtype=np.float32)
    dx = float(right_eye[0] - left_eye[0])
    dy = float(right_eye[1] - left_eye[1])
    angle = float(np.degrees(np.arctan2(dy, dx)))

    if abs(angle) > MAX_ROLL_ANGLE:
        return None, angle

    eye_center = ((left_eye + right_eye) / 2.0) - np.array(crop_origin, dtype=np.float32)
    rot_mat = cv2.getRotationMatrix2D(tuple(eye_center), angle, 1.0)
    aligned = cv2.warpAffine(
        face_crop,
        rot_mat,
        (face_crop.shape[1], face_crop.shape[0]),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return aligned, angle


def _quality_metrics(face_crop, relaxed=False):
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    min_laplacian_var = RELAXED_MIN_LAPLACIAN_VAR if relaxed else MIN_LAPLACIAN_VAR

    brightness_score = 1.0
    if brightness < MIN_BRIGHTNESS:
        brightness_score = max(0.0, brightness / max(MIN_BRIGHTNESS, 1.0))
    elif brightness > MAX_BRIGHTNESS:
        brightness_score = max(0.0, (255.0 - brightness) / max(255.0 - MAX_BRIGHTNESS, 1.0))

    sharpness_score = min(1.0, sharpness / max(min_laplacian_var, 1.0))
    quality_score = max(0.0, min(1.0, 0.45 * brightness_score + 0.55 * sharpness_score))

    passed = (
        brightness >= MIN_BRIGHTNESS
        and brightness <= MAX_BRIGHTNESS
        and sharpness >= min_laplacian_var
    )

    return passed, {
        "brightness": brightness,
        "sharpness": sharpness,
        "quality_score": quality_score,
        "relaxed_quality": bool(relaxed),
    }


def get_face_embedding(frame, return_meta=False, assume_cropped=False, relaxed_quality=False):
    if assume_cropped:
        face_crop = frame
        roll_angle = 0.0
        h, w = face_crop.shape[:2]
        if w < MIN_FACE_SIZE_CROPPED or h < MIN_FACE_SIZE_CROPPED:
            if return_meta:
                return None, {"reason": "face_too_small", "assume_cropped": True}
            return None
        aligned_face = face_crop
    else:
        try:
            results = detector.detect_faces(frame)
        except Exception:
            if return_meta:
                return None, {"reason": "detector_error"}
            return None

        face_item = _largest_face(results)
        if not face_item:
            if return_meta:
                return None, {"reason": "no_face"}
            return None

        x, y, w, h = face_item["box"]
        if int(w) < MIN_FACE_SIZE or int(h) < MIN_FACE_SIZE:
            if return_meta:
                return None, {"reason": "face_too_small"}
            return None

        face_crop, crop_origin = _extract_face_with_margin(frame, face_item["box"])
        if face_crop is None:
            if return_meta:
                return None, {"reason": "invalid_crop"}
            return None

        aligned_face, roll_angle = _align_face_by_eyes(face_crop, face_item.get("keypoints"), crop_origin)
        if aligned_face is None:
            if return_meta:
                return None, {"reason": "pose_roll_too_high", "roll_angle": roll_angle}
            return None

    quality_ok, quality_info = _quality_metrics(aligned_face, relaxed=relaxed_quality)
    if not quality_ok:
        if return_meta:
            meta = {
                "reason": "low_quality",
                "roll_angle": roll_angle,
                "assume_cropped": bool(assume_cropped),
            }
            meta.update(quality_info)
            return None, meta
        return None

    try:
        face = cv2.resize(aligned_face, FACE_SIZE, interpolation=cv2.INTER_AREA)
        face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
        face = np.expand_dims(face, axis=0)
        embedding = embedder.embeddings(face)[0]
        embedding = _l2_normalize(embedding)
    except Exception:
        if return_meta:
            return None, {"reason": "embedding_error"}
        return None

    if return_meta:
        meta = {
            "reason": "ok",
            "roll_angle": roll_angle,
            "assume_cropped": bool(assume_cropped),
        }
        meta.update(quality_info)
        return embedding, meta
    return embedding
