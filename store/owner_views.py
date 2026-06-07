from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .forms import CategoryForm, ProductForm
from .models import Product, ProductHighlight, ProductVariant
from .services.product_image_service import (
    ARRIVAL_CARD_MAX_SIZE_KB,
    ARRIVAL_CARD_TARGET_HEIGHT,
    ARRIVAL_CARD_TARGET_WIDTH,
    DEFAULT_WEBP_QUALITY,
    TOP_SHOWCASE_MAX_SIZE_KB,
    TOP_SHOWCASE_TARGET_HEIGHT,
    TOP_SHOWCASE_TARGET_WIDTH,
    convert_product_image_to_webp,
    convert_sub_product_image_to_webp,
)


User = get_user_model()


OWNER_LOGIN_TEMPLATE = "store/owner/owner_login_form.html"
OWNER_DASHBOARD_TEMPLATE = "store/owner/owner_dashboard.html"
OWNER_PRODUCT_FORM_TEMPLATE = "store/owner/partials/owner_add_product_form.html"
OWNER_CATEGORY_FORM_TEMPLATE = "store/owner/partials/owner_add_category_form.html"


AJAX_IMAGE_FIELDS = {
    "arrival_card_image": "arrival_card_image",
    "top_showcase_image": "top_showcase_image",
    "sub_image_1": "sub_image_1",
    "sub_image_2": "sub_image_2",
    "sub_image_3": "sub_image_3",
}

EXTRA_IMAGE_FIELD_NAMES = [
    "arrival_card_image",
    "top_showcase_image",
    "sub_image_1",
    "sub_image_2",
    "sub_image_3",
    "variant_images",
]

EXTRA_IMAGE_MAX_MB = 5


def _is_ajax_request(request):
    return request.headers.get("x-requested-with") == "XMLHttpRequest"


def _json_error(message, status=400, field_errors=None):
    payload = {
        "ok": False,
        "message": message,
    }

    if field_errors:
        payload["errors"] = field_errors

    return JsonResponse(payload, status=status)


def _flatten_form_errors(form):
    errors = {}

    for field_name, field_errors in form.errors.items():
        errors[field_name] = [str(error) for error in field_errors]

    return errors


def _validate_extra_image(uploaded_file):
    if not uploaded_file:
        raise ValidationError("Please upload an image.")

    if not getattr(uploaded_file, "content_type", "").startswith("image/"):
        raise ValidationError("Please upload a valid image file.")

    if uploaded_file.size > EXTRA_IMAGE_MAX_MB * 1024 * 1024:
        raise ValidationError(f"Image should be under {EXTRA_IMAGE_MAX_MB}MB.")


def _convert_extra_product_image(field_name, uploaded_file, product):
    base_name = f"{product.name or 'product'}-{field_name}"

    if field_name == "arrival_card_image":
        return convert_product_image_to_webp(
            uploaded_file=uploaded_file,
            base_name=base_name,
            target_width=ARRIVAL_CARD_TARGET_WIDTH,
            target_height=ARRIVAL_CARD_TARGET_HEIGHT,
            max_size_kb=ARRIVAL_CARD_MAX_SIZE_KB,
            quality=DEFAULT_WEBP_QUALITY,
            keep_alpha=False,
        )

    if field_name == "top_showcase_image":
        return convert_product_image_to_webp(
            uploaded_file=uploaded_file,
            base_name=base_name,
            target_width=TOP_SHOWCASE_TARGET_WIDTH,
            target_height=TOP_SHOWCASE_TARGET_HEIGHT,
            max_size_kb=TOP_SHOWCASE_MAX_SIZE_KB,
            quality=DEFAULT_WEBP_QUALITY,
            keep_alpha=False,
        )

    if field_name in {"sub_image_1", "sub_image_2", "sub_image_3"}:
        return convert_sub_product_image_to_webp(
            uploaded_file=uploaded_file,
            base_name=base_name,
        )

    raise ValidationError("Invalid image field.")


