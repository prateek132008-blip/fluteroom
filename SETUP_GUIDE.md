# The Flute Room — Setup Guide (For Prateek)

This guide is written for a non-technical person. Follow the steps in
order. You will only ever need to edit **one file** for day-to-day
changes: `config.js`.

---

## 1. Which files do I upload to GitHub?

Upload **all** of these files together, in the same folder (no
subfolders needed except `assets/`):

```
index.html
contact.html
privacy-policy.html
terms.html
thank-you.html
styles.css
script.js
config.js
README.md
SETUP_GUIDE.md
assets/               ← put all your images + the curriculum PDF inside this folder
```

`Code.gs` is different — it does **not** go on the website. It goes
into Google Apps Script (see Step 4 below).

---

## 2. Which file do I edit in the future?

**`config.js`** — and almost nothing else. Every value you'll ever
need to change (fees, seats left, WhatsApp number, Pixel ID,
Instagram link, etc.) lives in that one file.

---

## 3. Where do I paste each value?

Open `config.js` in any text editor (Notepad, VS Code, or even
GitHub's own editor) and find these lines:

| What to paste | Line in `config.js` | Notes |
|---|---|---|
| **Meta Pixel ID** | `META_PIXEL_ID: "..."` | Get this from Meta Events Manager → Data Sources → your Pixel. It's already filled in — double-check it's the correct one for the ad account you're running. |
| **Instagram Reel link** | `INSTAGRAM_REEL_URL: "..."` | Paste the normal link you'd share (e.g. `https://www.instagram.com/reel/XXXXXXX/`). Don't paste embed code — just the link. |
| **YouTube class videos** | `YT_SNEAK_PEEK_ID`, `YT_UNLIMITED_SHORT_ID`, `YT_FULL_CLASS_ID` | Paste only the **video ID** (the part after `v=` or after `youtu.be/`), not the full URL. |
| **Google Apps Script Web App URL** | `GOOGLE_SCRIPT_URL: "..."` | You get this after deploying `Code.gs` — see Step 4. |
| **Google Sheet ID** | Inside `Code.gs`, the line `SPREADSHEET_ID = "..."` | This is **not** in `config.js` — it lives inside `Code.gs`, because only the backend needs it. |
| **Razorpay / payment link** | This site currently uses a **UPI QR code + UPI ID**, not Razorpay. Set `UPI_ID: "..."` in `config.js`, and replace `assets/payment-qr.png` with your real QR code image. |
| **WhatsApp number** | `WHATSAPP_NUMBER: "..."` | Digits only, country code first, no `+` or spaces. Example: `918709268496`. |
| **Email address** | `EMAIL: "..."` | Your support email. |

---

## 4. Do I need to change the Script ID, Sheet ID, deployment URL, or API key?

Yes — but only once, during setup, and only if you're using a fresh
Google Sheet:

1. Create a new Google Sheet, name it "The Flute Room — Leads".
2. Copy the long ID from its URL (between `/d/` and `/edit`).
3. Open **Extensions → Apps Script** in that sheet, delete any
   starter code, and paste in the full contents of `Code.gs`.
4. Paste your Sheet ID into the `SPREADSHEET_ID` line near the top.
5. Run the `setupSheet` function once (top toolbar dropdown → pick
   `setupSheet` → click ▶ Run). Approve the permission prompt.
6. Click **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy**, then copy the URL ending in `/exec`.
8. Paste that URL into `GOOGLE_SCRIPT_URL` in `config.js`.

There is no separate "API key" to manage — the Web App URL itself is
the only credential this site needs.

---

## 5. How do I test whether the Meta Pixel is working?

1. Install the free **Meta Pixel Helper** Chrome extension.
2. Open your live website.
3. Click the Pixel Helper icon — it should show a green check and
   **PageView** firing.
4. Scroll down to the "What You Will Learn" section — it should log
   a **ViewContent** event.
5. Fill in and submit the enrollment form — it should log a **Lead**
   event once your Google Sheet confirms the row was saved.
6. Right after that, the payment section appears — it should log an
   **InitiateCheckout** event at that moment.
7. You can also check **Meta Events Manager → Test Events** for the
   same events with more detail.

**Note on Purchase tracking:** this site verifies payments manually
(you check the WhatsApp screenshot yourself), so there is no
automatic payment-success callback for Meta to hook into. The
**Purchase** event is intentionally never fired anywhere on the site
— firing it automatically without real payment confirmation would be
fake data. If you later connect a real payment gateway with a
success webhook (e.g. Razorpay Payment Links with a confirmation
page), that page can call `fbq('track', 'Purchase', {...})` and it
will start reporting real purchases.

---

## 6. How do I test whether the enrollment form is working?

1. Open the site and scroll to "Start Your Flute Journey."
2. Fill in all fields and submit.
3. You should see a green "submitted" state and the payment section
   appear.
4. Open your Google Sheet — a new row should appear in the **Leads**
   tab within a few seconds, with **Payment Status = Pending**.

---

## 7. How do I test whether Google Sheets is receiving student data?

Same as Step 6 — after a test submission, check the **Leads** tab of
your Google Sheet. Each submission adds one row automatically. If no
row appears:
- Make sure `GOOGLE_SCRIPT_URL` in `config.js` is the `/exec` URL
  (not the `/dev` URL).
- Make sure the Apps Script deployment's access is set to **Anyone**.
- Re-deploy (Deploy → Manage deployments → Edit → New version) if you
  changed `Code.gs` after the first deployment — Apps Script doesn't
  auto-update a live deployment.

---

## 8. How do I update testimonials later?

Open `index.html`, find the section starting with
`<!-- ============ SECTION 7 — STUDENT REVIEWS ============ -->`.
Each review is a `<div class="review-card">` block containing a
`review-text`, `review-name`, and `review-level` paragraph. Edit the
text directly. No images are used for reviews by design.

---

## 9. How do I update the course price later?

Open `config.js` and change:
```js
MONTHLY_FEE: "₹1499",
```
This single value updates the price shown across the whole site
automatically (hero, payment section, thank-you page).

---

## 10. How do I deploy the updated website on GitHub Pages?

1. Create a GitHub repository (or use your existing one).
2. Upload all the files listed in Step 1 (keep the `assets/` folder).
3. Go to **Settings → Pages**, set the source to your main branch,
   root folder.
4. Your site goes live at `https://yourusername.github.io/repo-name/`.
5. After it's live, update `WEBSITE_URL` in `config.js` and the
   `__WEBSITE_URL__` placeholders inside each page's
   `<link rel="canonical">` tag with your real domain.

---

## A note on the Meta Pixel "noscript" fallback tag

Each page has one extra, hidden `<noscript>` tracking tag right after
the main Pixel code, for the small number of visitors who have
JavaScript disabled. It currently has your Pixel ID typed directly
into it (since `<noscript>` tags can't read `config.js`). If you ever
change `META_PIXEL_ID` in `config.js`, also find-and-replace the
number inside every `facebook.com/tr?id=...` line across `index.html`,
`contact.html`, `privacy-policy.html`, `terms.html`, and
`thank-you.html` so they stay in sync.

---

## What was already working and wasn't touched

- Enrollment form → Google Sheets flow
- WhatsApp integration and pre-filled messages
- Payment QR / UPI flow and the thank-you page
- Lead / InitiateCheckout / Contact pixel deduplication logic

These were solid, so they were left as-is.
