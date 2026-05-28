from django.db.models import Q
from django.db.models.functions import Coalesce
from django.shortcuts import render

from .models import Product


def user_home_view(request):
    new_arrivals = (
        Product.objects
        .filter(is_available=True, is_new_arrival=True)
        .only(
            "id",
            "name",
            "category",
            "actual_price",
            "offer_price",
            "main_image",
            "created_at",
        )
        .order_by("-created_at")[:8]
    )

    latest_products = (
        Product.objects
        .filter(is_available=True)
        .only(
            "id",
            "name",
            "category",
            "actual_price",
            "offer_price",
            "main_image",
            "created_at",
        )
        .order_by("-created_at")[:8]
    )

    context = {
        "new_arrivals": new_arrivals,
        "latest_products": latest_products,
    }

    return render(request, "store/user_homepage/user_home.html", context)


def collections_page(request):
    active_category = request.GET.get("category", "all")
    active_sort = request.GET.get("sort", "newest")
    search_query = request.GET.get("q", "").strip()
    focus = request.GET.get("focus", "shop")

    category_titles = {
        "all": "All Saree Collections",
        "pattu": "Pattu Sarees Collection",
        "cotton": "Cotton Sarees Collection",
        "silk": "Silk Sarees Collection",
        "designer": "Designer Sarees Collection",
        "wedding": "Wedding Collection",
        "daily": "Daily Wear Collection",
    }

    category_descriptions = {
        "all": "Browse premium saree collections crafted with tradition, elegance & premium quality.",
        "pattu": "Explore our exclusive range of pure pattu sarees crafted with tradition, elegance & premium quality.",
        "cotton": "Discover comfortable cotton sarees designed for daily elegance and easy wear.",
        "silk": "Browse rich silk sarees with premium shine, soft texture and graceful drape.",
        "designer": "Explore designer sarees made for special occasions, parties and standout looks.",
        "wedding": "Find grand wedding sarees with rich colors, premium borders and festive elegance.",
        "daily": "Shop lightweight daily wear sarees made for comfort, simplicity and regular use.",
    }

    valid_categories = {choice[0] for choice in Product.CATEGORY_CHOICES}

    products = (
        Product.objects
        .filter(is_available=True)
        .annotate(display_price=Coalesce("offer_price", "actual_price"))
        .only(
            "id",
            "name",
            "category",
            "material",
            "description",
            "actual_price",
            "offer_price",
            "main_image",
            "is_available",
            "is_new_arrival",
            "created_at",
        )
    )

    if active_category != "all" and active_category in valid_categories:
        products = products.filter(category=active_category)

    if focus == "new":
        products = products.filter(is_new_arrival=True)

    if search_query:
        products = products.filter(
            Q(name__icontains=search_query)
            | Q(category__icontains=search_query)
            | Q(material__icontains=search_query)
            | Q(description__icontains=search_query)
        )

    if active_sort == "price-low":
        products = products.order_by("display_price", "-created_at")
    elif active_sort == "price-high":
        products = products.order_by("-display_price", "-created_at")
    elif active_sort == "popular":
        # Popularity field still ledu, so new arrivals first + newest fallback.
        products = products.order_by("-is_new_arrival", "-created_at")
    else:
        products = products.order_by("-created_at")

    new_arrivals = (
        Product.objects
        .filter(is_available=True, is_new_arrival=True)
        .only(
            "id",
            "name",
            "category",
            "actual_price",
            "offer_price",
            "main_image",
            "created_at",
        )
        .order_by("-created_at")[:4]
    )

    context = {
        "active_category": active_category,
        "active_sort": active_sort,
        "search_query": search_query,
        "focus": focus,
        "page_title": category_titles.get(active_category, "Collections"),
        "page_description": category_descriptions.get(
            active_category,
            "Browse premium saree collections."
        ),
        "products": products,
        "new_arrivals": new_arrivals,
    }

    return render(request, "store/collections/collections.html", context)