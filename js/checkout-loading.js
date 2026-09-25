/* ==========================================================================
   THE FLUTE ROOM — checkout-loading.js
   PURELY VISUAL countdown on the "Get the eBook" button while the existing
   flow opens Razorpay:  "Opening secure payment… 8s" → 7s → … → 1s,
   then "Still opening payment…" if it takes longer than 8 seconds.

   It does NOT control payment in any way:
   - It never opens, delays or waits for Razorpay, and makes no network calls.
   - js/ebook.js calls show() when the button switches to "Preparing
     payment..." and hide() the instant Razorpay opens (or the flow stops with
     an error) — whether that is after 50 ms or after the countdown ended.
   - Everything is wrapped in try/catch so it can never throw into payment code.

   Used by js/ebook.js through:  window.TFRCheckoutLoading.show() / .hide()
   ========================================================================== */
(function () {
  var COUNTDOWN_FROM = 8; // seconds

  var btn = null, timer = null, remaining = 0, active = false;

  function getBtn() {
    if (!btn) btn = document.getElementById("ebookSubmitBtn");
    return btn;
  }

  function render() {
    if (!btn) return;
    btn.textContent = remaining > 0
      ? "Opening secure payment… " + remaining + "s"
      : "Still opening payment…";
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function show() {
    try {
      if (!getBtn() || active) return;
      active = true;
      remaining = COUNTDOWN_FROM;
      btn.disabled = true;                    // double-click protection (ebook.js also guards)
      btn.setAttribute("aria-busy", "true");
      render();
      stopTimer();
      timer = setInterval(function () {
        try {
          if (!active) return stopTimer();
          if (remaining > 0) remaining--;
          render();
          if (remaining <= 0) stopTimer();     // keep "Still opening payment…" until hide()
        } catch (e) { /* visual only */ }
      }, 1000);
    } catch (e) { /* visual only — never affect checkout */ }
  }

  function hide() {
    try {
      stopTimer();
      if (!active) return;
      active = false;
      if (!getBtn()) return;
      btn.removeAttribute("aria-busy");
      // Restore the normal label. Enabling/disabling stays with js/ebook.js
      // (it re-enables the button when Razorpay is closed or fails).
      var price = (typeof EBOOK_CONFIG === "object" && EBOOK_CONFIG.EBOOK_PRICE) || 399;
      btn.textContent = "Get the eBook — ₹" + price;
    } catch (e) { /* visual only */ }
  }

  // Coming back via the Back button (page restored from cache): no stale timer.
  window.addEventListener("pageshow", function (e) { if (e.persisted) hide(); });

  window.TFRCheckoutLoading = { show: show, hide: hide };
})();
