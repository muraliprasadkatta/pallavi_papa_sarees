(function () {
  "use strict";

  let deferredInstallPrompt = null;
  let installPromptOpen = false;
  let installInProgress = false;
  let installAccepted = false;
  let appInstallCompleted = false;
  let installedHideTimer = null;

  const installedConfirmationMs = 5000;

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
    const userAgent =
      window.navigator.userAgent || "";

    const platform =
      window.navigator.platform || "";

    const maxTouchPoints =
      window.navigator.maxTouchPoints || 0;

    const classicIos =
      /iPhone|iPad|iPod/i.test(userAgent);

    const ipadDesktopMode =
      platform === "MacIntel"
      && maxTouchPoints > 1;

    return classicIos || ipadDesktopMode;
  }

  function setInstallButtonsVisible(isVisible) {
    installButtons.forEach(function (button) {
      button.hidden = !isVisible;

      button.setAttribute(
        "aria-hidden",
        isVisible ? "false" : "true"
      );
    });
  }

  function setInstallButtonsBusy(isBusy) {
    installButtons.forEach(function (button) {
      const title = button.querySelector(
        "[data-pwa-install-title]"
      );

      const subtitle = button.querySelector(
        "[data-pwa-install-subtitle]"
      );

      button.disabled = isBusy;
      button.classList.toggle(
        "is-installing",
        isBusy
      );
      button.classList.remove("is-installed");

      button.setAttribute(
        "aria-busy",
        isBusy ? "true" : "false"
      );

      if (title) {
        title.textContent = isBusy
          ? "Installing App…"
          : "Install App";
      }

      if (subtitle) {
        subtitle.textContent = isBusy
          ? "Adding it to your device"
          : "Experience it like an app";
      }
    });
  }

  function setInstallButtonsInstalled() {
    installButtons.forEach(function (button) {
      const title = button.querySelector(
        "[data-pwa-install-title]"
      );

      const subtitle = button.querySelector(
        "[data-pwa-install-subtitle]"
      );

      button.disabled = true;
      button.classList.remove("is-installing");
      button.classList.add("is-installed");
      button.setAttribute("aria-busy", "false");

      if (title) {
        title.textContent = "App Installed ✓";
      }

      if (subtitle) {
        subtitle.textContent = "Open it from your home screen";
      }
    });
  }

  function beginInstallingState() {
    installAccepted = true;
    installInProgress = true;
    setInstallButtonsBusy(true);
    setInstallButtonsVisible(true);
  }

  function finishInstalledState() {
    installPromptOpen = false;
    installInProgress = false;
    installAccepted = false;

    window.clearTimeout(installedHideTimer);

    /*
     * appinstalled is the browser's installation-complete signal.
     * Keep a clear success confirmation visible because Android's
     * own notification can be missed among other notifications.
     */
    setInstallButtonsInstalled();
    setInstallButtonsVisible(true);

    installedHideTimer = window.setTimeout(
      function () {
        setInstallButtonsVisible(false);
        setInstallButtonsBusy(false);
      },
      installedConfirmationMs
    );
  }

  function handleInstallCompleted() {
    appInstallCompleted = true;
    deferredInstallPrompt = null;
    closeIosGuide();

    /*
     * Chrome may fire appinstalled before userChoice resolves.
     * While the native prompt is still open, wait for its result so
     * "Installing App…" can be shown after the user confirms.
     */
    if (installPromptOpen && !installAccepted) {
      return;
    }

    if (installAccepted || installInProgress) {
      finishInstalledState();
      return;
    }

    setInstallButtonsBusy(false);
    setInstallButtonsVisible(false);
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

    const firstCloseButton =
      iosGuide.querySelector(
        "[data-pwa-ios-guide-close]"
      );

    window.setTimeout(function () {
      firstCloseButton?.focus();
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

  async function handleInstallClick() {
    if (isStandaloneMode()) {
      setInstallButtonsVisible(false);
      return;
    }

    if (isIosDevice()) {
      openIosGuide();
      return;
    }

    if (
      !deferredInstallPrompt
      || installPromptOpen
      || installInProgress
    ) {
      return;
    }

    const currentInstallPrompt = deferredInstallPrompt;

    /* Each BeforeInstallPromptEvent can be used only once. */
    deferredInstallPrompt = null;
    installPromptOpen = true;

    try {
      currentInstallPrompt.prompt();

      const choiceResult =
        await currentInstallPrompt.userChoice;

      installPromptOpen = false;

      if (choiceResult.outcome === "dismissed") {
        /* Cancel: keep the normal Install App button visible. */
        installAccepted = false;
        installInProgress = false;
        setInstallButtonsBusy(false);
        setInstallButtonsVisible(true);
        return;
      }

      /*
       * Show "Installing App…" only after the user confirms
       * Install in the browser's native popup.
       */
      beginInstallingState();

      /*
       * If Chrome already completed the install before userChoice
       * resolved, still keep the Installing state visible briefly.
       */
      if (appInstallCompleted || isStandaloneMode()) {
        finishInstalledState();
      }
    } catch (error) {
      console.error(
        "Pallavi Papa install prompt failed:",
        error
      );

      installPromptOpen = false;
      installInProgress = false;
      installAccepted = false;
      setInstallButtonsBusy(false);
      setInstallButtonsVisible(true);
    }
  }

  installButtons.forEach(function (button) {
    button.addEventListener(
      "click",
      handleInstallClick
    );
  });

  iosGuideCloseButtons.forEach(
    function (button) {
      button.addEventListener(
        "click",
        closeIosGuide
      );
    }
  );

  iosGuide?.addEventListener(
    "click",
    function (event) {
      if (event.target === iosGuide) {
        closeIosGuide();
      }
    }
  );

  document.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key === "Escape"
        && iosGuide
        && !iosGuide.hidden
      ) {
        closeIosGuide();
      }
    }
  );

  window.addEventListener(
    "beforeinstallprompt",
    function (event) {
      event.preventDefault();

      deferredInstallPrompt = event;

      if (
        !isStandaloneMode()
        && !installPromptOpen
        && !installInProgress
      ) {
        setInstallButtonsBusy(false);
        setInstallButtonsVisible(true);
      }
    }
  );

  window.addEventListener(
    "appinstalled",
    handleInstallCompleted
  );

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
          handleInstallCompleted();
        }
      }
    );
  }

  setInstallButtonsBusy(false);

  if (isStandaloneMode()) {
    setInstallButtonsVisible(false);
  } else if (isIosDevice()) {
    setInstallButtonsVisible(true);
  } else {
    setInstallButtonsVisible(false);
  }
})();
