from io import BytesIO
from pathlib import Path
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.utils.text import slugify
from PIL import Image, ImageOps


# Safety limits for Render/free hosting
Image.MAX_IMAGE_PIXELS = 30_000_000

MAX_UPLOAD_SIZE_MB = 8
MAX_IMAGE_PIXELS = 25_000_000

# Product catalog image: 4:5 portrait
PRODUCT_TARGET_WIDTH = 1600
PRODUCT_TARGET_HEIGHT = 2000

# Sub product images: smaller 4:5 portrait to reduce RAM/load
SUB_PRODUCT_TARGET_WIDTH = 900
SUB_PRODUCT_TARGET_HEIGHT = 1125

# New arrival card image: 1:1 square
ARRIVAL_CARD_TARGET_WIDTH = 900
ARRIVAL_CARD_TARGET_HEIGHT = 900

# Top carousel image: 9:10 portrait card
TOP_SHOWCASE_TARGET_WIDTH = 900
TOP_SHOWCASE_TARGET_HEIGHT = 1000

# Category tab/card image: landscape style
CATEGORY_TARGET_WIDTH = 900
CATEGORY_TARGET_HEIGHT = 650

DEFAULT_WEBP_QUALITY = 82
MIN_WEBP_QUALITY = 58

PRODUCT_MAX_SIZE_KB = 350
SUB_PRODUCT_MAX_SIZE_KB = 180
ARRIVAL_CARD_MAX_SIZE_KB = 160
TOP_SHOWCASE_MAX_SIZE_KB = 180
CATEGORY_MAX_SIZE_KB = 180


def _validate_upload_size(uploaded_file):
    size = getattr(uploaded_file, "size", 0) or 0
    max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024

    if size > max_bytes:
        raise ValidationError(
            f"Image is too large. Please upload image below {MAX_UPLOAD_SIZE_MB} MB."
        )


def _validate_image_pixels(img):
    width, height = img.size
    pixels = width * height

    if pixels > MAX_IMAGE_PIXELS:
        raise ValidationError(
            "Image resolution is too large. Please upload a smaller image."
        )


def _pre_shrink_before_crop(img, target_width, target_height):
    """
    Memory-safe pre-resize before crop/final resize.
    This reduces RAM spike for phone camera images.
    """
    max_side = max(target_width, target_height) * 2

    if max(img.size) > max_side:
        img.thumbnail(
            (max_side, max_side),
            Image.Resampling.LANCZOS,
        )

    return img


def _center_crop_to_ratio(img, target_width, target_height):
    target_ratio = target_width / target_height
    width, height = img.size
    current_ratio = width / height

    if current_ratio > target_ratio:
        new_width = int(height * target_ratio)
        left = (width - new_width) // 2
        right = left + new_width
        return img.crop((left, 0, right, height))

    if current_ratio < target_ratio:
        new_height = int(width / target_ratio)
        top = (height - new_height) // 2
        bottom = top + new_height
        return img.crop((0, top, width, bottom))

    return img


def _prepare_image_mode(img, keep_alpha=False):
    if keep_alpha:
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        return img

    if img.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.getchannel("A"))
        return bg

    if img.mode != "RGB":
        return img.convert("RGB")

    return img


def _save_webp_under_size(img, max_size_kb, start_quality=DEFAULT_WEBP_QUALITY):
    max_size_bytes = max_size_kb * 1024
    quality = start_quality
    best_output = None

    while quality >= MIN_WEBP_QUALITY:
        output = BytesIO()

        img.save(
            output,
            format="WEBP",
            quality=quality,
            method=4,       # lighter than method=6 on small servers
            optimize=True,
        )

        best_output = output

        if output.tell() <= max_size_bytes:
            output.seek(0)
            return output

        quality -= 4

    best_output.seek(0)
    return best_output


def _get_uploaded_file_size(uploaded_file):
    size = getattr(uploaded_file, "size", None)

    if size is not None:
        return size

    current_position = uploaded_file.tell()
    uploaded_file.seek(0, 2)
    size = uploaded_file.tell()
    uploaded_file.seek(current_position)

    return size


def _make_safe_webp_filename(base_name="image"):
    safe_name = slugify(Path(str(base_name)).stem) or "image"
    safe_name = safe_name[:45]
    return f"{safe_name}-{uuid4().hex[:8]}.webp"


def _copy_original_without_recompressing(uploaded_file, base_name="image"):
    uploaded_file.seek(0)
    file_name = _make_safe_webp_filename(base_name)
    return ContentFile(uploaded_file.read(), name=file_name)


def _can_skip_conversion(uploaded_file, img, target_width, target_height, max_size_kb):
    image_format = (img.format or "").upper()
    file_name = getattr(uploaded_file, "name", "") or ""
    file_extension = Path(file_name).suffix.lower()

    is_webp = image_format == "WEBP" or file_extension == ".webp"
    is_exact_size = img.size == (target_width, target_height)

    uploaded_size = _get_uploaded_file_size(uploaded_file)
    is_under_target_size = uploaded_size <= max_size_kb * 1024

    return is_webp and is_exact_size and is_under_target_size


def convert_product_image_to_webp(
    uploaded_file,
    base_name="product",
    target_width=PRODUCT_TARGET_WIDTH,
    target_height=PRODUCT_TARGET_HEIGHT,
    max_size_kb=PRODUCT_MAX_SIZE_KB,
    quality=DEFAULT_WEBP_QUALITY,
    keep_alpha=False,
):
    if not uploaded_file:
        return None

    try:
        _validate_upload_size(uploaded_file)

        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
        img = ImageOps.exif_transpose(img)

        _validate_image_pixels(img)

        if _can_skip_conversion(
            uploaded_file=uploaded_file,
            img=img,
            target_width=target_width,
            target_height=target_height,
            max_size_kb=max_size_kb,
        ):
            return _copy_original_without_recompressing(uploaded_file, base_name)

        img = _prepare_image_mode(img, keep_alpha=keep_alpha)

        img = _pre_shrink_before_crop(
            img,
            target_width=target_width,
            target_height=target_height,
        )

        img = _center_crop_to_ratio(
            img,
            target_width=target_width,
            target_height=target_height,
        )

        img = img.resize(
            (target_width, target_height),
            Image.Resampling.LANCZOS,
        )

        output = _save_webp_under_size(
            img=img,
            max_size_kb=max_size_kb,
            start_quality=quality,
        )

        file_name = _make_safe_webp_filename(base_name)
        return ContentFile(output.getvalue(), name=file_name)

    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError(
            "Invalid image. Please upload a clear JPG/PNG/WebP image. "
            f"Error: {exc}"
        )


def convert_sub_product_image_to_webp(uploaded_file, base_name="sub-product"):
    """
    Use this for sub_image_1, sub_image_2, sub_image_3.
    Smaller output reduces RAM, upload time, and Cloudinary load.
    """
    return convert_product_image_to_webp(
        uploaded_file=uploaded_file,
        base_name=base_name,
        target_width=SUB_PRODUCT_TARGET_WIDTH,
        target_height=SUB_PRODUCT_TARGET_HEIGHT,
        max_size_kb=SUB_PRODUCT_MAX_SIZE_KB,
        quality=DEFAULT_WEBP_QUALITY,
        keep_alpha=False,
    )