import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';

const MAX_SCENES = 10;
const MAX_AVENUES = 3;

/**
 * @param {{ game: any, onSave: (game: any) => void, onCancel: () => void }} props
 */
export function GameEditor({ game, onSave, onCancel }) {
  const [editedGame, setEditedGame] = useState(() => JSON.parse(JSON.stringify(game)));
  const [expandedScenes, setExpandedScenes] = useState(new Set([game.scenes[0]?.sceneId]));
  // Local state for keyword inputs to preserve typing
  const [keywordInputValues, setKeywordInputValues] = useState({});

  // Initialize keyword input values when game changes
  useEffect(() => {
    const initialValues = {};
    editedGame.scenes?.forEach((scene) => {
      scene.avenues?.forEach((avenue) => {
        const key = `${scene.sceneId}-${avenue.avenueId}`;
        initialValues[key] = Array.isArray(avenue.keywords) ? avenue.keywords.join(', ') : '';
      });
    });
    setKeywordInputValues(initialValues);
  }, [editedGame._id]); // Only re-init when game ID changes

  const updateMutation = useMutation({
    mutationFn: async (updatedGame) => {
      const { data } = await api.put(`/games/${updatedGame._id}`, updatedGame);
      return data.game;
    },
    onSuccess: (updatedGame) => {
      onSave(updatedGame);
    }
  });

  const toggleScene = (sceneId) => {
    const next = new Set(expandedScenes);
    if (next.has(sceneId)) {
      next.delete(sceneId);
    } else {
      next.add(sceneId);
    }
    setExpandedScenes(next);
  };

  const updateScene = (sceneId, updates) => {
    setEditedGame((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) =>
        s.sceneId === sceneId ? { ...s, ...updates } : s
      )
    }));
  };

  const updateAvenue = (sceneId, avenueId, updates) => {
    setEditedGame((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) =>
        s.sceneId === sceneId
          ? {
              ...s,
              avenues: s.avenues.map((a) =>
                a.avenueId === avenueId ? { ...a, ...updates } : a
              )
            }
          : s
      )
    }));
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
    const keywords = inputValue
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    updateAvenue(sceneId, avenueId, { keywords });
  };

  const addAvenue = (sceneId) => {
    const scene = editedGame.scenes.find((s) => s.sceneId === sceneId);
    if (scene.avenues.length >= MAX_AVENUES) return;

    const newAvenueId = `a_${Date.now()}`;
    const newKey = `${sceneId}-${newAvenueId}`;

    updateScene(sceneId, {
      avenues: [
        ...scene.avenues,
        {
          avenueId: newAvenueId,
          label: 'New option',
          keywords: [],
          points: 1,
          nextSceneId: editedGame.scenes[editedGame.scenes.length - 1]?.sceneId || '',
          visualEffects: {
            transition: 'fade',
            spriteMood: 'neutral',
            setTheme: '',
            enableLayers: [],
            disableLayers: []
          }
        }
      ]
    });

    // Initialize the new input
    setKeywordInputValues((prev) => ({
      ...prev,
      [newKey]: ''
    }));
  };

  const removeAvenue = (sceneId, avenueId) => {
    const scene = editedGame.scenes.find((s) => s.sceneId === sceneId);
    if (scene.avenues.length <= 2) return; // Keep minimum 2 options

    const key = `${sceneId}-${avenueId}`;
    updateScene(sceneId, {
      avenues: scene.avenues.filter((a) => a.avenueId !== avenueId)
    });

    // Clean up the input state
    setKeywordInputValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = () => {
    // Commit any pending keyword changes before saving
    editedGame.scenes?.forEach((scene) => {
      scene.avenues?.forEach((avenue) => {
        const key = `${scene.sceneId}-${avenue.avenueId}`;
        const inputValue = keywordInputValues[key];
        if (inputValue !== undefined) {
          const keywords = inputValue
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0);
          avenue.keywords = keywords;
        }
      });
    });

    updateMutation.mutate(editedGame);
  };

  const getKeywordInputValue = (sceneId, avenueId, avenueKeywords) => {
    const key = `${sceneId}-${avenueId}`;
    // If we have a local input value, use it; otherwise use the keywords from the game
    if (key in keywordInputValues) {
      return keywordInputValues[key];
    }
    return Array.isArray(avenueKeywords) ? avenueKeywords.join(', ') : '';
  };

  return (
    <div className="subcard">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Edit: {editedGame.title}</h3>
        <div className="row" style={{ gap: '8px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={updateMutation.isPending}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="list">
        {editedGame.scenes.map((scene, idx) => (
          <div key={scene.sceneId} className="card">
            <div className="row" onClick={() => toggleScene(scene.sceneId)} style={{ cursor: 'pointer' }}>
              <strong>{idx + 1}. {scene.sceneId}</strong>
              <span className="muted">{scene.isTerminal ? '[END]' : '[SCENE]'}</span>
              <button type="button" onClick={() => toggleScene(scene.sceneId)}>
                {expandedScenes.has(scene.sceneId) ? '▼' : '▶'}
              </button>
            </div>

            {expandedScenes.has(scene.sceneId) && (
              <>
                <div className="row">
                  <label htmlFor={`narrative-${scene.sceneId}`}>Narrative</label>
                </div>
                <textarea
                  id={`narrative-${scene.sceneId}`}
                  value={scene.narrative}
                  onChange={(e) => updateScene(scene.sceneId, { narrative: e.target.value })}
                  rows={3}
                  style={{ width: '100%', marginBottom: '10px' }}
                />

                <div className="row">
                  <label htmlFor={`isTerminal-${scene.sceneId}`}>Terminal Scene?</label>
                  <input
                    id={`isTerminal-${scene.sceneId}`}
                    type="checkbox"
                    checked={scene.isTerminal}
                    onChange={(e) => updateScene(scene.sceneId, { isTerminal: e.target.checked })}
                  />
                </div>

                {!scene.isTerminal && (
                  <>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <strong>Options ({scene.avenues.length}/{MAX_AVENUES})</strong>
                      {scene.avenues.length < MAX_AVENUES && (
                        <button type="button" onClick={() => addAvenue(scene.sceneId)}>+ Add Option</button>
                      )}
                    </div>

                    {scene.avenues.map((avenue) => {
                      const inputKey = `${scene.sceneId}-${avenue.avenueId}`;
                      const currentInputValue = getKeywordInputValue(scene.sceneId, avenue.avenueId, avenue.keywords);
                      const keywordCount = currentInputValue
                        .split(',')
                        .map(k => k.trim())
                        .filter(k => k.length > 0).length;

                      return (
                        <div key={avenue.avenueId} className="subcard">
                          <div className="row">
                            <input
                              value={avenue.label}
                              onChange={(e) => updateAvenue(scene.sceneId, avenue.avenueId, { label: e.target.value })}
                              placeholder="Option label"
                              style={{ flex: 1 }}
                            />
                            <input
                              type="number"
                              value={avenue.points}
                              onChange={(e) => updateAvenue(scene.sceneId, avenue.avenueId, { points: Number(e.target.value) })}
                              placeholder="Points"
                              style={{ width: '70px' }}
                            />
                            {scene.avenues.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeAvenue(scene.sceneId, avenue.avenueId)}
                                className="delete-btn"
                              >
                                ×
                              </button>
                            )}
                          </div>
                          <div className="row">
                            <input
                              value={currentInputValue}
                              onChange={(e) => handleKeywordInputChange(scene.sceneId, avenue.avenueId, e.target.value)}
                              onBlur={() => handleKeywordInputBlur(scene.sceneId, avenue.avenueId)}
                              placeholder="Keywords (comma separated: sword, magic, shield)"
                              style={{ flex: 1 }}
                            />
                            <span className="keywordCount">
                              {keywordCount} keyword{keywordCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="row">
                            <label>Next Scene:</label>
                            <select
                              value={avenue.nextSceneId}
                              onChange={(e) => updateAvenue(scene.sceneId, avenue.avenueId, { nextSceneId: e.target.value })}
                            >
                              {editedGame.scenes.map((s) => (
                                <option key={s.sceneId} value={s.sceneId}>{s.sceneId}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
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
    </div>
  );
}
