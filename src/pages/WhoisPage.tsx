import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Globe, Search, Bookmark, BookmarkCheck, LogOut, Trash2, ChevronDown,
  ChevronUp, ChevronLeft, ChevronRight, RefreshCw, Shield, AlertCircle, X, Clock, UploadCloud, Menu, Server, Users, Activity, Settings, User, LayoutDashboard, Loader2
} from 'lucide-react';
import { WhoisResult, SavedDomain } from '../lib/neon';
import { useAuth } from '../contexts/AuthContext';

// Code-split subpages to optimize initial page loading time
const BulkWhoisPage = lazy(() => import('./BulkWhoisPage'));
const ServerManagementPage = lazy(() => import('./ServerManagementPage'));
const UserManagementPage = lazy(() => import('./UserManagementPage'));
const MyActivityPage = lazy(() => import('./MyActivityPage'));
const UserActivityPage = lazy(() => import('./UserActivityPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));
const ProfilePage = lazy(() => import('./ProfilePage'));
const DashboardPage = lazy(() => import('./DashboardPage'));

const API_URL = '/api';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function parseLocalMidnight(dateStr: string | null | undefined) {
  if (!dateStr) return new Date(NaN);
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getExpiryStatus(expiryDateStr: string | null | undefined) {
  if (!expiryDateStr) {
    return { 
      rowClass: 'hover:bg-gray-50/50', 
      cardClass: 'bg-white border-gray-100', 
      textClass: 'text-gray-500', 
      badge: null 
    };
  }
  try {
    const expiry = parseLocalMidnight(expiryDateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (expiry < now) {
      return {
        rowClass: 'bg-red-50/70 hover:bg-red-100/60 text-red-950 border-l-2 border-red-500',
        cardClass: 'bg-red-50/75 border-red-200 text-red-950 border-l-4 border-red-500',
        textClass: 'text-red-600 font-bold',
        badge: 'Sudah Expired'
      };
    }
    
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 30) {
      return {
        rowClass: 'bg-amber-50/70 hover:bg-amber-100/60 text-amber-950 border-l-2 border-amber-500',
        cardClass: 'bg-amber-50/75 border-amber-200 text-amber-950 border-l-4 border-amber-500',
        textClass: 'text-amber-700 font-bold',
        badge: null
      };
    }
  } catch {
    // Ignore invalid dates
  }
  return { 
    rowClass: 'hover:bg-gray-50/50', 
    cardClass: 'bg-white border-gray-100', 
    textClass: 'text-gray-500', 
    badge: null 
  };
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const isActive = lower.includes('active') || lower.includes('ok');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      isActive ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
    }`}>
      {status}
    </span>
  );
}

function WhoisCard({
  result,
  isSaved,
  onSave,
  onRemove,
  onRefresh,
  saving,
  refreshing,
}: {
  result: WhoisResult;
  isSaved: boolean;
  onSave: () => void;
  onRemove: () => void;
  onRefresh: () => void;
  saving: boolean;
  refreshing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-600" />
          <h2 className="text-base font-bold text-gray-900 font-mono tracking-tight">{result.domain}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Refresh from RDAP"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Sync
          </button>
          <button
            onClick={isSaved ? onRemove : onSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isSaved
                ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-100'
                : 'bg-black text-white hover:bg-gray-800'
            } disabled:opacity-50`}
          >
            {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            {isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
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

      {/* Raw RDAP data */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-2.5 border-t border-gray-100 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold uppercase tracking-wider text-[10px]">Raw RDAP Data</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <pre className="text-[10px] text-gray-600 overflow-auto max-h-60 font-mono whitespace-pre-wrap break-all bg-white p-3 rounded-lg border border-gray-200">
            {JSON.stringify(result.rawData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}


export default function WhoisPage() {
  const { user, session, signOut, idleWarning, resetIdleTimer, brandName, brandLogo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<WhoisResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [savedDomains, setSavedDomains] = useState<SavedDomain[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // States for My Domains filter & pagination
  const [savedSearch, setSavedSearch] = useState('');
  const [selectedRegistrar, setSelectedRegistrar] = useState('all');
  const [savedCurrentPage, setSavedCurrentPage] = useState(1);
  const [savedItemsPerPage, setSavedItemsPerPage] = useState(10);
  const [selectedSavedDomain, setSelectedSavedDomain] = useState<SavedDomain | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const syncingSaved = syncingId !== null;
  const [servers, setServers] = useState<any[]>([]);
  const [isMobileWhoisOpen, setIsMobileWhoisOpen] = useState(false);

  // Derive activeTab from the actual URL path
  const activeTab = location.pathname === '/bulk'
    ? 'bulk'
    : location.pathname === '/my-domains'
      ? 'saved'
      : location.pathname === '/servers'
        ? 'servers'
        : (location.pathname === '/users' && user?.role === 'admin')
          ? 'users'
          : (location.pathname === '/settings' && user?.role === 'admin')
            ? 'settings'
            : (location.pathname === '/activity' && user?.role === 'admin')
              ? 'activity'
              : location.pathname === '/my-activity'
                ? 'my-activity'
                : location.pathname === '/profile'
                  ? 'profile'
                  : location.pathname === '/lookup'
                    ? 'lookup'
                    : 'dashboard';

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadSaved = useCallback(async () => {
    try {
      const token = session?.token;
      
      const res = await fetch(`${API_URL}/saved-domains`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (isMounted.current) {
          setSavedDomains(data as SavedDomain[]);
        }
      } else {
        const data = await res.json();
        console.error('Failed to load saved domains:', data.error);
      }
    } catch (err) {
      console.error('Error loading saved domains:', err);
    } finally {
      if (isMounted.current) {
        setLoadingSaved(false);
      }
    }
  }, [session?.token]);

  const loadServers = useCallback(async () => {
    try {
      const token = session?.token;
      const res = await fetch(`${API_URL}/saved-servers`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (isMounted.current) {
          setServers(data);
        }
      }
    } catch (err) {
      console.error('Error loading servers in sidebar:', err);
    }
  }, [session?.token]);

  useEffect(() => {
    loadSaved();
    loadServers();
  }, [location.pathname, loadSaved, loadServers]);

  const handleSearch = async (e?: React.FormEvent, domainName?: string) => {
    if (e) e.preventDefault();
    const domain = (domainName || query).trim().toLowerCase();
    if (!domain) return;
    if (!domainName) setResult(null); // only clear result if doing a fresh manual search
    setLookupError(null);
    setSearching(true);

    try {
      const token = session?.token;

      const res = await fetch(`${API_URL}/whois-lookup?domain=${encodeURIComponent(domain)}`, {
        headers: { 
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json' 
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error ?? `Request failed (${res.status})`);
      } else {
        setResult(data as WhoisResult);
        // If this domain is already saved in history, automatically update its data in the db
        const isCurrentlySaved = savedDomains.some(d => d.domain === data.domain);
        if (isCurrentlySaved) {
          await fetch(`${API_URL}/saved-domains`, {
            method: 'POST',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              domain: data.domain,
              whois_data: data,
              registrar: data.registrar,
              expiry_date: data.expiryDate,
            })
          });
          await loadSaved();
        }
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const token = session?.token;

      const res = await fetch(`${API_URL}/saved-domains`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: result.domain,
          whois_data: result,
          registrar: result.registrar,
          expiry_date: result.expiryDate,
        })
      });

      if (res.ok) {
        await loadSaved();
      } else {
        const data = await res.json();
        console.error('Failed to save domain:', data.error);
      }
    } catch (err) {
      console.error('Error saving domain:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    setDeleteId(id);
    try {
      const token = session?.token;

      const res = await fetch(`${API_URL}/saved-domains/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (res.ok) {
        setSavedDomains(prev => prev.filter(d => d.id !== id));
      } else {
        const data = await res.json();
        console.error('Failed to delete saved domain:', data.error);
      }
    } catch (err) {
      console.error('Error deleting domain:', err);
    } finally {
      setDeleteId(null);
    }
  };

  const handleSyncSaved = async (sd: SavedDomain) => {
    setSyncingId(sd.id);
    try {
      const token = session?.token;
      const res = await fetch(`${API_URL}/whois-lookup?domain=${encodeURIComponent(sd.domain)}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      const data = await res.json();
      if (res.ok) {
        // Update database with new whois data
        await fetch(`${API_URL}/saved-domains`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
          body: JSON.stringify({
            domain: sd.domain,
            whois_data: data,
            registrar: data.registrar,
            expiry_date: data.expiryDate
          })
        });

        // Update local states
        setSavedDomains(prev => prev.map(d => d.id === sd.id ? { ...d, registrar: data.registrar, expiry_date: data.expiryDate, whois_data: data } : d));
        setSelectedSavedDomain(prev => prev && prev.id === sd.id ? { ...prev, registrar: data.registrar, expiry_date: data.expiryDate, whois_data: data } : prev);
      }
    } catch (err) {
      console.error('Failed to sync domain:', err);
    } finally {
      setSyncingId(null);
    }
  };

  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const abortSyncRef = useRef(false);

  const handleStopSyncAll = () => {
    abortSyncRef.current = true;
  };

  const handleSyncAll = async (domainsToSync: SavedDomain[]) => {
    if (domainsToSync.length === 0 || syncingAll) return;
    abortSyncRef.current = false;
    setSyncingAll(true);
    setSyncProgress(0);

    for (let i = 0; i < domainsToSync.length; i++) {
      if (abortSyncRef.current) break;
      const sd = domainsToSync[i];
      setSyncProgress(i + 1);

      await handleSyncSaved(sd);

      if (i < domainsToSync.length - 1 && !abortSyncRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 seconds delay
      }
    }

    setSyncingAll(false);
    setSyncProgress(0);
  };

  const isSaved = result ? savedDomains.some(d => d.domain === result.domain) : false;
  const savedEntry = result ? savedDomains.find(d => d.domain === result.domain) : null;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileProfileDropdownOpen, setMobileProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target as Node)) {
        setMobileProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col md:flex-row relative">
      <header className="md:hidden bg-white border-b border-gray-200 h-14 px-4 flex items-center justify-between sticky top-0 z-20 w-full">
        <div className="flex items-center gap-2">
          {brandLogo ? (
            <img src={brandLogo} alt="Logo" className="w-7 h-7 object-contain rounded-lg" />
          ) : (
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-bold text-gray-900 text-base tracking-tight">{brandName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* User Profile Dropdown for Mobile */}
          <div className="relative" ref={mobileDropdownRef}>
            <button
              onClick={() => setMobileProfileDropdownOpen(!mobileProfileDropdownOpen)}
              className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs hover:opacity-85 focus:outline-none"
            >
              {(user?.name || user?.email || 'U')[0].toUpperCase()}
            </button>
            {mobileProfileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-900 truncate">{user?.name || user?.email.split('@')[0]}</p>
                  {user?.role === 'admin' && <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">admin</p>}
                </div>
                <button
                  onClick={() => {
                    setMobileProfileDropdownOpen(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-black transition-colors text-left"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  Profil Saya
                </button>
                <button
                  onClick={() => {
                    setMobileProfileDropdownOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors text-left border-t border-gray-100"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  Sign out
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:sticky md:top-0 top-0 left-0 z-40 w-64 h-screen bg-white border-r border-gray-200 flex flex-col justify-between shrink-0 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Section */}
        <div>
          {/* Logo container */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
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
            {/* Close button on mobile */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { navigate('/'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => { navigate('/lookup'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'lookup'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Search className="w-4 h-4" />
              WHOIS Lookup
            </button>
            <button
              onClick={() => { navigate('/bulk'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'bulk'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Bulk Lookup
            </button>
            <button
              onClick={() => { navigate('/my-domains'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'saved'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center gap-3">
                <Bookmark className="w-4 h-4" />
                My Domains
              </span>
              {savedDomains.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'saved' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {savedDomains.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { navigate('/servers'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'servers'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center gap-3">
                <Server className="w-4 h-4" />
                Server Management
              </span>
              {servers.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'servers' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {servers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { navigate('/my-activity'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'my-activity'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Activity className="w-4 h-4" />
              My Activity
            </button>
            {user?.role === 'admin' && (
              <>
                <button
                  onClick={() => { navigate('/users'); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'users'
                      ? 'bg-black text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Pengguna
                </button>
                <button
                  onClick={() => { navigate('/activity'); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'activity'
                      ? 'bg-black text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  Aktivitas Pengguna
                </button>
                <button
                  onClick={() => { navigate('/settings'); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'settings'
                      ? 'bg-black text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Pengaturan
                </button>
              </>
            )}
          </nav>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Navbar */}
        <header className="hidden md:flex bg-white border-b border-gray-200 h-14 px-6 items-center justify-between sticky top-0 z-10 w-full shrink-0">
          <div>
            {/* Page title removed */}
          </div>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-3 text-left hover:opacity-85 focus:outline-none rounded-lg p-1 transition-all"
            >
              <div className="text-right">
                <p className="text-xs font-bold text-gray-900">{user?.name || user?.email.split('@')[0]}</p>
                {user?.role === 'admin' && <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">admin</p>}
              </div>
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs">
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </div>
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-black transition-colors text-left"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  Profil Saya
                </button>
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors text-left border-t border-gray-100"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-5 md:p-8 w-full">
        {/* Lookup Page */}
        {activeTab === 'lookup' && (
          <div className="space-y-6">
            {/* Search form */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h1 className="text-xl font-bold text-gray-900 mb-1">WHOIS Domain Lookup</h1>
              <p className="text-sm text-gray-500 mb-4">Enter a domain name to check its registration details</p>
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="example.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-shadow font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !query.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searching ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Search
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Error */}
            {lookupError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Lookup failed</p>
                  <p className="text-sm text-red-600 mt-0.5">{lookupError}</p>
                </div>
                <button onClick={() => setLookupError(null)} className="ml-auto text-red-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Result */}
            {result && (
              <WhoisCard
                result={result}
                isSaved={isSaved}
                onSave={handleSave}
                onRemove={() => savedEntry && handleRemove(savedEntry.id)}
                onRefresh={() => handleSearch(undefined, result.domain)}
                saving={saving}
                refreshing={searching}
              />
            )}

            {/* Empty state */}
            {!result && !lookupError && !searching && (
              <div className="text-center py-16 text-gray-400">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-gray-500">Enter a domain name above to see its WHOIS information</p>
                <p className="text-xs text-gray-400 mt-1">Supports .com, .net, .org, .io, .co and many more TLDs</p>
              </div>
            )}
          </div>
        )}

        {/* My Domains Page */}
        {activeTab === 'saved' && (() => {
          // Extract unique registrars from saved list
          const registrars = ['all', ...Array.from(new Set(savedDomains.map(d => d.registrar).filter(Boolean)))];

          // Filter by search & registrar selection
          const filtered = savedDomains.filter(d => {
            const matchesSearch = d.domain.toLowerCase().includes(savedSearch.toLowerCase());
            const matchesRegistrar = selectedRegistrar === 'all' || d.registrar === selectedRegistrar;
            return matchesSearch && matchesRegistrar;
          });

          // Pagination calculations
          const itemsPerPage = savedItemsPerPage;
          const totalPages = Math.ceil(filtered.length / itemsPerPage);
          const validPage = Math.max(1, Math.min(savedCurrentPage, totalPages || 1));
          const startIndex = (validPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const paginated = filtered.slice(startIndex, endIndex);

          return (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900 mb-1">My Domains</h1>
                <p className="text-sm text-gray-500">Manage and track your saved domain registration details</p>
              </div>

              {loadingSaved ? (
                <div className="flex items-center justify-center py-16">
                  <svg className="animate-spin w-6 h-6 text-gray-800" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              ) : savedDomains.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <Bookmark className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">No saved domains yet</p>
                  <p className="text-xs text-gray-400 mt-1">Search for a domain and click "Save" to add it here</p>
                  <button
                    onClick={() => navigate('/')}
                    className="mt-4 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Start searching
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
                  {/* Left Side: Table & Controls */}
                  <div className={`w-full min-w-0 space-y-4 ${selectedSavedDomain ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
                    {/* Search and Filters Bar */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
                      {/* Live Search */}
                      <div className="relative w-full sm:w-64 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={savedSearch}
                          onChange={(e) => { setSavedSearch(e.target.value); setSavedCurrentPage(1); }}
                          placeholder="Search domains..."
                          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
                        />
                        {savedSearch && (
                          <button
                            onClick={() => { setSavedSearch(''); setSavedCurrentPage(1); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Registrar Filter */}
                      <div className="flex items-center gap-1.5 w-full sm:w-auto sm:ml-auto shrink-0">
                        <span className="text-[10px] uppercase font-bold text-gray-400 whitespace-nowrap">Filter:</span>
                        <select
                          value={selectedRegistrar}
                          onChange={(e) => { setSelectedRegistrar(e.target.value); setSavedCurrentPage(1); }}
                          className="bg-white border border-gray-200 rounded-lg text-xs font-semibold px-2 py-2 focus:outline-none focus:ring-1 focus:ring-black text-gray-700 w-full sm:w-48"
                        >
                          <option value="all">All Registrars ({savedDomains.length})</option>
                          {registrars.filter(r => r !== 'all').map(r => (
                            <option key={r ?? ''} value={r ?? ''}>{r}</option>
                          ))}
                        </select>
                      </div>

                      {/* Bulk Sync WHOIS Button */}
                      <button
                        onClick={syncingAll ? handleStopSyncAll : () => handleSyncAll(filtered)}
                        disabled={loadingSaved || filtered.length === 0}
                        className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 border rounded-lg text-xs font-bold transition-all shrink-0 ${
                          syncingAll
                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                            : 'bg-black text-white hover:bg-gray-800 disabled:opacity-50'
                        }`}
                      >
                        {syncingAll ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Stop Sync ({syncProgress} / {filtered.length})
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Sync All ({filtered.length})
                          </>
                        )}
                      </button>
                    </div>

                    {/* Compact Table */}
                    {filtered.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-sm font-medium text-gray-500">No domains match your filters</p>
                        <button
                          onClick={() => { setSavedSearch(''); setSelectedRegistrar('all'); setSavedCurrentPage(1); }}
                          className="mt-3 px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-lg transition-colors"
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Registrar</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Expiry</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {paginated.map((sd, i) => {
                                const status = getExpiryStatus(sd.expiry_date);
                                const isSelected = selectedSavedDomain?.id === sd.id;
                                return (
                                  <tr 
                                    key={sd.id} 
                                    className={`transition-colors ${status.rowClass} ${
                                      isSelected ? 'ring-1 ring-inset ring-black font-semibold' : ''
                                    }`}
                                  >
                                    <td className="px-4 py-3 text-xs text-gray-400">
                                      {startIndex + i + 1}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-800 font-medium">
                                      {sd.domain}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell max-w-[150px] truncate">
                                      {sd.registrar || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs hidden md:table-cell">
                                      <div className="flex items-center gap-2">
                                        <span>{sd.expiry_date ? formatDate(sd.expiry_date) : '—'}</span>
                                        {status.badge && (
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                                            status.badge === 'Sudah Expired' 
                                              ? 'bg-red-100 text-red-800 border border-red-200' 
                                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                                          }`}>
                                            {status.badge}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => handleSyncSaved(sd)}
                                          disabled={syncingId === sd.id || deleteId === sd.id}
                                          className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                          title="Update WHOIS"
                                        >
                                          <RefreshCw className={`w-3.5 h-3.5 ${syncingId === sd.id ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (sd.whois_data) {
                                              setSelectedSavedDomain(sd);
                                            }
                                          }}
                                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                                            selectedSavedDomain?.id === sd.id
                                              ? 'bg-black text-white'
                                              : 'text-gray-700 bg-gray-100 hover:bg-black hover:text-white'
                                          }`}
                                        >
                                          View
                                        </button>
                                        <button
                                          onClick={async () => {
                                            await handleRemove(sd.id);
                                            if (selectedSavedDomain?.id === sd.id) {
                                              setSelectedSavedDomain(null);
                                            }
                                          }}
                                          disabled={deleteId === sd.id}
                                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
                          {paginated.map((sd) => {
                            const status = getExpiryStatus(sd.expiry_date);
                            return (
                              <div 
                                key={sd.id} 
                                className={`rounded-xl p-4 shadow-sm space-y-3 border transition-colors ${status.cardClass}`}
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <div className="font-mono text-sm font-bold text-gray-900">{sd.domain}</div>
                                      {status.badge && (
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0 ${
                                          status.badge === 'Sudah Expired' 
                                            ? 'bg-red-100 text-red-800 border border-red-200' 
                                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                                        }`}>
                                          {status.badge}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">Registrar: {sd.registrar || '—'}</div>
                                  </div>
                                  {sd.expiry_date && (
                                    <div className="text-right">
                                      <div className="text-[10px] uppercase font-bold text-gray-400">Expires</div>
                                      <div className={`text-xs font-semibold ${status.textClass}`}>{formatDate(sd.expiry_date)}</div>
                                    </div>
                                  )}
                                </div>
                              
                                <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 gap-2">
                                  <button
                                    onClick={() => {
                                      if (sd.whois_data) {
                                        setSelectedSavedDomain(sd);
                                        setIsMobileWhoisOpen(true);
                                      }
                                    }}
                                    className="flex-1 py-1.5 text-xs font-bold bg-gray-100 hover:bg-black hover:text-white rounded-lg text-gray-700 transition-colors text-center"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => handleSyncSaved(sd)}
                                    disabled={syncingId === sd.id || deleteId === sd.id}
                                    className="flex-1 py-1.5 text-xs font-bold border border-gray-200 hover:bg-black hover:text-white rounded-lg text-gray-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                  >
                                    <RefreshCw className={`w-3 h-3 ${syncingId === sd.id ? 'animate-spin' : ''}`} />
                                    Sync
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await handleRemove(sd.id);
                                      if (selectedSavedDomain?.id === sd.id) {
                                        setSelectedSavedDomain(null);
                                      }
                                    }}
                                    disabled={deleteId === sd.id}
                                    className="flex-1 py-1.5 text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                  </button>
                                </div>
                            </div>
                            );
                          })}
                        </div>

                        {/* Pagination & Limit Footer Controls */}
                        {filtered.length > 0 && (
                          <div className="bg-gray-50 px-5 py-3 flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-gray-100">
                            {/* Left Side: Entry info & Limit Selector */}
                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                              <span className="text-xs text-gray-500 font-medium text-center sm:text-left">
                                Showing <span className="font-semibold text-gray-800">{startIndex + 1}</span> to <span className="font-semibold text-gray-800">{Math.min(endIndex, filtered.length)}</span> of <span className="font-semibold text-gray-800">{filtered.length}</span> entries
                              </span>
                              
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-gray-400">Show:</span>
                                <select
                                  value={savedItemsPerPage}
                                  onChange={(e) => {
                                    setSavedItemsPerPage(Number(e.target.value));
                                    setSavedCurrentPage(1);
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

                            {/* Right Side: Page buttons */}
                            {totalPages > 1 && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => setSavedCurrentPage(p => Math.max(1, p - 1))}
                                  disabled={validPage === 1}
                                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                                  title="Previous Page"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                
                                {(() => {
                                  const buttons = [];
                                  const maxVisible = 5;
                                  let start = Math.max(1, validPage - 2);
                                  const end = Math.min(totalPages, start + maxVisible - 1);
                                  if (end - start + 1 < maxVisible) {
                                    start = Math.max(1, end - maxVisible + 1);
                                  }
                                  for (let p = start; p <= end; p++) {
                                    buttons.push(
                                      <button
                                        key={p}
                                        onClick={() => setSavedCurrentPage(p)}
                                        className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                                          validPage === p
                                            ? 'bg-black text-white shadow-sm'
                                            : 'border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white'
                                        }`}
                                      >
                                        {p}
                                      </button>
                                    );
                                  }
                                  return buttons;
                                })()}

                                <button
                                  onClick={() => setSavedCurrentPage(p => Math.min(totalPages, p + 1))}
                                  disabled={validPage === totalPages}
                                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                                  title="Next Page"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Side: WHOIS Card Panel (only if a domain is selected) */}
                  {selectedSavedDomain && (
                    <div className="w-full lg:col-span-5 space-y-4 lg:sticky lg:top-8">
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Custom Header for the Sidebar Panel */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-gray-700" />
                            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">WHOIS Detail</h2>
                          </div>
                          <button
                            onClick={() => setSelectedSavedDomain(null)}
                            className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* WHOIS Card Content */}
                        <WhoisCard
                          result={selectedSavedDomain.whois_data!}
                          isSaved={true}
                          onSave={() => {}}
                          onRemove={async () => {
                            await handleRemove(selectedSavedDomain.id);
                            setSelectedSavedDomain(null);
                          }}
                          onRefresh={() => handleSyncSaved(selectedSavedDomain)}
                          saving={deleteId === selectedSavedDomain.id}
                          refreshing={syncingSaved}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-3xl border border-gray-200/60 shadow-sm">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Memuat Halaman...</span>
          </div>
        }>
          {activeTab === 'dashboard' && (
            <DashboardPage 
              savedDomains={savedDomains} 
              servers={servers}
              onNavigateToTab={navigate}
              onSelectDomain={(domain) => {
                setSelectedSavedDomain(domain);
                navigate('/my-domains');
                setIsMobileWhoisOpen(true);
              }}
              sessionToken={session?.token}
              userName={user?.name || user?.email.split('@')[0]}
            />
          )}

          {/* Bulk Lookup Page */}
          {activeTab === 'bulk' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900 mb-1">Bulk WHOIS Lookup</h1>
                <p className="text-sm text-gray-500">Upload a CSV or Excel file with domain names to check multiple domains at once (max 100)</p>
              </div>
              <BulkWhoisPage />
            </div>
          )}

          {/* Server Management Page */}
          {activeTab === 'servers' && (
            <ServerManagementPage />
          )}

          {/* User Settings/Management Page (Admins only) */}
          {activeTab === 'users' && user?.role === 'admin' && (
            <UserManagementPage />
          )}

          {/* System Settings Page (Admins only) */}
          {activeTab === 'settings' && user?.role === 'admin' && (
            <SettingsPage />
          )}

          {/* Admin User Activity Page */}
          {activeTab === 'activity' && user?.role === 'admin' && (
            <UserActivityPage />
          )}

          {/* My Activity & Profile Page */}
          {activeTab === 'my-activity' && (
            <MyActivityPage />
          )}

          {/* Profile Page */}
          {activeTab === 'profile' && (
            <ProfilePage />
          )}
        </Suspense>
      </main>
      </div>

      {/* Mobile WHOIS Modal */}
      {isMobileWhoisOpen && selectedSavedDomain && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in md:hidden">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-700" />
                <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">WHOIS Detail</h2>
              </div>
              <button
                onClick={() => { setIsMobileWhoisOpen(false); setSelectedSavedDomain(null); }}
                className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <WhoisCard
                result={selectedSavedDomain.whois_data!}
                isSaved={true}
                onSave={() => {}}
                onRemove={async () => {
                  await handleRemove(selectedSavedDomain.id);
                  setSelectedSavedDomain(null);
                  setIsMobileWhoisOpen(false);
                }}
                onRefresh={() => handleSyncSaved(selectedSavedDomain)}
                saving={deleteId === selectedSavedDomain.id}
                refreshing={syncingSaved}
              />
            </div>
          </div>
        </div>
      )}
    </div>

      {/* ── Idle Warning Modal ─────────────────────────────────────────── */}
      {idleWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-sm w-full p-8 text-center animate-fade-in">
            <div className="w-14 h-14 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Clock className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Sesi Hampir Berakhir</h2>
            <p className="text-sm text-gray-500 mb-6">
              Anda tidak aktif selama beberapa waktu. Sesi akan otomatis berakhir dalam <strong className="text-gray-800">2 menit</strong> jika tidak ada aktivitas.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={resetIdleTimer}
                className="w-full py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors"
              >
                Tetap Masuk
              </button>
              <button
                onClick={signOut}
                className="w-full py-2.5 border border-gray-200 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Keluar Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
