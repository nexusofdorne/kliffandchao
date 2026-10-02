// Reference copy only — this runs inside Google Apps Script, bound to the
// spreadsheet, never inside this repo's own build (hence .gs, excluded
// from tsconfig's and eslint's file globs). docs/BUILD_PLAN.md "Sheet ->
// DB": posts the edited row(s) of the Guests tab to POST /api/sync.
//
// Setup, in the spreadsheet:
//   1. Extensions > Apps Script. Paste this file's contents in, replacing
//      the default Code.gs.
//   2. Fill in SYNC_URL and SYNC_SECRET below (SYNC_SECRET must match this
//      project's SYNC_WEBHOOK_SECRET env var exactly).
//   3. Triggers (the clock icon in the left sidebar) > Add Trigger:
//        - Function: syncGuestRowOnEdit
//        - Event source: From spreadsheet
//        - Event type: On edit
//      Save, and authorize the requested permissions when prompted.
//
// Do NOT rename this function to the bare `onEdit` — that name is Apps
// Script's automatic "simple trigger", which runs without authorization
// and therefore can't make the external UrlFetchApp call below at all.
// `onEdit` also never fires for a deleted row; removals are handled
// separately by the admin dashboard's "Sync now" button instead.

const SYNC_URL = 'https://YOUR-DOMAIN/api/sync';
const SYNC_SECRET = 'PASTE_SYNC_WEBHOOK_SECRET_HERE';
const GUESTS_TAB_NAME = 'Guests';

function syncGuestRowOnEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== GUESTS_TAB_NAME) return;

  const editedRow = e.range.getRow();
  const lastEditedRow = e.range.getLastRow();
  if (editedRow === 1 && lastEditedRow === 1) return; // only the header row was touched

  const columnCount = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, columnCount).getValues()[0].map(String);

  const firstRow = Math.max(2, Math.min(editedRow, lastEditedRow));
  const lastRow = Math.max(editedRow, lastEditedRow);

  const rows = [];
  for (let row = firstRow; row <= lastRow; row++) {
    const values = sheet.getRange(row, 1, 1, columnCount).getValues()[0];
    const record = {};
    header.forEach((column, index) => {
      record[column] = String(values[index] ?? '');
    });
    if (Object.values(record).some((value) => value !== '')) rows.push(record);
  }
  if (rows.length === 0) return;

  UrlFetchApp.fetch(SYNC_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-secret': SYNC_SECRET },
    payload: JSON.stringify({ rows: rows }),
    muteHttpExceptions: true,
  });
}
