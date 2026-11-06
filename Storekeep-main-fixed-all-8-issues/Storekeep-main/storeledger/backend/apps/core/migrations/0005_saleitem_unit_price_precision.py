from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0004_factory_scoped_inventory_and_sale_profit"),
    ]

    operations = [
        migrations.AlterField(
            model_name="saleitem",
            name="unit_price",
            field=models.DecimalField(
                decimal_places=8,
                max_digits=24,
                validators=[MinValueValidator(0)],
            ),
        ),
    ]
