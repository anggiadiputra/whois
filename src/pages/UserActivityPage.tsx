import { useState, useEffect, useCallback } from 'react';
import { Activity, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = '/api';

interface LogItem {
  id: string;
  user_id: string;
  action: string;
  details: string | null;
  created_at: string;
  email: string;
  name: string;
}

export default function UserActivityPage() {
  const { session } = useAuth();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch(`${API_URL}/activity-logs`, {
        headers: {
          Authorization: `Bearer ${session?.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load activity logs');
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || 'Failed to load activity logs.');
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
      return d.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const startIndex = (validPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = logs.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-800" />
          Aktivitas Pengguna
        </h1>
        <p className="text-sm text-gray-500 font-normal">Seluruh aktivitas pengguna dicatat di halaman ini. Hanya admin yang dapat melihat.</p>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-100 text-red-750 px-4 py-3 rounded-2xl text-xs font-bold">
          {fetchError}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0">
              <Activity className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Log Aktivitas Sistem</h2>
              <p className="text-[11px] text-gray-500">Lihat semua catatan aktivitas pengguna secara lengkap.</p>
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
            <p className="text-xs font-semibold text-gray-500">Belum ada catatan aktivitas untuk sistem.</p>
          </div>
        ) : (
          <div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                    <th className="text-left px-6 py-3 w-16">#</th>
                    <th className="text-left px-6 py-3">Pengguna</th>
                    <th className="text-left px-6 py-3">Aksi</th>
                    <th className="text-left px-6 py-3">Detail</th>
                    <th className="text-left px-6 py-3 w-48">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {paginatedLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-xs text-gray-400">{startIndex + idx + 1}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-gray-900">
                        {log.name}
                        <div className="text-[10px] text-gray-500 font-mono">{log.email}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-900 uppercase tracking-wider">{log.action}</td>
                      <td className="px-6 py-4 text-xs text-gray-600 font-mono break-words">{log.details || '—'}</td>
                      <td className="px-6 py-4 text-xs text-gray-500 font-medium">{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="block md:hidden divide-y divide-gray-100 p-4 space-y-4">
              {paginatedLogs.map((log) => (
                <div key={log.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-2.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Pengguna</div>
                      <div className="text-xs font-bold text-gray-800 truncate">{log.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono truncate">{log.email}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-[9px] font-bold uppercase tracking-wider text-gray-600">{log.action}</span>
                  </div>
                  {log.details && (
                    <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 break-words">
                      {log.details}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-400 font-mono text-right">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
                <span className="text-xs text-gray-500 font-medium">
                  Halaman <span className="font-semibold text-gray-800">{validPage}</span> dari <span className="font-semibold text-gray-800">{totalPages}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={validPage === 1}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-900 transition-colors disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
    </div>
  );
}
