from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, include


def robots_txt(request):
    content = """User-agent: *
Allow: /

Sitemap: https://pallavipapacollections.online/sitemap.xml
"""
    return HttpResponse(content, content_type="text/plain")


def sitemap_xml(request):
    content = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://pallavipapacollections.online/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>

  <url>
    <loc>https://pallavipapacollections.online/collections/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
"""
    return HttpResponse(content, content_type="application/xml")


urlpatterns = [
    path("robots.txt", robots_txt, name="robots_txt"),
    path("sitemap.xml", sitemap_xml, name="sitemap_xml"),

    path("admin/", admin.site.urls),

    # Owner panel
    path("owner/", include("store.owner_urls")),

    # Public/user website
    path("", include("store.user_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)