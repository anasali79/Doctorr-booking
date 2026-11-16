'use client';

import React, { useState } from 'react';
import { SessionUser, Doctor, Receptionist } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Headphones,
  UserPlus,
  Copy,
  Trash2,
  Power,
  ShieldCheck,
  Phone,
  Mail,
  Building,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { clientAxios } from '@/lib/api/axios';
import { cn } from '@/lib/utils';

interface DoctorReceptionistClientProps {
  user: SessionUser;
  doctor: Doctor | null;
  initialReceptionists: Receptionist[];
}

export function DoctorReceptionistClient({
  user,
  doctor,
  initialReceptionists,
}: DoctorReceptionistClientProps) {
  const [receptionists, setReceptionists] = useState<Receptionist[]>(initialReceptionists || []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync state if server props change
  React.useEffect(() => {
    if (Array.isArray(initialReceptionists)) {
      setReceptionists(initialReceptionists);
    }
  }, [initialReceptionists]);

  const fetchStaff = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await clientAxios.get('/api/doctor/receptionists');
      const list = res.data?.data || [];
      setReceptionists(Array.isArray(list) ? list : []);
      if (!silent) toast.success('Staff list refreshed');
    } catch {
      if (!silent) toast.error('Failed to refresh receptionist list');
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [deskNumber, setDeskNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generate random password helper
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let generated = '';
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setShowPassword(true);
    toast.info('Secure temporary password generated');
  };

  const handleOpenModal = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setDeskNumber('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error('Please fill in name, email and password');
      return;
    }

    setSubmitting(true);
    try {
      const res = await clientAxios.post('/api/doctor/receptionists', {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        phone: phone.trim() || undefined,
        deskNumber: deskNumber.trim() || undefined,
      });

      const newStaff = res.data?.data;
      if (newStaff) {
        setReceptionists((prev) => [newStaff, ...prev]);
        toast.success(`Receptionist "${fullName}" onboarded successfully!`);
        setIsModalOpen(false);
      }
      fetchStaff(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to onboard receptionist');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    try {
      const res = await clientAxios.patch(`/api/doctor/receptionists/${id}/toggle`);
      const updated = res.data?.data;
      setReceptionists((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: updated.isActive } : r)),
      );
      toast.success(res.data?.message || 'Status updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to toggle status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove receptionist "${name}"? They will lose access to the portal.`)) {
      return;
    }

    setDeletingId(id);
    try {
      await clientAxios.delete(`/api/doctor/receptionists/${id}`);
      setReceptionists((prev) => prev.filter((r) => r.id !== id));
      toast.success(`Receptionist "${name}" removed`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to remove receptionist');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyCredentials = (r: Receptionist) => {
    const text = `*CareUp Receptionist Login Details*\nPortal URL: ${window.location.origin}/login\nEmail: ${r.email}\nAssigned Doctor: Dr. ${doctor?.fullName || user.email}`;
    navigator.clipboard.writeText(text);
    setCopiedId(r.id);
    toast.success('Login details copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Front-Desk & Receptionists
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            Assign dedicated receptionists to manage patient check-ins, waiting queues, and appointments for your practice.
          </p>
        </div>

        <Button
          onClick={handleOpenModal}
          className="rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white shadow-xs font-semibold text-xs sm:text-sm gap-2 h-10 px-4 cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Onboard Receptionist</span>
        </Button>
      </div>

        {/* Quick KPI Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Staff</p>
              <p className="text-2xl font-extrabold text-slate-900">{receptionists.length}</p>
            </div>
          </Card>

          <Card className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active On Duty</p>
              <p className="text-2xl font-extrabold text-emerald-600">
                {receptionists.filter((r) => r.isActive).length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </Card>

          <Card className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Queue Delegation</p>
              <p className="text-xs font-semibold text-slate-700 mt-1">
                {receptionists.some((r) => r.isActive) ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Active & Delegated
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    Doctor Self-Handled
                  </span>
                )}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#0066cc]">
              <Sparkles className="h-5 w-5" />
            </div>
          </Card>
        </div>

        {/* Receptionists List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Assigned Receptionist Accounts</h2>
            <span className="text-xs text-slate-500">Each account accesses your live queue portal</span>
          </div>

          {receptionists.length === 0 ? (
            <Card className="p-12 text-center bg-white border border-dashed border-slate-300 rounded-2xl space-y-4">
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-slate-900">No Receptionists Assigned Yet</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Onboard a receptionist so they can manage in-clinic patient check-ins, advance the queue, and handle cancellations without interrupting your consultations.
                </p>
              </div>
              <Button
                onClick={handleOpenModal}
                className="rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white shadow-xs font-semibold text-xs gap-2 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Onboard Your First Receptionist</span>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receptionists.map((r) => {
                const isToggling = togglingId === r.id;
                const isDeleting = deletingId === r.id;
                const isCopied = copiedId === r.id;

                return (
                  <Card
                    key={r.id}
                    className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-sky-100 to-blue-50 border border-sky-200 flex items-center justify-center text-[#0066cc] font-black text-lg shadow-2xs">
                          {r.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{r.fullName}</h3>
                            {r.deskNumber && (
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                {r.deskNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span>{r.email}</span>
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                          r.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full mr-1',
                            r.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400',
                          )}
                        />
                        {r.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{r.phone || 'No phone set'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end text-slate-400">
                        <span>Role: Front Desk</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyCredentials(r)}
                        className="text-xs font-semibold text-slate-700 rounded-xl h-8 gap-1.5 hover:bg-slate-50 border-slate-200"
                        title="Copy login credentials"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate-500" />
                            <span>Copy Login Info</span>
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isToggling}
                          onClick={() => handleToggle(r.id)}
                          className={cn(
                            'h-8 px-2.5 rounded-xl text-xs font-semibold gap-1 transition-colors',
                            r.isActive
                              ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700'
                              : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700',
                          )}
                          title={r.isActive ? 'Deactivate account' : 'Activate account'}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          <span>{r.isActive ? 'Deactivate' : 'Activate'}</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isDeleting}
                          onClick={() => handleDelete(r.id, r.fullName)}
                          className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove receptionist"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Onboard Receptionist Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-xl">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-[#0066cc]">
                  <UserPlus className="h-5 w-5" />
                </span>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Onboard Front-Desk Receptionist
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-600">
                Create a front-desk account for your clinic assistant. They will be able to log in and manage your patient queue in real-time.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                <Input
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Login Email *</label>
                <Input
                  required
                  type="email"
                  placeholder="e.g. sarah.desk@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Password *</label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] font-semibold text-[#0066cc] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Key className="h-3 w-3" />
                    <span>Generate Secure</span>
                  </button>
                </div>
                <div className="relative">
                  <Input
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl border-slate-200 text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Phone (Optional)</label>
                  <Input
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-xl border-slate-200 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Desk / Counter (Optional)</label>
                  <Input
                    placeholder="e.g. Desk 1 / Room 102"
                    value={deskNumber}
                    onChange={(e) => setDeskNumber(e.target.value)}
                    className="rounded-xl border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100/80 text-[11px] text-[#004494] space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Immediate Portal Access</span>
                </p>
                <p className="text-slate-600">
                  Once saved, the receptionist can immediately sign in at <strong className="text-slate-900">/login</strong> using these credentials and start managing your queue.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="h-10 px-4 rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-5 rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold shadow-md shadow-blue-500/20 gap-2 cursor-pointer transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Create Receptionist</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
  );
}
