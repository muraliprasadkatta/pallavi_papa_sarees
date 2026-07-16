(function () {
  "use strict";

  const shareButtons = document.querySelectorAll("[data-app-share]");

  if (!shareButtons.length) return;

  const SHARE_TITLE = "Pallavi Papa Sarees Collections";
  const SHARE_TEXT =
    "Beautiful sarees and latest collections from Pallavi Papa Sarees Collections.";
  const SHARE_URL = window.location.origin + "/";

  let toastTimer = null;

  function closeMenuDrawer() {
    const closeButton = document.querySelector(
      ".site-menu-drawer [data-site-menu-close]"
    );

    if (closeButton instanceof HTMLElement) {
      closeButton.click();
    }
  }

  function createToastStyles() {
    if (document.getElementById("appShareToastStyles")) return;

    const style = document.createElement("style");

    style.id = "appShareToastStyles";

    style.textContent = `
      .app-share-toast {
        position: fixed;
        left: 50%;
        bottom: max(
          24px,
          calc(env(safe-area-inset-bottom) + 18px)
        );
        z-index: 2200;

        min-width: min(310px, calc(100vw - 32px));
        max-width: calc(100vw - 32px);
        padding: 13px 18px;

        border: 1px solid rgba(13, 118, 88, 0.18);
        border-radius: 12px;

        color: #ffffff;
        background: #087052;

        box-shadow: 0 16px 36px rgba(5, 84, 62, 0.28);

        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;

        font-size: 13px;
        font-weight: 800;
        line-height: 1.35;
        text-align: center;

        opacity: 0;
        pointer-events: none;

        transform: translate(-50%, 14px);

        transition:
          opacity 180ms ease,
          transform 180ms ease;
      }

      .app-share-toast.is-visible {
        opacity: 1;
        transform: translate(-50%, 0);
      }

      @media (prefers-reduced-motion: reduce) {
        .app-share-toast {
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getToast() {
    let toast = document.getElementById("appShareToast");

    if (toast) return toast;

    createToastStyles();

    toast = document.createElement("div");

    toast.id = "appShareToast";
    toast.className = "app-share-toast";

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

  async function copyShareLink() {
    try {
      const copied = await copyUsingClipboard(SHARE_URL);

      if (copied) {
        return true;
      }
    } catch (error) {
      // Clipboard API failed. Use fallback.
    }

    return copyUsingFallback(SHARE_URL);
  }

  async function handleShare(button) {
    if (!(button instanceof HTMLButtonElement)) return;

    if (button.disabled) return;

    const shareData = {
      title: SHARE_TITLE,
      text: SHARE_TEXT,
      url: SHARE_URL,
    };

    button.disabled = true;

    try {
      if (typeof navigator.share === "function") {
        const sharePromise = navigator.share(shareData);

        closeMenuDrawer();

        await sharePromise;

        showToast("Shared successfully ✓");

        return;
      }

      const copied = await copyShareLink();

      closeMenuDrawer();

      if (copied) {
        showToast("App link copied ✓");
      } else {
        showToast("Unable to copy the app link");
      }
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }

      const copied = await copyShareLink();

      closeMenuDrawer();

      if (copied) {
        showToast("App link copied ✓");
      } else {
        showToast("Unable to share right now");
      }
    } finally {
      button.disabled = false;
    }
  }

  shareButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      handleShare(button);
    });
  });
})();