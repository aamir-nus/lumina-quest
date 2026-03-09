import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { AuthPanel } from './components/AuthPanel';
import { AdminPanel } from './components/AdminPanel';
import { PlayerPanel } from './components/PlayerPanel';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [playtestSessionId, setPlaytestSessionId] = useState('');

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
  };

  return (
    <main>
      <header>
        <h1>LuminaQuest Iteration 2 Hardening</h1>
        {me ? <button onClick={logout}>Logout</button> : null}
      </header>
      <div className="grid">
        <AuthPanel onAuth={onAuth} />
        <AdminPanel me={me} onPlaytestSession={setPlaytestSessionId} />
        <PlayerPanel me={me} externalSessionId={playtestSessionId} />
      </div>
    </main>
  );
}
