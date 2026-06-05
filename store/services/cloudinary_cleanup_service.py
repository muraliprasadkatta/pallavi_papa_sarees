import logging
import os
from urllib.parse import urlparse

import cloudinary.uploader
from django.db import transaction

logger = logging.getLogger(__name__)


def get_cloudinary_public_id(file_value):
    """
    Converts Django ImageField/FileField value into Cloudinary public_id.

    Examples:
    products/main/sample.webp -> products/main/sample
    https://res.cloudinary.com/.../image/upload/v123/products/main/sample.webp
    -> products/main/sample
    """
    raw = getattr(file_value, "name", "") or str(file_value or "")
    raw = raw.strip()

    if not raw:
      return ""

    raw = raw.split("?")[0].split("#")[0]

    if raw.startswith("http://") or raw.startswith("https://"):
        path = urlparse(raw).path

        if "/upload/" in path:
            raw = path.split("/upload/", 1)[1]

            parts = raw.split("/")

            # Remove version part: v1234567890
            if parts and parts[0].startswith("v") and parts[0][1:].isdigit():
                parts = parts[1:]

            raw = "/".join(parts)
        else:
            raw = path.lstrip("/")

    raw = raw.lstrip("/")

    public_id, _ext = os.path.splitext(raw)
    return public_id


def _iter_current_image_values():
    """
    Scan current DB image fields.
    Safe for small/medium store size.
    """
    from store.models import Category, Product, ProductVariant

    category_fields = ("image",)
    product_fields = (
        "main_image",
        "arrival_card_image",
        "top_showcase_image",
        "sub_image_1",
        "sub_image_2",
        "sub_image_3",
    )
    variant_fields = ("variant_image",)

    for obj in Category.objects.only(*category_fields).iterator():
        for field_name in category_fields:
            value = getattr(obj, field_name, None)
            if value and getattr(value, "name", ""):
                yield value

    for obj in Product.objects.only(*product_fields).iterator():
        for field_name in product_fields:
            value = getattr(obj, field_name, None)
            if value and getattr(value, "name", ""):
                yield value

    for obj in ProductVariant.objects.only(*variant_fields).iterator():
        for field_name in variant_fields:
            value = getattr(obj, field_name, None)
            if value and getattr(value, "name", ""):
                yield value


def is_cloudinary_asset_still_used(public_id):
    if not public_id:
        return False

    for value in _iter_current_image_values():
        existing_public_id = get_cloudinary_public_id(value)

        if existing_public_id == public_id:
            return True

    return False


def delete_cloudinary_file_if_unused(file_value):
    """
    Deletes a Cloudinary image only if no current DB field still uses it.
    This prevents broken images when the same asset is reused.
    """
    public_id = get_cloudinary_public_id(file_value)

    if not public_id:
        return

    def _delete_after_commit():
        if is_cloudinary_asset_still_used(public_id):
            return

        try:
            result = cloudinary.uploader.destroy(
                public_id,
                resource_type="image",
                invalidate=True,
            )
            logger.info("Cloudinary delete result for %s: %s", public_id, result)
        except Exception:
            logger.exception("Failed to delete Cloudinary asset: %s", public_id)

    transaction.on_commit(_delete_after_commit)