from datetime import datetime

def format_result(label, confidence):
    return {
        "person_label": label,
        "confidence": round(confidence, 2),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