def _remove_extra_images_for_ajax_first_save(files):
    """
    AJAX first request should process only main_image.
    Extra images and variant images are uploaded one-by-one after product is created.
    This prevents Render/free-server RAM spike and timeout.
    """
    cleaned_files = files.copy()

    for field_name in EXTRA_IMAGE_FIELD_NAMES:
        try:
            cleaned_files.pop(field_name, None)
        except TypeError:
            if field_name in cleaned_files:
                del cleaned_files[field_name]

    return cleaned_files


def _get_username_from_username_or_email(value):
    value = (value or "").strip()

    if "@" not in value:
        return value

    user = User.objects.filter(email__iexact=value).only("username").first()
    if user:
        return user.username

    return value


def _optional_decimal(value, field_label):
    value = (value or "").strip()

    if not value:
        return None

    try:
        amount = Decimal(value)
    except InvalidOperation:
        raise ValidationError(f"{field_label} must be a valid number.")

    if amount < 0:
        raise ValidationError(f"{field_label} cannot be negative.")

    return amount


def _clean_color_code(value):
    value = (value or "").strip()

    if not value:
        return ""

    if not value.startswith("#"):
        value = f"#{value}"

    if len(value) not in (4, 7):
        raise ValidationError("Enter a valid color code like #2f6b45.")

    valid_chars = "0123456789abcdefABCDEF"
    if not all(char in valid_chars for char in value[1:]):
        raise ValidationError("Color code should contain only hex characters.")

    return value.lower()


def _save_product_variants(product, request):
    """
    Non-AJAX fallback only.
    In normal JS/AJAX flow, variants are uploaded separately by owner_product_upload_variant_view().
    """
    variant_color_names = request.POST.getlist("variant_color_names")
    variant_color_codes = request.POST.getlist("variant_color_codes")
    variant_actual_prices = request.POST.getlist("variant_actual_prices")
    variant_offer_prices = request.POST.getlist("variant_offer_prices")
    variant_images = request.FILES.getlist("variant_images")
    available_values = set(request.POST.getlist("variant_is_available"))

    for index, raw_color_name in enumerate(variant_color_names):
        color_name = (raw_color_name or "").strip()

        color_code = (
            variant_color_codes[index].strip()
            if index < len(variant_color_codes)
            else ""
        )

        actual_price = (
            variant_actual_prices[index]
            if index < len(variant_actual_prices)
            else ""
        )

        offer_price = (
            variant_offer_prices[index]
            if index < len(variant_offer_prices)
            else ""
        )

        variant_image = (
            variant_images[index]
            if index < len(variant_images)
            else None
        )

        has_any_data = any(
            [
                color_name,
                color_code,
                actual_price,
                offer_price,
                variant_image,
            ]
        )

        if not has_any_data:
            continue

        if not color_name:
            raise ValidationError(f"Variant {index + 1}: color name is required.")

        if not variant_image:
            raise ValidationError(f"Variant {index + 1}: image is required.")

        cleaned_color_code = _clean_color_code(color_code)
        cleaned_actual_price = _optional_decimal(actual_price, "Variant actual price")
        cleaned_offer_price = _optional_decimal(offer_price, "Variant offer price")

        if (
            cleaned_actual_price is not None
            and cleaned_offer_price is not None
            and cleaned_offer_price > cleaned_actual_price
        ):
            raise ValidationError(
                f"Variant {index + 1}: offer price cannot be greater than actual price."
            )

        ProductVariant.objects.create(
            product=product,
            color_name=color_name,
            color_code=cleaned_color_code,
            variant_image=variant_image,
            actual_price=cleaned_actual_price,
            offer_price=cleaned_offer_price,
            is_available=str(index + 1) in available_values,
        )


