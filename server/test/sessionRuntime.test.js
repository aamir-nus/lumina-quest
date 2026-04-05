import test from 'node:test';
import assert from 'node:assert/strict';
import { applyInvalidAttempt, buildDiegeticFailureMessage, resetInvalidAttempts } from '../src/services/sessionFailurePolicy.js';
import { findExactAvenueMatch } from '../src/services/sessionInputResolver.js';

test('findExactAvenueMatch ignores case and punctuation', () => {
  const match = findExactAvenueMatch('  TALK past the wardens!! ', [
    { avenueId: 'a1', label: 'Talk past the wardens' },
    { avenueId: 'a2', label: 'Slip under a wagon' }
  ]);

  assert.equal(match?.avenueId, 'a1');
});

test('applyInvalidAttempt increments counters and loses on third strike', () => {
  const session = {
    status: 'active',
    endReason: '',
    stats: { points: 0, turnsUsed: 0 },
    invalidAttemptsByScene: {}
  };
  const scene = {
    sceneId: 'scene_start',
    inputPolicy: { invalidAttemptLimit: 3, invalidPenalty: -1 }
  };

  const first = applyInvalidAttempt({ session, scene });
  const second = applyInvalidAttempt({ session, scene });
  const third = applyInvalidAttempt({ session, scene });

  assert.equal(first.remaining, 2);
  assert.equal(second.remaining, 1);
  assert.equal(third.lost, true);
  assert.equal(session.status, 'lost');
  assert.equal(session.endReason, 'invalid_attempt_limit');
  assert.equal(session.stats.points, -3);
  assert.equal(buildDiegeticFailureMessage({ lost: third.lost, remaining: third.remaining }).length > 0, true);
});

test('resetInvalidAttempts clears the current scene counter', () => {
  const session = {
    invalidAttemptsByScene: { scene_start: 2 }
  };

  resetInvalidAttempts(session, 'scene_start');
  assert.equal(session.invalidAttemptsByScene.scene_start, 0);
});
