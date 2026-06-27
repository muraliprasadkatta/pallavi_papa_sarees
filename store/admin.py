from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Category,
    OwnerHomePageRow,
    Product,
    ProductHighlight,
    ProductSize,
    ProductSizeMeasurement,
    ProductVariant,
)


class HiddenFromAdminIndexMixin:
    """
    Keep the model admin available for relation widgets/direct links,
    but hide it from the Django admin sidebar and app index.
    """

    def get_model_perms(self, request):
        return {}


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "slug",
        "is_active",
        "sort_order",
        "image_preview",
        "created_at",
    )

    list_filter = (
        "is_active",
        "created_at",
    )

    search_fields = (
        "name",
        "slug",
    )

    readonly_fields = (
        "slug",
        "image_preview",
        "created_at",
    )

    ordering = (
        "sort_order",
        "name",
    )

    fieldsets = (
        ("Category Details", {
            "fields": (
                "name",
                "slug",
                "image",
                "image_preview",
            )
        }),
        ("Status & Order", {
            "fields": (
                "is_active",
                "sort_order",
            )
        }),
        ("Timestamps", {
            "fields": (
                "created_at",
            )
        }),
    )

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="width:140px;height:100px;object-fit:cover;border-radius:10px;border:1px solid #ddd;" />',
                obj.image.url,
            )
        return "-"

    image_preview.short_description = "Category Image"


@admin.register(OwnerHomePageRow)
class OwnerHomePageRowAdmin(admin.ModelAdmin):
    """
    Show custom homepage rows in Django admin.

    Owner can quickly control where each custom row appears on the
    homepage using Display After + Sort Order.
    """

    list_display = (
        "id",
        "name",
        "display_after",
        "sort_order",
        "is_active",
        "subtitle",
        "slug",
        "created_at",
    )

    list_editable = (
        "display_after",
        "sort_order",
        "is_active",
    )

    list_filter = (
        "display_after",
        "is_active",
        "created_at",
    )

    search_fields = (
        "name",
        "slug",
        "subtitle",
    )

    readonly_fields = (
        "created_at",
    )

    prepopulated_fields = {
        "slug": ("name",),
    }

    ordering = (
        "display_after",
        "sort_order",
        "name",
    )

    list_per_page = 40

    fieldsets = (
        ("Home Row Details", {
            "fields": (
                "name",
                "slug",
                "subtitle",
            )
        }),
        ("Homepage Position", {
            "fields": (
                "display_after",
                "sort_order",
                "is_active",
            ),
            "description": (
                "Rows with the same Display After value are shown one below "
                "another by Sort Order. Lower number shows first."
            ),
        }),
        ("Timestamp", {
            "fields": (
                "created_at",
            )
        }),
    )


class ProductHighlightInline(admin.TabularInline):
    model = ProductHighlight
    extra = 1

    fields = (
        "label",
        "value",
        "sort_order",
    )


class ProductVariantInline(admin.StackedInline):
    model = ProductVariant
    extra = 0

    fieldsets = (
        ("Variant Details", {
            "fields": (
                "color_name",
                "color_code",
                "actual_price",
                "offer_price",
                "is_available",
            )
        }),
        ("Variant Image", {
            "fields": (
                "variant_image",
                "variant_image_preview",
            )
        }),
    )

    readonly_fields = (
        "variant_image_preview",
    )

    def variant_image_preview(self, obj):
        if obj.variant_image:
            return format_html(
                '<img src="{}" style="width:90px;height:115px;object-fit:cover;border-radius:8px;" />',
                obj.variant_image.url,
            )
        return "-"

    variant_image_preview.short_description = "Preview"


