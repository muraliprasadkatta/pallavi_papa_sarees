from django.db import models
from django.core.exceptions import ValidationError

from store.services.product_image_service import convert_product_image_to_webp


class Product(models.Model):
    CATEGORY_PATTU = "pattu"
    CATEGORY_COTTON = "cotton"
    CATEGORY_SILK = "silk"
    CATEGORY_DESIGNER = "designer"
    CATEGORY_WEDDING = "wedding"
    CATEGORY_DAILY = "daily"

    CATEGORY_CHOICES = [
        (CATEGORY_PATTU, "Pattu Sarees"),
        (CATEGORY_COTTON, "Cotton Sarees"),
        (CATEGORY_SILK, "Silk Sarees"),
        (CATEGORY_DESIGNER, "Designer Sarees"),
        (CATEGORY_WEDDING, "Wedding Sarees"),
        (CATEGORY_DAILY, "Daily Wear Sarees"),
    ]

    name = models.CharField(max_length=140)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)

    material = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)

    actual_price = models.DecimalField(max_digits=10, decimal_places=2)
    offer_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

    main_image = models.ImageField(upload_to="products/main/")
    sub_image_1 = models.ImageField(upload_to="products/sub/", blank=True, null=True)
    sub_image_2 = models.ImageField(upload_to="products/sub/", blank=True, null=True)
    sub_image_3 = models.ImageField(upload_to="products/sub/", blank=True, null=True)

    is_available = models.BooleanField(default=True)
    is_new_arrival = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    IMAGE_FIELDS = (
        "main_image",
        "sub_image_1",
        "sub_image_2",
        "sub_image_3",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category", "is_available", "-created_at"]),
            models.Index(fields=["is_new_arrival", "is_available", "-created_at"]),
        ]

    def clean(self):
        if self.offer_price and self.offer_price > self.actual_price:
            raise ValidationError("Offer price cannot be greater than actual price.")

    def _image_changed(self, field_name):
        image = getattr(self, field_name)

        if not image:
            return False

        # New product: convert uploaded image.
        if not self.pk:
            return True

        # Existing product: convert only if this image field changed.
        old_product = type(self).objects.only(field_name).filter(pk=self.pk).first()

        if not old_product:
            return True

        old_image = getattr(old_product, field_name)

        return old_image.name != image.name

    def save(self, *args, **kwargs):
        for field_name in self.IMAGE_FIELDS:
            if self._image_changed(field_name):
                image = getattr(self, field_name)

                if image:
                    converted_image = convert_product_image_to_webp(
                        uploaded_file=image,
                        base_name=f"{self.name}-{field_name}",
                    )
                    setattr(self, field_name, converted_image)

        super().save(*args, **kwargs)

    def __str__(self):
        return self.name