export interface PrescriptionMedicine {
  name: string;
  dosage: string; // e.g. "1 Tablet", "5 ml", "1 Capsule", "2 Puffs"
  frequency: string; // e.g. "1-0-1 (Morning & Night)", "1-1-1 (Three times a day)", "1-0-0 (Morning)", "0-0-1 (Night)", "SOS"
  timing: string; // e.g. "After Food", "Before Food", "Empty Stomach", "At Bedtime"
  duration: string; // e.g. "3 Days", "5 Days", "7 Days", "10 Days", "14 Days", "1 Month"
  instructions?: string; // e.g. "Take with warm water", "Avoid milk within 1 hour"
}

export interface PrescriptionVitals {
  bloodPressure?: string; // e.g. "120/80 mmHg"
  pulse?: string; // e.g. "72 bpm"
  temperature?: string; // e.g. "98.6 °F"
  weight?: string; // e.g. "68 kg"
  spo2?: string; // e.g. "99%"
}

export interface Prescription {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  diagnosis: string;
  symptoms?: string | null;
  vitals?: PrescriptionVitals | null;
  medicines: PrescriptionMedicine[];
  labTests?: string | null;
  advice?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  doctor?: {
    id: string;
    fullName: string;
    specialization: string;
    qualification: string;
    experience: number;
    phone?: string | null;
  };
  patient?: {
    id: string;
    fullName: string;
    age: number;
    gender: string;
    phone: string;
    bloodGroup?: string | null;
    allergies?: string | null;
  };
  appointment?: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    tokenNumber?: number | null;
    status: string;
  };
}

export interface CreatePrescriptionPayload {
  appointmentId: string;
  diagnosis: string;
  symptoms?: string;
  vitals?: PrescriptionVitals;
  medicines: PrescriptionMedicine[];
  labTests?: string;
  advice?: string;
  followUpDate?: string;
  notes?: string;
}

