# Test assets (QA only)

Synthetic files for **§6.1b / vision** and **AI-05 (PDF)** testing. **Not** real airline documents.

| File | Purpose |
|------|---------|
| `fake-boarding-pass.png` | Image upload / OCR — clear text: MH123, KUL, SIN |
| `fake-boarding-pass.pdf` | PDF text extraction — same story as PNG, selectable text |
| `delay-notice.pdf` | **AI-05** — delay notice with **MH123**, **KUL–SIN**, **3 hour delay** (selectable text) |

**Regenerate PDFs**

```bash
cd my-react-app
node scripts/generate-fake-boarding-pass-pdf.mjs
node scripts/generate-delay-notice-pdf.mjs
```

**In the app** (`npm run dev`), optional direct URLs:

- `http://localhost:5173/test-assets/fake-boarding-pass.pdf`
- `http://localhost:5173/test-assets/fake-boarding-pass.png`
- `http://localhost:5173/test-assets/delay-notice.pdf`
