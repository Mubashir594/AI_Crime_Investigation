from django.urls import path
from . import views

app_name = "investigator"   # ✅ Namespace for safety

urlpatterns = [

    # ===========================
    # Investigator Authentication
    # ===========================
    path("login/", views.investigator_login, name="login"),
    path("logout/", views.investigator_logout, name="logout"),

    # ===========================
    # Investigator Pages (Protected)
    # ===========================
    path("", views.home, name="home"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("upload/", views.upload_evidence, name="upload"),
    path("live/", views.live_monitoring, name="live"),
]
