import mongoose from 'mongoose';

const historyItemSchema = new mongoose.Schema(
  {
    turn: Number,
    sceneId: String,
    userQuery: String,
    resolvedAvenueId: String,
    narration: String,
    pointsDelta: Number
  },
  { _id: false }
);

const playerSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameTemplate', required: true },
    currentSceneId: { type: String, required: true },
    isPlaytest: { type: Boolean, default: false },
    playtestMeta: {
      startedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      startSceneOverride: { type: String, default: '' }
    },
    status: { type: String, enum: ['active', 'won', 'lost'], default: 'active' },
    stats: {
      points: { type: Number, default: 0 },
      turnsUsed: { type: Number, default: 0 }
    },
    visualState: {
      theme: { type: String, default: 'pastel' },
      activeLayers: { type: [String], default: [] },
      spriteMood: { type: String, default: 'neutral' },
      transition: { type: String, default: 'fade' }
    },
    history: { type: [historyItemSchema], default: [] }
  },
  { timestamps: true, optimisticConcurrency: true }
);

playerSessionSchema.index({ userId: 1, createdAt: -1 });
playerSessionSchema.index({ gameId: 1, status: 1 });

export const PlayerSession = mongoose.model('PlayerSession', playerSessionSchema);
