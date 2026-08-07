(function () {
  const splash = document.querySelector("[data-brand-splash]");

  if (!splash) return;

  const startUrlSource = new URLSearchParams(window.location.search).get("source");

  const isInstalledApp =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) ||
    window.navigator.standalone === true ||
    document.referrer.indexOf("android-app://") === 0 ||
    startUrlSource === "pwa";

  /*
    Android/iOS already shows the native launch screen for an installed PWA.
    Remove the website splash immediately so the app opens straight to home.
  */
  if (isInstalledApp) {
    document.documentElement.classList.add("ps-standalone-app");
    document.body.classList.remove("ps-splash-active");
    splash.remove();
    return;
  }

  const showOnce = splash.dataset.once === "true";
  const sessionKey = "pallaviPapaSareesSplashSeen";
  let wasAlreadySeen = false;

  try {
    wasAlreadySeen = sessionStorage.getItem(sessionKey) === "1";
  } catch (error) {
    wasAlreadySeen = false;
  }

  if (showOnce && wasAlreadySeen) {
    document.documentElement.classList.add("ps-splash-seen");
    splash.remove();
    return;
  }

  document.body.classList.add("ps-splash-active");

  /*
    Mark as seen immediately.
    So refresh/page navigation after splash starts will not show splash again.
  */
  if (showOnce) {
    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch (error) {
      // Continue normally when storage is blocked by browser settings.
    }
  }

  const prefersReducedMotion =
    window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /*
    Keep the website-only first-visit splash short.
    Installed PWA/APK launches are already returned above and skip this timer.
  */
  const minVisibleTime = prefersReducedMotion ? 0 : 650;
  const maxVisibleTime = prefersReducedMotion ? 0 : 1200;

  // Must stay slightly above the CSS close-animation duration.
  const exitAnimationTime = prefersReducedMotion ? 0 : 320;

  const startTime = performance.now();

  let isHidden = false;

  function finishSplash() {
    splash.classList.add("is-hidden");
    document.body.classList.remove("ps-splash-active");
    splash.remove();
  }

  function hideSplash() {
    if (isHidden) return;
    isHidden = true;

    const elapsed = performance.now() - startTime;
    const remainingTime = Math.max(0, minVisibleTime - elapsed);

    window.setTimeout(function () {
      splash.classList.add("is-leaving");
      window.setTimeout(finishSplash, exitAnimationTime);
    }, remainingTime);
  }

  if (document.readyState === "complete") {
    hideSplash();
  } else {
    window.addEventListener("load", hideSplash, { once: true });
  }

  window.setTimeout(hideSplash, maxVisibleTime);
})();