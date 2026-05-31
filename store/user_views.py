from decimal import Decimal

from django.db.models import Q
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.template.loader import render_to_string

from .models import Category, Product


def user_home_view(request):
    new_arrivals = (
        Product.objects
        .select_related("category")
        .filter(is_available=True, is_new_arrival=True)
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "category__slug",
            "actual_price",
            "offer_price",
            "main_image",
            "arrival_card_image",
            "created_at",
        )
        .order_by("-created_at")[:8]
    )

    latest_products = (
        Product.objects
        .select_related("category")
        .filter(is_available=True)
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "category__slug",
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
    active_category = (request.GET.get("category", "all") or "all").strip()
    active_sort = request.GET.get("sort", "newest")
    search_query = request.GET.get("q", "").strip()
    focus = request.GET.get("focus", "shop")
    active_price = request.GET.get("price", "").strip()

    categories = (
        Category.objects
        .filter(is_active=True)
        .order_by("sort_order", "name")
    )

    selected_category = None
    if active_category != "all":
        selected_category = categories.filter(slug=active_category).first()

    category_titles = {
        "all": "All Products",
        "pattu": "Pattu Sarees Collection",
        "cotton": "Cotton Sarees Collection",
        "silk": "Silk Sarees Collection",
        "designer": "Designer Sarees Collection",
        "wedding": "Wedding Collection",
        "daily": "Daily Wear Collection",
    }

    category_descriptions = {
        "all": "Browse sarees, dresses and dress materials crafted with tradition, elegance & premium quality.",
        "pattu": "Explore our exclusive range of pure pattu sarees crafted with tradition, elegance & premium quality.",
        "cotton": "Discover comfortable cotton sarees designed for daily elegance and easy wear.",
        "silk": "Browse rich silk sarees with premium shine, soft texture and graceful drape.",
        "designer": "Explore designer sarees made for special occasions, parties and standout looks.",
        "wedding": "Find grand wedding sarees with rich colors, premium borders and festive elegance.",
        "daily": "Shop lightweight daily wear sarees made for comfort, simplicity and regular use.",
    }

    price_limits = {
        "under-500": Decimal("500"),
        "under-1000": Decimal("1000"),
        "under-1500": Decimal("1500"),
    }

    price_titles = {
        "under-500": "Under ₹500 Budget Picks",
        "under-1000": "Under ₹1000 Most Loved Picks",
        "under-1500": "Under ₹1500 Premium Picks",
    }

    price_descriptions = {
        "under-500": "Shop affordable sarees, dresses and dress materials under ₹500.",
        "under-1000": "Explore beautiful budget-friendly collections under ₹1000.",
        "under-1500": "Browse premium sarees, dresses and dress materials under ₹1500.",
    }

    all_products = (
        Product.objects
        .select_related("category")
        .filter(is_available=True)
        .annotate(display_price=Coalesce("offer_price", "actual_price"))
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "category__slug",
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

    # Price filter: offer_price unte offer_price, lekapothe actual_price base meeda filter.
    if active_price in price_limits:
        all_products = all_products.filter(display_price__lte=price_limits[active_price])
    else:
        active_price = ""

    base_products = all_products

    if focus == "new":
        base_products = all_products.filter(is_new_arrival=True)

    fallback_category_missing = False

    if selected_category:
        fallback_category_title = selected_category.name
    else:
        fallback_category_title = category_titles.get(active_category, "Selected Collection")

    products = base_products
    more_products = all_products.none()
    show_more_products = False
    more_products_limit = None

    if focus == "new" and not search_query and active_category == "all":
        products = base_products

        more_products = all_products.exclude(is_new_arrival=True)
        show_more_products = more_products.exists()
        more_products_limit = 8

    elif search_query:
        products = base_products.filter(
            Q(name__icontains=search_query)
            | Q(category__name__icontains=search_query)
            | Q(material__icontains=search_query)
            | Q(description__icontains=search_query)
        )

    elif active_category != "all":
        if selected_category:
            category_products = base_products.filter(category=selected_category)

            if category_products.exists():
                products = category_products

                more_products = all_products.exclude(category=selected_category)
                show_more_products = more_products.exists()
                more_products_limit = 8

            else:
                fallback_category_missing = True
                products = base_products
        else:
            fallback_category_missing = True
            products = base_products

    def apply_sort(queryset):
        if active_sort == "price-low":
            return queryset.order_by("display_price", "-created_at")

        if active_sort == "price-high":
            return queryset.order_by("-display_price", "-created_at")

        if active_sort == "popular":
            return queryset.order_by("-is_new_arrival", "-created_at")

        return queryset.order_by("-created_at")

    products = apply_sort(products)
    more_products = apply_sort(more_products)

    if more_products_limit:
        more_products = more_products[:more_products_limit]

    new_arrivals = (
        Product.objects
        .select_related("category")
        .filter(is_available=True, is_new_arrival=True)
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "category__slug",
            "actual_price",
            "offer_price",
            "main_image",
            "created_at",
        )
        .order_by("-created_at")[:4]
    )

    if active_price:
        page_title = price_titles.get(active_price, "Budget Picks")
        page_description = price_descriptions.get(
            active_price,
            "Browse budget-friendly products."
        )
    elif selected_category:
        page_title = category_titles.get(
            active_category,
            f"{selected_category.name} Collection"
        )
        page_description = category_descriptions.get(
            active_category,
            f"Browse our latest {selected_category.name.lower()} products."
        )
    else:
        page_title = category_titles.get(active_category, "All Products")
        page_description = category_descriptions.get(
            active_category,
            "Browse premium products."
        )

    context = {
        "categories": categories,
        "active_category": active_category,
        "selected_category": selected_category,
        "active_sort": active_sort,
        "search_query": search_query,
        "focus": focus,
        "active_price": active_price,

        "fallback_category_missing": fallback_category_missing,
        "fallback_category_title": fallback_category_title,

        "show_more_products": show_more_products,
        "more_products": more_products,

        "page_title": page_title,
        "page_description": page_description,

        "products": products,
        "new_arrivals": new_arrivals,
    }

    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        html = render_to_string(
            "store/collections/partials/product_grid.html",
            context,
            request=request,
        )

        return JsonResponse({
            "ok": True,
            "html": html,
            "active_category": active_category,
            "page_title": page_title,
            "page_description": page_description,
        })

    return render(request, "store/collections/collections.html", context)


def product_detail_view(request, product_id):
    product = get_object_or_404(
        Product.objects
        .select_related("category")
        .filter(is_available=True)
        .prefetch_related("variants"),
        id=product_id,
    )

    variants = (
        product.variants
        .filter(is_available=True)
        .order_by("id")
    )

    related_fields = (
        "id",
        "name",
        "category",
        "category__name",
        "category__slug",
        "color_name",
        "color_code",
        "material",
        "actual_price",
        "offer_price",
        "main_image",
        "is_new_arrival",
        "created_at",
    )

    same_category_products = (
        Product.objects
        .select_related("category")
        .filter(is_available=True, category=product.category)
        .exclude(id=product.id)
        .only(*related_fields)
        .order_by("-created_at")[:4]
    )

    different_category_products = (
        Product.objects
        .select_related("category")
        .filter(is_available=True)
        .exclude(id=product.id)
        .exclude(category=product.category)
        .only(*related_fields)
        .order_by("-created_at")[:4]
    )

    context = {
        "product": product,
        "variants": variants,
        "same_category_products": same_category_products,
        "different_category_products": different_category_products,
    }

    return render(
        request,
        "store/product_detail/product_detail.html",
        context,
    )