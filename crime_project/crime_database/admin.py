from django.contrib import admin
from django.utils.html import format_html
from .models import Criminal, CrimeRecord, Evidence

admin.site.site_header = "Crime Intelligence Unit – Admin Panel"
admin.site.site_title = "Crime Intelligence Admin"
admin.site.index_title = "Authorized Administration Access"


@admin.register(Criminal)
class CriminalAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'crime_type', 'photo_preview', 'created_at')
    search_fields = ('name', 'crime_type')
    list_filter = ('crime_type', 'gender')
    readonly_fields = ('photo_preview',)
    ordering = ('-created_at',)

    def photo_preview(self, obj):
        if obj.photo:
            return format_html(
                '<img src="{}" width="60" style="border-radius:6px;" />',
                obj.photo.url
            )
        return "No Image"

    photo_preview.short_description = "Photo"


@admin.register(CrimeRecord)
class CrimeRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'criminal', 'crime_type', 'crime_location', 'crime_date')
    search_fields = ('criminal__name', 'crime_type', 'crime_location')
    list_filter = ('crime_type', 'crime_date')


@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = ('id', 'crime_record', 'uploaded_at')
    list_filter = ('uploaded_at',)
