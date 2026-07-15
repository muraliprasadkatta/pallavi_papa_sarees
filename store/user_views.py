from decimal import Decimal

from django.db.models import Prefetch, Q
from django.db.models.functions import Coalesce
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.template.loader import render_to_string
from django.templatetags.static import static
from django.utils.cache import patch_vary_headers
from .models import Category, Product, ProductSize, ProductSizeMeasurement, ProductVariant


def _card_variants_prefetch():
    return Prefetch(
        "variants",
        queryset=(
            ProductVariant.objects
            .filter(is_available=True)
            .only(
                "id",
                "product_id",
                "color_name",
                "color_code",
            )
            .order_by("id")
        ),
        to_attr="card_available_variants",
    )


def user_home_view(request):
    new_arrivals = (
        Product.objects
        .select_related("category")
        .prefetch_related(_card_variants_prefetch())
        .filter(is_available=True, is_new_arrival=True)
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "category__slug",
            "color_name",
            "color_code",
            "actual_price",
            "offer_price",
            "stock_quantity",
            "is_available",
            "main_image",
            "arrival_card_image",
            "created_at",
        )
        .order_by("-created_at")[:8]
    )

    latest_products = (
        Product.objects
        .select_related("category")
        .prefetch_related(_card_variants_prefetch())
        .filter(is_available=True)
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "category__slug",
            "color_name",
            "color_code",
            "actual_price",
            "offer_price",
            "stock_quantity",
            "is_available",
            "main_image",
            "arrival_card_image",
            "created_at",
        )
        .order_by("-created_at")[:8]
    )

    # Popular Items section:
    # offer_price unte offer_price base, lekapothe actual_price base.
    # Low price + latest products first 4 chupisthundhi.
    popular_items = (
        Product.objects
        .select_related("category")
        .prefetch_related(_card_variants_prefetch())
        .filter(is_available=True)
        .exclude(main_image="")
        .annotate(display_price=Coalesce("offer_price", "actual_price"))
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "category__slug",
            "color_name",
            "color_code",
            "actual_price",
            "offer_price",
            "stock_quantity",
            "is_available",
            "main_image",
            "arrival_card_image",
            "created_at",
        )
        .order_by("display_price", "-created_at")[:4]
    )

    showcase_products = (
        Product.objects
        .select_related("category")
        .prefetch_related(_card_variants_prefetch())
        .filter(is_available=True)
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "category__slug",
            "color_name",
            "color_code",
            "actual_price",
            "offer_price",
            "stock_quantity",
            "is_available",
            "main_image",
            "top_showcase_image",
            "is_top_selling",
            "is_most_liked",
            "is_most_carted",
            "created_at",
        )
    )

    top_selling_products = (
        showcase_products
        .filter(is_top_selling=True)
        .order_by("-created_at")[:12]
    )

    most_liked_products = (
        showcase_products
        .filter(is_most_liked=True)
        .order_by("-created_at")[:12]
    )

    most_carted_products = (
        showcase_products
        .filter(is_most_carted=True)
        .order_by("-created_at")[:12]
    )

    context = {
        "new_arrivals": new_arrivals,
        "latest_products": latest_products,
        "popular_items": popular_items,
        "top_selling_products": top_selling_products,
        "most_liked_products": most_liked_products,
        "most_carted_products": most_carted_products,
    }

    return render(request, "store/user_homepage/user_home.html", context)


