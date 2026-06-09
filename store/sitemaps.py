from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from .models import Category, Product


class StaticViewSitemap(Sitemap):
    changefreq = "weekly"
    priority = 1.0

    def items(self):
        return [
            "store:user_home",
            "store:collections",
        ]

    def location(self, item):
        return reverse(item)


class CategorySitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.8

    def items(self):
        return Category.objects.filter(is_active=True).order_by("sort_order", "name")

    def location(self, obj):
        return reverse("store:collections") + f"?category={obj.slug}"


class ProductSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.9

    def items(self):
        return Product.objects.filter(is_available=True).order_by("-updated_at")

    def lastmod(self, obj):
        return obj.updated_at

    def location(self, obj):
        return reverse("store:product_detail", kwargs={"product_id": obj.id})