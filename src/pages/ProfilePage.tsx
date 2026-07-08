import React, { useState, useEffect } from 'react';
import { User, Mail, Key, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = '/api';

export default function ProfilePage() {
  const { session, user, updateUser } = useAuth();

  // Profile Form States
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync profile values if user context loads late
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setProfileError('Email is required.');
      return;
    }
    setProfileError(null);
    setProfileSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      // Update auth context state dynamically
      updateUser({ name: data.name, email: data.email });
      setProfileSuccess('Profil Anda berhasil diperbarui.');
      setPassword('');
    } catch (err: any) {
      setProfileError(err.message || 'Gagal memperbarui profil.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <User className="w-5 h-5 text-gray-800" />
          Profil Saya
        </h1>
        <p className="text-sm text-gray-500 font-normal">Perbarui informasi pribadi dan kredensial akun Anda di sini.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0">
            <User className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Ubah Profil</h2>
            <p className="text-[11px] text-gray-500">Form untuk memperbarui nama, email, dan kata sandi akun Anda.</p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="p-6 md:p-8 space-y-6">
          {profileSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold flex items-start gap-2.5 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{profileSuccess}</span>
            </div>
          )}
          {profileError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 text-xs font-semibold flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Email Akun</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@anda.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow text-gray-800 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow text-gray-800"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center justify-between">
                <span>Ganti Password</span>
                <span className="text-[10px] text-gray-400 font-normal normal-case">(Kosongkan jika tidak ingin merubah)</span>
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password baru (minimal 6 karakter)"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow text-gray-800 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-black hover:bg-gray-800 disabled:opacity-50 text-xs font-bold rounded-xl text-white transition-colors"
            >
              {submitting ? 'Menyimpan...' : 'Perbarui Profil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
