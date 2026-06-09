    (function () {
      if (window.__ppFavoritesReady) return;
      window.__ppFavoritesReady = true;

      const FAVORITES_KEY = "pp_favorites";

      function getFavorites() {
        try {
          const favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
          return Array.isArray(favorites) ? favorites : [];
        } catch (error) {
          return [];
        }
      }

      function saveFavorites(favorites) {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        window.dispatchEvent(new Event("pp-favorites-updated"));
      }

      function getProductData(button) {
        return {
          id: String(button.dataset.productId || "").trim(),
          name: button.dataset.productName || "Product",
          category: button.dataset.productCategory || "",
          price: Number(button.dataset.productPrice || 0),
          image: button.dataset.productImage || "",
          url: button.dataset.productUrl || ""
        };
      }

      function refreshFavoriteButtons() {
        const favorites = getFavorites();

        const favoriteIds = favorites.map(function (item) {
          return String(item.id);
        });

        document.querySelectorAll("[data-favorite-toggle]").forEach(function (button) {
          const productId = String(button.dataset.productId || "").trim();
          const isFavorited = favoriteIds.includes(productId);

          button.classList.toggle("is-favorited", isFavorited);
          button.setAttribute("aria-pressed", isFavorited ? "true" : "false");
          button.setAttribute(
            "aria-label",
            isFavorited ? "Remove from favorites" : "Add to favorites"
          );
        });
      }

      document.addEventListener("click", function (event) {
        const button = event.target.closest("[data-favorite-toggle]");
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const productData = getProductData(button);
        if (!productData.id) return;

        const favorites = getFavorites();

        const existingIndex = favorites.findIndex(function (item) {
          return String(item.id) === productData.id;
        });

        if (existingIndex >= 0) {
          favorites.splice(existingIndex, 1);
        } else {
          favorites.push(productData);
        }

        saveFavorites(favorites);
        refreshFavoriteButtons();
      });

      window.addEventListener("pp-favorites-updated", refreshFavoriteButtons);
      document.addEventListener("DOMContentLoaded", refreshFavoriteButtons);

      refreshFavoriteButtons();
    })();
