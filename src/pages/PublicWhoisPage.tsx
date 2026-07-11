import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Globe, Search, ShieldAlert, CheckCircle2, Clock, Terminal } from 'lucide-react';

interface WhoisResult {
  domain: string;
  registrar?: string;
  registrarId?: string;
  registrantName?: string;
  registrantEmail?: string;
  registrantPhone?: string;
  registrantAddress?: string;
  expiryDate?: string;
  createdDate?: string;
  updatedDate?: string;
  nameServers?: string[];
  status?: string[];
  raw?: string;
  handle?: string;
  whoisServer?: string;
}

export default function PublicWhoisPage() {
  const { brandName, brandLogo } = useAuth();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<WhoisResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [expandedRaw, setExpandedRaw] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setLookupError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/public-whois-lookup?domain=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data WHOIS.');
      setResult(data);
    } catch (err: any) {
      setLookupError(err.message || 'Gagal memeriksa domain.');
    } finally {
      setSearching(false);
    }
  };

  // Expiry calculation helper
  const getExpiryLabel = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateStr);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `Expired (${Math.abs(diffDays)} hari yang lalu)`,
        class: 'bg-red-50 text-red-700 border-red-150',
        icon: <ShieldAlert className="w-3.5 h-3.5" />
      };
    } else if (diffDays <= 30) {
      return {
        text: `Mendekati Expired (${diffDays} hari lagi)`,
        class: 'bg-amber-50 text-amber-700 border-amber-150',
        icon: <Clock className="w-3.5 h-3.5" />
      };
    } else {
      return {
        text: `Aktif (${diffDays} hari tersisa)`,
        class: 'bg-emerald-50 text-emerald-700 border-emerald-150',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />
      };
    }
  };

  const expiryBadge = result ? getExpiryLabel(result.expiryDate) : null;

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col items-center">
      {/* Top Navbar */}
      <header className="w-full bg-white border-b border-gray-200 h-16 px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          {brandLogo ? (
            <img src={brandLogo} alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
          ) : (
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Globe className="w-4.5 h-4.5 text-white" />
            </div>
          )}
          <span className="font-bold text-gray-900 text-lg tracking-tight">{brandName}</span>
        </div>
        <div>
          <a
            href="/"
            className="px-4.5 py-2 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            Login
          </a>
        </div>
      </header>

      {/* Main Search Area */}
      <main className="w-full max-w-2xl px-4 py-8 md:py-12 space-y-6 flex-1">
        <div className="text-center max-w-lg mx-auto space-y-2">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">WHOIS Domain Lookup</h1>
          <p className="text-sm text-gray-500 font-normal">
            Periksa detail pendaftaran, tanggal kedaluwarsa, registrar, dan name server untuk domain apa pun secara instan.
          </p>
        </div>

        {/* Search Bar Form */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
              <input
                type="text"
                required
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Masukkan domain (misal: google.com)"
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Mencari...
                </>
              ) : (
                <>
                  <Search className="w-4.5 h-4.5" />
                  Cari Domain
                </>
              )}
            </button>
          </form>

          {/* Error Message */}
          {lookupError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 text-xs font-semibold flex items-start gap-2.5 animate-fade-in">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}
        </div>

        {/* WHOIS Results Display */}
        {result && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50 gap-4">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-black text-gray-900 font-mono tracking-tight">{result.domain}</h2>
              </div>
              {expiryBadge && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border ${expiryBadge.class}`}>
                  {expiryBadge.icon}
                  <span>{expiryBadge.text}</span>
                </div>
              )}
            </div>

            {/* Details Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <tbody className="divide-y divide-gray-100">
                  {result.handle && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider w-1/3">Domain Handle / ID</td>
                      <td className="px-6 py-3.5 text-gray-800 font-mono select-all">{result.handle}</td>
                    </tr>
                  )}
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider">Registrar</td>
                    <td className="px-6 py-3.5 text-gray-800 font-semibold">
                      {result.registrar || '—'}
                      {result.registrarId && <span className="text-gray-400 font-normal text-xs ml-1.5">(IANA ID: {result.registrarId})</span>}
                    </td>
                  </tr>
                  {result.registrantName && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider">Registrant Name</td>
                      <td className="px-6 py-3.5 text-gray-800 font-semibold">{result.registrantName}</td>
                    </tr>
                  )}
                  {(result.registrantEmail || result.registrantPhone) && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider">Registrant Contact</td>
                      <td className="px-6 py-3.5 text-gray-800 space-y-1">
                        {result.registrantEmail && <p className="font-mono">{result.registrantEmail}</p>}
                        {result.registrantPhone && <p>{result.registrantPhone}</p>}
                        {result.registrantAddress && <p className="text-gray-500 font-normal">{result.registrantAddress}</p>}
                      </td>
                    </tr>
                  )}
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider">Tanggal Dibuat (Created)</td>
                    <td className="px-6 py-3.5 text-gray-800 font-semibold">
                      {result.createdDate 
                        ? new Date(result.createdDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider">Tanggal Kedaluwarsa (Expiry)</td>
                    <td className="px-6 py-3.5 text-gray-800 font-semibold text-gray-900">
                      {result.expiryDate 
                        ? new Date(result.expiryDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider">Terakhir Diperbarui (Updated)</td>
                    <td className="px-6 py-3.5 text-gray-800 font-semibold">
                      {result.updatedDate 
                        ? new Date(result.updatedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                  {result.nameServers && result.nameServers.length > 0 && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider">Name Servers (NS)</td>
                      <td className="px-6 py-3.5 text-gray-800">
                        <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-gray-700">
                          {result.nameServers.map((ns, idx) => (
                            <li key={idx}>{ns.toLowerCase()}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                  {result.status && result.status.length > 0 && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider">Domain Status</td>
                      <td className="px-6 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {result.status.map((st, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-medium text-gray-650 font-mono">
                              {st.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {result.whoisServer && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-bold text-gray-400 uppercase tracking-wider">WHOIS Server</td>
                      <td className="px-6 py-3.5 text-gray-800 font-mono select-all">{result.whoisServer}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Expandable Raw WHOIS */}
            {result.raw && (
              <div className="border-t border-gray-100 bg-gray-50/30">
                <button
                  onClick={() => setExpandedRaw(!expandedRaw)}
                  className="w-full flex items-center justify-between px-6 py-4 text-xs font-bold text-gray-700 hover:text-black transition-colors focus:outline-none"
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-gray-400" />
                    Data Mentah WHOIS (Raw Text)
                  </span>
                  <span>{expandedRaw ? 'Sembunyikan' : 'Tampilkan'}</span>
                </button>
                {expandedRaw && (
                  <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
                    <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl text-[10px] font-mono leading-relaxed overflow-x-auto max-h-96 select-all shadow-inner">
                      {result.raw}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-400 shrink-0">
        <p>&copy; {new Date().getFullYear()} {brandName}. Seluruh hak cipta dilindungi.</p>
      </footer>
    </div>
  );
}
