from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import check_password
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.conf import settings
from investigator_module.models import Investigator
from crime_database.models import Criminal, CrimeRecord, Evidence
from .facenet import reload_embeddings
from pathlib import Path
from datetime import datetime
from django.utils import timezone
from django.utils.dateparse import parse_date
import json
import sys
import subprocess
import uuid


# ============================
# LOGIN API
# ============================
@csrf_exempt
def investigator_login_api(request):
    if request.method != "POST":
        return JsonResponse(
            {"success": False, "message": "POST request required"},
            status=405
        )

    try:
        data = json.loads(request.body.decode("utf-8"))
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return JsonResponse(
                {"success": False, "message": "Username and password required"},
                status=400
            )

        investigator = Investigator.objects.get(username=username)

        if not investigator.is_active:
            return JsonResponse(
                {"success": False, "message": "Account is inactive"},
                status=403
            )

        if not check_password(password, investigator.password):
            return JsonResponse(
                {"success": False, "message": "Invalid credentials"},
                status=401
            )

        # Prevent mixed-role session state when switching from admin to investigator.
        request.session.pop("admin_user_id", None)
        request.session.pop("admin_username", None)

        # ✅ CREATE SESSION (CRITICAL)
        request.session["investigator_id"] = investigator.id
        request.session["investigator_name"] = investigator.full_name
        request.session.modified = True   # 🔥 IMPORTANT

        return JsonResponse({
            "success": True,
            "message": "Login successful",
            "investigator_name": investigator.full_name
        })

    except Investigator.DoesNotExist:
        return JsonResponse(
            {"success": False, "message": "Invalid credentials"},
            status=401
        )
    except Exception as e:
        return JsonResponse(
            {"success": False, "message": str(e)},
            status=500
        )


# ============================
# AUTH CHECK API
# ============================
def investigator_auth_check(request):
    investigator_id = request.session.get("investigator_id")
    investigator_name = request.session.get("investigator_name")

    if investigator_id:
        return JsonResponse({
            "authenticated": True,
            "investigator_name": investigator_name
        })

    return JsonResponse({
        "authenticated": False
    })


def investigator_profile_api(request):
    investigator_id = request.session.get("investigator_id")
    if not investigator_id:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    try:
        investigator = Investigator.objects.get(id=investigator_id)
        return JsonResponse(
            {
                "success": True,
                "profile": {
                    "id": investigator.id,
                    "full_name": investigator.full_name,
                    "username": investigator.username,
                    "badge_id": investigator.badge_id,
                    "department": investigator.department,
                    "is_active": investigator.is_active,
                },
            }
        )
    except Investigator.DoesNotExist:
        return JsonResponse({"success": False, "message": "Investigator not found"}, status=404)


# ============================
# LOGOUT API
# ============================
@csrf_exempt
def investigator_logout_api(request):
    request.session.flush()  # 🔥 completely clears session
    return JsonResponse({
        "success": True,
        "message": "Logged out successfully"
    })


def _admin_authenticated(request):
    admin_user_id = request.session.get("admin_user_id")
    if not admin_user_id:
        return None
    try:
        return User.objects.get(id=admin_user_id, is_active=True)
    except User.DoesNotExist:
        return None


def _serialize_criminal(criminal):
    return {
        "id": criminal.id,
        "name": criminal.name,
        "face_label": criminal.face_label,
        "age": criminal.age,
        "gender": criminal.gender,
        "address": criminal.address,
        "crime_type": criminal.crime_type,
        "photo": criminal.photo.url if criminal.photo else None,
        "created_at": criminal.created_at.isoformat() if criminal.created_at else None,
    }


def _serialize_crime_record(record):
    date_value = record.crime_date
    if hasattr(date_value, "isoformat"):
        serialized_date = date_value.isoformat()
    else:
        serialized_date = str(date_value) if date_value else None

    return {
        "id": record.id,
        "criminal_id": record.criminal_id,
        "criminal_name": record.criminal.name if record.criminal else None,
        "crime_type": record.crime_type,
        "crime_date": serialized_date,
        "crime_location": record.crime_location,
        "description": record.description,
    }


