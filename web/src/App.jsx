import { useEffect, useMemo, useState } from 'react';
import { setAuthToken } from './api';
import { AuthPanel } from './components/AuthPanel';
import { AdminPanel } from './components/AdminPanel';
import { PlayerPanel } from './components/PlayerPanel';
import { safeStorageGet, safeStorageRemove, safeStorageSet } from './utils/storage';

const AUTH_KEY = 'luminaquest.auth';

export default function App() {
  const [auth, setAuth] = useState(() => safeStorageGet(AUTH_KEY, null));
  const [playtestSessionId, setPlaytestSessionId] = useState('');

  const me = useMemo(() => auth?.user || null, [auth]);

  useEffect(() => {
    setAuthToken(auth?.token || '');
  }, [auth?.token]);

  const onAuth = (nextAuth) => {
    safeStorageSet(AUTH_KEY, nextAuth);
    setAuth(nextAuth);
  };

  const logout = () => {
    safeStorageRemove(AUTH_KEY);
    setAuth(null);
    setAuthToken('');
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
