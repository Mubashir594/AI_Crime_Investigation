from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("crime_database", "0005_recognitionlog_investigator_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="crimerecord",
            name="crime_type",
            field=models.CharField(default="Unknown", max_length=120),
        ),
    ]

