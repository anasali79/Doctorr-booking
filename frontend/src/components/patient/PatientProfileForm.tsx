'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { User, Phone, MapPin, Heart, AlertCircle, Loader2, Save } from 'lucide-react';
import { patientProfileSchema, PatientProfileInput } from '@/lib/schemas';
import { Patient } from '@/types';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PatientProfileFormProps {
  initialData?: Patient | null;
  isSetup?: boolean;
}

export function PatientProfileForm({
  initialData,
  isSetup = false,
}: PatientProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(patientProfileSchema) as any,
    defaultValues: {
      fullName: initialData?.fullName || '',
      age: initialData?.age ?? ('' as any),
      gender: initialData?.gender || 'MALE',
      phone: initialData?.phone || initialData?.contactDetails?.phone || '',
      address: initialData?.address || initialData?.contactDetails?.address || '',
      basicHealthInfo: initialData?.basicHealthInfo || '',
    },
  });

  const onSubmit = async (data: PatientProfileInput) => {
    try {
      setLoading(true);
      setErrorBanner(null);

      const method = initialData ? 'patch' : 'post';
      await clientAxios[method]('/api/patient/profile-proxy', data);

      toast.success(isSetup ? 'Patient Profile Created!' : 'Profile Saved Successfully');
      router.push('/patient/dashboard');
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
          <label className="field-label">Full Name *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <Input
              {...register('fullName')}
              type="text"
              placeholder="e.g. Rahul Sharma"
              className={`field-input pl-10 ${errors.fullName ? 'border-rose-400 focus:ring-rose-200' : ''}`}
            />
          </div>
          {errors.fullName?.message && (
            <p className="text-xs text-rose-600 mt-1">{String(errors.fullName.message)}</p>
          )}
        </div>

        <div>
          <label className="field-label">Phone Number (10 Digits) *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Phone className="w-4 h-4" />
            </div>
            <Input
              {...register('phone')}
              type="tel"
              placeholder="9876543210"
              maxLength={10}
              className={`field-input pl-10 ${errors.phone ? 'border-rose-400 focus:ring-rose-200' : ''}`}
            />
          </div>
          {errors.phone?.message && (
            <p className="text-xs text-rose-600 mt-1">{String(errors.phone.message)}</p>
          )}
        </div>

        <div>
          <label className="field-label">Age *</label>
          <Input
            {...register('age')}
            type="number"
            min={0}
            max={120}
            placeholder="e.g. 28"
            className={`field-input ${errors.age ? 'border-rose-400 focus:ring-rose-200' : ''}`}
          />
          {errors.age?.message && (
            <p className="text-xs text-rose-600 mt-1">{String(errors.age.message)}</p>
          )}
        </div>

        <div>
          <label className="field-label">Gender *</label>
          <select
            {...register('gender')}
            className={`field-input ${errors.gender ? 'border-rose-400 focus:ring-rose-200' : ''}`}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          {errors.gender?.message && (
            <p className="text-xs text-rose-600 mt-1">{String(errors.gender.message)}</p>
          )}
        </div>
      </div>

      <div>
        <label className="field-label">Residential Address</label>
        <div className="relative">
          <div className="absolute top-3 left-3 text-slate-400 pointer-events-none">
            <MapPin className="w-4 h-4" />
          </div>
          <textarea
            {...register('address')}
            rows={2}
            placeholder="Residential address or locality"
            className="field-textarea pl-10"
          />
        </div>
      </div>

      <div>
        <label className="field-label">Allergies & Medical History (Optional)</label>
        <div className="relative">
          <div className="absolute top-3 left-3 text-slate-400 pointer-events-none">
            <Heart className="w-4 h-4" />
          </div>
          <textarea
            {...register('basicHealthInfo')}
            rows={3}
            placeholder="Blood group (e.g. B+), medication allergies (e.g. Sulfa, Penicillin), existing conditions (e.g. Hypertension)"
            className="field-textarea pl-10"
          />
        </div>
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
              <span>Saving Profile…</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isSetup ? 'Complete Setup & Enter Dashboard' : 'Save Changes'}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
