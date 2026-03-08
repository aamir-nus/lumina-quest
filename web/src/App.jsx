import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken } from './api';

const starterGame = {
  title: 'The Gate of Emberfall',
  description: 'A compact 3-scene journey to validate the story engine.',
  constraints: { maxTurns: 4, targetPoints: 3 },
  wildcardConfig: {
    enabled: true,
    recoverySceneId: 'scene_square',
    highRewardPoints: 2,
    lowRewardPoints: 0
  },
  startSceneId: 'scene_start',
  scenes: [
    {
      sceneId: 'scene_start',
      narrative: 'You arrive at Emberfall gate. A wary guard blocks the entrance.',
      isTerminal: false,
      imageKey: 'gate',
      avenues: [
        {
          avenueId: 'a_talk',
          label: 'Reason with the guard',
          keywords: ['talk', 'reason', 'convince'],
          points: 2,
          nextSceneId: 'scene_square'
        },
        {
          avenueId: 'a_sneak',
          label: 'Sneak through side alley',
          keywords: ['sneak', 'stealth', 'alley'],
          points: 1,
          nextSceneId: 'scene_square'
        }
      ]
    },
    {
      sceneId: 'scene_square',
      narrative: 'Inside the square, you spot a relic chest and hear alarm bells.',
      isTerminal: false,
      imageKey: 'square',
      avenues: [
        {
          avenueId: 'a_help',
          label: 'Help civilians first',
          keywords: ['help', 'save', 'protect'],
          points: 2,
          nextSceneId: 'scene_end'
        },
        {
          avenueId: 'a_loot',
          label: 'Rush for the relic chest',
          keywords: ['loot', 'chest', 'relic'],
          points: -1,
          nextSceneId: 'scene_end'
        }
      ]
    },
    {
      sceneId: 'scene_end',
      narrative: 'The town records your actions. Dawn breaks over Emberfall.',
      isTerminal: true,
      imageKey: 'dawn',
      avenues: []
    }
  ]
};

function AuthPanel({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState('user');
  const [mode, setMode] = useState('login');

  const mutation = useMutation({
    mutationFn: async () => {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'register' ? { email, password, role } : { email, password };
      const { data } = await api.post(path, payload);
      return data;
    },
    onSuccess: (data) => onAuth(data)
  });

  return (
    <section className="card">
      <h2>Auth</h2>
      <p className="muted">Create an admin and a user account to test both journeys.</p>
      <div className="row">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
      </div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
      {mode === 'register' ? (
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">admin</option>
          <option value="user">user</option>
        </select>
      ) : null}
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !email}>
        {mutation.isPending ? 'Processing...' : mode}
      </button>
      {mutation.error ? <p className="error">{mutation.error.response?.data?.error || 'Auth failed'}</p> : null}
    </section>
  );
}

function GraphCanvas({ game }) {
  if (!game) {
    return <p className="muted">Select a game to see graph layout.</p>;
  }

  const scenes = game.scenes || [];
  const width = 300;
  const height = Math.max(220, scenes.length * 90);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="graphCanvas" role="img" aria-label="Scene graph">
      {scenes.map((scene, index) => {
        const y = 40 + index * 80;
        return (
          <g key={scene.sceneId}>
            <rect x="10" y={y - 18} width="110" height="36" rx="8" className="graphNode" />
            <text x="18" y={y + 4} className="graphNodeText">{scene.sceneId}</text>
            {(scene.avenues || []).map((avenue, avenueIndex) => {
              const targetIndex = scenes.findIndex((item) => item.sceneId === avenue.nextSceneId);
              if (targetIndex < 0) return null;
              const targetY = 40 + targetIndex * 80;
              return (
                <line
                  key={`${scene.sceneId}-${avenue.avenueId}`}
                  x1={120}
                  y1={y + avenueIndex * 3}
                  x2={190}
                  y2={targetY}
                  className="graphEdge"
                />
              );
            })}
          </g>
        );
      })}
      {scenes.map((scene, index) => {
        const y = 40 + index * 80;
        return (
          <text key={`${scene.sceneId}-target`} x="198" y={y + 4} className="graphTargetText">
            {scene.isTerminal ? `${scene.sceneId} (terminal)` : scene.sceneId}
          </text>
        );
      })}
    </svg>
  );
}

