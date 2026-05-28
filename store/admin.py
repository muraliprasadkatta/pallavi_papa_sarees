from django.contrib import admin
from django.utils.html import format_html

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "category",
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
        "category",
        "material",
    )

    readonly_fields = (
        "main_image_preview",
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

    def main_image_preview(self, obj):
        if obj.main_image:
            return format_html(
                '<img src="{}" style="width:80px;height:100px;object-fit:cover;border-radius:8px;" />',
                obj.main_image.url,
            )
        return "-"

    main_image_preview.short_description = "Main Image"

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