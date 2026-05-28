from io import BytesIO
from pathlib import Path
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.utils.text import slugify
from PIL import Image, ImageOps



TARGET_WIDTH = 1600
TARGET_HEIGHT = 2000
WEBP_QUALITY = 82


def _center_crop_to_ratio(img, target_width=TARGET_WIDTH, target_height=TARGET_HEIGHT):
    """
    Crop image from center to target ratio.
    Example target: 1600x2000 = 4:5 portrait.
    """
    target_ratio = target_width / target_height
    width, height = img.size
    current_ratio = width / height

    if current_ratio > target_ratio:
        # image too wide, crop left/right
        new_width = int(height * target_ratio)
        left = (width - new_width) // 2
        right = left + new_width
        return img.crop((left, 0, right, height))

    if current_ratio < target_ratio:
        # image too tall, crop top/bottom
        new_height = int(width / target_ratio)
        top = (height - new_height) // 2
        bottom = top + new_height
        return img.crop((0, top, width, bottom))

    return img


def _to_rgb(img):
    """
    WebP works with RGB/RGBA, but for product images RGB is safer.
    Transparent images get white background.
    """
    if img.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.getchannel("A"))
        return bg

    if img.mode != "RGB":
        return img.convert("RGB")

    return img


def convert_product_image_to_webp(uploaded_file, base_name="product"):
    """
    Convert uploaded product image to:
    - 4:5 portrait ratio
    - 1600x2000 px
    - WebP format
    - optimized quality
    """
    if not uploaded_file:
        return None

    try:
        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
        img = ImageOps.exif_transpose(img)
        img = _to_rgb(img)

        img = _center_crop_to_ratio(img)
        img = img.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.Resampling.LANCZOS)

        output = BytesIO()
        img.save(
            output,
            format="WEBP",
            quality=WEBP_QUALITY,
            method=6,
            optimize=True,
        )

        safe_name = slugify(Path(str(base_name)).stem) or "product"
        file_name = f"{safe_name}-{uuid4().hex[:8]}.webp"

        return ContentFile(output.getvalue(), name=file_name)

    except Exception as exc:
        raise ValidationError(f"Invalid product image. Please upload a clear JPG/PNG/WebP image. Error: {exc}")