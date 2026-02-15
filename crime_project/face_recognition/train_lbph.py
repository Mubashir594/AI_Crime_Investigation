import cv2
import os
import numpy as np

DATASET_PATH = "dataset"
MODEL_PATH = "lbph_model.yml"

faces = []
labels = []
label_map = {}

current_label = 0
FACE_SIZE = (200, 200)  # 🔴 FIXED SIZE

print("[INFO] Loading dataset...")

for person_name in os.listdir(DATASET_PATH):
    person_path = os.path.join(DATASET_PATH, person_name)

    if not os.path.isdir(person_path):
        continue

    label_map[current_label] = person_name

    for image_name in os.listdir(person_path):
        image_path = os.path.join(person_path, image_name)

        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue

        # 🔴 Resize all faces to same size
        img = cv2.resize(img, FACE_SIZE)

        faces.append(img)
        labels.append(current_label)

    current_label += 1

print("[INFO] Training LBPH model...")

model = cv2.face.LBPHFaceRecognizer_create()
model.train(faces, np.array(labels))
model.save(MODEL_PATH)

print("[SUCCESS] LBPH model trained and saved.")
print("Label Map:", label_map)
