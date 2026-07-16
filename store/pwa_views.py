from django.http import JsonResponse
from django.shortcuts import render
from django.templatetags.static import static
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


PWA_ASSET_VERSION = "2"


def _pwa_asset(path):
    return f"{static(path)}?v={PWA_ASSET_VERSION}"


@require_GET
@never_cache
def pwa_manifest_view(request):
    """
    Return the Progressive Web App manifest.

    Install colors:
    - Emerald green primary
    - Gold accent
    - Warm white background
    """

    home_url = reverse("store:user_home")
    collections_url = reverse("store:collections")
    favorites_url = reverse("store:favorites")
    cart_url = reverse("store:cart")

    manifest = {
        "name": "Pallavi Papa Sarees Collections",
        "short_name": "Pallavi Papa",
        "description": (
            "Explore sarees, dresses and the latest collections "
            "from Pallavi Papa Collections."
        ),
        "id": home_url,
        "start_url": f"{home_url}?source=pwa",
        "scope": home_url,
        "display": "standalone",
        "background_color": "#eff4da",
        "theme_color": "#eff4da",
        "lang": "en-IN",
        "dir": "ltr",
        "related_applications": [
            {
                "platform": "webapp",
                "url": reverse("pwa_manifest"),
                "id": request.build_absolute_uri(home_url),
            }
        ],
        "icons": [
            {
                "src": _pwa_asset("store/pwa/icons/icon-192.png"),
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": _pwa_asset("store/pwa/icons/icon-512.png"),
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": _pwa_asset("store/pwa/icons/icon-maskable-512.png"),
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable",
            },
        ],
        "shortcuts": [
            {
                "name": "Collections",
                "short_name": "Collections",
                "description": "Browse all collections",
                "url": collections_url,
                "icons": [
                    {
                        "src": _pwa_asset("store/pwa/icons/icon-192.png"),
                        "sizes": "192x192",
                        "type": "image/png",
                    }
                ],
            },
            {
                "name": "New Arrivals",
                "short_name": "New Arrivals",
                "description": "View the latest products",
                "url": f"{collections_url}?focus=new",
                "icons": [
                    {
                        "src": _pwa_asset("store/pwa/icons/icon-192.png"),
                        "sizes": "192x192",
                        "type": "image/png",
                    }
                ],
            },
            {
                "name": "Favorites",
                "short_name": "Favorites",
                "description": "Open saved products",
                "url": favorites_url,
                "icons": [
                    {
                        "src": _pwa_asset("store/pwa/icons/icon-192.png"),
                        "sizes": "192x192",
                        "type": "image/png",
                    }
                ],
            },
            {
                "name": "Cart",
                "short_name": "Cart",
                "description": "Review selected products",
                "url": cart_url,
                "icons": [
                    {
                        "src": _pwa_asset("store/pwa/icons/icon-192.png"),
                        "sizes": "192x192",
                        "type": "image/png",
                    }
                ],
            },
        ],
    }

    response = JsonResponse(
        manifest,
        content_type="application/manifest+json",
        json_dumps_params={
            "ensure_ascii": False,
            "indent": 2,
        },
    )

    response["X-Content-Type-Options"] = "nosniff"

    return response


@require_GET
@never_cache
def service_worker_view(request):
    """
    Serve the service worker from the website root:

        /service-worker.js

    Serving it from the root allows it to control the public website.
    """

    context = {
        "home_url": reverse("store:user_home"),
        "offline_url": reverse("pwa_offline"),
        "manifest_url": reverse("pwa_manifest"),
        "icon_url": _pwa_asset("store/pwa/icons/icon-192.png"),
    }

    response = render(
        request,
        "store/pwa/service-worker.js",
        context,
        content_type="application/javascript; charset=utf-8",
    )

    response["Service-Worker-Allowed"] = "/"
    response["X-Content-Type-Options"] = "nosniff"

    return response


@require_GET
def pwa_offline_view(request):
    """
    Offline fallback page displayed when navigation fails
    because the device has no internet connection.
    """

    return render(
        request,
        "store/pwa/offline.html",
        status=200,
    )