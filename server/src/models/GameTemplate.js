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
    status: { type: String, enum: ['draft', 'public'], default: 'draft' },
    startSceneId: { type: String, required: true },
    scenes: { type: [sceneSchema], default: [] }
  },
  { timestamps: true }
);

export const GameTemplate = mongoose.model('GameTemplate', gameTemplateSchema);
