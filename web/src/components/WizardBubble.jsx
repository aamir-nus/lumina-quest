import { useState } from 'react';

/**
 * 8-bit wizard dialogue bubble with bobbing animation
 * @param {{ narrative: string, lastResolution: any }} props
 */
export function WizardBubble({ narrative, lastResolution }) {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="wizardBubble">
      {/* Dialogue Bubble */}
      <div className="speechBubble">
        <p>{narrative}</p>
      </div>

      {/* 8-bit Wizard with bobbing animation */}
      <div className="wizardSprite">
        <div className="wizardBody">
          <div className="wizardHat">
            <div className="hatBrim"></div>
            <div className="hatTop"></div>
            <div className="hatStar">✦</div>
          </div>
          <div className="wizardFace">
            <div className="wizardEye left">•</div>
            <div className="wizardEye right">•</div>
            <div className="wizardBeard">
              <div className="beardRow"></div>
              <div className="beardRow"></div>
              <div className="beardRow"></div>
            </div>
          </div>
          <div className="wizardRobe">
            <div className="robeFold"></div>
          </div>
        </div>
      </div>

      {/* Broomstick debug icon */}
      {lastResolution && (
        <div
          className="broomstickIcon"
          onMouseEnter={() => setShowDebug(true)}
          onMouseLeave={() => setShowDebug(false)}
          tabIndex={0}
          onFocus={() => setShowDebug(true)}
          onBlur={() => setShowDebug(false)}
          aria-label="Show route debug info"
        >
          🧹
          {showDebug && (
            <div className="debugTooltip">
              <div className="debugHeader">
                <strong>Route: {lastResolution.type || 'avenue'}</strong>
                <span className="confidence">{Number(lastResolution.confidence || 0).toFixed(2)}</span>
              </div>
              {lastResolution.matchedBy ? (
                <p className="debugProvider">Matched by: {lastResolution.matchedBy}</p>
              ) : null}
              <p className="debugExplanation">{lastResolution.explanation}</p>
              {lastResolution.wildcardMode && (
                <p className="debugWildcard">Wildcard: {lastResolution.wildcardMode}</p>
              )}
              {lastResolution.llm?.provider && (
                <p className="debugProvider">Provider: {lastResolution.llm.provider}</p>
              )}
              <div className="debugMetrics">
                <span>📊 {lastResolution.llm?.tokens?.totalTokens || 0} tokens</span>
                <span>⚡ {Number(lastResolution.llm?.computeApprox?.latencyMs || 0).toFixed(0)}ms</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