def _serialize_evidence(evidence):
    return {
        "id": evidence.id,
        "crime_record_id": evidence.crime_record_id,
        "crime_location": evidence.crime_record.crime_location if evidence.crime_record else None,
        "criminal_name": evidence.crime_record.criminal.name if evidence.crime_record and evidence.crime_record.criminal else None,
        "evidence_file": evidence.evidence_file.url if evidence.evidence_file else None,
        "uploaded_at": evidence.uploaded_at.isoformat() if evidence.uploaded_at else None,
    }


def _ensure_criminal_baseline_records():
    today = timezone.now().date()
    existing_criminal_ids = set(CrimeRecord.objects.values_list("criminal_id", flat=True))
    missing = Criminal.objects.exclude(id__in=existing_criminal_ids)
    bulk = []
    for criminal in missing:
        bulk.append(
            CrimeRecord(
                criminal=criminal,
                crime_type=criminal.crime_type or "Unknown",
                crime_date=today,
                crime_location=criminal.address or "Unknown location",
                description=f"Imported baseline crime record for {criminal.name}.",
            )
        )
    if bulk:
        CrimeRecord.objects.bulk_create(bulk)


def _coerce_crime_date(value):
    parsed = parse_date(str(value)) if value is not None else None
    return parsed


DATASET_DIR = Path(settings.BASE_DIR) / "dataset"
FACE_RECOGNITION_DIR = Path(settings.BASE_DIR) / "face_recognition"
EMBEDDING_SCRIPT = FACE_RECOGNITION_DIR / "build_embeddings.py"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _safe_extension(filename):
    suffix = Path(filename or "").suffix.lower()
    return suffix if suffix in ALLOWED_IMAGE_EXTENSIONS else ".jpg"


def _dataset_folder(face_label):
    folder = DATASET_DIR / face_label
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _save_upload_to_dataset(uploaded_file, face_label):
    folder = _dataset_folder(face_label)
    extension = _safe_extension(uploaded_file.name)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"img_{stamp}_{uuid.uuid4().hex[:8]}{extension}"
    target = folder / filename

    if hasattr(uploaded_file, "seek"):
        uploaded_file.seek(0)
    with open(target, "wb") as output:
        for chunk in uploaded_file.chunks():
            output.write(chunk)
    return str(target)


def _rename_dataset_folder(old_label, new_label):
    if old_label == new_label:
        return

    old_folder = DATASET_DIR / old_label
    new_folder = DATASET_DIR / new_label

    if new_folder.exists():
        raise ValueError(f"Dataset folder already exists for {new_label}")
    if old_folder.exists():
        old_folder.rename(new_folder)


def _rebuild_embeddings():
    if not EMBEDDING_SCRIPT.exists():
        return False, "Embedding script not found"

    completed = subprocess.run(
        [sys.executable, EMBEDDING_SCRIPT.name],
        cwd=str(FACE_RECOGNITION_DIR),
        capture_output=True,
        text=True,
        check=False,
    )

    if completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip() or "Embedding rebuild failed"
        return False, message

    reload_embeddings()
    return True, "Face dataset re-trained successfully"


@csrf_exempt
def admin_login_api(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST request required"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return JsonResponse({"success": False, "message": "Username and password required"}, status=400)

        user = authenticate(request, username=username, password=password)
        if not user:
            return JsonResponse({"success": False, "message": "Invalid credentials"}, status=401)
        if not (user.is_staff or user.is_superuser):
            return JsonResponse({"success": False, "message": "Admin access required"}, status=403)

        login(request, user)

        # Prevent mixed-role session state when switching from investigator to admin.
        request.session.pop("investigator_id", None)
        request.session.pop("investigator_name", None)
        request.session["admin_user_id"] = user.id
        request.session["admin_username"] = user.username
        request.session.modified = True

        return JsonResponse({"success": True, "username": user.username})
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=500)


def admin_auth_check(request):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"authenticated": False})
    return JsonResponse({"authenticated": True, "username": admin_user.username})


