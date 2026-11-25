/**
 * One CSV cell. Quotes are doubled and the cell is wrapped when it holds a comma, quote or line break. A cell that starts
 * with = + - or @ gets a leading apostrophe so a spreadsheet shows it as text instead of running it as a formula.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvRows = (rows: readonly (readonly unknown[])[]): string => `﻿${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

export const csvResponse = (name: string, body: string): Response =>
  new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
