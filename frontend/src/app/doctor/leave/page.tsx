import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function DoctorLeavePage() {
  redirect('/doctor/availability?tab=leaves');
}
