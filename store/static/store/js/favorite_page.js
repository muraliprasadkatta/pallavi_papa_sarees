    (function () {
      const favItemsEl = document.querySelector("[data-favorite-items]");
      const emptyEl = document.querySelector("[data-favorite-empty]");

      function getFavorites() {
        try {
          const favorites = JSON.parse(localStorage.getItem("pp_favorites") || "[]");
          return Array.isArray(favorites) ? favorites : [];
        } catch (error) {
          return [];
        }
      }

      function saveFavorites(favorites) {
        localStorage.setItem("pp_favorites", JSON.stringify(favorites));
        window.dispatchEvent(new Event("pp-favorites-updated"));
      }

      function getCart() {
        try {
          const cart = JSON.parse(localStorage.getItem("pp_cart") || "[]");
          return Array.isArray(cart) ? cart : [];
        } catch (error) {
          return [];
        }
      }

      function saveCart(cart) {
        localStorage.setItem("pp_cart", JSON.stringify(cart));
        window.dispatchEvent(new Event("pp-cart-updated"));
      }

      function money(value) {
        return Number(value || 0).toLocaleString("en-IN");
      }

      function safeText(value) {
        return String(value || "");
      }

      function addToCart(item, button) {
        const productId = String(item.id || "").trim();
        if (!productId) return;

        const cart = getCart();

        const existingItem = cart.find(function (cartItem) {
          return String(cartItem.id) === productId;
        });

        const oldText = button ? button.textContent : "";

        if (existingItem) {
          if (button) {
            button.classList.add("is-added");
            button.textContent = "Already in Cart ✓";

            setTimeout(function () {
              button.classList.remove("is-added");
              button.textContent = oldText;
            }, 650);
          }

          return;
        }

        cart.push({
          id: productId,
          name: item.name || "Product",
          category: item.category || "",
          price: Number(item.price || 0),
          image: item.image || "",
          url: item.url || "",
          qty: 1
        });

        saveCart(cart);

        if (button) {
          button.classList.add("is-added");
          button.textContent = "Added ✓";

          setTimeout(function () {
            button.classList.remove("is-added");
            button.textContent = oldText;
          }, 650);
        }
      }


      function removeFavorite(productId) {
        const updatedFavorites = getFavorites().filter(function (item) {
          return String(item.id) !== String(productId);
        });

        saveFavorites(updatedFavorites);
        renderFavorites();
      }

      function createFavoriteCard(item) {
        const article = document.createElement("article");
        article.className = "fav-card";

        const imageLink = document.createElement("a");
        imageLink.className = "fav-img";
        imageLink.href = item.url || "#";

        if (item.image) {
          const img = document.createElement("img");
          img.src = item.image;
          img.alt = safeText(item.name || "Favorite product");
          img.loading = "lazy";
          imageLink.appendChild(img);
        }

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "fav-remove";
        removeBtn.setAttribute("aria-label", "Remove favorite");
        removeBtn.textContent = "×";

        const body = document.createElement("div");
        body.className = "fav-body";

        const title = document.createElement("h2");
        title.textContent = safeText(item.name || "Product");

        const category = document.createElement("p");
        category.className = "fav-category";
        category.textContent = safeText(item.category || "Pallavi Papa Collection");

        const price = document.createElement("div");
        price.className = "fav-price";
        price.textContent = "₹" + money(item.price);

        const actions = document.createElement("div");
        actions.className = "fav-actions";

        const viewLink = document.createElement("a");
        viewLink.className = "fav-view";
        viewLink.href = item.url || "#";
        viewLink.textContent = "View Product";

        const cartBtn = document.createElement("button");
        cartBtn.type = "button";
        cartBtn.className = "fav-cart";
        cartBtn.textContent = "Add to Cart";

        actions.appendChild(viewLink);
        actions.appendChild(cartBtn);

        body.appendChild(title);
        body.appendChild(category);
        body.appendChild(price);
        body.appendChild(actions);

        article.appendChild(imageLink);
        article.appendChild(removeBtn);
        article.appendChild(body);

        removeBtn.addEventListener("click", function () {
          removeFavorite(item.id);
        });

        cartBtn.addEventListener("click", function () {
          addToCart(item, cartBtn);
        });

        return article;
      }

      function renderFavorites() {
        const favorites = getFavorites();

        if (!favItemsEl) return;

        favItemsEl.innerHTML = "";

        favorites.forEach(function (item) {
          favItemsEl.appendChild(createFavoriteCard(item));
        });

        favItemsEl.hidden = favorites.length === 0;

        if (emptyEl) {
          emptyEl.hidden = favorites.length > 0;
        }
      }

      renderFavorites();
    })();
