from django.urls import path
from . import views
from . import auth_views
from .webrtc import webrtc_offer


urlpatterns = [

    # =======================
    # BASIC & DASHBOARD
    # =======================
    path("test/", views.test_api),
    path("dashboard/status/", views.dashboard_status),
    path("system-health/", views.system_health),
    path("activity-radar/", views.activity_radar),
    path("detection-analytics/", views.detection_analytics),

    # =======================
    # AUTH APIs
    # =======================
    path("auth/login/", auth_views.investigator_login_api),
    path("auth/check/", auth_views.investigator_auth_check),
    path("auth/profile/", auth_views.investigator_profile_api),
    path("auth/logout/", auth_views.investigator_logout_api),
    path("admin/auth/login/", auth_views.admin_login_api),
    path("admin/auth/check/", auth_views.admin_auth_check),
    path("admin/auth/logout/", auth_views.admin_logout_api),
    path("admin/summary/", auth_views.admin_dashboard_summary),
    path("admin/investigators/", auth_views.admin_investigators),
    path("admin/investigators/<int:investigator_id>/", auth_views.admin_investigator_detail),
    path("admin/criminals/", auth_views.admin_criminals),
    path("admin/criminals/<int:criminal_id>/", auth_views.admin_criminal_detail),
    path("admin/crime-records/", auth_views.admin_crime_records),
    path("admin/crime-records/<int:record_id>/", auth_views.admin_crime_record_detail),
    path("admin/evidences/", auth_views.admin_evidences),
    path("admin/evidences/<int:evidence_id>/", auth_views.admin_evidence_detail),
    path("admin/retrain/", auth_views.admin_retrain_embeddings),

    # =======================
    # LIVE WEBCAM STREAM
    # (Webcam turns ON only when this is accessed)
    # =======================
    path("start-webcam/", views.start_webcam_api),
    path("video-feed/", views.video_feed),
    path("stop-webcam/", views.stop_webcam_api),

    # =======================
    # FACE RECOGNITION PIPELINE
    # =======================
    path("live-scan/", views.live_scan),
    path("recognition/", views.recognition_result),

    # =======================
    # LOGS & ALERTS
    # =======================
    path("logs/", views.recognition_log),
    path("alerts/", views.alert_feed),
    path("criminals/", views.criminal_list),

    # =======================
    # VIDEO UPLOAD
    # =======================
    path("video/upload/", views.upload_video_api),

    path("webrtc/offer/", webrtc_offer),

]
