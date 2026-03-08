export function GameStage({ scene, visualState }) {
  if (!scene) return null;

  const render = scene.renderConfig || {};
  const activeLayers = visualState?.activeLayers?.length
    ? visualState.activeLayers
    : [...(render.backgroundLayers || []), ...(render.foregroundLayers || [])];

  return (
    <section className={`gameStage theme-${visualState?.theme || render.theme || 'pastel'}`}>
      <div className="stageLayers">
        {(render.backgroundLayers || []).map((layer) => (
          <div
            key={`bg-${layer}`}
            className={`layerTile bg ${activeLayers.includes(layer) ? 'on' : 'off'}`}
            data-layer={layer}
          >
            {layer}
          </div>
        ))}
        <div className="sprite" data-mood={visualState?.spriteMood || render.sprite?.mood || 'neutral'}>
          <span>{render.sprite?.id || 'hero'}</span>
          <small>{visualState?.spriteMood || render.sprite?.mood || 'neutral'}</small>
        </div>
        {(render.foregroundLayers || []).map((layer) => (
          <div
            key={`fg-${layer}`}
            className={`layerTile fg ${activeLayers.includes(layer) ? 'on' : 'off'}`}
            data-layer={layer}
          >
            {layer}
          </div>
        ))}
      </div>
      <p className="muted">scene: {scene.sceneId}</p>
    </section>
  );
}
