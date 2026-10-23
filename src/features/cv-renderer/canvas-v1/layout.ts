/**
 * Page rules for printing a free-form design: each sheet of the design is one
 * whole A4 page, margins included, so the printed page adds none.
 */
export function canvasPrintPageCss(): string {
  return [
    "@page { size: A4; margin: 0; }",
    "@media print { html, body { background: #fff !important; } }",
  ].join("\n");
}
