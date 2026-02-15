import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("investigator_module", "0001_initial"),
        ("crime_database", "0004_alertlog_recognitionlog"),
    ]

    operations = [
        migrations.AddField(
            model_name="alertlog",
            name="investigator",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="investigator_module.investigator",
            ),
        ),
        migrations.AddField(
            model_name="recognitionlog",
            name="investigator",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="investigator_module.investigator",
            ),
        ),
    ]
