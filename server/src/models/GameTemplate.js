import mongoose from 'mongoose';

const avenueSchema = new mongoose.Schema(
  {
    avenueId: { type: String, required: true },
    label: { type: String, required: true },
    keywords: { type: [String], default: [] },
    points: { type: Number, default: 0 },
    nextSceneId: { type: String, required: true }
  },
  { _id: false }
);

const sceneSchema = new mongoose.Schema(
  {
    sceneId: { type: String, required: true },
    narrative: { type: String, required: true },
    imageKey: { type: String, default: '' },
    isTerminal: { type: Boolean, default: false },
    avenues: { type: [avenueSchema], default: [] }
  },
  { _id: false }
);

const gameTemplateSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
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

gameTemplateSchema.pre('validate', function enforceUniqueSceneIds(next) {
  const seen = new Set();
  for (const scene of this.scenes || []) {
    if (seen.has(scene.sceneId)) {
      this.invalidate('scenes', `Duplicate sceneId detected: ${scene.sceneId}`);
      break;
    }
    seen.add(scene.sceneId);
  }
  next();
});

export const GameTemplate = mongoose.model('GameTemplate', gameTemplateSchema);
