import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { EndingPanel } from './EndingPanel';
import { WizardBubble } from './WizardBubble';

function sanitizeClientInput(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 500);
}

/**
 * @param {{ me: { id?: string, email?: string, role?: string } | null, externalSessionId?: string }} props
 */
export function PlayerPanel({ me, externalSessionId }) {
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [lastResolution, setLastResolution] = useState(null);
  const [showGameMenu, setShowGameMenu] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (externalSessionId) {
      setSessionId(externalSessionId);
      setShowGameMenu(false);
    }
  }, [externalSessionId]);

  useEffect(() => {
    if (sessionId) {
      setShowGameMenu(false);
    } else {
      setShowGameMenu(true);
    }
  }, [sessionId]);

  const publicGames = useQuery({
    queryKey: ['public-games'],
    queryFn: async () => (await api.get('/games/public')).data.games
  });

  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => (await api.get(`/sessions/${sessionId}`)).data,
    enabled: !!sessionId
  });

  const historyQuery = useQuery({
    queryKey: ['session-history', sessionId],
    queryFn: async () => (await api.get(`/sessions/${sessionId}/history`)).data.history,
    enabled: !!sessionId
  });

  const startMutation = useMutation({
    mutationFn: async (gameId) => (await api.post('/sessions/start', { gameId })).data.session,
    onSuccess: (session) => {
      setSessionId(session._id);
      setShowGameMenu(false);
    }
  });

  const actionMutation = useMutation({
    mutationFn: async (userInputOverride) => {
      const inputToUse = userInputOverride !== undefined ? userInputOverride : input;
      return (await api.post('/sessions/action', {
        sessionId,
        userInput: sanitizeClientInput(inputToUse),
        tone: 'cinematic'
      })).data;
    },
    onSuccess: (data) => {
      setInput('');
      setIsTyping(false);
      setLastResolution(data.resolution);
      queryClient.setQueryData(['session', sessionId], (old) => ({
        ...(old || {}),
        session: data.session,
        currentScene: data.currentScene || old?.currentScene,
        game: old?.game
      }));
      queryClient.invalidateQueries({ queryKey: ['session-history', sessionId] });
    }
  });

  const scene = sessionQuery.data?.currentScene;
  const session = sessionQuery.data?.session;
  const game = sessionQuery.data?.game;
  const turnsRemaining = game ? Math.max(0, game.constraints.maxTurns - (session?.stats?.turnsUsed || 0)) : 0;
  const pointsToTarget = game ? Math.max(0, game.constraints.targetPoints - (session?.stats?.points || 0)) : 0;
  const invalidLimit = scene?.inputPolicy?.invalidAttemptLimit || 3;
  const invalidRemaining = lastResolution?.invalidAttemptsRemaining ?? invalidLimit;

  if (publicGames.isLoading) {
    return (
      <section className="card" aria-busy="true">
        <h2>Player Journey</h2>
        <p className="muted">Loading available games...</p>
      </section>
    );
  }

  if (publicGames.error) {
    return (
      <section className="card">
        <h2>Player Journey</h2>
        <p className="error" role="alert">{publicGames.error.response?.data?.error?.message || 'Failed to load games.'}</p>
      </section>
    );
  }

  // Game Menu View
  if (showGameMenu) {
    return (
      <section className="card gameMenu" aria-live="polite">
        <h2>Choose Your Adventure</h2>
        <p className="muted">Signed in as: {me?.email || 'guest'} ({me?.role || 'n/a'})</p>

        <div className="list gameList">
          {(publicGames.data || []).map((gameItem) => (
            <div key={gameItem._id} className="listItem gameListItem">
              <div className="gameInfo">
                <strong>{gameItem.title}</strong>
                <p className="muted">{gameItem.description || 'A mysterious adventure awaits...'}</p>
                <p className="muted">target: {gameItem.constraints.targetPoints} | turns: {gameItem.constraints.maxTurns}</p>
              </div>
              <button
                type="button"
                onClick={() => startMutation.mutate(gameItem._id)}
                disabled={!me || startMutation.isPending}
              >
                {startMutation.isPending ? 'Starting...' : 'Start'}
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Playthrough View
  return (
    <section className="card playthroughView" aria-live="polite">
      {/* Top HUD - Always Visible */}
      <div className="topHud">
        <button
          type="button"
          onClick={() => {
            setSessionId('');
            setShowGameMenu(true);
            setLastResolution(null);
          }}
          className="backButton"
        >
          ← Back to Games
        </button>
        <div className="hudStats">
          <span>Points: {session?.stats?.points || 0}</span>
          <span>Turn: {session?.stats?.turnsUsed || 0}/{game?.constraints?.maxTurns || 0}</span>
          <span className={`statusBadge ${session?.status}`}>{session?.status || 'active'}</span>
        </div>
      </div>

      {sessionId && sessionQuery.isLoading ? (
        <p className="muted">Loading adventure...</p>
      ) : null}

      {sessionId && sessionQuery.error ? (
        <p className="error">Unable to load this session.</p>
      ) : null}

      {session && scene ? (
        <>
          {/* Main Game Area */}
          <div className="gameArea">
            {/* Wizard Bubble with Dialogue */}
            <WizardBubble narrative={scene.narrative} lastResolution={lastResolution} />

            {/* Action Options */}
            {session.status === 'active' && (
              <>
                <div className="chips">
                  {(scene.avenues || []).map((avenue) => (
                    <button
                      type="button"
                      key={avenue.avenueId}
                      onClick={() => {
                        setIsTyping(false);
                        setInput('');
                        actionMutation.mutate(`[SELECT:${avenue.avenueId}] ${avenue.label}`);
                      }}
                      className="chipBtn"
                      disabled={actionMutation.isPending}
                    >
                      {avenue.label}
                    </button>
                  ))}
                </div>

                <div className="actionInput">
                  <label htmlFor="player-action" className="srOnly">Describe your action</label>
                  <input
                    id="player-action"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setIsTyping(e.target.value.length > 0);
                    }}
                    placeholder={isTyping ? "Describe your action..." : "Click an option above or type your own action..."}
                    aria-label="Describe your action"
                    disabled={session.status !== 'active' || actionMutation.isPending || !isTyping}
                  />
                  <button
                    type="button"
                    onClick={() => actionMutation.mutate()}
                    disabled={!input.trim() || actionMutation.isPending || session.status !== 'active' || !isTyping}
                  >
                    {actionMutation.isPending ? '⏳' : 'Send'}
                  </button>
                </div>

                {me?.role === 'admin' && (
                  <p className="muted">
                    Freeform attempts remaining: {invalidRemaining}. Turns left: {turnsRemaining}. Points to target: {pointsToTarget}.
                  </p>
                )}

                {lastResolution?.type === 'invalid' ? (
                  <p className="error" role="alert">
                    {lastResolution.narration} Attempts remaining: {lastResolution.invalidAttemptsRemaining}.
                  </p>
                ) : null}

                {actionMutation.error ? (
                  <p className="error" role="alert">
                    {actionMutation.error.response?.data?.error?.message || 'Action failed. Please retry.'}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {/* Ending Panel */}
          <EndingPanel session={session} game={game} history={historyQuery.data || []} />
        </>
      ) : null}
    </section>
  );
}
