from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.http import HttpResponse
from django.urls import include, path

from store.pwa_views import (
    pwa_manifest_view,
    pwa_offline_view,
    service_worker_view,
)
from store.sitemaps import (
    CategorySitemap,
    ProductSitemap,
    StaticViewSitemap,
)


def robots_txt(request):
    content = """User-agent: *
Allow: /

Disallow: /admin/
Disallow: /owner/
Disallow: /cart/
Disallow: /favorites/

Sitemap: https://pallavipapacollections.online/sitemap.xml
"""
    return HttpResponse(
        content,
        content_type="text/plain",
    )


sitemaps = {
    "static": StaticViewSitemap,
    "categories": CategorySitemap,
    "products": ProductSitemap,
}


urlpatterns = [
    # SEO
    path(
        "robots.txt",
        robots_txt,
        name="robots_txt",
    ),
    path(
        "sitemap.xml",
        sitemap,
        {"sitemaps": sitemaps},
        name="sitemap",
    ),

    # Progressive Web App
    path(
        "manifest.webmanifest",
        pwa_manifest_view,
        name="pwa_manifest",
    ),
    path(
        "service-worker.js",
        service_worker_view,
        name="service_worker",
    ),
    path(
        "offline/",
        pwa_offline_view,
        name="pwa_offline",
    ),

    # Django admin
    path(
        "admin/",
        admin.site.urls,
    ),

    # Owner panel
    path(
        "owner/",
        include("store.owner_urls"),
    ),

    # Public/user website
    # Keep this last because it starts with an empty path.
    path(
        "",
        include("store.user_urls"),
    ),
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )