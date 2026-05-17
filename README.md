# Hand Tournament

Static site for running a 16-team Hand card game tournament. Hosted on
GitHub Pages, backed by a Google Sheet via a small Apps Script bridge.

- `index.html` — public team signup form.
- `bracket.html` — pulls confirmed teams from the sheet, random draw, click-to-advance bracket. Round of 16 is best of 3; quarterfinals → final are single-game knockout.
- `apps-script/Code.gs` — Apps Script that receives signups and exposes the team list.
- `assets/js/config.js` — paste your Apps Script Web App URL here.

## One-time setup

### 1. Wire the Google Sheet to Apps Script

1. Open the tournament sheet:
   <https://docs.google.com/spreadsheets/d/1OlSqFgup1cZFOOj_T_layeGCarBi5hHaLAQf7Werilk/edit>
2. **Extensions → Apps Script**. Replace the default `Code.gs` with the contents of `apps-script/Code.gs`.
3. Save (disk icon).
4. **Deploy → New deployment**.
   - Type: **Web app**
   - Description: `Hand Tournament`
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, authorize the script when prompted, copy the **Web app URL** it shows (looks like `https://script.google.com/macros/s/AKfycb…/exec`).

### 2. Point the static site at the Apps Script

Open `assets/js/config.js` and paste the URL:

```js
window.TOURNAMENT_CONFIG = {
  appsScriptUrl: "https://script.google.com/macros/s/AKfycb.../exec",
  teamsNeeded: 16,
};
```

Commit and push.

### 3. Enable GitHub Pages

On GitHub: **Settings → Pages → Build and deployment**. Set:
- Source: **Deploy from a branch**
- Branch: `main` (or whatever branch you merge into) / root (`/`)

Save. After a minute the site will be live at
<https://moeghashim.github.io/wasimo/>.

## Day-of-tournament flow

1. Share the signup URL. Teams register with name, captain, email, phone.
2. When 16 confirmed teams are in the sheet, open the bracket page and click **Draw bracket (random)**.
3. As matches finish, click the winner in each match card. Round of 16 cards track game wins (best of 3 — first to 2 advances).
4. **Export results (JSON)** at any point for an archive.

Bracket state is stored in the browser (`localStorage`) on whichever device drives the bracket. Use the same device throughout the day, or export & re-import via the JSON button if you need to hand off.

## Updating Apps Script later

If you edit `apps-script/Code.gs`, in the Apps Script editor click **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy**. The URL stays the same.

## Excluding a signup from the bracket

In the sheet, change a row's `Status` column from `confirmed` to anything else (e.g. `withdrew`). The bracket will skip it.
