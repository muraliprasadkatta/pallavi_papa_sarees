(function () {
  const splash = document.querySelector("[data-brand-splash]");

  if (!splash) return;

  const showOnce = splash.dataset.once === "true";
  const sessionKey = "pallaviPapaSareesSplashSeen";

  if (showOnce && sessionStorage.getItem(sessionKey) === "1") {
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
    sessionStorage.setItem(sessionKey, "1");
  }

  const minVisibleTime = 2200;
  const maxVisibleTime = 3200;

  // Must be slightly more than CSS close animation duration.
  // CSS close = 1050ms, JS waits = 1100ms.
  const exitAnimationTime = 1100;

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