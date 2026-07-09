/**
 * ============================================================
 * THE FLUTE ROOM — SITE CONFIGURATION
 * ============================================================
 * Edit ONLY this file to update business details across the
 * entire website. Every page loads this file before script.js.
 * ============================================================
 */

const CONFIG = {
  // ---- Contact ----
  WHATSAPP_NUMBER: "918709268496",           // digits only, country code first, no + or spaces
  EMAIL: "prateek132008@gmail.com",

  // ---- Backend (Google Apps Script Web App) ----
  // Paste the deployed Web App URL here after Setup Step 3.
  // Example: "https://script.google.com/macros/s/AKfycb.../exec"
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwJ11Uacf8oUauSUSCoJIVHa1eOR5oYR8Cocj6Nrx6ny3_oKVutVR-abFJNULelLLj_-w/exec",

  // ---- Payment ----
  UPI_ID: "prateekjha@fam",                 // e.g. prateekjha@okicici
  MONTHLY_FEE: "₹1499",

  // ---- Seats ----
  // Edit this one number whenever seat availability changes.
  SEATS_AVAILABLE: 2,
  SEATS_TOTAL: 30,

  // ---- Meta / Facebook Pixel ----
  META_PIXEL_ID: "862067273312459",

  // ---- Social embeds ----
  // Paste the Instagram Reel's normal permalink URL here — the one
  // you'd share, e.g. https://www.instagram.com/reel/DY1xvHUtfcA/
  // Do NOT paste the raw <blockquote>/<script> embed code — script.js
  // builds the embed for you from this URL alone. Strip off any
  // ?utm_source=...&igsh=... tracking params at the end.
  INSTAGRAM_REEL_URL: "https://www.instagram.com/reel/DY1xvHUtfcA/",

  // ---- YouTube videos (ID only, not full URL) ----
  YT_SNEAK_PEEK_ID: "AzY2lKqi5Cg",
  YT_UNLIMITED_SHORT_ID: "09Jd_JdHhWM",
  YT_FULL_CLASS_ID: "fw7-BRoWML4",

  // ---- Website ----
  WEBSITE_URL: "https://www.theflutereroom.example",   // update after deployment (used for canonical/OG tags)

  // ---- WhatsApp pre-filled messages ----
  WHATSAPP_MESSAGE_GENERAL: "Hello, I'm interested in The Flute Room 1-on-1 online flute classes.",
};

// Freeze so no page accidentally mutates shared config at runtime.
Object.freeze(CONFIG);