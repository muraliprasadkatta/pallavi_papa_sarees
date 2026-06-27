# Generated for Google Merchant Center stable product IDs.

from django.db import migrations, models


def backfill_merchant_skus(apps, schema_editor):
    Product = apps.get_model("store", "Product")

    for product in Product.objects.order_by("id"):
        if product.merchant_sku:
            continue

        base_sku = f"PPS{product.id:05d}"
        merchant_sku = base_sku
        counter = 2

        while Product.objects.filter(merchant_sku=merchant_sku).exclude(pk=product.pk).exists():
            merchant_sku = f"{base_sku}-{counter}"
            counter += 1

        product.merchant_sku = merchant_sku
        product.save(update_fields=["merchant_sku"])


def clear_merchant_skus(apps, schema_editor):
    Product = apps.get_model("store", "Product")
    Product.objects.update(merchant_sku=None)


class Migration(migrations.Migration):

    dependencies = [
        ("store", "0013_productsize_productsizemeasurement_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="merchant_sku",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text=(
                    "Stable Google Merchant / product feed ID. Example: PPS00001. "
                    "Do not change this after the product is listed."
                ),
                max_length=32,
                null=True,
                unique=True,
            ),
        ),
        migrations.RunPython(backfill_merchant_skus, clear_merchant_skus),
    ]
