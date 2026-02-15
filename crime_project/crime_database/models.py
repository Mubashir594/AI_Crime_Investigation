from django.db import models


class Criminal(models.Model):
    name = models.CharField(max_length=100)
    age = models.IntegerField()
    gender = models.CharField(max_length=10)
    address = models.TextField()

    # Image shown in admin & dashboard
    photo = models.ImageField(upload_to='criminal_photos/')

    crime_type = models.CharField(max_length=100)

    # 🔑 REQUIRED FOR FACE RECOGNITION (PHASE 10B)
    face_label = models.CharField(
        max_length=50,
        unique=True,
        help_text="Must match dataset folder name (e.g., person_001)"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.face_label})"


class CrimeRecord(models.Model):
    criminal = models.ForeignKey(Criminal, on_delete=models.CASCADE)
    crime_type = models.CharField(max_length=120, default="Unknown")
    crime_date = models.DateField()
    crime_location = models.CharField(max_length=200)
    description = models.TextField()

    def __str__(self):
        return self.crime_location


class Evidence(models.Model):
    crime_record = models.ForeignKey(CrimeRecord, on_delete=models.CASCADE)
    evidence_file = models.FileField(upload_to='evidence_files/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return str(self.id)

class LiveScan(models.Model):
    face_label = models.CharField(max_length=50)
    confidence = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=20)  # SCANNING / MATCH / UNKNOWN
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.face_label} - {self.status}"
    
class RecognitionLog(models.Model):
    investigator = models.ForeignKey(
        "investigator_module.Investigator", on_delete=models.SET_NULL, null=True, blank=True
    )
    criminal = models.ForeignKey(
        Criminal, on_delete=models.SET_NULL, null=True, blank=True
    )
    face_label = models.CharField(max_length=50)
    confidence = models.FloatField()
    detected_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.face_label} - {self.detected_at}"


class AlertLog(models.Model):
    investigator = models.ForeignKey(
        "investigator_module.Investigator", on_delete=models.SET_NULL, null=True, blank=True
    )
    criminal = models.ForeignKey(
        Criminal, on_delete=models.SET_NULL, null=True, blank=True
    )
    crime_type = models.CharField(max_length=100)
    risk_level = models.CharField(max_length=20)
    confidence = models.FloatField()
    message = models.TextField()
    snapshot = models.ImageField(upload_to="alert_snapshots/", null=True, blank=True)
    triggered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.risk_level} alert - {self.triggered_at}"
