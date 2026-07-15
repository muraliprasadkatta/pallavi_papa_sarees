from decimal import Decimal, ROUND_HALF_UP
import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.functions import Lower
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
    TOP_SHOWCASE_MAX_SIZE_KB,
    TOP_SHOWCASE_TARGET_HEIGHT,
    TOP_SHOWCASE_TARGET_WIDTH,
    convert_product_image_to_webp,
    convert_sub_product_image_to_webp,
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


def product_top_showcase_image_upload_to(instance, filename):
    return _product_image_path("top_showcase", filename)


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


class OwnerHomePageRow(models.Model):
    class DisplayAfter(models.TextChoices):
        SHOP_BY_COLLECTION = "shop_by_collection", "After Shop by Collection"
        POPULAR_ITEMS = "popular_items", "After Popular Items"
        SHOP_BY_PRICE = "shop_by_price", "After Shop by Price"
        NEW_ARRIVALS = "new_arrivals", "After New Arrivals"
        TOP_SALE_PRODUCTS = "top_sale_products", "After Top Sale Products"
        SPECIAL_OFFERS = "special_offers", "After Special Offers"

    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=100, unique=True)
    subtitle = models.CharField(max_length=160, blank=True)
    display_after = models.CharField(
        max_length=40,
        choices=DisplayAfter.choices,
        default=DisplayAfter.NEW_ARRIVALS,
        db_index=True,
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name = "Owner Home Page Row"
        verbose_name_plural = "Owner Home Page Rows"

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=140)

    merchant_sku = models.CharField(
        max_length=32,
        unique=True,
        blank=True,
        null=True,
        db_index=True,
        help_text=(
            "Stable Google Merchant / product feed ID. "
            "Example: PPS00001. Do not change this after the product is listed."
        ),
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        null=True,
        blank=True,
    )

    home_rows = models.ManyToManyField(
        OwnerHomePageRow,
        blank=True,
        related_name="products",
    )

    material = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)

    color_name = models.CharField(max_length=80, blank=True)
    color_code = models.CharField(max_length=20, blank=True)

    product_size = models.CharField(
        max_length=80,
        blank=True,
        help_text="Example: Free Size, 38, M, 30, 4-5Y.",
    )

    stock_quantity = models.PositiveIntegerField(
        default=1,
        help_text="Number of pieces available.",
    )

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

    top_showcase_image = models.ImageField(
        upload_to=product_top_showcase_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
        help_text="Optional image for homepage top carousel. If empty, main image can be used.",
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

    # Homepage top carousel flags
    is_top_selling = models.BooleanField(default=False)
    is_most_liked = models.BooleanField(default=False)
    is_most_carted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    IMAGE_FIELDS = (
        "main_image",
        "arrival_card_image",
        "top_showcase_image",
        "sub_image_1",
        "sub_image_2",
        "sub_image_3",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category", "is_available", "-created_at"]),
            models.Index(fields=["is_new_arrival", "is_available", "-created_at"]),
            models.Index(fields=["is_top_selling", "is_available", "-created_at"]),
            models.Index(fields=["is_most_liked", "is_available", "-created_at"]),
            models.Index(fields=["is_most_carted", "is_available", "-created_at"]),
            models.Index(fields=["product_size", "is_available"]),
        ]

    @property
    def has_offer(self):
        return bool(
            self.offer_price
            and self.actual_price
            and self.offer_price < self.actual_price
        )

    @property
    def discount_percentage(self):
        if not self.actual_price or not self.offer_price:
            return 0

        actual_price = Decimal(str(self.actual_price))
        offer_price = Decimal(str(self.offer_price))

        if actual_price <= 0 or offer_price >= actual_price:
            return 0

        discount = ((actual_price - offer_price) * Decimal("100")) / actual_price

        return int(discount.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    @staticmethod
    def normalize_merchant_sku(value):
        value = (value or "").strip().upper()
        value = re.sub(r"\s+", "-", value)

        if not value:
            return None

        if not re.fullmatch(r"[A-Z0-9][A-Z0-9_-]{2,31}", value):
            raise ValidationError(
                "Merchant SKU should be 3-32 characters and use only letters, "
                "numbers, hyphen or underscore. Example: PPS00001."
            )

        return value

    def _generate_merchant_sku(self):
        return f"PPS{self.pk:05d}"

    def clean(self):
        super().clean()

        self.merchant_sku = self.normalize_merchant_sku(self.merchant_sku)

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
        self.merchant_sku = self.normalize_merchant_sku(self.merchant_sku)

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

                    elif field_name == "top_showcase_image":
                        converted_image = convert_product_image_to_webp(
                            uploaded_file=image,
                            base_name=f"{self.name}-{field_name}",
                            target_width=TOP_SHOWCASE_TARGET_WIDTH,
                            target_height=TOP_SHOWCASE_TARGET_HEIGHT,
                            max_size_kb=TOP_SHOWCASE_MAX_SIZE_KB,
                            keep_alpha=False,
                        )

                    elif field_name in {"sub_image_1", "sub_image_2", "sub_image_3"}:
                        converted_image = convert_sub_product_image_to_webp(
                            uploaded_file=image,
                            base_name=f"{self.name}-{field_name}",
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

        if not self.merchant_sku and self.pk:
            merchant_sku = self._generate_merchant_sku()
            type(self).objects.filter(
                pk=self.pk,
                merchant_sku__isnull=True,
            ).update(merchant_sku=merchant_sku)
            self.merchant_sku = merchant_sku

    def __str__(self):
        return self.name

    @property
    def has_sizes(self):
        """
        True when the owner configured one or more separate size cards.

        The old product_size text field is intentionally kept for existing
        products. New products can use the ProductSize rows below.
        """
        return self.sizes.exists()

    @property
    def display_sizes(self):
        """Sizes that should be shown on the product page.

        Stock 0 sizes are intentionally included so the UI can show them
        as Sold Out instead of hiding them.
        """
        return self.sizes.filter(is_available=True).order_by("sort_order", "id")

    @property
    def available_sizes(self):
        """Backward-compatible in-stock size list."""
        return self.display_sizes.filter(stock_quantity__gt=0)

    @property
    def is_sold_out(self):
        """True when the product is visible but cannot be purchased.

        `is_available` controls publish/show/hide. Stock controls Sold Out.
        For products with dynamic sizes, only visible size rows count as
        customer-buyable stock.
        """
        if not self.pk:
            return self.stock_quantity <= 0

        prefetched_sizes = getattr(self, "display_sizes_for_detail", None)

        if prefetched_sizes is not None:
            visible_sizes = list(prefetched_sizes)

            if visible_sizes:
                return not any(size.stock_quantity > 0 for size in visible_sizes)

            return self.stock_quantity <= 0

        visible_sizes = self.sizes.filter(is_available=True)

        if visible_sizes.exists():
            return not visible_sizes.filter(stock_quantity__gt=0).exists()

        return self.stock_quantity <= 0

    def _get_card_color_options(self):
        """Color swatches used on product cards.

        The card should only show a color row when the product actually has
        available variants. When variants exist, include the base product color
        first and then the variant colors so customers can understand that more
        color options are available before opening the product detail page.
        """
        cached_options = getattr(self, "_card_color_options_cache", None)

        if cached_options is not None:
            return cached_options

        prefetched_variants = getattr(self, "card_available_variants", None)

        if prefetched_variants is None:
            if not self.pk:
                variants = []
            else:
                variants = self.variants.filter(is_available=True).only(
                    "id",
                    "product_id",
                    "color_name",
                    "color_code",
                ).order_by("id")
        else:
            variants = prefetched_variants

        variants = list(variants)

        if not variants:
            self._card_color_options_cache = []
            return self._card_color_options_cache

        color_options = []
        seen = set()

        def add_color(name, code):
            name = (name or "").strip()
            code = (code or "").strip()

            if not name and not code:
                return

            dedupe_key = (code or name).lower()

            if dedupe_key in seen:
                return

            seen.add(dedupe_key)
            color_options.append({
                "name": name or "Available color",
                "code": code or "#8f1731",
            })

        add_color(self.color_name, self.color_code)

        for variant in variants:
            add_color(variant.color_name, variant.color_code)

        self._card_color_options_cache = color_options
        return self._card_color_options_cache

    @property
    def card_preview_colors(self):
        return self._get_card_color_options()[:3]

    @property
    def card_more_colors_count(self):
        return max(len(self._get_card_color_options()) - 3, 0)

    @property
    def is_in_stock(self):
        return not self.is_sold_out


class ProductHighlight(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="highlights",
    )

    label = models.CharField(max_length=80)
    value = models.CharField(max_length=180)
    sort_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["product", "sort_order"]),
        ]

    def save(self, *args, **kwargs):
        self.label = (self.label or "").strip()
        self.value = (self.value or "").strip()

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} - {self.label}: {self.value}"


