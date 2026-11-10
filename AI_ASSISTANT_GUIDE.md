# CareUp AI Chat & Continuous Voice Assistant Guide

Production-quality Free AI Assistant integrated into the Doctorr-booking platform.

---

## 1. Architecture Overview

```
                      +---------------------------------------+
                      |       Web Browser (Chrome / Edge)     |
                      | - SpeechRecognition (hi-IN / en-IN)   |
                      | - window.speechSynthesis (TTS)        |
                      | - Continuous Voice Loop State Machine |
                      +-------------------+-------------------+
                                          |
                          HTTP POST /api/ai/chat (JWT)
                                          |
                                          v
                      +---------------------------------------+
                      |         Next.js Route Handlers        |
                      | - Validates Auth Cookie via Jose      |
                      | - Injects verified Bearer JWT         |
                      +-------------------+-------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |       NestJS AI Orchestrator Layer    |
                      | - Role Verification (JwtAuthGuard)    |
                      | - Per-User Daily Message Quota Cap    |
                      | - Data Minimization / Privacy Masker  |
                      | - Multi-Turn Function Calling Loop    |
                      +---------+-------------------+---------+
                                |                   |
               Tool Requests    |                   |  Reasoning & NLP
                                v                   v
      +-----------------------------+     +-------------------------------+
      |  Existing NestJS Services   |     | Google Gemini API Free Tier   |
      | - AppointmentService        |     | - Model: gemini-2.0-flash     |
      | - AvailabilityService       |     | - $0 Cost (No billing/card)   |
      | - DoctorService             |     | - 15 RPM / 1,500 RPD          |
      | - ElasticSchedulingService  |     | - Multi-turn Function Calling |
      | - PaymentService            |     +-------------------------------+
      | - PrescriptionService       |
      | - NotificationService       |
      +-----------------------------+
```

---

## 2. Zero-Paid-Cost & Free-Tier Guarantees

1. **AI Reasoning:** Powered strictly by **Google Gemini API Free Tier** (`gemini-2.0-flash` or `gemini-1.5-flash`). Zero credit card, zero billing requirement.
2. **Speech-to-Text (Voice In):** Uses client-side browser **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`). Runs locally on the client machine at 0 cloud cost.
3. **Text-to-Speech (Voice Out):** Uses native browser **`window.speechSynthesis`** with Indian English (`en-IN`) and Hindi (`hi-IN`) voices.
4. **Quota Protection:** Built-in per-user daily message cap (`AI_DAILY_MESSAGE_CAP_PER_USER=30`) and exponential backoff retry for 429 errors.

---

## 3. Two-Step Confirmation Safety (Section 8)

Destructive actions (Booking, Rescheduling, Cancellation) are **never executed directly by the LLM**:
1. When a user asks to book, reschedule, or cancel, the AI generates a **Preview** with a 5-minute TTL `confirmationId`.
2. A confirmation card is displayed in the UI with key details (Doctor, Date, Time, Fee).
3. The real backend service executes **only** when the user clicks **Confirm** or speaks **"Haan confirm karo" / "Yes confirm"**.
4. The backend revalidates slot availability at execution time to prevent double-booking.

---

## 4. Healthcare Data Privacy (Section 3E)

Because Google AI Studio free tier inputs/outputs may be reviewed to improve models:
* Patient phone numbers, emails, addresses, allergies, medical history, clinical notes, and private diagnoses are **stripped** before sending payloads to Gemini.
* Anonymization flag: `AI_SEND_PATIENT_NAMES=false` ensures patient names are masked as `"Patient"`.
* Prescription and Payment tools return only high-level status (`"Prescription Available"`, `"Payment: SUCCESS"`), never medication names or dosages.
* **Testing:** Use only synthetic dummy data (`npm run seed:ai`). Never test with real patient records on free tier.

---

## 5. Free Environment Setup

In `backend/.env`, add:

```env
# ==============================================================================
# AI ASSISTANT CONFIGURATION (Zero-Cost Free Tier via Google AI Studio)
# ==============================================================================
GEMINI_API_KEY=AIzaSy...your_free_key_from_google_ai_studio
GEMINI_MODEL=gemini-2.0-flash
AI_PROVIDER=gemini
AI_ENABLE_VOICE_INPUT=true
AI_ENABLE_VOICE_OUTPUT=true
AI_ENABLE_CONTINUOUS_VOICE=true
AI_ENABLE_GROQ_FALLBACK=false
AI_SEND_PATIENT_NAMES=false
AI_DAILY_MESSAGE_CAP_PER_USER=30
AI_MAX_HISTORY_MESSAGES=10
```

### How to get a 100% Free Gemini API Key:
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your standard Google account.
3. Click **"Get API key"** -> **"Create API key in new project"**.
4. **DO NOT** click "Set up billing" or link a credit card. Keep it on the **Free Tier**.
5. Copy the generated key and paste it as `GEMINI_API_KEY` in `backend/.env`.

---

## 6. Continuous Voice Session Mode Guide

1. Click **"Voice ON (Continuous)"** once in the assistant window.
2. The microphone starts with a pulsing **"Listening..."** indicator.
3. **Echo Prevention:** When the AI speaks (`speechSynthesis`), the microphone automatically pauses so the AI never hears its own voice.
4. **Barge-in:** If you start speaking while the AI is talking, speech stops immediately and listening resumes.
5. **Silence Timeout:** If there is 2 minutes of complete silence, the voice session turns OFF automatically to protect free API quota.
6. **Voice Commands:** You can speak `"stop"`, `"band karo"`, or `"voice off"` at any time to end the voice session.

---

## 7. Browser Voice Compatibility

| Browser | Speech Recognition (STT) | Speech Synthesis (TTS) | Experience |
| :--- | :--- | :--- | :--- |
| **Google Chrome (Desktop & Android)** | Full Native Support | Full Native Support | Best / Recommended |
| **Microsoft Edge (Desktop & Android)** | Full Native Support | Full Native Support | Best / Recommended |
| **Brave / Chromium** | Full Support | Full Support | Excellent |
| **Safari (macOS / iOS)** | Partial Support (Needs permission per session) | Full Support | Supported (HTTPS required) |
| **Firefox** | Not supported by default | Full Support | Text chat enabled with warning badge |

> **Note:** Browsers strictly require `https://` (or `http://localhost`) to allow microphone access.

---

## 8. Synthetic Dummy Data Seeding

To seed synthetic doctors, patients, and test appointments:

```bash
cd backend
npm run seed:ai
```

Synthetic Credentials:
* **Doctor:** `ai.doctor@example.com` / `TestPassword123!` (Dr. Aryan Sharma, Cardiologist)
* **Patient 1:** `ai.patient1@example.com` / `TestPassword123!` (Rahul Verma)
* **Patient 2:** `ai.patient2@example.com` / `TestPassword123!` (Priya Singh)

---

## 9. Verification & Test Suite

Run full backend unit & security tests:

```bash
cd backend
npx jest src/ai/tests/ai.spec.ts
```

All 15 security, confirmation, role-boundary, quota-cap, and data minimization tests pass with 100% success.

