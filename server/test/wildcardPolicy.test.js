import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWildcard } from '../src/services/wildcardPolicyService.js';

test('wildcard policy clamps destination and points', () => {
  const game = {
    wildcardConfig: { enabled: true, recoverySceneId: 'recovery', highRewardPoints: 9, lowRewardPoints: -9 }
  };
  const currentScene = {
    sceneId: 's1',
    avenues: [
      { avenueId: 'a1', nextSceneId: 's2' },
      { avenueId: 'a2', nextSceneId: 's3' }
    ]
  };

  const result = evaluateWildcard({
    game,
    currentScene,
    candidate: { destinationSceneId: 'unknown', mode: 'high-reward' }
  });

  assert.equal(result.approved, true);
  assert.equal(result.mode, 'high-reward');
  assert.equal(result.pointsDelta <= 5, true);
  assert.equal(['s1', 's2', 's3', 'recovery'].includes(result.destinationSceneId), true);
});
