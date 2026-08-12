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

    // ---- Fire Lead + InitiateCheckout ONLY here, after the user submits the form ----
    firePixelLead(data);
    firePixelInitiateCheckout();

    submitBtn.disabled = true;
    submitBtn.textContent = "Preparing payment...";
    formStatus.textContent = "";

    openRazorpayCheckout(data);
  });

  /* ============ 2. RAZORPAY CHECKOUT ============ */
  function openRazorpayCheckout(data) {
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
        product_name: EBOOK_CONFIG.EBOOK_NAME
      },
      theme: { color: "#FF7A00" },

      // NOTE ON SECURITY: exactly like the main enrollment flow, this client-side
      // handler is treated as the fast path (so the customer is never blocked from
      // their eBook), while the Razorpay webhook configured against the eBook Apps
      // Script (see google-apps-script/Ebook_Code.gs) is the server-verified source
      // of truth for "payment succeeded" — see README section in that file.
      handler: async function (response) {
        submitBtn.textContent = "Confirming payment...";

        const orderId = generateOrderId();
        const payload = {
          ...data,
          orderId,
          paymentId: response.razorpay_payment_id,
          paymentStatus: "Paid",
          product: "ebook",
          productName: EBOOK_CONFIG.EBOOK_NAME,
          amount: EBOOK_CONFIG.EBOOK_PRICE,
          ebookLink: EBOOK_CONFIG.EBOOK_DRIVE_LINK
        };

        // Best-effort: save the order + trigger the confirmation email.
        // Deliberately NOT blocking — if this fails, the customer must still
        // reach the thank-you page and get their Drive link from there.
        try {
          await saveToEbookSheet(payload);
        } catch (err) {
          console.error("Ebook Apps Script call failed:", err);
        }

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
    await fetch(`${EBOOK_CONFIG.EBOOK_GOOGLE_SCRIPT_URL}?${params}`, { method: "GET" });
  }

  function generateOrderId() {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `EBK-${year}-${random}`;
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