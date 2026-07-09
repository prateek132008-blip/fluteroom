# The Flute Room — Enrollment Website

A premium, mobile-first enrollment site for live 1-on-1 online flute
classes. Static HTML/CSS/JS — no backend server. Form submissions are
saved to Google Sheets through a free Google Apps Script Web App.

## Files

```
index.html            Home / enrollment landing page
thank-you.html         Payment-confirmation page (after form submit)
privacy-policy.html    Privacy Policy
terms.html              Terms & Conditions
contact.html            Contact page
styles.css              All styling
script.js               All site logic (form, pixel events, embeds)
config.js                ⭐ Every editable setting lives here
Code.gs                  Paste into Google Apps Script (backend)
assets/                  Images + curriculum PDF
```

Placeholder images have already been generated for `assets/` so the
site renders correctly today. Replace them with your real photos
before launch (exact filenames below).

---

## Setup — do these in order

### 1. Add your real assets
Replace these files in `assets/` (keep the exact filenames):

| File | Recommended size |
|---|---|
| `teacher-prateek.jpg` | 1200×1500px portrait JPG, under 500KB |
| `payment-qr.png` | 1000×1000px square PNG, under 500KB |
| `flute-curriculum.pdf` | already your real curriculum PDF ✅ |
| `student-review-1.jpg` / `-2.jpg` / `-3.jpg` | 800×800px square JPG, under 300KB each (optional) |
| `og-cover.jpg` | 1200×630px JPG, under 500KB |
| `favicon.png` | 512×512px PNG |

### 2. Create the Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it, e.g., "The Flute Room — Leads".
3. Copy the **Spreadsheet ID** from its URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART_IS_THE_ID`**`/edit`

### 3. Deploy the Google Apps Script
1. In the Sheet, open **Extensions → Apps Script**.
2. Delete any starter code, then paste the full contents of `Code.gs`.
3. At the top of the script, paste your Spreadsheet ID into `SPREADSHEET_ID`.
4. In the function dropdown (top toolbar), select **setupSheet**, then click **Run** once. This creates the "Leads" tab with the correct header row. (First run will ask you to authorize the script — approve it.)
5. Click **Deploy → New deployment**.
6. Click the gear icon, choose type **Web app**.
7. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
8. Click **Deploy**, then **copy the Web App URL** (ends in `/exec`).

### 4. Add the Apps Script URL to config.js
Open `config.js` and paste the URL into:
```js
GOOGLE_SCRIPT_URL: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
```

### 5. Add your UPI ID and QR image
In `config.js`, set:
```js
UPI_ID: "your-upi-id@bank",
```
Replace `assets/payment-qr.png` with your real QR code image.

### 6. Test form submission
1. Open `index.html` locally (or after deploying — see Step 8) in a browser.
2. Fill in the enrollment form and submit.
3. Check your Google Sheet — a new row should appear in the "Leads" tab with **Payment Status = Pending**.
4. Confirm the payment section appears after a successful submission.

### 7. Test Meta Pixel events
1. Install the [Meta Pixel Helper](https://chromewebstore.google.com/detail/meta-pixel-helper) Chrome extension.
2. Open the site and confirm:
   - **PageView** fires on every page load.
   - **ViewContent** fires only when you click play on the hero sneak-peek video.
   - **Lead** fires once, only after a successful form submission (check Events Manager → Test Events for the event ID).
   - **InitiateCheckout** fires once, right when the payment section appears.
   - **Contact** fires when clicking a WhatsApp button on the Contact or Thank-You page (after a Lead has already fired this session).
   - **Purchase** never fires anywhere on the site — this is intentional. You will mark payments as verified manually.
3. Refresh the page after submitting — confirm Lead does **not** fire again (deduplicated).

### 8. Deploy to GitHub Pages or Netlify
**GitHub Pages:**
1. Create a new GitHub repository and push all these files to it.
2. Go to **Settings → Pages**, set source to your main branch, root folder.
3. Your site will be live at `https://yourusername.github.io/repo-name/`.

**Netlify:**
1. Drag and drop this whole folder onto [app.netlify.com/drop](https://app.netlify.com/drop), or connect the GitHub repo.
2. Netlify will give you a live URL immediately.

After deployment, update `WEBSITE_URL` in `config.js` and the
`__WEBSITE_URL__` placeholders in each page's `<link rel="canonical">`
and Open Graph tags with your real domain.

### 9. Verify the mobile version
Open the deployed site on an actual phone (most of your traffic will
come from Facebook/Instagram ads). Check:
- The form is easy to fill with one thumb.
- Videos load only on tap (lazy-loaded, so initial load is fast).
- The seat badge, payment section, and WhatsApp buttons all work.

### 10. Replace placeholder reviews with real reviews
In `index.html`, find `SECTION 7 — STUDENT REVIEWS`. Each card is
marked `REVIEW PLACEHOLDER`. Replace the name, level, review text,
and image path with real, permission-given student reviews.

---

## Editing seat availability
Open `config.js` and change one number:
```js
SEATS_AVAILABLE: 2,
```
This updates the badge across the site automatically. It is never a
fake countdown — just an honest, editable number.

## How the Meta Pixel events map to the funnel
| Event | Fires when |
|---|---|
| PageView | Every page load |
| ViewContent | Visitor clicks play on the hero sneak-peek video |
| Lead | Enrollment form successfully saved to Google Sheets |
| InitiateCheckout | Payment section becomes visible after a successful submission |
| Contact | WhatsApp button clicked, and Lead already fired this session |
| Lead (fallback) | WhatsApp button clicked, but no form was ever submitted this session |
| Purchase | **Never fired automatically.** Payments are verified manually. |

All events use a unique `event_id` for deduplication, and Lead /
InitiateCheckout are additionally deduplicated per Lead ID in
`localStorage` so refreshing the page never double-counts a lead.

## Notes
- No backend server is used — Google Apps Script + Google Sheets is the only "backend."
- Payment Status in the sheet always starts as `Pending` and is only ever changed by you, manually, after verifying the WhatsApp screenshot.
- If a visitor never pays, their details are still saved in the Leads sheet so you can follow up.
