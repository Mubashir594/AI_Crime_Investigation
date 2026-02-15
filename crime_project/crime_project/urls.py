from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('', lambda request: HttpResponse(
        "New Investigator Dashboard will be loaded here (React Frontend)"
    )),
    path('admin/', admin.site.urls),
    path('investigator/', include('investigator_module.urls')),
    path("api/", include("api.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
