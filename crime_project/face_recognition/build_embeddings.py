import os
import cv2
import pickle
from facenet_encoder import get_face_embedding
import numpy as np
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATASET_PATH = ROOT_DIR / "dataset"
EMBEDDINGS_PATH = Path(__file__).resolve().parent / "facenet_embeddings.pkl"
MAX_TEMPLATES_PER_PERSON = 5
DIVERSITY_DISTANCE = 0.08
MIN_TEMPLATE_QUALITY = 0.45


def cosine_distance(a, b):
    return 1.0 - float(np.dot(a, b))


def pick_diverse_templates(items, max_count):
    selected = []
    selected_indices = set()
    for item in items:
        emb = item["embedding"]
        if not selected:
            selected.append(item)
            selected_indices.add(id(item))
            if len(selected) >= max_count:
                break
            continue

        min_dist = min(cosine_distance(emb, existing["embedding"]) for existing in selected)
        if min_dist >= DIVERSITY_DISTANCE:
            selected.append(item)
            selected_indices.add(id(item))
            if len(selected) >= max_count:
                break

    if len(selected) < max_count:
        for item in items:
            if id(item) in selected_indices:
                continue
            selected.append(item)
            selected_indices.add(id(item))
            if len(selected) >= max_count:
                break

    return selected[:max_count]

embeddings = {}

for person in os.listdir(DATASET_PATH):
    person_dir = DATASET_PATH / person
    if not person_dir.is_dir():
        continue

    person_embeddings = []

    for img_name in os.listdir(person_dir):
        img_path = person_dir / img_name
        img = cv2.imread(str(img_path))

        if img is None:
            continue

        embedding, meta = get_face_embedding(img, return_meta=True)
        if embedding is None:
            reason = meta.get("reason", "unknown")
            print(f"[SKIPPED] {person}/{img_name} ({reason})")
            continue

        quality_score = float(meta.get("quality_score", 0.0))
        if quality_score < MIN_TEMPLATE_QUALITY:
            print(f"[SKIPPED] {person}/{img_name} (low_quality:{quality_score:.2f})")
            continue

        person_embeddings.append(
            {
                "embedding": embedding,
                "quality_score": quality_score,
                "image": img_name,
            }
        )

    if person_embeddings:
        person_embeddings.sort(key=lambda item: item["quality_score"], reverse=True)
        chosen = pick_diverse_templates(person_embeddings, MAX_TEMPLATES_PER_PERSON)
        embeddings[person] = [item["embedding"] for item in chosen]
        print(
            f"[INFO] {person}: selected {len(chosen)}/{len(person_embeddings)} templates "
            f"(max={MAX_TEMPLATES_PER_PERSON})"
        )
    else:
        print(f"[WARNING] No valid faces found for {person}")

with open(EMBEDDINGS_PATH, "wb") as f:
    pickle.dump(embeddings, f)

print("[SUCCESS] FaceNet embeddings created.")
