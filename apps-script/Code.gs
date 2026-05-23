/**
 * Hand Tournament — Google Apps Script bridge.
 *
 * Receives signups from the GitHub Pages site and writes them into the
 * "Signups" sheet of the bound spreadsheet. Also exposes a GET endpoint
 * the bracket page reads to fetch confirmed teams.
 *
 * Deploy (one-time):
 *   1. Open the target Google Sheet.
 *   2. Extensions -> Apps Script. Replace the default Code.gs with this file.
 *   3. Save. Then Deploy -> New deployment -> Type: Web app.
 *        - Description: Hand Tournament
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Click Deploy, authorize, copy the resulting "Web app URL".
 *   4. Paste that URL into assets/js/config.js as appsScriptUrl, commit & push.
 *
 * The sheet will be created/extended automatically on first signup. Header row:
 *   Timestamp | Team Name | Captain | Email | Phone | Partner | Status | Terms Accepted | Terms Accepted At
 *
 * "Status" defaults to "confirmed". To exclude a team from the draw
 * (e.g. duplicate, no-show, didn't pay), set Status to anything other than
 * "confirmed".
 */

var SHEET_NAME = 'Signups';
var HEADERS = ['Timestamp', 'Team Name', 'Captain', 'Email', 'Phone', 'Partner', 'Status', 'Terms Accepted', 'Terms Accepted At'];

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'list') return jsonOut({ ok: true, teams: listTeams() });
  return jsonOut({ ok: false, error: 'Unknown action' });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var action = body.action || 'signup';
    if (action !== 'signup') {
      return jsonOut({ ok: false, error: 'Unknown action' });
    }
    var p = body.payload || {};
    var teamName = clean(p.teamName);
    var captain  = clean(p.captainName);
    var email    = clean(p.email);
    var phone    = clean(p.phone);
    var partner  = clean(p.partnerName);
    var termsAccepted = p.termsAccepted === true;

    if (!teamName || !captain || !email || !phone) {
      return jsonOut({ ok: false, error: 'Missing required fields' });
    }
    if (!termsAccepted) {
      return jsonOut({ ok: false, error: 'Tournament terms must be accepted' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonOut({ ok: false, error: 'Invalid email' });
    }

    var sheet = ensureSheet();

    // Reject duplicate team names (case-insensitive, against confirmed rows).
    var existing = sheet.getDataRange().getValues();
    var lowerName = teamName.toLowerCase();
    for (var i = 1; i < existing.length; i++) {
      var status = String(existing[i][6] || '').toLowerCase();
      if (status === 'confirmed' && String(existing[i][1] || '').toLowerCase() === lowerName) {
        return jsonOut({ ok: false, error: 'Team name already taken' });
      }
    }

    var now = new Date();
    sheet.appendRow([now, teamName, captain, email, phone, partner, 'confirmed', true, now]);
    var position = countConfirmed(sheet);
    return jsonOut({ ok: true, position: position });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message || err) });
  }
}

function ensureSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
    for (var i = 0; i < HEADERS.length; i++) {
      if (!currentHeaders[i]) {
        sheet.getRange(1, i + 1).setValue(HEADERS[i]);
      }
    }
  }
  return sheet;
}

function countConfirmed(sheet) {
  var values = sheet.getDataRange().getValues();
  var n = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][6] || '').toLowerCase() === 'confirmed') n++;
  }
  return n;
}

function listTeams() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var status = String(row[6] || '').toLowerCase();
    if (status !== 'confirmed') continue;
    out.push({
      timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ''),
      teamName: String(row[1] || ''),
      captainName: String(row[2] || ''),
      // Email and phone intentionally omitted from the public bracket feed.
    });
  }
  return out;
}

function clean(v) {
  return String(v == null ? '' : v).trim().slice(0, 200);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
