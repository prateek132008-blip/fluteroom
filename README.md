# The Flute Room — Setup & Deployment Guide

This guide assumes zero prior experience with code. Follow it top to bottom.

---

## 1. Folder Structure

```
the-flute-room/
├── index.html                  ← Homepage (all sections)
├── success.html                ← Shown after successful payment
├── css/
│   └── style.css               ← All styling
├── js/
│   ├── config.js               ← EDIT THIS for keys, videos, plans, contact info
│   └── main.js                 ← Site logic (form, Razorpay, pixel, animations)
├── policies/
│   ├── refund.html
│   ├── terms.html
│   └── privacy.html
├── google-apps-script/
│   └── Code.gs                 ← Backend script (paste into Google Apps Script)
├── assets/                     ← Images, videos, curriculum PDF, UDYAM certificate
│   ├── curriculum.pdf          ← Shown behind "Download Complete Curriculum"
│   └── udyam-certificate.png   ← Shown in the "Registered Business" trust section
└── README.md                   ← This file
```

**The only file you'll edit for routine updates is `js/config.js`.**

---

## 2. Which Files You'll Actually Touch

| Task | File |
|---|---|
| Change WhatsApp number, email, plan prices | `js/config.js` |
| Replace videos/images | `assets/` folder + `js/config.js` |
| Replace the Curriculum PDF | Drop your new file at `assets/curriculum.pdf` (same filename), or change `CURRICULUM_PDF` in `js/config.js` to point elsewhere |
| Replace the UDYAM Certificate | Drop your new image at `assets/udyam-certificate.png` (same filename), or change `UDYAM_CERTIFICATE_IMAGE` / `UDYAM_CERTIFICATE_DOWNLOAD` in `js/config.js` |
| Change wording/copy | `index.html` (search for the text you want to change) |
| Change colors/fonts | `css/style.css` (top of file, under `:root`) |
| Add/edit FAQ questions | `index.html`, inside `<section id="faq">` |

---

## 3. How to Replace Videos

- **YouTube videos** (hero preview, demo class, testimonials): open `js/config.js` and replace the `VIDEOS` object values with your real YouTube video IDs (the part of the URL after `watch?v=`). The embeds in `index.html` currently use a placeholder ID (`dQw4w9WgXcQ`) — search `index.html` for that ID and replace each occurrence with `SITE_CONFIG.VIDEOS...` values, or simply swap the ID directly in each `<iframe src="https://www.youtube.com/embed/VIDEO_ID">`.
- **Teacher introduction video** (directly hosted, not YouTube): upload your `.mp4` file to the `assets/` folder as `assets/teacher-intro.mp4`, and a poster/thumbnail image as `assets/teacher-poster.jpg`. The `<video>` tag in `index.html` (inside `<section id="teacher">`) already points to these filenames.

## 4. How to Replace Images

Put your images in the `assets/` folder and update the corresponding `src=` attributes in `index.html` (teacher photo/poster, logo) and `js/config.js` (`BUSINESS_LOGO`, used on the Razorpay checkout popup).

## Replacing the Curriculum PDF and UDYAM Certificate

Both of these are wired through `js/config.js`, so you never need to touch `index.html` for routine swaps:

- **Curriculum PDF** — replace the file at `assets/curriculum.pdf` with your own PDF (same filename), or change `CURRICULUM_PDF` in `js/config.js` if you want to use a different filename/path. The "📄 Download Complete Curriculum (PDF)" button on the Curriculum section reads its link from this one setting.
- **UDYAM Certificate** — replace `assets/udyam-certificate.png` with your certificate image (same filename), or change `UDYAM_CERTIFICATE_IMAGE` (used for the preview + "View Certificate") and `UDYAM_CERTIFICATE_DOWNLOAD` (used for "Download Certificate") in `js/config.js`. Both point to the same file by default — split them if you want a lower-res preview and a full-res download.

## 5. How to Update Pricing

Prices appear in **three places** — update all three so they stay in sync:
1. `js/config.js` → the `PLANS` object (this is what Razorpay actually charges)
2. `index.html` → the pricing cards under `<section id="pricing">`
3. `index.html` → the `<select id="plan">` dropdown options in the enrollment form

