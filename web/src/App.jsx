import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { AuthPanel } from './components/AuthPanel';
import { AdminPanel } from './components/AdminPanel';
import { PlayerPanel } from './components/PlayerPanel';
import { OnboardingWizard, isOnboardingCompleted, clearOnboardingState, shouldShowAdminOnboarding, markAdminOnboardingShown } from './components/OnboardingWizard';

// Developer helper: allow re-running onboarding from browser console
if (typeof window !== 'undefined') {
  window.luminaQuest = {
    rerunOnboarding: () => {
      clearOnboardingState();
      window.location.reload();
    },
    showOnboarding: () => {
      clearOnboardingState();
      window.location.reload();
    }
  };
  console.log('🎮 LuminaQuest Dev Tools: window.luminaQuest.rerunOnboarding() to re-run setup');
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [playtestSessionId, setPlaytestSessionId] = useState('');
  const [adminTab, setAdminTab] = useState('player-forge'); // 'player-forge' | 'user-journey'
  const [showOnboarding, setShowOnboarding] = useState(!isOnboardingCompleted());
  const [showSettings, setShowSettings] = useState(false);

  const me = useMemo(() => auth?.user || null, [auth]);

  // Stable ref for onboarding completion callback to avoid HMR staleness
  const handleOnboardingCompleteRef = useRef(() => setShowOnboarding(false));
  handleOnboardingCompleteRef.current = () => {
    console.log('[APP] onComplete called, setting showOnboarding to false');
    setShowOnboarding(false);
    console.log('[APP] showOnboarding state updated');
  };

  // Stable ref for admin onboarding completion
  const handleAdminOnboardingCompleteRef = useRef(() => {});
  handleAdminOnboardingCompleteRef.current = () => {
    console.log('[APP] Admin onboarding complete');
    markAdminOnboardingShown();
    setShowOnboarding(false);
  };

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
    // Reset admin onboarding session flag on logout
    try {
      sessionStorage.removeItem('luminaquest_onboarding_shown_this_session');
    } catch {
      // Ignore
    }
  };

  // Show onboarding wizard first (before auth check)
  // This allows LLM setup before any other functionality
  console.log('[APP] Render check: showOnboarding =', showOnboarding);
  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => handleOnboardingCompleteRef.current()} />;
  }

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
          {!isOnboardingCompleted() && (
            <p className="onboarding-hint">
              First time? <button type="button" className="text-link" onClick={() => setShowOnboarding(true)}>Configure your AI settings</button>
            </p>
          )}
          {isOnboardingCompleted() && (
            <p className="onboarding-hint">
              Want to reconfigure AI? <button type="button" className="text-link" onClick={() => { clearOnboardingState(); setShowOnboarding(true); }}>Run onboarding again</button>
            </p>
          )}
        </div>
      </main>
    );
  }

  // Admin users: always show onboarding once per session (for demo purposes)
  if (me?.role === 'admin' && shouldShowAdminOnboarding() && !showOnboarding) {
    return <OnboardingWizard onComplete={() => handleAdminOnboardingCompleteRef.current()} />;
  }

  // Authenticated user view
  return (
    <main>
      {showSettings && (
        <div className="settings-modal" onClick={() => setShowSettings(false)}>
          <div className="settings-content" onClick={(e) => e.stopPropagation()}>
            <h2>LLM Settings</h2>
            <p className="settings-description">
              Configure your AI provider for game authoring and free-form input resolution.
            </p>

            <div className="settings-info">
              <h3>Current Configuration</h3>
              <p><strong>Provider:</strong> {localStorage.getItem('luminaquest_llm_provider') || 'lmstudio'}</p>
              <p><strong>URL:</strong> {localStorage.getItem('luminaquest_llm_url') || 'http://127.0.0.1:1234/v1'}</p>
              <p><strong>Model:</strong> {localStorage.getItem('luminaquest_llm_model') || 'google/gemma-3-4b'}</p>
            </div>

            <div className="settings-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowSettings(false);
                  setShowOnboarding(true);
                }}
              >
                Re-run Onboarding Wizard
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSettings(false)}
              >
                Close
              </button>
            </div>

            <div className="settings-hint">
              <p className="muted">
                💡 Tip: You can also re-run onboarding by opening browser console and typing:
              </p>
              <code>window.luminaQuest.rerunOnboarding()</code>
            </div>
          </div>
        </div>
      )}
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
          <button
            type="button"
            className="settings-button"
            onClick={() => setShowSettings(true)}
            title="LLM Settings"
          >
            ⚙️ Settings
          </button>
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