def _save_product_highlights(product, request):
    highlight_labels = request.POST.getlist("highlight_labels")
    highlight_values = request.POST.getlist("highlight_values")

    ProductHighlight.objects.filter(product=product).delete()

    highlight_objects = []

    for index, (raw_label, raw_value) in enumerate(
        zip(highlight_labels, highlight_values),
        start=1,
    ):
        label = (raw_label or "").strip()
        value = (raw_value or "").strip()

        if not label and not value:
            continue

        if not label or not value:
            raise ValidationError(
                f"Highlight {index}: both label and value are required."
            )

        if len(label) > 80:
            raise ValidationError(
                f"Highlight {index}: label should be under 80 characters."
            )

        if len(value) > 180:
            raise ValidationError(
                f"Highlight {index}: value should be under 180 characters."
            )

        highlight_objects.append(
            ProductHighlight(
                product=product,
                label=label,
                value=value,
                sort_order=index,
            )
        )

    if highlight_objects:
        ProductHighlight.objects.bulk_create(highlight_objects)


def owner_login_view(request):
    if request.user.is_authenticated and request.user.is_staff:
        return redirect("store_owner:owner_dashboard")

    if request.method == "POST":
        username_or_email = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")

        username = _get_username_from_username_or_email(username_or_email)

        user = authenticate(
            request,
            username=username,
            password=password,
        )

        if user is None:
            return render(
                request,
                OWNER_LOGIN_TEMPLATE,
                {"error": "Invalid username/email or password."},
            )

        if not user.is_staff:
            return render(
                request,
                OWNER_LOGIN_TEMPLATE,
                {"error": "You do not have owner access."},
            )

        login(request, user)
        messages.success(request, "Owner login successful.")
        return redirect("store_owner:owner_dashboard")

    return render(request, OWNER_LOGIN_TEMPLATE)


def owner_logout_view(request):
    logout(request)
    return redirect("store_owner:owner_login")


@login_required(login_url="store_owner:owner_login")
def owner_dashboard_view(request):
    if not request.user.is_staff:
        logout(request)
        return redirect("store_owner:owner_login")

    owner_display_name = (
        request.user.get_full_name()
        or request.user.email
        or request.user.username
    )

    return render(
        request,
        OWNER_DASHBOARD_TEMPLATE,
        {
            "owner_display_name": owner_display_name,
        },
    )


@login_required(login_url="store_owner:owner_login")
def owner_category_add_view(request):
    if not request.user.is_staff:
        logout(request)
        return redirect("store_owner:owner_login")

    if request.method == "POST":
        form = CategoryForm(request.POST, request.FILES)

        if form.is_valid():
            form.save()
            messages.success(request, "Category added successfully.")
            return redirect("store_owner:owner_dashboard")
    else:
        form = CategoryForm()

    return render(
        request,
        OWNER_CATEGORY_FORM_TEMPLATE,
        {
            "form": form,
        },
    )


@login_required(login_url="store_owner:owner_login")
def owner_product_add_view(request):
    if not request.user.is_staff:
        logout(request)
        return redirect("store_owner:owner_login")

    if request.method == "POST":
        files = request.FILES

        if _is_ajax_request(request):
            files = _remove_extra_images_for_ajax_first_save(request.FILES)

        form = ProductForm(request.POST, files)

        if form.is_valid():
            try:
                with transaction.atomic():
                    product = form.save()
                    _save_product_highlights(product, request)

                    # AJAX flow:
                    # First request saves only product details + main image.
                    # Variants are uploaded later one-by-one using owner_product_upload_variant_view().
                    if not _is_ajax_request(request):
                        _save_product_variants(product, request)

                if _is_ajax_request(request):
                    return JsonResponse(
                        {
                            "ok": True,
                            "product_id": product.id,
                            "message": "Product details saved.",
                        }
                    )

                messages.success(request, "Product added successfully.")
                return redirect("store_owner:owner_dashboard")

            except ValidationError as error:
                error_message = (
                    " ".join(error.messages)
                    if hasattr(error, "messages")
                    else str(error)
                )

                if _is_ajax_request(request):
                    return _json_error(error_message)

                messages.error(request, error_message)

        elif _is_ajax_request(request):
            return _json_error(
                "Please check the form details and try again.",
                field_errors=_flatten_form_errors(form),
            )

    else:
        form = ProductForm()

    return render(
        request,
        OWNER_PRODUCT_FORM_TEMPLATE,
        {
            "form": form,
        },
    )


