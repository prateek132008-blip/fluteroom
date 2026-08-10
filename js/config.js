/* ==========================================================================
   THE FLUTE ROOM — SITE CONFIG
   This is the ONLY file most future edits should require.
   See README.md → "How to update X" for a full walkthrough of every field below.
   ========================================================================== */

const SITE_CONFIG = {

  // ---- Google Apps Script Web App URL ----
  // Deploy google-apps-script/Code.gs as a Web App (see README) and paste the
  // resulting /exec URL here. This is the ONLY backend endpoint the front end calls.
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxbU_fRMPD4Rtv8nJ8bz15axi7-S1M-zZ1H-klkkuF3RAEr74THgYyZ2J31gdL24mM/exec",

  // ---- Razorpay ----
  // PUBLIC key only. NEVER put your Razorpay Key Secret or Webhook Secret in
  // this file or anywhere in the front-end code — those live only inside the
  // Google Apps Script "Script Properties" (server-side). See README → RAZORPAY SETUP.
  RAZORPAY_KEY_ID: "rzp_live_Sczvk68iCuryMo", // e.g. "rzp_test_SdLEnL0lYIFFpw"

  // ---- Business details shown on the Razorpay checkout popup ----
  BUSINESS_NAME: "The Flute Room",
  BUSINESS_DESCRIPTION: "Online Flute Classes",
  BUSINESS_LOGO: "assets/logo.png",

  // ---- Contact ----
  WHATSAPP_NUMBER: "918709268496", // country code + number, no + or spaces
  SUPPORT_EMAIL: "prateek132008@gmail.com",

  // ---- Downloadable documents ----
  // To replace either file, just drop your new file at the same path/filename
  // in the assets/ folder (or change the path here to point elsewhere).
  CURRICULUM_PDF: "assets/curriculum.pdf",

  // ---- UDYAM registration ----
  // UDYAM_NUMBER is shown directly on the page as the primary proof of registration.
  // UDYAM_CERTIFICATE_IMAGE is only used inside the view-only certificate modal
  // (opened via "View Full Certificate") — there is intentionally no download
  // link/button for this file anywhere on the site.
  UDYAM_NUMBER: "UDYAM-BR-01-0057866",
  UDYAM_CERTIFICATE_IMAGE: "assets/udyam-certificate.png",

  // ---- Meta Pixel ----
  META_PIXEL_ID: "27629504953321020",

  // ---- Plans (must match the <option data-amount> values in index.html) ----
  PLANS: {
    "Monthly":   { amount: 1999,  label: "Monthly — ₹1,999" },
    "3 Months":  { amount: 5499,  label: "3 Months — ₹5,499" },
    "6 Months":  { amount: 9999,  label: "6 Months — ₹9,999" }
  },

  // ---- Video IDs (YouTube) ----
  // Replace with your real YouTube video IDs (the part after watch?v=)
  VIDEOS: {
    heroPreview: "AzY2lKqi5Cg",
    unlimitedExplainer: "09Jd_JdHhWM",
    demoClass: "U7h_oqgKhxM",
    testimonial1: "dQw4w9WgXcQ",
    testimonial2: "dQw4w9WgXcQ"
  }
};