@csrf_exempt
def admin_logout_api(request):
    logout(request)
    request.session.pop("admin_user_id", None)
    request.session.pop("admin_username", None)
    request.session.modified = True
    return JsonResponse({"success": True, "message": "Admin logged out"})


def admin_dashboard_summary(request):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    return JsonResponse(
        {
            "success": True,
            "summary": {
                "criminals": Criminal.objects.count(),
                "crime_records": CrimeRecord.objects.count(),
                "evidence_files": Evidence.objects.count(),
                "investigators": Investigator.objects.count(),
                "active_investigators": Investigator.objects.filter(is_active=True).count(),
            },
        }
    )


@csrf_exempt
def admin_investigators(request):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    if request.method == "GET":
        investigators = Investigator.objects.all().order_by("full_name")
        return JsonResponse(
            {
                "success": True,
                "investigators": [
                    {
                        "id": inv.id,
                        "full_name": inv.full_name,
                        "username": inv.username,
                        "badge_id": inv.badge_id,
                        "department": inv.department,
                        "is_active": inv.is_active,
                    }
                    for inv in investigators
                ],
            }
        )

    if request.method == "POST":
        try:
            data = json.loads(request.body.decode("utf-8"))
            required = ["full_name", "username", "password", "badge_id", "department"]
            missing = [key for key in required if not data.get(key)]
            if missing:
                return JsonResponse(
                    {"success": False, "message": f"Missing required fields: {', '.join(missing)}"},
                    status=400,
                )

            investigator = Investigator.objects.create(
                full_name=data["full_name"],
                username=data["username"],
                password=data["password"],
                badge_id=data["badge_id"],
                department=data["department"],
                is_active=data.get("is_active", True),
            )
            return JsonResponse(
                {
                    "success": True,
                    "message": "Investigator created",
                    "investigator": {
                        "id": investigator.id,
                        "full_name": investigator.full_name,
                        "username": investigator.username,
                        "badge_id": investigator.badge_id,
                        "department": investigator.department,
                        "is_active": investigator.is_active,
                    },
                }
            )
        except Exception as e:
            return JsonResponse({"success": False, "message": str(e)}, status=400)

    return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)


@csrf_exempt
def admin_investigator_detail(request, investigator_id):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    try:
        investigator = Investigator.objects.get(id=investigator_id)
    except Investigator.DoesNotExist:
        return JsonResponse({"success": False, "message": "Investigator not found"}, status=404)

    if request.method not in ["PUT", "PATCH"]:
        return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
        investigator.full_name = data.get("full_name", investigator.full_name)
        investigator.username = data.get("username", investigator.username)
        investigator.badge_id = data.get("badge_id", investigator.badge_id)
        investigator.department = data.get("department", investigator.department)
        if "is_active" in data:
            investigator.is_active = bool(data["is_active"])
        if data.get("password"):
            investigator.password = data["password"]
        investigator.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Investigator updated",
                "investigator": {
                    "id": investigator.id,
                    "full_name": investigator.full_name,
                    "username": investigator.username,
                    "badge_id": investigator.badge_id,
                    "department": investigator.department,
                    "is_active": investigator.is_active,
                },
            }
        )
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=400)


@csrf_exempt
def admin_criminals(request):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    if request.method == "GET":
        criminals = Criminal.objects.all().order_by("name")
        return JsonResponse(
            {
                "success": True,
                "criminals": [_serialize_criminal(criminal) for criminal in criminals],
            }
        )

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)

    try:
        data = request.POST
        photo = request.FILES.get("photo")
        dataset_photos = request.FILES.getlist("dataset_photos")
        required = ["name", "age", "gender", "address", "crime_type", "face_label"]
        missing = [key for key in required if not data.get(key)]
        if not photo:
            missing.append("photo")
        if missing:
            return JsonResponse(
                {"success": False, "message": f"Missing required fields: {', '.join(missing)}"},
                status=400,
            )

        face_label = data.get("face_label", "").strip()
        if not face_label:
            return JsonResponse({"success": False, "message": "Face label is required"}, status=400)

        criminal = Criminal.objects.create(
            name=data.get("name"),
            age=int(data.get("age")),
            gender=data.get("gender"),
            address=data.get("address"),
            crime_type=data.get("crime_type"),
            face_label=face_label,
            photo=photo,
        )

        training_files = [photo] + [item for item in dataset_photos if item]
        for upload in training_files:
            _save_upload_to_dataset(upload, criminal.face_label)

        trained, training_message = _rebuild_embeddings()
        message = "Criminal created and dataset updated." if trained else "Criminal created, but dataset training failed."

        return JsonResponse(
            {
                "success": True,
                "message": message,
                "training_success": trained,
                "training_message": training_message,
                "criminal": _serialize_criminal(criminal),
            }
        )
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=400)


