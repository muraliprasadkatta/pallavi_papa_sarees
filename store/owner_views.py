from django.contrib import messages
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from .forms import ProductForm


User = get_user_model()


OWNER_LOGIN_TEMPLATE = "store/owner/owner_login_form.html"
OWNER_DASHBOARD_TEMPLATE = "store/owner/owner_dashboard.html"
OWNER_PRODUCT_FORM_TEMPLATE = "store/owner/partials/owner_add_product_form.html"


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
def owner_product_add_view(request):
    if not request.user.is_staff:
        logout(request)
        return redirect("store_owner:owner_login")

    if request.method == "POST":
        form = ProductForm(request.POST, request.FILES)

        if form.is_valid():
            form.save()
            messages.success(request, "Product added successfully.")
            return redirect("store_owner:owner_dashboard")
    else:
        form = ProductForm()

    return render(
        request,
        OWNER_PRODUCT_FORM_TEMPLATE,
        {
            "form": form,
        },
    )