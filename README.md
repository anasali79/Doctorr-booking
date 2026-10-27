# Schedula — Clinical Appointment Booking & Realtime Queue Tracker

> **Production-grade Full-Stack Healthcare Platform**  
> Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **NestJS 11**, **TypeORM**, **PostgreSQL**, and **Socket.IO**.

---

## 🚀 Live Demo & Production Architecture

- **Frontend:** Next.js App Router (Deployed on Vercel)
- **Backend:** NestJS 11 + TypeORM (Deployed on Render)
- **Database:** PostgreSQL (Neon Serverless Postgres)
- **Realtime Service:** Socket.IO WebSocket Gateway (`/appointments` namespace)

---

## 🩺 System Overview & Features

Schedula eliminates waiting room friction by providing instant auto-confirmed specialist bookings, real-time consultation tracking, and token-based clinic queues.

### 1. Patient Experience
- **Specialist Discovery:** Search by doctor name or filter by 10 medical specializations with live availability badges.
- **Smart Booking:** Browse slots up to doctor-specified booking windows; auto-confirmation without waiting for manual approval.
- **Live Queue Tracker:** Real-time visibility into current token number, queue position (`#queuePosition`), and estimated wait times.
- **Appointment Management:** Cancel or reschedule booked slots with instant slot release.
- **Notification Center:** Clinical alerts for bookings, reschedules, and consultation status changes.

### 2. Practitioner / Doctor Portal
- **Real-Time Clinical Dashboard:** Grouped metrics from the database (Today's queue, upcoming bookings, completed consultations, cancellations, no-shows, unique patients).
- **Roster & Queue Actions:**
  - `CONFIRMED` → **Check In** (assigns queue token)
  - `CHECKED_IN` → **Start Consultation** (alerts patient into consultation room)
  - `IN_CONSULTATION` → **Complete** (marks consultation concluded)
  - Mark **No-Show** or **Cancel**
- **Recurring Weekly Availability Editor:** Configure shifts per day of week, slot duration (15/20/30/45/60 min), buffer time, and scheduling mode (**STREAM** vs **WAVE**).
- **Leave Management:** Block non-working dates with automated patient notification safeguards.

---

## 🔑 Demo Accounts (Pre-configured via Seed)

All accounts share the default password: **`Password123!`**

### 👨‍⚕️ Specialist Doctors

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

### 🧑‍💼 Patients

| Patient Name | Email | Details |
|---|---|---|
| **Rahul Verma** | `patient1@schedula.com` | Age 29, Male, Bangalore |
| **Pooja Sharma** | `patient2@schedula.com` | Age 34, Female, Kolkata |

---

## 🧠 Technical Deep-Dive (Interview & Demo Explanations)

### 1. Why Bearer Authentication via Next.js Route Handlers?
Cross-domain cookies (e.g. Next.js on `vercel.app` calling NestJS on `onrender.com`) frequently get blocked by Safari's Intelligent Tracking Prevention (ITP) and browser incognito modes.
**Solution:** The Next.js server owns the HttpOnly `access_token` cookie on the Next domain. Server components and route handlers decode the session using `jose` and pass `Authorization: Bearer <token>` to the backend API.

### 2. Double-Booking Concurrency Safeguards
When multiple patients attempt to book the same slot simultaneously:
- Bookings execute within PostgreSQL `SERIALIZABLE` transactions.
- Slot validation and insertion are isolated.
- Concurrent conflicts trigger PostgreSQL code `40001` (serialization failure) or `23505` (unique constraint), which our backend maps to `409 ConflictException` with clean user messaging.

### 3. Realtime WebSocket Architecture
- The WebSocket gateway connects to `/appointments` via pure WebSocket transport.
- On connection, clients join role-scoped private rooms: `doctor:<doctorId>` and `patient:<patientId>`.
- Events emitted:
  - `appointment.booked` & `appointment.rescheduled`: Triggered immediately after the DB transaction commits; alerts the doctor live.
  - `appointment.checked_in`, `appointment.consultation_started`, `appointment.completed`: Alerts the patient live and updates their queue dashboard.

---

## 🛠️ Local Development Setup

### Prerequisites
- Node.js >= 18
- PostgreSQL (Local or Neon Database URL)

### 1. Backend Setup
```bash
cd Schedula-anas-main/Schedula-anas-main/Backend

# Install dependencies
npm install

# Run database migrations (applies FixSchemaDrift)
npm run migration:run

# Seed test doctors & patients
npm run seed

# Start NestJS backend (runs on http://localhost:3000)
npm run start:dev
```

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables (.env.local)
cp .env.example .env.local

# Build verification
npm run build

# Start Next.js App Router development server (runs on http://localhost:3001)
npm run dev -- -p 3001
```

---

## 🧪 Two-Browser Verification Flow

1. Open **Browser 1 (Chrome)**: Log in as `rajesh.sharma@schedula.com` (Doctor). Navigate to `/doctor/dashboard`. Notice the live indicator is active.
2. Open **Browser 2 (Incognito/Firefox)**: Log in as `patient1@schedula.com` (Patient). Navigate to `/doctors`, select Dr. Rajesh Sharma, and book an available slot.
3. **Observation in Browser 1:** Instantly, a toast notification pops up ("*New Appointment! Rahul Verma booked a slot*") and the today's queue table automatically refreshes to display the patient row without page reload!
4. **Doctor consultation flow:**
   - Click **Check In**: Patient in Browser 2 sees their status update to *Checked In* and receives their queue position.
   - Click **Start Consultation**: Patient in Browser 2 receives a live alert ("*Consultation Started! Please proceed into the room*").
   - Click **Complete**: Both dashboards reflect the finished state.

---

## 📦 Project Structure

```
Doc-booking/
├── frontend/                          # Next.js 16 App Router application
│   ├── src/
│   │   ├── app/                       # App Router pages and route handlers
│   │   │   ├── (auth)/login & signup  # Authentication pages
│   │   │   ├── doctors/               # Public discovery & slot picker
│   │   │   ├── patient/               # Patient dashboard, appointments, notifications
│   │   │   ├── doctor/                # Doctor dashboard, appointments, availability, leave
│   │   │   └── api/                   # Server-side proxy and auth route handlers
│   │   ├── components/                # Reusable UI components & providers
│   │   ├── hooks/                     # Custom hooks (useAppointmentSocket)
│   │   ├── lib/                       # API clients, utils, schemas, constants
│   │   └── middleware.ts              # Route protection & role redirection
│   └── package.json
│
├── Schedula-anas-main/
│   └── Schedula-anas-main/
│       └── Backend/                   # NestJS 11 REST API & WebSocket Gateway
│           ├── src/
│           │   ├── appointment/       # Booking logic, queue calculation, serialization
│           │   ├── doctor/            # Doctor profile, recurring availability, leaves
│           │   ├── patient/           # Patient profile & dashboard
│           │   ├── sockets/           # Realtime appointment gateway (/appointments)
│           │   ├── migrations/        # 1782277030000-FixSchemaDrift.ts
│           │   └── seed.ts            # 8 doctors + 2 patients database seeder
│           └── package.json
└── README.md
```

---

## 📜 License
MIT License. Developed for Schedula Healthcare Systems.
