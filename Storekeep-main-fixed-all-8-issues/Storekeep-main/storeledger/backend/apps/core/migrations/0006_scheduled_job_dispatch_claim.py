from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_saleitem_unit_price_precision"),
    ]

    operations = [
        migrations.AlterField(
            model_name="scheduledjobrun",
            name="status",
            field=models.CharField(
                choices=[
                    ("queued", "Queued"),
                    ("started", "Started"),
                    ("completed", "Completed"),
                    ("failed", "Failed"),
                ],
                default="queued",
                max_length=20,
            ),
        ),
    ]
