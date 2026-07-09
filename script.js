/**
 * ============================================================
 * THE FLUTE ROOM — SITE SCRIPT
 * Loaded on every page, after config.js.
 * All functions guard for missing elements so this one file is
 * safe to include everywhere.
 * ============================================================
 */

(function () {
  "use strict";

  /* ----------------------------------------------------------
   * 0. Small helpers
   * -------------------------------------------------------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function safeGet(storage, key) {
    try { return storage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(storage, key, val) {
    try { storage.setItem(key, val); } catch (e) { /* storage unavailable — fail silently */ }
  }

  /* ----------------------------------------------------------
   * 1. Year stamp in footer
   * -------------------------------------------------------- */
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ----------------------------------------------------------
   * 2. Smooth-scroll CTAs (data-scroll-to="#id")
   * -------------------------------------------------------- */
  $$("[data-scroll-to]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const target = $(el.getAttribute("data-scroll-to"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  /* ----------------------------------------------------------
   * 3. Seat availability badge (single editable config value)
   * -------------------------------------------------------- */
  $$("[data-seat-badge]").forEach((el) => {
    el.textContent = `Only ${CONFIG.SEATS_AVAILABLE} seats available out of ${CONFIG.SEATS_TOTAL}`;
  });

  /* ----------------------------------------------------------
   * 4. Contact links — inject WhatsApp / email / UPI / fee from config
   * -------------------------------------------------------- */
  $$("[data-whatsapp-link]").forEach((el) => {
    const msg = el.getAttribute("data-wa-message") || CONFIG.WHATSAPP_MESSAGE_GENERAL;
    el.setAttribute("href", `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
  });
  $$("[data-email-link]").forEach((el) => { el.setAttribute("href", `mailto:${CONFIG.EMAIL}`); });
  $$("[data-email-text]").forEach((el) => { el.textContent = CONFIG.EMAIL; });
  $$("[data-whatsapp-text]").forEach((el) => {
    el.textContent = "+91 " + CONFIG.WHATSAPP_NUMBER.slice(2, 7) + " " + CONFIG.WHATSAPP_NUMBER.slice(7);
  });
  $$("[data-upi-text]").forEach((el) => { el.textContent = CONFIG.UPI_ID; });
  $$("[data-fee-text]").forEach((el) => { el.textContent = CONFIG.MONTHLY_FEE; });

  /* ----------------------------------------------------------
   * 5. Lazy YouTube embeds
   *    Renders a thumbnail + play button; only loads the iframe
   *    (and starts the network request) on click. This keeps
   *    initial page weight small for mobile ad traffic.
   * -------------------------------------------------------- */
  $$("[data-yt]").forEach((wrap) => {
    const videoId = wrap.getAttribute("data-yt");
    const label = wrap.getAttribute("data-yt-label") || "Play video";
    const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    wrap.style.backgroundImage = `url('${thumb}')`;

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "yt-play";
    playBtn.setAttribute("aria-label", label);
    playBtn.innerHTML = `
      <svg viewBox="0 0 68 48" aria-hidden="true">
        <path d="M66.5,7.7c-0.8-2.9-2.4-5.4-5.3-6.2C55.8-0.1,34,0,34,0S12.2-0.1,6.8,1.5C3.9,2.3,2.3,4.8,1.5,7.7C0,13.2,0,24,0,24s0,10.8,1.5,16.3c0.8,2.9,2.4,5.4,5.3,6.2C12.2,48.1,34,48,34,48s21.8,0.1,27.2-1.5c2.9-0.8,4.5-3.3,5.3-6.2C68,34.8,68,24,68,24S68,13.2,66.5,7.7z" fill="rgba(20,20,20,0.75)"/>
        <path d="M45,24L27,14v20L45,24z" fill="#fff"/>
      </svg>
      <span>${label}</span>`;

    playBtn.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
      iframe.title = label;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      wrap.innerHTML = "";
      wrap.appendChild(iframe);

      // --- META PIXEL: ViewContent ---
      // Fires the first time a visitor interacts with (plays) the
      // main class sneak-peek video. Only the sneak-peek player is
      // tagged with data-yt-viewcontent="true" in index.html.
      if (wrap.getAttribute("data-yt-viewcontent") === "true") {
        firePixelOnce("ViewContent", "flute_vc_fired", {
          content_name: "Flute Class Sneak Peek",
          content_category: "video",
        });
      }
    }, { once: true });

    wrap.appendChild(playBtn);
  });

  /* ----------------------------------------------------------
   * 6. UTM + referrer capture (first touch, persisted for session)
   * -------------------------------------------------------- */
  const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
  function captureUtm() {
    const existing = safeGet(sessionStorage, "flute_utm");
    if (existing) return JSON.parse(existing);
    const params = new URLSearchParams(window.location.search);
    const data = {};
    UTM_KEYS.forEach((k) => { data[k] = params.get(k) || ""; });
    data.source_url = window.location.href;
    data.referrer = document.referrer || "";
    safeSet(sessionStorage, "flute_utm", JSON.stringify(data));
    return data;
  }
  const utmData = captureUtm();

  /* ----------------------------------------------------------
   * 7. Meta Pixel helpers — dedup + unique event_id
   * -------------------------------------------------------- */
  function firePixel(eventName, eventId, params) {
    if (typeof fbq !== "function") return;
    fbq("track", eventName, params || {}, { eventID: eventId });
  }

  // Fires an event only once per browser (localStorage) — used for
  // events tied to a specific action rather than a specific lead.
  function firePixelOnce(eventName, storageKey, params) {
    if (safeGet(localStorage, storageKey)) return;
    const eventId = uuid();
    firePixel(eventName, eventId, params);
    safeSet(localStorage, storageKey, eventId);
  }

  // Fires Lead exactly once per lead ID, and marks that Lead has
  // fired in this session (used by the WhatsApp Contact/Lead rule).
  function fireLeadEvent(leadId) {
    const dedupeKey = `flute_lead_fired_${leadId}`;
    if (safeGet(localStorage, dedupeKey)) return; // refresh-safe: already sent
    const eventId = `lead_${leadId}`; // stable, unique per lead
    firePixel("Lead", eventId, { content_name: "Flute Class Enrollment Form" });
    safeSet(localStorage, dedupeKey, "1");
    safeSet(sessionStorage, "flute_lead_fired_session", "1");
  }

  function fireInitiateCheckoutEvent(leadId) {
    const dedupeKey = `flute_ic_fired_${leadId}`;
    if (safeGet(localStorage, dedupeKey)) return;
    const eventId = `ic_${leadId}`;
    firePixel("InitiateCheckout", eventId, {
      content_name: "Flute Class Monthly Fee",
      value: 1499,
      currency: "INR",
    });
    safeSet(localStorage, dedupeKey, "1");
  }

  // WhatsApp buttons across the site (contact page, thank-you page,
  // footer): per the brief, fire Contact — unless Lead has not yet
  // fired in this session, in which case fire Lead instead. Dedup
  // guards against repeat clicks firing duplicate events.
  function handleWhatsAppPixelClick() {
    const leadFiredThisSession = safeGet(sessionStorage, "flute_lead_fired_session");
    if (leadFiredThisSession) {
      firePixelOnce("Contact", "flute_contact_fired_session_" + (safeGet(sessionStorage, "flute_session_id") || "s"), {
        content_name: "WhatsApp Contact Click",
      });
    } else {
      // No submitted lead yet this session — treat the WhatsApp
      // click itself as the lead signal, once only.
      firePixelOnce("Lead", "flute_lead_fired_whatsapp_click", {
        content_name: "WhatsApp Contact Click (pre-form)",
      });
      safeSet(sessionStorage, "flute_lead_fired_session", "1");
    }
  }
  $$("[data-whatsapp-pixel]").forEach((el) => {
    el.addEventListener("click", handleWhatsAppPixelClick);
  });

  /* ----------------------------------------------------------
   * 8b. META PIXEL: ViewContent — fires once when a visitor
   *     actually views the course-details / curriculum section
   *     (50% of it visible), which is the funnel signal requested
   *     for "someone views the course details".
   * -------------------------------------------------------- */
  const courseDetailsSection = $("#what-you-learn");
  if (courseDetailsSection && "IntersectionObserver" in window) {
    const viewContentObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            firePixelOnce("ViewContent", "flute_view_content_fired", {
              content_name: "Flute Class Curriculum",
              content_category: "course_details",
            });
            viewContentObserver.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );
    viewContentObserver.observe(courseDetailsSection);
  }
  // Backup trigger: clicking through to the curriculum PDF is an
  // even stronger "viewed course details" signal — same dedupe key,
  // so this never double-fires alongside the observer above.
  const curriculumLink = $('a[href$="flute-curriculum.pdf"]');
  if (curriculumLink) {
    curriculumLink.addEventListener("click", () => {
      firePixelOnce("ViewContent", "flute_view_content_fired", {
        content_name: "Flute Class Curriculum",
        content_category: "course_details",
      });
    });
  }

  /* ----------------------------------------------------------
   * 8. Enrollment form (index.html only)
   * -------------------------------------------------------- */
  const form = $("#enroll-form");
  if (form) {
    const submitBtn = $("#enroll-submit");
    const statusBox = $("#form-status");
    const hasFluteRadios = $$('input[name="has_flute"]', form);
    const budgetField = $("#budget-field");

    const requiredFields = () => $$("[data-required]", form);

    function fieldIsValid(el) {
      if (el.type === "radio") {
        return $$(`input[name="${el.name}"]`, form).some((r) => r.checked);
      }
      if (el.hasAttribute("data-conditional") && el.closest(".field").classList.contains("hidden")) {
        return true; // not required while hidden
      }
      return el.checkValidity();
    }

    function updateBudgetVisibility() {
      const noSelected = hasFluteRadios.some((r) => r.checked && r.value === "No");
      budgetField.classList.toggle("hidden", !noSelected);
      const select = $("select", budgetField);
      select.required = noSelected;
      if (!noSelected) select.value = "";
    }
    hasFluteRadios.forEach((r) => r.addEventListener("change", () => { updateBudgetVisibility(); validateForm(); }));
    updateBudgetVisibility();

    function showFieldError(el, show) {
      const fieldWrap = el.closest(".field") || el.closest(".radio-group")?.parentElement;
      if (fieldWrap) fieldWrap.classList.toggle("invalid", show);
    }

    function validateForm() {
      let allValid = true;
      requiredFields().forEach((el) => {
        const valid = fieldIsValid(el);
        if (!valid) allValid = false;
      });
      const consent = $("#consent-checkbox");
      if (consent && !consent.checked) allValid = false;
      submitBtn.disabled = !allValid;
      return allValid;
    }

    form.addEventListener("input", validateForm);
    form.addEventListener("change", validateForm);
    validateForm();

    // Blur-based inline error display for a friendlier mobile experience
    requiredFields().forEach((el) => {
      el.addEventListener("blur", () => showFieldError(el, !fieldIsValid(el)));
    });

    function setStatus(message, type) {
      statusBox.textContent = message;
      statusBox.className = "form-status show" + (type ? " " + type : "");
    }
    function clearStatus() {
      statusBox.className = "form-status";
      statusBox.textContent = "";
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!validateForm()) {
        setStatus("Please fill in all required fields correctly.", "error");
        return;
      }

      const leadId = "FR-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 900 + 100);
      const fd = new FormData(form);

      const payload = {
        leadId,
        timestamp: new Date().toISOString(),
        name: fd.get("name") || "",
        whatsapp: fd.get("whatsapp") || "",
        email: fd.get("email") || "",
        level: fd.get("level") || "",
        hasFlute: fd.get("has_flute") || "",
        fluteBudget: fd.get("flute_budget") || "",
        startTime: fd.get("start_time") || "",
        learningGoal: fd.get("learning_goal") || "",
        paymentStatus: "Pending",
        sourceUrl: utmData.source_url,
        utmSource: utmData.utm_source,
        utmMedium: utmData.utm_medium,
        utmCampaign: utmData.utm_campaign,
        utmContent: utmData.utm_content,
        referrer: utmData.referrer,
      };

      if (!CONFIG.GOOGLE_SCRIPT_URL || CONFIG.GOOGLE_SCRIPT_URL.indexOf("PASTE_YOUR") === 0) {
        setStatus("Setup incomplete: add your Google Apps Script URL in config.js.", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";
      setStatus("Submitting your details…", "loading");

      try {
        // text/plain content-type avoids a CORS preflight (OPTIONS)
        // request, which Apps Script Web Apps do not handle well.
        const res = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });

        // Apps Script returns JSON on success, but returns an HTML
        // page instead if the deployment is misconfigured (e.g. "Who
        // has access" isn't set to "Anyone", the URL is stale, or the
        // script itself errored). Reading as text first lets us tell
        // the difference and show a clear message either way, instead
        // of a raw "Unexpected token '<'" JSON-parsing crash.
        const rawText = await res.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          throw new Error(
            "Setup issue: the enrollment backend didn't respond correctly (this usually means the Google Apps Script deployment isn't set to \"Anyone\" access, or GOOGLE_SCRIPT_URL in config.js is out of date). Please try again shortly, or contact us on WhatsApp so we don't lose your spot."
          );
        }

        if (!data || data.status !== "success") {
          throw new Error((data && data.message) || "Could not save your details. Please try again.");
        }

        // Persist lead ID so it survives navigation to the thank-you page
        safeSet(localStorage, "flute_lead_id", leadId);
        safeSet(localStorage, "flute_lead_name", payload.name);

        // --- META PIXEL: Lead ---
        // Fires exactly once, only after Google Sheets confirms the
        // row was saved successfully. Uses the lead ID as part of a
        // stable event_id for deduplication.
        fireLeadEvent(leadId);

        clearStatus();
        form.classList.add("hidden");
        const paymentSection = $("#payment-section");
        if (paymentSection) {
          paymentSection.classList.remove("hidden");
          paymentSection.scrollIntoView({ behavior: "smooth", block: "start" });

          // --- META PIXEL: InitiateCheckout ---
          // Per the Pixel rules, this fires as soon as the payment
          // section becomes visible after a successful submission
          // (not only on the "Continue" button click).
          fireInitiateCheckoutEvent(leadId);
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enroll Now";
        setStatus(err.message || "Something went wrong. Please check your connection and try again.", "error");
      }
    });

    // "Continue to Payment Confirmation" — redirects to thank-you.html.
    // InitiateCheckout already fired when the section appeared, so
    // this handler only navigates (kept free of duplicate pixel calls).
    const continueBtn = $("#continue-to-confirmation");
    if (continueBtn) {
      continueBtn.addEventListener("click", () => {
        const leadId = safeGet(localStorage, "flute_lead_id") || "";
        window.location.href = `thank-you.html?lead_id=${encodeURIComponent(leadId)}`;
      });
    }
  }

  /* ----------------------------------------------------------
   * 9. Instagram Reel embed (about-teacher section)
   *    Uses Instagram's official oEmbed-style blockquote + embed.js
   *    script. If it fails to render within a few seconds (blocked,
   *    offline, script error, etc.), we swap in a plain "Watch on
   *    Instagram" button that opens the Reel in a new tab instead.
   *    The Reel URL is fully editable via CONFIG.INSTAGRAM_REEL_URL.
   * -------------------------------------------------------- */
  const igWrap = $("#ig-reel-embed");
  if (igWrap) {
    const reelUrl = (window.CONFIG && CONFIG.INSTAGRAM_REEL_URL || "").trim();
    const isRealReelUrl = reelUrl && reelUrl.indexOf("PASTE_YOUR") !== 0 && /instagram\.com/.test(reelUrl);

    function showFallbackButton() {
      igWrap.innerHTML = "";
      if (!reelUrl) return; // nothing to link to yet
      const btn = document.createElement("a");
      btn.href = reelUrl;
      btn.target = "_blank";
      btn.rel = "noopener";
      btn.className = "reel-fallback-btn";
      btn.textContent = "Watch on Instagram ↗";
      igWrap.appendChild(btn);
    }

    if (!isRealReelUrl) {
      showFallbackButton();
    } else {
      // Build the official Instagram embed markup.
      const blockquote = document.createElement("blockquote");
      blockquote.className = "instagram-media";
      blockquote.setAttribute("data-instgrm-permalink", reelUrl + "?utm_source=ig_embed");
      blockquote.setAttribute("data-instgrm-version", "14");
      blockquote.style.margin = "0";
      igWrap.appendChild(blockquote);

      let embedRendered = false;

      function loadInstagramScript() {
        // Reuse the script if another page/section already loaded it.
        if (window.instgrm && window.instgrm.Embeds) {
          window.instgrm.Embeds.process();
          return;
        }
        const existing = document.querySelector('script[src*="instagram.com/embed.js"]');
        if (existing) return; // already loading
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://www.instagram.com/embed.js";
        s.onload = () => { if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process(); };
        s.onerror = showFallbackButton;
        document.body.appendChild(s);
      }

      loadInstagramScript();

      // Instagram swaps the <blockquote> for an <iframe> once it
      // successfully renders. If that hasn't happened within a
      // reasonable window, assume it's blocked/failed and fall back.
      const checkRendered = () => {
        if ($("iframe", igWrap)) { embedRendered = true; }
      };
      const pollId = setInterval(checkRendered, 400);
      setTimeout(() => {
        clearInterval(pollId);
        checkRendered();
        if (!embedRendered) showFallbackButton();
      }, 4000);
    }
  }

  /* ----------------------------------------------------------
   * 10. Thank-you page
   * -------------------------------------------------------- */
  const leadIdChip = $("#lead-id-chip");
  if (leadIdChip) {
    const params = new URLSearchParams(window.location.search);
    const leadId = params.get("lead_id") || safeGet(localStorage, "flute_lead_id") || "—";
    leadIdChip.textContent = leadId;

    const waBtn = $("#thankyou-whatsapp-btn");
    if (waBtn) {
      const message = `Hello, I have submitted my flute class enrollment form. My Lead ID is ${leadId}. I have completed the payment and am sharing my screenshot for verification.`;
      waBtn.setAttribute("href", `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`);
      // This click always represents a submitted lead confirming
      // payment, so it fires Contact (Lead already fired at form
      // submission time in the same flow).
      waBtn.addEventListener("click", () => {
        firePixelOnce("Contact", "flute_contact_fired_thankyou_" + leadId, {
          content_name: "Payment Screenshot WhatsApp Click",
        });
      });
    }
  }
})();
