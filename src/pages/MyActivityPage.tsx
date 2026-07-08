import { useState, useEffect, useCallback } from 'react';
import { Activity, ChevronLeft, ChevronRight, RefreshCw, X, Mail, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = '/api';

interface LogItem {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
}

export default function MyActivityPage() {
  const { session } = useAuth();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch(`${API_URL}/activity-logs`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`
        }
      });
      if (!res.ok) throw new Error('Failed to load activity logs');
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Pagination
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const startIndex = (validPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = logs.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-800" />
          Aktivitas Saya
        </h1>
        <p className="text-sm text-gray-500 font-normal">Pantau log aktivitas login dan perubahan data Anda secara real-time.</p>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-100 text-red-750 px-4 py-3 rounded-2xl text-xs font-bold">
          {fetchError}
        </div>
      )}

      {/* Activity Log Full Width Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0">
              <Activity className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Log Aktivitas Saya</h2>
              <p className="text-[11px] text-gray-500">Daftar riwayat aksi yang dilakukan oleh akun Anda.</p>
            </div>
          </div>
          <button 
            onClick={fetchLogs} 
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors border border-gray-100 hover:text-gray-900"
            title="Refresh Log"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-7 h-7 text-black animate-spin" />
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Memuat Log...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300 opacity-60" />
            <p className="text-xs font-semibold text-gray-500">Belum ada catatan aktivitas untuk akun Anda.</p>
          </div>
        ) : (
          <div>
            {/* Desktop view table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                    <th className="text-left px-6 py-3 w-16">#</th>
                    <th className="text-left px-6 py-3">Aksi</th>
                    <th className="text-left px-6 py-3">Detail Kegiatan</th>
                    <th className="text-left px-6 py-3 w-48">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {paginatedLogs.map((log, idx) => (
                    <tr 
                      key={log.id} 
                      onClick={() => log.details && setSelectedLog(log)}
                      className={`transition-colors ${log.details ? 'cursor-pointer hover:bg-gray-50/70' : 'hover:bg-gray-50/50'}`}
                    >
                      <td className="px-6 py-4 text-xs text-gray-400">{startIndex + idx + 1}</td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-900 uppercase tracking-wider">{log.action}</td>
                      <td className="px-6 py-4 text-xs text-gray-600 font-mono">
                        {log.details ? (
                          <div className="max-w-[400px] truncate font-mono text-gray-500 hover:text-black hover:underline" title="Klik untuk lihat detail lengkap">
                            {log.details}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 font-medium">{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view cards */}
            <div className="block md:hidden divide-y divide-gray-100 p-4 space-y-4">
              {paginatedLogs.map((log) => (
                <div 
                  key={log.id} 
                  onClick={() => log.details && setSelectedLog(log)}
                  className={`bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-2 ${log.details ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-[9px] font-bold uppercase tracking-wider text-gray-600">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{formatDate(log.created_at)}</span>
                  </div>
                  {log.details && (
                    <div className="text-xs font-mono text-gray-500 bg-gray-50 p-2 rounded-lg truncate hover:underline">
                      {log.details}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
                <span className="text-xs text-gray-500 font-medium">
                  Halaman <span className="font-semibold text-gray-800">{validPage}</span> dari <span className="font-semibold text-gray-800">{totalPages}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={validPage === 1}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-900 transition-colors disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={validPage === totalPages}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-900 transition-colors disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Detail Aktivitas</p>
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
                <span className="text-[10px] uppercase font-bold text-gray-400">Waktu Aktivitas</span>
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
                <span className="text-[10px] uppercase font-bold text-gray-400">Rincian / Detail Log</span>
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
