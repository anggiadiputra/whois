import { lazy, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import WhoisPage from './pages/WhoisPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';
import { Globe, LogIn } from 'lucide-react';

const PublicWhoisPage = lazy(() => import('./pages/PublicWhoisPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));

function PublicLayout({ children }: { children: React.ReactNode }) {
  const { brandName, brandLogo } = useAuth();
  const currentPath = window.location.pathname;

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      {/* Top Navbar */}
      <header className="w-full bg-white border-b border-gray-200 h-16 sticky top-0 z-10 shrink-0 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
          {/* Brand Info & Menu */}
          <div className="flex items-center gap-8">
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
            {/* Nav Menu */}
            <nav className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold text-gray-400 select-none">
              <a 
                href="/" 
                className={`transition-colors py-1 ${currentPath === '/' ? 'text-gray-900 font-bold border-b-2 border-black pb-0.5' : 'text-gray-500 hover:text-black'}`}
              >
                Beranda
              </a>
              <a 
                href="/whois" 
                className={`transition-colors py-1 ${currentPath === '/whois' ? 'text-gray-900 font-bold border-b-2 border-black pb-0.5' : 'text-gray-500 hover:text-black'}`}
              >
                Whois
              </a>
            </nav>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <a
              href="/login"
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-700 hover:text-black rounded-xl text-xs font-bold transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4 text-gray-400" />
              Login
            </a>
            <a
              href="/register"
              className="px-4 sm:px-4.5 py-2 bg-black hover:bg-gray-900 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();
  const currentPath = window.location.pathname;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-gray-700" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  const isAcceptInvite = currentPath === '/accept-invitation';
  if (isAcceptInvite) {
    return (
      <PublicLayout>
        <AcceptInvitationPage />
      </PublicLayout>
    );
  }

  const isPublicWhois = currentPath === '/whois';
  if (isPublicWhois) {
    return (
      <PublicLayout>
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin w-8 h-8 text-gray-700" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        }>
          <PublicWhoisPage />
        </Suspense>
      </PublicLayout>
    );
  }

  if (session) {
    return <WhoisPage />;
  }

  if (currentPath === '/login') {
    return (
      <PublicLayout>
        <LoginPage initialMode="login" />
      </PublicLayout>
    );
  }

  if (currentPath === '/register') {
    return (
      <PublicLayout>
        <LoginPage initialMode="register" />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <svg className="animate-spin w-8 h-8 text-gray-700" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      }>
        <LandingPage />
      </Suspense>
    </PublicLayout>
  );
}
