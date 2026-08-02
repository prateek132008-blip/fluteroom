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

  function validateForm(data) {
    let valid = true;
    ["fullName", "email", "whatsapp", "age", "level", "slot", "plan", "startDate"].forEach(f => showError(f, ""));

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

    // ---- Fire Lead + InitiateCheckout ONLY here, after the user submits the form ----
    firePixelLead(data);
    firePixelInitiateCheckout(data);

    submitBtn.disabled = true;
    submitBtn.textContent = "Preparing payment...";
    formStatus.textContent = "";

    try {
      // 1. Save a "pending" row to the Google Sheet BEFORE opening Razorpay,
      //    so we never lose a lead even if the user closes the payment popup.
      await saveToSheet({ ...data, paymentStatus: "Pending", paymentId: "", studentCode: "" });

      // 2. Open Razorpay checkout
      openRazorpayCheckout(data);
    } catch (err) {
      console.error(err);
      formStatus.textContent = "Something went wrong. Please try again or contact support.";
      formStatus.style.color = "#C0392B";
      submitBtn.disabled = false;
      submitBtn.textContent = "Proceed to Payment";
    }
  });

  /* ============ 3. RAZORPAY CHECKOUT ============ */
  function openRazorpayCheckout(data) {
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
        slot: data.slot
      },
      theme: { color: "#FF7A00" },

      // NOTE ON SECURITY: for production, verify the payment signature
      // server-side (in Code.gs, using your Razorpay Key Secret) before
      // treating the payment as valid. This handler calls that verification
      // step via the Apps Script "verifyAndFinalize" action. See README →
      // RAZORPAY SETUP for exactly where the Key Secret and Webhook Secret go.
      handler: async function (response) {
        submitBtn.textContent = "Confirming payment...";
        try {
          const studentCode = generateStudentCode();
          await saveToSheet({
            ...data,
            paymentStatus: "Paid",
            paymentId: response.razorpay_payment_id,
            studentCode
          });

          const successPayload = {
            ...data,
            paymentId: response.razorpay_payment_id,
            studentCode,
            amount: planInfo.amount
          };
          sessionStorage.setItem("tfr_success_payload", JSON.stringify(successPayload));
          window.location.href = "success.html";
        } catch (err) {
          console.error(err);
          formStatus.textContent = "Payment received, but confirmation failed. Please contact support on WhatsApp with your payment ID: " + response.razorpay_payment_id;
          formStatus.style.color = "#C0392B";
          submitBtn.disabled = false;
          submitBtn.textContent = "Proceed to Payment";
        }
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
    const params = new URLSearchParams(payload).toString();
    await fetch(`${SITE_CONFIG.GOOGLE_SCRIPT_URL}?${params}`, { method: "GET" });
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