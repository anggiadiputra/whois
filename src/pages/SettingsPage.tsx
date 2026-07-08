import React, { useState, useEffect } from 'react';
import { 
  Settings, Key, MessageSquare, Mail, Bell, RefreshCw, Check, AlertCircle, Play, Info, Shield, UserPlus, Globe, UploadCloud, Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = '/api';

export default function SettingsPage() {
  const { session, refreshBrandConfig } = useAuth();
  const [settings, setSettings] = useState({
    fonnte_token: '',
    brevo_api_key: '',
    brevo_sender_email: '',
    brevo_sender_name: 'DomainWhois Alerts',
    recipient_email: '',
    recipient_whatsapp: '',
    alert_days_before: '30,7,3,1',
    turnstile_enabled: 'false',
    turnstile_site_key: '',
    turnstile_secret_key: '',
    registration_enabled: 'true',
    brand_name: 'DomainWhois',
    brand_logo: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch current settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/settings`, {
          headers: {
            'Authorization': `Bearer ${session?.token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [session?.token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 1MB
    if (file.size > 1024 * 1024) {
      setMessage({ type: 'error', text: 'Ukuran logo tidak boleh melebihi 1MB' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings(prev => ({ ...prev, brand_logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setSettings(prev => ({ ...prev, brand_logo: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Pengaturan berhasil disimpan!' });
        if (refreshBrandConfig) {
          await refreshBrandConfig();
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Gagal menyimpan pengaturan.' });
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: 'Koneksi ke server gagal.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setMessage(null);
    setTesting(true);
    try {
      const res = await fetch(`${API_URL}/settings/test-alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `${data.message} (${data.alertsCount} alert diproses)` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Gagal mengirim uji coba.' });
      }
    } catch (err) {
      console.error('Failed to run test alert:', err);
      setMessage({ type: 'error', text: 'Gagal mengirim uji coba notifikasi.' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-[#f0f2f5] p-6 md:p-10 flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-black animate-spin" />
          <p className="text-sm font-semibold text-gray-500">Memuat pengaturan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#f0f2f5] p-5 md:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Settings className="w-5 h-5 text-black" />
              Pengaturan Sistem
            </h1>
            <p className="text-xs text-gray-500 mt-1 font-normal">
              Atur identitas brand, keamanan akses pendaftaran, Turnstile, dan gateway notifikasi WhatsApp/Email.
            </p>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 animate-fade-in ${
            message.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-red-50 border-red-100 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <Check className="w-4.5 h-4.5 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600" />
            )}
            <div className="text-xs font-semibold">{message.text}</div>
            <button onClick={() => setMessage(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* ─── COLUMN 1: BRAND IDENTITY & SECURITY ─── */}
            <div className="space-y-6">
              
              {/* Section: Brand Identity */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shrink-0">
                    <Globe className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Identitas Brand</h2>
                    <p className="text-[11px] text-gray-500 font-normal mt-0.5">Sesuaikan nama brand dan logo aplikasi untuk melabeli proyek ini.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Nama Brand</label>
                    <input
                      type="text"
                      name="brand_name"
                      value={settings.brand_name}
                      onChange={handleChange}
                      placeholder="Masukkan nama brand aplikasi"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Logo Brand</label>
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-dashed border-gray-200 rounded-2xl">
                      {/* Logo Preview Container */}
                      <div className="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {settings.brand_logo ? (
                          <img src={settings.brand_logo} alt="Brand logo preview" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Globe className="w-7 h-7 text-gray-400" />
                        )}
                      </div>

                      {/* File Inputs & Actions */}
                      <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-gray-800 rounded-xl text-white text-[11px] font-bold transition-colors">
                            <UploadCloud className="w-3.5 h-3.5" />
                            Pilih Logo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoChange}
                              className="hidden"
                            />
                          </label>

                          {settings.brand_logo && (
                            <button
                              type="button"
                              onClick={handleClearLogo}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-[11px] font-bold transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Reset Default
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 font-normal">Format yang didukung: PNG, JPG, WEBP. Maksimal ukuran 1MB.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: User Registration Toggle */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shrink-0">
                    <UserPlus className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Registrasi Pengguna Baru</h2>
                    <p className="text-[11px] text-gray-500 font-normal mt-0.5">Kontrol akses pendaftaran akun baru pada halaman login.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Akses Pendaftaran</label>
                  <select
                    name="registration_enabled"
                    value={settings.registration_enabled}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow bg-white"
                  >
                    <option value="true">Buka (Pengguna baru bisa mendaftar)</option>
                    <option value="false">Tutup (Hanya Admin yang bisa membuatkan akun)</option>
                  </select>
                </div>
              </div>

              {/* Section: Cloudflare Turnstile CAPTCHA */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shrink-0">
                    <Shield className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Proteksi CAPTCHA (Cloudflare Turnstile)</h2>
                    <p className="text-[11px] text-gray-500 font-normal mt-0.5">Amankan login dan pendaftaran dari serangan bot otomatis.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Status Turnstile</label>
                    <select
                      name="turnstile_enabled"
                      value={settings.turnstile_enabled}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow bg-white"
                    >
                      <option value="false">Nonaktifkan CAPTCHA</option>
                      <option value="true">Aktifkan CAPTCHA</option>
                    </select>
                  </div>

                  {settings.turnstile_enabled === 'true' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Turnstile Site Key</label>
                        <input
                          type="text"
                          name="turnstile_site_key"
                          value={settings.turnstile_site_key}
                          onChange={handleChange}
                          placeholder="Site Key dari Cloudflare"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Turnstile Secret Key</label>
                        <input
                          type="password"
                          name="turnstile_secret_key"
                          value={settings.turnstile_secret_key}
                          onChange={handleChange}
                          placeholder="Secret Key dari Cloudflare"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ─── COLUMN 2: GATEWAYS & NOTIFICATIONS ─── */}
            <div className="space-y-6">
              
              {/* Section: WhatsApp Gateway */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Integrasi WhatsApp (Fonnte)</h2>
                    <p className="text-[11px] text-gray-500 font-normal mt-0.5">Kirim pesan WhatsApp notifikasi otomatis kedaluwarsa domain.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1.5">
                    Fonnte API Token
                    <span className="text-[9px] font-normal text-gray-400 normal-case">(Device Key Fonnte)</span>
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="password"
                      name="fonnte_token"
                      value={settings.fonnte_token}
                      onChange={handleChange}
                      placeholder="Masukkan Token Fonnte Anda"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Email Gateway */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Integrasi Email (Brevo / Sendinblue)</h2>
                    <p className="text-[11px] text-gray-500 font-normal mt-0.5">Kirim email aman melalui SMTP relay atau HTTP API Brevo.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Brevo API Key (v3)</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="password"
                        name="brevo_api_key"
                        value={settings.brevo_api_key}
                        onChange={handleChange}
                        placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxx"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Email Pengirim</label>
                    <input
                      type="email"
                      name="brevo_sender_email"
                      value={settings.brevo_sender_email}
                      onChange={handleChange}
                      placeholder="sender@domainanda.com"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Nama Pengirim</label>
                    <input
                      type="text"
                      name="brevo_sender_name"
                      value={settings.brevo_sender_name}
                      onChange={handleChange}
                      placeholder="Nama Pengirim Notifikasi"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Recipients & Alerts */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shrink-0">
                    <Bell className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Penerima & Jadwal Notifikasi</h2>
                    <p className="text-[11px] text-gray-500 font-normal mt-0.5">Kontak utama yang akan menerima laporan kedaluwarsa domain.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Email Penerima</label>
                    <input
                      type="email"
                      name="recipient_email"
                      value={settings.recipient_email}
                      onChange={handleChange}
                      placeholder="penerima@email.com"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
                      WhatsApp Penerima
                      <span className="text-[9px] font-normal text-gray-400 normal-case">(Format: 628xx)</span>
                    </label>
                    <input
                      type="text"
                      name="recipient_whatsapp"
                      value={settings.recipient_whatsapp}
                      onChange={handleChange}
                      placeholder="628123456789"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1.5">
                      Interval Pengingat (Hari sebelum Expired)
                      <span className="text-[9px] font-normal text-gray-400 normal-case">(Pisahkan dengan koma)</span>
                    </label>
                    <input
                      type="text"
                      name="alert_days_before"
                      value={settings.alert_days_before}
                      onChange={handleChange}
                      placeholder="30,7,3,1"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black transition-shadow font-mono"
                    />
                    <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1 font-normal">
                      <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      Pengingat dikirim otomatis pada jam 08:00 WIB sesuai jadwal interval.
                    </p>
                  </div>

                  {/* Test notification trigger */}
                  <div className="sm:col-span-2 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-[11px] text-gray-400 font-normal">
                      Kirim pesan pengujian cepat ke email & nomor WhatsApp penerima di atas.
                    </span>
                    <button
                      type="button"
                      onClick={handleTestNotification}
                      disabled={testing || saving}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {testing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-500" />
                          Menguji...
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-gray-600" />
                          Uji Notifikasi
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Form Actions Footer */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving || testing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Semua Pengaturan'
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
