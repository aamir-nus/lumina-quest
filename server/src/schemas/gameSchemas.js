import { z } from 'zod';

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);

export const generationDebugEntrySchema = z.object({
  phase: z.string().min(1),
  sceneId: z.string().optional().default(''),
  attempt: z.number().int().min(1).default(1),
  ok: z.boolean().default(false),
  summary: z.string().default(''),
  provider: z.string().default('lmstudio'),
  model: z.string().default(''),
  createdAt: z.string().optional().default('')
});

export const generationStateSchema = z
  .object({
    status: z
      .enum(['idle', 'generating_flow', 'flow_ready', 'generating_options', 'options_ready', 'manual_required', 'failed'])
      .default('idle'),
    pendingSceneIds: z.array(z.string()).default([]),
    lastError: z.string().default(''),
    debug: z.array(generationDebugEntrySchema).default([])
  })
  .default({
    status: 'idle',
    pendingSceneIds: [],
    lastError: '',
    debug: []
  });

export const storyConfigSchema = z
  .object({
    premise: z.string().default(''),
    startGoal: z.string().default(''),
    endGoal: z.string().default(''),
    tone: z.string().default('cinematic'),
    difficulty: difficultySchema.default('easy')
  })
  .default({
    premise: '',
    startGoal: '',
    endGoal: '',
    tone: 'cinematic',
    difficulty: 'easy'
  });

export const inputPolicySchema = z
  .object({
    allowFreeform: z.boolean().default(true),
    invalidAttemptLimit: z.number().int().min(1).default(3),
    invalidPenalty: z.number().default(-1)
  })
  .default({
    allowFreeform: true,
    invalidAttemptLimit: 3,
    invalidPenalty: -1
  });

export const avenueSchema = z.object({
  avenueId: z.string().min(1),
  label: z.string().min(1),
  intent: z.string().optional().default(''),
  outcome: z.enum(['success', 'partial', 'fail']).optional().default('partial'),
  keywords: z.array(z.string()).default([]),
  points: z.number().optional(),
  scoreImpact: z.number().optional(),
  nextSceneId: z.string().min(1),
  visualEffects: z
    .object({
      transition: z.string().default('fade'),
      spriteMood: z.string().default(''),
      setTheme: z.string().default(''),
      enableLayers: z.array(z.string()).default([]),
      disableLayers: z.array(z.string()).default([])
    })
    .default({
      transition: 'fade',
      spriteMood: '',
      setTheme: '',
      enableLayers: [],
      disableLayers: []
    })
});

export const sceneSchema = z.object({
  sceneId: z.string().min(1),
  kind: z.enum(['start', 'beat', 'ending']).optional().default('beat'),
  stepIndex: z.number().int().min(0).optional().default(0),
  goalSummary: z.string().optional().default(''),
  narrative: z.string().min(1),
  imageKey: z.string().default(''),
  isTerminal: z.boolean().default(false),
  endingType: z.enum(['win', 'fail']).optional(),
  inputPolicy: inputPolicySchema.optional().default({
    allowFreeform: true,
    invalidAttemptLimit: 3,
    invalidPenalty: -1
  }),
  renderConfig: z
    .object({
      theme: z.string().default('pastel'),
      backgroundLayers: z.array(z.string()).default([]),
      foregroundLayers: z.array(z.string()).default([]),
      sprite: z
        .object({
          id: z.string().default('hero'),
          mood: z.string().default('neutral'),
          x: z.number().default(0.5),
          y: z.number().default(0.82)
        })
        .default({ id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 })
    })
    .default({
      theme: 'pastel',
      backgroundLayers: [],
      foregroundLayers: [],
      sprite: { id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 }
    }),
  avenues: z.array(avenueSchema).default([])
});

export const gamePayloadSchema = z.object({
  schemaVersion: z.number().int().min(1).max(2).optional().default(1),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  storyConfig: storyConfigSchema.optional().default({
    premise: '',
    startGoal: '',
    endGoal: '',
    tone: 'cinematic',
    difficulty: 'easy'
  }),
  generationState: generationStateSchema.optional().default({
    status: 'idle',
    pendingSceneIds: [],
    lastError: '',
    debug: []
  }),
  authoringWarnings: z.array(z.string()).optional().default([]),
  constraints: z.object({
    maxTurns: z.number().min(1),
    targetPoints: z.number().min(0)
  }),
  wildcardConfig: z
    .object({
      enabled: z.boolean().default(false),
      recoverySceneId: z.string().default(''),
      highRewardPoints: z.number().default(2),
      lowRewardPoints: z.number().default(0)
    })
    .default({ enabled: false, recoverySceneId: '', highRewardPoints: 2, lowRewardPoints: 0 }),
  status: z.enum(['draft', 'public']).optional().default('draft'),
  startSceneId: z.string().min(1),
  scenes: z.array(sceneSchema).min(1)
});

export const createGameSchema = gamePayloadSchema;

export const generateFlowSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  premise: z.string().min(10).max(2000),
  startGoal: z.string().min(3).max(300),
  endGoal: z.string().min(3).max(300),
  tone: z.string().max(100).optional().default('cinematic'),
  difficulty: difficultySchema.default('easy')
});

export const generateOptionsSchema = z.object({
  sceneIds: z.array(z.string()).optional().default([])
});