@require_POST
@login_required(login_url="store_owner:owner_login")
def owner_product_upload_image_view(request, product_id):
    if not request.user.is_staff:
        return _json_error("You do not have owner access.", status=403)

    product = get_object_or_404(Product, id=product_id)

    field_name = request.POST.get("field_name", "").strip()
    model_field_name = AJAX_IMAGE_FIELDS.get(field_name)

    if not model_field_name:
        return _json_error("Invalid image field.")

    uploaded_file = request.FILES.get("image")
    if not uploaded_file:
        return _json_error("No image file received.")

    try:
        _validate_extra_image(uploaded_file)

        converted_file = _convert_extra_product_image(
            field_name=model_field_name,
            uploaded_file=uploaded_file,
            product=product,
        )

        image_field = getattr(product, model_field_name)
        image_field.save(converted_file.name, converted_file, save=False)

        product.save(update_fields=[model_field_name])

        return JsonResponse(
            {
                "ok": True,
                "field_name": model_field_name,
                "message": f"{model_field_name} uploaded successfully.",
            }
        )

    except ValidationError as error:
        error_message = (
            " ".join(error.messages)
            if hasattr(error, "messages")
            else str(error)
        )
        return _json_error(error_message)

    except Exception as error:
        return _json_error(
            f"Image upload failed. Please try again. Error: {error}",
            status=500,
        )


@require_POST
@login_required(login_url="store_owner:owner_login")
def owner_product_upload_variant_view(request, product_id):
    if not request.user.is_staff:
        return _json_error("You do not have owner access.", status=403)

    product = get_object_or_404(Product, id=product_id)

    uploaded_file = request.FILES.get("image")
    color_name = (request.POST.get("color_name") or "").strip()
    color_code = (request.POST.get("color_code") or "").strip()
    actual_price = request.POST.get("actual_price", "")
    offer_price = request.POST.get("offer_price", "")
    is_available = request.POST.get("is_available") == "1"

    if not uploaded_file:
        return _json_error("Variant image is required.")

    if not color_name:
        return _json_error("Variant color name is required.")

    try:
        _validate_extra_image(uploaded_file)

        cleaned_color_code = _clean_color_code(color_code)
        cleaned_actual_price = _optional_decimal(actual_price, "Variant actual price")
        cleaned_offer_price = _optional_decimal(offer_price, "Variant offer price")

        if (
            cleaned_actual_price is not None
            and cleaned_offer_price is not None
            and cleaned_offer_price > cleaned_actual_price
        ):
            raise ValidationError(
                "Variant offer price cannot be greater than actual price."
            )

        converted_file = convert_sub_product_image_to_webp(
            uploaded_file=uploaded_file,
            base_name=f"{product.name or 'product'}-{color_name}-variant",
        )

        variant = ProductVariant.objects.create(
            product=product,
            color_name=color_name,
            color_code=cleaned_color_code,
            variant_image=converted_file,
            actual_price=cleaned_actual_price,
            offer_price=cleaned_offer_price,
            is_available=is_available,
        )

        return JsonResponse(
            {
                "ok": True,
                "variant_id": variant.id,
                "message": "Variant uploaded successfully.",
            }
        )

    except ValidationError as error:
        error_message = (
            " ".join(error.messages)
            if hasattr(error, "messages")
            else str(error)
        )
        return _json_error(error_message)

    except Exception as error:
        return _json_error(
            f"Variant upload failed. Please try again. Error: {error}",
            status=500,
        )