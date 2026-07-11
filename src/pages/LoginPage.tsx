import { useState, useRef, useEffect } from 'react';
import { Globe, Eye, EyeOff, Mail, Lock, AlertCircle, ShieldCheck, RefreshCw, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    turnstile: any;
  }
}

type Step = 'form' | 'otp-login' | 'otp-verify' | 'reset-password-form';

export default function LoginPage() {
  const { signIn, signUp, verifyLogin, verifyEmail, resendOTP, brandName, brandLogo } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [step, setStep] = useState<Step>('form');
  const [pendingUserId, setPendingUserId] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'verify' | 'login' | 'reset-password'>('login');

  // Form fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP input — 6 boxes
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // System Auth Configuration (Registration & Turnstile)
  const [config, setConfig] = useState({
    registrationEnabled: true,
    turnstileEnabled: false,
    turnstileSiteKey: ''
  });

  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileWidgetId = useRef<string | null>(null);

  // 1. Fetch public auth config
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/auth/config');
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
          // If registration is disabled and we were on register, fallback to login
          if (!data.registrationEnabled) {
            setMode('login');
          }
        }
      } catch (err) {
        console.error('Failed to load auth config:', err);
      }
    }
    fetchConfig();
  }, []);

  // 2. Load Turnstile widget dynamically
  useEffect(() => {
    if (!config.turnstileEnabled || !config.turnstileSiteKey || step !== 'form') return;

    // Inject Turnstile script
    const scriptId = 'cloudflare-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const renderWidget = () => {
      if (window.turnstile && document.getElementById('turnstile-widget') && !turnstileWidgetId.current) {
        try {
          turnstileWidgetId.current = window.turnstile.render('#turnstile-widget', {
            sitekey: config.turnstileSiteKey,
            callback: (token: string) => {
              setTurnstileToken(token);
            },
            'expired-callback': () => {
              setTurnstileToken('');
            },
            'error-callback': () => {
              setTurnstileToken('');
            }
          });
        } catch (err) {
          console.error('Turnstile render error:', err);
        }
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      script.onload = renderWidget;
    }

    return () => {
      if (window.turnstile && turnstileWidgetId.current) {
        try {
          window.turnstile.remove(turnstileWidgetId.current);
          turnstileWidgetId.current = null;
        } catch (e) {
          console.error('Error removing Turnstile widget:', e);
        }
      }
    };
  }, [config.turnstileEnabled, config.turnstileSiteKey, mode, step]);

  // Resend countdown
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === 'login') {
      const result = await signIn(email, password, turnstileToken);
      if (result.step) {
        setPendingUserId(result.userId || '');
        setOtpPurpose(result.step === 'otp-verify' ? 'verify' : 'login');
        setStep(result.step === 'otp-verify' ? 'otp-verify' : 'otp-login');
        setInfo(result.debugOtp ? `${result.message || 'Kode OTP siap'} · Kode: ${result.debugOtp}` : result.message || null);
        setOtp(['', '', '', '', '', '']);
      } else if (result.error) {
        setError(result.error);
        if (window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current);
          setTurnstileToken('');
        }
      }
    } else if (mode === 'register') {
      const result = await signUp(email, password, name, turnstileToken);
      if (result.error) {
        setError(result.error);
        if (window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current);
          setTurnstileToken('');
        }
      } else if (result.step) {
        setPendingUserId(result.userId || '');
        setOtpPurpose('verify');
        setStep('otp-verify');
        setInfo(result.debugOtp ? `${result.message || 'Kode OTP siap'} · Kode: ${result.debugOtp}` : result.message || null);
        setOtp(['', '', '', '', '', '']);
      }
    } else if (mode === 'forgot') {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, turnstileToken })
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Gagal memproses permintaan');
          if (window.turnstile && turnstileWidgetId.current) {
            window.turnstile.reset(turnstileWidgetId.current);
            setTurnstileToken('');
          }
        } else {
          setPendingUserId(data.userId || '');
          setOtpPurpose('reset-password');
          setStep('reset-password-form');
          setInfo(data.debugOtp ? `${data.message} · Kode: ${data.debugOtp}` : data.message);
          setOtp(['', '', '', '', '', '']);
          setPassword(''); // clear password field for new password entry
        }
      } catch (err: any) {
        setError(err.message || 'Koneksi ke server gagal');
      }
    }
    setLoading(false);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const otpCode = otp.join('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId, otp: otpCode, newPassword: password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal mereset kata sandi');
      } else {
        setInfo(data.message || 'Kata sandi berhasil diperbarui.');
        setMode('login');
        setStep('form');
        setEmail('');
        setPassword('');
        setOtp(['', '', '', '', '', '']);
      }
    } catch (err: any) {
      setError(err.message || 'Koneksi ke server gagal');
    }
    setLoading(false);
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const otpCode = otp.join('');
    if (otpPurpose === 'verify') {
      const result = await verifyEmail(pendingUserId, otpCode);
      if (result.error) {
        setError(result.error);
      }
    } else {
      const result = await verifyLogin(pendingUserId, otpCode);
      if (result.error) {
        setError(result.error);
      }
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    const result = await resendOTP(pendingUserId, otpPurpose);
    if (result.error) {
      setError(result.error);
    } else {
      setInfo(result.message || 'Kode OTP baru berhasil dikirim.');
      setCountdown(60);
    }
    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (/[^0-9]/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(data)) return;

    const chars = data.split('');
    setOtp(chars);
    otpRefs.current[5]?.focus();
  };

  const switchMode = () => {
    setError(null);
    setInfo(null);
    setMode(m => m === 'login' ? 'register' : 'login');
  };

  const goBack = () => {
    setError(null);
    setInfo(null);
    setStep('form');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
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
            <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase mt-1">WHOIS & Server Monitor</span>
          </div>

          {/* Banner notification */}
          {info && (
            <div className="bg-emerald-50 border-y border-emerald-100 px-6 py-3 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800 font-semibold">{info}</p>
            </div>
          )}

          {/* ── STEP: OTP Input Form ──────────────────────── */}
          {step !== 'form' && step !== 'reset-password-form' && (
            <div className="px-8 py-10">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Verifikasi OTP</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Masukkan 6 digit kode yang dikirim ke alamat email Anda.
                </p>
              </div>

              <form onSubmit={handleOtpVerify} className="space-y-6">
                <div className="flex justify-between gap-2.5">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={1}
                      ref={el => (otpRefs.current[idx] = el)}
                      value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                      className="w-12 h-12 border border-gray-200 rounded-xl text-center font-mono font-bold text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.join('').length < 6}
                  className="w-full py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Memverifikasi...' : 'Verifikasi Kode OTP'}
                </button>
              </form>

              <div className="flex items-center justify-between mt-5">
                <button onClick={goBack} className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors">
                  ← Kembali
                </button>
                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || loading}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-black disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  {countdown > 0 ? `Kirim ulang (${countdown}s)` : 'Kirim ulang OTP'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: Reset Password Form ──────────────────────── */}
          {step === 'reset-password-form' && (
            <div className="px-8 py-10 text-left">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Reset Kata Sandi</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Masukkan 6 digit kode OTP dan kata sandi baru Anda.
                </p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                {/* OTP input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode OTP</label>
                  <div className="flex justify-between gap-2.5 mb-4">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        type="text"
                        maxLength={1}
                        ref={el => (otpRefs.current[idx] = el)}
                        value={digit}
                        onChange={e => handleOtpChange(idx, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                        onPaste={idx === 0 ? handleOtpPaste : undefined}
                        className="w-12 h-12 border border-gray-200 rounded-xl text-center font-mono font-bold text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                      />
                    ))}
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kata Sandi Baru</label>
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

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.join('').length < 6 || password.length < 6}
                  className="w-full py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 mt-2"
                >
                  {loading ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
                </button>
              </form>

              <div className="flex items-center justify-between mt-5">
                <button
                  onClick={() => {
                    setError(null);
                    setInfo(null);
                    setStep('form');
                    setMode('forgot');
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  ← Kembali
                </button>
                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || loading}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-black disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  {countdown > 0 ? `Kirim ulang (${countdown}s)` : 'Kirim ulang OTP'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: Login / Register Form ──────────────────────── */}
          {step === 'form' && (
            <div className="px-8 py-10 text-left">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">
                  {mode === 'login' ? 'Selamat datang kembali' : mode === 'register' ? 'Buat akun baru' : 'Lupa Kata Sandi'}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {mode === 'login'
                    ? 'Masuk ke akun Anda. Kode OTP akan dikirim ke email.'
                    : mode === 'register'
                      ? 'Daftar dan verifikasi email Anda untuk mulai.'
                      : 'Masukkan alamat email Anda untuk menerima kode OTP reset password.'}
                </p>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Name (register only) */}
                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Nama Anda"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="anda@email.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    />
                  </div>
                </div>

                {/* Password */}
                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setInfo(null);
                            setMode('forgot');
                          }}
                          className="text-xs text-gray-500 hover:text-black font-semibold transition-colors"
                        >
                          Lupa kata sandi?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
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
                )}

                {/* Cloudflare Turnstile widget container */}
                {config.turnstileEnabled && config.turnstileSiteKey && (
                  <div className="flex justify-center my-3 min-h-[65px]">
                    <div id="turnstile-widget" />
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (config.turnstileEnabled && !turnstileToken)}
                  className="w-full py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      {mode === 'login' ? 'Memeriksa...' : mode === 'register' ? 'Mendaftar...' : 'Mengirim...'}
                    </span>
                  ) : mode === 'login' ? 'Masuk → Kirim OTP' : mode === 'register' ? 'Daftar → Kirim OTP' : 'Kirim OTP'}
                </button>
              </form>

              {/* Footer links */}
              {mode === 'forgot' ? (
                <p className="text-center text-sm text-gray-500 mt-6">
                  <button
                    onClick={() => {
                      setError(null);
                      setInfo(null);
                      setMode('login');
                    }}
                    className="font-semibold text-black hover:underline transition-colors"
                  >
                    Kembali ke Login
                  </button>
                </p>
              ) : (
                config.registrationEnabled && (
                  <p className="text-center text-sm text-gray-500 mt-6">
                    {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
                    <button onClick={switchMode} className="font-semibold text-black hover:underline transition-colors">
                      {mode === 'login' ? 'Daftar sekarang' : 'Masuk'}
                    </button>
                  </p>
                )
              )}
            </div>
          )}
        </div>

        {/* OTP info badge */}
        {step === 'form' && (
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
            {mode === 'forgot' ? 'Reset password diamankan dengan kode verifikasi OTP' : 'Login dilindungi dengan verifikasi OTP via email'}
          </div>
        )}
      </main>
    </div>
  );
}
