import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { EndingPanel } from './EndingPanel';
import { GameStage } from './GameStage';
import { SceneTransitionOverlay } from './SceneTransitionOverlay';

export function PlayerPanel({ me, externalSessionId }) {
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [lastResolution, setLastResolution] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (externalSessionId) setSessionId(externalSessionId);
  }, [externalSessionId]);

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
    onSuccess: (session) => setSessionId(session._id)
  });

  const actionMutation = useMutation({
    mutationFn: async () => (await api.post(`/sessions/${sessionId}/act`, { userInput: input, tone: 'cinematic' })).data,
    onSuccess: (data) => {
      setInput('');
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
  const transition = session?.visualState?.transition || lastResolution?.type || '';

  return (
    <section className="card">
      <h2>Player Journey</h2>
      <p className="muted">Signed in as: {me?.email || 'guest'} ({me?.role || 'n/a'})</p>

      <div className="list">
        {(publicGames.data || []).map((gameItem) => (
          <div key={gameItem._id} className="listItem">
            <div>
              <strong>{gameItem.title}</strong>
              <p className="muted">target: {gameItem.constraints.targetPoints} | turns: {gameItem.constraints.maxTurns}</p>
            </div>
            <button onClick={() => startMutation.mutate(gameItem._id)} disabled={!me || startMutation.isPending}>
              Start
            </button>
          </div>
        ))}
      </div>

      {session ? (
        <>
          <div className="hud">
            <span>Points: {session.stats.points}</span>
            <span>Turns: {session.stats.turnsUsed}/{game.constraints.maxTurns}</span>
            <span>Status: {session.status}</span>
            <span>Points To Target: {pointsToTarget}</span>
            <span>Turns Remaining: {turnsRemaining}</span>
            <span>{session.isPlaytest ? 'Playtest Session' : 'Published Session'}</span>
          </div>

          <div className="scene animatedScene">
            <h3>{scene?.sceneId}</h3>
            <p>{scene?.narrative}</p>
            <GameStage scene={scene} visualState={session.visualState} />
            <SceneTransitionOverlay transition={transition} />
          </div>

          {lastResolution ? (
            <div className={`resolutionBadge ${lastResolution.type || 'avenue'}`}>
              <strong>Route: {lastResolution.type || 'avenue'}</strong>
              <span> confidence {Number(lastResolution.confidence || 0).toFixed(2)}</span>
              {lastResolution.wildcardMode ? <span> | {lastResolution.wildcardMode}</span> : null}
              <p>{lastResolution.explanation}</p>
            </div>
          ) : null}

          <div className="chips">
            {(scene?.avenues || []).map((avenue) => (
              <button key={avenue.avenueId} onClick={() => setInput(avenue.label)} className="chipBtn">
                {avenue.label}
              </button>
            ))}
          </div>

          <div className="row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your action"
              disabled={session.status !== 'active'}
            />
            <button onClick={() => actionMutation.mutate()} disabled={!input || actionMutation.isPending || session.status !== 'active'}>
              {actionMutation.isPending ? 'Resolving...' : 'Send'}
            </button>
          </div>

          <div className="history">
            {(historyQuery.data || []).slice().reverse().map((item) => (
              <div key={`${item.turn}-${item.sceneId}-${item.userQuery}`} className="historyItem">
                <strong>Turn {item.turn}</strong>
                <p>{item.userQuery}</p>
                <p>{item.narration}</p>
                <p className="muted">{item.resolvedAvenueId || 'wildcard/clarification'} | Δ {item.pointsDelta}</p>
              </div>
            ))}
          </div>
          <EndingPanel session={session} game={game} />
        </>
      ) : null}
    </section>
  );
}
