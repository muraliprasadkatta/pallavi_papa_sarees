from django import template
from django.db.models import Prefetch

from store.models import OwnerHomePageRow, Product


register = template.Library()


@register.inclusion_tag(
    "store/user_homepage/partials/owner_home_rows.html",
    takes_context=True,
)
def render_owner_home_rows(context):
    homepage_products = (
        Product.objects
        .select_related("category")
        .filter(is_available=True)
        .exclude(main_image="")
        .only(
            "id",
            "name",
            "category",
            "category__name",
            "actual_price",
            "offer_price",
            "main_image",
            "arrival_card_image",
            "created_at",
        )
        .order_by("-created_at")
    )

    rows = (
        OwnerHomePageRow.objects
        .filter(is_active=True)
        .prefetch_related(
            Prefetch(
                "products",
                queryset=homepage_products,
                to_attr="homepage_products",
            )
        )
        .order_by("sort_order", "name")
    )

    visible_rows = [row for row in rows if row.homepage_products]

    return {
        "home_rows": visible_rows,
        "request": context.get("request"),
    }
