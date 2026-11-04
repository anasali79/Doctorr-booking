'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShieldCheck, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      return toast.error('Please enter both email and password');
    }

    try {
      setLoading(true);
      const res = await clientAxios.post<{
        success: boolean;
        message: string;
        token?: string;
        user: { id: string; email: string; role: string };
      }>('/api/admin/auth/login', {
        email: email.trim(),
        password,
      });

      if (res.data.token) {
        document.cookie = `admin_token=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `token=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `jwt=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
      }

      toast.success('Admin authenticated successfully');
      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      toast.error('Authentication failed', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafc] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066cc] to-[#00408a] text-white shadow-md ring-1 ring-white/20 mx-auto">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Care<span className="text-[#0066cc]">Up</span> Admin Portal
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Restricted access • Authorized personnel only
          </p>
        </div>

        {/* Login Card */}
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-8 shadow-sm space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Admin Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <Input
                  type="email"
                  required
                  placeholder="admin@careup.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Security Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 rounded-xl text-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold h-11 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Need assistance or lost credentials? Contact the system administrator.
            </p>
          </div>
        </Card>

        {/* Back to Public Home */}
        <div className="text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            &larr; Back to CareUp Home
          </Link>
        </div>
      </div>
    </div>
  );
}
