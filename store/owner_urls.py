from django.urls import path
from . import owner_views

app_name = "store_owner"

urlpatterns = [
    path("login/", owner_views.owner_login_view, name="owner_login"),
    path("dashboard/", owner_views.owner_dashboard_view, name="owner_dashboard"),
    path("logout/", owner_views.owner_logout_view, name="owner_logout"),

    path("categories/add/", owner_views.owner_category_add_view, name="owner_category_add"),
    path("products/add/", owner_views.owner_product_add_view, name="owner_product_add"),

    path(
        "products/<int:product_id>/upload-image/",
        owner_views.owner_product_upload_image_view,
        name="owner_product_upload_image",
    ),
]