@csrf_exempt
def admin_criminal_detail(request, criminal_id):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    try:
        criminal = Criminal.objects.get(id=criminal_id)
    except Criminal.DoesNotExist:
        return JsonResponse({"success": False, "message": "Criminal not found"}, status=404)

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)

    try:
        data = request.POST
        old_face_label = criminal.face_label
        next_face_label = data.get("face_label", criminal.face_label).strip()
        if not next_face_label:
            return JsonResponse({"success": False, "message": "Face label is required"}, status=400)
        if Criminal.objects.exclude(id=criminal.id).filter(face_label=next_face_label).exists():
            return JsonResponse({"success": False, "message": "Face label already exists"}, status=400)
        if old_face_label != next_face_label and (DATASET_DIR / next_face_label).exists():
            return JsonResponse(
                {"success": False, "message": f"Dataset folder already exists for {next_face_label}"},
                status=400,
            )

        criminal.name = data.get("name", criminal.name)
        criminal.gender = data.get("gender", criminal.gender)
        criminal.address = data.get("address", criminal.address)
        criminal.crime_type = data.get("crime_type", criminal.crime_type)
        criminal.face_label = next_face_label
        if data.get("age"):
            criminal.age = int(data.get("age"))

        profile_photo = request.FILES.get("photo")
        if profile_photo:
            criminal.photo = profile_photo

        criminal.save()

        dataset_changed = False
        if old_face_label != criminal.face_label:
            _rename_dataset_folder(old_face_label, criminal.face_label)
            dataset_changed = True

        dataset_photos = request.FILES.getlist("dataset_photos")
        training_files = [item for item in ([profile_photo] + dataset_photos) if item]
        for upload in training_files:
            _save_upload_to_dataset(upload, criminal.face_label)
            dataset_changed = True

        trained = True
        training_message = "No dataset change detected"
        if dataset_changed:
            trained, training_message = _rebuild_embeddings()

        message = "Criminal updated and dataset synchronized." if trained else "Criminal updated, but dataset training failed."

        return JsonResponse(
            {
                "success": True,
                "message": message,
                "training_success": trained,
                "training_message": training_message,
                "criminal": _serialize_criminal(criminal),
            }
        )
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=400)


@csrf_exempt
def admin_retrain_embeddings(request):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)

    trained, training_message = _rebuild_embeddings()
    status = 200 if trained else 500
    return JsonResponse(
        {
            "success": trained,
            "message": training_message,
        },
        status=status,
    )


@csrf_exempt
def admin_crime_records(request):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    if request.method == "GET":
        _ensure_criminal_baseline_records()
        records = CrimeRecord.objects.select_related("criminal").order_by("-crime_date", "-id")
        return JsonResponse(
            {
                "success": True,
                "records": [_serialize_crime_record(record) for record in records],
            }
        )

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
        required = ["criminal_id", "crime_type", "crime_date", "crime_location", "description"]
        missing = [key for key in required if not data.get(key)]
        if missing:
            return JsonResponse(
                {"success": False, "message": f"Missing required fields: {', '.join(missing)}"},
                status=400,
            )

        criminal = Criminal.objects.get(id=int(data["criminal_id"]))
        crime_date = _coerce_crime_date(data.get("crime_date"))
        if not crime_date:
            return JsonResponse({"success": False, "message": "Invalid crime_date format. Use YYYY-MM-DD."}, status=400)
        record = CrimeRecord.objects.create(
            criminal=criminal,
            crime_type=data["crime_type"],
            crime_date=crime_date,
            crime_location=data["crime_location"],
            description=data["description"],
        )
        criminal.crime_type = record.crime_type
        criminal.save(update_fields=["crime_type"])
        return JsonResponse(
            {
                "success": True,
                "message": "Crime record created.",
                "record": _serialize_crime_record(record),
            }
        )
    except Criminal.DoesNotExist:
        return JsonResponse({"success": False, "message": "Criminal not found"}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=400)