class ProductSizeInline(admin.StackedInline):
    model = ProductSize
    verbose_name = "Size"
    verbose_name_plural = "Sizes & stock"
    extra = 0
    show_change_link = True

    fieldsets = (
        ("Size & Stock", {
            "fields": (
                "size_name",
                "stock_quantity",
                "measurement_unit",
                "is_available",
                "sort_order",
            )
        }),
        ("Measurements", {
            "fields": (
                "chest",
                "waist",
                "length",
            )
        }),
    )

    ordering = (
        "sort_order",
        "id",
    )

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    inlines = [
        ProductHighlightInline,
        ProductSizeInline,
        ProductVariantInline,
    ]

    list_display = (
        "id",
        "merchant_sku",
        "name",
        "category",
        "color_name",
        "color_swatch",
        "sizes_summary",
        "stock_quantity",
        "actual_price",
        "offer_price",
        "is_available",
        "is_new_arrival",
        "is_top_selling",
        "is_most_liked",
        "is_most_carted",
        "main_image_preview",
        "created_at",
    )

    list_filter = (
        "category",
        "home_rows",
        "is_available",
        "is_new_arrival",
        "is_top_selling",
        "is_most_liked",
        "is_most_carted",
        "created_at",
    )

    search_fields = (
        "merchant_sku",
        "name",
        "category__name",
        "category__slug",
        "material",
        "color_name",
        "color_code",
        "product_size",
        "sizes__size_name",
        "sizes__custom_measurements__label",
        "home_rows__name",
    )

    readonly_fields = (
        "main_image_preview",
        "arrival_card_image_preview",
        "top_showcase_image_preview",
        "sub_image_1_preview",
        "sub_image_2_preview",
        "sub_image_3_preview",
        "created_at",
        "updated_at",
    )

    ordering = ("-created_at",)
    filter_horizontal = ("home_rows",)
    list_select_related = ("category",)
    list_per_page = 30

    fieldsets = (
        ("Product Details", {
            "fields": (
                "name",
                "merchant_sku",
                "category",
                "home_rows",
                "material",
                "description",
            )
        }),
        ("Size & Stock", {
            "fields": (
                "product_size",
                "stock_quantity",
            )
        }),
        ("Color", {
            "fields": (
                "color_name",
                "color_code",
            )
        }),
        ("Pricing", {
            "fields": (
                "actual_price",
                "offer_price",
            )
        }),
        ("Images", {
            "fields": (
                "main_image",
                "main_image_preview",
                "arrival_card_image",
                "arrival_card_image_preview",
                "top_showcase_image",
                "top_showcase_image_preview",
                "sub_image_1",
                "sub_image_1_preview",
                "sub_image_2",
                "sub_image_2_preview",
                "sub_image_3",
                "sub_image_3_preview",
            )
        }),
        ("Status", {
            "fields": (
                "is_available",
                "is_new_arrival",
                "is_top_selling",
                "is_most_liked",
                "is_most_carted",
            )
        }),
        ("Timestamps", {
            "fields": (
                "created_at",
                "updated_at",
            )
        }),
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("category")
            .prefetch_related("sizes")
        )

    def color_swatch(self, obj):
        if obj.color_code:
            return format_html(
                '<span style="display:inline-block;width:22px;height:22px;border-radius:50%;'
                'background:{};border:1px solid #ddd;"></span>',
                obj.color_code,
            )
        return "-"

    color_swatch.short_description = "Color"

    @admin.display(description="Sizes")
    def sizes_summary(self, obj):
        size_names = list(
            obj.sizes
            .order_by("sort_order", "id")
            .values_list("size_name", flat=True)[:5]
        )

        if not size_names:
            return obj.product_size or "-"

        summary = ", ".join(size_names)
        total_sizes = obj.sizes.count()

        if total_sizes > len(size_names):
            summary = f"{summary} +{total_sizes - len(size_names)}"

        return summary

    def main_image_preview(self, obj):
        if obj.main_image:
            return format_html(
                '<img src="{}" style="width:80px;height:100px;object-fit:cover;border-radius:8px;" />',
                obj.main_image.url,
            )
        return "-"

    main_image_preview.short_description = "Main Image"

    def arrival_card_image_preview(self, obj):
        if obj.arrival_card_image:
            return format_html(
                '<img src="{}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;" />',
                obj.arrival_card_image.url,
            )
        return "-"

    arrival_card_image_preview.short_description = "Arrival Card Image"

    def top_showcase_image_preview(self, obj):
        if obj.top_showcase_image:
            return format_html(
                '<img src="{}" style="width:120px;height:80px;object-fit:cover;border-radius:8px;" />',
                obj.top_showcase_image.url,
            )
        return "-"

    top_showcase_image_preview.short_description = "Top Carousel Image"

    def sub_image_1_preview(self, obj):
        if obj.sub_image_1:
            return format_html(
                '<img src="{}" style="width:80px;height:100px;object-fit:cover;border-radius:8px;" />',
                obj.sub_image_1.url,
            )
        return "-"

    sub_image_1_preview.short_description = "Sub Image 1 Preview"

    def sub_image_2_preview(self, obj):
        if obj.sub_image_2:
            return format_html(
                '<img src="{}" style="width:80px;height:100px;object-fit:cover;border-radius:8px;" />',
                obj.sub_image_2.url,
            )
        return "-"

    sub_image_2_preview.short_description = "Sub Image 2 Preview"

    def sub_image_3_preview(self, obj):
        if obj.sub_image_3:
            return format_html(
                '<img src="{}" style="width:80px;height:100px;object-fit:cover;border-radius:8px;" />',
                obj.sub_image_3.url,
            )
        return "-"

    sub_image_3_preview.short_description = "Sub Image 3 Preview"


class ProductSizeMeasurementInline(admin.TabularInline):
    model = ProductSizeMeasurement
    verbose_name = "Custom measurement"
    verbose_name_plural = "Custom measurements for this size"
    extra = 0
    can_delete = True

    fields = (
        "label",
        "value",
        "unit",
        "sort_order",
    )

    ordering = (
        "sort_order",
        "id",
    )


@admin.register(ProductSize)
class ProductSizeAdmin(HiddenFromAdminIndexMixin, admin.ModelAdmin):
    inlines = [
        ProductSizeMeasurementInline,
    ]

    list_display = (
        "id",
        "product",
        "size_name",
        "stock_quantity",
        "measurement_unit",
        "chest",
        "waist",
        "length",
        "is_available",
        "custom_measurement_count",
        "sort_order",
        "updated_at",
    )

    list_filter = (
        "measurement_unit",
        "is_available",
        "product__category",
        "created_at",
    )

    search_fields = (
        "product__name",
        "product__category__name",
        "size_name",
        "custom_measurements__label",
    )

    list_select_related = (
        "product",
        "product__category",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    ordering = (
        "product__name",
        "sort_order",
        "id",
    )

    list_per_page = 40

    fieldsets = (
        ("Product & Size", {
            "fields": (
                "product",
                "size_name",
                "stock_quantity",
                "is_available",
                "sort_order",
            )
        }),
        ("Standard size measurements", {
            "fields": (
                "measurement_unit",
                "chest",
                "waist",
                "length",
            ),
            "description": (
                "Use chest, waist and length for common measurements. "
                "Add shoulder, sleeve, hip, inseam or other custom values below."
            ),
        }),
        ("Timestamps", {
            "fields": (
                "created_at",
                "updated_at",
            )
        }),
    )

    @admin.display(description="Custom Measurements")
    def custom_measurement_count(self, obj):
        return obj.custom_measurements.count()
