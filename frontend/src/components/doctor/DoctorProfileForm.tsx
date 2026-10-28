'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  User,
  Award,
  Calendar,
  FileText,
  Loader2,
  Save,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import { doctorProfileSchema, DoctorProfileInput } from '@/lib/schemas';
import { SPECIALIZATIONS, SPECIALIZATION_LABELS } from '@/lib/constants';
import { Doctor } from '@/types';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DoctorProfileFormProps {
  initialData?: Doctor | null;
  isSetup?: boolean;
}

export function DoctorProfileForm({
  initialData,
  isSetup = false,
}: DoctorProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(doctorProfileSchema) as any,
    defaultValues: {
      fullName: initialData?.fullName || '',
      specialization: initialData?.specialization || 'general physician',
      experience: initialData?.experience ?? ('' as any),
      qualification: initialData?.qualification || '',
      consultationFee: initialData?.consultationFee ?? ('' as any),
      profileDetails: initialData?.profileDetails || '',
      allowFutureBooking: initialData?.allowFutureBooking ?? true,
      maxFutureBookingDays: initialData?.maxFutureBookingDays ?? 7,
    },
  });

  const onSubmit = async (data: DoctorProfileInput) => {
    try {
      setLoading(true);
      setErrorBanner(null);

      const method = initialData ? 'patch' : 'post';
      await clientAxios[method]('/api/doctor/profile-proxy', data);

      toast.success(isSetup ? 'Doctor Profile Registered!' : 'Profile Saved Successfully');
      router.push('/doctor/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setErrorBanner(msg);
      toast.error('Submission Failed', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {errorBanner && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorBanner}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="field-label">Full Professional Name *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <Input
              {...register('fullName')}
              type="text"
              placeholder="e.g. Dr. Priya Sharma, MD"
              className={`field-input pl-10 ${errors.fullName ? 'border-rose-400 focus:ring-rose-200' : ''}`}
            />
          </div>
          {errors.fullName?.message && (
            <p className="text-xs text-rose-600 mt-1">{String(errors.fullName.message)}</p>
          )}
        </div>

        <div>
          <label className="field-label">Specialization Department *</label>
          <select
            {...register('specialization')}
            className={`field-input capitalize ${errors.specialization ? 'border-rose-400 focus:ring-rose-200' : ''}`}
          >
            {SPECIALIZATIONS.map((spec) => (
              <option key={spec} value={spec}>
                {SPECIALIZATION_LABELS[spec]}
              </option>
            ))}
          </select>
          {errors.specialization?.message && (
            <p className="text-xs text-rose-600 mt-1">{String(errors.specialization.message)}</p>
          )}
        </div>

        <div>
          <label className="field-label">Clinical Experience (Years) *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Briefcase className="w-4 h-4" />
            </div>
            <Input
              {...register('experience')}
              type="number"
              min={0}
              placeholder="e.g. 10"
              className={`field-input pl-10 ${errors.experience ? 'border-rose-400 focus:ring-rose-200' : ''}`}
            />
          </div>
          {errors.experience?.message && (
            <p className="text-xs text-rose-600 mt-1">{String(errors.experience.message)}</p>
          )}
        </div>

        <div>
          <label className="field-label">Qualifications & Degrees *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Award className="w-4 h-4" />
            </div>
            <Input
              {...register('qualification')}
              type="text"
              placeholder="e.g. MBBS, MD (Cardiology)"
              className={`field-input pl-10 ${errors.qualification ? 'border-rose-400 focus:ring-rose-200' : ''}`}
            />
          </div>
          {errors.qualification?.message && (
            <p className="text-xs text-rose-600 mt-1">{String(errors.qualification.message)}</p>
          )}
        </div>

        <div>
          <label className="field-label">Consultation Fee (₹ INR) *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
              ₹
            </div>
            <Input
              {...register('consultationFee')}
              type="number"
              min={0}
              placeholder="e.g. 500"
              className={`field-input pl-10 ${errors.consultationFee ? 'border-rose-400 focus:ring-rose-200' : ''}`}
            />
          </div>
          {errors.consultationFee?.message && (
            <p className="text-xs text-rose-600 mt-1">{String(errors.consultationFee.message)}</p>
          )}
        </div>

        <div>
          <label className="field-label">Booking Advance Window (Days)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Calendar className="w-4 h-4" />
            </div>
            <Input
              {...register('maxFutureBookingDays')}
              type="number"
              min={1}
              max={90}
              placeholder="7"
              className="field-textarea pl-10"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Default 7 days. How many days in advance patients can book slots.
          </p>
        </div>
      </div>

      <div>
        <label className="field-label">Professional Bio & Clinic Details</label>
        <div className="relative">
          <div className="absolute top-3 left-3 text-slate-400 pointer-events-none">
            <FileText className="w-4 h-4" />
          </div>
          <textarea
            {...register('profileDetails')}
            rows={4}
            placeholder="Describe your background, areas of clinical focus, clinic location, and patient care hours..."
            className="field-textarea pl-10"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
        <input
          {...register('allowFutureBooking')}
          type="checkbox"
          id="allowFutureBooking"
          className="w-4 h-4 rounded text-blue-700 focus:ring-blue-500"
        />
        <label
          htmlFor="allowFutureBooking"
          className="text-xs font-semibold text-slate-700 cursor-pointer"
        >
          Allow Advance Appointments (uncheck if only accepting same-day clinic walk-ins)
        </label>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <Button
          type="submit"
          variant="ghost"
          disabled={loading}
          className="btn-primary h-auto"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Configuration…</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isSetup ? 'Complete Doctor Setup & Launch Dashboard' : 'Save Changes'}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
