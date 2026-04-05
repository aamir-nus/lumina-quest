/**
 * @param {{ transition?: string }} props
 */
export function SceneTransitionOverlay({ transition }) {
  if (!transition) return null;
  return <div className={`transitionOverlay ${transition}`}><span className="sr-only">transition: {transition}</span></div>;
}
