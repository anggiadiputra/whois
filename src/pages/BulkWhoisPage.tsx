import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Download, Trash2, CheckCircle, XCircle, Loader2, AlertCircle, Save } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';

const API_URL = '/api';

type BulkStatus = 'idle' | 'parsing' | 'running' | 'done';

type DomainResult = {
  domain: string;
  status: 'pending' | 'success' | 'error';
  registrar?: string;
  createdDate?: string;
  expiryDate?: string;
  error?: string;
  data?: any;
  saving?: boolean;
  saved?: boolean;
};

function getRootDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  const doubleTlds = new Set([
    'com.id', 'net.id', 'co.id', 'web.id', 'sch.id', 'or.id', 'go.id', 'ac.id', 'my.id',
    'co.uk', 'me.uk', 'org.uk', 'ltd.uk', 'plc.uk',
    'com.au', 'net.au', 'org.au',
    'com.sg', 'net.sg', 'org.sg',
    'com.my', 'net.my', 'org.my',
    'co.jp', 'org.jp', 'ad.jp', 'ne.jp',
    'com.br', 'net.br', 'org.br'
  ]);
  const lastTwo = parts.slice(-2).join('.');
  if (doubleTlds.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function parseDomains(raw: string[]): string[] {
  const cleaned: string[] = [];
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  for (const r of raw) {
    const trimmed = r.trim().toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0];
    if (trimmed && domainRegex.test(trimmed)) {
      cleaned.push(getRootDomain(trimmed));
    }
  }
  return [...new Set(cleaned)];
}

