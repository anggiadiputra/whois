import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WhoisResult } from '../lib/neon';
import { Globe, Search, ShieldAlert, CheckCircle2, Clock, ChevronUp, ChevronDown } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const clean = status.toLowerCase();
  let bg = 'bg-gray-100 text-gray-700 border-gray-200';
  if (clean.includes('active') || clean.includes('ok')) {
    bg = 'bg-emerald-50 text-emerald-700 border-emerald-150';
  } else if (clean.includes('clienttransferprohibited') || clean.includes('prohibited')) {
    bg = 'bg-blue-50 text-blue-700 border-blue-150';
  } else if (clean.includes('pending') || clean.includes('hold')) {
    bg = 'bg-amber-50 text-amber-700 border-amber-150';
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${bg} font-mono uppercase`}>
      {status}
    </span>
  );
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

export default function PublicWhoisPage() {
  const { brandName } = useAuth();
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
      setResult(data as WhoisResult);
    } catch (err: any) {
      setLookupError(err.message || 'Gagal memeriksa domain.');
    } finally {
      setSearching(false);
    }
  };

  // Expiry calculation helper
  const getExpiryLabel = (expiryDateStr?: string | null) => {
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
    <div className="w-full flex flex-col items-center">
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-600" />
                <h2 className="text-base font-bold text-gray-900 font-mono tracking-tight">{result.domain}</h2>
              </div>
              {expiryBadge && (
                <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold border ${expiryBadge.class}`}>
                  {expiryBadge.icon}
                  <span>{expiryBadge.text}</span>
                </div>
              )}
            </div>

            {/* Details Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <tbody className="divide-y divide-gray-100">
                  {result.handle && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-semibold text-gray-500 w-1/3">Domain Handle / ID</td>
                      <td className="px-5 py-3 text-gray-800 font-mono select-all">{result.handle}</td>
                    </tr>
                  )}
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-semibold text-gray-500">Registrar</td>
                    <td className="px-5 py-3 text-gray-800 font-medium">
                      {result.registrar || '—'}
                      {result.registrarId && <span className="text-gray-400 font-normal text-xs ml-1.5">(IANA ID: {result.registrarId})</span>}
                    </td>
                  </tr>
                  {result.registrantName && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-semibold text-gray-500">Registrant Name</td>
                      <td className="px-5 py-3 text-gray-800 font-medium">
                        {result.registrantName}
                      </td>
                    </tr>
                  )}
                  {(result.registrantEmail || result.registrantPhone) && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-semibold text-gray-500">Registrant Contact</td>
                      <td className="px-5 py-3 text-gray-800 font-mono">
                        {result.registrantEmail && <span className="mr-3 text-gray-800">{result.registrantEmail}</span>}
                        {result.registrantPhone && <span className="text-gray-500">{result.registrantPhone}</span>}
                      </td>
                    </tr>
                  )}
                  {(result.registrarEmail || result.registrarPhone) && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-semibold text-gray-500">Registrar Contact</td>
                      <td className="px-5 py-3 text-gray-800 font-mono">
                        {result.registrarEmail && <span className="mr-3 text-gray-800">{result.registrarEmail}</span>}
                        {result.registrarPhone && <span className="text-gray-500">{result.registrarPhone}</span>}
                      </td>
                    </tr>
                  )}
                  {(result.abuseEmail || result.abusePhone) && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-semibold text-gray-500">Abuse Contact</td>
                      <td className="px-5 py-3 text-gray-800 font-mono">
                        {result.abuseEmail && <span className="mr-3 text-gray-800">{result.abuseEmail}</span>}
                        {result.abusePhone && <span className="text-gray-500">{result.abusePhone}</span>}
                      </td>
                    </tr>
                  )}
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-semibold text-gray-500">Status</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {result.status && Array.isArray(result.status) && result.status.length > 0 ? (
                          result.status.map(s => <StatusBadge key={s} status={s} />)
                        ) : (
                          '—'
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-semibold text-gray-500">Created Date</td>
                    <td className="px-5 py-3 text-gray-800 font-mono">{formatDate(result.createdDate)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-semibold text-gray-500">Updated Date</td>
                    <td className="px-5 py-3 text-gray-800 font-mono">{formatDate(result.updatedDate)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-semibold text-gray-500">Expiry Date</td>
                    <td className="px-5 py-3 text-orange-700 font-mono font-semibold">{formatDate(result.expiryDate)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-semibold text-gray-500">DNSSEC Status</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                        (result.dnssec || 'Unsigned / Inactive').includes('Active')
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : 'bg-gray-50 text-gray-500 border-gray-100'
                      }`}>
                        {result.dnssec || 'Unsigned / Inactive'}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-semibold text-gray-500">Nameservers</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {result.nameservers && result.nameservers.length > 0 ? (
                          result.nameservers.map(ns => (
                            <span key={ns} className="px-2.5 py-0.5 bg-gray-100 rounded font-mono text-gray-700 text-xs">{ns}</span>
                          ))
                        ) : (
                          '—'
                        )}
                      </div>
                    </td>
                  </tr>
                  {result.databaseLastUpdate && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-semibold text-gray-500">Database Last Sync</td>
                      <td className="px-5 py-3 text-gray-400 font-mono">{formatDate(result.databaseLastUpdate)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Expandable Raw WHOIS */}
            <button
              onClick={() => setExpandedRaw(v => !v)}
              className="w-full flex items-center justify-between px-5 py-2.5 border-t border-gray-100 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold uppercase tracking-wider text-[10px]">Raw RDAP Data</span>
              {expandedRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {expandedRaw && (
              <div className="border-t border-gray-100 p-4 bg-gray-50/30">
                <pre className="text-[10px] text-gray-600 overflow-auto max-h-60 font-mono whitespace-pre-wrap break-all bg-white p-3 rounded-lg border border-gray-200">
                  {JSON.stringify(result.rawData, null, 2)}
                </pre>
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
