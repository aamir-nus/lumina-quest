import { useState, useEffect, useCallback } from 'react';
import '../styles/carousel.css';

/**
 * @typedef {Object} Avenue
 * @property {string} avenueId
 * @property {string} label
 * @property {string} intent
 * @property {string} outcome
 * @property {number} scoreImpact
 * @property {number} points
 * @property {string[]} keywords
 * @property {string} nextSceneId
 * @property {'ai_generated' | 'manual'} origin
 */

/**
 * @typedef {Object} Scene
 * @property {string} sceneId
 * @property {Avenue[]} avenues
 */

/**
 * @param {{
 *   isOpen: boolean;
 *   scene: Scene;
 *   avenue: Avenue | null;
 *   allScenes: Scene[];
 *   onClose: () => void;
 *   onSave: (avenueId: string, updates: Partial<Avenue>) => void;
 * }} props
 */
export function AvenueEditModal({ isOpen, scene, avenue, allScenes, onClose, onSave }) {
  const [label, setLabel] = useState('');
  const [intent, setIntent] = useState('');
  const [outcome, setOutcome] = useState('partial');
  const [scoreImpact, setScoreImpact] = useState(0);
  const [keywords, setKeywords] = useState('');
  const [nextSceneId, setNextSceneId] = useState('');

  // Reset form when avenue changes
  useEffect(() => {
    if (avenue) {
      setLabel(avenue.label || '');
      setIntent(avenue.intent || '');
      setOutcome(avenue.outcome || 'partial');
      setScoreImpact(avenue.scoreImpact ?? avenue.points ?? 0);
      setKeywords(Array.isArray(avenue.keywords) ? avenue.keywords.join(', ') : '');
      setNextSceneId(avenue.nextSceneId || '');
    }
  }, [avenue]);

  const handleSave = useCallback(() => {
    if (!avenue) return;

    const keywordArray = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    onSave(avenue.avenueId, {
      label,
      intent,
      outcome,
      scoreImpact: Number(scoreImpact),
      points: Number(scoreImpact),
      keywords: keywordArray,
      nextSceneId: nextSceneId || null,
    });

    onClose();
  }, [avenue, label, intent, outcome, scoreImpact, keywords, nextSceneId, onSave, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && e.ctrlKey) handleSave();
  }, [onClose, handleSave]);

  // Keyboard handler for modal
  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !avenue) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="avenue-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="avenue-modal-header">
          <h3>Edit Option: {avenue.avenueId}</h3>
          <button onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="avenue-modal-body">
          <div className="avenue-form-section">
            <label htmlFor="avenue-label">Option Label</label>
            <input
              id="avenue-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., 'Enter through the main door'"
            />
          </div>

          <div className="avenue-form-row">
            <div className="avenue-form-group">
              <label htmlFor="avenue-outcome">Outcome</label>
              <select
                id="avenue-outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              >
                <option value="success">Success</option>
                <option value="partial">Partial</option>
                <option value="fail">Fail</option>
              </select>
            </div>

            <div className="avenue-form-group">
              <label htmlFor="avenue-score">Score Impact</label>
              <input
                id="avenue-score"
                type="number"
                value={scoreImpact}
                onChange={(e) => setScoreImpact(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="avenue-form-section">
            <label htmlFor="avenue-intent">Intent</label>
            <input
              id="avenue-intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g., 'bold_approach', 'cautious_investigation'"
            />
          </div>

          <div className="avenue-form-section">
            <label htmlFor="avenue-keywords">Keywords (comma-separated)</label>
            <input
              id="avenue-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g., door, enter, main"
            />
          </div>

          <div className="avenue-form-section">
            <label htmlFor="avenue-next-scene">Next Scene</label>
            <select
              id="avenue-next-scene"
              value={nextSceneId}
              onChange={(e) => setNextSceneId(e.target.value)}
            >
              {allScenes.map((s) => (
                <option key={s.sceneId} value={s.sceneId}>
                  {s.sceneId}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="avenue-modal-footer">
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>
          <button onClick={handleSave} className="save-btn">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