export default function BulkWhoisPage() {
  const { session } = useAuth();
  const [domains, setDomains] = useState<DomainResult[]>([]);
  const [bulkStatus, setBulkStatus] = useState<BulkStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(3); // default 3s delay (Safe & Optimal)
  const [autoSave, setAutoSave] = useState(true); // auto-save successful queries to history
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const processFile = useCallback((file: File) => {
    setParseError(null);
    setBulkStatus('parsing');

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: (result) => {
          const raw = result.data.flat().map(String);
          const parsed = parseDomains(raw);
          if (parsed.length === 0) {
            setParseError('No valid domains found in file.');
            setBulkStatus('idle');
            return;
          }
          setDomains(parsed.map(d => ({ domain: d, status: 'pending' })));
          setBulkStatus('idle');
        },
        error: () => {
          setParseError('Failed to parse CSV file.');
          setBulkStatus('idle');
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const raw = rows.flat().map(String);
          const parsed = parseDomains(raw);
          if (parsed.length === 0) {
            setParseError('No valid domains found in file.');
            setBulkStatus('idle');
            return;
          }
          setDomains(parsed.map(d => ({ domain: d, status: 'pending' })));
          setBulkStatus('idle');
        } catch {
          setParseError('Failed to parse Excel file.');
          setBulkStatus('idle');
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setParseError('Unsupported file type. Please upload .csv, .txt, .xlsx, or .xls');
      setBulkStatus('idle');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const startBulkLookup = async () => {
    if (domains.length === 0) return;
    abortRef.current = false;
    setBulkStatus('running');
    setProgress(0);

    const token = session?.token;
    let done = 0;

    // Reset all to pending
    setDomains(prev => prev.map(d => ({ ...d, status: 'pending', error: undefined, data: undefined, saved: false })));

    for (let i = 0; i < domains.length; i++) {
      if (abortRef.current) break;
      const currentDomain = domains[i].domain;

      try {
        const res = await fetch(`${API_URL}/whois-lookup?domain=${encodeURIComponent(currentDomain)}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          }
        });
        const data = await res.json();

        if (res.ok) {
          setDomains(prev => prev.map((d, idx) => idx === i ? {
            ...d,
            status: 'success',
            registrar: data.registrar,
            createdDate: data.createdDate,
            expiryDate: data.expiryDate,
            data: data
          } : d));

          if (autoSave) {
            try {
              const saveRes = await fetch(`${API_URL}/saved-domains`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
                body: JSON.stringify({
                  domain: data.domain,
                  whois_data: data,
                  registrar: data.registrar,
                  expiry_date: data.expiryDate,
                }),
              });
              if (saveRes.ok) {
                setDomains(prev => prev.map((d, idx) => idx === i ? { ...d, saved: true } : d));
              }
            } catch (err) {
              console.error('Auto-save failed:', err);
            }
          }
        } else {
          setDomains(prev => prev.map((d, idx) => idx === i ? {
            ...d,
            status: 'error',
            error: data.error || 'Query failed'
          } : d));
        }
      } catch (err) {
        setDomains(prev => prev.map((d, idx) => idx === i ? {
          ...d,
          status: 'error',
          error: err instanceof Error ? err.message : 'Network error'
        } : d));
      }

      done++;
      setProgress(Math.round((done / domains.length) * 100));

      // Introduce delay between requests if not aborted and not the last item
      if (i < domains.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    setBulkStatus('done');
  };

  const handleSaveOne = async (idx: number) => {
    const entry = domains[idx];
    if (!entry.data || entry.saved) return;
    const token = session?.token;

    setDomains(prev => prev.map((d, i) => i === idx ? { ...d, saving: true } : d));
    try {
      const res = await fetch(`${API_URL}/saved-domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({
          domain: entry.domain,
          whois_data: entry.data,
          registrar: entry.registrar,
          expiry_date: entry.expiryDate,
        }),
      });
      setDomains(prev => prev.map((d, i) => i === idx ? { ...d, saving: false, saved: res.ok } : d));
    } catch {
      setDomains(prev => prev.map((d, i) => i === idx ? { ...d, saving: false } : d));
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    const token = session?.token;
    const successful = domains.filter(d => d.status === 'success' && !d.saved && d.data);

    for (const entry of successful) {
      try {
        await fetch(`${API_URL}/saved-domains`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
          body: JSON.stringify({
            domain: entry.domain,
            whois_data: entry.data,
            registrar: entry.registrar,
            expiry_date: entry.expiryDate,
          }),
        });
        setDomains(prev => prev.map(d => d.domain === entry.domain ? { ...d, saved: true } : d));
      } catch { /* ignore individual failures */ }
    }
    setSavingAll(false);
  };

  const handleExportCSV = () => {
    const rows = [['Domain', 'Status', 'Registrar', 'Created', 'Expires', 'Error']];
    for (const d of domains) {
      rows.push([d.domain, d.status, d.registrar || '', d.createdDate || '', d.expiryDate || '', d.error || '']);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bulk-whois-results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const successCount = domains.filter(d => d.status === 'success').length;
  const errorCount = domains.filter(d => d.status === 'error').length;
  const pendingCount = domains.filter(d => d.status === 'pending').length;
  const unsavedSuccess = domains.filter(d => d.status === 'success' && !d.saved).length;

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {domains.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all ${
            dragOver
              ? 'border-gray-800 bg-gray-50'
              : 'border-gray-300 hover:border-gray-500 hover:bg-gray-50'
          }`}
        >
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
            <Upload className="w-6 h-6 text-gray-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">Drop your file here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports .csv, .txt, .xlsx, .xls — max 100 domains</p>
          </div>
          {bulkStatus === 'parsing' && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Parsing file…
            </div>
          )}
        </div>
      ) : (
        /* Controls bar */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-800">{domains.length} domains loaded</span>
            <div className="flex items-center gap-3 text-xs">
              {successCount > 0 && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3.5 h-3.5" />{successCount} ok</span>}
              {errorCount > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3.5 h-3.5" />{errorCount} failed</span>}
              {pendingCount > 0 && <span className="text-gray-400">{pendingCount} pending</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setDomains([]); setBulkStatus('idle'); setProgress(0); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Load new file
            </button>
            {bulkStatus === 'done' && successCount > 0 && (
              <>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
                {unsavedSuccess > 0 && (
                  <button
                    onClick={handleSaveAll}
                    disabled={savingAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save all ({unsavedSuccess})
                  </button>
                )}
              </>
            )}
            {bulkStatus !== 'running' && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 mr-1.5">Speed:</span>
                  <select
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Number(e.target.value))}
                    className="bg-white border border-gray-200 rounded-lg text-xs font-semibold px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-black mr-2 text-gray-700"
                  >
                    <option value={3}>Safe & Optimal (3s delay)</option>
                    <option value={10}>Conservative (10s delay)</option>
                    <option value={1}>Fast (1s delay)</option>
                    <option value={0.2}>Instant (0.2s delay)</option>
                  </select>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer mr-2 select-none">
                  <input
                    type="checkbox"
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                    className="rounded border-gray-300 text-black focus:ring-black w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-600 font-semibold">Auto-save history</span>
                </label>
              </>
            )}
            {bulkStatus !== 'running' && (
              <button
                onClick={startBulkLookup}
                disabled={domains.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {bulkStatus === 'done' ? 'Re-run Lookup' : 'Start Lookup'}
              </button>
            )}
            {bulkStatus === 'running' && (
              <button
                onClick={() => { abortRef.current = true; }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      )}

      {parseError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {parseError}
        </div>
      )}

      {/* Progress bar */}
      {bulkStatus === 'running' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span className="font-medium">Running WHOIS lookups…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results table */}
      {domains.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Registrar</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Expires</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {domains.map((d, i) => (
                  <tr key={d.domain} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800 font-medium">{d.domain}</td>
                    <td className="px-4 py-3">
                      {d.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          {bulkStatus === 'running'
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />}
                          Pending
                        </span>
                      )}
                      {d.status === 'success' && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      )}
                      {d.status === 'error' && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500" title={d.error}>
                          <XCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell max-w-[180px] truncate">
                      {d.registrar || (d.status === 'pending' ? '—' : d.status === 'error' ? <span className="text-red-400 text-xs">{d.error?.slice(0, 40)}</span> : '—')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                      {d.expiryDate ? new Date(d.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.status === 'success' && (
                        <button
                          onClick={() => handleSaveOne(i)}
                          disabled={d.saving || d.saved}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            d.saved
                              ? 'bg-green-50 text-green-600 border border-green-100 cursor-default'
                              : 'bg-gray-100 text-gray-700 hover:bg-black hover:text-white'
                          } disabled:opacity-60`}
                        >
                          {d.saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          {d.saved ? 'Saved' : 'Save'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
