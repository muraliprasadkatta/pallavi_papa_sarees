from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0011_product_home_rows"),
    ]

    operations = [
        migrations.AddField(
            model_name="ownerhomepagerow",
            name="display_after",
            field=models.CharField(
                choices=[
                    ("shop_by_collection", "After Shop by Collection"),
                    ("popular_items", "After Popular Items"),
                    ("shop_by_price", "After Shop by Price"),
                    ("new_arrivals", "After New Arrivals"),
                    ("top_sale_products", "After Top Sale Products"),
                    ("special_offers", "After Special Offers"),
                ],
                db_index=True,
                default="new_arrivals",
                max_length=40,
            ),
        ),
    ]
