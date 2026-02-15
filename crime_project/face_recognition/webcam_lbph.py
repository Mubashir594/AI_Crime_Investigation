import cv2
import requests

MODEL_PATH = "lbph_model.yml"
API_URL = "http://127.0.0.1:8000/api/recognition/"
CONFIDENCE_THRESHOLD = 60  # 🔑 minimum confidence to accept match

# Load trained LBPH model
model = cv2.face.LBPHFaceRecognizer_create()
model.read(MODEL_PATH)

# Load Haar Cascade for face detection
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

video = cv2.VideoCapture(0)

print("[INFO] Webcam started. Press Q to exit.")

last_sent_label = None  # prevent API spam

while True:
    ret, frame = video.read()
    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    for (x, y, w, h) in faces:
        roi = gray[y:y+h, x:x+w]
        roi = cv2.resize(roi, (200, 200))  # SAME SIZE AS TRAINING

        label_id, lbph_confidence = model.predict(roi)

        # Convert label id → person_XXX
        face_label = f"person_{str(label_id + 1).zfill(3)}"

        # 🔑 Convert LBPH confidence (lower is better) to percentage
        match_confidence = round(100 - lbph_confidence, 2)

        # 🔑 Reject weak matches
        if match_confidence < CONFIDENCE_THRESHOLD:
            face_label = "unknown"
            display_text = "UNKNOWN"
        else:
            display_text = f"{face_label} | {match_confidence}%"

        # Draw bounding box & label
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
        cv2.putText(
            frame,
            display_text,
            (x, y-10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2
        )

        # 🔥 CALL API ONLY FOR VALID MATCHES
        if face_label != "unknown" and face_label != last_sent_label:
            try:
                response = requests.get(
                    API_URL,
                    params={
                        "label": face_label,
                        "confidence": match_confidence
                    },
                    timeout=2
                )

                data = response.json()

                if data.get("match"):
                    criminal = data["criminal"]
                    print("\n[MATCH FOUND]")
                    print("Name       :", criminal["name"])
                    print("Crime Type :", criminal["crime_type"])
                    print("Risk Level :", criminal["status"])
                    print("Confidence :", match_confidence, "%")
                else:
                    print("\n[NO MATCH FOUND]")

                last_sent_label = face_label

            except Exception as e:
                print("[API ERROR]", e)

    cv2.imshow("LBPH Face Recognition", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

video.release()
cv2.destroyAllWindows()
print("[INFO] Webcam closed.")
