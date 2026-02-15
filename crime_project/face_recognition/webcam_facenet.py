import cv2
import pickle
import numpy as np
import requests
from facenet_encoder import get_face_embedding

# =========================
# CONFIG
# =========================
LIVE_SCAN_API = "http://127.0.0.1:8000/api/live-scan/"
EMBEDDINGS_PATH = "face_recognition/facenet_embeddings.pkl"
THRESHOLD = 0.65  # lower = stricter match

# =========================
# LOAD EMBEDDINGS
# =========================
with open(EMBEDDINGS_PATH, "rb") as f:
    database = pickle.load(f)

print("[INFO] FaceNet embeddings loaded")

# =========================
# HELPERS
# =========================
def cosine_distance(a, b):
    return 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def send_live_scan(status, face_label="scanning", confidence=0):
    try:
        requests.post(
            LIVE_SCAN_API,
            json={
                "status": status,
                "face_label": face_label,
                "confidence": float(confidence)
            },
            timeout=1
        )
    except Exception as e:
        print("[LIVE API ERROR]", e)


# =========================
# START WEBCAM
# =========================
cap = cv2.VideoCapture(0)
print("[INFO] FaceNet webcam started. Press Q to exit.")

last_state = None

while True:
    ret, frame = cap.read()
    if not ret:
        break

    embedding = get_face_embedding(frame)

    # =========================
    # SCANNING (NO FACE)
    # =========================
    if embedding is None:
        text = "SCANNING..."
        color = (0, 255, 255)

        if last_state != "SCANNING":
            send_live_scan("SCANNING")
            last_state = "SCANNING"

    else:
        # =========================
        # MATCHING
        # =========================
        best_match = None
        best_score = 1.0

        for person, embs in database.items():
            for emb in embs:
                dist = cosine_distance(embedding, emb)
                if dist < best_score:
                    best_score = dist
                    best_match = person

        # =========================
        # MATCH FOUND
        # =========================
        if best_score < THRESHOLD:
            confidence = round((1 - best_score) * 100, 2)
            face_label = best_match

            text = f"{face_label} | {confidence}%"
            color = (0, 255, 0)

            if last_state != face_label:
                send_live_scan("MATCH", face_label, confidence)
                last_state = face_label

        # =========================
        # NO MATCH
        # =========================
        else:
            text = "UNKNOWN"
            color = (0, 0, 255)

            if last_state != "NO_MATCH":
                send_live_scan("NO_MATCH", "unknown", 0)
                last_state = "NO_MATCH"

    # =========================
    # DRAW UI
    # =========================
    cv2.putText(
        frame,
        text,
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        color,
        2
    )

    cv2.imshow("FaceNet Recognition", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
print("[INFO] Webcam closed")
