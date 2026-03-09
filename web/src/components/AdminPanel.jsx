import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { GraphCanvas } from './GraphCanvas';
import { starterGame } from '../constants/starterGame';
import { UI } from '../constants/ui';

export function AdminPanel({ me, onPlaytestSession }) {
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
    refetchInterval: UI.OBSERVABILITY_POLL_INTERVAL_MS
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
        <p className="muted">Provider: {observability.data?.provider || 'n/a'}</p>
        <p className="muted">
          Total: {observability.data?.metrics?.total || 0} | Wildcard: {observability.data?.metrics?.wildcard || 0} |
          Clarification: {observability.data?.metrics?.clarification || 0}
        </p>
        <p className="muted">
          Fallbacks: {observability.data?.metrics?.fallbacks || 0} | Provider Errors: {observability.data?.metrics?.providerErrors || 0}
        </p>
        <div className="metricsWidget">
          <h4>Token Usage</h4>
          <p className="muted">
            input: {observability.data?.metrics?.inputTokens || 0} | output: {observability.data?.metrics?.outputTokens || 0} |
            total: {observability.data?.metrics?.totalTokens || 0}
          </p>
        </div>
        <div className="metricsWidget">
          <h4>Compute Approx (Current Provider)</h4>
          <p className="muted">
            avg latency: {Number(observability.data?.metrics?.computeApprox?.avgLatencyMs || 0).toFixed(1)}ms |
            avg cpu(user/sys): {Number(observability.data?.metrics?.computeApprox?.avgCpuUserMs || 0).toFixed(1)}/
            {Number(observability.data?.metrics?.computeApprox?.avgCpuSystemMs || 0).toFixed(1)}ms
          </p>
          <p className="muted">
            avg mem(rss/heap): {Number(observability.data?.metrics?.computeApprox?.avgRssMb || 0).toFixed(1)}/
            {Number(observability.data?.metrics?.computeApprox?.avgHeapUsedMb || 0).toFixed(1)} MB
          </p>
          <p className="muted">
            {observability.data?.provider === 'lmstudio'
              ? 'On-device mode active: these values approximate local inference load.'
              : 'External provider active: values reflect API call handling overhead.'}
          </p>
        </div>
      </div>

      {publishMutation.error ? <p className="error">{publishMutation.error.response?.data?.error?.message || 'Publish failed'}</p> : null}
    </section>
  );
}
