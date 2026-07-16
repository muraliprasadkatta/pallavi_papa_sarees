(function () {
  "use strict";

  let deferredInstallPrompt = null;
  let promptOpen = false;
  let installing = false;
  let appInstalledEventSeen = false;
  let installCheckTimer = null;

  const installButtons = Array.from(
    document.querySelectorAll("[data-pwa-install]")
  );

  const iosGuide = document.querySelector(
    "[data-pwa-ios-guide]"
  );

  const iosGuideCloseButtons = Array.from(
    document.querySelectorAll(
      "[data-pwa-ios-guide-close]"
    )
  );

  function isStandaloneMode() {
    return (
      window.matchMedia(
        "(display-mode: standalone)"
      ).matches
      || window.navigator.standalone === true
    );
  }

  function isIosDevice() {
    const userAgent = window.navigator.userAgent || "";
    const platform = window.navigator.platform || "";
    const maxTouchPoints =
      window.navigator.maxTouchPoints || 0;

    return (
      /iPhone|iPad|iPod/i.test(userAgent)
      || (
        platform === "MacIntel"
        && maxTouchPoints > 1
      )
    );
  }

  function updateInstallButtons(state) {
    installButtons.forEach(function (button) {
      const title = button.querySelector(
        "[data-pwa-install-title]"
      );
      const subtitle = button.querySelector(
        "[data-pwa-install-subtitle]"
      );

      const isInstalling = state === "installing";
      const isInstalled = state === "installed";
      const isHidden = state === "hidden";

      button.hidden = isHidden;
      button.disabled = isInstalling || isInstalled;
      button.classList.toggle(
        "is-installing",
        isInstalling
      );
      button.classList.toggle(
        "is-installed",
        isInstalled
      );
      button.setAttribute(
        "aria-hidden",
        isHidden ? "true" : "false"
      );
      button.setAttribute(
        "aria-busy",
        isInstalling ? "true" : "false"
      );

      if (title) {
        title.textContent = isInstalling
          ? "Installing App…"
          : isInstalled
            ? "App Installed ✓"
            : "Install App";
      }

      if (subtitle) {
        subtitle.textContent = isInstalling
          ? "Finishing setup on your device"
          : isInstalled
            ? "Open it from your home screen"
            : "Experience it like an app";
      }
    });
  }

  function openIosGuide() {
    if (!iosGuide) {
      return;
    }

    iosGuide.hidden = false;
    iosGuide.classList.add("is-open");
    document.documentElement.classList.add(
      "pwa-guide-open"
    );

    window.setTimeout(function () {
      iosGuide
        .querySelector("[data-pwa-ios-guide-close]")
        ?.focus();
    }, 0);
  }

  function closeIosGuide() {
    if (!iosGuide) {
      return;
    }

    iosGuide.classList.remove("is-open");
    iosGuide.hidden = true;
    document.documentElement.classList.remove(
      "pwa-guide-open"
    );
  }

  async function isAppActuallyInstalled() {
    if (
      typeof navigator.getInstalledRelatedApps
      !== "function"
    ) {
      return false;
    }

    try {
      const installedApps =
        await navigator.getInstalledRelatedApps();

      return installedApps.some(function (app) {
        return app.platform === "webapp";
      });
    } catch (error) {
      console.warn(
        "Unable to verify installed PWA:",
        error
      );
      return false;
    }
  }

  function finishInstall() {
    installing = false;
    window.clearTimeout(installCheckTimer);
    updateInstallButtons("installed");

    window.setTimeout(function () {
      updateInstallButtons("hidden");
    }, 4000);
  }

  async function checkInstallCompletion() {
    if (!installing) {
      return;
    }

    const canVerifyInstallation =
      typeof navigator.getInstalledRelatedApps
      === "function";

    if (
      canVerifyInstallation
      && await isAppActuallyInstalled()
    ) {
      finishInstall();
      return;
    }

    /*
     * Some browsers do not support installed-app verification.
     * In that fallback case, wait briefly after appinstalled instead
     * of switching to Installed in the same instant as confirmation.
     */
    if (!canVerifyInstallation && appInstalledEventSeen) {
      installCheckTimer = window.setTimeout(
        finishInstall,
        5000
      );
      return;
    }

    installCheckTimer = window.setTimeout(
      checkInstallCompletion,
      1000
    );
  }

  async function handleInstallClick() {
    if (isStandaloneMode()) {
      updateInstallButtons("hidden");
      return;
    }

    if (isIosDevice()) {
      openIosGuide();
      return;
    }

    if (!deferredInstallPrompt || promptOpen || installing) {
      return;
    }

    const installPrompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    promptOpen = true;

    try {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      promptOpen = false;

      if (choice.outcome !== "accepted") {
        updateInstallButtons("ready");
        return;
      }

      installing = true;
      updateInstallButtons("installing");

      /* Let the Installing state paint before checking completion. */
      installCheckTimer = window.setTimeout(
        checkInstallCompletion,
        1000
      );
    } catch (error) {
      console.error(
        "Pallavi Papa install prompt failed:",
        error
      );

      promptOpen = false;
      installing = false;
      updateInstallButtons("ready");
    }
  }

  installButtons.forEach(function (button) {
    button.addEventListener("click", handleInstallClick);
  });

  iosGuideCloseButtons.forEach(function (button) {
    button.addEventListener("click", closeIosGuide);
  });

  iosGuide?.addEventListener("click", function (event) {
    if (event.target === iosGuide) {
      closeIosGuide();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (
      event.key === "Escape"
      && iosGuide
      && !iosGuide.hidden
    ) {
      closeIosGuide();
    }
  });

  window.addEventListener(
    "beforeinstallprompt",
    function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;

      if (!isStandaloneMode() && !installing) {
        updateInstallButtons("ready");
      }
    }
  );

  window.addEventListener("appinstalled", function () {
    appInstalledEventSeen = true;
    deferredInstallPrompt = null;
    closeIosGuide();

    /*
     * Android can emit appinstalled before its WebAPK download/setup
     * notification has finished. Verification above decides when the
     * button may change from Installing to Installed.
     */
    if (!installing && !promptOpen) {
      updateInstallButtons("hidden");
    }
  });

  const standaloneMedia = window.matchMedia(
    "(display-mode: standalone)"
  );

  if (
    typeof standaloneMedia.addEventListener
    === "function"
  ) {
    standaloneMedia.addEventListener(
      "change",
      function (event) {
        if (event.matches) {
          updateInstallButtons("hidden");
          closeIosGuide();
        }
      }
    );
  }

  if (isStandaloneMode()) {
    updateInstallButtons("hidden");
  } else if (isIosDevice()) {
    updateInstallButtons("ready");
  } else {
    updateInstallButtons("hidden");
  }
})();
