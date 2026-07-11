import React, { useState, useEffect } from 'react';
import { Globe, Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AcceptInvitationPage() {
  const { brandName, brandLogo } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token') || '';

  useEffect(() => {
    if (!token) {
      setError('Token undangan tidak ditemukan atau tidak valid.');
      setLoading(false);
      return;
    }

    const fetchInviteInfo = async () => {
      try {
        const res = await fetch(`/api/auth/invitation-info?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Token undangan kadaluwarsa atau tidak valid.');
        }
        setEmail(data.email);
        setName(data.name);
        setRole(data.role);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInviteInfo();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengaktifkan akun Anda.');
      }

      // Save token locally
      localStorage.setItem('auth_token', data.session.token);
      setSuccess(true);
      
      // Redirect to main page after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xl overflow-hidden">
          
          {/* Top Logo area */}
          <div className="bg-black py-8 text-center flex flex-col items-center justify-center">
            {brandLogo ? (
              <img src={brandLogo} alt="Logo" className="w-12 h-12 object-contain rounded-2xl mb-3 bg-white p-1" />
            ) : (
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-3">
                <Globe className="w-6 h-6 text-black" />
              </div>
            )}
            <span className="font-extrabold text-white text-xl tracking-tight">{brandName}</span>
            <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase mt-1">Accept Invitation</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <svg className="animate-spin w-8 h-8 text-black" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-xs text-gray-500 font-medium mt-4">Memuat info undangan...</p>
            </div>
          ) : success ? (
            <div className="px-8 py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Akun Berhasil Aktif!</h1>
                <p className="text-sm text-gray-500 mt-1">Mengarahkan Anda ke Dashboard...</p>
              </div>
            </div>
          ) : error && !email ? (
            <div className="px-8 py-12 text-center space-y-5">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto border border-red-100">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Undangan Tidak Valid</h1>
                <p className="text-sm text-red-600 mt-1.5">{error}</p>
              </div>
              <a
                href="/"
                className="inline-block px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-xs font-semibold rounded-xl transition-all"
              >
                Kembali ke Halaman Login
              </a>
            </div>
          ) : (
            <div className="px-8 py-10 text-left">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Aktifkan Akun Anda</h1>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                  Halo <span className="font-semibold text-black">{name}</span>, Anda diundang bergabung sebagai <span className="font-bold text-black uppercase text-xs px-1.5 py-0.5 bg-gray-100 rounded-md">{role}</span>. Buat kata sandi Anda untuk mulai menggunakan aplikasi.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email (Readonly representation) */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Alamat Email</label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-4 py-2.5 border border-gray-100 bg-gray-50/70 text-gray-500 rounded-xl text-sm font-medium font-mono cursor-not-allowed outline-none"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Kata Sandi Baru</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Ulangi Kata Sandi</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi Anda"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 leading-normal">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 mt-4"
                >
                  {submitting ? 'Mengaktifkan...' : 'Aktifkan Akun'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
