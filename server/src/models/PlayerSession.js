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
    status: { type: String, enum: ['active', 'won', 'lost'], default: 'active' },
    stats: {
      points: { type: Number, default: 0 },
      turnsUsed: { type: Number, default: 0 }
    },
    history: { type: [historyItemSchema], default: [] }
  },
  { timestamps: true }
);

export const PlayerSession = mongoose.model('PlayerSession', playerSessionSchema);
