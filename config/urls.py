from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.http import HttpResponse
from django.urls import path, include

from store.sitemaps import StaticViewSitemap, CategorySitemap, ProductSitemap


def robots_txt(request):
    content = """User-agent: *
Allow: /

Disallow: /admin/
Disallow: /owner/
Disallow: /cart/
Disallow: /favorites/

Sitemap: https://pallavipapacollections.online/sitemap.xml
"""
    return HttpResponse(content, content_type="text/plain")


sitemaps = {
    "static": StaticViewSitemap,
    "categories": CategorySitemap,
    "products": ProductSitemap,
}


urlpatterns = [
    path("robots.txt", robots_txt, name="robots_txt"),
    path("sitemap.xml", sitemap, {"sitemaps": sitemaps}, name="sitemap"),

    path("admin/", admin.site.urls),

    # Owner panel
    path("owner/", include("store.owner_urls")),

    # Public/user website
    path("", include("store.user_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)