class ProductSize(models.Model):
    class MeasurementUnit(models.TextChoices):
        INCHES = "in", "Inches"
        CENTIMETERS = "cm", "Centimeters"

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="sizes",
    )

    size_name = models.CharField(
        max_length=40,
        help_text="Example: S, M, L, XL, 28, 32, Free Size.",
    )

    stock_quantity = models.PositiveIntegerField(
        default=0,
        help_text="Number of pieces available in this size.",
    )

    measurement_unit = models.CharField(
        max_length=2,
        choices=MeasurementUnit.choices,
        default=MeasurementUnit.INCHES,
    )

    chest = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Optional chest measurement for this size.",
    )

    waist = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Optional waist measurement for this size.",
    )

    length = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Optional product length for this size.",
    )

    is_available = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("size_name"),
                "product",
                name="unique_product_size_name_ci",
            ),
        ]
        indexes = [
            models.Index(fields=["product", "is_available", "sort_order"]),
            models.Index(fields=["size_name"]),
        ]

    def clean(self):
        super().clean()

        self.size_name = " ".join((self.size_name or "").split())

        if not self.size_name:
            raise ValidationError({"size_name": "Size name is required."})

        product_id = getattr(self, "product_id", None)

        if not product_id:
            return

        duplicate_size = ProductSize.objects.filter(
            product_id=product_id,
            size_name__iexact=self.size_name,
        )

        if self.pk:
            duplicate_size = duplicate_size.exclude(pk=self.pk)

        if duplicate_size.exists():
            raise ValidationError(
                {"size_name": "This size is already added for the product."}
            )

    @classmethod
    def sync_product_stock(cls, product_id):
        if not product_id:
            return

        total_stock = (
            cls.objects
            .filter(product_id=product_id)
            .aggregate(total_stock=models.Sum("stock_quantity"))
            .get("total_stock")
            or 0
        )

        Product.objects.filter(pk=product_id).update(
            stock_quantity=total_stock,
        )

    def save(self, *args, **kwargs):
        skip_product_stock_sync = kwargs.pop("skip_product_stock_sync", False)

        self.size_name = " ".join((self.size_name or "").split())

        self.full_clean()
        super().save(*args, **kwargs)

        if not skip_product_stock_sync:
            self.sync_product_stock(self.product_id)

    def delete(self, *args, **kwargs):
        product_id = self.product_id
        result = super().delete(*args, **kwargs)
        self.sync_product_stock(product_id)
        return result

    def __str__(self):
        product_name = "Product"

        try:
            if self.product_id and self.product:
                product_name = self.product.name
        except Product.DoesNotExist:
            pass

        return f"{product_name} - {self.size_name}"


