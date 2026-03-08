export function SceneTransitionOverlay({ transition }) {
  if (!transition) return null;
  return <div className={`transitionOverlay ${transition}`}>transition: {transition}</div>;
}
