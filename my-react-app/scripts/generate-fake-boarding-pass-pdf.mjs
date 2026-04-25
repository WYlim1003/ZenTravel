/**
 * Writes a small PDF with selectable text for QA (PDF upload tests).
 * Run from my-react-app: node scripts/generate-fake-boarding-pass-pdf.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/test-assets');
mkdirSync(outDir, { recursive: true });

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
doc.setFont('helvetica', 'bold');
doc.setFontSize(18);
doc.text('ZenTravel — Fake boarding pass (QA only)', 20, 25);
doc.setFont('helvetica', 'normal');
doc.setFontSize(12);
doc.text('Passenger: ZEN TRAVEL TEST', 20, 40);
doc.text('Flight: MH123', 20, 50);
doc.text('Route: KUL → SIN (Kuala Lumpur to Singapore)', 20, 60);
doc.text('Date: 15 December 2026    Departure: 08:30', 20, 70);
doc.text('Seat: 12A    Boarding gate: A12 (fictional)', 20, 80);
doc.setFontSize(10);
doc.setTextColor(120, 120, 120);
doc.text('Synthetic data for local testing. Not a valid travel document.', 20, 100);

const buf = Buffer.from(doc.output('arraybuffer'));
const pdfPath = join(outDir, 'fake-boarding-pass.pdf');
writeFileSync(pdfPath, buf);
console.log('Wrote:', pdfPath);