---

## 6. Razorpay Setup (Complete Beginner-Level Walkthrough)

This section assumes you have never used Razorpay before. Follow every step in order.

### 6.1 Create a Razorpay Account

1. Go to [razorpay.com](https://razorpay.com) and click **Sign Up**.
2. Enter your business email and create a password.
3. Verify your email via the confirmation link Razorpay sends you.
4. You'll land in the **Razorpay Dashboard**. At this point your account is in **Test Mode** by default — you can build and test everything before any real money is involved.

### 6.2 Complete KYC (required before you can accept real payments)

1. In the Dashboard, go to **Account & Settings → Business Settings** (or you'll see a KYC banner prompting you).
2. Submit your business/individual details: PAN, bank account for settlements, business type (individual/proprietorship is fine for a solo teaching business), and address proof.
3. Razorpay reviews this — it can take anywhere from a few hours to a couple of days.
4. Until KYC is approved, you can only use **Test Mode**. You cannot go live without it.

### 6.3 Test Mode vs Live Mode — what's the difference

Razorpay has two completely separate environments, each with its own API keys:

| | Test Mode | Live Mode |
|---|---|---|
| Purpose | Build and test your integration | Accept real payments |
| Money movement | None — all "payments" are fake | Real money moves |
| Key prefix | `rzp_test_...` | `rzp_live_...` |
| Requires KYC? | No | Yes |
| Test cards | Razorpay provides dummy card numbers (see their docs) | Real cards/UPI/etc. only |

You toggle between the two using the **Test/Live switch** in the top-left of the Razorpay Dashboard. Each mode has its own separate Key ID, Key Secret, and Webhook Secret — **don't mix them up**.

### 6.4 Generating Your API Keys

1. In the Dashboard (with Test Mode selected first), go to **Settings → API Keys**.
2. Click **Generate Test Key**. Razorpay shows you a **Key ID** and **Key Secret** — the Key Secret is shown only once, so copy it somewhere safe immediately.
3. Repeat later in **Live Mode** once KYC is approved, to get your live keys.

### 6.5 Where Each Key Goes

- **Key ID** (`rzp_test_...` or `rzp_live_...`) — this is public and safe to expose in the browser. It only identifies your account; it can't authorize charges on its own.
  → Paste it into `js/config.js` → `RAZORPAY_KEY_ID`.
- **Key Secret** — this can authorize actions on your account and must **never** appear in any file that reaches the browser (no `.html`, `.js`, or files committed to a public GitHub repo).
  → Instead, store it in Google Apps Script's **Script Properties** (private, server-side):
  1. Open your Apps Script project (see Section 8).
  2. Click the gear icon → **Project Settings**.
  3. Under **Script Properties**, click **Add script property**.
  4. Name: `RAZORPAY_KEY_SECRET`, Value: your secret.

### 6.6 How the Orders API Works (conceptually)

For a fully server-verified flow, the standard Razorpay pattern is:
1. Your backend calls Razorpay's **Orders API** to create an `order_id` for a specific amount *before* showing the checkout popup.
2. The browser opens Razorpay Checkout using that `order_id`.
3. After payment, Razorpay returns a `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` to the browser.
4. Your backend verifies that signature using your Key Secret before trusting the payment.

This site uses a **simplified checkout flow** (no pre-created Order) for ease of setup — Razorpay Checkout is opened directly with an amount, and `js/main.js` handles the post-payment `handler` callback. The webhook described below is what gives you genuine server-side verification without needing the full Orders API — it's the recommended middle ground for a small business site like this one. If you later want the full Orders API flow for tighter fraud protection, that logic would live entirely inside `Code.gs` (specifically a new `doPost` action that creates the order before checkout opens).

### 6.7 How Webhooks Work

A webhook is Razorpay calling *your* server the moment something happens (like a successful payment) — independent of whether the customer's browser stays open, closes, or loses connection. This is why webhooks are the trustworthy source of truth, not just the browser-side `handler` callback.

**Configuring the Webhook URL:**
1. In Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**.
2. **Webhook URL**: paste your Apps Script Web App URL from Section 8 (the same `/exec` URL used for `GOOGLE_SCRIPT_URL`).
3. **Active Events**: check `payment.captured` (this fires once a payment is successfully charged).
4. Razorpay will display a **Webhook Secret** the moment you save it — copy it immediately.
5. Add it as a Script Property named `RAZORPAY_WEBHOOK_SECRET` (same process as Section 6.5).

### 6.8 How Payment Verification Works

`Code.gs`'s `doPost()` function is the webhook receiver. When Razorpay calls it:
1. It reads the raw request body and the `X-Razorpay-Signature` header.
2. It recomputes the expected signature using `RAZORPAY_WEBHOOK_SECRET` (via `Utilities.computeHmacSha256Signature`).
3. If the computed signature doesn't match what Razorpay sent, the request is rejected — this proves the request genuinely came from Razorpay and wasn't forged.
4. Only after that check passes does it mark the enrollment row as `"Paid (Webhook Verified)"`.

This means even if someone tampers with the browser-side JavaScript to fake a "successful payment," the Google Sheet won't show a verified payment unless Razorpay's own servers confirm it.

### 6.9 Securing Your Secret Keys — Rules to Follow

- Never paste the Key Secret or Webhook Secret into `js/config.js`, `index.html`, or any file you upload to GitHub.
- Script Properties in Apps Script are only readable by the script itself (and you, as the project owner) — that's why secrets live there.
- If a secret is ever exposed (e.g. accidentally committed to GitHub), regenerate it immediately in the Razorpay Dashboard (**Settings → API Keys → Regenerate**) and update your Script Property.
- Use **Test Mode** keys while developing and only switch `RAZORPAY_KEY_ID` (and the corresponding Script Properties) to Live values when you're ready to accept real payments.

### 6.10 Common Mistakes to Avoid

- **Mixing test and live keys** — e.g. a live `RAZORPAY_KEY_ID` in `config.js` with a test `RAZORPAY_KEY_SECRET` in Script Properties. Payments will fail. Keep the pair matched.
- **Forgetting to redeploy Apps Script after editing `Code.gs`** — see the "Redeploying" note in Section 8; edits don't take effect on the live URL until you deploy a new version.
- **Not setting the webhook's Active Events** — if `payment.captured` isn't checked, your webhook will never fire.
- **Testing in Live Mode by accident** — always confirm the Test/Live toggle in the Dashboard before testing card payments, and use Razorpay's documented test card numbers in Test Mode (never real cards).
- **Committing secrets to GitHub** — double-check `js/config.js` before every commit; it should only ever contain the public `RAZORPAY_KEY_ID`.

### 6.11 Testing Payments (Test Mode)

1. Make sure the Razorpay Dashboard is switched to **Test Mode** and `js/config.js` has your `rzp_test_...` Key ID.
2. Go through the enrollment form on your site, select a plan, and click **Proceed to Payment**.
3. In the Razorpay Checkout popup, use one of Razorpay's published test card numbers (search "Razorpay test cards" in their docs for the current list) — any future expiry date and any CVV will work in Test Mode.
4. Confirm: the popup closes, you land on `success.html` with a Student Code, the Google Sheet gets a new "Paid" row, and (if configured) a confirmation email arrives.
5. Check the Apps Script **Executions** log (in the Apps Script editor sidebar) to confirm `doGet`/`doPost` ran without errors.

### 6.12 Going Live

1. Complete KYC (Section 6.2) if you haven't already.
2. Switch the Razorpay Dashboard to **Live Mode** and generate your live Key ID/Key Secret (Section 6.4).
3. Update `js/config.js` → `RAZORPAY_KEY_ID` with the **live** Key ID.
4. Update the `RAZORPAY_KEY_SECRET` Script Property with the **live** Key Secret.
5. Add a **second webhook** in Live Mode (webhooks are separate per mode) pointing to the same Apps Script URL, and update `RAZORPAY_WEBHOOK_SECRET` with the live webhook's secret.
6. Make a small real payment yourself first to confirm the full flow end-to-end before announcing you're open for enrollment.

### 6.13 Success/Return URL

Razorpay Checkout (the popup used on this site) doesn't need a separate redirect URL configured in the Dashboard — payment confirmation happens inside the `handler` function in `js/main.js`, which redirects the browser to `success.html` after payment completes.

**Never commit your Key Secret or Webhook Secret to GitHub.** They only ever live in Apps Script's Script Properties, never in any `.js` or `.html` file.

---

## 7. Google Sheet Structure

Column order (created automatically by `setupSheet()` — see Section 8):

| Timestamp | Name | Email | WhatsApp | Age | Playing Level | Preferred Time | Start Date | Plan | Payment ID | Payment Status | Student Code |
|---|---|---|---|---|---|---|---|---|---|---|---|

---

## 8. Google Apps Script Deployment Guide

1. Go to [script.google.com](https://script.google.com) → **New Project**.
2. Delete the placeholder code and paste in the full contents of `google-apps-script/Code.gs`.
3. Click the **Resources/Files icon → rename the project** to "The Flute Room Backend".
4. This script needs to be bound to a Google Sheet:
   - Create a new Google Sheet (e.g. "The Flute Room — Enrollments").
   - In the Sheet, go to **Extensions → Apps Script** — this opens a script already bound to that sheet. Paste `Code.gs`'s contents here instead of creating a separate unbound project.
5. In the Apps Script editor, select the function dropdown → choose `setupSheet` → click **Run**. Grant the permissions it asks for (it needs access to your Sheets and Gmail). This creates the header row automatically.
6. Add your secrets: **Project Settings (gear icon) → Script Properties → Add property**:
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
7. **Deploy as a Web App**:
   - Click **Deploy → New deployment**
   - Type: **Web app**
   - Description: "Flute Room Backend v1"
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, then authorize permissions again if prompted.
8. Copy the **Web app URL** (ends in `/exec`) — paste it into `js/config.js` → `GOOGLE_SCRIPT_URL`.
9. Use this same URL as the webhook endpoint in Razorpay (Section 6, step 5).

**Redeploying:** any time you edit `Code.gs`, go to **Deploy → Manage deployments → Edit (pencil icon) → New version → Deploy** — editing the code alone does not update the live URL's behavior until you do this.

---

## 9. Student Code Logic

Format: `TFR-YYYY-####` (e.g. `TFR-2026-4829`), generated client-side immediately after a verified payment (`generateStudentCode()` in `js/main.js`), then:
- Displayed instantly on `success.html`
- Saved to the Google Sheet (Section 7)
- Emailed automatically via `Code.gs` → `sendConfirmationEmail()`

---

## 9.5 Enrollment Flow

The enrollment form (`#enroll`) is ordered to reduce confusion:

1. **Select Plan** — a single set of plan cards at the top of the form (`.plan-select-card`). This is the *only* plan selector in the form. A confirmation banner ("✅ You have selected: ...") appears immediately and stays visible for the rest of the form.
2. **Personal Details** — name, email, WhatsApp, age, playing level.
3. **Schedule** — preferred time slot and class start date (date picker, restricted to today or later).
4. **Review & Pay** — the "Proceed to Payment" button, which opens Razorpay Checkout.

The pricing cards further up the page (`#pricing`) still have their own "Enroll Now" buttons — clicking one scrolls to the form and pre-selects the matching plan card, but it doesn't create a second selector; it just sets the same single selection.

## 10. Meta Pixel Event Flow (Deduplication Explained)

Pixel ID `27629504953321020` is loaded on `index.html` and `success.html`.

| Event | Fires when | Where in code |
|---|---|---|
| `PageView` | Any page loads | Base pixel snippet, both pages |
| `Lead` | User clicks "Proceed to Payment" on the enrollment form (after validation passes) | `firePixelLead()` in `js/main.js`, called from the form `submit` handler |
| `InitiateCheckout` | Same moment as `Lead` — right after form submit, before Razorpay opens | `firePixelInitiateCheckout()` in `js/main.js` |
| `Purchase` | Once, on `success.html`, after a completed payment | `success.html` inline script |

**What does NOT fire these events:** page load, clicking a pricing card, or the Razorpay popup opening. `InitiateCheckout` and `Lead` only fire inside the form's `submit` event handler, after validation succeeds.

**Purchase deduplication (fires exactly once per payment):**
1. `event_id` is set to `purchase_<razorpay_payment_id>` — Meta's own deduplication collapses any duplicate sends carrying the same `event_id` (useful if you later add server-side Conversions API events too).
2. A `localStorage` flag (`tfr_purchase_fired_<payment_id>`) is checked before firing — so **refreshing `success.html` never fires `Purchase` again**, even without relying on Meta's dedup.
3. The success payload is stored in `sessionStorage` only long enough to render the page, then cleared — so navigating back to `success.html` without a fresh payment redirects to the homepage instead of re-showing stale data.

---

## 11. GitHub Pages Deployment

1. Create a new repository on GitHub (e.g. `the-flute-room`).
2. Upload all files in this folder (keeping the folder structure intact) — either via GitHub's web upload or:
   ```
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/the-flute-room.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**.
4. Under **Source**, select branch `main`, folder `/ (root)` → **Save**.
5. GitHub will give you a URL like `https://YOUR_USERNAME.github.io/the-flute-room/`. It can take a minute or two to go live.

### Connecting a Custom Domain
1. In **Settings → Pages → Custom domain**, enter your domain (e.g. `theflutroom.com`).
2. At your domain registrar, add:
   - A `CNAME` record pointing `www` to `YOUR_USERNAME.github.io`
   - Or `A` records pointing the root domain to GitHub Pages' IP addresses (GitHub's docs list the current IPs — search "GitHub Pages A records").
3. Wait for DNS to propagate (can take up to 24 hours), then enable **Enforce HTTPS** in the same settings page.

---

## 12. Making Future Edits

- **Small text changes**: edit `index.html` directly on GitHub (click the pencil icon on the file) or locally, then commit.
- **Keys/prices/contact info**: always edit `js/config.js` first — it's designed to be the single source of truth.
- After any edit, GitHub Pages redeploys automatically within a minute or two of your commit.

---

## 13. Common Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Form submits but nothing appears in the Sheet | `GOOGLE_SCRIPT_URL` not set, or Apps Script not redeployed after edits | Check `js/config.js`; redeploy per Section 8's "Redeploying" note |
| Razorpay popup doesn't open | `RAZORPAY_KEY_ID` missing/incorrect, or `checkout.js` blocked | Check browser console for errors; verify the key in `js/config.js` |
| Emails not sending | Apps Script wasn't authorized for Gmail, or daily Gmail quota hit | Re-run `setupSheet()` to trigger the permission prompt again; check Apps Script execution logs |
| Purchase event fires twice in Meta Events Manager | Testing across multiple browser profiles/incognito windows | Each fresh browser has its own `localStorage` — this is expected in testing; in production a single user's browser will only fire once |
| Videos don't load | Placeholder YouTube ID still in place | Replace `dQw4w9WgXcQ` with your real video IDs (Section 3) |
| Site looks unstyled on GitHub Pages | Relative paths broken due to repo subfolder structure | Ensure `css/style.css` and `js/*.js` paths in `index.html` are relative (they already are) and that the whole folder — not just `index.html` — was uploaded |

---

## 14. SEO & Performance Notes

- `index.html` includes meta description, Open Graph tags, and a canonical URL placeholder — update the canonical URL and Open Graph tags with your real domain once deployed.
- Images should be compressed (WebP where possible) before uploading to `assets/`.
- YouTube embeds use `loading="lazy"` to avoid blocking initial page load.
- Fonts are loaded via `@import` in `style.css`; for best performance, consider switching to `<link rel="preload">` font tags once you've finalized the type choices.

---

Questions or stuck on a step? Everything above maps directly to a specific file and section — search this README for the task you're stuck on.
