import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Plus, Search, Trash2, Edit2, Shield, Mail, User, Key, ChevronLeft, ChevronRight, X, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = '/api';

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface LogItem {
  id: string;
  user_id: string;
  action: string;
  details: string | null;
  created_at: string;
  email: string;
  name: string;
}

export default function UserManagementPage() {
  const { session, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'logs'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [submitting, setSubmitting] = useState(false);

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`
        }
      });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error occurred while loading users.');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
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
      setError(err.message || 'Error occurred while loading activity logs.');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    if (activeSubTab === 'users') {
      fetchUsers();
    } else {
      fetchLogs();
    }
  }, [activeSubTab, fetchUsers, fetchLogs]);

  const resetForm = () => {
    setEmail('');
    setName('');
    setPassword('');
    setRole('user');
    setEditingUser(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (usr: UserItem) => {
    setEditingUser(usr);
    setEmail(usr.email);
    setName(usr.name);
    setPassword('');
    setRole(usr.role);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || (!editingUser && !password.trim())) {
      alert('Email and Password are required.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        email: email.trim(),
        name: name.trim() || email.split('@')[0],
        password: password.trim() || undefined,
        role
      };

      const url = editingUser ? `${API_URL}/users/${editingUser.id}` : `${API_URL}/users`;
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save user');

      setIsModalOpen(false);
      resetForm();
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to save user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) {
      alert('Anda tidak bisa menghapus akun admin Anda sendiri.');
      return;
    }
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini? Semua domain dan server yang disimpan pengguna ini akan ikut terhapus.')) return;
    
    try {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.token}`
        }
      });
      if (!res.ok) throw new Error('Failed to delete user');
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Filter logic
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const filteredLogs = logs.filter(l => {
    const q = searchQuery.toLowerCase();
    return (
      l.email.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      (l.details && l.details.toLowerCase().includes(q))
    );
  });

  const dataList = activeSubTab === 'users' ? filteredUsers : filteredLogs;

  // Pagination
  const totalPages = Math.ceil(dataList.length / itemsPerPage);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const startIndex = (validPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = dataList.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-800" />
            Pengaturan Pengguna
          </h1>
          <p className="text-sm text-gray-500">Kelola akun pengguna, hak akses peran (Role), dan pantau seluruh log aktivitas sistem.</p>
        </div>
        {activeSubTab === 'users' && (
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tambah Pengguna
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setActiveSubTab('users'); setCurrentPage(1); setSearchQuery(''); }}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'users' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Daftar Pengguna ({users.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('logs'); setCurrentPage(1); setSearchQuery(''); }}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'logs' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Log Aktivitas Sistem ({logs.length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm font-medium">
          <Shield className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={activeSubTab === 'users' ? fetchUsers : fetchLogs} className="ml-auto underline hover:text-red-900">Ulangi</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
          <svg className="animate-spin w-6 h-6 text-gray-800" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search Controls */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder={activeSubTab === 'users' ? 'Cari nama, email, atau role...' : 'Cari email, aksi, detail...'}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* User Directory */}
          {activeSubTab === 'users' && (
            dataList.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm font-medium text-gray-500">Tidak ada pengguna yang cocok</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Terdaftar</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedData.map((usr: any, idx) => (
                        <tr key={usr.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400">{startIndex + idx + 1}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-gray-800">{usr.name}</td>
                          <td className="px-4 py-3 text-xs text-gray-700 font-mono">{usr.email}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              usr.role === 'admin' 
                                ? 'bg-black text-white border-black'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              {usr.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{formatDate(usr.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditModal(usr)}
                                className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(usr.id)}
                                disabled={usr.id === currentUser?.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="block md:hidden divide-y divide-gray-100 p-4 space-y-4">
                  {paginatedData.map((usr: any) => (
                    <div key={usr.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{usr.name}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">{usr.email}</div>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          usr.role === 'admin' 
                            ? 'bg-black text-white border-black'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {usr.role}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 text-xs text-gray-500">
                        <span>Reg: {formatDate(usr.created_at)}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(usr)}
                            className="p-1.5 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(usr.id)}
                            disabled={usr.id === currentUser?.id}
                            className="p-1.5 text-red-500 border border-red-100 rounded-lg hover:bg-red-50 disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Activity Logs */}
          {activeSubTab === 'logs' && (
            dataList.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm font-medium text-gray-500">Tidak ada log aktivitas</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pengguna</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Detail</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedData.map((log: any, idx) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400">{startIndex + idx + 1}</td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            <div><span className="font-semibold text-gray-800">{log.name}</span></div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{log.email}</div>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-gray-900 uppercase tracking-wider">{log.action}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 font-mono">{log.details || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{formatDate(log.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="block md:hidden divide-y divide-gray-100 p-4 space-y-4">
                  {paginatedData.map((log: any) => (
                    <div key={log.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-gray-400">Pengguna</div>
                          <div className="text-xs font-bold text-gray-800">{log.name} <span className="font-mono font-normal text-gray-500">({log.email})</span></div>
                        </div>
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[9px] font-bold uppercase tracking-wider text-gray-600">
                          {log.action}
                        </span>
                      </div>
                      {log.details && (
                        <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 break-all">
                          {log.details}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 font-mono text-right mt-1">
                        {formatDate(log.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Footer Controls */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border border-gray-200 rounded-xl shadow-sm">
              <span className="text-xs text-gray-500 font-medium">
                Showing <span className="font-semibold text-gray-800">{startIndex + 1}</span> to <span className="font-semibold text-gray-800">{Math.min(endIndex, dataList.length)}</span> of <span className="font-semibold text-gray-800">{dataList.length}</span> entries
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={validPage === 1}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                      validPage === idx + 1 ? 'bg-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-white'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={validPage === totalPages}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-colors disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-700" />
                {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@domain.com"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nama</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                  Password {editingUser && <span className="text-gray-400 font-normal text-[10px]">(Kosongkan jika tidak ingin diubah)</span>} {!editingUser && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    required={!editingUser}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? '••••••••' : 'Password baru'}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Role / Hak Akses</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-700 bg-white"
                >
                  <option value="user">User (Akses biasa, tanpa Pengaturan)</option>
                  <option value="admin">Admin (Akses penuh + Log Sistem)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-lg text-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-sm font-semibold rounded-lg text-white transition-colors"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
