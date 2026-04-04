import { memo, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { GraphCanvas } from './GraphCanvas';
import { GameEditor } from './GameEditor';
import { GameAuthorWizard } from './GameAuthorWizard';
import { UI } from '../constants/ui';

/**
 * @param {{ me: { id?: string, email?: string, role?: string } | null, onPlaytestSession: (sessionId: string) => void }} props
 */
export const AdminPanel = memo(function AdminPanel({ me, onPlaytestSession }) {
  const queryClient = useQueryClient();
  const [selectedGameId, setSelectedGameId] = useState('');
  const [startSceneOverride, setStartSceneOverride] = useState('');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [editingGame, setEditingGame] = useState(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (gameId) => (await api.delete(`/games/${gameId}`)).data,
    onSuccess: (_, deletedGameId) => {
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
      if (selectedGameId === deletedGameId) {
        setSelectedGameId('');
      }
      if (editingGame?._id === deletedGameId) {
        setEditingGame(null);
      }
    }
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

  if (myGames.isLoading) {
    return (
      <section className="card" aria-busy="true">
        <h2>Admin Forge</h2>
        <p className="muted">Loading authored games...</p>
      </section>
    );
  }

  if (myGames.error) {
    return (
      <section className="card">
        <h2>Admin Forge</h2>
        <p className="error" role="alert">
          {myGames.error.response?.data?.error?.message || 'Failed to load admin games.'}
        </p>
      </section>
    );
  }

  // Show editor when editing a game
  if (editingGame) {
    return (
      <GameEditor
        game={editingGame}
        onSave={(updatedGame) => {
          setEditingGame(null);
          setSelectedGameId(updatedGame._id);
        }}
        onCancel={() => setEditingGame(null)}
      />
    );
  }

  if (showCreateWizard) {
    return (
      <GameAuthorWizard
        onCancel={() => setShowCreateWizard(false)}
        onOpenEditor={(game) => {
          setShowCreateWizard(false);
          setEditingGame(game);
        }}
      />
    );
  }

  return (
    <section className="card" aria-live="polite">
      <h2>Admin Forge</h2>

      <div className="row">
        <button type="button" onClick={() => setShowCreateWizard(true)}>
          + Create New Game
        </button>
      </div>

      <div className="list">
        {(myGames.data || []).map((game) => (
          <div key={game._id} className="listItem">
            <div>
              <strong>{game.title}</strong>
              <p className="muted">
                {game.status} | scenes: {game.scenes.length} | schema v{game.schemaVersion || 1}
                {game.generationState?.status ? ` | ${game.generationState.status}` : ''}
              </p>
            </div>
            <div className="row">
              <button type="button" onClick={() => setSelectedGameId(game._id)} className={selectedGameId === game._id ? 'active' : ''}>View</button>
              <button type="button" onClick={() => setEditingGame(game)}>Edit</button>
              <button type="button" onClick={() => publishMutation.mutate(game._id)} disabled={publishMutation.isPending || game.status === 'public'}>
                {game.status === 'public' ? 'Published' : 'Publish'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete "${game.title}"? This cannot be undone.`)) {
                    deleteMutation.mutate(game._id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="delete-btn"
              >
                {deleteMutation.isPending && deleteMutation.variables === game._id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedGame && (
        <>
          <div className="subcard">
            <h3>Graph View: {selectedGame.title}</h3>
            <div className="graphContainer">
              <GraphCanvas game={selectedGame} />
            </div>
          </div>

          <div className="subcard">
            <h3>Analysis + Playtest</h3>
            <div className="row">
              <button
                type="button"
                onClick={() => analyzeMutation.mutate(selectedGame._id)}
                disabled={analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Game'}
              </button>
              <label htmlFor="playtest-scene" className="srOnly">Playtest start scene</label>
              <input
                id="playtest-scene"
                value={startSceneOverride}
                onChange={(e) => setStartSceneOverride(e.target.value)}
                placeholder="Playtest start scene (optional)"
                aria-label="Playtest start scene override"
              />
              <button
                type="button"
                onClick={() => playtestMutation.mutate({ gameId: selectedGame._id, startSceneId: startSceneOverride })}
                disabled={playtestMutation.isPending}
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
        </>
      )}

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
          <h4>Compute Approx</h4>
          <p className="muted">
            avg latency: {Number(observability.data?.metrics?.computeApprox?.avgLatencyMs || 0).toFixed(1)}ms |
            avg cpu: {Number(observability.data?.metrics?.computeApprox?.avgCpuUserMs || 0).toFixed(1)}ms
          </p>
        </div>
      </div>
      {publishMutation.error ? <p className="error">{publishMutation.error.response?.data?.error?.message || 'Publish failed'}</p> : null}
    </section>
  );
});
