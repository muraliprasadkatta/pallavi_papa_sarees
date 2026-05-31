from django.contrib import admin
from django.utils.html import format_html

from .models import Category, Product, ProductVariant


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


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    inlines = [ProductVariantInline]

    list_display = (
        "id",
        "name",
        "category",
        "color_name",
        "color_swatch",
        "actual_price",
        "offer_price",
        "is_available",
        "is_new_arrival",
        "main_image_preview",
        "created_at",
    )

    list_filter = (
        "category",
        "is_available",
        "is_new_arrival",
        "created_at",
    )

    search_fields = (
        "name",
        "category__name",
        "category__slug",
        "material",
        "color_name",
        "color_code",
    )

    readonly_fields = (
        "main_image_preview",
        "arrival_card_image_preview",
        "sub_image_1_preview",
        "sub_image_2_preview",
        "sub_image_3_preview",
        "created_at",
        "updated_at",
    )

    ordering = ("-created_at",)

    fieldsets = (
        ("Basic Details", {
            "fields": (
                "name",
                "category",
                "material",
                "description",
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
            )
        }),
        ("Timestamps", {
            "fields": (
                "created_at",
                "updated_at",
            )
        }),
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