def collections_page(request):
    active_category = (request.GET.get("category", "all") or "all").strip()
    active_sort = request.GET.get("sort", "newest")
    search_query = request.GET.get("q", "").strip()
    focus = request.GET.get("focus", "shop")
    active_price = request.GET.get("price", "").strip()

    try:
        more_page = int(request.GET.get("more_page", "1"))
    except (TypeError, ValueError):
        more_page = 1

    more_page = max(1, more_page)
    more_products_per_page = 8

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

    fallback_hero_images = {
        "all": static("store/collections/tabs/all.webp"),
        "pattu": static("store/collections/tabs/pattu.webp"),
        "cotton": static("store/collections/tabs/cotton.webp"),
        "silk": static("store/collections/tabs/silk.webp"),
        "designer": static("store/collections/tabs/designer.webp"),
        "wedding": static("store/collections/tabs/wedding.webp"),
        "daily": static("store/collections/tabs/daily.webp"),
    }

    all_products = (
        Product.objects
        .select_related("category")
        .prefetch_related(_card_variants_prefetch())
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
            "color_name",
            "color_code",
            "product_size",
            "stock_quantity",
            "actual_price",
            "offer_price",
            "main_image",
            "arrival_card_image",
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
    more_products_use_round_robin = False

    if focus == "new" and not search_query and active_category == "all":
        products = base_products

        more_products = all_products.exclude(is_new_arrival=True)

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
                more_products_use_round_robin = True

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

    def build_round_robin_products_by_category(queryset):
        grouped_products = {}

        for product in queryset:
            category_key = product.category_id or 0
            grouped_products.setdefault(category_key, []).append(product)

        category_groups = list(grouped_products.values())
        round_robin_products = []
        index = 0

        while True:
            added_product = False

            for category_items in category_groups:
                if index < len(category_items):
                    round_robin_products.append(category_items[index])
                    added_product = True

            if not added_product:
                break

            index += 1

        return round_robin_products

    products = apply_sort(products)
    more_products = apply_sort(more_products)

    if more_products_use_round_robin:
        more_products = build_round_robin_products_by_category(more_products)
    else:
        more_products = list(more_products)

    more_products_visible_count = more_page * more_products_per_page
    has_more_products = len(more_products) > more_products_visible_count
    show_more_products = bool(more_products)
    more_products = more_products[:more_products_visible_count]

    show_more_products_url = ""
    if has_more_products:
        show_more_query = request.GET.copy()
        show_more_query["more_page"] = str(more_page + 1)
        show_more_query.pop("partial", None)
        show_more_products_url = f"{request.path}?{show_more_query.urlencode()}#explore-other"

    new_arrivals = (
        Product.objects
        .select_related("category")
        .prefetch_related(_card_variants_prefetch())
        .filter(is_available=True, is_new_arrival=True)
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "category__slug",
            "color_name",
            "color_code",
            "actual_price",
            "offer_price",
            "stock_quantity",
            "is_available",
            "main_image",
            "arrival_card_image",
            "is_new_arrival",
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
        hero_image_url = fallback_hero_images.get("all", "")
    elif selected_category:
        page_title = category_titles.get(
            active_category,
            f"{selected_category.name} Collection"
        )
        page_description = category_descriptions.get(
            active_category,
            f"Browse our latest {selected_category.name.lower()} products."
        )
        hero_image_url = (
            selected_category.image.url
            if selected_category.image
            else fallback_hero_images.get(active_category, fallback_hero_images["all"])
        )
    else:
        page_title = category_titles.get(active_category, "All Products")
        page_description = category_descriptions.get(
            active_category,
            "Browse premium products."
        )
        hero_image_url = fallback_hero_images.get(active_category, fallback_hero_images["all"])

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
        "has_more_products": has_more_products,
        "show_more_products_url": show_more_products_url,

        "page_title": page_title,
        "page_description": page_description,
        "hero_image_url": hero_image_url,

        "products": products,
        "new_arrivals": new_arrivals,
    }

    is_products_partial = (
        request.GET.get("partial") == "products"
        and request.headers.get("x-requested-with") == "XMLHttpRequest"
    )

    if is_products_partial:
        html = render_to_string(
            "store/collections/partials/product_grid.html",
            context,
            request=request,
        )

        response = JsonResponse({
            "ok": True,
            "html": html,
            "active_category": active_category,
            "page_title": page_title,
            "page_description": page_description,
            "hero_image_url": hero_image_url,
        })

        response["Cache-Control"] = "no-store, max-age=0"
        patch_vary_headers(response, ["X-Requested-With"])

        return response

    return render(request, "store/collections/collections.html", context)


def _format_measurement_value(value):
    if value is None:
        return ""

    value = Decimal(value)

    if value == value.to_integral_value():
        return str(value.quantize(Decimal("1")))

    return str(value.normalize())


def _build_size_measurement_groups(product_sizes):
    groups = []

    for product_size in product_sizes:
        measurements = []
        default_unit = product_size.measurement_unit

        for label, value in (
            ("Chest", product_size.chest),
            ("Waist", product_size.waist),
            ("Length", product_size.length),
        ):
            if value is None:
                continue

            measurements.append({
                "label": label,
                "value": _format_measurement_value(value),
                "unit": default_unit,
            })

        for custom_measurement in getattr(product_size, "prefetched_custom_measurements", []):
            measurements.append({
                "label": custom_measurement.label,
                "value": _format_measurement_value(custom_measurement.value),
                "unit": custom_measurement.unit,
            })

        if measurements:
            groups.append({
                "size": product_size,
                "measurements": measurements,
            })

    return groups


def product_detail_view(request, product_id):
    size_measurements_queryset = ProductSizeMeasurement.objects.order_by(
        "sort_order",
        "id",
    )

    sizes_queryset = (
        ProductSize.objects
        .filter(is_available=True)
        .prefetch_related(
            Prefetch(
                "custom_measurements",
                queryset=size_measurements_queryset,
                to_attr="prefetched_custom_measurements",
            )
        )
        .order_by("sort_order", "id")
    )

    variants_queryset = (
        ProductVariant.objects
        .filter(is_available=True)
        .order_by("id")
    )

    product = get_object_or_404(
        Product.objects
        .select_related("category")
        .filter(is_available=True)
        .prefetch_related(
            Prefetch(
                "sizes",
                queryset=sizes_queryset,
                to_attr="display_sizes_for_detail",
            ),
            Prefetch(
                "variants",
                queryset=variants_queryset,
                to_attr="available_variants",
            ),
        ),
        id=product_id,
    )

    variants = list(getattr(product, "available_variants", []))
    # Keep stock-0 sizes in this list so the template can show them as
    # disabled Sold Out options instead of hiding them.
    available_sizes = list(getattr(product, "display_sizes_for_detail", []))
    in_stock_sizes = [
        product_size
        for product_size in available_sizes
        if product_size.stock_quantity > 0
    ]

    default_size = in_stock_sizes[0] if in_stock_sizes else (
        available_sizes[0] if available_sizes else None
    )

    legacy_product_size = (product.product_size or "").strip()
    size_measurement_groups = _build_size_measurement_groups(available_sizes)
    product_is_sold_out = (
        bool(available_sizes)
        and not in_stock_sizes
    ) or (
        not available_sizes
        and product.stock_quantity <= 0
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
        "stock_quantity",
        "is_available",
        "main_image",
        "arrival_card_image",
        "is_new_arrival",
        "created_at",
    )

    same_category_products = (
        Product.objects
        .select_related("category")
        .prefetch_related(_card_variants_prefetch())
        .filter(is_available=True, category=product.category)
        .exclude(id=product.id)
        .only(*related_fields)
        .order_by("-created_at")[:4]
    )

    different_category_products = (
        Product.objects
        .select_related("category")
        .prefetch_related(_card_variants_prefetch())
        .filter(is_available=True)
        .exclude(id=product.id)
        .exclude(category=product.category)
        .only(*related_fields)
        .order_by("-created_at")[:4]
    )

    context = {
        "product": product,
        "variants": variants,
        "available_sizes": available_sizes,
        "in_stock_sizes": in_stock_sizes,
        "default_size": default_size,
        "legacy_product_size": legacy_product_size,
        "has_size_options": bool(available_sizes),
        "product_is_sold_out": product_is_sold_out,
        "size_measurement_groups": size_measurement_groups,
        "same_category_products": same_category_products,
        "different_category_products": different_category_products,
    }

    return render(
        request,
        "store/product_detail/product_detail.html",
        context,
    )


def about_contact_page(request):
    return render(
        request,
        "store/user_homepage/partials/about_contact/about_contact.html",
    )


def cart_page(request):
    return render(request, "store/user_homepage/cart/cart.html")


def favorites_page(request):
    return render(request,"store/user_homepage/favorites/favorite_page.html")


def health_check(request):
    return HttpResponse("OK", content_type="text/plain")
