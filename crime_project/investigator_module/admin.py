from django.contrib import admin
from .models import Investigator


@admin.register(Investigator)
class InvestigatorAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'full_name',
        'username',
        'badge_id',
        'department',
        'is_active',
        'created_at'
    )

    search_fields = (
        'full_name',
        'username',
        'badge_id',
        'department'
    )

    list_filter = (
        'department',
        'is_active'
    )

    ordering = ('-created_at',)
