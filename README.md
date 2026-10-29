# Tatkal Helper (Chrome extension)

A small Manifest V3 extension that makes IRCTC Tatkal booking faster **without automating the booking**.
It stores your passengers and trips, fills the train search and passenger forms in one click on pages
you already opened in your own logged-in session, and counts down to the Tatkal window with alerts.

You still do every click that matters: Search, Book Now, Continue, the CAPTCHA, and payment.
It never logs in, never submits a form, never touches payment details.

## Install in Chrome (2 minutes, no store needed)

1. Download the latest **`tatkal-helper-x.y.z.zip`** from the [Releases page](https://github.com/ChandraChaan/tatkal-helper/releases/latest).
2. Unzip it. You get a `tatkal-helper` folder. Keep that folder somewhere permanent (Chrome loads the extension from it every time).
3. Open Chrome and go to `chrome://extensions`.
4. Turn on **Developer mode** (switch at the top right).
5. Click **Load unpacked** and choose the unzipped `tatkal-helper` folder.
6. Click the puzzle-piece icon in the toolbar and **pin** Tatkal Helper so the countdown badge is visible.
7. Optional: at `chrome://extensions/shortcuts` confirm **Alt+Shift+F** is set for "Fill the current IRCTC page".

Works the same way in Edge, Brave and other Chromium browsers (`edge://extensions`, `brave://extensions`).

To update later, download the new zip, unzip it over the same folder, and press the reload icon on the extension card.

Chrome may show "Disable developer mode extensions" on startup. Click the X; the extension keeps working.

## Set up (do this once, days before)

1. Click the extension icon → **Passengers** → add everyone you travel with (name as on ID, age, gender, berth preference).
2. **Trips** → add a trip: from/to station codes (e.g. `SC`, `NDLS`), journey date, class, quota = Tatkal, mobile number, tick the passengers, pick preferences (auto upgrade, insurance, payment option).
3. The trip becomes the **active trip**. The Home tab shows the exact window: 10:00 IST for AC classes, 11:00 IST for non-AC, one day before the journey.
4. **Settings** → alert minutes (default 10 and 2 minutes before). Chrome must allow notifications for the extension.

Also add the same passengers to IRCTC's own **Master List** (My Account → My Master List). It is the official shortcut and a backup if IRCTC changes its page and the fill misses a field.

## On booking day

| When | What you do |
|---|---|
| T-10 min | Alert fires. Log in to IRCTC in one tab. Close other IRCTC tabs. |
| T-5 min | On the train search page press **Fill this page** (popup, floating panel, or Alt+Shift+F). Check from/to/date/class/quota, press **Search**. |
| T-1 min | Be on the train list with your train visible. Alert fires. UPI app open on phone. |
| T-0 | Badge shows **GO**. Click the class on your train, then **Book Now**. |
| Passenger page | Press **Fill this page**. Names, ages, berths, mobile, preferences and payment option are filled. Review, then **Continue**. |
| Review page | Solve the CAPTCHA yourself, press Continue. |
| Payment | Approve the UPI request on your phone. |

## Files

- `manifest.json` – MV3 manifest; runs only on `https://www.irctc.co.in/*`.
- `popup/` – the popup UI (Home, Passengers, Trips, Settings, backup export/import).
- `content/fill-core.js` – pure DOM fill logic for the search and passenger pages (no chrome APIs).
- `content/content.js` – floating panel with countdown and Fill button, message handling.
- `background.js` – alarms before the window, notifications, badge countdown, keyboard shortcut.
- `shared/tatkal.js` – class/quota lists and IST window maths.
- `test/mock-irctc.html` – mock of the two IRCTC pages plus 43 automated checks. Serve the folder (`python3 -m http.server 8765`) and open `/test/mock-irctc.html#auto`.
- `test/popup-preview.html` – renders the popup with sample data outside Chrome's extension runtime.
- `scripts/build-zip.sh` – packages the runtime files into `dist/`. Pushing a `vX.Y.Z` tag runs the same script in GitHub Actions and attaches the zip to a Release.

## Selectors and maintenance

The fill logic targets IRCTC's Angular/PrimeNG form controls by `formcontrolname` with placeholder and label-text fallbacks:
`passengerName`, `passengerAge`, `passengerGender`, `passengerBerthChoice`, `passengerFoodChoice`, `passengerCardType`,
`passengerCardNumber`, `mobileNumber`, `autoUpgradationSelected`, `confirmberths`, the "+ Add Passenger" link, the
travel-insurance and payment radio labels, and on the search page `#origin`, `#destination`, `#jDate`, `#journeyClass`,
`#journeyQuota`. If IRCTC renames one, the fill reports exactly which item it could not set in the toast and the popup,
and the rest still fills. Update the selector in `content/fill-core.js` (`SEL` map and `fillSearchPage`).

The first real run should be a dry run on a **General quota** search well before Tatkal day, so you can see which
fields fill on the live site and fix any that changed.

## Data and privacy

Everything is stored with `chrome.storage.local` in your browser only. Nothing is sent anywhere. Use
Settings → Export JSON to back it up.

## Legal note

IRCTC's terms disallow automated booking tools and Indian Railways prosecutes bot-based Tatkal booking. This
extension deliberately stays on the form-autofill side of that line: it fills fields on your screen and you perform
every navigation, submission, CAPTCHA and payment step. Do not add auto-submit, auto-login or CAPTCHA handling to it.
