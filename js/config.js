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

/* ==========================================================================
   EBOOK PRODUCT CONFIG — "30 Alankaras for Flute"
   Everything specific to the new eBook product lives here so it never has
   to be hunted down across multiple files. Reuses SITE_CONFIG above for
   anything shared with the rest of the site (Razorpay key, WhatsApp number,
   Meta Pixel ID, business name/logo) — nothing is duplicated.

   The eBook download link is NOT stored here any more — it is kept
   server-side in the eBook Apps Script (Script Property EBOOK_DRIVE_LINK)
   and used for BOTH the thank-you page and the confirmation email.
   ========================================================================== */
const EBOOK_CONFIG = {

  EBOOK_NAME: "30 Alankaras for Flute",
  EBOOK_PRICE: 399, // in ₹ (rupees, not paise)
  EBOOK_ACCESS: "Lifetime Access",
  EBOOK_COVER_IMAGE: "assets/alankaars-ebook-cover.png",

  // REMOVED FROM THE FRONT END (security fix): the eBook's Drive link used to
  // live here, which meant anyone could read it from this public file and get
  // the eBook without paying. It now lives ONLY in the eBook Apps Script's
  // Script Properties as EBOOK_DRIVE_LINK, and is handed out only after the
  // server has verified the payment with Razorpay. Do NOT put it back here.
  EBOOK_DRIVE_LINK: "",


  // NEEDS CONFIGURATION — the separate Google Apps Script Web App URL for the
  // eBook (deployed from google-apps-script/Ebook_Code.gs — see its setup
  // instructions). Deliberately a different script/sheet from the main
  // enrollment one, so nothing about the flute-class data flow is touched.
  EBOOK_GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzjQZ56H3tKFhS5IAoUJ1lQr4ZLnQUsdla6uNN1-1lF7RHMVYyzACECoD3D3VDyGU-u/exec"
};

/* ==========================================================================
   PAYMENT RECOVERY — the ONLY place to change the manual-payment details
   Used by the floating "Payment failed? — Pay here" button and its popup on
   the eBook page (js/ebook.js). Public details only — no secret keys here.

   QR code  → replace the file  assets/upi-qr.png  with your QR image
              (keep the same file name, or change QR_IMAGE below).
   UPI ID   → change UPI_ID below.
   WhatsApp / phone → change the three number fields below.

   Manual UPI payments do NOT go through Razorpay: you verify them from the
   customer's WhatsApp screenshot and send the eBook link yourself.
   ========================================================================== */
const PAYMENT_RECOVERY = {
  QR_IMAGE: "assets/upi-qr.png",
  UPI_ID: "prateekjha@fam",
  WHATSAPP_NUMBER: "918709268496",        // country code + number, no + or spaces (used for wa.me links)
  SUPPORT_PHONE_DISPLAY: "+91 8709268496", // what customers see
  SUPPORT_PHONE_TEL: "+918709268496"       // used for the tap-to-call link
};
