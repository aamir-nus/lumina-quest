import { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { getRandomEngagementMessage } from '../utils/engagementMessages.js';

const MAX_AVENUES = 5;

function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function expectedOptionRange(difficulty) {
  if (difficulty === 'hard') return { min: 4, max: 6 };
  if (difficulty === 'medium') return { min: 3, max: 5 };
  return { min: 2, max: 3 };
}

function parseKeywordInput(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function GameEditor({ game, onSave, onCancel }) {
  const queryClient = useQueryClient();
  const [editedGame, setEditedGame] = useState(() => cloneGame(game));
  const [keywordInputValues, setKeywordInputValues] = useState({});
  const [generatingSceneId, setGeneratingSceneId] = useState(null);
  const [generationError, setGenerationError] = useState(null);
  const [engagementMessage, setEngagementMessage] = useState(null);
  const messageIntervalRef = useRef(null);
  const expectedRange = useMemo(
    () => expectedOptionRange(editedGame.storyConfig?.difficulty),
    [editedGame.storyConfig?.difficulty]
  );

  // Engagement message cycle during scene option generation
  useEffect(() => {
    if (generatingSceneId) {
      setEngagementMessage(getRandomEngagementMessage('option', editedGame.storyConfig?.difficulty));
      messageIntervalRef.current = setInterval(() => {
        setEngagementMessage(getRandomEngagementMessage('option', editedGame.storyConfig?.difficulty));
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
  }, [generatingSceneId, editedGame.storyConfig?.difficulty]);

  // Initialize keyword inputs when game changes
  useEffect(() => {
    const initialValues = {};
    editedGame.scenes?.forEach((scene) => {
      scene.avenues?.forEach((avenue) => {
        const key = `${scene.sceneId}-${avenue.avenueId}`;
        initialValues[key] = Array.isArray(avenue.keywords) ? avenue.keywords.join(', ') : '';
      });
    });
    setKeywordInputValues(initialValues);
  }, [editedGame._id]);

  const updateMutation = useMutation({
    mutationFn: async (payload) => (await api.put(`/games/${payload._id}`, payload)).data.game,
    onSuccess: (updatedGame) => onSave(updatedGame)
  });

  const generateSceneOptionsMutation = useMutation({
    mutationFn: async (sceneId) => {
      setGeneratingSceneId(sceneId);
      setGenerationError(null);
      const response = await api.post(`/games/${editedGame._id}/scenes/${sceneId}/generate-options`);
      return response.data.game;
    },
    onSuccess: (updatedGame) => {
      setEditedGame(updatedGame);
      setGeneratingSceneId(null);
      setGenerationError(null);
      // Invalidate queries to refresh game list if needed
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
    onError: (error) => {
      setGeneratingSceneId(null);
      setGenerationError(error.response?.data?.error?.message || 'Failed to generate options. Please try again or add options manually.');
    }
  });

  const updateGame = (updates) => {
    setEditedGame((prev) => ({ ...prev, ...updates }));
  };

  const updateStoryConfig = (updates) => {
    setEditedGame((prev) => ({
      ...prev,
      storyConfig: {
        ...prev.storyConfig,
        ...updates
      }
    }));
  };

  const updateScene = (sceneId, updates) => {
    setEditedGame((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => (
        scene.sceneId === sceneId
          ? { ...scene, ...updates }
          : scene
      ))
    }));
  };

  const updateScenePolicy = (sceneId, updates) => {
    setEditedGame((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => (
        scene.sceneId === sceneId
          ? {
              ...scene,
              inputPolicy: {
                ...scene.inputPolicy,
                ...updates
              }
            }
          : scene
      ))
    }));
  };

  const updateAvenue = (sceneId, avenueId, updates) => {
    setEditedGame((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => (
        scene.sceneId === sceneId
          ? {
              ...scene,
              avenues: scene.avenues.map((avenue) => (
                avenue.avenueId === avenueId
                  ? {
                      ...avenue,
                      ...updates
                    }
                  : avenue
              ))
            }
          : scene
      ))
    }));
  };

  const addAvenue = (sceneId) => {
    setEditedGame((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => {
        if (scene.sceneId !== sceneId || scene.avenues.length >= MAX_AVENUES) {
          return scene;
        }
        const nextSceneId = prev.scenes.find((item) => item.sceneId !== sceneId)?.sceneId || scene.sceneId;
        return {
          ...scene,
          avenues: [
            ...scene.avenues,
            {
              avenueId: `${sceneId}_manual_${scene.avenues.length + 1}`,
              label: 'New option',
              intent: 'New option',
              outcome: 'partial',
              keywords: [],
              scoreImpact: 0,
              points: 0,
              nextSceneId,
              origin: 'manual',
              visualEffects: {
                transition: 'fade',
                spriteMood: '',
                setTheme: '',
                enableLayers: [],
                disableLayers: []
              }
            }
          ]
        };
      })
    }));
  };

  const removeAvenue = (sceneId, avenueId) => {
    setEditedGame((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => (
        scene.sceneId === sceneId
          ? { ...scene, avenues: scene.avenues.filter((avenue) => avenue.avenueId !== avenueId) }
          : scene
      ))
    }));

    // Clean up keyword input state
    const key = `${sceneId}-${avenueId}`;
    setKeywordInputValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Handle keyword input changes - only update local state while typing
  const handleKeywordInputChange = (sceneId, avenueId, value) => {
    const key = `${sceneId}-${avenueId}`;
    setKeywordInputValues((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // Commit keywords to game state on blur (when leaving the field)
  const handleKeywordInputBlur = (sceneId, avenueId) => {
    const key = `${sceneId}-${avenueId}`;
    const inputValue = keywordInputValues[key] || '';
    const keywords = parseKeywordInput(inputValue);
    updateAvenue(sceneId, avenueId, { keywords });
  };

  const getKeywordInputValue = (sceneId, avenueId, avenueKeywords) => {
    const key = `${sceneId}-${avenueId}`;
    // If we have a local input value, use it; otherwise use the keywords from the game
    if (key in keywordInputValues) {
      return keywordInputValues[key];
    }
    return Array.isArray(avenueKeywords) ? avenueKeywords.join(', ') : '';
  };

  const handleSave = () => {
    // Commit any pending keyword changes before saving
    const updatedGame = { ...editedGame };
    updatedGame.scenes = updatedGame.scenes.map((scene) => ({
      ...scene,
      avenues: (scene.avenues || []).map((avenue) => {
        const key = `${scene.sceneId}-${avenue.avenueId}`;
        const inputValue = keywordInputValues[key];
        if (inputValue !== undefined) {
          return {
            ...avenue,
            keywords: parseKeywordInput(inputValue)
          };
        }
        return avenue;
      })
    }));
    updateMutation.mutate(updatedGame);
  };

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Game Editor</h2>
        <div className="row">
          <button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Draft'}
          </button>
          <button type="button" onClick={onCancel} disabled={updateMutation.isPending}>Close</button>
        </div>
      </div>

      <div className="subcard">
        <div className="formRow">
          <label htmlFor="edit-title">Title</label>
          <input id="edit-title" value={editedGame.title} onChange={(event) => updateGame({ title: event.target.value })} />
        </div>

        <div className="formRow">
          <label htmlFor="edit-description">Description</label>
          <textarea
            id="edit-description"
            rows={2}
            value={editedGame.description || ''}
            onChange={(event) => updateGame({ description: event.target.value })}
          />
        </div>

        <div className="formRow">
          <label htmlFor="edit-premise">Premise</label>
          <textarea
            id="edit-premise"
            rows={2}
            value={editedGame.storyConfig?.premise || ''}
            onChange={(event) => updateStoryConfig({ premise: event.target.value })}
          />
        </div>

        <div className="formRow">
          <label htmlFor="edit-start-goal">Start Goal</label>
          <input
            id="edit-start-goal"
            value={editedGame.storyConfig?.startGoal || ''}
            onChange={(event) => updateStoryConfig({ startGoal: event.target.value })}
          />
        </div>

        <div className="formRow">
          <label htmlFor="edit-end-goal">End Goal</label>
          <input
            id="edit-end-goal"
            value={editedGame.storyConfig?.endGoal || ''}
            onChange={(event) => updateStoryConfig({ endGoal: event.target.value })}
          />
        </div>

        <div className="formRow">
          <label htmlFor="edit-tone">Tone</label>
          <input
            id="edit-tone"
            value={editedGame.storyConfig?.tone || 'cinematic'}
            onChange={(event) => updateStoryConfig({ tone: event.target.value })}
          />
        </div>

        <div className="formRow">
          <label htmlFor="edit-difficulty">Difficulty</label>
          <select
            id="edit-difficulty"
            value={editedGame.storyConfig?.difficulty || 'easy'}
            onChange={(event) => updateStoryConfig({ difficulty: event.target.value })}
          >
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </div>

        <p className="muted">
          Expected authored options per playable scene: {expectedRange.min}-{expectedRange.max}. Pending option scenes:{' '}
          {(editedGame.generationState?.pendingSceneIds || []).join(', ') || 'none'}.
        </p>
      </div>

      <div className="list">
        {editedGame.scenes.map((scene) => (
          <div key={scene.sceneId} className="subcard">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{scene.sceneId}</strong>
              <span className="muted">{scene.kind}{scene.endingType ? `/${scene.endingType}` : ''}</span>
            </div>

            <div className="formRow">
              <label htmlFor={`${scene.sceneId}-goal`}>Goal Summary</label>
              <input
                id={`${scene.sceneId}-goal`}
                value={scene.goalSummary || ''}
                onChange={(event) => updateScene(scene.sceneId, { goalSummary: event.target.value })}
              />
            </div>

            <div className="formRow">
              <label htmlFor={`${scene.sceneId}-narrative`}>Narrative</label>
              <textarea
                id={`${scene.sceneId}-narrative`}
                rows={2}
                value={scene.narrative}
                onChange={(event) => updateScene(scene.sceneId, { narrative: event.target.value })}
              />
            </div>

            {scene.kind !== 'ending' && (
              <>
                <div className="formRow">
                  <label htmlFor={`${scene.sceneId}-freeform`}>Allow Freeform</label>
                  <input
                    id={`${scene.sceneId}-freeform`}
                    type="checkbox"
                    checked={scene.inputPolicy?.allowFreeform ?? true}
                    onChange={(event) => updateScenePolicy(scene.sceneId, { allowFreeform: event.target.checked })}
                  />
                </div>

                <div className="formRow">
                  <label htmlFor={`${scene.sceneId}-limit`}>Invalid Limit</label>
                  <input
                    id={`${scene.sceneId}-limit`}
                    type="number"
                    value={scene.inputPolicy?.invalidAttemptLimit ?? 3}
                    onChange={(event) => updateScenePolicy(scene.sceneId, { invalidAttemptLimit: Number(event.target.value) })}
                  />
                </div>

                <div className="formRow">
                  <label htmlFor={`${scene.sceneId}-penalty`}>Invalid Penalty</label>
                  <input
                    id={`${scene.sceneId}-penalty`}
                    type="number"
                    value={scene.inputPolicy?.invalidPenalty ?? -1}
                    onChange={(event) => updateScenePolicy(scene.sceneId, { invalidPenalty: Number(event.target.value) })}
                  />
                </div>

                <div className="row" style={{ justifyContent: 'space-between', marginTop: '12px' }}>
                  <strong>Options ({scene.avenues.length}/{MAX_AVENUES})</strong>
                  <div className="row">
                    <button
                      type="button"
                      onClick={() => generateSceneOptionsMutation.mutate(scene.sceneId)}
                      disabled={generatingSceneId === scene.sceneId || scene.avenues.length >= MAX_AVENUES}
                      className="ai-btn"
                    >
                      {generatingSceneId === scene.sceneId ? 'AI Generating...' : 'AI: Generate Options'}
                    </button>
                    <button
                      type="button"
                      onClick={() => addAvenue(scene.sceneId)}
                      disabled={scene.avenues.length >= MAX_AVENUES}
                    >
                      + Add Option
                    </button>
                  </div>
                </div>

                {generatingSceneId === scene.sceneId && engagementMessage && (
                  <p className="engagement-message" role="status" aria-live="polite">
                    ✨ {engagementMessage}
                  </p>
                )}

                {(scene.avenues || []).map((avenue) => (
                  <div key={avenue.avenueId} className={`card ${avenue.origin === 'ai_generated' ? 'ai-option' : 'manual-option'}`}>
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className={`origin-badge ${avenue.origin === 'ai_generated' ? 'ai-badge' : 'manual-badge'}`}>
                        {avenue.origin === 'ai_generated' ? 'AI Generated' : 'Manual'}
                      </span>
                    </div>
                    <div className="formRow">
                      <label>Label</label>
                      <input
                        value={avenue.label}
                        onChange={(event) => updateAvenue(scene.sceneId, avenue.avenueId, { label: event.target.value })}
                        placeholder="Option label"
                      />
                    </div>

                    <div className="formRow">
                      <label>Outcome</label>
                      <select
                        value={avenue.outcome || 'partial'}
                        onChange={(event) => updateAvenue(scene.sceneId, avenue.avenueId, { outcome: event.target.value })}
                      >
                        <option value="success">success</option>
                        <option value="partial">partial</option>
                        <option value="fail">fail</option>
                      </select>
                    </div>

                    <div className="formRow">
                      <label>Score Impact</label>
                      <input
                        type="number"
                        value={avenue.scoreImpact ?? avenue.points ?? 0}
                        onChange={(event) => updateAvenue(scene.sceneId, avenue.avenueId, {
                          scoreImpact: Number(event.target.value),
                          points: Number(event.target.value)
                        })}
                      />
                    </div>

                    <div className="formRow">
                      <label>Intent</label>
                      <input
                        value={avenue.intent || ''}
                        onChange={(event) => updateAvenue(scene.sceneId, avenue.avenueId, { intent: event.target.value })}
                        placeholder="What this option represents"
                      />
                    </div>

                    <div className="formRow">
                      <label>Keywords</label>
                      <input
                        value={getKeywordInputValue(scene.sceneId, avenue.avenueId, avenue.keywords)}
                        onChange={(event) => handleKeywordInputChange(scene.sceneId, avenue.avenueId, event.target.value)}
                        onBlur={() => handleKeywordInputBlur(scene.sceneId, avenue.avenueId)}
                        placeholder="sword, magic, shield"
                      />
                    </div>

                    <div className="formRow">
                      <label>Next Scene</label>
                      <select
                        value={avenue.nextSceneId}
                        onChange={(event) => updateAvenue(scene.sceneId, avenue.avenueId, { nextSceneId: event.target.value })}
                      >
                        {editedGame.scenes.map((s) => (
                          <option key={s.sceneId} value={s.sceneId}>{s.sceneId}</option>
                        ))}
                      </select>
                    </div>

                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => removeAvenue(scene.sceneId, avenue.avenueId)} className="delete-btn">
                        Remove Option
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>

      {updateMutation.error && (
        <p className="error" role="alert">
          {updateMutation.error.response?.data?.error?.message || 'Failed to save game'}
        </p>
      )}
      {generationError && (
        <p className="error" role="alert">
          {generationError}
        </p>
      )}
    </section>
  );
}