function AdminPanel({ me, onPlaytestSession }) {
  const queryClient = useQueryClient();
  const [selectedGameId, setSelectedGameId] = useState('');
  const [startSceneOverride, setStartSceneOverride] = useState('');

  const myGames = useQuery({
    queryKey: ['my-games'],
    queryFn: async () => (await api.get('/games/mine')).data.games,
    enabled: me?.role === 'admin'
  });

  const selectedGame = (myGames.data || []).find((game) => game._id === selectedGameId) || (myGames.data || [])[0];

  useEffect(() => {
    if (!selectedGameId && myGames.data?.length) {
      setSelectedGameId(myGames.data[0]._id);
    }
  }, [myGames.data, selectedGameId]);

  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/games', starterGame)).data.game,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-games'] })
  });

  const publishMutation = useMutation({
    mutationFn: async (gameId) => (await api.post(`/games/${gameId}/publish`)).data.game,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-games'] })
  });

  const analyzeMutation = useMutation({
    mutationFn: async (gameId) => (await api.post(`/admin/games/${gameId}/analyze`)).data
  });

  const playtestMutation = useMutation({
    mutationFn: async ({ gameId, startSceneId }) =>
      (await api.post(`/admin/games/${gameId}/playtest`, { startSceneId })).data.session,
    onSuccess: (session) => {
      onPlaytestSession(session._id);
    }
  });

  const observability = useQuery({
    queryKey: ['resolver-observability'],
    queryFn: async () => (await api.get('/admin/observability/resolver')).data,
    enabled: me?.role === 'admin',
    refetchInterval: 8000
  });

  if (me?.role !== 'admin') {
    return (
      <section className="card">
        <h2>Admin Forge</h2>
        <p className="muted">Login as an admin to create, analyze, and playtest stories.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Admin Forge</h2>
      <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
        {createMutation.isPending ? 'Creating...' : 'Create starter game'}
      </button>

      <div className="list">
        {(myGames.data || []).map((game) => (
          <div key={game._id} className="listItem">
            <div>
              <strong>{game.title}</strong>
              <p className="muted">{game.status} | scenes: {game.scenes.length}</p>
            </div>
            <div className="row">
              <button onClick={() => setSelectedGameId(game._id)} className={selectedGameId === game._id ? 'active' : ''}>Graph</button>
              <button onClick={() => publishMutation.mutate(game._id)} disabled={publishMutation.isPending || game.status === 'public'}>
                {game.status === 'public' ? 'Published' : 'Publish'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="subcard">
        <h3>Graph View</h3>
        <GraphCanvas game={selectedGame} />
      </div>

      <div className="subcard">
        <h3>Graph Analysis + Playtest</h3>
        <div className="row">
          <button
            onClick={() => selectedGame && analyzeMutation.mutate(selectedGame._id)}
            disabled={analyzeMutation.isPending || !selectedGame}
          >
            {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Selected Game'}
          </button>
          <input
            value={startSceneOverride}
            onChange={(e) => setStartSceneOverride(e.target.value)}
            placeholder="Playtest start scene (optional)"
          />
          <button
            onClick={() => selectedGame && playtestMutation.mutate({ gameId: selectedGame._id, startSceneId: startSceneOverride })}
            disabled={!selectedGame || playtestMutation.isPending}
          >
            {playtestMutation.isPending ? 'Starting...' : 'Playtest'}
          </button>
        </div>
        {analyzeMutation.data ? (
          <div className="analysisBox">
            <p><strong>Unreachable:</strong> {analyzeMutation.data.reachability.unreachableScenes.join(', ') || 'none'}</p>
            <p><strong>Dead Ends:</strong> {analyzeMutation.data.reachability.deadEnds.join(', ') || 'none'}</p>
            <p><strong>Point Range:</strong> {String(analyzeMutation.data.balance.minAchievablePoints)} to {String(analyzeMutation.data.balance.maxAchievablePoints)} (target {analyzeMutation.data.balance.targetPoints})</p>
            <p><strong>Turn Range:</strong> {String(analyzeMutation.data.turnEconomy.minimumTurnsToEnding)} to {String(analyzeMutation.data.turnEconomy.maximumTurnsToEnding)}</p>
          </div>
        ) : null}
      </div>

      <div className="subcard">
        <h3>Resolver Observability</h3>
        <p className="muted">
          Total: {observability.data?.metrics?.total || 0} | Wildcard: {observability.data?.metrics?.wildcard || 0} |
          Clarification: {observability.data?.metrics?.clarification || 0}
        </p>
        <p className="muted">
          Fallbacks: {observability.data?.metrics?.fallbacks || 0} | Provider Errors: {observability.data?.metrics?.providerErrors || 0}
        </p>
      </div>

      {publishMutation.error ? <p className="error">{publishMutation.error.response?.data?.details?.join(', ') || 'Publish failed'}</p> : null}
    </section>
  );
}

function PlayerPanel({ me, externalSessionId }) {
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
        </>
      ) : null}
    </section>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem('luminaquest.auth');
    return raw ? JSON.parse(raw) : null;
  });
  const [playtestSessionId, setPlaytestSessionId] = useState('');

  const me = useMemo(() => auth?.user || null, [auth]);
  setAuthToken(auth?.token || '');

  const onAuth = (nextAuth) => {
    localStorage.setItem('luminaquest.auth', JSON.stringify(nextAuth));
    setAuth(nextAuth);
  };

  const logout = () => {
    localStorage.removeItem('luminaquest.auth');
    setAuth(null);
    setAuthToken('');
  };

  return (
    <main>
      <header>
        <h1>LuminaQuest Iteration 2</h1>
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
