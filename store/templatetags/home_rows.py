from django import template
from django.db.models import Prefetch

from store.models import OwnerHomePageRow, Product, ProductVariant


register = template.Library()
HOME_ROWS_CACHE_KEY = "store_owner_home_rows_by_position"


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


@register.inclusion_tag(
    "store/user_homepage/partials/owner_home_rows.html",
    takes_context=True,
)
def render_owner_home_rows(context, display_after):
    rows_by_position = context.render_context.get(HOME_ROWS_CACHE_KEY)

    if rows_by_position is None:
        homepage_products = (
            Product.objects
            .select_related("category")
            .prefetch_related(_card_variants_prefetch())
            .filter(is_available=True)
            .exclude(main_image="")
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
                "is_new_arrival",
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

        rows_by_position = {
            value: []
            for value, _label in OwnerHomePageRow.DisplayAfter.choices
        }

        for row in rows:
            if row.homepage_products:
                rows_by_position.setdefault(row.display_after, []).append(row)

        context.render_context[HOME_ROWS_CACHE_KEY] = rows_by_position

    return {
        "home_rows": rows_by_position.get(display_after, []),
        "request": context.get("request"),
    }
