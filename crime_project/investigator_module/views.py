from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.hashers import check_password
from .models import Investigator

# ---------------------------
# Investigator Authentication
# ---------------------------

def investigator_login(request):
    """
    Investigator login (UI only).
    Old dashboard is disabled.
    After login, redirect to home (React will handle dashboard).
    """
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")

        try:
            investigator = Investigator.objects.get(username=username)

            if not investigator.is_active:
                messages.error(request, "Your account is inactive.")
                return redirect("investigator:login")

            if check_password(password, investigator.password):
                # Store investigator info in session (keep for backend use)
                request.session["investigator_id"] = investigator.id
                request.session["investigator_name"] = investigator.full_name

                # 🔴 IMPORTANT CHANGE:
                # Do NOT redirect to old dashboard
                return redirect("/")   # temporary landing page
            else:
                messages.error(request, "Invalid password.")

        except Investigator.DoesNotExist:
            messages.error(request, "Invalid username.")

    return render(request, "investigator/login.html")


def investigator_logout(request):
    """
    Clear investigator session and logout.
    """
    request.session.flush()
    return redirect("investigator:login")


# ---------------------------
# Investigator Pages (OLD UI DISABLED)
# ---------------------------

def home(request):
    """
    Temporary landing page.
    React frontend will replace this.
    """
    return render(request, "home.html")


def dashboard(request):
    """
    OLD DASHBOARD — DISABLED.
    Kept only to avoid URL errors.
    """
    messages.warning(
        request,
        "Old dashboard has been disabled. Please use the new interface."
    )
    return redirect("/")


def upload_evidence(request):
    """
    OLD PAGE — DISABLED.
    Evidence upload will be handled via React + API.
    """
    messages.warning(
        request,
        "This page has been disabled. Use the new dashboard."
    )
    return redirect("/")


def live_monitoring(request):
    """
    OLD LIVE MONITORING — DISABLED.
    Webcam will be handled via API + React.
    """
    messages.warning(
        request,
        "Live monitoring moved to the new dashboard."
    )
    return redirect("/")
