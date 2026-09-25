/* ==========================================================================
   THE FLUTE ROOM — ebook.js
   Powers ONLY the /alankaars-ebook.html sales page for "30 Alankaras for
   Flute". Completely separate from js/main.js (the flute-class enrollment
   flow) — nothing here touches the existing enrollment form, sheet, or
   student-code logic.

   Reuses: the SAME Meta Pixel (already initialized in this page's <head>,
   same ID as the rest of the site) and the SAME Razorpay public key from
   js/config.js (SITE_CONFIG). Talks to a SEPARATE Apps Script
   (EBOOK_CONFIG.EBOOK_GOOGLE_SCRIPT_URL).

   Sections: 1) Form + validation  2) Razorpay order + checkout
             3) Payment recovery (UPI app hand-off / stuck "processing")
             4) Apps Script calls  5) Meta Pixel events

   PAYMENT-FLOW CHANGES IN THIS VERSION (see audit notes):
   - A real Razorpay ORDER is created server-side (Apps Script) and passed to
     checkout as order_id. Previously no order was created, so Razorpay's
     auto-capture setting did not apply and payments could stay "authorized".
     The order is PRE-FETCHED in the background as soon as the customer
     starts filling the form, so checkout normally opens instantly. The wait
     on submit is capped at 6 s; if Apps Script is slow/down, checkout still
     opens (order-less fallback) — the server captures those payments later.
   - The same order + attempt ID is REUSED when the customer retries, so a
     failed-then-successful purchase is ONE sheet row, not a stale "Pending"
     row plus a separate paid row.
   - RECOVERY: if the checkout success handler never runs (page reloaded /
     killed while the customer was in the UPI app, or Razorpay's "Payment
     processing" screen never resolves), the page asks the server — which
     asks Razorpay — whether the order was paid, and sends the customer to
     the Thank You page if it was. Runs when the tab becomes visible again
     during checkout, after the popup is closed, and on the next page load.
   - The success handler no longer depends on localStorage/sessionStorage
     working (they can throw in some in-app browsers); the payment ID is
     carried in the Thank You page URL.
   - A missing/failed checkout.js no longer leaves the button stuck on
     "Preparing payment..." forever.
   - The eBook link is no longer shipped to the browser — it is emailed by
     the server only after the payment is verified.
   - PAYMENT-FAILED RECOVERY POPUP: when Razorpay reports a failed payment
     (or the payment window can't load), a popup offers Retry Payment (same
     order, no reload), Scan & Pay QR, Copy UPI ID, WhatsApp screenshot and
     Call support. Closing the Razorpay window without a failed payment does
     NOT show it. The "already paid?" safety check on retry now runs in
     parallel instead of being awaited before checkout.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Fill in price / cover image from config ----
  document.querySelectorAll("[data-ebook-price]").forEach(el => {
    el.textContent = "₹" + EBOOK_CONFIG.EBOOK_PRICE;
  });
  const coverImg = document.getElementById("ebookCoverImg");
  if (coverImg) coverImg.src = EBOOK_CONFIG.EBOOK_COVER_IMAGE;

  /* ============ SAFE STORAGE (new) ============
     localStorage / sessionStorage can THROW (private mode, blocked cookies,
     some Instagram/Facebook in-app browsers). Previously an exception here
     inside the Razorpay success handler would stop window.location.replace()
     from ever running — a paid customer stuck on "Confirming payment...". */
  function storeGet(area, key) {
    try { return window[area].getItem(key); } catch (e) { return null; }
  }
  function storeSet(area, key, value) {
    try { window[area].setItem(key, value); } catch (e) { /* ignore */ }
  }
  function storeRemove(area, key) {
    try { window[area].removeItem(key); } catch (e) { /* ignore */ }
  }

  /* ============ MOBILE NAV DRAWER (same behavior as the rest of the site) ============ */
  const drawer = document.getElementById("mobileDrawer");
  const navToggle = document.getElementById("navToggle");
  const drawerClose = document.getElementById("drawerClose");
  if (navToggle && drawer) navToggle.addEventListener("click", () => drawer.classList.add("open"));
  if (drawerClose && drawer) drawerClose.addEventListener("click", () => drawer.classList.remove("open"));
  if (drawer) drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", () => drawer.classList.remove("open")));

  /* ============ HEADER SCROLL STATE ============ */
  const header = document.getElementById("siteHeader");
  if (header) {
    window.addEventListener("scroll", () => {
      header.classList.toggle("scrolled", window.scrollY > 12);
    }, { passive: true });
  }

  /* ============ SCROLL REVEAL ============ */
  const revealEls = document.querySelectorAll(".reveal, .reveal-stagger");
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el => io.observe(el));

  // Stable per-session ID used to build unique, deduplicated Pixel event IDs —
  // kept separate from main.js's tfr_session_id so the two flows never collide.
  if (!storeGet("sessionStorage", "tfr_ebook_session_id")) {
    storeSet("sessionStorage", "tfr_ebook_session_id", Date.now() + "_" + Math.random().toString(36).slice(2));
  }

  /* ============ EBOOK PREVIEW NAVIGATOR ============
     View-only page viewer for the "Preview the eBook" section. Pages are
     pre-rendered images from the preview PDF (assets/ebook-preview/) — the
     PDF itself is never linked from the page. Right-click/drag are disabled
     on the image, and a tiled "PREVIEW" watermark (pure CSS) sits over every
     page — casual-copy deterrents only. Completely separate from the
     form/Razorpay/Pixel/Sheet logic below. (Moved above the form code,
     unchanged, so it can never be skipped by an early return.) */
  const previewImages = [
    "assets/ebook-preview/alankaar-preview-1.webp",
    "assets/ebook-preview/alankaar-preview-2.webp",
    "assets/ebook-preview/alankaar-preview-3.webp",
    "assets/ebook-preview/alankaar-preview-4.webp",
    "assets/ebook-preview/alankaar-preview-5.webp",
    "assets/ebook-preview/alankaar-preview-6.webp",
    "assets/ebook-preview/alankaar-preview-7.webp"
  ];
  let previewIndex = 0;
  const previewImg = document.getElementById("ebookPreviewImg");
  const previewCounter = document.getElementById("previewCounter");
  const previewPrevBtn = document.getElementById("previewPrevBtn");
  const previewNextBtn = document.getElementById("previewNextBtn");
  const previewWatermark = document.querySelector(".ebook-preview-watermark");
  const PREVIEW_NO_WATERMARK_INDEXES = [previewImages.length - 1]; // last page only

  function updatePreview() {
    if (!previewImg) return;
    previewImg.src = previewImages[previewIndex];
    if (previewCounter) previewCounter.textContent = (previewIndex + 1) + " / " + previewImages.length;
    if (previewPrevBtn) previewPrevBtn.disabled = previewIndex === 0;
    if (previewNextBtn) previewNextBtn.disabled = previewIndex === previewImages.length - 1;
    if (previewWatermark) {
      previewWatermark.classList.toggle("is-hidden", PREVIEW_NO_WATERMARK_INDEXES.includes(previewIndex));
    }
  }

  if (previewImg) {
    previewImg.addEventListener("dragstart", (e) => e.preventDefault());
    if (previewPrevBtn) previewPrevBtn.addEventListener("click", () => {
      if (previewIndex > 0) { previewIndex--; updatePreview(); }
    });
    if (previewNextBtn) previewNextBtn.addEventListener("click", () => {
      if (previewIndex < previewImages.length - 1) { previewIndex++; updatePreview(); }
    });
    updatePreview();
  }

  /* ============ WHATSAPP SUPPORT FLOAT ============ */
  const supportFloat = document.getElementById("supportFloat");
  if (supportFloat) {
    supportFloat.addEventListener("click", () => {
      const msg = encodeURIComponent("Hi, I have a question about the 30 Alankaras for Flute eBook.");
      window.open(`https://wa.me/${SITE_CONFIG.WHATSAPP_NUMBER}?text=${msg}`, "_blank");
    });
  }

  /* ============ 1. FORM + VALIDATION ============ */
  const form = document.getElementById("ebookForm");
  const submitBtn = document.getElementById("ebookSubmitBtn");
  const formStatus = document.getElementById("ebookFormStatus");
  if (!form) return;

  const SUCCESS_KEY = "tfr_ebook_success_payload";
  const ATTEMPT_KEY = "tfr_ebook_attempt";
  const ATTEMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const ORDER_WAIT_MS = 6000; // hard cap; the order is normally pre-fetched while the form is filled

  function showError(fieldName, message) {
    const el = form.querySelector(`[data-error-for="${fieldName}"]`);
    if (el) el.textContent = message || "";
  }
  function resetButton() {
    submitBtn.disabled = false;
    submitBtn.textContent = "Get the eBook — ₹" + EBOOK_CONFIG.EBOOK_PRICE;
  }
  function setStatus(text, color) {
    formStatus.textContent = text;
    formStatus.style.color = color || "var(--ink-soft)";
  }

  /* ============ META EMQ HELPERS ============ */
  function getCookie(name) {
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : "";
  }
  function getFbc() {
    const existing = getCookie("_fbc");
    if (existing) return existing;
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (!fbclid) return "";
    // Meta's documented fbc format: fb.{subdomainIndex}.{creationTime}.{fbclid}
    return `fb.1.${Date.now()}.${fbclid}`;
  }
  function splitName(fullName) {
    const parts = (fullName || "").trim().split(/\s+/);
    return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
  }
  // Matches the Apps Script normalizePhone() exactly (assumes India/+91).
  function normalizePhoneForPixel(phone) {
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length === 10) return "91" + digits;
    return digits;
  }

  // FIXED: was `EBK-<year>-<4 random digits>` — only 9,000 possible IDs a
  // year, so two customers could share an ID and the sheet upsert would
  // overwrite one customer's row with another's. Now time + random based.
  function generateAttemptId() {
    let rand = "";
    try {
      const bytes = new Uint8Array(4);
      window.crypto.getRandomValues(bytes);
      rand = Array.from(bytes, b => b.toString(36).padStart(2, "0")).join("");
    } catch (e) {
      rand = Math.random().toString(36).slice(2, 10);
    }
    return ("EBK-" + Date.now().toString(36) + "-" + rand).toUpperCase().slice(0, 36);
  }

  function validateForm(data) {
    let valid = true;
    ["fullName", "email", "whatsapp"].forEach(f => showError(f, ""));

    if (!data.fullName || data.fullName.trim().length < 2) { showError("fullName", "Please enter your full name."); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) { showError("email", "Please enter a valid email — your eBook link is sent here."); valid = false; }
    if (!/^\d{10}$/.test((data.whatsapp || "").replace(/\D/g, "").slice(-10))) { showError("whatsapp", "Please enter a valid 10-digit WhatsApp number."); valid = false; }
    return valid;
  }

  /* ============ ATTEMPT STATE (one purchase attempt, reused across retries) ============ */
  function loadAttempt() {
    try {
      const a = JSON.parse(storeGet("localStorage", ATTEMPT_KEY) || "null");
      if (a && a.attemptId && Date.now() - (a.createdAt || 0) < ATTEMPT_MAX_AGE_MS) return a;
    } catch (e) { /* ignore */ }
    return null;
  }
  function saveAttempt(a) { storeSet("localStorage", ATTEMPT_KEY, JSON.stringify(a)); }

  // In-memory copy too, so everything still works if storage is unavailable.
  let currentAttempt = loadAttempt();
  let orderPromise = null;

  /* Creates (once) the Razorpay order for this attempt via Apps Script.
     Concurrent callers share the same promise — never two orders at once. */
  function ensureOrder() {
    if (currentAttempt && currentAttempt.rzpOrderId) return Promise.resolve(currentAttempt);
    if (orderPromise) return orderPromise;

    if (!currentAttempt) {
      currentAttempt = { attemptId: generateAttemptId(), createdAt: Date.now() };
      saveAttempt(currentAttempt);
    }
    const attempt = currentAttempt;

    orderPromise = gasCall({ action: "createOrder", attemptId: attempt.attemptId }, 15000)
      .then(res => {
        if (!res || res.status !== "ok" || !res.rzpOrderId) throw new Error("createOrder failed: " + JSON.stringify(res));
        attempt.rzpOrderId = res.rzpOrderId;
        if (res.attemptId) attempt.attemptId = res.attemptId;
        saveAttempt(attempt);
        return attempt;
      })
      .finally(() => { orderPromise = null; });
    return orderPromise;
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
  }

  // Pre-fetch the order in the background the moment the customer starts
  // filling the form, so it is normally ready before they press the button.
  form.addEventListener("focusin", () => {
    ensureOrder().catch(err => console.warn("Order pre-fetch failed (will retry on submit):", err));
  }, { once: true });

  let submitting = false;
  let lastCheckout = null; // { data, attempt, meta } of the latest checkout — used by Retry

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting || checkoutOpen || completed) return; // no double checkout instances

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (!validateForm(data)) {
      setStatus("Please fix the highlighted fields above.", "#C0392B");
      return;
    }

    submitting = true;
    try {
      // ---- Meta Pixel (Advanced Matching + Lead + InitiateCheckout).
      // Wrapped so a broken/blocked Pixel can NEVER stop checkout opening. ----
      try {
        // ---- Advanced Matching (unchanged) ----
        const { firstName, lastName } = splitName(data.fullName);
        if (typeof fbq === "function") {
          fbq("set", "userData", {
            em: data.email,
            ph: normalizePhoneForPixel(data.whatsapp),
            fn: firstName,
            ln: lastName,
            external_id: (data.email || "").trim().toLowerCase()
          });
        }

        // ---- Fire Lead + InitiateCheckout ONLY here, after the user submits the form ----
        firePixelLead(data);
        firePixelInitiateCheckout();
      } catch (pixelErr) {
        console.warn("Meta Pixel error (ignored, checkout continues):", pixelErr);
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Preparing payment...";
      formStatus.textContent = "";

      const fbp = getCookie("_fbp");
      const fbc = getFbc();
      const userAgent = navigator.userAgent;

      // ---- Get the Razorpay order (usually already pre-fetched). Capped wait:
      // if Apps Script is slow or down, open an order-less checkout rather
      // than blocking the sale; the server still verifies + captures it. ----
      let attempt;
      try {
        attempt = await withTimeout(ensureOrder(), ORDER_WAIT_MS);
      } catch (err) {
        console.warn("Razorpay order not available in time — opening checkout without order_id:", err);
        if (!currentAttempt) {
          currentAttempt = { attemptId: generateAttemptId(), createdAt: Date.now() };
        }
        attempt = currentAttempt;
      }

      // (Retry safety: the "was this order already paid?" check now runs IN
      // PARALLEL after checkout opens — see openRazorpayCheckout — instead of
      // being awaited here, so it can never delay the payment window.
      // Razorpay itself also refuses a second payment on an already-paid order.)
      const isRetryOfOpenedOrder = !!(attempt.rzpOrderId && attempt.opened);

      attempt.customer = { fullName: data.fullName, email: data.email, whatsapp: data.whatsapp };
      saveAttempt(attempt);

      // ---- Lead row as "Pending" — fire-and-forget, never blocks checkout.
      // (Server now ignores any "Paid" status sent from the browser.) ----
      void saveToEbookSheet({
        ...data,
        orderId: attempt.attemptId,
        paymentStatus: "Pending",
        product: "ebook",
        productName: EBOOK_CONFIG.EBOOK_NAME,
        amount: EBOOK_CONFIG.EBOOK_PRICE,
        fbp, fbc, userAgent
      }).catch(err => {
        console.error("Ebook Apps Script pre-payment save failed (continuing to checkout anyway):", err);
      });

      openRazorpayCheckout(data, attempt, { fbp, fbc });

      if (isRetryOfOpenedOrder) {
        gasCall({ action: "status", rzpOrderId: attempt.rzpOrderId }, 10000)
          .then(res => {
            if (res && res.status === "paid") {
              completePurchase({ paymentId: res.paymentId, rzpOrderId: attempt.rzpOrderId }, data, "recovered");
            }
          })
          .catch(() => { /* can't check — checkout is already open, nothing to do */ });
      }
    } catch (err) {
      console.error("Checkout could not start:", err);
      resetButton();
      setStatus("Something went wrong starting the payment. Please try again.", "#C0392B");
      showRecovery("error");
    } finally {
      submitting = false;
    }
  });

  /* ============ 2. RAZORPAY CHECKOUT ============ */
  let rzp = null;
  let checkoutOpen = false;
  let completed = false;

  let failedThisOpen = false;

  // Loads Razorpay's checkout.js again if the <script> tag in the page failed
  // (weak network / blocked). Resolves true/false, never hangs (8 s cap).
  let rzpScriptPromise = null;
  function loadRazorpayScript() {
    if (typeof Razorpay === "function") return Promise.resolve(true);
    if (rzpScriptPromise) return rzpScriptPromise;
    rzpScriptPromise = new Promise(resolve => {
      const t = setTimeout(() => resolve(typeof Razorpay === "function"), 8000);
      const sc = document.createElement("script");
      sc.src = "https://checkout.razorpay.com/v1/checkout.js";
      sc.async = true;
      sc.onload = () => { clearTimeout(t); resolve(typeof Razorpay === "function"); };
      sc.onerror = () => { clearTimeout(t); resolve(false); };
      document.head.appendChild(sc);
    }).then(ok => { if (!ok) rzpScriptPromise = null; return ok; });
    return rzpScriptPromise;
  }

  function openRazorpayCheckout(data, attempt, meta) {
    const { fbp, fbc } = meta;
    lastCheckout = { data, attempt, meta };

    // FIXED: if checkout.js failed to load (weak network / blocked), `new
    // Razorpay` threw and the button stayed on "Preparing payment..." forever.
    // Now: try loading it once more; if that fails too, show the recovery
    // popup (Retry / manual UPI) instead of a dead end.
    if (typeof Razorpay !== "function") {
      submitBtn.textContent = "Loading payment window...";
      loadRazorpayScript().then(ok => {
        if (ok) { openRazorpayCheckout(data, attempt, meta); return; }
        resetButton();
        setStatus("The payment window couldn't load. Please check your internet connection and try again.", "#C0392B");
        showRecovery("load");
      });
      return;
    }
    failedThisOpen = false;
    const phoneDigits = String(data.whatsapp || "").replace(/\D/g, "").slice(-10);

    const options = {
      key: SITE_CONFIG.RAZORPAY_KEY_ID, // public key only
      amount: EBOOK_CONFIG.EBOOK_PRICE * 100, // paise — must equal the server-side order amount
      currency: "INR",
      name: SITE_CONFIG.BUSINESS_NAME,
      description: EBOOK_CONFIG.EBOOK_NAME + " — eBook",
      image: SITE_CONFIG.BUSINESS_LOGO,
      prefill: {
        name: String(data.fullName || "").trim(),
        email: String(data.email || "").trim(),
        // normalised so Razorpay never rejects a "+91 98765 43210"-style entry
        contact: phoneDigits.length === 10 ? "+91" + phoneDigits : String(data.whatsapp || "")
      },
      notes: {
        product: "ebook",
        product_name: EBOOK_CONFIG.EBOOK_NAME,
        order_id: attempt.attemptId,
        // lets the server create/complete the sheet row from the payment alone
        customer_name: String(data.fullName || "").slice(0, 100),
        // Razorpay notes values are limited to 256 characters
        fbp: String(fbp || "").slice(0, 250),
        fbc: String(fbc || "").slice(0, 250)
        // ebook_link REMOVED: the link now lives only on the server.
      },
      theme: { color: "#FF7A00" },

      handler: function (response) {
        submitBtn.textContent = "Confirming payment...";
        completePurchase({
          paymentId: response.razorpay_payment_id,
          rzpOrderId: response.razorpay_order_id || attempt.rzpOrderId || ""
        }, data, "handler");
      },
      modal: {
        ondismiss: function () {
          checkoutOpen = false;
          if (completed) return;
          resetButton();
          if (failedThisOpen) {
            // We closed Razorpay ourselves to show the recovery popup.
            setStatus("Payment failed. You can retry or pay manually via UPI.", "#C0392B");
          } else {
            // Customer closed the window without a failed payment → NO popup.
            setStatus("Payment was not completed. You can try again anytime.");
          }
          // A UPI payment can still complete a little AFTER the popup is
          // closed (customer approved in the app, came back, closed the
          // "processing" screen). Keep checking quietly for a while.
          if (attempt.rzpOrderId) startStatusPoll(attempt, 5000, 120000);
        }
      }
    };
    if (attempt.rzpOrderId) options.order_id = attempt.rzpOrderId;

    try {
      stopStatusPoll();
      rzp = new Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        // Genuine failed payment attempt reported by Razorpay (declined,
        // timed out, UPI app never answered, cancelled mid-payment, ...).
        // Razorpay's window sits above everything on the page, so close it and
        // show our recovery popup (Retry / QR / UPI ID / WhatsApp). The SAME
        // order is reused on retry — no duplicate orders or sheet rows.
        if (completed) return;
        failedThisOpen = true;
        const err = (resp && resp.error) || {};
        console.warn("Razorpay payment failed:", err.code, err.reason, err.description);
        resetButton();
        setStatus("Payment failed. You can retry or pay manually via UPI.", "#C0392B");
        try { if (rzp) rzp.close(); } catch (e) { /* ignore */ }
        checkoutOpen = false;
        showRecovery("failed");
        // A UPI payment can still succeed late — keep checking in the
        // background; if it does, the customer is taken to the Thank You page.
        if (attempt.rzpOrderId) startStatusPoll(attempt, 5000, 120000);
      });
      rzp.open();
      checkoutOpen = true;
      attempt.opened = true;
      saveAttempt(attempt);
    } catch (err) {
      console.error("Razorpay checkout failed to open:", err);
      checkoutOpen = false;
      resetButton();
      setStatus("The payment window couldn't open. Please try again.", "#C0392B");
      showRecovery("load");
    }
  }

  /* Single exit point to the Thank You page — whichever of (Razorpay handler,
     visibility poll, post-dismiss poll, page-load recovery) gets there first.
     Never waits on Apps Script. */
  function completePurchase(info, data, via) {
    if (completed || !info || !info.paymentId) return;
    completed = true;
    stopStatusPoll();
    hideRecovery(false);

    if (via !== "handler") {
      setStatus("We found your completed payment — taking you to your eBook…", "#1F7A4D");
      try { if (rzp && checkoutOpen) rzp.close(); } catch (e) { /* ignore */ }
    }

    const attempt = currentAttempt || {};
    const customer = attempt.customer || data || {};
    const payload = {
      fullName: customer.fullName || "",
      email: customer.email || "",
      whatsapp: customer.whatsapp || "",
      orderId: attempt.attemptId || "",
      rzpOrderId: info.rzpOrderId || "",
      paymentId: info.paymentId,
      amount: EBOOK_CONFIG.EBOOK_PRICE,
      productName: EBOOK_CONFIG.EBOOK_NAME,
      via: via
    };
    storeSet("sessionStorage", SUCCESS_KEY, JSON.stringify(payload));
    storeSet("localStorage", SUCCESS_KEY, JSON.stringify(payload));
    storeRemove("localStorage", ATTEMPT_KEY); // order is paid — never reuse it

    // Early server-side verification kick (fire-and-forget, keepalive so it
    // survives navigation). The Thank You page verifies again and the webhook
    // is a third independent path — none of them block this redirect.
    if (isGasConfigured()) {
      try {
        fetch(gasUrl({ action: "verify", paymentId: info.paymentId }), { method: "GET", keepalive: true }).catch(() => {});
      } catch (e) { /* ignore */ }
    }

    const qs = "pid=" + encodeURIComponent(info.paymentId) +
      (attempt.attemptId ? "&oid=" + encodeURIComponent(attempt.attemptId) : "");
    window.location.replace("ebook-success.html?" + qs);
  }

  /* ============ 2b. PAYMENT-FAILED RECOVERY POPUP (new) ============
     Opens ONLY on: Razorpay "payment.failed", or the payment window failing
     to load/open. Never on a plain close of the Razorpay window.
     Offers: Retry (same order, no reload) · Scan QR · Copy UPI ID ·
     WhatsApp screenshot · Call. Manual UPI payments are verified by a human,
     so nothing here marks an order paid or fires the Purchase pixel. */
  const recoveryEl = document.getElementById("payRecovery");
  const reopenBtn = document.getElementById("payRecoveryReopen");
  const WA_NUMBER = String(SITE_CONFIG.WHATSAPP_NUMBER || "").replace(/\D/g, "");
  let lastFocus = null;

  function waLink(text) {
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);
  }

  function manualPaymentMessage() {
    const d = (lastCheckout && lastCheckout.data) || {};
    const a = (lastCheckout && lastCheckout.attempt) || currentAttempt || {};
    const lines = [
      `Hi, I have completed the payment manually for "${EBOOK_CONFIG.EBOOK_NAME}" (₹${EBOOK_CONFIG.EBOOK_PRICE}). I am sending my payment screenshot. Please verify my payment and provide my eBook access.`,
      ""
    ];
    if (d.fullName) lines.push("Name: " + d.fullName);
    if (d.email) lines.push("Email: " + d.email);
    if (d.whatsapp) lines.push("WhatsApp: " + d.whatsapp);
    if (a.attemptId) lines.push("Order ref: " + a.attemptId);
    return lines.join("\n");
  }

  function setupRecoveryStatic() {
    if (!recoveryEl) return;
    const upiId = String(EBOOK_CONFIG.MANUAL_UPI_ID || "").trim();
    const qr = String(EBOOK_CONFIG.MANUAL_UPI_QR_IMAGE || "").trim();
    const upiEl = document.getElementById("payUpiId");
    const qrEl = document.getElementById("payQrImg");
    if (upiEl) upiEl.textContent = upiId;
    if (qrEl) {
      if (qr) {
        qrEl.src = qr;
        qrEl.alt = "UPI QR code to pay " + (SITE_CONFIG.BUSINESS_NAME || "") + (upiId ? " (" + upiId + ")" : "");
      }
      // If the image file is missing, hide it rather than show a broken icon.
      qrEl.addEventListener("error", () => { qrEl.style.display = "none"; });
    }
    const num = document.getElementById("paySupportNumber");
    if (num) num.textContent = EBOOK_CONFIG.SUPPORT_PHONE_DISPLAY || ("+" + WA_NUMBER);
    const call = document.getElementById("payCallLink");
    if (call) call.href = "tel:+" + WA_NUMBER;
    const sup = document.getElementById("paySupportWhatsapp");
    if (sup) sup.href = waLink(`Hi, I'm having trouble paying for "${EBOOK_CONFIG.EBOOK_NAME}". Can you help?`);
  }

  function showRecovery(kind) {
    if (!recoveryEl || completed) return;
    const title = document.getElementById("payRecoveryTitle");
    const lede = document.getElementById("payRecoveryLede");
    if (kind === "load" || kind === "error") {
      title.textContent = "Payment window couldn't open";
      lede.textContent = "This is usually a slow or unstable connection. You can retry, or pay manually using UPI.";
    } else {
      title.textContent = "Payment Failed";
      lede.textContent = "Your payment could not be completed using the selected payment method. Don't worry — you can try again, or pay manually using UPI.";
    }
    // Refresh the WhatsApp message with this customer's details.
    const wa = document.getElementById("payWhatsappBtn");
    if (wa) wa.href = waLink(manualPaymentMessage());
    const copied = document.getElementById("payCopied");
    if (copied) copied.textContent = "";

    lastFocus = document.activeElement;
    recoveryEl.classList.add("open");
    recoveryEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const retry = document.getElementById("payRetryBtn");
    if (retry) setTimeout(() => { try { retry.focus({ preventScroll: true }); } catch (e) { retry.focus(); } }, 50);
    if (reopenBtn) reopenBtn.hidden = false;
  }

  function hideRecovery(restoreFocus) {
    if (!recoveryEl || !recoveryEl.classList.contains("open")) return;
    recoveryEl.classList.remove("open");
    recoveryEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (restoreFocus !== false && lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  function retryPayment() {
    hideRecovery(false);
    if (submitting || checkoutOpen || completed) return;
    // Re-run the normal submit path: same attempt + same Razorpay order,
    // validation, one checkout instance — no page reload, no new order.
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.dispatchEvent(new Event("submit", { cancelable: true }));
  }

  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) {}
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyUpiId() {
    const id = String(EBOOK_CONFIG.MANUAL_UPI_ID || "").trim();
    const out = document.getElementById("payCopied");
    const done = ok => {
      if (!out) return;
      if (ok) {
        out.style.color = "#1F7A4D";
        out.textContent = "✓ UPI ID copied!";
      } else {
        // Last resort: select the text so a long-press "Copy" works.
        out.style.color = "var(--ink-soft)";
        out.textContent = "Couldn't copy automatically — press and hold the UPI ID to copy it.";
        const el = document.getElementById("payUpiId");
        try { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e) {}
      }
      clearTimeout(copyUpiId._t);
      copyUpiId._t = setTimeout(() => { if (out) out.textContent = ""; }, 3500);
    };
    if (!id) return done(false);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(id).then(() => done(true), () => done(legacyCopy(id)));
    } else {
      done(legacyCopy(id));
    }
  }

  if (recoveryEl) {
    setupRecoveryStatic();
    document.getElementById("payRecoveryClose").addEventListener("click", () => hideRecovery());
    document.getElementById("payRetryBtn").addEventListener("click", retryPayment);
    document.getElementById("payCopyBtn").addEventListener("click", copyUpiId);
    recoveryEl.addEventListener("click", (e) => { if (e.target === recoveryEl) hideRecovery(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && recoveryEl.classList.contains("open")) hideRecovery();
    });
    if (reopenBtn) reopenBtn.addEventListener("click", () => showRecovery("failed"));
  }

  /* ============ 3. PAYMENT RECOVERY ============ */
  let pollTimer = null;
  let pollToken = 0;

  function stopStatusPoll() {
    pollToken++;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  }

  // Asks the server (which asks Razorpay's API) whether this order has a
  // successful payment. Only one poll loop runs at a time.
  function startStatusPoll(attempt, intervalMs, maxMs) {
    if (!attempt || !attempt.rzpOrderId || completed || !isGasConfigured()) return;
    stopStatusPoll();
    const token = pollToken;
    const startedAt = Date.now();

    const tick = () => {
      if (token !== pollToken || completed) return;
      gasCall({ action: "status", rzpOrderId: attempt.rzpOrderId }, 12000)
        .then(res => {
          if (token !== pollToken || completed) return;
          if (res && res.status === "paid") {
            completePurchase({ paymentId: res.paymentId, rzpOrderId: attempt.rzpOrderId }, attempt.customer, "recovered");
          }
        })
        .catch(() => { /* transient — keep polling */ })
        .finally(() => {
          if (token !== pollToken || completed) return;
          if (Date.now() - startedAt < maxMs) pollTimer = setTimeout(tick, intervalMs);
        });
    };
    tick();
  }

  // Registered ONCE (not per checkout) — no duplicate listeners. When the
  // customer comes back from the UPI/wallet app while checkout is open, start
  // checking in parallel with Razorpay's own "processing" screen.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && checkoutOpen && !completed && currentAttempt && currentAttempt.rzpOrderId) {
      startStatusPoll(currentAttempt, 4000, 180000);
    }
  });

  // Page-load recovery: the page was reloaded/killed after checkout opened
  // (common when a phone switches to a UPI app). If that order was paid,
  // take the customer straight to their eBook.
  if (currentAttempt && currentAttempt.opened && currentAttempt.rzpOrderId) {
    startStatusPoll(currentAttempt, 5000, 20000);
  }

  /* ============ 4. APPS SCRIPT CALLS ============ */
  function isGasConfigured() {
    const url = EBOOK_CONFIG.EBOOK_GOOGLE_SCRIPT_URL;
    return !!url && !url.startsWith("NEEDS_CONFIGURATION");
  }
  function gasUrl(params) {
    return `${EBOOK_CONFIG.EBOOK_GOOGLE_SCRIPT_URL}?${new URLSearchParams(params).toString()}`;
  }

  // JSON call with a hard timeout — no request can hang the flow.
  function gasCall(params, timeoutMs) {
    if (!isGasConfigured()) return Promise.reject(new Error("Ebook Apps Script URL not configured"));
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => { if (controller) controller.abort(); }, timeoutMs);
    return fetch(gasUrl(params), { method: "GET", cache: "no-store", signal: controller ? controller.signal : undefined })
      .then(r => r.json())
      .finally(() => clearTimeout(timer));
  }

  // Pre-payment "Pending" lead save (fire-and-forget).
  function saveToEbookSheet(payload) {
    if (!isGasConfigured()) {
      console.warn("Ebook Google Apps Script URL not configured — skipping sheet save.");
      return Promise.resolve();
    }
    return fetch(gasUrl(payload), { method: "GET", keepalive: true });
  }

  /* ============ 5. META PIXEL — LEAD + INITIATE CHECKOUT ============ */
  function firePixelLead() {
    if (typeof fbq !== "function") return;
    const eventId = "ebook_lead_" + storeGet("sessionStorage", "tfr_ebook_session_id");
    fbq("track", "Lead", { content_name: EBOOK_CONFIG.EBOOK_NAME }, { eventID: eventId });
  }
  function firePixelInitiateCheckout() {
    if (typeof fbq !== "function") return;
    const eventId = "ebook_checkout_" + storeGet("sessionStorage", "tfr_ebook_session_id");
    fbq("track", "InitiateCheckout", {
      value: EBOOK_CONFIG.EBOOK_PRICE,
      currency: "INR",
      content_name: EBOOK_CONFIG.EBOOK_NAME
    }, { eventID: eventId });
  }
});
