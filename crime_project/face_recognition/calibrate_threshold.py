import argparse
import pickle
from pathlib import Path
import numpy as np


def l2_normalize(vec):
    norm = np.linalg.norm(vec)
    if norm <= 1e-12:
        return vec
    return vec / norm


def cosine_distance(a, b):
    return 1.0 - float(np.dot(a, b))


def pairwise_distances(vectors):
    distances = []
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            distances.append(cosine_distance(vectors[i], vectors[j]))
    return distances


def make_impostor_distances(by_label, max_samples_per_pair=20):
    labels = sorted(by_label.keys())
    rng = np.random.default_rng(42)
    distances = []
    for i in range(len(labels)):
        for j in range(i + 1, len(labels)):
            a = by_label[labels[i]]
            b = by_label[labels[j]]
            total = len(a) * len(b)
            if total == 0:
                continue

            if total <= max_samples_per_pair:
                for va in a:
                    for vb in b:
                        distances.append(cosine_distance(va, vb))
                continue

            for _ in range(max_samples_per_pair):
                va = a[int(rng.integers(0, len(a)))]
                vb = b[int(rng.integers(0, len(b)))]
                distances.append(cosine_distance(va, vb))
    return distances


def best_threshold(genuine, impostor):
    candidates = np.linspace(0.2, 0.9, 281)
    best = None
    for t in candidates:
        frr = float(np.mean(np.array(genuine) >= t))  # false reject rate
        far = float(np.mean(np.array(impostor) < t))  # false accept rate
        eer_gap = abs(frr - far)
        score = (eer_gap, (frr + far) / 2.0)
        if best is None or score < best["score"]:
            best = {
                "threshold": float(t),
                "frr": frr,
                "far": far,
                "score": score,
            }
    return best


def load_embeddings(path):
    with open(path, "rb") as f:
        raw = pickle.load(f)
    by_label = {}
    for label, embs in raw.items():
        normalized = []
        for emb in embs:
            arr = np.asarray(emb, dtype=np.float32).reshape(-1)
            if arr.size == 0:
                continue
            normalized.append(l2_normalize(arr))
        if len(normalized) >= 2:
            by_label[label] = normalized
    return by_label


def main():
    parser = argparse.ArgumentParser(description="Calibrate FaceNet threshold from enrolled templates")
    parser.add_argument(
        "--embeddings",
        default=str(Path(__file__).resolve().parent / "facenet_embeddings.pkl"),
        help="Path to embeddings pickle",
    )
    args = parser.parse_args()

    path = Path(args.embeddings)
    if not path.exists():
        raise FileNotFoundError(f"Embeddings not found: {path}")

    by_label = load_embeddings(path)
    if len(by_label) < 2:
        raise RuntimeError("Need at least 2 identities with >=2 templates each for calibration")

    genuine = []
    for vectors in by_label.values():
        genuine.extend(pairwise_distances(vectors))

    impostor = make_impostor_distances(by_label)
    if not genuine or not impostor:
        raise RuntimeError("Insufficient distances for calibration")

    best = best_threshold(genuine, impostor)
    print(f"Identities used: {len(by_label)}")
    print(f"Genuine pairs  : {len(genuine)}")
    print(f"Impostor pairs : {len(impostor)}")
    print(f"Recommended FACENET_MATCH_THRESHOLD={best['threshold']:.3f}")
    print(f"Estimated FRR={best['frr']:.4f}, FAR={best['far']:.4f}")


if __name__ == "__main__":
    main()
