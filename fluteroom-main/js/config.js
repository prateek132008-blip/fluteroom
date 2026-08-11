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
  RAZORPAY_KEY_ID: "rzp_test_SdLEnL0lYIFFpw", // e.g. "rzp_test_SdLEnL0lYIFFpw"

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

   The SAME EBOOK_DRIVE_LINK value below is used on BOTH the thank-you page
   AND the confirmation email, so you only ever update it in one place.
   ========================================================================== */
const EBOOK_CONFIG = {

  EBOOK_NAME: "30 Alankaras for Flute",
  EBOOK_PRICE: 399, // in ₹ (rupees, not paise)
  EBOOK_ACCESS: "Lifetime Access",
  EBOOK_COVER_IMAGE: "assets/alankaars-ebook-cover.png",

  // NEEDS CONFIGURATION — paste the Google Drive link to the eBook PDF here
  // once it's uploaded and sharing is set to "Anyone with the link can view".
  // Used on the thank-you page AND inside the confirmation email.
  EBOOK_DRIVE_LINK: "https://drive.google.com/file/d/11_69eaNvOBHnrFE7ezHXvUDCyl_bcqS_/view?usp=sharing",

  // NEEDS CONFIGURATION — the separate Google Apps Script Web App URL for the
  // eBook (deployed from google-apps-script/Ebook_Code.gs — see its setup
  // instructions). Deliberately a different script/sheet from the main
  // enrollment one, so nothing about the flute-class data flow is touched.
  EBOOK_GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzjQZ56H3tKFhS5IAoUJ1lQr4ZLnQUsdla6uNN1-1lF7RHMVYyzACECoD3D3VDyGU-u/exec"
};