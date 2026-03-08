import { UI } from '../constants/ui';

export function GraphCanvas({ game }) {
  if (!game) {
    return <p className="muted">Select a game to see graph layout.</p>;
  }

  const scenes = game.scenes || [];
  const width = 300;
  const height = Math.max(UI.GRAPH_MIN_HEIGHT, scenes.length * (UI.GRAPH_STEP_Y + 10));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="graphCanvas" role="img" aria-label="Scene graph">
      {scenes.map((scene, index) => {
        const y = UI.GRAPH_BASE_Y + index * UI.GRAPH_STEP_Y;
        return (
          <g key={scene.sceneId}>
            <rect x="10" y={y - 18} width="110" height="36" rx="8" className="graphNode" />
            <text x="18" y={y + 4} className="graphNodeText">{scene.sceneId}</text>
            {(scene.avenues || []).map((avenue, avenueIndex) => {
              const targetIndex = scenes.findIndex((item) => item.sceneId === avenue.nextSceneId);
              if (targetIndex < 0) return null;
              const targetY = UI.GRAPH_BASE_Y + targetIndex * UI.GRAPH_STEP_Y;
              return (
                <line
                  key={`${scene.sceneId}-${avenue.avenueId}`}
                  x1={120}
                  y1={y + avenueIndex * 3}
                  x2={190}
                  y2={targetY}
                  className="graphEdge"
                />
              );
            })}
          </g>
        );
      })}
      {scenes.map((scene, index) => {
        const y = UI.GRAPH_BASE_Y + index * UI.GRAPH_STEP_Y;
        return (
          <text key={`${scene.sceneId}-target`} x="198" y={y + 4} className="graphTargetText">
            {scene.isTerminal ? `${scene.sceneId} (terminal)` : scene.sceneId}
          </text>
        );
      })}
    </svg>
  );
}
