from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify

from store.services.product_image_service import (
    ARRIVAL_CARD_MAX_SIZE_KB,
    ARRIVAL_CARD_TARGET_HEIGHT,
    ARRIVAL_CARD_TARGET_WIDTH,
    CATEGORY_MAX_SIZE_KB,
    CATEGORY_TARGET_HEIGHT,
    CATEGORY_TARGET_WIDTH,
    PRODUCT_MAX_SIZE_KB,
    PRODUCT_TARGET_HEIGHT,
    PRODUCT_TARGET_WIDTH,
    convert_product_image_to_webp,
)


def _base_upload_path(folder, filename):
    upload_folder = getattr(settings, "CLOUDINARY_UPLOAD_FOLDER", "local")
    return f"pallavi_papa_sarees/{upload_folder}/{folder}/{filename}"


def _product_image_path(folder, filename):
    upload_folder = getattr(settings, "CLOUDINARY_UPLOAD_FOLDER", "local")
    return f"pallavi_papa_sarees/{upload_folder}/products/{folder}/{filename}"


def category_image_upload_to(instance, filename):
    return _base_upload_path("categories", filename)


def product_main_image_upload_to(instance, filename):
    return _product_image_path("main", filename)


def product_arrival_card_image_upload_to(instance, filename):
    return _product_image_path("arrival", filename)


def product_sub_image_upload_to(instance, filename):
    return _product_image_path("sub", filename)


def product_variant_image_upload_to(instance, filename):
    return _product_image_path("variants", filename)


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)

    image = models.ImageField(
        upload_to=category_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
    )

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "name"]
        indexes = [
            models.Index(fields=["slug", "is_active"]),
            models.Index(fields=["is_active", "sort_order"]),
        ]

    def _generate_unique_slug(self):
        base_slug = slugify(self.name) or "category"
        slug = base_slug
        counter = 2

        while Category.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug

    def _image_changed(self):
        if not self.image:
            return False

        if not self.pk:
            return True

        old_category = type(self).objects.only("image").filter(pk=self.pk).first()

        if not old_category:
            return True

        old_image = old_category.image

        return old_image.name != self.image.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()

        if self._image_changed():
            converted_image = convert_product_image_to_webp(
                uploaded_file=self.image,
                base_name=f"{self.name}-category-image",
                target_width=CATEGORY_TARGET_WIDTH,
                target_height=CATEGORY_TARGET_HEIGHT,
                max_size_kb=CATEGORY_MAX_SIZE_KB,
                keep_alpha=False,
            )

            self.image = converted_image

        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=140)

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        null=True,
        blank=True,
    )

    material = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)

    color_name = models.CharField(max_length=80, blank=True)
    color_code = models.CharField(max_length=20, blank=True)

    actual_price = models.DecimalField(max_digits=10, decimal_places=2)

    offer_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
    )

    main_image = models.ImageField(
        upload_to=product_main_image_upload_to,
        max_length=255,
    )

    arrival_card_image = models.ImageField(
        upload_to=product_arrival_card_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
    )

    sub_image_1 = models.ImageField(
        upload_to=product_sub_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
    )

    sub_image_2 = models.ImageField(
        upload_to=product_sub_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
    )

    sub_image_3 = models.ImageField(
        upload_to=product_sub_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
    )

    is_available = models.BooleanField(default=True)
    is_new_arrival = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    IMAGE_FIELDS = (
        "main_image",
        "arrival_card_image",
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
        super().clean()

        if self.offer_price and self.offer_price > self.actual_price:
            raise ValidationError("Offer price cannot be greater than actual price.")

    def _image_changed(self, field_name):
        image = getattr(self, field_name)

        if not image:
            return False

        if not self.pk:
            return True

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
                    if field_name == "arrival_card_image":
                        converted_image = convert_product_image_to_webp(
                            uploaded_file=image,
                            base_name=f"{self.name}-{field_name}",
                            target_width=ARRIVAL_CARD_TARGET_WIDTH,
                            target_height=ARRIVAL_CARD_TARGET_HEIGHT,
                            max_size_kb=ARRIVAL_CARD_MAX_SIZE_KB,
                            keep_alpha=True,
                        )
                    else:
                        converted_image = convert_product_image_to_webp(
                            uploaded_file=image,
                            base_name=f"{self.name}-{field_name}",
                            target_width=PRODUCT_TARGET_WIDTH,
                            target_height=PRODUCT_TARGET_HEIGHT,
                            max_size_kb=PRODUCT_MAX_SIZE_KB,
                            keep_alpha=False,
                        )

                    setattr(self, field_name, converted_image)

        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ProductVariant(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="variants",
    )

    color_name = models.CharField(max_length=80, blank=True)
    color_code = models.CharField(max_length=20, blank=True)

    variant_image = models.ImageField(
        upload_to=product_variant_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
    )

    actual_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
    )

    offer_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
    )

    is_available = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["product", "is_available"]),
            models.Index(fields=["color_name"]),
        ]

    def clean(self):
        super().clean()

        if self.actual_price and self.offer_price and self.offer_price > self.actual_price:
            raise ValidationError("Variant offer price cannot be greater than actual price.")

    def _image_changed(self):
        if not self.variant_image:
            return False

        if not self.pk:
            return True

        old_variant = type(self).objects.only("variant_image").filter(pk=self.pk).first()

        if not old_variant:
            return True

        return old_variant.variant_image.name != self.variant_image.name

    def save(self, *args, **kwargs):
        if self._image_changed():
            converted_image = convert_product_image_to_webp(
                uploaded_file=self.variant_image,
                base_name=f"{self.product.name}-{self.color_name or 'variant'}",
                target_width=PRODUCT_TARGET_WIDTH,
                target_height=PRODUCT_TARGET_HEIGHT,
                max_size_kb=PRODUCT_MAX_SIZE_KB,
                keep_alpha=False,
            )

            self.variant_image = converted_image

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} - {self.color_name or 'Variant'}"