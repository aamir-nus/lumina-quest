import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { AuthPanel } from './components/AuthPanel';
import { AdminPanel } from './components/AdminPanel';
import { PlayerPanel } from './components/PlayerPanel';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [playtestSessionId, setPlaytestSessionId] = useState('');
  const [adminTab, setAdminTab] = useState('player-forge'); // 'player-forge' | 'user-journey'

  const me = useMemo(() => auth?.user || null, [auth]);

  useEffect(() => {
    let active = true;
    api.get('/auth/me')
      .then((res) => {
        if (active) setAuth({ user: res.data.user });
      })
      .catch(() => {
        if (active) setAuth(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const onAuth = (nextAuth) => {
    setAuth({ user: nextAuth.user });
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    setAuth(null);
    setAdminTab('player-forge');
  };

  // Not authenticated - show login screen
  if (!me) {
    return (
      <main className="login-screen">
        <header className="logo-header">
          <h1 className="pixel-title">
            <span className="pixel-char" data-hover-delay="0">L</span>
            <span className="pixel-char" data-hover-delay="40">u</span>
            <span className="pixel-char" data-hover-delay="80">m</span>
            <span className="pixel-char" data-hover-delay="120">i</span>
            <span className="pixel-char" data-hover-delay="160">n</span>
            <span className="pixel-char" data-hover-delay="200">a</span>
            <span className="pixel-char spacer" data-hover-delay="0">&nbsp;</span>
            <span className="pixel-char" data-hover-delay="240">Q</span>
            <span className="pixel-char" data-hover-delay="280">u</span>
            <span className="pixel-char" data-hover-delay="320">e</span>
            <span className="pixel-char" data-hover-delay="360">s</span>
            <span className="pixel-char" data-hover-delay="400">t</span>
            <span className="sparkle">✨</span>
            <span className="pixel-beta">[beta]</span>
          </h1>
          <p className="pixel-subtitle">Adventure Awaits</p>
        </header>
        <div className="auth-container">
          <AuthPanel onAuth={onAuth} />
        </div>
      </main>
    );
  }

  // Authenticated user view
  return (
    <main>
      <header>
        <div className="header-left">
          <h1 className="compact-title">LuminaQuest <span className="beta-badge">[beta]</span></h1>
        </div>
        <div className="header-right">
          {me?.role === 'admin' && (
            <div className="admin-tabs">
              <button
                type="button"
                className={adminTab === 'player-forge' ? 'active' : ''}
                onClick={() => setAdminTab('player-forge')}
                aria-pressed={adminTab === 'player-forge'}
              >
                Player Forge
              </button>
              <button
                type="button"
                className={adminTab === 'user-journey' ? 'active' : ''}
                onClick={() => setAdminTab('user-journey')}
                aria-pressed={adminTab === 'user-journey'}
              >
                User Journey
              </button>
            </div>
          )}
          <span className="user-badge">{me.email}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="grid">
        {me?.role === 'admin' ? (
          // Admin view with tabs
          <>
            {adminTab === 'player-forge' && (
              <AdminPanel me={me} onPlaytestSession={setPlaytestSessionId} />
            )}
            {adminTab === 'user-journey' && (
              <PlayerPanel me={me} externalSessionId={playtestSessionId} />
            )}
          </>
        ) : (
          // Regular user view - just player journey
          <PlayerPanel me={me} externalSessionId={playtestSessionId} />
        )}
      </div>
    </main>
  );
}
