import mongoose from 'mongoose';

const avenueSchema = new mongoose.Schema(
  {
    avenueId: { type: String, required: true },
    label: { type: String, required: true },
    intent: { type: String, default: '' },
    outcome: { type: String, enum: ['success', 'partial', 'fail'], default: 'partial' },
    keywords: { type: [String], default: [] },
    points: { type: Number, default: 0 },
    scoreImpact: { type: Number, default: 0 },
    nextSceneId: { type: String, required: true },
    visualEffects: {
      transition: { type: String, default: 'fade' },
      spriteMood: { type: String, default: '' },
      setTheme: { type: String, default: '' },
      enableLayers: { type: [String], default: [] },
      disableLayers: { type: [String], default: [] }
    }
  },
  { _id: false }
);

const sceneSchema = new mongoose.Schema(
  {
    sceneId: { type: String, required: true, match: [/^[a-zA-Z0-9_-]+$/, 'Invalid sceneId format'] },
    kind: { type: String, enum: ['start', 'beat', 'ending'], default: 'beat' },
    stepIndex: { type: Number, default: 0 },
    goalSummary: { type: String, default: '' },
    narrative: { type: String, required: true },
    imageKey: { type: String, default: '' },
    isTerminal: { type: Boolean, default: false },
    endingType: { type: String, enum: ['win', 'fail'], default: undefined },
    inputPolicy: {
      allowFreeform: { type: Boolean, default: true },
      invalidAttemptLimit: { type: Number, default: 3 },
      invalidPenalty: { type: Number, default: -1 }
    },
    renderConfig: {
      theme: { type: String, default: 'pastel' },
      backgroundLayers: { type: [String], default: [] },
      foregroundLayers: { type: [String], default: [] },
      sprite: {
        id: { type: String, default: 'hero' },
        mood: { type: String, default: 'neutral' },
        x: { type: Number, default: 0.5 },
        y: { type: Number, default: 0.82 }
      }
    },
    avenues: { type: [avenueSchema], default: [] }
  },
  { _id: false }
);

const gameTemplateSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    schemaVersion: { type: Number, default: 2 },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    storyConfig: {
      premise: { type: String, default: '' },
      startGoal: { type: String, default: '' },
      endGoal: { type: String, default: '' },
      tone: { type: String, default: 'cinematic' },
      difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' }
    },
    generationState: {
      status: {
        type: String,
        enum: ['idle', 'generating_flow', 'flow_ready', 'generating_options', 'options_ready', 'manual_required', 'failed'],
        default: 'idle'
      },
      pendingSceneIds: { type: [String], default: [] },
      lastError: { type: String, default: '' },
      debug: {
        type: [
          new mongoose.Schema(
            {
              phase: { type: String, required: true },
              sceneId: { type: String, default: '' },
              attempt: { type: Number, default: 1 },
              ok: { type: Boolean, default: false },
              summary: { type: String, default: '' },
              provider: { type: String, default: 'lmstudio' },
              model: { type: String, default: '' },
              createdAt: { type: String, default: '' }
            },
            { _id: false }
          )
        ],
        default: []
      }
    },
    authoringWarnings: { type: [String], default: [] },
    constraints: {
      maxTurns: { type: Number, required: true, min: 1 },
      targetPoints: { type: Number, required: true, min: 0 }
    },
    wildcardConfig: {
      enabled: { type: Boolean, default: false },
      recoverySceneId: { type: String, default: '' },
      highRewardPoints: { type: Number, default: 2 },
      lowRewardPoints: { type: Number, default: 0 }
    },
    status: { type: String, enum: ['draft', 'public'], default: 'draft' },
    startSceneId: { type: String, required: true },
    scenes: { type: [sceneSchema], default: [] }
  },
  { timestamps: true }
);

gameTemplateSchema.index({ adminId: 1, status: 1, updatedAt: -1 });
gameTemplateSchema.index({ status: 1, createdAt: -1 });

gameTemplateSchema.pre('validate', function enforceUniqueSceneIds() {
  const seen = new Set();
  for (const scene of this.scenes || []) {
    if (seen.has(scene.sceneId)) {
      this.invalidate('scenes', `Duplicate sceneId detected: ${scene.sceneId}`);
      break;
    }
    seen.add(scene.sceneId);
  }
});

export const GameTemplate = mongoose.model('GameTemplate', gameTemplateSchema);
