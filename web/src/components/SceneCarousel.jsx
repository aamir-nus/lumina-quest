import { useCallback } from 'react';
import '../styles/carousel.css';

/**
 * @typedef {Object} Scene
 * @property {string} sceneId
 * @property {string} goalSummary
 * @property {string} narrative
 * @property {string} kind
 * @property {string} [endingType]
 * @property {Array} avenues
 */

/**
 * @param {{
 *   scenes: Scene[];
 *   selectedSceneId: string | null;
 *   onSelectScene: (sceneId: string) => void;
 * }} props
 */
export function SceneCarousel({ scenes, selectedSceneId, onSelectScene }) {
  const getSceneIcon = useCallback((scene) => {
    if (scene.kind === 'ending') {
      return scene.endingType === 'win' ? '🏆' : '💀';
    }
    if (scene.avenues && scene.avenues.length > 0) {
      return '📖';
    }
    return '📍';
  }, []);

  const getSceneTypeLabel = useCallback((scene) => {
    if (scene.kind === 'ending') {
      return scene.endingType === 'win' ? 'Victory' : 'Defeat';
    }
    return 'Story';
  }, []);

  return (
    <div className="scene-carousel">
      <h2 className="scene-carousel-title">Select a Scene to Edit</h2>
      <div className="scene-grid">
        {scenes.map((scene) => (
          <div
            key={scene.sceneId}
            className={`scene-card ${selectedSceneId === scene.sceneId ? 'active' : ''}`}
            onClick={() => onSelectScene(scene.sceneId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectScene(scene.sceneId);
              }
            }}
            role="button"
            tabIndex={0}
            aria-pressed={selectedSceneId === scene.sceneId}
          >
            <div className="scene-card-header">
              <span className="scene-card-icon">{getSceneIcon(scene)}</span>
              <span className="scene-card-id">{scene.sceneId}</span>
            </div>

            <h3 className="scene-card-name">
              {scene.goalSummary || 'Untitled Scene'}
            </h3>

            <p className="scene-card-narrative">
              {scene.narrative || 'No narrative provided.'}
            </p>

            <div className="scene-card-meta">
              <span className="scene-meta-tag">
                {getSceneTypeLabel(scene)}
              </span>
              <span className="scene-meta-tag">
                {scene.avenues?.length || 0} options
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
