function toPlain(game) {
  if (!game) return null;
  if (typeof game.toObject === 'function') {
    return game.toObject({ depopulate: true });
  }
  return JSON.parse(JSON.stringify(game));
}

function normalizeAvenue(avenue = {}, index = 0) {
  const scoreImpact = Number.isFinite(avenue.scoreImpact) ? avenue.scoreImpact : Number(avenue.points ?? 0);
  return {
    avenueId: avenue.avenueId || `avenue_${index}`,
    label: avenue.label || avenue.intent || 'Continue',
    intent: avenue.intent || avenue.label || 'Continue',
    outcome: avenue.outcome || (scoreImpact > 0 ? 'success' : scoreImpact < 0 ? 'fail' : 'partial'),
    keywords: Array.isArray(avenue.keywords) ? avenue.keywords : [],
    points: scoreImpact,
    scoreImpact,
    nextSceneId: avenue.nextSceneId || '',
    visualEffects: {
      transition: avenue.visualEffects?.transition || 'fade',
      spriteMood: avenue.visualEffects?.spriteMood || '',
      setTheme: avenue.visualEffects?.setTheme || '',
      enableLayers: avenue.visualEffects?.enableLayers || [],
      disableLayers: avenue.visualEffects?.disableLayers || []
    }
  };
}

function normalizeScene(scene = {}, index = 0) {
  const kind = scene.kind || (index === 0 ? 'start' : scene.isTerminal ? 'ending' : 'beat');
  const isTerminal = Boolean(scene.isTerminal || kind === 'ending');
  return {
    sceneId: scene.sceneId || `scene_${index}`,
    kind,
    stepIndex: Number.isFinite(scene.stepIndex) ? scene.stepIndex : index,
    goalSummary: scene.goalSummary || scene.narrative || '',
    narrative: scene.narrative || 'You move deeper into the story.',
    imageKey: scene.imageKey || '',
    isTerminal,
    endingType: scene.endingType || (isTerminal ? 'win' : undefined),
    inputPolicy: {
      allowFreeform: scene.inputPolicy?.allowFreeform ?? true,
      invalidAttemptLimit: Number(scene.inputPolicy?.invalidAttemptLimit ?? 3),
      invalidPenalty: Number(scene.inputPolicy?.invalidPenalty ?? -1)
    },
    renderConfig: {
      theme: scene.renderConfig?.theme || 'pastel',
      backgroundLayers: scene.renderConfig?.backgroundLayers || [],
      foregroundLayers: scene.renderConfig?.foregroundLayers || [],
      sprite: {
        id: scene.renderConfig?.sprite?.id || 'hero',
        mood: scene.renderConfig?.sprite?.mood || 'neutral',
        x: Number(scene.renderConfig?.sprite?.x ?? 0.5),
        y: Number(scene.renderConfig?.sprite?.y ?? 0.82)
      }
    },
    avenues: (scene.avenues || []).map(normalizeAvenue)
  };
}

export function normalizeGameTemplate(game) {
  const plain = toPlain(game);
  if (!plain) return null;

  const schemaVersion = Number(plain.schemaVersion || 1);
  const scenes = (plain.scenes || []).map(normalizeScene);
  const startSceneId = plain.startSceneId || scenes[0]?.sceneId || 'scene_start';
  const storyConfig = {
    premise: plain.storyConfig?.premise || plain.description || '',
    startGoal: plain.storyConfig?.startGoal || '',
    endGoal: plain.storyConfig?.endGoal || '',
    tone: plain.storyConfig?.tone || 'cinematic',
    difficulty: plain.storyConfig?.difficulty || 'easy'
  };

  const normalized = {
    ...plain,
    schemaVersion,
    description: plain.description || '',
    storyConfig,
    generationState: {
      status: plain.generationState?.status || 'idle',
      pendingSceneIds: plain.generationState?.pendingSceneIds || [],
      lastError: plain.generationState?.lastError || '',
      debug: plain.generationState?.debug || []
    },
    authoringWarnings: plain.authoringWarnings || [],
    constraints: {
      maxTurns: Number(plain.constraints?.maxTurns ?? Math.max(1, scenes.length)),
      targetPoints: Number(plain.constraints?.targetPoints ?? 0)
    },
    wildcardConfig: {
      enabled: Boolean(plain.wildcardConfig?.enabled),
      recoverySceneId: plain.wildcardConfig?.recoverySceneId || '',
      highRewardPoints: Number(plain.wildcardConfig?.highRewardPoints ?? 2),
      lowRewardPoints: Number(plain.wildcardConfig?.lowRewardPoints ?? 0)
    },
    startSceneId,
    scenes
  };

  console.log('[TEMPLATE_V2] normalize', {
    title: normalized.title,
    schemaVersion: normalized.schemaVersion,
    sceneCount: normalized.scenes.length,
    generationStatus: normalized.generationState.status
  });

  return normalized;
}
