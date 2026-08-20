/* ==========================================================================
   THE FLUTE ROOM — ebook.js
   Powers ONLY the /alankaars-ebook.html sales page for "30 Alankaras for
   Flute". Completely separate from js/main.js (the flute-class enrollment
   flow) — nothing here touches the existing enrollment form, sheet, or
   student-code logic.

   Reuses: the SAME Meta Pixel (already initialized in this page's <head>,
   same ID as the rest of the site) and the SAME Razorpay public key from
   js/config.js (SITE_CONFIG). Writes to a SEPARATE Google Sheet via a
   SEPARATE Apps Script (EBOOK_CONFIG.EBOOK_GOOGLE_SCRIPT_URL).

   Sections: 1) Form + validation  2) Razorpay checkout  3) Apps Script call
             4) Meta Pixel events (Lead / InitiateCheckout — deduped like main.js)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Fill in price / cover image / drive-link-dependent bits from config ----
  document.querySelectorAll("[data-ebook-price]").forEach(el => {
    el.textContent = "₹" + EBOOK_CONFIG.EBOOK_PRICE;
  });
  const coverImg = document.getElementById("ebookCoverImg");
  if (coverImg) coverImg.src = EBOOK_CONFIG.EBOOK_COVER_IMAGE;

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

  /* ============ 1. FORM + VALIDATION ============ */
  const form = document.getElementById("ebookForm");
  const submitBtn = document.getElementById("ebookSubmitBtn");
  const formStatus = document.getElementById("ebookFormStatus");
  if (!form) return;

  function showError(fieldName, message) {
    const el = form.querySelector(`[data-error-for="${fieldName}"]`);
    if (el) el.textContent = message || "";
  }

  /* ============ META EMQ HELPERS (new) ============
     Small, self-contained helpers used to improve Meta Purchase Event Match
     Quality: reading the Pixel's own _fbp/_fbc browser-id cookies (or
     deriving _fbc from a ?fbclid= URL param per Meta's documented format
     when the cookie hasn't been set yet), and splitting the name field for
     Advanced Matching / Conversions API. Pure helpers — no side effects. */
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
  // NEW: matches Ebook_Code.gs's normalizePhone() exactly (assumes India/+91
  // for any bare 10-digit number). Without this, the Pixel's own client-side
  // hashing of "ph" only strips non-digits — it does NOT add a country code —
  // so the same phone number would hash differently between the browser
  // Purchase event and the server CAPI Purchase event.
  function normalizePhoneForPixel(phone) {
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length === 10) return "91" + digits;
    return digits;
  }
  function generateOrderId() {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `EBK-${year}-${random}`;
  }

  function validateForm(data) {
    let valid = true;
    ["fullName", "email", "whatsapp"].forEach(f => showError(f, ""));

    if (!data.fullName || data.fullName.trim().length < 2) { showError("fullName", "Please enter your full name."); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) { showError("email", "Please enter a valid email — your eBook link is sent here."); valid = false; }
    if (!/^\d{10}$/.test((data.whatsapp || "").replace(/\D/g, "").slice(-10))) { showError("whatsapp", "Please enter a valid 10-digit WhatsApp number."); valid = false; }
    return valid;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (!validateForm(data)) {
      formStatus.textContent = "Please fix the highlighted fields above.";
      formStatus.style.color = "#C0392B";
      return;
    }

    // ---- Advanced Matching: give the Pixel the customer's plain-text info so it
    // can hash + attach it to every subsequent event on this page (raises EMQ).
    // Meta's fbevents.js hashes these values client-side before they ever leave
    // the browser — we never send raw or hashed PII to Meta ourselves here. ----
    const { firstName, lastName } = splitName(data.fullName);
    if (typeof fbq === "function") {
      // NEW: external_id (raw here — fbevents.js hashes it client-side, same
      // as em/ph/fn/ln) gives Meta an extra, independent match signal beyond
      // em/ph, sourced from the already-collected email — nothing new is
      // gathered. ph is now normalized the same way the GAS backend does,
      // so browser and server events hash the same digits.
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

    submitBtn.disabled = true;
    submitBtn.textContent = "Preparing payment...";
    formStatus.textContent = "";

    // ---- Capture the Meta browser/click IDs and the order ID now, BEFORE payment,
    // so the SAME values can be (a) saved to the sheet, (b) passed through to
    // Razorpay as "notes" so the webhook/Conversions API call can use them later,
    // and (c) reused by the success page — all for the same customer/attempt. ----
    const orderId = generateOrderId();
    const fbp = getCookie("_fbp");
    const fbc = getFbc();
    const userAgent = navigator.userAgent;

    // ---- NEW: save the customer record as "Pending" BEFORE opening Razorpay,
    // exactly like the flute-class enrollment flow already does — so a lead is
    // never lost if the customer closes the payment popup or abandons checkout.
    // saveToEbookSheet() upserts by Order ID, so this never creates a duplicate
    // row when we update it to "Paid" after payment succeeds. ----
    try {
      await saveToEbookSheet({
        ...data,
        orderId,
        paymentId: "",
        paymentStatus: "Pending",
        product: "ebook",
        productName: EBOOK_CONFIG.EBOOK_NAME,
        amount: EBOOK_CONFIG.EBOOK_PRICE,
        fbp, fbc, userAgent
      });
    } catch (err) {
      console.error("Ebook Apps Script pre-payment save failed:", err);
      // Non-blocking by design (matches the rest of this flow's fail-open behavior) —
      // the customer should still be able to pay even if the sheet write hiccups.
    }

    openRazorpayCheckout(data, { orderId, fbp, fbc, userAgent });
  });

  /* ============ 2. RAZORPAY CHECKOUT ============ */
  function openRazorpayCheckout(data, meta) {
    const { orderId, fbp, fbc, userAgent } = meta;
    const options = {
      key: SITE_CONFIG.RAZORPAY_KEY_ID, // reuses the SAME public key as the rest of the site
      amount: EBOOK_CONFIG.EBOOK_PRICE * 100, // Razorpay expects paise
      currency: "INR",
      name: SITE_CONFIG.BUSINESS_NAME,
      description: EBOOK_CONFIG.EBOOK_NAME + " — eBook",
      image: SITE_CONFIG.BUSINESS_LOGO,
      prefill: {
        name: data.fullName,
        email: data.email,
        contact: data.whatsapp
      },
      notes: {
        product: "ebook",
        product_name: EBOOK_CONFIG.EBOOK_NAME,
        order_id: orderId,
        // fbp/fbc travel with the Razorpay order/payment itself so the server-side
        // webhook (the source of truth for "paid") can send a matching Conversions
        // API Purchase event with these same browser IDs, even though a webhook
        // has no access to the customer's cookies directly.
        fbp: fbp || "",
        fbc: fbc || "",
        // NEW: the Drive link travels with the payment too, so the webhook (which
        // is what actually sends the delivery email now — see Ebook_Code.gs) can
        // put it in the email without needing to hardcode it a second time.
        ebook_link: EBOOK_CONFIG.EBOOK_DRIVE_LINK || ""
      },
      theme: { color: "#FF7A00" },

      // NOTE ON SECURITY: exactly like the main enrollment flow, this client-side
      // handler is treated as the fast path (so the customer is never blocked from
      // their eBook), while the Razorpay webhook configured against the eBook Apps
      // Script (see google-apps-script/Ebook_Code.gs) is the server-verified source
      // of truth for "payment succeeded" — see README section in that file.
      handler: async function (response) {
        submitBtn.textContent = "Confirming payment...";

        // NOTE: reuses the SAME orderId generated before payment — this updates
        // the existing "Pending" row to "Paid" instead of creating a second,
        // duplicate customer record for the same purchase.
        const payload = {
          ...data,
          orderId,
          paymentId: response.razorpay_payment_id,
          paymentStatus: "Paid",
          product: "ebook",
          productName: EBOOK_CONFIG.EBOOK_NAME,
          amount: EBOOK_CONFIG.EBOOK_PRICE,
          ebookLink: EBOOK_CONFIG.EBOOK_DRIVE_LINK,
          fbp, fbc, userAgent
        };

        // CHANGED: fire-and-forget instead of awaiting. This is a fast path only —
        // it updates the order row (Pending -> Paid) and, as a backup, can trigger
        // the confirmation email. We deliberately do NOT wait for it to finish
        // before sending the customer to the thank-you page: that round trip to
        // Apps Script was exactly what caused the "payment successful -> long
        // wait -> success page" delay. { keepalive: true } lets the request keep
        // running in the background even after we navigate away, so it still
        // reliably reaches the server. The Razorpay webhook (server-side, see
        // Ebook_Code.gs) remains the AUTHORITATIVE confirmation — it verifies the
        // payment independently and is what actually guarantees the row gets
        // marked Paid and the delivery email gets sent, even if this request or
        // the customer's browser never completes it.
        saveToEbookSheet(payload).catch(err => {
          console.error("Ebook Apps Script call failed (webhook will still confirm):", err);
        });

        sessionStorage.setItem("tfr_ebook_success_payload", JSON.stringify(payload));
        window.location.href = "ebook-success.html";
      },
      modal: {
        // Fires if the user closes the popup without paying — no pixel event, no record.
        ondismiss: function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Get the eBook — ₹" + EBOOK_CONFIG.EBOOK_PRICE;
          formStatus.textContent = "Payment was not completed. You can try again anytime.";
          formStatus.style.color = "var(--ink-soft)";
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.on("payment.failed", function () {
      submitBtn.disabled = false;
      submitBtn.textContent = "Get the eBook — ₹" + EBOOK_CONFIG.EBOOK_PRICE;
      formStatus.textContent = "Payment failed. Please try again or contact support.";
      formStatus.style.color = "#C0392B";
    });
    rzp.open();
  }

  /* ============ 3. SEPARATE EBOOK APPS SCRIPT SUBMISSION ============
     Deliberately a DIFFERENT endpoint from js/main.js's saveToSheet(), so
     the existing flute-class Google Sheet/Script is never touched. */
  async function saveToEbookSheet(payload) {
    if (!EBOOK_CONFIG.EBOOK_GOOGLE_SCRIPT_URL || EBOOK_CONFIG.EBOOK_GOOGLE_SCRIPT_URL.startsWith("NEEDS_CONFIGURATION")) {
      console.warn("Ebook Google Apps Script URL not configured — skipping sheet save/email.");
      return;
    }
    const params = new URLSearchParams(payload).toString();
    // keepalive: true lets this request finish even if the page is about to
    // navigate away (e.g. the post-payment fire-and-forget call below) — without
    // it, browsers can cancel in-flight requests on navigation.
    await fetch(`${EBOOK_CONFIG.EBOOK_GOOGLE_SCRIPT_URL}?${params}`, { method: "GET", keepalive: true });
  }

  /* ============ 4. META PIXEL — LEAD + INITIATE CHECKOUT ============
     Reuses the SAME Pixel already initialized in this page's <head> (same ID
     as the rest of the site — no second fbq('init', ...) anywhere). Both fire
     ONLY from this submit handler — never on page load or button click alone. */
  function firePixelLead(data) {
    if (typeof fbq !== "function") return;
    const eventId = "ebook_lead_" + sessionStorage.getItem("tfr_ebook_session_id");
    fbq("track", "Lead", { content_name: EBOOK_CONFIG.EBOOK_NAME }, { eventID: eventId });
  }
  function firePixelInitiateCheckout() {
    if (typeof fbq !== "function") return;
    const eventId = "ebook_checkout_" + sessionStorage.getItem("tfr_ebook_session_id");
    fbq("track", "InitiateCheckout", {
      value: EBOOK_CONFIG.EBOOK_PRICE,
      currency: "INR",
      content_name: EBOOK_CONFIG.EBOOK_NAME
    }, { eventID: eventId });
  }

  // Stable per-session ID used to build unique, deduplicated event IDs — kept
  // separate from main.js's tfr_session_id so the two flows never collide.
  if (!sessionStorage.getItem("tfr_ebook_session_id")) {
    sessionStorage.setItem("tfr_ebook_session_id", Date.now() + "_" + Math.random().toString(36).slice(2));
  }

  /* ============ EBOOK PREVIEW NAVIGATOR (new) ============
     View-only page viewer for the "Preview the eBook" section. Pages are
     pre-rendered images from the preview PDF (assets/ebook-preview/) — the
     PDF itself is never linked from the page. Right-click/drag are disabled
     on the image, and a tiled "PREVIEW" watermark (pure CSS, see the
     .ebook-preview-watermark rule in this page's <style>) sits over every
     page — casual-copy deterrents only; none of this stops a determined
     user from screenshotting the page, and it doesn't claim to. Completely
     separate from the form/Razorpay/Pixel/Sheet logic above. */
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
});