@csrf_exempt
def admin_crime_record_detail(request, record_id):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    try:
        record = CrimeRecord.objects.select_related("criminal").get(id=record_id)
    except CrimeRecord.DoesNotExist:
        return JsonResponse({"success": False, "message": "Crime record not found"}, status=404)

    if request.method not in ["PUT", "PATCH"]:
        return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
        if data.get("criminal_id"):
            record.criminal = Criminal.objects.get(id=int(data["criminal_id"]))
        record.crime_type = data.get("crime_type", record.crime_type)
        if "crime_date" in data:
            parsed = _coerce_crime_date(data.get("crime_date"))
            if not parsed:
                return JsonResponse({"success": False, "message": "Invalid crime_date format. Use YYYY-MM-DD."}, status=400)
            record.crime_date = parsed
        record.crime_location = data.get("crime_location", record.crime_location)
        record.description = data.get("description", record.description)
        record.save()
        if record.criminal:
            record.criminal.crime_type = record.crime_type
            record.criminal.save(update_fields=["crime_type"])

        return JsonResponse(
            {
                "success": True,
                "message": "Crime record updated.",
                "record": _serialize_crime_record(record),
            }
        )
    except Criminal.DoesNotExist:
        return JsonResponse({"success": False, "message": "Criminal not found"}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=400)


@csrf_exempt
def admin_evidences(request):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    if request.method == "GET":
        evidences = Evidence.objects.select_related("crime_record", "crime_record__criminal").order_by("-uploaded_at")
        return JsonResponse(
            {
                "success": True,
                "evidences": [_serialize_evidence(evidence) for evidence in evidences],
            }
        )

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)

    try:
        record_id = request.POST.get("crime_record_id")
        evidence_file = request.FILES.get("evidence_file")
        if not record_id or not evidence_file:
            return JsonResponse(
                {"success": False, "message": "crime_record_id and evidence_file are required"},
                status=400,
            )

        record = CrimeRecord.objects.get(id=int(record_id))
        evidence = Evidence.objects.create(crime_record=record, evidence_file=evidence_file)
        return JsonResponse(
            {
                "success": True,
                "message": "Evidence added.",
                "evidence": _serialize_evidence(evidence),
            }
        )
    except CrimeRecord.DoesNotExist:
        return JsonResponse({"success": False, "message": "Crime record not found"}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=400)


@csrf_exempt
def admin_evidence_detail(request, evidence_id):
    admin_user = _admin_authenticated(request)
    if not admin_user:
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=401)

    try:
        evidence = Evidence.objects.select_related("crime_record", "crime_record__criminal").get(id=evidence_id)
    except Evidence.DoesNotExist:
        return JsonResponse({"success": False, "message": "Evidence not found"}, status=404)

    if request.method not in ["PUT", "PATCH", "POST"]:
        return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)

    try:
        if request.content_type and request.content_type.startswith("application/json"):
            data = json.loads(request.body.decode("utf-8"))
            record_id = data.get("crime_record_id")
            if record_id:
                evidence.crime_record = CrimeRecord.objects.get(id=int(record_id))
        else:
            record_id = request.POST.get("crime_record_id")
            if record_id:
                evidence.crime_record = CrimeRecord.objects.get(id=int(record_id))
            file_obj = request.FILES.get("evidence_file")
            if file_obj:
                evidence.evidence_file = file_obj

        evidence.save()
        return JsonResponse(
            {
                "success": True,
                "message": "Evidence updated.",
                "evidence": _serialize_evidence(evidence),
            }
        )
    except CrimeRecord.DoesNotExist:
        return JsonResponse({"success": False, "message": "Crime record not found"}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=400)
