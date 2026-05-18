/**
 * Synthetic airline delay notice PDF for QA (AI-05 PDF upload tests).
 * Run: node scripts/generate-delay-notice-pdf.mjs
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
doc.setFontSize(16);
doc.text('Flight delay notice (TEST DOCUMENT — NOT REAL)', 20, 22);

doc.setDrawColor(200, 200, 200);
doc.line(20, 26, 190, 26);

doc.setFont('helvetica', 'normal');
doc.setFontSize(11);
let y = 36;
const line = (t) => {
  doc.text(t, 20, y);
  y += 7;
};

line('Airline: ZenAir (fictional)');
line('Passenger: ZEN TRAVEL TEST');
line('Flight: MH123');
line('Route: Kuala Lumpur (KUL) → Singapore (SIN)');
line('Scheduled departure: 15 December 2026, 08:30');
line('');
line('We regret to inform you that your flight is delayed due to operational reasons.');
line('Estimated delay: 3 hours.');
line('New estimated departure: 11:30 (local time).');
line('');
line('Please monitor the airport screens for updates. Compensation may apply under');
line('applicable passenger rights. See our website for details.');
line('');
doc.setFontSize(9);
doc.setTextColor(100, 100, 100);
doc.text('Generated for software testing only. Not issued by any real carrier.', 20, y + 6);

const buf = Buffer.from(doc.output('arraybuffer'));
const outPath = join(outDir, 'delay-notice.pdf');
writeFileSync(outPath, buf);
console.log('Wrote:', outPath);
