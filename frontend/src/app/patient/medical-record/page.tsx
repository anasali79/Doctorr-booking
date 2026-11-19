import { redirect } from 'next/navigation';

export default function MedicalRecordRedirect() {
  redirect('/patient/medical-records');
}
