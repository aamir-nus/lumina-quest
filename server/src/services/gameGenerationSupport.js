import { getDifficultyConfig } from './promptBuilders/gameFlowPromptBuilder.js';

export function createDebugEntry({ phase, attempt, ok, summary, provider = 'lmstudio', model = '', sceneId = '' }) {
  return {
    phase,
    sceneId,
    attempt,
    ok,
    summary,
    provider,
    model,
    createdAt: new Date().toISOString()
  };
}

export function createBaseScene({
  sceneId,
  kind,
  stepIndex,
  narrative,
  goalSummary,
  endingType
}) {
  return {
    sceneId,
    kind,
    stepIndex,
    goalSummary,
    narrative,
    imageKey: '',
    isTerminal: kind === 'ending',
    endingType,
    inputPolicy: {
      allowFreeform: kind !== 'ending',
      invalidAttemptLimit: 3,
      invalidPenalty: -1
    },
    renderConfig: {
      theme: endingType === 'fail' ? 'crimson' : endingType === 'win' ? 'victory' : 'pastel',
      backgroundLayers: [],
      foregroundLayers: [],
      sprite: { id: 'hero', mood: endingType === 'fail' ? 'focused' : 'neutral', x: 0.5, y: 0.82 }
    },
    avenues: []
  };
}

export function buildFlowTemplate({ title, description, storyConfig, start, beats, endings }) {
  const difficultyConfig = getDifficultyConfig(storyConfig.difficulty);
  const baseScenes = [
    createBaseScene({
      sceneId: start.sceneId || 'scene_start',
      kind: 'start',
      stepIndex: 0,
      narrative: start.narrative,
      goalSummary: start.goalSummary
    }),
    ...beats.map((beat, index) =>
      createBaseScene({
        sceneId: beat.sceneId || `scene_${index + 1}`,
        kind: 'beat',
        stepIndex: index + 1,
        narrative: beat.narrative,
        goalSummary: beat.goalSummary
      })
    ),
    ...endings.map((ending, index) =>
      createBaseScene({
        sceneId: ending.sceneId || `scene_end_${index + 1}`,
        kind: 'ending',
        stepIndex: beats.length + index + 1,
        narrative: ending.narrative,
        goalSummary: ending.goalSummary,
        endingType: ending.endingType === 'fail' ? 'fail' : 'win'
      })
    )
  ];

  return {
    schemaVersion: 2,
    title,
    description,
    storyConfig,
    authoringWarnings: [],
    generationState: {
      status: 'flow_ready',
      pendingSceneIds: baseScenes.filter((scene) => scene.kind !== 'ending').map((scene) => scene.sceneId),
      lastError: '',
      debug: []
    },
    constraints: {
      maxTurns: difficultyConfig.maxBeats + 2,
      targetPoints: difficultyConfig.optionCount + Math.max(1, beats.length - 1)
    },
    wildcardConfig: {
      enabled: false,
      recoverySceneId: '',
      highRewardPoints: 2,
      lowRewardPoints: 0
    },
    status: 'draft',
    startSceneId: baseScenes[0]?.sceneId || 'scene_start',
    scenes: baseScenes
  };
}

export function makeAvenueId(sceneId, index) {
  return `${sceneId}_option_${index + 1}`;
}
