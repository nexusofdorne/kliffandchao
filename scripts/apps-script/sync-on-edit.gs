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
//
// The header row doesn't have to be row 1: it's found by content (the
// first row containing "guest_id"), so a sheet with its own dashboard or
// extra tracking columns above/around the required ones works as-is —
// nothing but those exact column names is ever read.

const SYNC_URL = 'https://YOUR-DOMAIN/api/sync';
const SYNC_SECRET = 'PASTE_SYNC_WEBHOOK_SECRET_HERE';
const GUESTS_TAB_NAME = 'Guests';
const HEADER_SCAN_ROW_LIMIT = 50;

function findHeaderRow(sheet, columnCount) {
  const scanRows = Math.min(sheet.getLastRow(), HEADER_SCAN_ROW_LIMIT);
  if (scanRows < 1) return null;
  const values = sheet.getRange(1, 1, scanRows, columnCount).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i].indexOf('guest_id') !== -1) {
      return { rowNumber: i + 1, header: values[i].map(String) };
    }
  }
  return null;
}

function syncGuestRowOnEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== GUESTS_TAB_NAME) return;

  const columnCount = sheet.getLastColumn();
  const headerInfo = findHeaderRow(sheet, columnCount);
  if (!headerInfo) return; // header row not found — sheet not set up yet, nothing to do

  const editedRow = e.range.getRow();
  const lastEditedRow = e.range.getLastRow();
  if (lastEditedRow <= headerInfo.rowNumber) return; // only the header/dashboard area above it was touched

  const firstRow = Math.max(headerInfo.rowNumber + 1, Math.min(editedRow, lastEditedRow));
  const lastRow = Math.max(editedRow, lastEditedRow);

  const rows = [];
  for (let row = firstRow; row <= lastRow; row++) {
    const values = sheet.getRange(row, 1, 1, columnCount).getValues()[0];
    const record = {};
    headerInfo.header.forEach((column, index) => {
      if (column) record[column] = String(values[index] ?? '');
    });
    // guest_id specifically, not "any column non-empty": the template's
    // own pre-allocated blank rows can have stray dropdown/formatting
    // values in other columns, which would otherwise look non-blank.
    if (record.guest_id) rows.push(record);
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
