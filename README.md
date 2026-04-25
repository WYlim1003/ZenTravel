
<div align="center">

<!-- Replace REPLACE_FILE_ID below with your Google Drive file id, or paste your full “anyone with the link” URL and remove the template. -->

### For judges: demo video (Google Drive)

[![▶ DEMO VIDEO — JUDGES: CLICK HERE TO WATCH](https://img.shields.io/badge/▶%20DEMO%20VIDEO%20—%20JUDGES%3A%20CLICK%20HERE%20TO%20WATCH-4285F4?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/file/d/1xSmc61ZbqLkoJDPUFb4AaRiVtfWuZhyR/view?usp=sharing)

* * *

**Team Name:** Code & Coffee · **Domain:** Domain 1

<img src="logo.jpg" alt="ZenTravel" width="420" />

**AI-driven travel disruption recovery, smart trip planning, and seamless booking management.**

![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-6.0-purple?style=for-the-badge&logo=vite)
![Firebase](https://img.shields.io/badge/Firebase-BaaS-orange?style=for-the-badge&logo=firebase)
![GLM](https://img.shields.io/badge/AI-GLM--5.1-red?style=for-the-badge&logo=google-gemini)

*Your intelligent companion for navigating travel disruptions and orchestrating stress-free journeys.*
</div>

* * * 

## Project documentation

| Document | File |
|----------|------|
| Product Requirement Documentation | [Product Requirement Documentation Team Code & Coffee.pdf](Product%20Requirement%20Documentation%20Team%20Code%20%26%20Coffee.pdf) |
| System Analysis Documentation | [System Analysis Documentation Team Code & Coffee.pdf](System%20Analysis%20Documentation%20Team%20Code%20%26%20Coffee.pdf) |
| Testing Analysis Documentation | [Testing Analysis Documentation Team Code & Coffee.pdf](Testing%20Analysis%20Documentation%20Team%20Code%20%26%20Coffee.pdf) |
| Pitch deck | [ZenTravel Pitch Deck Team Code & Coffee.pdf](ZenTravel%20Pitch%20Deck%20Team%20Code%20%26%20Coffee.pdf) |

---

## 🌟 Overview

**ZenTravel** is a mobile-first travel companion designed to turn travel chaos into structured recovery. Built for the **Z.AI Hackathon**, the app utilizes the **GLM (ilmu-glm-5.1)** reasoning engine to bridge the gap between "what happened" and "what to do next."

By combining a multi-stage **Brain Master** workflow with specialized AI agents, ZenTravel extracts data from messy inputs—such as screenshots, PDFs, and emails—to generate actionable recovery plans and automate rebooking or compensation claims.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (Latest LTS)
- **Firebase Project** (Firestore & Auth enabled)
- **Z.AI API Key** (GLM 5.1 access)
- **Android Studio** (for mobile builds via Capacitor)

### 1. Clone Repository
```bash
git clone https://github.com/WYlim1003/ZenTravel.git
cd zentravel/my-react-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables (.env)
```bash
VITE_GLM_API_KEY=your_glm_key_here
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
VITE_EMAILJS_SERVICE_ID=your_emailjs_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
```

### 4. Run Application
``` bash
npm run dev
```

---

### 🛠️ Technology Stack
| Layer |	Technology |
|------|-----------|
|**📱 Frontend** |	React 19 (TypeScript), Vite, Tailwind CSS |
|**☁️ Backend / BaaS** |	Firebase (Authentication, Firestore, Storage) |
|**🤖 AI / Orchestrator** |	Z.AI GLM 5.1 (via ILMU OpenAI-compatible API) |
|**📄 Document Intelligence** |	Tesseract.js (OCR), pdfjs-dist (PDF extraction) |
|**📦 Mobile Runtime** |	Capacitor (Android deployment) |
|**📧 Delivery** |	EmailJS (recovery plan dispatch) |
|**🗺️ Maps & Location** |	Google Maps SDK (@react-google-maps/api) |

### System architecture

High-level view of the ZenTravel app (Vite + React SPA), vision service, agents layer, and external services.

![ZenTravel system architecture](<System Architecture Diagram ZenTravel.drawio (1).png>)

---

### 🧩 Core Architecture Patterns 

### 1. 5-Stage Stateful Workflow (Brain Master)

The Brain Master orchestrator follows a tightly controlled pipeline to ensure AI reasoning stays grounded and actionable:

**Stage 1 (Input Agent):** Extracts structured JSON from text, OCR, and PDF evidence

**Stage 2 (Validation):** Pauses workflow if critical fields are missing and prompts for clarification

**Stages 3–5 (ReAct Planner):** GLM decides which mock APIs (Flights, Hotels, Claims) to call, executes them, and 
observes results

**Stage 6 (Strategy):** Generates a final human-readable recovery strategy and plan of action

### 2. Human-in-the-Loop Approval

No high-stakes action is taken autonomously. Users must review and approve or skip suggested recovery steps (e.g., rebooking a flight or drafting a claim) before execution.

### 3. Specialist Agent Model

Includes dedicated Specialist Agents for:

- Flights
- Hotels
- Insurance
- Trips Planner
- Car rentals

Each agent follows a strict JSON output contract to ensure consistent UI rendering and data persistence.

---

### ⚙️ Core System Implementations

### 🤖 Brain Master AI Pipeline

The primary feature of ZenTravel follows a sophisticated orchestration flow:

→ Multi-modal intake: Supports raw text, image OCR, and PDF parsing via a custom visionService

→ Context persistence: Allows the agent to resume after user clarification without losing progress

→ Safety truncation: Input is capped at 8,000 characters to ensure token efficiency and reduce hallucination

→ Fallback logic: Regex-based extraction triggers if the GLM API fails or times out

### 📅 AI Trip Planner

→ Itinerary generation: Combines destination databases with GLM-generated narratives for day-by-day planning

→ PDF export: Uses jsPDF for offline access with sanitized text

### 🏨 Smart Booking & Recommendations

→ Deterministic mock APIs: Provides repeatable flights, hotels, and compensation outcomes for reliable demos

→ Automated recommendations: Detects "Cancelled" status in Firestore and suggests alternative routes or accommodations

---

### ⚠️ Challenges & Solutions
### 🔍 Unstructured Input Handling

**Challenge:**
Users upload blurry screenshots or complex PDF flight notices.

**Solution:**
Client-side OCR (Tesseract.js) and PDF.js extract data. If incomplete, the workflow enters a paused state to request missing information.

### 🧠 Thinking-Model Management

**Challenge:**
GLM may produce reasoning content without visible output or hit token limits.

**Solution:**
glmClient.ts captures reasoning_content and automatically retries with an increased token budget when a "length" finish reason occurs.

### 🛡️ Demo Reliability

**Challenge:**
External travel APIs are often unstable or require paid access.

**Solution:**
Deterministic mock travel APIs (mockTravelAPI.ts) simulate real-world scenarios, ensuring consistent demo performance.

---

### 🗺️ Future Roadmap

**Real Provider Integration:** Replace mock data with Amadeus/Skyscanner and Booking.com APIs.

**Server-Side Orchestration:** Move tool execution to a Node.js backend to better secure API keys.

**Real-time Disruption Push:** Integrate Firebase Cloud Messaging (FCM) for instant flight status alerts.

**Regulatory Logic:** Expand mock rules to include formal EU261 and local Malaysian consumer protection logic.

---

<div align="center">
<b>Built with ❤️ for the UM Hackathon to make travel safer, clearer, and smarter.</b>
</div>
