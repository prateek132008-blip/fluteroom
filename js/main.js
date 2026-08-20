/* ==========================================================================
   THE FLUTE ROOM — main.js
   Sections: 1) UI interactions  2) Form + validation  3) Razorpay + Apps Script
             4) Student code generation  5) Meta Pixel event flow (deduped)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ============ CONFIG-DRIVEN LINKS (curriculum PDF + UDYAM certificate) ============
     Every one of these reads straight from js/config.js — replacing the file
     path in config.js is the only edit ever needed to swap these documents. */
  const todayISO = new Date().toISOString().split("T")[0];

  const curriculumBtn = document.getElementById("curriculumDownloadBtn");
  if (curriculumBtn) curriculumBtn.href = SITE_CONFIG.CURRICULUM_PDF;

  const udyamNumberValue = document.getElementById("udyamNumberValue");
  if (udyamNumberValue) udyamNumberValue.textContent = SITE_CONFIG.UDYAM_NUMBER;

  /* ============ UDYAM CERTIFICATE — VIEW-ONLY MODAL ============
     Intentionally no download link/button anywhere for this file — the
     modal image is right-click/drag disabled as a light deterrent, but
     note that no client-side measure can make an on-page image fully
     unsaveable (a determined user can still screenshot it). */
  const certViewBtn = document.getElementById("certViewBtn");
  const certModalOverlay = document.getElementById("certModalOverlay");
  const certModalImg = document.getElementById("certModalImg");
  const certModalClose = document.getElementById("certModalClose");

  function openCertModal() {
    if (!certModalOverlay || !certModalImg) return;
    certModalImg.src = SITE_CONFIG.UDYAM_CERTIFICATE_IMAGE;
    certModalOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeCertModal() {
    if (!certModalOverlay) return;
    certModalOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (certViewBtn) certViewBtn.addEventListener("click", openCertModal);
  if (certModalClose) certModalClose.addEventListener("click", closeCertModal);
  if (certModalOverlay) {
    certModalOverlay.addEventListener("click", (e) => {
      if (e.target === certModalOverlay) closeCertModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && certModalOverlay && certModalOverlay.classList.contains("open")) closeCertModal();
  });

  /* ============ 1. HEADER SCROLL STATE ============ */
  const header = document.getElementById("siteHeader");
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 12);
    stickyCtaVisibility();
  }, { passive: true });

  /* ============ MOBILE NAV DRAWER ============ */
  const drawer = document.getElementById("mobileDrawer");
  document.getElementById("navToggle").addEventListener("click", () => drawer.classList.add("open"));
  document.getElementById("drawerClose").addEventListener("click", () => drawer.classList.remove("open"));
  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", () => drawer.classList.remove("open")));

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

  /* ============ STICKY MOBILE CTA (hide once enroll form is in view) ============ */
  const stickyCta = document.getElementById("stickyCta");
  const enrollSection = document.getElementById("enroll");
  function stickyCtaVisibility() {
    if (window.innerWidth > 760) return;
    const rect = enrollSection.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.8;
    stickyCta.style.display = inView ? "none" : "flex";
  }

  /* ============ REVIEW SLIDER ============ */
  const track = document.getElementById("reviewTrack");
  document.getElementById("reviewNext").addEventListener("click", () => track.scrollBy({ left: 340, behavior: "smooth" }));
  document.getElementById("reviewPrev").addEventListener("click", () => track.scrollBy({ left: -340, behavior: "smooth" }));

  /* ============ FAQ ACCORDION ============ */
  document.querySelectorAll(".faq-item").forEach(item => {
    const q = item.querySelector(".faq-q");
    const a = item.querySelector(".faq-a");
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(openItem => {
        openItem.classList.remove("open");
        openItem.querySelector(".faq-a").style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  /* ============ PLAN SELECTION — the ONE selector in the form ============
     Both the pricing-card "Enroll Now" buttons and the plan-select-card
     buttons inside the form write to this same hidden input, so there is
     never more than one source of truth for the selected plan. */
  const planHiddenInput = document.getElementById("plan");
  const planCards = document.querySelectorAll(".plan-select-card");
  const confirmBanner = document.getElementById("confirmBanner");
  const confirmBannerText = document.getElementById("confirmBannerText");

  function setPlan(planName) {
    if (!planName) return;
    const card = document.querySelector(`.plan-select-card[data-plan="${planName}"]`);
    if (!card) return;

    planCards.forEach(c => { c.classList.remove("active"); c.setAttribute("aria-checked", "false"); });
    card.classList.add("active");
    card.setAttribute("aria-checked", "true");

    planHiddenInput.value = planName;
    confirmBannerText.textContent = card.dataset.label;
    confirmBanner.classList.add("visible");
  }

  planCards.forEach(card => {
    card.addEventListener("click", () => setPlan(card.dataset.plan));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPlan(card.dataset.plan); }
    });
  });

  document.querySelectorAll(".select-plan").forEach(btn => {
    btn.addEventListener("click", () => {
      const plan = btn.dataset.plan;
      // Let the anchor's default #enroll scroll happen, then select the plan.
      setTimeout(() => setPlan(plan), 350);
    });
  });

  /* ============ FLUTE OWNERSHIP + BUDGET (step 3) ============ */
  const fluteHiddenInput = document.getElementById("hasFlute");
  const fluteCards = document.querySelectorAll(".flute-select-card");
  const fluteBudgetWrap = document.getElementById("fluteBudgetWrap");
  const fluteBudgetSelect = document.getElementById("fluteBudget");

  function setHasFlute(value) {
    if (!value) return;
    const card = document.querySelector(`.flute-select-card[data-flute="${value}"]`);
    if (!card) return;

    fluteCards.forEach(c => { c.classList.remove("active"); c.setAttribute("aria-checked", "false"); });
    card.classList.add("active");
    card.setAttribute("aria-checked", "true");

    fluteHiddenInput.value = value;
    showError("hasFlute", "");

    if (value === "No") {
      fluteBudgetWrap.classList.add("open");
      fluteBudgetSelect.setAttribute("required", "required");
    } else {
      fluteBudgetWrap.classList.remove("open");
      fluteBudgetSelect.removeAttribute("required");
      fluteBudgetSelect.value = "";
      showError("fluteBudget", "");
    }
  }

  fluteCards.forEach(card => {
    card.addEventListener("click", () => setHasFlute(card.dataset.flute));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHasFlute(card.dataset.flute); }
    });
  });

  /* ============ ENROLLMENT FORM + VALIDATION ============ */
  const form = document.getElementById("enrollForm");
  const submitBtn = document.getElementById("enrollSubmitBtn");
  const formStatus = document.getElementById("formStatus");

  // Start date: only today or future dates are selectable.
  const startDateInput = document.getElementById("startDate");
  if (startDateInput) startDateInput.min = todayISO;

  function showError(fieldName, message) {
    const el = form.querySelector(`[data-error-for="${fieldName}"]`);
    if (el) el.textContent = message || "";
  }

  /* ============ META EMQ HELPERS (new) ============
     Same helpers as js/ebook.js — reads the Pixel's own _fbp/_fbc cookies (or
     derives _fbc from ?fbclid= per Meta's documented format) and splits the
     name field for Advanced Matching / Conversions API. Pure helpers. */
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
    return `fb.1.${Date.now()}.${fbclid}`;
  }
  function splitName(fullName) {
    const parts = (fullName || "").trim().split(/\s+/);
    return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
  }
  // NEW: matches Code.gs's normalizePhone() exactly (assumes India/+91 for any
  // bare 10-digit number). Without this, the Pixel's own client-side hashing
  // of "ph" only strips non-digits — it does NOT add a country code — so a
  // customer entering "9876543210" would hash differently for the browser
  // Purchase event than the identical number does server-side via CAPI. Same
  // underlying phone number should be formatted identically before hashing.
  function normalizePhoneForPixel(phone) {
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length === 10) return "91" + digits;
    return digits;
  }

  function validateForm(data) {
    let valid = true;
    ["fullName", "email", "whatsapp", "age", "level", "slot", "plan", "startDate", "hasFlute", "fluteBudget"].forEach(f => showError(f, ""));

    if (!data.plan) {
      formStatus.textContent = "Please select a plan above before continuing.";
      formStatus.style.color = "#C0392B";
      valid = false;
    }
    if (!data.fullName || data.fullName.trim().length < 2) { showError("fullName", "Please enter your full name."); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) { showError("email", "Please enter a valid email."); valid = false; }
    if (!/^\d{10}$/.test((data.whatsapp || "").replace(/\D/g, "").slice(-10))) { showError("whatsapp", "Please enter a valid 10-digit number."); valid = false; }
    if (!data.age || data.age < 4 || data.age > 90) { showError("age", "Please enter a valid age."); valid = false; }
    if (!data.level) { valid = false; }
    if (!data.hasFlute) { showError("hasFlute", "Please let us know if you already own a flute."); valid = false; }
    if (data.hasFlute === "No" && !data.fluteBudget) { showError("fluteBudget", "Please select a budget."); valid = false; }
    if (!data.slot) { valid = false; }
    if (!data.startDate) {
      showError("startDate", "Please choose a start date.");
      valid = false;
    } else if (data.startDate < todayISO) {
      showError("startDate", "Start date can't be in the past.");
      valid = false;
    }
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

    // ---- Normalize the flute budget field once, here, so every downstream
    // consumer (sheet, email, WhatsApp message, success page) reads the same
    // ready-to-display value without re-deriving it. ----
    data.fluteBudget = data.hasFlute === "Yes" ? "Already Owns Flute" : (data.fluteBudget || "");

    // ---- Advanced Matching: give the Pixel the customer's plain-text info so it
    // can hash + attach it to every subsequent event on this page (raises EMQ).
    // fbevents.js hashes these values client-side — nothing raw or hashed is
    // sent to Meta by our own code here. ----
    const { firstName, lastName } = splitName(data.fullName);
    if (typeof fbq === "function") {
      // NEW: external_id (raw value here — fbevents.js hashes it client-side,
      // same as em/ph/fn/ln) gives Meta an extra, independent match signal
      // beyond em/ph. Using the normalized email as its source is legitimate
      // since email is already collected/consented on this form — nothing new
      // is being gathered. ph is now normalized the same way the GAS backend
      // normalizes it, so browser and server events hash the same digits.
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
    firePixelInitiateCheckout(data);

    submitBtn.disabled = true;
    submitBtn.textContent = "Preparing payment...";
    formStatus.textContent = "";

    // Capture the Meta browser/click IDs now, before payment, so the same
    // values can be saved to the sheet AND passed through to Razorpay's
    // "notes" for the webhook-side Conversions API Purchase call later.
    const fbp = getCookie("_fbp");
    const fbc = getFbc();
    const userAgent = navigator.userAgent;

    // 1. Save a "pending" row to the Google Sheet BEFORE opening Razorpay, so we
    //    never lose a lead even if the user closes the payment popup. CHANGED:
    //    this no longer blocks checkout if it fails (matches the eBook flow) —
    //    a slow or erroring sheet write should never stop a customer from being
    //    able to pay. We still attempt + await it first so the "pending" row
    //    genuinely exists before Razorpay opens in the normal case.
    try {
      await saveToSheet({ ...data, paymentStatus: "Pending", paymentId: "", studentCode: "", fbp, fbc, userAgent });
    } catch (err) {
      console.error("Pre-payment sheet save failed (continuing to checkout anyway):", err);
    }

    // 2. Open Razorpay checkout
    openRazorpayCheckout(data, { fbp, fbc, userAgent });
  });

  /* ============ 3. RAZORPAY CHECKOUT ============ */
  function openRazorpayCheckout(data, meta) {
    const { fbp, fbc, userAgent } = meta;
    const planInfo = SITE_CONFIG.PLANS[data.plan];
    if (!planInfo) {
      formStatus.textContent = "Invalid plan selected.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Proceed to Payment";
      return;
    }

    const options = {
      key: SITE_CONFIG.RAZORPAY_KEY_ID, // Public key only — see js/config.js
      amount: planInfo.amount * 100,     // Razorpay expects paise
      currency: "INR",
      name: SITE_CONFIG.BUSINESS_NAME,
      description: `${SITE_CONFIG.BUSINESS_DESCRIPTION} — ${data.plan} Plan`,
      image: SITE_CONFIG.BUSINESS_LOGO,
      prefill: {
        name: data.fullName,
        email: data.email,
        contact: data.whatsapp
      },
      notes: {
        plan: data.plan,
        level: data.level,
        slot: data.slot,
        // fbp/fbc travel with the Razorpay payment so the server-side webhook
        // (source of truth for "paid") can send a matching Conversions API
        // Purchase event with these same browser IDs.
        fbp: fbp || "",
        fbc: fbc || ""
      },
      theme: { color: "#FF7A00" },

      // NOTE ON SECURITY: for production, verify the payment signature
      // server-side (in Code.gs, using your Razorpay Key Secret) before
      // treating the payment as valid. This handler calls that verification
      // step via the Apps Script "verifyAndFinalize" action. See README →
      // RAZORPAY SETUP for exactly where the Key Secret and Webhook Secret go.
      handler: function (response) {
        submitBtn.textContent = "Confirming payment...";
        const studentCode = generateStudentCode();

        // CHANGED: fire-and-forget instead of awaiting. This call updates the
        // row (Pending -> Paid) and is a fast-path backup for the confirmation
        // email. We no longer wait for it before sending the customer to the
        // success page — that round trip was the "payment successful -> long
        // wait -> success page" delay. { keepalive: true } (inside saveToSheet)
        // lets it keep running in the background after we navigate away. The
        // Razorpay webhook (server-side, see Code.gs) independently verifies
        // the payment and reliably marks the row Paid even if this never
        // completes, so nothing here can silently lose an order.
        saveToSheet({
          ...data,
          paymentStatus: "Paid",
          paymentId: response.razorpay_payment_id,
          studentCode,
          fbp, fbc, userAgent
        }).catch(err => {
          console.error("Post-payment sheet save failed (webhook will still confirm):", err);
        });

        const successPayload = {
          ...data,
          paymentId: response.razorpay_payment_id,
          studentCode,
          amount: planInfo.amount
        };
        sessionStorage.setItem("tfr_success_payload", JSON.stringify(successPayload));
        window.location.href = "success.html";
      },
      modal: {
        // Fires if the user closes the popup without paying — no pixel event here.
        ondismiss: function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Proceed to Payment";
          formStatus.textContent = "Payment was not completed. You can try again anytime.";
          formStatus.style.color = "var(--ink-soft)";
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  }

  /* ============ GOOGLE APPS SCRIPT SUBMISSION ============ */
  async function saveToSheet(payload) {
    if (!SITE_CONFIG.GOOGLE_SCRIPT_URL || SITE_CONFIG.GOOGLE_SCRIPT_URL.includes("PASTE_")) {
      console.warn("Google Apps Script URL not configured — skipping sheet save.");
      return;
    }
    // Uses GET with URL params (see README) for reliability with Apps Script Web Apps.
    // keepalive: true lets this request finish even if the page is about to
    // navigate away (e.g. the post-payment fire-and-forget call above) —
    // without it, browsers can cancel in-flight requests on navigation.
    const params = new URLSearchParams(payload).toString();
    await fetch(`${SITE_CONFIG.GOOGLE_SCRIPT_URL}?${params}`, { method: "GET", keepalive: true });
  }

  /* ============ 4. STUDENT CODE GENERATION ============ */
  function generateStudentCode() {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TFR-${year}-${random}`;
  }

  /* ============ SUPPORT / WHATSAPP FLOAT ============ */
  document.getElementById("supportFloat").addEventListener("click", () => {
    const msg = encodeURIComponent("Hi, I didn't receive my Student Code. Could you please help me locate it?");
    window.open(`https://wa.me/${SITE_CONFIG.WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  });

  /* ============ 5. META PIXEL — LEAD + INITIATE CHECKOUT ============
     Both fire ONLY from the form submit handler above — never on page load,
     pricing click, or Razorpay popup open. */
  function firePixelLead(data) {
    if (typeof fbq !== "function") return;
    const eventId = "lead_" + sessionStorage.getItem("tfr_session_id");
    fbq("track", "Lead", { content_name: data.plan }, { eventID: eventId });
  }
  function firePixelInitiateCheckout(data) {
    if (typeof fbq !== "function") return;
    const planInfo = SITE_CONFIG.PLANS[data.plan];
    const eventId = "checkout_" + sessionStorage.getItem("tfr_session_id");
    fbq("track", "InitiateCheckout", {
      value: planInfo ? planInfo.amount : 0,
      currency: "INR",
      content_name: data.plan
    }, { eventID: eventId });
  }

  // Give this browser session a stable ID used to build unique, deduplicated event IDs.
  if (!sessionStorage.getItem("tfr_session_id")) {
    sessionStorage.setItem("tfr_session_id", Date.now() + "_" + Math.random().toString(36).slice(2));
  }

  stickyCtaVisibility();
});
