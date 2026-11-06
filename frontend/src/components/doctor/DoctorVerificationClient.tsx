'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DoctorVerification } from '@/types';
import { submitDoctorVerification } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ShieldCheck,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Building2,
  Stethoscope,
  Award,
  Loader2,
} from 'lucide-react';

interface DoctorVerificationClientProps {
  initialVerification: DoctorVerification | null;
  doctorProfile: {
    fullName: string;
    specialization: string;
    experience?: number;
    qualification?: string;
  } | null;
  token?: string;
}

export function DoctorVerificationClient({
  initialVerification,
  doctorProfile,
  token,
}: DoctorVerificationClientProps) {
  const router = useRouter();
  const [verification, setVerification] = useState<DoctorVerification | null>(
    initialVerification,
  );
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState(
    initialVerification?.fullName || doctorProfile?.fullName || '',
  );
  const [degree, setDegree] = useState(
    initialVerification?.degree || doctorProfile?.qualification || '',
  );
  const [specialization, setSpecialization] = useState(
    initialVerification?.specialization || doctorProfile?.specialization || '',
  );
  const [medicalRegistrationNumber, setMedicalRegistrationNumber] = useState(
    initialVerification?.medicalRegistrationNumber || '',
  );
  const [registrationAuthority, setRegistrationAuthority] = useState(
    initialVerification?.registrationAuthority || '',
  );
  const [experience, setExperience] = useState(
    String(initialVerification?.experience ?? doctorProfile?.experience ?? ''),
  );
  const [clinicName, setClinicName] = useState(
    initialVerification?.clinicName || '',
  );
  const [practiceAddress, setPracticeAddress] = useState(
    initialVerification?.practiceAddress || '',
  );
  const [consultationType, setConsultationType] = useState(
    initialVerification?.consultationType || 'BOTH',
  );

  // Files
  const [registrationCert, setRegistrationCert] = useState<File | null>(null);
  const [degreeCert, setDegreeCert] = useState<File | null>(null);
  const [specializationCert, setSpecializationCert] = useState<File | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

  const status = verification?.status || 'NOT_SUBMITTED';
  const isApproved = status === 'APPROVED';
  const isPending = status === 'PENDING';
  const isRejected = status === 'REJECTED';
  const isResubmission = status === 'RESUBMISSION_REQUIRED';
  const isSuspended = status === 'SUSPENDED';

  const canEditAndSubmit =
    status === 'NOT_SUBMITTED' || isRejected || isResubmission;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) return toast.error('Full Name is required');
    if (!degree.trim()) return toast.error('Degree is required (e.g. MBBS, MD)');
    if (!specialization.trim()) return toast.error('Specialization is required');
    if (!medicalRegistrationNumber.trim())
      return toast.error('Medical Registration Number is required');
    if (!registrationAuthority.trim())
      return toast.error('State Medical Council / Issuing Authority is required');

    // On initial submission, certificates are mandatory
    if (status === 'NOT_SUBMITTED') {
      if (!registrationCert) {
        return toast.error('Please upload your Medical Registration Certificate');
      }
      if (!degreeCert) {
        return toast.error('Please upload your Degree/Qualification Certificate');
      }
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('degree', degree.trim());
      formData.append('specialization', specialization.trim());
      formData.append('medicalRegistrationNumber', medicalRegistrationNumber.trim());
      formData.append('registrationAuthority', registrationAuthority.trim());
      if (experience) formData.append('experience', experience);
      if (clinicName) formData.append('clinicName', clinicName.trim());
      if (practiceAddress) formData.append('practiceAddress', practiceAddress.trim());
      if (consultationType) formData.append('consultationType', consultationType);

      if (registrationCert) formData.append('registrationCert', registrationCert);
      if (degreeCert) formData.append('degreeCert', degreeCert);
      if (specializationCert) formData.append('specializationCert', specializationCert);
      if (profilePhoto) formData.append('profilePhoto', profilePhoto);

      const res = await submitDoctorVerification(formData, token);
      toast.success(res.message || 'Verification submitted successfully');
      setVerification({
        ...(verification || ({} as any)),
        status: 'PENDING',
        submittedAt: new Date().toISOString(),
      });
      router.refresh();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to submit verification';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#0066cc] border border-blue-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Doctor Credentials & Medical Council Verification</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Practitioner Verification
          </h1>
          <p className="text-sm text-slate-500">
            To ensure patient safety and maintain compliance with medical standards,
            credentials are reviewed by our administration team before application access is unlocked.
          </p>
        </div>

        {/* Current Status Pill */}
        <div className="shrink-0">
          {isApproved && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>APPROVED & ACTIVE</span>
            </div>
          )}
          {isPending && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>UNDER ADMIN REVIEW</span>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold shadow-2xs">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>APPLICATION NOT APPROVED</span>
            </div>
          )}
          {isResubmission && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>RESUBMISSION REQUESTED</span>
            </div>
          )}
          {isSuspended && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs font-bold shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>ACCOUNT SUSPENDED</span>
            </div>
          )}
          {status === 'NOT_SUBMITTED' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
              <span>ACTION REQUIRED: NOT SUBMITTED</span>
            </div>
          )}
        </div>
      </div>

      {/* Rejection / Resubmission Notice */}
      {(isRejected || isResubmission || isSuspended) && verification?.rejectionReason && (
        <Card className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Admin Remarks:</span>
          </div>
          <p className="text-sm text-rose-900 bg-white/80 p-4 rounded-2xl border border-rose-200/60 font-medium">
            {verification.rejectionReason}
          </p>
          {(isRejected || isResubmission) && (
            <p className="text-xs text-rose-700 pt-1">
              Please review the feedback above, update the relevant details or re-upload documents, and submit again.
            </p>
          )}
        </Card>
      )}

      {/* Pending Banner */}
      {isPending && (
        <Card className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
            <Clock className="w-5 h-5 text-amber-600" />
            <span>Verification In Progress</span>
          </div>
          <p className="text-sm text-amber-800 leading-relaxed">
            Your verification submission has been received and is currently under review by our medical compliance administrators.
            Review typically takes less than 24 hours. You will receive an email notification once approved, which will unlock full clinical access to appointments, patient charts, and prescriptions.
          </p>
          {verification?.submittedAt && (
            <div className="text-xs text-amber-700 font-medium">
              Submitted on: {new Date(verification.submittedAt).toLocaleString()}
            </div>
          )}
        </Card>
      )}

      {/* Approved Banner */}
      {isApproved && (
        <Card className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-950 font-bold text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Full Practitioner Privileges Unlocked</span>
            </div>
            <Button
              type="button"
              onClick={() => router.push('/doctor/dashboard')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
            >
              Open Doctor Dashboard &rarr;
            </Button>
          </div>
          <p className="text-sm text-emerald-800 leading-relaxed">
            Your medical credentials and council registration have been verified by the CareUp administrator.
            You now have unrestricted access to your schedule, live queues, consultations, and prescriptions.
          </p>
        </Card>
      )}

      {/* Verification Submission / Resubmission Form */}
      {canEditAndSubmit && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Personal & Professional Info */}
          <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Personal & Professional Credentials
                </h3>
                <p className="text-xs text-slate-500">
                  Must match the name and details on your medical degree certificate.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Full Name (with Prefix) <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Jane Doe"
                  className="rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Primary Medical Degree <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  placeholder="e.g. MBBS, MD (Internal Medicine)"
                  className="rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Specialization <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Cardiology, General Medicine"
                  className="rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Years of Professional Experience
                </label>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g. 8"
                  className="rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Medical Registration Number <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  value={medicalRegistrationNumber}
                  onChange={(e) => setMedicalRegistrationNumber(e.target.value)}
                  placeholder="e.g. MCI-2015-89472"
                  className="rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  State Medical Council / Issuing Authority <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  value={registrationAuthority}
                  onChange={(e) => setRegistrationAuthority(e.target.value)}
                  placeholder="e.g. Maharashtra Medical Council / NMC"
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
          </Card>

          {/* Section 2: Practice Information */}
          <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Practice & Clinic Information
                </h3>
                <p className="text-xs text-slate-500">
                  Where you currently consult patients.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Clinic or Hospital Name
                </label>
                <Input
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. Apollo Spectra / LifeCare Clinic"
                  className="rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Consultation Mode
                </label>
                <select
                  value={consultationType}
                  onChange={(e) => setConsultationType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]"
                >
                  <option value="BOTH">In-Person & Online</option>
                  <option value="IN_PERSON">In-Person Only</option>
                  <option value="ONLINE">Online Video Consultation Only</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Clinic / Practice Address
                </label>
                <Input
                  value={practiceAddress}
                  onChange={(e) => setPracticeAddress(e.target.value)}
                  placeholder="e.g. Suite 402, Medical Enclave, MG Road"
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
          </Card>

          {/* Section 3: Professional Verification Documents */}
          <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Professional Documents
                </h3>
                <p className="text-xs text-slate-500">
                  Upload PDF or high-resolution images (max 5 MB each). Aadhaar or unnecessary sensitive IDs are never requested.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Mandatory Registration Certificate */}
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Medical Council Registration Certificate <span className="text-rose-500">*</span>
                  </span>
                  {verification?.hasRegistrationCert && !registrationCert && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                      Uploaded Previously
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  State Medical Council or National Medical Commission registration certificate.
                </p>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setRegistrationCert(e.target.files?.[0] || null)}
                  className="rounded-xl text-xs bg-white file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0066cc]"
                />
              </div>

              {/* Mandatory Degree Certificate */}
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Degree / Qualification Certificate <span className="text-rose-500">*</span>
                  </span>
                  {verification?.hasDegreeCert && !degreeCert && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                      Uploaded Previously
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  MBBS, MD, MS, or equivalent primary qualifying medical degree certificate.
                </p>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDegreeCert(e.target.files?.[0] || null)}
                  className="rounded-xl text-xs bg-white file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0066cc]"
                />
              </div>

              {/* Optional Specialization Certificate */}
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Additional Specialization Certificate (Optional)
                  </span>
                  {verification?.hasSpecializationCert && !specializationCert && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                      Uploaded Previously
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Fellowship, super-specialty, or board certification certificate if applicable.
                </p>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSpecializationCert(e.target.files?.[0] || null)}
                  className="rounded-xl text-xs bg-white file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0066cc]"
                />
              </div>

              {/* Optional Profile Photo */}
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Profile Photograph (Optional)
                  </span>
                  {verification?.hasProfilePhoto && !profilePhoto && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                      Uploaded Previously
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Professional headshot in white coat or formal medical attire.
                </p>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)}
                  className="rounded-xl text-xs bg-white file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0066cc]"
                />
              </div>
            </div>
          </Card>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold px-8 py-3 rounded-2xl shadow-xs text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Submitting Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  <span>
                    {status === 'NOT_SUBMITTED'
                      ? 'Submit for Admin Verification'
                      : 'Resubmit Updated Credentials'}
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

