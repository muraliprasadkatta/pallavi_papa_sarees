from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import transaction
from django.shortcuts import redirect, render

from .forms import CategoryForm, ProductForm
from .models import ProductVariant


User = get_user_model()


OWNER_LOGIN_TEMPLATE = "store/owner/owner_login_form.html"
OWNER_DASHBOARD_TEMPLATE = "store/owner/owner_dashboard.html"
OWNER_PRODUCT_FORM_TEMPLATE = "store/owner/partials/owner_add_product_form.html"
OWNER_CATEGORY_FORM_TEMPLATE = "store/owner/partials/owner_add_category_form.html"


def _get_username_from_username_or_email(value):
    """
    Owner can login using username or email.
    authenticate() needs username, so email ni username ki convert chestham.
    """
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

        has_any_data = any([
            color_name,
            color_code,
            actual_price,
            offer_price,
            variant_image,
        ])

        if not has_any_data:
            continue

        cleaned_color_code = _clean_color_code(color_code)
        cleaned_actual_price = _optional_decimal(actual_price, "Variant actual price")
        cleaned_offer_price = _optional_decimal(offer_price, "Variant offer price")

        if (
            cleaned_actual_price
            and cleaned_offer_price
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
        form = ProductForm(request.POST, request.FILES)

        if form.is_valid():
            try:
                with transaction.atomic():
                    product = form.save()
                    _save_product_variants(product, request)

                messages.success(request, "Product added successfully.")
                return redirect("store_owner:owner_dashboard")

            except ValidationError as error:
                error_message = (
                    " ".join(error.messages)
                    if hasattr(error, "messages")
                    else str(error)
                )
                messages.error(request, error_message)

    else:
        form = ProductForm()

    return render(
        request,
        OWNER_PRODUCT_FORM_TEMPLATE,
        {
            "form": form,
        },
    )