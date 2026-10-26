# Doc-Booking (Doctor Appointment Booking System)

Doctor Appointment Booking System built with **NestJS**, **Node.js**, and **TypeScript**.

---

## 📊 Entity Relationship (ER) Diagram

Detailed specification: [ER_DIAGRAM.md](./ER_DIAGRAM.md)

![ER Diagram](./er_diagram.png)

### Relationships Summary

| From | To | Type | Meaning |
|------|----|------|---------|
| **User** | **Patient** | `1 : 0..1` | A user may have one patient profile |
| **User** | **Doctor** | `1 : 0..1` | A user may have one doctor profile |
| **Doctor** | **Availability** | `1 : N` | A doctor sets many availability slots |
| **Patient** | **Appointment** | `1 : N` | A patient books many appointments |
| **Doctor** | **Appointment** | `1 : N` | A doctor attends many appointments |
| **Availability** | **Appointment** | `1 : N` | An appointment is booked inside one availability slot |

---

## 📁 Project Structure

```text
Doc-booking/
├── ER_DIAGRAM.md      # ER diagram documentation
├── er_diagram.png     # ER diagram image
├── er_diagram.svg     # ER diagram vector
├── backend/           # NestJS TypeScript backend API
│   ├── src/
│   │   ├── app.controller.ts
│   │   ├── app.module.ts
│   │   ├── app.service.ts
│   │   └── main.ts
│   ├── package.json
│   └── tsconfig.json
└── README.md          # Project documentation
```

---

## 🚀 Getting Started (Backend)

### Prerequisites
- Node.js (v18+)
- npm

### Installation & Run

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run start:dev
   ```

4. Verify the API:
   Open [http://localhost:3000](http://localhost:3000) in your browser. You should receive:
   ```text
   Hello World!
   ```
