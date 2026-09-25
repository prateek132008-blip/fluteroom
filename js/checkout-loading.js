/* ==========================================================================
   THE FLUTE ROOM — checkout-loading.js
   PURELY VISUAL reassurance screen shown between "Get the eBook" (form
   submit) and the Razorpay payment window opening.

   It does NOT control payment in any way:
   - It never opens, delays or waits for Razorpay.
   - It makes no network requests.
   - The countdown is decoration only. js/ebook.js hides this screen the
     instant Razorpay opens (or the flow stops with an error), whether that
     happens after 1 second or after the countdown has ended.
   - Every function is wrapped in try/catch so a problem here can never throw
     into the payment code.

   Used by js/ebook.js through:  window.TFRCheckoutLoading.show() / .hide()
   Markup + styles: #checkoutLoading in alankaars-ebook.html.
   ========================================================================== */
(function () {
  var COUNTDOWN_FROM = 8;        // seconds shown in "Opening payment page in N seconds…"
  var FAILSAFE_HIDE_MS = 30000;  // visual safety net: never leave the screen up forever

  var el, countEl, msgEl, subEl;
  var tickTimer = null, failsafeTimer = null, remaining = 0, visible = false;

  function grab() {
    if (el) return true;
    el = document.getElementById("checkoutLoading");
    if (!el) return false;
    countEl = document.getElementById("checkoutLoadingCount");
    msgEl = document.getElementById("checkoutLoadingTitle");
    subEl = document.getElementById("checkoutLoadingSub");
    return true;
  }

  function setCountText() {
    if (!countEl) return;
    if (remaining > 0) {
      countEl.textContent = "Opening payment page in " + remaining + (remaining === 1 ? " second…" : " seconds…");
    } else {
      // Past 8 s: be honest — nothing has been paid, it's just slower.
      countEl.textContent = "Taking a little longer than usual… Please wait.";
    }
  }

  function clearTimers() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (failsafeTimer) { clearTimeout(failsafeTimer); failsafeTimer = null; }
  }

  function show() {
    try {
      if (!grab() || visible) return;
      visible = true;
      remaining = COUNTDOWN_FROM;
      if (msgEl) msgEl.textContent = "Processing your request…";
      if (subEl) subEl.textContent = "Your secure payment page will open shortly.";
      setCountText();
      el.classList.add("open");
      el.setAttribute("aria-hidden", "false");
      clearTimers();
      tickTimer = setInterval(function () {
        try {
          if (remaining > 0) remaining--;
          setCountText();
          if (remaining <= 0 && tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        } catch (e) { /* visual only */ }
      }, 1000);
      failsafeTimer = setTimeout(hide, FAILSAFE_HIDE_MS);
    } catch (e) { /* visual only — never affect checkout */ }
  }

  function hide() {
    try {
      clearTimers();
      visible = false;
      if (!grab()) return;
      el.classList.remove("open");
      el.setAttribute("aria-hidden", "true");
    } catch (e) { /* visual only */ }
  }

  // If the customer comes back to this page via the Back button (page
  // restored from cache), never show a stale loading screen.
  window.addEventListener("pageshow", function () { hide(); });

  window.TFRCheckoutLoading = { show: show, hide: hide };
})();
