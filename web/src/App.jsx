import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken } from './api';

const starterGame = {
  title: 'The Gate of Emberfall',
  description: 'A compact 3-scene journey to validate the story engine.',
  constraints: { maxTurns: 4, targetPoints: 3 },
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

function AdminPanel({ me }) {
  const queryClient = useQueryClient();
  const myGames = useQuery({
    queryKey: ['my-games'],
    queryFn: async () => (await api.get('/games/mine')).data.games,
    enabled: me?.role === 'admin'
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/games', starterGame)).data.game,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-games'] })
  });

  const publishMutation = useMutation({
    mutationFn: async (gameId) => (await api.post(`/games/${gameId}/publish`)).data.game,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-games'] })
  });

  if (me?.role !== 'admin') {
    return (
      <section className="card">
        <h2>Admin Forge</h2>
        <p className="muted">Login as an admin to create and publish stories.</p>
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
            <button onClick={() => publishMutation.mutate(game._id)} disabled={publishMutation.isPending || game.status === 'public'}>
              {game.status === 'public' ? 'Published' : 'Publish'}
            </button>
          </div>
        ))}
      </div>
      {publishMutation.error ? <p className="error">{publishMutation.error.response?.data?.details?.join(', ') || 'Publish failed'}</p> : null}
    </section>
  );
}

function PlayerPanel({ me }) {
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const queryClient = useQueryClient();

  const publicGames = useQuery({
    queryKey: ['public-games'],
    queryFn: async () => (await api.get('/games/public')).data.games
  });

  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => (await api.get(`/sessions/${sessionId}`)).data,
    enabled: !!sessionId
  });

  const startMutation = useMutation({
    mutationFn: async (gameId) => (await api.post('/sessions/start', { gameId })).data.session,
    onSuccess: (session) => setSessionId(session._id)
  });

  const actionMutation = useMutation({
    mutationFn: async () => (await api.post('/sessions/action', { sessionId, userInput: input })).data,
    onSuccess: (data) => {
      setInput('');
      queryClient.setQueryData(['session', sessionId], (old) => ({
        ...(old || {}),
        session: data.session,
        currentScene: data.currentScene || old?.currentScene,
        game: old?.game
      }));
    }
  });

  const scene = sessionQuery.data?.currentScene;
  const session = sessionQuery.data?.session;
  const game = sessionQuery.data?.game;

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
          </div>
          <div className="scene">
            <h3>{scene?.sceneId}</h3>
            <p>{scene?.narrative}</p>
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
            {(session.history || []).slice().reverse().map((item) => (
              <div key={`${item.turn}-${item.sceneId}`} className="historyItem">
                <strong>Turn {item.turn}</strong>
                <p>{item.userQuery}</p>
                <p className="muted">{item.resolvedAvenueId} | Δ {item.pointsDelta}</p>
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
        <h1>LuminaQuest Iteration 1</h1>
        {me ? <button onClick={logout}>Logout</button> : null}
      </header>
      <div className="grid">
        <AuthPanel onAuth={onAuth} />
        <AdminPanel me={me} />
        <PlayerPanel me={me} />
      </div>
    </main>
  );
}
