import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { getRandomEngagementMessage } from '../utils/engagementMessages.js';
import { SceneCarousel } from './SceneCarousel.jsx';
import { AvenueCarousel } from './AvenueCarousel.jsx';
import { AvenueEditModal } from './AvenueEditModal.jsx';

const MAX_AVENUES = 5;

function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function expectedOptionRange(difficulty) {
  if (difficulty === 'hard') return { min: 1, max: 6 };
  if (difficulty === 'medium') return { min: 1, max: 5 };
  return { min: 1, max: 3 };
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
  const updateAvenueRef = useRef(null);

  // Carousel state
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [editingAvenue, setEditingAvenue] = useState(null);
  const [isCarouselView, setIsCarouselView] = useState(false);

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
    onSuccess: (updatedGame) => {
      // Update local state with the response from server
      setEditedGame(updatedGame);
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
      queryClient.invalidateQueries({ queryKey: ['games'] });
      // Notify parent but don't close editor
      onSave(updatedGame);
    }
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

  // Keep ref updated for modal callback
  updateAvenueRef.current = updateAvenue;

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

  // Carousel handlers
  const handleSelectScene = useCallback((sceneId) => {
    setSelectedSceneId(sceneId);
    setIsCarouselView(true);
  }, []);

  const handleBackToScenes = useCallback(() => {
    setSelectedSceneId(null);
    setIsCarouselView(false);
  }, []);

  const handleEditAvenue = useCallback((avenue) => {
    setEditingAvenue(avenue);
  }, []);

  const handleCloseModal = useCallback(() => {
    setEditingAvenue(null);
  }, []);

  const handleSaveAvenue = useCallback((avenueId, updates) => {
    // Use ref to avoid stale closure - updateAvenueRef always has the latest function
    updateAvenueRef.current(selectedSceneId, avenueId, updates);
  }, [selectedSceneId]);

  const selectedScene = editedGame.scenes?.find((s) => s.sceneId === selectedSceneId);

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

      {/* Carousel View */}
      {isCarouselView && selectedScene ? (
        <div className="carousel-view">
          <div className="row" style={{ marginBottom: '16px' }}>
            <button type="button" onClick={handleBackToScenes}>
              ← Back to All Scenes
            </button>
            <span className="muted" style={{ marginLeft: 'auto' }}>
              Editing: {selectedScene.sceneId}
            </span>
          </div>

          {/* Scene Details */}
          <div className="subcard">
            <div className="formRow">
              <label htmlFor={`${selectedScene.sceneId}-goal`}>Goal Summary</label>
              <input
                id={`${selectedScene.sceneId}-goal`}
                value={selectedScene.goalSummary || ''}
                onChange={(event) => updateScene(selectedScene.sceneId, { goalSummary: event.target.value })}
              />
            </div>

            <div className="formRow">
              <label htmlFor={`${selectedScene.sceneId}-narrative`}>Narrative</label>
              <textarea
                id={`${selectedScene.sceneId}-narrative`}
                rows={2}
                value={selectedScene.narrative}
                onChange={(event) => updateScene(selectedScene.sceneId, { narrative: event.target.value })}
              />
            </div>

            {selectedScene.kind !== 'ending' && (
              <>
                <div className="formRow">
                  <label htmlFor={`${selectedScene.sceneId}-freeform`}>Allow Freeform</label>
                  <input
                    id={`${selectedScene.sceneId}-freeform`}
                    type="checkbox"
                    checked={selectedScene.inputPolicy?.allowFreeform ?? true}
                    onChange={(event) => updateScenePolicy(selectedScene.sceneId, { allowFreeform: event.target.checked })}
                  />
                </div>

                <div className="formRow">
                  <label htmlFor={`${selectedScene.sceneId}-limit`}>Invalid Limit</label>
                  <input
                    id={`${selectedScene.sceneId}-limit`}
                    type="number"
                    value={selectedScene.inputPolicy?.invalidAttemptLimit ?? 3}
                    onChange={(event) => updateScenePolicy(selectedScene.sceneId, { invalidAttemptLimit: Number(event.target.value) })}
                  />
                </div>

                <div className="formRow">
                  <label htmlFor={`${selectedScene.sceneId}-penalty`}>Invalid Penalty</label>
                  <input
                    id={`${selectedScene.sceneId}-penalty`}
                    type="number"
                    value={selectedScene.inputPolicy?.invalidPenalty ?? -1}
                    onChange={(event) => updateScenePolicy(selectedScene.sceneId, { invalidAttemptLimit: Number(event.target.value) })}
                  />
                </div>

                <div className="row" style={{ justifyContent: 'space-between', marginTop: '12px' }}>
                  <strong>Options ({selectedScene.avenues?.length || 0}/{MAX_AVENUES})</strong>
                  <div className="row">
                    <button
                      type="button"
                      onClick={() => generateSceneOptionsMutation.mutate(selectedScene.sceneId)}
                      disabled={generatingSceneId === selectedScene.sceneId || (selectedScene.avenues?.length || 0) >= MAX_AVENUES}
                      className="ai-btn"
                    >
                      {generatingSceneId === selectedScene.sceneId ? 'AI Generating...' : 'AI: Generate Options'}
                    </button>
                    <button
                      type="button"
                      onClick={() => addAvenue(selectedScene.sceneId)}
                      disabled={(selectedScene.avenues?.length || 0) >= MAX_AVENUES}
                    >
                      + Add Option
                    </button>
                  </div>
                </div>

                {generatingSceneId === selectedScene.sceneId && engagementMessage && (
                  <p className="engagement-message" role="status" aria-live="polite">
                    ✨ {engagementMessage}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Avenue Carousel */}
          {selectedScene.kind !== 'ending' && selectedScene.avenues && selectedScene.avenues.length > 0 && (
            <AvenueCarousel
              scene={selectedScene}
              onEditAvenue={handleEditAvenue}
              onRemoveAvenue={(avenueId) => removeAvenue(selectedScene.sceneId, avenueId)}
            />
          )}
        </div>
      ) : (
        /* Scene Grid View */
        <SceneCarousel
          scenes={editedGame.scenes || []}
          selectedSceneId={selectedSceneId}
          onSelectScene={handleSelectScene}
        />
      )}

      {/* Avenue Edit Modal */}
      <AvenueEditModal
        isOpen={editingAvenue !== null}
        scene={selectedScene || editedGame.scenes?.[0]}
        avenue={editingAvenue}
        allScenes={editedGame.scenes || []}
        onClose={handleCloseModal}
        onSave={handleSaveAvenue}
      />


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
