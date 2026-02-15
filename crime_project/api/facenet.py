import os
import pickle
import numpy as np
from face_recognition.facenet_encoder import get_face_embedding

EMBEDDINGS_PATH = "face_recognition/facenet_embeddings.pkl"
THRESHOLD = float(os.environ.get("FACENET_MATCH_THRESHOLD", "0.62"))
TOP_K_TEMPLATES = max(1, int(os.environ.get("FACENET_TOP_K", "3")))
MIN_CANDIDATE_CONFIDENCE = float(os.environ.get("FACENET_MIN_CANDIDATE_CONF", "70"))


def _l2_normalize(vec):
    norm = np.linalg.norm(vec)
    if norm <= 1e-12:
        return vec
    return vec / norm


def _normalize_database(raw_database):
    normalized = {}
    for label, templates in raw_database.items():
        cleaned = []
        for emb in templates:
            arr = np.asarray(emb, dtype=np.float32).reshape(-1)
            if arr.size == 0:
                continue
            cleaned.append(_l2_normalize(arr))
        if cleaned:
            normalized[label] = cleaned
    return normalized


def reload_embeddings():
    global DATABASE
    try:
        with open(EMBEDDINGS_PATH, "rb") as f:
            DATABASE = _normalize_database(pickle.load(f))
    except FileNotFoundError:
        DATABASE = {}
    return DATABASE


DATABASE = reload_embeddings()


def cosine_distance(a, b):
    return 1.0 - float(np.dot(a, b))


def _aggregate_label_distance(query_embedding, templates):
    distances = [cosine_distance(query_embedding, emb) for emb in templates]
    if not distances:
        return 1.0
    distances = sorted(distances)
    top_k = distances[: min(TOP_K_TEMPLATES, len(distances))]
    return float(np.mean(top_k))


def recognize_face(face_img, return_details=False):
    embedding, meta = get_face_embedding(
        face_img,
        return_meta=True,
        assume_cropped=True,
        relaxed_quality=True,
    )

    if embedding is None or not DATABASE:
        unknown = ("unknown", 0.0, {"reason": meta.get("reason", "no_embedding")}) if return_details else ("unknown", 0.0)
        return unknown

    embedding = _l2_normalize(np.asarray(embedding, dtype=np.float32).reshape(-1))

    best_match = None
    best_score = 1.0
    scores = {}

    for label, embeddings in DATABASE.items():
        score = _aggregate_label_distance(embedding, embeddings)
        scores[label] = score
        if score < best_score:
            best_score = score
            best_match = label

    if best_score < THRESHOLD:
        confidence = max(0.0, min(100.0, (1.0 - best_score) * 100.0))
        if return_details:
            return best_match, confidence, {
                "distance": best_score,
                "threshold": THRESHOLD,
                "quality": meta,
                "scores": scores,
            }
        return best_match, confidence

    if return_details:
        best_conf = max(0.0, min(100.0, (1.0 - best_score) * 100.0))
        reason = "below_threshold" if best_conf >= MIN_CANDIDATE_CONFIDENCE else "low_confidence"
        return "unknown", 0.0, {
            "reason": reason,
            "best_candidate": best_match,
            "best_distance": best_score,
            "best_candidate_confidence": best_conf,
            "threshold": THRESHOLD,
            "quality": meta,
        }
    return "unknown", 0.0
