import React from 'react';
import { 
  Globe, Clock, AlertCircle, CheckCircle2, ShieldAlert, Layers, Database, ArrowRight, MessageSquare, Mail, X, Search
} from 'lucide-react';
import { SavedDomain } from '../lib/neon';

interface DashboardPageProps {
  savedDomains: SavedDomain[];
  onNavigateToTab: (tabPath: string) => void;
  onSelectDomain: (domain: SavedDomain) => void;
  sessionToken?: string;
}

export default function DashboardPage({ savedDomains, onNavigateToTab, onSelectDomain, sessionToken }: DashboardPageProps) {
  const [notificationLogs, setNotificationLogs] = React.useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(true);
  const [selectedLog, setSelectedLog] = React.useState<any | null>(null);

  // States for critical domains search & pagination
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // 1. Process statistics
  const totalDomains = savedDomains.length;
  
  let expiredCount = 0;
  let expiringCount = 0;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Grouping objects
  const registrarsCount: { [key: string]: number } = {};
  const extensionsCount: { [key: string]: number } = {};

  savedDomains.forEach(sd => {
    // Determine expiration status
    if (sd.expiry_date) {
      try {
        const expiry = new Date(sd.expiry_date);
        if (expiry < now) {
          expiredCount++;
        } else {
          const diffTime = expiry.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 30) {
            expiringCount++;
          }
        }
      } catch {
        // ignore
      }
    }

    // Registrar count
    const reg = sd.registrar ? sd.registrar.trim() : 'Tidak Terdeteksi';
    registrarsCount[reg] = (registrarsCount[reg] || 0) + 1;

    // Extension count
    const parts = sd.domain.split('.');
    if (parts.length > 1) {
      const ext = `.${parts[parts.length - 1].toLowerCase()}`;
      extensionsCount[ext] = (extensionsCount[ext] || 0) + 1;
    } else {
      extensionsCount['.unknown'] = (extensionsCount['.unknown'] || 0) + 1;
    }
  });

  const activeCount = totalDomains - expiredCount - expiringCount;

  // 2. Identify expired and expiring domains (critical list)
  const criticalDomains = savedDomains.filter(sd => {
    if (!sd.expiry_date) return false;
    try {
      const expiry = new Date(sd.expiry_date);
      if (expiry < now) return true;
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    } catch {
      return false;
    }
  }).map(sd => {
    const expiry = new Date(sd.expiry_date!);
    let statusLabel = '';
    let statusClass = '';
    let diffDays = 0;
    const isExpired = expiry < now;

    if (isExpired) {
      statusLabel = 'Sudah Expired';
      statusClass = 'bg-red-50 text-red-700 border-red-200';
    } else {
      const diffTime = expiry.getTime() - now.getTime();
      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      statusLabel = `${diffDays} hari lagi`;
      statusClass = 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return {
      ...sd,
      statusLabel,
      statusClass,
      isExpired,
      diffDays
    };
  }).sort((a, b) => {
    // Sort expired first, then by urgency (fewer days remaining)
    if (a.isExpired && !b.isExpired) return -1;
    if (!a.isExpired && b.isExpired) return 1;
    return new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime();
  });

  // Filter critical domains by searchQuery
  const filteredCritical = criticalDomains.filter(d => 
    d.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination for critical domains
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredCritical.length / itemsPerPage);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const startIndex = (validPage - 1) * itemsPerPage;
  const paginatedCritical = filteredCritical.slice(startIndex, startIndex + itemsPerPage);

  // Sort breakdowns
  const sortedRegistrars = Object.entries(registrarsCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // show top 5

  const sortedExtensions = Object.entries(extensionsCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // show top 5

  // 3. Fetch latest notification logs from server
  React.useEffect(() => {
    let active = true;
    async function fetchLogs() {
      try {
        const res = await fetch('/api/activity-logs', {
          headers: { 'Authorization': sessionToken ? `Bearer ${sessionToken}` : '' }
        });
        if (res.ok && active) {
          const data = await res.json();
          const allowedActions = [
            'WhatsApp Alert (Fonnte)',
            'WhatsApp Alert Failed (Fonnte)',
            'WhatsApp Alert (Dev Mode)',
            'Email Alert (Brevo)',
            'Email Alert (SMTP)',
            'Email Alert (Dev Mode)',
            'Email Alert Failed (Brevo)',
            'Email Alert Failed (SMTP)',
            'Test Alerts'
          ];
          const filtered = data.filter((log: any) => allowedActions.includes(log.action));
          setNotificationLogs(filtered.slice(0, 5)); // top 5
        }
      } catch (err) {
        if (active) console.error('Failed to fetch activity logs:', err);
      } finally {
        if (active) setLoadingLogs(false);
      }
    }

    if (sessionToken) {
      setLoadingLogs(true);
      fetchLogs();
    }

    return () => {
      active = false;
    };
  }, [sessionToken]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500 font-normal">Ringkasan status domain dan performa portfolio server monitor Anda.</p>
        </div>
      </div>

      {/* Warning Banner */}
      {(expiredCount > 0 || expiringCount > 0) && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 md:p-5 flex items-start gap-4 animate-fade-in shadow-sm">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5.5 h-5.5 text-red-600" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-bold text-red-950">Domain Butuh Perhatian Segera</h3>
            <p className="text-xs text-red-700 leading-relaxed font-normal">
              Terdapat <span className="font-bold">{expiredCount} domain sudah expired</span> dan{' '}
              <span className="font-bold">{expiringCount} domain akan expired dalam 30 hari ke depan</span>. 
              Segera perbarui registrasi domain tersebut untuk menghindari kehilangan hak kepemilikan.
            </p>
            <button
              onClick={() => onNavigateToTab('/my-domains')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 hover:text-red-950 transition-colors pt-1"
            >
              Kelola Domain Sekarang
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Domains */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shrink-0">
            <Globe className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Domain</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{totalDomains}</p>
          </div>
        </div>

        {/* Card 2: Active */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-5.5 h-5.5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Domain Aktif</p>
            <p className="text-2xl font-black text-emerald-650 mt-0.5">{activeCount}</p>
          </div>
        </div>

        {/* Card 3: Expiring Soon */}
        <div className={`rounded-2xl shadow-sm border p-5 flex items-center gap-4 hover:shadow-md transition-all ${
          expiringCount > 0 
            ? 'bg-amber-50/40 border-amber-200' 
            : 'bg-white border-gray-200'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
            expiringCount > 0 
              ? 'bg-amber-100/80 border-amber-200 text-amber-600' 
              : 'bg-gray-50 border-gray-100 text-gray-400'
          }`}>
            <Clock className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Akan Expired</p>
            <p className={`text-2xl font-black mt-0.5 ${expiringCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{expiringCount}</p>
          </div>
        </div>

        {/* Card 4: Expired */}
        <div className={`rounded-2xl shadow-sm border p-5 flex items-center gap-4 hover:shadow-md transition-all ${
          expiredCount > 0 
            ? 'bg-red-50/40 border-red-200' 
            : 'bg-white border-gray-200'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
            expiredCount > 0 
              ? 'bg-red-100/80 border-red-200 text-red-600' 
              : 'bg-gray-50 border-gray-100 text-gray-400'
          }`}>
            <AlertCircle className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sudah Expired</p>
            <p className={`text-2xl font-black mt-0.5 ${expiredCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{expiredCount}</p>
          </div>
        </div>

      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Breakdown 1: TLD Extensions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shrink-0">
              <Layers className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Ekstensi Domain Terbanyak (TLD)</h2>
              <p className="text-[11px] text-gray-500 font-normal mt-0.5">Statistik porsi ekstensi domain paling populer di database Anda.</p>
            </div>
          </div>

          <div className="space-y-4">
            {sortedExtensions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Tidak ada data ekstensi domain.</p>
            ) : (
              sortedExtensions.map(item => {
                const percentage = totalDomains > 0 ? Math.round((item.count / totalDomains) * 100) : 0;
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="font-mono text-gray-800">{item.name}</span>
                      <span className="text-gray-500">{item.count} domain ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-black h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Breakdown 2: Registrars */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shrink-0">
              <Database className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Registrar Terpopuler</h2>
              <p className="text-[11px] text-gray-500 font-normal mt-0.5">Daftar registrar penyedia jasa sewa domain teratas Anda.</p>
            </div>
          </div>

          <div className="space-y-4">
            {sortedRegistrars.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Tidak ada data registrar domain.</p>
            ) : (
              sortedRegistrars.map(item => {
                const percentage = totalDomains > 0 ? Math.round((item.count / totalDomains) * 100) : 0;
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-800 truncate max-w-[200px]" title={item.name}>{item.name}</span>
                      <span className="text-gray-500">{item.count} domain ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-gray-600 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Critical Domains Section (With Live Search & Pagination) */}
      {criticalDomains.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shrink-0 border border-red-100 text-red-650">
                <AlertCircle className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Daftar Domain Expired & Akan Expired</h2>
                <p className="text-[11px] text-gray-500 font-normal mt-0.5">Daftar domain yang membutuhkan perpanjangan atau perhatian segera.</p>
              </div>
            </div>
            {/* Live Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Cari domain..."
                className="w-full pl-9 pr-8 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredCritical.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              Tidak ada domain bermasalah yang cocok dengan pencarian Anda.
            </div>
          ) : (
            <>
              {/* Table for Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-left border-b border-gray-100">
                      <th className="px-4 py-2.5">Domain</th>
                      <th className="px-4 py-2.5">Registrar</th>
                      <th className="px-4 py-2.5">Tanggal Kedaluwarsa</th>
                      <th className="px-4 py-2.5">Status / Sisa Waktu</th>
                      <th className="px-4 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedCritical.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-mono text-gray-900 font-bold">{d.domain}</td>
                        <td className="px-4 py-3 text-gray-500">{d.registrar || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-650">
                          {d.expiry_date 
                            ? new Date(d.expiry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${d.statusClass}`}>
                            {d.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onSelectDomain(d)}
                            className="px-2.5 py-1 text-[10px] font-bold text-gray-700 bg-gray-100 hover:bg-black hover:text-white rounded-lg transition-colors"
                          >
                            Kelola
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards for Mobile */}
              <div className="md:hidden space-y-3">
                {paginatedCritical.map(d => (
                  <div key={d.id} className="p-4 border border-gray-100 rounded-xl space-y-2 bg-gray-50/30">
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs text-gray-900 font-bold">{d.domain}</span>
                      <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full border ${d.statusClass}`}>
                        {d.statusLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 space-y-0.5">
                      <p><span className="font-medium">Registrar:</span> {d.registrar || '—'}</p>
                      <p><span className="font-medium">Expired:</span> {d.expiry_date 
                        ? new Date(d.expiry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                        : '—'}</p>
                    </div>
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => onSelectDomain(d)}
                        className="px-3 py-1 text-[10px] font-bold text-gray-700 bg-gray-100 hover:bg-black hover:text-white rounded-lg transition-colors w-full text-center"
                      >
                        Kelola Domain
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100 rounded-b-2xl -mx-6 -mb-6">
                  <span className="text-xs text-gray-500 font-semibold">
                    Halaman <span className="font-bold text-gray-800">{validPage}</span> dari <span className="font-bold text-gray-800">{totalPages}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={validPage === 1}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                      Sebelumnya
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={validPage === totalPages}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Notification Logs Section (WhatsApp & Email Logs) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 text-emerald-600">
              <MessageSquare className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Log Notifikasi Pengiriman (Fonnte & Email)</h2>
              <p className="text-[11px] text-gray-500 font-normal mt-0.5">Riwayat aktivitas pengiriman notifikasi otomatis maupun pengujian manual.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('/my-activity')}
            className="text-[11px] font-bold text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
          >
            Lihat Semua Log
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loadingLogs ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-black rounded-full" />
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Memuat Log...</span>
          </div>
        ) : notificationLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400 font-normal">
            Belum ada riwayat pengiriman notifikasi yang tercatat.
          </div>
        ) : (
          <div className="space-y-3">
            {notificationLogs.map((log) => {
              const isWhatsapp = log.action.includes('WhatsApp');
              const isFailed = log.action.includes('Failed');
              const isDev = log.action.includes('Dev Mode');
              
              return (
                <div 
                  key={log.id} 
                  onClick={() => log.details && setSelectedLog(log)}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors cursor-pointer hover:shadow-sm ${
                    isFailed 
                      ? 'bg-red-50/30 border-red-100 hover:bg-red-50/60' 
                      : isDev 
                        ? 'bg-amber-50/30 border-amber-100 hover:bg-amber-50/60' 
                        : 'bg-emerald-50/20 border-emerald-100/70 hover:bg-emerald-50/40'
                  }`}
                  title="Klik untuk melihat detail log lengkap"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      isFailed 
                        ? 'bg-red-100/50 border-red-200 text-red-600' 
                        : isWhatsapp 
                          ? 'bg-emerald-100/50 border-emerald-200 text-emerald-600' 
                          : 'bg-blue-100/50 border-blue-200 text-blue-600'
                    }`}>
                      {isWhatsapp ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{log.action}</span>
                        {isDev && (
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-200 rounded text-[9px] font-bold uppercase">
                            Simulasi
                          </span>
                        )}
                        {isFailed && (
                          <span className="px-1.5 py-0.2 bg-red-100 text-red-800 border border-red-200 rounded text-[9px] font-bold uppercase">
                            Gagal
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-normal leading-relaxed break-all sm:break-normal line-clamp-2 hover:underline">
                        {log.details}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold shrink-0 self-end sm:self-center">
                    {new Date(log.created_at).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg border ${
                  selectedLog.action.includes('Failed') 
                    ? 'bg-red-50 border-red-100 text-red-650' 
                    : selectedLog.action.includes('WhatsApp') 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-650' 
                      : 'bg-blue-50 border-blue-100 text-blue-650'
                }`}>
                  {selectedLog.action.includes('WhatsApp') ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900">{selectedLog.action}</h3>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Detail Notifikasi</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">Waktu Pengiriman</span>
                <p className="font-semibold text-gray-800">
                  {new Date(selectedLog.created_at).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-gray-400">Isi / Detail Log</span>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                  {selectedLog.details || 'Tidak ada detail tambahan.'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-black hover:bg-gray-800 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
