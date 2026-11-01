# Schedula (CareUp) — Clinical Appointment Booking & Realtime Queue Tracker

> **Production-Grade Full-Stack Healthcare Platform**  
> Built with **Next.js 16 (App Router & Turbopack)**, **TypeScript**, **Tailwind CSS**, **NestJS 11**, **TypeORM**, **PostgreSQL (Neon Serverless)**, **Socket.IO WebSockets**, **Vonage Messages & SMS API**, and **Razorpay**.

---

## Live Production Deployments

- **Frontend Web Application:** [https://frontend-tau-five-72.vercel.app](https://frontend-tau-five-72.vercel.app) (Deployed on Vercel)
- **Backend REST API & WebSockets:** [https://doctorr-booking-1.onrender.com](https://doctorr-booking-1.onrender.com) (Deployed on Render)
- **Database:** PostgreSQL on Neon Serverless with TypeORM migrations
- **Postman API Collection:** [View and Test APIs Here](https://www.postman.com/work-anas79-6594293/workspace/anas-ali-s-workspace/collection/50962245-d9f6454f-bca8-472e-91cd-a1de685fce2c?action=share&source=copy-link&creator=50962245)

---

## Key Features & Healthcare Workflows

### 1. Patient Experience
- **Specialist Discovery:** Search physicians by name or filter across 10 medical specializations with real-time availability badges.
- **Consultation Booking:** Browse appointment slots up to practitioner booking limits; instant reservation and auto-confirmation.
- **Live Queue Tracker:** Real-time visibility into queue position (`#queuePosition`), current serving token, and estimated consultation wait times.
- **Medical Health Profile:** View recorded blood group, known allergies, chronic conditions, regular medications, and doctor consultation notes from past completed visits.
- **Appointment Management:** Live reschedule and cancellation workflows with automatic slot release and refund triggering.
- **Notification Center & Preferences:** Multi-channel alert dispatch (Email, SMS, WhatsApp) with customizable preference toggles.

### 2. Practitioner / Doctor Portal
- **My Day Schedule & Queue:** Real-time patient roster with sequential token numbers, appointment statuses, and quick action triage:
  - `CONFIRMED` -> **Check In** (assigns queue token)
  - `CHECKED_IN` -> **Start Consultation** (alerts patient into consultation room)
  - `IN_CONSULTATION` -> **Complete** (marks consultation concluded)
  - **No-Show** & **Doctor Cancellation**
- **Current Patient Details Card:** Real-time medical history, allergies alerts, past visits with this doctor, and persistent clinical notes.
- **Comprehensive Patient Medical Profile Modal:**
  - Complete demographics (Age, Gender, Blood Group, Contact).
  - Editable Clinical Record (Allergies, Chronic Conditions, Regular Medications).
  - Historical visit timeline with past doctor notes.
  - Quick consultation note writer directly into the database.
- **Patients Directory (`/doctor/patients`):**
  - Searchable, filterable directory of all past and active patients.
  - Filter by returning patients (2+ visits), allergy alerts, or recent visits.
  - Quick access to full clinical records to maintain continuity of care across future appointments.
- **Recurring Availability Engine:** Configure working shifts per day of week, slot durations (15/20/30/45/60 min), buffer time, and scheduling mode (**STREAM** vs **WAVE**).
- **Leave Management:** Mark dates as unavailable with automated patient reschedule notifications.

### 3. Realtime Notification Infrastructure
- **WhatsApp (Vonage Messages API):**
  - Official Messages API Sandbox integration (`https://messages-sandbox.nexmo.com/v1/messages`).
  - Supports Application JWT authentication via `private.key` (including Render Secret Files at `/etc/secrets/private.key`) and API Key / Secret fallback.
  - Alphanumeric sender mapping and test number allow-listing.
- **SMS (Vonage SMS API):**
  - Official Vonage SMS REST API integration (`https://rest.nexmo.com/sms/json`).
  - Alphanumeric sender ID `CareUp` with auto-routing to verified test phone numbers in development.
- **Webhooks:**
  - `POST /webhooks/inbound` for incoming WhatsApp and SMS messages.
  - `POST /webhooks/status` for delivery receipts (delivered, read, failed).
- **Email:** Responsive HTML clinical templates via Nodemailer.
- **In-App Realtime:** Socket.IO WebSocket broadcasts and in-app notifications.

### 4. Payments & Refunds (Razorpay)
- **Token Hold:** 15-minute slot reservation during payment checkout (`PENDING_PAYMENT`).
- **Signature Verification:** Server-side HMAC SHA256 validation of Razorpay payment signatures.
- **Automated Refunds:** Automatic refund initiation when appointments are cancelled by the clinic or doctor.

---

## Demo Accounts

All pre-seeded demo accounts share the default password: **`Password123!`**

### Specialist Doctors

| Doctor Name | Specialization | Email | Experience |
|---|---|---|---|
| **Dr. Rajesh Sharma** | Cardiologist | `rajesh.sharma@schedula.com` | 14 Years |
| **Dr. Priya Patel** | Dermatologist | `priya.patel@schedula.com` | 9 Years |
| **Dr. Amit Verma** | Neurologist | `amit.verma@schedula.com` | 16 Years |
| **Dr. Ananya Iyer** | Pediatrician | `ananya.iyer@schedula.com` | 8 Years |
| **Dr. Vikram Rao** | Orthopedist | `vikram.rao@schedula.com` | 12 Years |
| **Dr. Sneha Gupta** | General Physician | `sneha.gupta@schedula.com` | 11 Years |
| **Dr. Meera Reddy** | Gynecologist | `meera.reddy@schedula.com` | 15 Years |
| **Dr. Farhan Khan** | ENT Specialist | `farhan.khan@schedula.com` | 7 Years |

### Patients

| Patient Name | Email | Details |
|---|---|---|
| **Rahul Verma** | `patient1@schedula.com` | Age 29, Male, Bangalore |
| **Pooja Sharma** | `patient2@schedula.com` | Age 34, Female, Kolkata |

---

## Technical Architecture

```
                                  ┌──────────────────────────┐
                                  │   Next.js 16 Frontend    │
                                  │   (Vercel App Router)    │
                                  └────────────┬─────────────┘
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        │ REST API (Bearer Auth) / WebSocket (/appts) │
                        ▼                                             ▼
         ┌──────────────────────────────┐              ┌──────────────────────────────┐
         │     NestJS 11 Backend        │              │     Socket.IO Gateway        │
         │     (Render Web Service)     │              │     (Live Queue & Events)    │
         └──────────────┬───────────────┘              └──────────────────────────────┘
                        │
         ┌──────────────┼───────────────────────────┬──────────────────────────┐
         ▼              ▼                           ▼                          ▼
┌────────────────┐ ┌────────────────┐      ┌─────────────────┐       ┌─────────────────┐
│ Neon Postgres  │ │ Vonage Messages│      │   Vonage SMS    │       │ Razorpay Orders │
│ (TypeORM ORM)  │ │ (WhatsApp API) │      │   (SMS REST)    │       │ & Auto-Refunds  │
└────────────────┘ └────────────────┘      └─────────────────┘       └─────────────────┘
```

---

## Local Development Setup

### Prerequisites
- Node.js >= 18
- PostgreSQL database (Local or Neon Serverless connection string)

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Run database migrations
npm run migration:run

# Seed initial doctors and patients
npm run seed

# Run unit test suite (26 tests)
npm test

# Start NestJS development server (http://localhost:3001)
npm run start:dev
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local

# Run production build check
npm run build

# Start Next.js development server (http://localhost:3000)
npm run dev
```

---

## Project Structure

```
Doc-booking/
├── backend/                           # NestJS 11 REST API & WebSocket Gateway
│   ├── src/
│   │   ├── appointment/               # Booking logic, queue calculations, serialization
│   │   ├── doctor/                    # Doctor profiles, patients directory, availability, leaves
│   │   ├── patient/                   # Patient medical profiles, history, dashboard
│   │   ├── notification/              # Multi-channel notification engine (Vonage, Email, In-App)
│   │   │   ├── providers/             # Vonage SMS, Vonage WhatsApp, Nodemailer, In-App
│   │   │   └── templates/             # Professional notification templates
│   │   ├── payment/                   # Razorpay orders, signatures, refunds
│   │   ├── sockets/                   # Realtime appointment gateway (/appointments)
│   │   ├── migrations/                # Database schema migrations
│   │   └── seed.ts                    # Reference data seeder
│   └── package.json
│
├── frontend/                          # Next.js 16 App Router application
│   ├── src/
│   │   ├── app/                       # App Router routes and Next.js server proxies
│   │   │   ├── (auth)/login & signup  # Authentication
│   │   │   ├── doctors/               # Public specialist directory & slot picker
│   │   │   ├── patient/               # Patient dashboard, medical notes, appointments
│   │   │   ├── doctor/                # Doctor dashboard, my-day, patients directory, availability
│   │   │   └── api/                   # API proxies and session handlers
│   │   ├── components/                # Modular React UI components & modals
│   │   │   ├── doctor/                # MyDayClient, DoctorPatientsClient, PatientProfileModal
│   │   │   ├── patient/               # PatientProfileForm, LiveQueueButton
│   │   │   └── common/                # NotificationPreferencesDialog, DoctorAvatar
│   │   ├── lib/                       # API clients, axios interceptors, schemas, utils
│   │   └── types/                     # Shared TypeScript interfaces
│   └── package.json
└── README.md
```

---

## License
MIT License. Developed for Schedula Healthcare Systems.
