import { lazy, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import WhoisPage from './pages/WhoisPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';

const PublicWhoisPage = lazy(() => import('./pages/PublicWhoisPage'));

export default function App() {
  const { session, loading } = useAuth();

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

  const isAcceptInvite = window.location.pathname === '/accept-invitation';
  if (isAcceptInvite) {
    return <AcceptInvitationPage />;
  }

  const isPublicWhois = window.location.pathname === '/whois';
  if (isPublicWhois) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <svg className="animate-spin w-8 h-8 text-gray-700" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      }>
        <PublicWhoisPage />
      </Suspense>
    );
  }

  return session ? <WhoisPage /> : <LoginPage />;
}
