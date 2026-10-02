// RAW input protects the Sheet itself from formula injection, but the
// moment the couple does File → Download → CSV and opens it in Excel, a
// cell starting with = + - @ executes as a formula — docs/PLAN.md "The
// core move: append-only log".
export function safeCell(value: string): string {
  const prefixed = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return prefixed.replace(/[\u0000-\u001F]/g, '').slice(0, 500);
}
