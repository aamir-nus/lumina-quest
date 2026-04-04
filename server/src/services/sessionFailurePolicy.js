function getCounter(session, sceneId) {
  const counters = session.invalidAttemptsByScene || {};
  if (typeof counters.get === 'function') {
    return Number(counters.get(sceneId) || 0);
  }
  return Number(counters[sceneId] || 0);
}

function setCounter(session, sceneId, value) {
  const counters = session.invalidAttemptsByScene;
  if (counters && typeof counters.set === 'function') {
    counters.set(sceneId, value);
    session.markModified?.('invalidAttemptsByScene');
    return;
  }

  const next = { ...(session.invalidAttemptsByScene || {}) };
  next[sceneId] = value;
  session.invalidAttemptsByScene = next;
}

export function resetInvalidAttempts(session, sceneId) {
  setCounter(session, sceneId, 0);
}

export function applyInvalidAttempt({ session, scene }) {
  const limit = Number(scene.inputPolicy?.invalidAttemptLimit ?? 3);
  const penalty = Number(scene.inputPolicy?.invalidPenalty ?? -1);
  const currentCount = getCounter(session, scene.sceneId);
  const nextCount = currentCount + 1;

  session.stats.points += penalty;
  setCounter(session, scene.sceneId, nextCount);

  const lost = nextCount >= limit;
  if (lost) {
    session.status = 'lost';
    session.endReason = 'invalid_attempt_limit';
  }

  return {
    penalty,
    nextCount,
    limit,
    lost,
    remaining: Math.max(0, limit - nextCount)
  };
}

export function getInvalidAttemptState(session, sceneId, fallbackLimit = 3) {
  const used = getCounter(session, sceneId);
  return {
    used,
    remaining: Math.max(0, fallbackLimit - used)
  };
}

export function buildDiegeticFailureMessage({ lost, remaining }) {
  if (lost) {
    return 'You lose your footing in the moment, and the opportunity is gone.';
  }
  if (remaining === 1) {
    return 'That approach stalls the moment. One more mistake and the scene collapses around you.';
  }
  return 'That approach does not move the situation forward.';
}
