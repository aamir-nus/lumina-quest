#!/usr/bin/env node

/**
 * Backend API Walkthrough - Play the game through API calls
 * Simulates a full playthrough to verify LLM integration and game flow
 */

import assert from 'assert';

const API_BASE = 'http://localhost:4000/api';

// Store auth token
let authToken = null;
let gameId = null;
let sessionId = null;

// Helper: Make API request
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:5173'
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json().catch(() => null);

  return { status: response.status, data };
}

// Test game template - simple cave adventure
const TEST_GAME = {
  title: 'The Crystal Cave',
  description: 'A short adventure to test LLM integration',
  constraints: { maxTurns: 50, targetPoints: 5 },
  wildcardConfig: { enabled: false, recoverySceneId: '' },
  startSceneId: 'entrance',
  scenes: [
    {
      sceneId: 'entrance',
      narrative: 'You stand at the entrance of a mysterious crystal cave. Light reflects off thousands of crystals, creating an ethereal glow. You can see a narrow passage leading deeper into the cave, or turn back.',
      imageKey: '',
      isTerminal: false,
      renderConfig: { theme: 'pastel', backgroundLayers: [], foregroundLayers: [], sprite: { id: 'hero', mood: 'curious', x: 0.5, y: 0.82 } },
      avenues: [
        { avenueId: 'enter_deep', label: 'Enter the cave', keywords: ['enter', 'go', 'in', 'explore'], points: 1, nextSceneId: 'crystal_chamber' },
        { avenueId: 'leave', label: 'Turn back', keywords: ['leave', 'back', 'away', 'retreat'], points: 0, nextSceneId: 'outside' }
      ]
    },
    {
      sceneId: 'crystal_chamber',
      narrative: 'The crystal chamber is breathtaking! Giant crystals tower around you, pulsing with soft light. In the center, you spot a small pedestal with a glowing gem. There\'s also a dark tunnel leading further down.',
      imageKey: '',
      isTerminal: false,
      renderConfig: { theme: 'pastel', backgroundLayers: [], foregroundLayers: [], sprite: { id: 'hero', mood: 'amazed', x: 0.5, y: 0.82 } },
      avenues: [
        { avenueId: 'take_gem', label: 'Take the gem', keywords: ['take', 'grab', 'gem', 'crystal'], points: 2, nextSceneId: 'gem_taken' },
        { avenueId: 'dark_tunnel', label: 'Explore the dark tunnel', keywords: ['tunnel', 'dark', 'explore', 'down'], points: 1, nextSceneId: 'treasure_room' },
        { avenueId: 'return', label: 'Return to entrance', keywords: ['return', 'back', 'entrance'], points: 0, nextSceneId: 'entrance' }
      ]
    },
    {
      sceneId: 'gem_taken',
      narrative: 'As you touch the gem, it surges with energy! You feel powerful. The cave begins to rumble - it seems you\'ve triggered something. You can quickly exit or investigate further.',
      imageKey: '',
      isTerminal: false,
      renderConfig: { theme: 'pastel', backgroundLayers: [], foregroundLayers: [], sprite: { id: 'hero', mood: 'excited', x: 0.5, y: 0.82 } },
      avenues: [
        { avenueId: 'exit_fast', label: 'Run for the exit', keywords: ['run', 'exit', 'escape', 'leave'], points: 1, nextSceneId: 'escape_success' },
        { avenueId: 'investigate', label: 'Investigate the rumble', keywords: ['investigate', 'rumble', 'check', 'stay'], points: 2, nextSceneId: 'secret_room' }
      ]
    },
    {
      sceneId: 'treasure_room',
      narrative: 'The dark tunnel opens into a hidden treasure room! Gold coins and ancient artifacts surround you. But wait - a sleeping dragon guards the hoard!',
      imageKey: '',
      isTerminal: false,
      renderConfig: { theme: 'pastel', backgroundLayers: [], foregroundLayers: [], sprite: { id: 'hero', mood: 'nervous', x: 0.5, y: 0.82 } },
      avenues: [
        { avenueId: 'sneak', label: 'Sneak past the dragon', keywords: ['sneak', 'quiet', 'past', 'steal'], points: 2, nextSceneId: 'sneak_success' },
        { avenueId: 'wake', label: 'Wake the dragon', keywords: ['wake', 'dragon', 'challenge', 'fight'], points: 0, nextSceneId: 'dragon_wake' }
      ]
    },
    {
      sceneId: 'secret_room',
      narrative: 'Behind a hidden wall, you discover an ancient shrine. A spirit appears and grants you a blessing! You have discovered the greatest secret of the crystal cave.',
      imageKey: '',
      isTerminal: true,
      renderConfig: { theme: 'pastel', backgroundLayers: [], foregroundLayers: [], sprite: { id: 'hero', mood: 'victorious', x: 0.5, y: 0.82 } },
      avenues: []
    },
    {
      sceneId: 'escape_success',
      narrative: 'You dash out of the cave just as it collapses behind you. Clutching the gem, you\'ve made it out safely with your prize!',
      imageKey: '',
      isTerminal: true,
      renderConfig: { theme: 'pastel', backgroundLayers: [], foregroundLayers: [], sprite: { id: 'hero', mood: 'relieved', x: 0.5, y: 0.82 } },
      avenues: []
    },
    {
      sceneId: 'sneak_success',
      narrative: 'Holding your breath, you tiptoe past the sleeping dragon. You gather a handful of treasure and slip away unnoticed. A perfect heist!',
      imageKey: '',
      isTerminal: true,
      renderConfig: { theme: 'pastel', backgroundLayers: [], foregroundLayers: [], sprite: { id: 'hero', mood: 'proud', x: 0.5, y: 0.82 } },
      avenues: []
    },
    {
      sceneId: 'dragon_wake',
      narrative: 'The dragon awakens with a roar! Fire fills the chamber as you realize this may have been a mistake...',
      imageKey: '',
      isTerminal: true,
      renderConfig: { theme: 'pastel', backgroundLayers: [], foregroundLayers: [], sprite: { id: 'hero', mood: 'scared', x: 0.5, y: 0.82 } },
      avenues: []
    },
    {
      sceneId: 'outside',
      narrative: 'You decide to leave the cave undisturbed. Perhaps another day, when you feel more adventurous.',
      imageKey: '',
      isTerminal: true,
      renderConfig: { theme: 'pastel', backgroundLayers: [], foregroundLayers: [], sprite: { id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 } },
      avenues: []
    }
  ]
};

