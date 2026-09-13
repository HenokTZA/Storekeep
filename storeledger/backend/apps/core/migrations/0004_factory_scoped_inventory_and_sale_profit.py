from decimal import Decimal, ROUND_HALF_UP

import django.db.models.deletion
from django.core.validators import MinValueValidator
from django.db import migrations, models


def money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def backfill_factories_and_sale_costs(apps, schema_editor):
    Store = apps.get_model("core", "Store")
    Party = apps.get_model("core", "Party")
    Product = apps.get_model("core", "Product")
    SaleItem = apps.get_model("core", "SaleItem")
    PurchaseItem = apps.get_model("core", "PurchaseItem")
    StockMovement = apps.get_model("core", "StockMovement")

    for store in Store.objects.all().iterator():
        factories = {}
        for name in ("FF", "TT", "ID"):
            factory, _ = Party.objects.get_or_create(
                store_id=store.id,
                party_type="factory",
                name=name,
                defaults={"phone": "", "sms_enabled": False},
            )
            factories[name.casefold()] = factory

        legacy_factory = None
        used_product_names = set()
        for product in Product.objects.filter(store_id=store.id).order_by("id").iterator():
            supplied_by = (product.supplier or "").strip()
            factory = factories.get(supplied_by.casefold())
            if factory is None and supplied_by:
                factory, _ = Party.objects.get_or_create(
                    store_id=store.id,
                    party_type="factory",
                    name=supplied_by,
                    defaults={"phone": "", "sms_enabled": False},
                )
                factories[supplied_by.casefold()] = factory
            if factory is None:
                if legacy_factory is None:
                    legacy_factory, _ = Party.objects.get_or_create(
                        store_id=store.id,
                        party_type="factory",
                        name="Legacy Factory",
                        defaults={"phone": "", "sms_enabled": False},
                    )
                factory = legacy_factory
            product.factory_id = factory.id
            identity = (factory.id, product.name)
            if identity in used_product_names:
                suffix = (product.sku or str(product.id)).strip()
                product.name = f"{product.name[: max(1, 177 - len(suffix))]} · {suffix}"[:180]
                identity = (factory.id, product.name)
            used_product_names.add(identity)
            product.save(update_fields=["factory", "name"])

    for item in SaleItem.objects.select_related("product__factory").all().iterator():
        item.factory_name = item.product.factory.name
        item.unit_cost = money(item.product.purchase_price)
        item.line_cost = money(item.quantity * item.pieces_per_unit * item.unit_cost)
        item.gross_profit = money(item.line_total - item.line_cost)
        item.save(update_fields=["factory_name", "unit_cost", "line_cost", "gross_profit"])

    for item in PurchaseItem.objects.select_related("product__factory").all().iterator():
        item.factory_name = item.product.factory.name
        item.save(update_fields=["factory_name"])

    for movement in StockMovement.objects.select_related("product__factory").all().iterator():
        movement.factory_name = movement.product.factory.name
        movement.save(update_fields=["factory_name"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_pack_units_and_invoice"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="party",
            name="unique_party_phone_per_type_store",
        ),
        migrations.AlterField(
            model_name="party",
            name="party_type",
            field=models.CharField(
                choices=[("trader", "Trader"), ("agent", "Agent"), ("factory", "Factory")],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="party",
            name="phone",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="product",
            name="factory",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="products",
                to="core.party",
            ),
        ),
        migrations.AddField(
            model_name="saleitem",
            name="factory_name",
            field=models.CharField(default="", max_length=180),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="saleitem",
            name="unit_cost",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=18),
        ),
        migrations.AddField(
            model_name="saleitem",
            name="line_cost",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=18),
        ),
        migrations.AddField(
            model_name="saleitem",
            name="gross_profit",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=18),
        ),
        migrations.AddField(
            model_name="purchaseitem",
            name="factory_name",
            field=models.CharField(default="", max_length=180),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="stockmovement",
            name="factory_name",
            field=models.CharField(default="", max_length=180),
            preserve_default=False,
        ),
        migrations.RunPython(backfill_factories_and_sale_costs, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="product",
            name="unique_product_sku_per_store",
        ),
        migrations.RemoveIndex(
            model_name="product",
            name="core_produc_store_i_130c11_idx",
        ),
        migrations.RemoveIndex(
            model_name="party",
            name="core_party_store_i_73bbb2_idx",
        ),
        migrations.RemoveField(
            model_name="product",
            name="category",
        ),
        migrations.DeleteModel(
            name="Category",
        ),
        migrations.RemoveField(
            model_name="product",
            name="sku",
        ),
        migrations.RemoveField(
            model_name="product",
            name="supplier",
        ),
        migrations.RemoveField(
            model_name="party",
            name="account_number",
        ),
        migrations.RemoveField(
            model_name="saleitem",
            name="sku",
        ),
        migrations.RemoveField(
            model_name="purchaseitem",
            name="sku",
        ),
        migrations.AlterField(
            model_name="product",
            name="factory",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="products",
                to="core.party",
            ),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["store", "factory", "name"], name="core_product_factory_name_idx"),
        ),
        migrations.AddConstraint(
            model_name="product",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_active=True),
                fields=("store", "factory", "name"),
                name="unique_product_name_per_factory",
            ),
        ),
        migrations.AddConstraint(
            model_name="party",
            constraint=models.UniqueConstraint(
                condition=~models.Q(phone=""),
                fields=("store", "party_type", "phone"),
                name="unique_party_phone_per_type_store",
            ),
        ),
        migrations.AddConstraint(
            model_name="party",
            constraint=models.UniqueConstraint(
                condition=models.Q(party_type="factory", is_active=True),
                fields=("store", "name"),
                name="unique_factory_name_per_store",
            ),
        ),
        migrations.AlterModelOptions(
            name="product",
            options={"ordering": ["factory__name", "name"]},
        ),
    ]
