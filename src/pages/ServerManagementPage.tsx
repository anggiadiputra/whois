import React, { useState, useEffect, useCallback } from 'react';
import { 
  Server, Plus, Search, Trash2, Edit2, Eye, EyeOff, Copy, Check, X, Shield, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = '/api';

interface ServerItem {
  id: string;
  user_id: string;
  ip_address: string;
  provider: string;
  username: string;
  password?: string;
  register_date: string | null;
  expired_date: string | null;
  hostname: string | null;
  created_at: string;
}

export default function ServerManagementPage() {
  const { session } = useAuth();
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form/Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerItem | null>(null);
  const [ipAddress, setIpAddress] = useState('');
  const [provider, setProvider] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registerDate, setRegisterDate] = useState('');
  const [expiredDate, setExpiredDate] = useState('');
  const [hostname, setHostname] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Copy success track
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'ip' | 'user' | 'pass' | 'host' | null>(null);

  // Password visibility maps
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/saved-servers`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch servers');
      }
      const data = await res.json();
      setServers(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while loading servers.');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleCopy = (text: string, id: string, type: 'ip' | 'user' | 'pass' | 'host') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedId(null);
      setCopiedType(null);
    }, 1500);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const resetForm = () => {
    setIpAddress('');
    setProvider('');
    setUsername('');
    setPassword('');
    setRegisterDate('');
    setExpiredDate('');
    setHostname('');
    setEditingServer(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (srv: ServerItem) => {
    setEditingServer(srv);
    setIpAddress(srv.ip_address);
    setProvider(srv.provider);
    setUsername(srv.username);
    setPassword(srv.password || '');
    setRegisterDate(srv.register_date ? srv.register_date.split('T')[0] : '');
    setExpiredDate(srv.expired_date ? srv.expired_date.split('T')[0] : '');
    setHostname(srv.hostname || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipAddress.trim() || !provider.trim() || !username.trim() || !password.trim()) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ip_address: ipAddress.trim(),
        provider: provider.trim(),
        username: username.trim(),
        password: password.trim(),
        register_date: registerDate || null,
        expired_date: expiredDate || null,
        hostname: hostname.trim() || null
      };

      const url = editingServer 
        ? `${API_URL}/saved-servers/${editingServer.id}`
        : `${API_URL}/saved-servers`;
      
      const method = editingServer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to save server');
      }

      await fetchServers();
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      alert(err.message || 'Failed to save server details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server?')) return;
    try {
      const res = await fetch(`${API_URL}/saved-servers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.token}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to delete server');
      }
      setServers(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete server.');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const isExpired = (expiredStr: string | null) => {
    if (!expiredStr) return false;
    try {
      const d = new Date(expiredStr);
      if (isNaN(d.getTime())) return false;
      return d.getTime() < new Date().setHours(0,0,0,0);
    } catch {
      return false;
    }
  };

  // Filter servers
  const filtered = servers.filter(s => {
    const query = searchQuery.toLowerCase();
    return (
      s.ip_address.toLowerCase().includes(query) ||
      s.provider.toLowerCase().includes(query) ||
      s.username.toLowerCase().includes(query) ||
      (s.hostname && s.hostname.toLowerCase().includes(query))
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const startIndex = (validPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginated = filtered.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Server className="w-5 h-5 text-gray-800" />
            Server Management
          </h1>
          <p className="text-sm text-gray-500">Securely store server IP addresses, provider credentials, and registration dates</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Server
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm font-medium">
          <Shield className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchServers} className="ml-auto underline hover:text-red-900">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
          <svg className="animate-spin w-6 h-6 text-gray-800" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <Server className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No servers stored yet</p>
          <p className="text-xs text-gray-400 mt-1">Keep track of your cloud hosting IP addresses and provider accounts in one secure place</p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Create first server entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search by IP, provider, or user..."
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

          {/* Table list */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
              <p className="text-sm font-medium text-gray-500">No servers match your search</p>
              <button
                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                className="mt-3 px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-lg transition-colors"
              >
                Reset Search
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Credentials</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map((srv, idx) => {
                      const expired = isExpired(srv.expired_date);
                      return (
                        <tr key={srv.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {startIndex + idx + 1}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                            <div className="flex items-center gap-1.5">
                              <span>{srv.ip_address}</span>
                              <button
                                onClick={() => handleCopy(srv.ip_address, srv.id, 'ip')}
                                className="text-gray-400 hover:text-gray-700 p-0.5 rounded"
                                title="Copy IP"
                              >
                                {copiedId === srv.id && copiedType === 'ip' ? (
                                  <Check className="w-3 h-3 text-green-600 animate-pulse" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {srv.hostname && (
                              <div className="text-[10px] text-gray-400 font-normal mt-0.5 flex items-center gap-1">
                                <span className="truncate max-w-[140px]" title={srv.hostname}>{srv.hostname}</span>
                                <button
                                  onClick={() => handleCopy(srv.hostname || '', srv.id, 'host')}
                                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
                                  title="Copy Hostname"
                                >
                                  {copiedId === srv.id && copiedType === 'host' ? (
                                    <Check className="w-2.5 h-2.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700 font-semibold">
                            {srv.provider}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 font-bold uppercase w-8">User:</span>
                                <span className="font-mono text-gray-700 font-semibold">{srv.username}</span>
                                <button
                                  onClick={() => handleCopy(srv.username, srv.id, 'user')}
                                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
                                >
                                  {copiedId === srv.id && copiedType === 'user' ? (
                                    <Check className="w-2.5 h-2.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 font-bold uppercase w-8">Pass:</span>
                                <span className="font-mono text-gray-700">
                                  {visiblePasswords[srv.id] ? srv.password : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePasswordVisibility(srv.id)}
                                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded ml-1"
                                >
                                  {visiblePasswords[srv.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                                <button
                                  onClick={() => handleCopy(srv.password || '', srv.id, 'pass')}
                                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
                                >
                                  {copiedId === srv.id && copiedType === 'pass' ? (
                                    <Check className="w-2.5 h-2.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <div className="space-y-0.5 font-mono">
                              <div><span className="text-[10px] text-gray-400 font-bold mr-1">REG:</span>{formatDate(srv.register_date)}</div>
                              <div><span className="text-[10px] text-gray-400 font-bold mr-1">EXP:</span>{formatDate(srv.expired_date)}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {srv.expired_date ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                expired 
                                  ? 'bg-red-50 text-red-600 border-red-100'
                                  : 'bg-green-50 text-green-700 border-green-100'
                              }`}>
                                {expired ? 'Expired' : 'Active'}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditModal(srv)}
                                className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                                title="Edit server credentials"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(srv.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete server record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden divide-y divide-gray-100 p-4 space-y-4">
                {paginated.map((srv) => {
                  const expired = isExpired(srv.expired_date);
                  return (
                    <div key={srv.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-gray-900">
                            <span>{srv.ip_address}</span>
                            <button
                              onClick={() => handleCopy(srv.ip_address, srv.id, 'ip')}
                              className="text-gray-400 hover:text-gray-700 p-0.5 rounded"
                            >
                              {copiedId === srv.id && copiedType === 'ip' ? (
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          {srv.hostname && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                              <span className="truncate max-w-[160px]">{srv.hostname}</span>
                              <button
                                onClick={() => handleCopy(srv.hostname || '', srv.id, 'host')}
                                className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
                              >
                                {copiedId === srv.id && copiedType === 'host' ? (
                                  <Check className="w-2.5 h-2.5 text-green-600" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          )}
                          <div className="text-xs text-gray-700 font-semibold bg-gray-50 px-2.5 py-0.5 rounded w-fit mt-1">
                            {srv.provider}
                          </div>
                        </div>

                        <div>
                          {srv.expired_date ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              expired 
                                ? 'bg-red-50 text-red-600 border-red-100'
                                : 'bg-green-50 text-green-700 border-green-100'
                            }`}>
                              {expired ? 'Expired' : 'Active'}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </div>
                      </div>

                      {/* Credentials Block */}
                      <div className="bg-gray-50 p-2.5 rounded-lg space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">User</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-gray-700 font-semibold">{srv.username}</span>
                            <button
                              onClick={() => handleCopy(srv.username, srv.id, 'user')}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {copiedId === srv.id && copiedType === 'user' ? (
                                <Check className="w-2.5 h-2.5 text-green-600" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">Pass</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-gray-700">
                              {visiblePasswords[srv.id] ? srv.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(srv.id)}
                              className="text-gray-400 hover:text-gray-600 p-0.5 rounded ml-0.5"
                            >
                              {visiblePasswords[srv.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => handleCopy(srv.password || '', srv.id, 'pass')}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {copiedId === srv.id && copiedType === 'pass' ? (
                                <Check className="w-2.5 h-2.5 text-green-600" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Dates & Actions */}
                      <div className="flex items-center justify-between pt-2.5 text-xs border-t border-gray-50">
                        <div className="space-y-0.5 font-mono text-[10px] text-gray-500">
                          <div><span className="font-bold text-gray-400 mr-1">REG:</span>{formatDate(srv.register_date)}</div>
                          <div><span className="font-bold text-gray-400 mr-1">EXP:</span>{formatDate(srv.expired_date)}</div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(srv)}
                            className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                            title="Edit server"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(srv.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
                            title="Delete server"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Controls */}
              <div className="bg-gray-50 px-5 py-3 flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-gray-100">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <span className="text-xs text-gray-500 font-medium text-center sm:text-left">
                    Showing <span className="font-semibold text-gray-800">{startIndex + 1}</span> to <span className="font-semibold text-gray-800">{Math.min(endIndex, filtered.length)}</span> of <span className="font-semibold text-gray-800">{filtered.length}</span> entries
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-white border border-gray-200 rounded-lg text-xs font-semibold px-2 py-1 focus:outline-none focus:ring-1 focus:ring-black text-gray-700"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={validPage === 1}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(idx + 1)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                          validPage === idx + 1
                            ? 'bg-black text-white shadow-sm'
                            : 'border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white'
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
                )}
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
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                {editingServer ? 'Edit Server' : 'Add Server'}
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
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">IP Address <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="e.g. 192.168.1.1"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Provider <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="e.g. DigitalOcean, AWS, Linode"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Hostname</label>
                <input
                  type="text"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder="e.g. srv1.example.com"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Username <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. root, admin"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="e.g. your-pass"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Register Date</label>
                  <input
                    type="date"
                    value={registerDate}
                    onChange={(e) => setRegisterDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Expired Date</label>
                  <input
                    type="date"
                    value={expiredDate}
                    onChange={(e) => setExpiredDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-lg text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-sm font-semibold rounded-lg text-white transition-colors"
                >
                  {submitting ? 'Saving...' : 'Save Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
