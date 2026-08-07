(function () {
  "use strict";

  if (window.__ppProductShareReady) return;
  window.__ppProductShareReady = true;

  let toastTimer = null;

  function cleanText(value) {
    return String(value || "").trim();
  }

  function getSelectedVariant(button) {
    if (!button.hasAttribute("data-product-share-current-url")) {
      return null;
    }

    try {
      return window.PPProductVariant?.getSelectedVariant?.() || null;
    } catch (error) {
      return null;
    }
  }

  function getShareUrl(button) {
    const useCurrentUrl = button.hasAttribute(
      "data-product-share-current-url"
    );

    const rawUrl = useCurrentUrl
      ? window.location.href
      : cleanText(button.dataset.productUrl);

    const url = new URL(rawUrl || window.location.href, window.location.origin);
    url.hash = "";

    return url.toString();
  }

  function formatPrice(value) {
    const price = Number(value || 0);

    if (!Number.isFinite(price) || price <= 0) {
      return "";
    }

    return "₹" + price.toLocaleString("en-IN");
  }

  function getShareData(button) {
    const variant = getSelectedVariant(button);
    const productName = cleanText(button.dataset.productName) || "Product";
    const category = cleanText(button.dataset.productCategory);
    const variantColor = cleanText(variant?.colorName);
    const price = formatPrice(
      variant?.price || button.dataset.productPrice
    );

    const displayName = variantColor
      && variantColor.toLowerCase() !== "base color"
      && variantColor.toLowerCase() !== "variant"
        ? productName + " - " + variantColor
        : productName;

    const details = [category, price].filter(Boolean).join(" • ");

    return {
      title: displayName + " | Pallavi Papa Sarees",
      text:
        "Check out "
        + displayName
        + (details ? " — " + details : "")
        + " at Pallavi Papa Sarees Collections.",
      url: getShareUrl(button)
    };
  }

  function getToast() {
    let toast = document.getElementById("productShareToast");

    if (toast) return toast;

    toast = document.createElement("div");
    toast.id = "productShareToast";
    toast.className = "product-share-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");

    document.body.appendChild(toast);

    return toast;
  }

  function showToast(message) {
    const toast = getToast();

    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");

    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  async function copyUsingClipboard(text) {
    if (!navigator.clipboard || !window.isSecureContext) {
      return false;
    }

    await navigator.clipboard.writeText(text);
    return true;
  }

  function copyUsingFallback(text) {
    const textArea = document.createElement("textarea");

    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }

    textArea.remove();
    return copied;
  }

  async function copyShareUrl(url) {
    try {
      const copied = await copyUsingClipboard(url);

      if (copied) return true;
    } catch (error) {
      // The Clipboard API can fail when browser permission is denied.
    }

    return copyUsingFallback(url);
  }

  async function handleShare(button) {
    if (button.disabled) return;

    const shareData = getShareData(button);

    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        showToast("Product shared successfully ✓");
        return;
      }

      const copied = await copyShareUrl(shareData.url);

      showToast(
        copied
          ? "Product link copied ✓"
          : "Unable to copy the product link"
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      const copied = await copyShareUrl(shareData.url);

      showToast(
        copied
          ? "Product link copied ✓"
          : "Unable to share right now"
      );
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  document.addEventListener("click", function (event) {
    if (!(event.target instanceof Element)) return;

    const button = event.target.closest("[data-product-share]");

    if (!(button instanceof HTMLButtonElement)) return;

    event.preventDefault();
    event.stopPropagation();

    handleShare(button);
  });
})();