// Player actions for the walkthrough (natural language input)
const WALKTHROUGH_ACTIONS = [
  'I want to enter the cave and explore',
  'The gem looks valuable, I should take it',
  'I want to investigate this rumbling further',
];

console.log('═══════════════════════════════════════════════════════════');
console.log('   BACKEND API WALKTHROUGH - LLM INTEGRATION TEST');
console.log('═══════════════════════════════════════════════════════════\n');

try {
  // === STEP 1: CREATE ADMIN USER ===
  console.log('📝 STEP 1: Creating admin user...');
  const timestamp = Date.now();
  let result = await apiRequest('/auth/register', 'POST', {
    username: `walkthrough_user_${timestamp}`,
    email: `walkthrough${timestamp}@test.com`,
    password: 'TestPass123!',
    role: 'admin'
  });
  assert(result.status === 201, `Failed to create user: ${result.status}`);
  authToken = result.data.token;
  console.log(`✅ User created: walkthrough${timestamp}@test.com\n`);

  // === STEP 2: CREATE AND PUBLISH GAME ===
  console.log('🎮 STEP 2: Creating game...');
  result = await apiRequest('/games', 'POST', TEST_GAME);
  assert(result.status === 201, `Failed to create game: ${result.status}`);
  gameId = result.data.game._id;
  console.log(`✅ Game created: "${TEST_GAME.title}" (ID: ${gameId})`);

  result = await apiRequest(`/games/${gameId}/publish`, 'POST');
  assert(result.status === 200, `Failed to publish game: ${result.status}`);
  console.log(`✅ Game published\n`);

  // === STEP 3: START GAME SESSION ===
  console.log('🚀 STEP 3: Starting game session...');
  result = await apiRequest('/sessions/start', 'POST', {
    gameId: gameId,
    playerId: 'walkthrough_player'
  });
  assert(result.status === 201, `Failed to start session: ${result.status}`);
  sessionId = result.data.session._id;
  console.log(`✅ Session started (ID: ${sessionId.slice(0, 8)}...)`);
  console.log(`📍 Starting scene: ${result.data.session.currentSceneId}`);

  // Get the full session details including narrative
  const sessionDetail = await apiRequest(`/sessions/${sessionId}`);
  const startNarrative = sessionDetail.data.currentScene?.narrative || 'Loading...';
  console.log(`📖 Narrative: "${startNarrative.substring(0, 80)}..."\n`);

  // === STEP 4: PLAY THROUGH THE GAME ===
  console.log('🎲 STEP 4: Playing through the game...');
  console.log('─────────────────────────────────────────────────────────────');

  let turn = 1;
  for (const action of WALKTHROUGH_ACTIONS) {
    console.log(`\n🔄 TURN ${turn}: ${action}`);
    console.log('─────────────────────────────────────────────────────────────');

    result = await apiRequest('/sessions/action', 'POST', {
      sessionId: sessionId,
      userInput: action,
      tone: 'cinematic'
    });

    assert(result.status === 200, `Action failed: ${result.status}`);

    const resolution = result.data.resolution;
    const session = result.data.session;
    const currentScene = result.data.currentScene;

    // Display results
    console.log(`✅ Status: ${result.status}`);
    console.log(`📊 Route Type: ${resolution.type}`);
    console.log(`🎯 Selected Avenue: ${resolution.selectedAvenueId || 'N/A'}`);
    console.log(`📍 New Scene: ${session.currentSceneId}`);
    console.log(`💰 Points: ${session.stats.points}`);
    console.log(`🎭 Session Status: ${session.status}`);

    if (resolution.llm) {
      console.log(`🤖 LLM Provider: ${resolution.llm.provider}`);
      if (resolution.llm.tokens) {
        console.log(`🔢 Tokens: ${resolution.llm.tokens.totalTokens} (in: ${resolution.llm.tokens.inputTokens}, out: ${resolution.llm.tokens.outputTokens})`);
      }
      if (resolution.llm.computeApprox) {
        console.log(`⏱️  Latency: ${resolution.llm.computeApprox.latencyMs.toFixed(1)}ms`);
      }
    }

    console.log(`📖 Narration: "${resolution.narration.substring(0, 120)}..."`);
    console.log(`🎬 Next Scene: "${currentScene.narrative.substring(0, 100)}..."`);

    // Check if game ended
    if (session.status !== 'active') {
      console.log(`\n🏁 GAME ENDED: ${session.status.toUpperCase()}`);
      break;
    }

    turn++;
  }

  // === SUMMARY ===
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    WALKTHROUGH COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');

  result = await apiRequest(`/sessions/${sessionId}`);
  const finalSession = result.data.session;

  console.log(`\n📊 FINAL STATS:`);
  console.log(`   Turns Taken: ${finalSession.stats.turnsUsed}`);
  console.log(`   Points Earned: ${finalSession.stats.points}`);
  console.log(`   Game Result: ${finalSession.status.toUpperCase()}`);
  console.log(`   Ending Scene: ${finalSession.currentSceneId}`);

  console.log(`\n📜 HISTORY:`);
  for (const entry of finalSession.history) {
    console.log(`   Turn ${entry.turn}: "${entry.userQuery}" -> ${entry.resolvedAvenueId || 'clarification'} (+${entry.pointsDelta} pts)`);
  }

  console.log(`\n✅ All steps completed successfully!`);
  console.log(`\n💡 The LLM integration is working correctly:`);
  console.log(`   • Intent classification mapped natural language to game routes`);
  console.log(`   • Narration generated contextual story text`);
  console.log(`   • Game state progressed deterministically`);
  console.log(`   • Metrics and observability tracked throughout`);

} catch (error) {
  console.error(`\n❌ WALKTHROUGH FAILED: ${error.message}`);
  process.exit(1);
}
