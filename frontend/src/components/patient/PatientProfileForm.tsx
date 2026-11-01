'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { User, Phone, MapPin, Heart, AlertCircle, Loader2, Save, Droplets, ShieldAlert, Pill, FileText } from 'lucide-react';
import { patientProfileSchema, PatientProfileInput } from '@/lib/schemas';
import { Patient } from '@/types';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    setValue,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(patientProfileSchema) as any,
    defaultValues: {
      fullName: initialData?.fullName || '',
      age: initialData?.age ?? ('' as any),
      gender: initialData?.gender || 'MALE',
      phone: initialData?.phone || initialData?.contactDetails?.phone || '',
      address: initialData?.address || initialData?.contactDetails?.address || '',
      bloodGroup: initialData?.bloodGroup || '',
      allergies: initialData?.allergies || '',
      medicalHistory: initialData?.medicalHistory || '',
      currentMedication: initialData?.currentMedication || '',
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
          <Select
            value={watch('gender') || 'MALE'}
            onValueChange={(val) => setValue('gender', val, { shouldValidate: true })}
          >
            <SelectTrigger className={`field-input ${errors.gender ? 'border-rose-400 focus:ring-rose-200' : ''}`}>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
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
          <Textarea
            {...register('address')}
            rows={2}
            placeholder="Residential address or locality"
            className="field-textarea pl-10"
          />
        </div>
      </div>

      {/* ── Clinical & Medical Health Profile ── */}
      <div className="pt-4 border-t border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Droplets className="h-4 w-4 text-[#0066cc]" />
          <span>Medical Profile & Health History</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          This information is shared with your consulting doctor to ensure safe and effective care.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Blood Group */}
          <div>
            <label className="field-label">Blood Group</label>
            <Select
              value={watch('bloodGroup') || ''}
              onValueChange={(val) => setValue('bloodGroup', val, { shouldValidate: true })}
            >
              <SelectTrigger className="field-input">
                <SelectValue placeholder="Select Blood Group (e.g. O+)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A+">A Positive (A+)</SelectItem>
                <SelectItem value="A-">A Negative (A-)</SelectItem>
                <SelectItem value="B+">B Positive (B+)</SelectItem>
                <SelectItem value="B-">B Negative (B-)</SelectItem>
                <SelectItem value="AB+">AB Positive (AB+)</SelectItem>
                <SelectItem value="AB-">AB Negative (AB-)</SelectItem>
                <SelectItem value="O+">O Positive (O+)</SelectItem>
                <SelectItem value="O-">O Negative (O-)</SelectItem>
                <SelectItem value="UNKNOWN">Unknown / Not Tested</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Known Allergies */}
          <div>
            <label className="field-label">Known Allergies</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-500">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <Input
                {...register('allergies')}
                type="text"
                placeholder="e.g. Penicillin, Peanuts, Sulfa (or 'None')"
                className="field-input pl-10"
              />
            </div>
          </div>

          {/* Chronic Conditions & Past Medical History */}
          <div className="md:col-span-2">
            <label className="field-label">Medical History & Chronic Conditions</label>
            <div className="relative">
              <div className="absolute top-3 left-3 text-slate-400 pointer-events-none">
                <FileText className="w-4 h-4" />
              </div>
              <Textarea
                {...register('medicalHistory')}
                rows={2}
                placeholder="e.g. Asthma (diagnosed 2019), Hypertension, Type 2 Diabetes (or 'None')"
                className="field-textarea pl-10"
              />
            </div>
          </div>

          {/* Current Regular Medications */}
          <div className="md:col-span-2">
            <label className="field-label">Current Regular Medications</label>
            <div className="relative">
              <div className="absolute top-3 left-3 text-slate-400 pointer-events-none">
                <Pill className="w-4 h-4" />
              </div>
              <Textarea
                {...register('currentMedication')}
                rows={2}
                placeholder="e.g. Metformin 500mg (twice daily), Inhaler as needed (or 'None')"
                className="field-textarea pl-10"
              />
            </div>
          </div>

          {/* Other Health Notes */}
          <div className="md:col-span-2">
            <label className="field-label">Additional Health Notes</label>
            <div className="relative">
              <div className="absolute top-3 left-3 text-slate-400 pointer-events-none">
                <Heart className="w-4 h-4" />
              </div>
              <Textarea
                {...register('basicHealthInfo')}
                rows={2}
                placeholder="Any dietary restrictions, past surgeries, or relevant health notes"
                className="field-textarea pl-10"
              />
            </div>
          </div>
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
