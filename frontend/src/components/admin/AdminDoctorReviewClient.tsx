'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  approveDoctor,
  rejectDoctor,
  requestResubmission,
  suspendDoctor,
} from '@/lib/api/admin';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  ShieldCheck,
  Building2,
  Stethoscope,
  Award,
  Loader2,
  Lock,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface AdminDoctorReviewClientProps {
  doctor: any;
  token?: string;
}

export function AdminDoctorReviewClient({
  doctor,
  token,
}: AdminDoctorReviewClientProps) {
  const router = useRouter();
  const v = doctor.verification;
  const status = v?.status || 'NOT_SUBMITTED';

  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState<
    'APPROVE' | 'REJECT' | 'RESUBMISSION' | 'SUSPEND' | null
  >(null);
  const [reason, setReason] = useState('');

  const handleApprove = async () => {
    try {
      setLoading(true);
      await approveDoctor(doctor.id, token);
      toast.success('Doctor verified and approved successfully!');
      setModalType(null);
      router.refresh();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Approval failed';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleActionWithReason = async () => {
    if (!reason.trim()) {
      return toast.error('A clear mandatory reason is required');
    }

    try {
      setLoading(true);
      if (modalType === 'REJECT') {
        await rejectDoctor(doctor.id, reason.trim(), token);
        toast.success('Doctor application rejected');
      } else if (modalType === 'RESUBMISSION') {
        await requestResubmission(doctor.id, reason.trim(), token);
        toast.success('Document resubmission requested from practitioner');
      } else if (modalType === 'SUSPEND') {
        await suspendDoctor(doctor.id, reason.trim(), token);
        toast.success('Practitioner clinical access suspended');
      }
      setModalType(null);
      setReason('');
      router.refresh();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Action failed';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const openDocument = (field: string) => {
    const url = `/api/admin/doctors/${doctor.id}/documents/${field}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/doctors"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#0066cc] bg-white border border-slate-200/90 px-3.5 py-2 rounded-xl shadow-2xs transition-all hover:border-blue-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Doctors Directory</span>
        </Link>
        <span className="text-xs text-slate-400 font-mono">
          Doctor ID: {doctor.id}
        </span>
      </div>

      {/* Primary Header Card with Professional Buttons */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-[#0066cc] to-[#00408a] text-white font-black text-2xl flex items-center justify-center shadow-sm shrink-0 ring-4 ring-blue-50">
            {doctor.fullName?.replace('Dr.', '').trim()[0] || 'D'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {doctor.fullName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#0066cc] border border-blue-200/80 capitalize">
                {doctor.specialization}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">{doctor.email}</p>
          </div>
        </div>

        {/* Action Buttons Toolbar with High-End SaaS Styling */}
        <div className="flex items-center gap-2.5 flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          {/* APPROVE BUTTON */}
          {status !== 'APPROVED' && status !== 'SUSPENDED' && (
            <Button
              type="button"
              onClick={() => setModalType('APPROVE')}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve Doctor</span>
            </Button>
          )}

          {/* REQUEST RESUBMISSION BUTTON */}
          {status !== 'APPROVED' && status !== 'SUSPENDED' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalType('RESUBMISSION');
                setReason('');
              }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Request Resubmission</span>
            </Button>
          )}

          {/* REJECT BUTTON */}
          {status !== 'REJECTED' && status !== 'SUSPENDED' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalType('REJECT');
                setReason('');
              }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl font-bold text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/90 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Reject</span>
            </Button>
          )}

          {/* SUSPEND BUTTON */}
          {status === 'APPROVED' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalType('SUSPEND');
                setReason('');
              }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black text-white border border-slate-800 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Suspend Access</span>
            </Button>
          )}
        </div>
      </div>

      {/* Verification Status Banner */}
      <Card
        className={`rounded-3xl p-6 sm:p-7 border shadow-xs ${
          status === 'APPROVED'
            ? 'border-emerald-200 bg-emerald-50/70'
            : status === 'PENDING'
            ? 'border-amber-200 bg-amber-50/70'
            : status === 'REJECTED'
            ? 'border-rose-200 bg-rose-50/70'
            : status === 'SUSPENDED'
            ? 'border-slate-800 bg-slate-900 text-white'
            : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                status === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : status === 'PENDING'
                  ? 'bg-amber-100 text-amber-700'
                  : status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-700'
                  : status === 'SUSPENDED'
                  ? 'bg-slate-800 text-amber-400'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {status === 'APPROVED' && <CheckCircle2 className="w-5 h-5" />}
              {status === 'PENDING' && <Clock className="w-5 h-5" />}
              {status === 'REJECTED' && <XCircle className="w-5 h-5" />}
              {status === 'SUSPENDED' && <ShieldAlert className="w-5 h-5" />}
              {status === 'NOT_SUBMITTED' && <FileText className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight">
                Current Status: {status.replace('_', ' ')}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  status === 'SUSPENDED' ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                {status === 'APPROVED'
                  ? 'Doctor is fully verified. Consultation scheduling and doctor console are unlocked.'
                  : status === 'PENDING'
                  ? 'Doctor has submitted credentials and documents. Awaiting your administrative review.'
                  : status === 'REJECTED'
                  ? 'Application declined. Feedback provided to the doctor for rectification.'
                  : status === 'SUSPENDED'
                  ? 'Doctor clinical access is blocked immediately. Historical consultation and prescription records are preserved.'
                  : 'Doctor has completed basic profile but has not yet submitted credentials.'}
              </p>
            </div>
          </div>

          {v?.submittedAt && (
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border shrink-0 self-start sm:self-auto ${
                status === 'SUSPENDED'
                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                  : 'bg-white/90 border-slate-200/80 text-slate-600'
              }`}
            >
              Submitted: {new Date(v.submittedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {v?.rejectionReason && (
          <div className="mt-4 pt-4 border-t border-black/10 text-xs">
            <span className="font-bold text-slate-800 block mb-1">
              Administrative Reason / Remarks:
            </span>
            <p className="p-3.5 rounded-xl bg-white/90 text-slate-800 border border-slate-200/80 font-medium leading-relaxed">
              {v.rejectionReason}
            </p>
          </div>
        )}
      </Card>

      {/* Qualifications & Practice Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Professional Information */}
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Award className="w-4 h-4 text-[#0066cc]" />
            <h3 className="text-sm font-bold text-slate-900">
              Qualifications & Medical Council Registration
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">Primary Degree</span>
              <span className="font-bold text-slate-900">
                {v?.degree || doctor.qualification || '—'}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">Specialization</span>
              <span className="font-bold text-slate-900 capitalize">
                {v?.specialization || doctor.specialization}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">Medical Registration #</span>
              <span className="font-mono font-bold text-slate-900 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px]">
                {v?.medicalRegistrationNumber || '—'}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">State Medical Council</span>
              <span className="font-bold text-slate-900">
                {v?.registrationAuthority || '—'}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">Clinical Experience</span>
              <span className="font-bold text-slate-900">
                {v?.experience ?? doctor.experience} Years
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-slate-500 font-semibold">Consultation Fee</span>
              <span className="font-black text-slate-900 text-sm">
                ₹{doctor.consultationFee}
              </span>
            </div>
          </div>
        </Card>

        {/* Practice Information */}
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#0066cc]" />
            <h3 className="text-sm font-bold text-slate-900">
              Practice & Clinic Information
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">Clinic / Hospital Name</span>
              <span className="font-bold text-slate-900">
                {v?.clinicName || 'Not specified'}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">Consultation Mode</span>
              <span className="font-bold text-slate-900">
                {v?.consultationType === 'IN_PERSON'
                  ? 'In-Person Only'
                  : v?.consultationType === 'ONLINE'
                  ? 'Online Video Only'
                  : 'In-Person & Online'}
              </span>
            </div>

            <div className="py-2">
              <span className="text-slate-500 font-semibold block mb-1">
                Clinic Address
              </span>
              <p className="p-3 rounded-xl bg-slate-50 text-slate-700 leading-relaxed font-medium border border-slate-200/60">
                {v?.practiceAddress || 'Not specified'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Submitted Documents Section with Enhanced Card Buttons */}
      <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 space-y-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0066cc]" />
            <h3 className="text-sm font-bold text-slate-900">
              Submitted Professional Certificates
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Stored securely • Protected streaming
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Medical Registration Certificate */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                  Mandatory
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    v?.hasRegistrationCert ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                Medical Council Registration
              </h4>
            </div>

            {v?.hasRegistrationCert ? (
              <Button
                type="button"
                onClick={() => openDocument('registrationCertPath')}
                className="w-full h-9 rounded-xl text-xs font-bold bg-[#0066cc] hover:bg-[#0052a3] text-white shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Document</span>
              </Button>
            ) : (
              <div className="p-2 text-center text-xs text-slate-400 bg-slate-100 rounded-xl font-medium">
                Not uploaded
              </div>
            )}
          </div>

          {/* Medical Degree Certificate */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                  Mandatory
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    v?.hasDegreeCert ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                Degree / Qualification
              </h4>
            </div>

            {v?.hasDegreeCert ? (
              <Button
                type="button"
                onClick={() => openDocument('degreeCertPath')}
                className="w-full h-9 rounded-xl text-xs font-bold bg-[#0066cc] hover:bg-[#0052a3] text-white shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Document</span>
              </Button>
            ) : (
              <div className="p-2 text-center text-xs text-slate-400 bg-slate-100 rounded-xl font-medium">
                Not uploaded
              </div>
            )}
          </div>

          {/* Specialization Certificate */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                  Optional
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    v?.hasSpecializationCert ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                Specialization Certificate
              </h4>
            </div>

            {v?.hasSpecializationCert ? (
              <Button
                type="button"
                onClick={() => openDocument('specializationCertPath')}
                className="w-full h-9 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Document</span>
              </Button>
            ) : (
              <div className="p-2 text-center text-xs text-slate-400 bg-slate-100 rounded-xl font-medium">
                Not provided
              </div>
            )}
          </div>

          {/* Profile Photo */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                  Optional
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    v?.hasProfilePhoto ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                Profile Photo
              </h4>
            </div>

            {v?.hasProfilePhoto ? (
              <Button
                type="button"
                onClick={() => openDocument('profilePhotoPath')}
                className="w-full h-9 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Photo</span>
              </Button>
            ) : (
              <div className="p-2 text-center text-xs text-slate-400 bg-slate-100 rounded-xl font-medium">
                Not provided
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Confirmation & Mandatory Reason Modal */}
      <Dialog open={!!modalType} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="max-w-md rounded-3xl border border-slate-200 bg-white p-7 space-y-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              {modalType === 'APPROVE' && 'Confirm Doctor Approval'}
              {modalType === 'REJECT' && 'Reject Doctor Application'}
              {modalType === 'RESUBMISSION' && 'Request Document Resubmission'}
              {modalType === 'SUSPEND' && 'Suspend Doctor Account'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed mt-1">
              {modalType === 'APPROVE' &&
                'Approving this practitioner will unlock doctor console privileges immediately and send an official approval email.'}
              {modalType === 'REJECT' &&
                'Please enter the specific reason for rejecting this verification application. The reason will be recorded in audit logs and sent to the doctor.'}
              {modalType === 'RESUBMISSION' &&
                'Specify what additional documents, certificates, or corrections are needed before approval.'}
              {modalType === 'SUSPEND' &&
                'Suspension blocks all doctor access immediately while preserving existing consultation histories.'}
            </DialogDescription>
          </DialogHeader>

          {modalType !== 'APPROVE' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Mandatory Reason <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Council registration number does not match submitted certificate"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="text-xs rounded-xl h-10"
              />
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalType(null)}
              disabled={loading}
              className="flex-1 text-xs font-bold rounded-xl h-10 border-slate-200"
            >
              Cancel
            </Button>

            {modalType === 'APPROVE' ? (
              <Button
                type="button"
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-10 shadow-xs"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Approval'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleActionWithReason}
                disabled={loading}
                className={`flex-1 font-bold text-xs rounded-xl h-10 text-white shadow-xs ${
                  modalType === 'SUSPEND' || modalType === 'REJECT'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Action'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
