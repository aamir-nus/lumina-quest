import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGameTemplate } from '../src/services/gameTemplateNormalizer.js';
import { validateGameTemplate } from '../src/services/gameTemplateValidator.js';
import { getExpectedOptionRange } from '../src/services/optionCountGenerator.js';

test('normalizeGameTemplate preserves legacy templates with defaults', () => {
  const normalized = normalizeGameTemplate({
    title: 'Legacy Quest',
    description: 'old shape',
    constraints: { maxTurns: 3, targetPoints: 1 },
    wildcardConfig: { enabled: false, recoverySceneId: '' },
    startSceneId: 'scene_start',
    scenes: [
      {
        sceneId: 'scene_start',
        narrative: 'Begin here',
        isTerminal: false,
        avenues: [{ avenueId: 'a1', label: 'Go', points: 1, nextSceneId: 'scene_end' }]
      },
      {
        sceneId: 'scene_end',
        narrative: 'Done',
        isTerminal: true,
        avenues: []
      }
    ]
  });

  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.scenes[0].kind, 'start');
  assert.equal(normalized.scenes[0].avenues[0].scoreImpact, 1);
  assert.equal(normalized.scenes[1].kind, 'ending');
});

test('validateGameTemplate accepts a minimal publishable v2 game', () => {
  const optionRange = getExpectedOptionRange('easy');
  const optionCount = optionRange.min;
  const makeAvenues = (prefix, nextSuccess, includeFail = false) => {
    const avenues = [
      { avenueId: `${prefix}_1`, label: 'Success', intent: 'success', outcome: 'success', points: 1, scoreImpact: 1, keywords: ['success'], nextSceneId: nextSuccess },
      { avenueId: `${prefix}_2`, label: 'Partial', intent: 'partial', outcome: 'partial', points: 0, scoreImpact: 0, keywords: ['partial'], nextSceneId: nextSuccess },
    ];
    if (includeFail) {
      avenues.push({ avenueId: `${prefix}_3`, label: 'Fail', intent: 'fail', outcome: 'fail', points: -1, scoreImpact: -1, keywords: ['fail'], nextSceneId: 'scene_fail' });
      // When including fail, use min 3 to ensure it's included
      return avenues.slice(0, Math.max(optionCount, 3));
    }
    return avenues.slice(0, optionCount);
  };

  const inputPolicy = { allowFreeform: true, invalidAttemptLimit: 3, invalidPenalty: -1 };

  const result = validateGameTemplate({
    schemaVersion: 2,
    title: 'V2 Quest',
    description: '',
    storyConfig: { premise: 'premise', startGoal: 'start', endGoal: 'end', tone: 'cinematic', difficulty: 'easy' },
    generationState: { status: 'options_ready', pendingSceneIds: [], lastError: '', debug: [] },
    constraints: { maxTurns: 6, targetPoints: 2 },
    wildcardConfig: { enabled: false, recoverySceneId: '' },
    startSceneId: 'scene_start',
    scenes: [
      { sceneId: 'scene_start', kind: 'start', stepIndex: 0, goalSummary: 'start', narrative: 'start', inputPolicy, avenues: makeAvenues('start', 'scene_1', true) },
      { sceneId: 'scene_1', kind: 'beat', stepIndex: 1, goalSummary: 'beat1', narrative: 'beat1', inputPolicy, avenues: makeAvenues('beat1', 'scene_2', true) },
      { sceneId: 'scene_2', kind: 'beat', stepIndex: 2, goalSummary: 'beat2', narrative: 'beat2', inputPolicy, avenues: makeAvenues('beat2', 'scene_3', true) },
      { sceneId: 'scene_3', kind: 'beat', stepIndex: 3, goalSummary: 'beat3', narrative: 'beat3', inputPolicy, avenues: [
        { avenueId: 'beat3_1', label: 'Win', intent: 'win', outcome: 'success', points: 1, scoreImpact: 1, keywords: ['win'], nextSceneId: 'scene_win' },
        { avenueId: 'beat3_2', label: 'Continue', intent: 'continue', outcome: 'partial', points: 0, scoreImpact: 0, keywords: ['continue'], nextSceneId: 'scene_win' }
      ] },
      { sceneId: 'scene_win', kind: 'ending', stepIndex: 4, goalSummary: 'win', narrative: 'win', isTerminal: true, endingType: 'win', avenues: [] },
      { sceneId: 'scene_fail', kind: 'ending', stepIndex: 5, goalSummary: 'fail', narrative: 'fail', isTerminal: true, endingType: 'fail', avenues: [] }
    ]
  }, { mode: 'publish' });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateGameTemplate rejects v2 games with fewer than three beats', () => {
  const result = validateGameTemplate({
    schemaVersion: 2,
    title: 'Short Quest',
    description: '',
    storyConfig: { premise: 'premise', startGoal: 'start', endGoal: 'end', tone: 'cinematic', difficulty: 'easy' },
    generationState: { status: 'flow_ready', pendingSceneIds: [], lastError: '', debug: [] },
    constraints: { maxTurns: 4, targetPoints: 1 },
    wildcardConfig: { enabled: false, recoverySceneId: '' },
    startSceneId: 'scene_start',
    scenes: [
      { sceneId: 'scene_start', kind: 'start', stepIndex: 0, goalSummary: 'start', narrative: 'start', avenues: [] },
      { sceneId: 'scene_1', kind: 'beat', stepIndex: 1, goalSummary: 'beat1', narrative: 'beat1', avenues: [] },
      { sceneId: 'scene_2', kind: 'beat', stepIndex: 2, goalSummary: 'beat2', narrative: 'beat2', avenues: [] },
      { sceneId: 'scene_win', kind: 'ending', stepIndex: 3, goalSummary: 'win', narrative: 'win', isTerminal: true, endingType: 'win', avenues: [] },
      { sceneId: 'scene_fail', kind: 'ending', stepIndex: 4, goalSummary: 'fail', narrative: 'fail', isTerminal: true, endingType: 'fail', avenues: [] }
    ]
  }, { mode: 'draft' });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /3-10 beat scenes/);
});
