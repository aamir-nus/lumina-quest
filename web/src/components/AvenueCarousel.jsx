import { useRef, useCallback, useState, useEffect } from 'react';
import '../styles/carousel.css';

/**
 * @typedef {Object} Avenue
 * @property {string} avenueId
 * @property {string} label
 * @property {string} intent
 * @property {string} outcome
 * @property {number} scoreImpact
 * @property {number} points
 * @property {string} nextSceneId
 * @property {'ai_generated' | 'manual'} origin
 */

/**
 * @typedef {Object} Scene
 * @property {string} sceneId
 * @property {string} goalSummary
 * @property {string} kind
 * @property {string} [endingType]
 * @property {Avenue[]} avenues
 */

/**
 * @param {{
 *   scene: Scene;
 *   onEditAvenue: (avenue: Avenue) => void;
 *   onRemoveAvenue: (avenueId: string) => void;
 * }} props
 */
export function AvenueCarousel({ scene, onEditAvenue, onRemoveAvenue }) {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    setCanScrollLeft(track.scrollLeft > 0);
    setCanScrollRight(track.scrollLeft < track.scrollWidth - track.clientWidth);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    checkScrollability();
    track.addEventListener('scroll', checkScrollability);
    window.addEventListener('resize', checkScrollability);

    return () => {
      track.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [scene.avenues, checkScrollability]);

  const scroll = useCallback((direction) => {
    const track = trackRef.current;
    if (!track) return;

    const cardWidth = track.querySelector('.avenue-card')?.offsetWidth + 16 || 300;
    // Scroll by 3 cards at a time (showing next/previous set of 3)
    const cardsToShow = window.innerWidth >= 1200 ? 3 : window.innerWidth >= 900 ? 2 : 1;
    track.scrollBy({ left: direction * cardWidth * cardsToShow, behavior: 'smooth' });
  }, []);

  const getOutcomeIcon = useCallback((outcome) => {
    switch (outcome) {
      case 'success': return '✓';
      case 'fail': return '✗';
      default: return '◐';
    }
  }, []);

  const getOriginIcon = useCallback((avenue) => {
    if (avenue.origin === 'ai_generated') return '🤖';
    return '✏️';
  }, []);

  const getOriginLabel = useCallback((avenue) => {
    if (avenue.origin === 'ai_generated') return 'Generated';
    if (avenue.origin === 'manual') return 'Manual';
    return 'Manual'; // Default for undefined/other
  }, []);

  const getOriginClass = useCallback((avenue) => {
    if (avenue.origin === 'ai_generated') return 'ai-origin';
    return 'manual-origin';
  }, []);

  if (!scene || scene.kind === 'ending') {
    return (
      <div className="avenue-carousel-empty">
        <p>Ending scenes have no player options.</p>
      </div>
    );
  }

  const hasAvenues = scene.avenues && scene.avenues.length > 0;

  return (
    <div className="avenue-carousel">
      <div className="carousel-header">
        <div className="carousel-title-group">
          <h3>{scene.goalSummary || scene.sceneId}</h3>
          <span className="carousel-badge">
            {scene.avenues?.length || 0} options
          </span>
        </div>
      </div>

      <div className="avenue-carousel-wrapper">
        {canScrollLeft && (
          <button
            onClick={() => scroll(-1)}
            className="carousel-nav-btn prev"
            aria-label="Scroll left"
          >
            ◀
          </button>
        )}

        <div ref={trackRef} className="avenue-carousel-track">
          {hasAvenues ? (
            scene.avenues.map((avenue) => (
              <div
                key={avenue.avenueId}
                className={`avenue-card ${avenue.origin === 'ai_generated' ? 'ai-generated' : ''}`}
              >
                <div className="avenue-card-visual">
                  <span className="avenue-icon">{getOriginIcon(avenue)}</span>
                  <span className={`avenue-origin-badge ${getOriginClass(avenue)}`}>
                    {getOriginLabel(avenue)}
                  </span>
                  <span className="avenue-id-overlay">#{avenue.avenueId}</span>
                  <span className={`avenue-outcome-indicator ${avenue.outcome || 'partial'}`}>
                    {getOutcomeIcon(avenue.outcome)}
                  </span>
                </div>

                <div className="avenue-card-content">
                  <h4 className="avenue-card-label" data-full-text={avenue.label || 'Untitled Option'}>
                    {avenue.label || 'Untitled Option'}
                  </h4>
                  <p className="avenue-card-intent" data-full-text={avenue.intent || 'No intent specified'}>
                    {avenue.intent || 'No intent specified'}
                  </p>

                  <div className="avenue-card-stats">
                    <span className="avenue-stat-badge">
                      <span className="label">Points</span>
                      <span className="value">{avenue.scoreImpact ?? avenue.points ?? 0}</span>
                    </span>
                    <span className="avenue-stat-badge">
                      <span className="label">To</span>
                      <span className="value">{avenue.nextSceneId || 'End'}</span>
                    </span>
                  </div>

                  <div className="avenue-card-actions">
                    <button
                      onClick={() => onEditAvenue(avenue)}
                      className="avenue-action-btn avenue-edit-btn"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => onRemoveAvenue(avenue.avenueId)}
                  className="avenue-delete-btn"
                  aria-label="Delete option"
                >
                  🗑️
                </button>
              </div>
            ))
          ) : (
            <div className="avenue-carousel-empty">
              <p>No options yet. Add options to this scene.</p>
            </div>
          )}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scroll(1)}
            className="carousel-nav-btn next"
            aria-label="Scroll right"
          >
            ▶
          </button>
        )}
      </div>
    </div>
  );
}
