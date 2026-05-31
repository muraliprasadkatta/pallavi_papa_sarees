from django.urls import path
from . import user_views

app_name = "store"

urlpatterns = [
    path("", user_views.user_home_view, name="user_home"),
    path("collections/", user_views.collections_page, name="collections"),

    # Product detail page
    path("products/<int:product_id>/", user_views.product_detail_view, name="product_detail"),
]