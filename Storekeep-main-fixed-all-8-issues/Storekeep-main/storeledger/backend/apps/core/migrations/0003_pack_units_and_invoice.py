from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_party_company_payment_direction_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="pieces_per_unit",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Number of individual pieces contained in one sellable stock unit or pack.",
                validators=[MinValueValidator(1)],
            ),
        ),
        migrations.AddField(
            model_name="saleitem",
            name="pieces_per_unit",
            field=models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)]),
        ),
        migrations.AddField(
            model_name="purchaseitem",
            name="pieces_per_unit",
            field=models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)]),
        ),
    ]
