import { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { getRandomEngagementMessage } from '../utils/engagementMessages.js';

function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function expectedOptionRange(difficulty) {
  if (difficulty === 'hard') return { min: 4, max: 6 };
  if (difficulty === 'medium') return { min: 3, max: 5 };
  return { min: 2, max: 3 };
}

function updateSceneList(game, sceneId, updates) {
  return {
    ...game,
    scenes: game.scenes.map((scene) => (
      scene.sceneId === sceneId
        ? { ...scene, ...updates }
        : scene
    ))
  };
}

function updateSceneOptionList(game, sceneId, avenueId, updates) {
  return {
    ...game,
    scenes: game.scenes.map((scene) => (
      scene.sceneId === sceneId
        ? {
            ...scene,
            avenues: scene.avenues.map((avenue) => (
              avenue.avenueId === avenueId ? { ...avenue, ...updates } : avenue
            ))
          }
        : scene
    ))
  };
}

export function GameAuthorWizard({ onCancel, onOpenEditor }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    premise: '',
    startGoal: '',
    endGoal: '',
    tone: 'cinematic',
    difficulty: 'easy'
  });
  const [draftGame, setDraftGame] = useState(null);
  const [engagementMessage, setEngagementMessage] = useState(null);
  const messageIntervalRef = useRef(null);

  const playableScenes = useMemo(
    () => (draftGame?.scenes || []).filter((scene) => scene.kind !== 'ending'),
    [draftGame]
  );

  const flowMutation = useMutation({
    mutationFn: async () => (await api.post('/games/generate-flow', form)).data.game,
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
      setDraftGame(cloneGame(game));
    }
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (game) => (await api.put(`/games/${game._id}`, game)).data.game,
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
      setDraftGame(cloneGame(game));
    }
  });

  const optionMutation = useMutation({
    mutationFn: async (game) => {
      const saved = (await api.put(`/games/${game._id}`, game)).data.game;
      return (await api.post(`/games/${saved._id}/generate-options`, {})).data.game;
    },
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
      setDraftGame(cloneGame(game));
    }
  });

  const regenerateSceneMutation = useMutation({
    mutationFn: async ({ gameId, sceneId }) =>
      (await api.post(`/games/${gameId}/scenes/${sceneId}/generate-options`, {})).data.game,
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
      setDraftGame(cloneGame(game));
    }
  });

  // Start message cycle during generation (must be after mutations are defined)
  useEffect(() => {
    if (flowMutation.isPending || optionMutation.isPending) {
      const type = flowMutation.isPending ? 'flow' : 'option';
      setEngagementMessage(getRandomEngagementMessage(type, form.difficulty));
      messageIntervalRef.current = setInterval(() => {
        setEngagementMessage(getRandomEngagementMessage(type, form.difficulty));
      }, 3000);
    } else {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = null;
      }
      setEngagementMessage(null);
    }

    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, [flowMutation.isPending, optionMutation.isPending, form.difficulty]);

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Authoring Wizard</h2>
        <button type="button" onClick={onCancel}>Close</button>
      </div>

      <div className="subcard">
        <h3>1. Story Setup</h3>
        <div className="row">
          <label htmlFor="wizard-title">Title</label>
        </div>
        <input
          id="wizard-title"
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="The Gate of Emberfall"
        />

        <div className="row">
          <label htmlFor="wizard-description">Description</label>
        </div>
        <input
          id="wizard-description"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="A polished short adventure"
        />

        <div className="row">
          <label htmlFor="wizard-premise">Premise</label>
        </div>
        <textarea
          id="wizard-premise"
          rows={4}
          value={form.premise}
          onChange={(event) => setForm((prev) => ({ ...prev, premise: event.target.value }))}
          placeholder="Describe the story idea the LLM should convert into beats."
        />

        <div className="row">
          <label htmlFor="wizard-start-goal">Start Goal</label>
          <label htmlFor="wizard-end-goal">End Goal</label>
        </div>
        <div className="row">
          <input
            id="wizard-start-goal"
            value={form.startGoal}
            onChange={(event) => setForm((prev) => ({ ...prev, startGoal: event.target.value }))}
            placeholder="What the player needs to do first"
          />
          <input
            id="wizard-end-goal"
            value={form.endGoal}
            onChange={(event) => setForm((prev) => ({ ...prev, endGoal: event.target.value }))}
            placeholder="What counts as success"
          />
        </div>

        <div className="row">
          <label htmlFor="wizard-tone">Tone</label>
          <label htmlFor="wizard-difficulty">Difficulty</label>
        </div>
        <div className="row">
          <input
            id="wizard-tone"
            value={form.tone}
            onChange={(event) => setForm((prev) => ({ ...prev, tone: event.target.value }))}
            placeholder="cinematic"
          />
          <select
            id="wizard-difficulty"
            value={form.difficulty}
            onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}
          >
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </div>

        <div className="row">
          <button
            type="button"
            onClick={() => flowMutation.mutate()}
            disabled={flowMutation.isPending || !form.title || !form.premise || !form.startGoal || !form.endGoal}
          >
            {flowMutation.isPending ? 'Generating Flow...' : 'Generate Flow'}
          </button>
        </div>

        {engagementMessage && flowMutation.isPending && (
          <p className="engagement-message" role="status" aria-live="polite">
            ✨ {engagementMessage}
          </p>
        )}

        {flowMutation.error ? (
          <p className="error">{flowMutation.error.response?.data?.error?.message || 'Flow generation failed.'}</p>
        ) : null}
      </div>

      {draftGame ? (
        <>
          <div className="subcard">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>2. Review Beats</h3>
              <span className="muted">
                {draftGame.storyConfig?.difficulty} {'->'} {expectedOptionRange(draftGame.storyConfig?.difficulty).min}-{expectedOptionRange(draftGame.storyConfig?.difficulty).max} options per playable scene
              </span>
            </div>
            {(draftGame.scenes || []).map((scene) => (
              <div key={scene.sceneId} className="card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{scene.sceneId}</strong>
                  <span className="muted">{scene.kind}{scene.endingType ? `/${scene.endingType}` : ''}</span>
                </div>
                <input
                  value={scene.goalSummary || ''}
                  onChange={(event) => setDraftGame((prev) => updateSceneList(prev, scene.sceneId, { goalSummary: event.target.value }))}
                  placeholder="Goal summary"
                />
                <textarea
                  rows={3}
                  value={scene.narrative}
                  onChange={(event) => setDraftGame((prev) => updateSceneList(prev, scene.sceneId, { narrative: event.target.value }))}
                />
              </div>
            ))}
            <div className="row">
              <button type="button" onClick={() => saveDraftMutation.mutate(draftGame)} disabled={saveDraftMutation.isPending}>
                {saveDraftMutation.isPending ? 'Saving...' : 'Save Flow Draft'}
              </button>
              <button type="button" onClick={() => optionMutation.mutate(draftGame)} disabled={optionMutation.isPending}>
                {optionMutation.isPending ? 'Generating Options...' : 'Generate Options'}
              </button>
            </div>

            {engagementMessage && optionMutation.isPending && (
              <p className="engagement-message" role="status" aria-live="polite">
                ✨ {engagementMessage}
              </p>
            )}

            {saveDraftMutation.error ? <p className="error">{saveDraftMutation.error.response?.data?.error?.message || 'Save failed.'}</p> : null}
            {optionMutation.error ? <p className="error">{optionMutation.error.response?.data?.error?.message || 'Option generation failed.'}</p> : null}
          </div>

          <div className="subcard">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>3. Options and Debug State</h3>
              <button type="button" onClick={() => onOpenEditor(draftGame)}>Open Full Editor</button>
            </div>
            <p className="muted">
              Generation status: {draftGame.generationState?.status || 'idle'}.
              Pending scenes: {(draftGame.generationState?.pendingSceneIds || []).join(', ') || 'none'}.
            </p>
            {(draftGame.authoringWarnings || []).length > 0 ? (
              <div className="analysisBox">
                {(draftGame.authoringWarnings || []).map((warning, index) => (
                  <p key={`${warning}-${index}`} className="muted">{warning}</p>
                ))}
              </div>
            ) : null}

            {playableScenes.map((scene) => (
              <div key={scene.sceneId} className="card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{scene.sceneId}</strong>
                  <button
                    type="button"
                    onClick={() => regenerateSceneMutation.mutate({ gameId: draftGame._id, sceneId: scene.sceneId })}
                    disabled={regenerateSceneMutation.isPending}
                  >
                    Regenerate This Scene
                  </button>
                </div>
                <p className="muted">{scene.goalSummary}</p>
                {(scene.avenues || []).map((avenue) => (
                  <div key={avenue.avenueId} className="subcard">
                    <input
                      value={avenue.label}
                      onChange={(event) => setDraftGame((prev) => updateSceneOptionList(prev, scene.sceneId, avenue.avenueId, { label: event.target.value }))}
                    />
                    <div className="row">
                      <input
                        value={avenue.intent || ''}
                        onChange={(event) => setDraftGame((prev) => updateSceneOptionList(prev, scene.sceneId, avenue.avenueId, { intent: event.target.value }))}
                        placeholder="Intent"
                      />
                      <select
                        value={avenue.outcome || 'partial'}
                        onChange={(event) => setDraftGame((prev) => updateSceneOptionList(prev, scene.sceneId, avenue.avenueId, { outcome: event.target.value }))}
                      >
                        <option value="success">success</option>
                        <option value="partial">partial</option>
                        <option value="fail">fail</option>
                      </select>
                      <input
                        type="number"
                        value={avenue.scoreImpact ?? avenue.points ?? 0}
                        onChange={(event) => setDraftGame((prev) => updateSceneOptionList(prev, scene.sceneId, avenue.avenueId, {
                          scoreImpact: Number(event.target.value),
                          points: Number(event.target.value)
                        }))}
                      />
                    </div>
                  </div>
                ))}
                {(scene.avenues || []).length === 0 ? (
                  <p className="muted">No authored options yet for this scene.</p>
                ) : null}
              </div>
            ))}

            <div className="analysisBox">
              <h4>Debug Log</h4>
              {(draftGame.generationState?.debug || []).length === 0 ? (
                <p className="muted">No generation logs yet.</p>
              ) : (
                (draftGame.generationState?.debug || []).slice(-8).map((entry, index) => (
                  <p key={`${entry.phase}-${entry.sceneId}-${index}`} className="muted">
                    [{entry.phase}] {entry.sceneId ? `${entry.sceneId} ` : ''}attempt {entry.attempt}: {entry.summary}
                  </p>
                ))
              )}
            </div>

            {regenerateSceneMutation.error ? (
              <p className="error">{regenerateSceneMutation.error.response?.data?.error?.message || 'Scene regeneration failed.'}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