class ProductSizeMeasurement(models.Model):
    """
    Flexible measurements added inside an individual size card.

    Chest, waist and length are first-class ProductSize fields because they
    are common. This model stores optional custom inputs such as shoulder,
    sleeve length, hip, inseam, rise, or any future measurement.
    """

    product_size = models.ForeignKey(
        ProductSize,
        on_delete=models.CASCADE,
        related_name="custom_measurements",
    )

    label = models.CharField(
        max_length=60,
        help_text="Example: Shoulder, Sleeve Length, Hip, Inseam.",
    )

    value = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    unit = models.CharField(
        max_length=2,
        choices=ProductSize.MeasurementUnit.choices,
        default=ProductSize.MeasurementUnit.INCHES,
    )

    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("label"),
                "product_size",
                name="unique_product_size_measurement_label_ci",
            ),
        ]
        indexes = [
            models.Index(fields=["product_size", "sort_order"]),
        ]

    def clean(self):
        super().clean()

        self.label = " ".join((self.label or "").split())

        if not self.label:
            raise ValidationError({"label": "Measurement label is required."})

        product_size_id = getattr(self, "product_size_id", None)

        if not product_size_id:
            return

        duplicate_measurement = ProductSizeMeasurement.objects.filter(
            product_size_id=product_size_id,
            label__iexact=self.label,
        )

        if self.pk:
            duplicate_measurement = duplicate_measurement.exclude(pk=self.pk)

        if duplicate_measurement.exists():
            raise ValidationError(
                {
                    "label": (
                        "This custom measurement is already added "
                        "for the selected size."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.label = " ".join((self.label or "").split())
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        product_name = "Product"
        size_name = "Size"

        try:
            if self.product_size_id and self.product_size:
                size_name = self.product_size.size_name
                product_name = self.product_size.product.name
        except ProductSize.DoesNotExist:
            pass

        return f"{product_name} - {size_name} - {self.label}: {self.value} {self.unit}"


class ProductVariant(models.Model):
    IMAGE_FIELDS = (
        "variant_image",
        "variant_sub_image_1",
        "variant_sub_image_2",
        "variant_sub_image_3",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="variants",
    )

    color_name = models.CharField(
        max_length=80,
        blank=True,
    )

    color_code = models.CharField(
        max_length=20,
        blank=True,
    )

    # Main image for this colour variant
    variant_image = models.ImageField(
        upload_to=product_variant_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
    )

    # Optional additional images for this colour variant
    variant_sub_image_1 = models.ImageField(
        upload_to=product_variant_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
    )

    variant_sub_image_2 = models.ImageField(
        upload_to=product_variant_image_upload_to,
        blank=True,
        null=True,
        max_length=255,
    )

    variant_sub_image_3 = models.ImageField(
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

    @property
    def has_offer(self):
        return bool(
            self.offer_price
            and self.actual_price
            and self.offer_price < self.actual_price
        )

    @property
    def discount_percentage(self):
        if not self.actual_price or not self.offer_price:
            return 0

        actual_price = Decimal(str(self.actual_price))
        offer_price = Decimal(str(self.offer_price))

        if actual_price <= 0 or offer_price >= actual_price:
            return 0

        discount = (
            (actual_price - offer_price) * Decimal("100")
        ) / actual_price

        return int(
            discount.quantize(
                Decimal("1"),
                rounding=ROUND_HALF_UP,
            )
        )

    @property
    def gallery_images(self):
        """
        Returns only the images belonging to this variant.

        Example:
        [
            variant main image,
            variant sub image 1,
            variant sub image 2,
            variant sub image 3,
        ]
        """
        images = []

        for field_name in self.IMAGE_FIELDS:
            image = getattr(self, field_name, None)

            if image:
                images.append(image)

        return images

    def clean(self):
        super().clean()

        errors = {}

        if (
            self.actual_price
            and self.offer_price
            and self.offer_price > self.actual_price
        ):
            errors["offer_price"] = (
                "Variant offer price cannot be greater than actual price."
            )

        # Sub-images should be uploaded in sequence.
        if self.variant_sub_image_2 and not self.variant_sub_image_1:
            errors["variant_sub_image_2"] = (
                "Upload Variant Sub Image 1 before Variant Sub Image 2."
            )

        if self.variant_sub_image_3 and not self.variant_sub_image_2:
            errors["variant_sub_image_3"] = (
                "Upload Variant Sub Image 2 before Variant Sub Image 3."
            )

        if errors:
            raise ValidationError(errors)

    def _get_changed_image_fields(self):
        """
        Returns image field names that contain a newly uploaded
        or replaced image.

        Existing Cloudinary/storage images will not be converted again.
        """
        if not self.pk:
            return [
                field_name
                for field_name in self.IMAGE_FIELDS
                if getattr(self, field_name, None)
            ]

        old_variant = (
            type(self)
            .objects
            .only(*self.IMAGE_FIELDS)
            .filter(pk=self.pk)
            .first()
        )

        if not old_variant:
            return [
                field_name
                for field_name in self.IMAGE_FIELDS
                if getattr(self, field_name, None)
            ]

        changed_fields = []

        for field_name in self.IMAGE_FIELDS:
            current_image = getattr(self, field_name, None)
            old_image = getattr(old_variant, field_name, None)

            if not current_image:
                continue

            current_name = getattr(current_image, "name", "")
            old_name = getattr(old_image, "name", "")

            # Newly assigned files normally have _committed=False.
            is_new_upload = not getattr(
                current_image,
                "_committed",
                True,
            )

            if is_new_upload or current_name != old_name:
                changed_fields.append(field_name)

        return changed_fields

    def save(self, *args, **kwargs):
        changed_image_fields = self._get_changed_image_fields()

        update_fields = kwargs.get("update_fields")

        if update_fields is not None:
            update_fields = set(update_fields)

        for field_name in changed_image_fields:
            # Respect save(update_fields=[...]) when it is used.
            if (
                update_fields is not None
                and field_name not in update_fields
            ):
                continue

            uploaded_image = getattr(self, field_name, None)

            if not uploaded_image:
                continue

            image_label = field_name.replace("variant_", "").replace("_", "-")

            base_name = (
                f"{self.product.name}-"
                f"{self.color_name or 'variant'}-"
                f"{image_label}"
            )

            if field_name in {
                "variant_sub_image_1",
                "variant_sub_image_2",
                "variant_sub_image_3",
            }:
                converted_image = convert_sub_product_image_to_webp(
                    uploaded_file=uploaded_image,
                    base_name=base_name,
                )
            else:
                converted_image = convert_product_image_to_webp(
                    uploaded_file=uploaded_image,
                    base_name=base_name,
                    target_width=PRODUCT_TARGET_WIDTH,
                    target_height=PRODUCT_TARGET_HEIGHT,
                    max_size_kb=PRODUCT_MAX_SIZE_KB,
                    keep_alpha=False,
                )

            setattr(
                self,
                field_name,
                converted_image,
            )

            if update_fields is not None:
                update_fields.add(field_name)

        if update_fields is not None:
            kwargs["update_fields"] = list(update_fields)

        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.product.name} - "
            f"{self.color_name or 'Variant'}"
        )