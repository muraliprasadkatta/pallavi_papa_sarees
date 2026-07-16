(function () {
  "use strict";

  let deferredInstallPrompt = null;

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

    if (!deferredInstallPrompt) {
      return;
    }

    const currentInstallPrompt = deferredInstallPrompt;

    /*
     * A BeforeInstallPromptEvent can be used only once.
     * Clear only the event being consumed here. If the browser fires a new
     * beforeinstallprompt event after a dismissal, the global variable will
     * receive that fresh event and the Install option remains usable.
     */
    deferredInstallPrompt = null;

    try {
      currentInstallPrompt.prompt();

      const choiceResult =
        await currentInstallPrompt.userChoice;

      if (choiceResult.outcome === "accepted") {
        setInstallButtonsVisible(false);
      } else {
        /* User pressed Cancel: keep the Install option visible. */
        setInstallButtonsVisible(true);
      }
    } catch (error) {
      console.error(
        "Pallavi Papa install prompt failed:",
        error
      );

      /* A temporary prompt error must not permanently remove the option. */
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

      if (!isStandaloneMode()) {
        setInstallButtonsVisible(true);
      }
    }
  );

  window.addEventListener(
    "appinstalled",
    function () {
      deferredInstallPrompt = null;

      setInstallButtonsVisible(false);
      closeIosGuide();
    }
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
          setInstallButtonsVisible(false);
          closeIosGuide();
        }
      }
    );
  }

  if (isStandaloneMode()) {
    setInstallButtonsVisible(false);
  } else if (isIosDevice()) {
    setInstallButtonsVisible(true);
  } else {
    setInstallButtonsVisible(false);
  }
})();