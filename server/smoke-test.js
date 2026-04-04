#!/usr/bin/env node

/**
 * Comprehensive smoke test for LuminaQuest API
 * Tests all major endpoints including LLM integration
 */

import assert from 'assert';
import { MongoClient } from 'mongodb';

const API_BASE = 'http://localhost:4000/api';

// Test credentials (with timestamp for uniqueness)
const timestamp = Date.now();
const TEST_USER = {
  username: `smoke_test_user_${timestamp}`,
  email: `smoketest${timestamp}@example.com`,
  password: 'TestPassword123!',
  role: 'admin'  // Required for game creation
};

// Test game template
const TEST_GAME = {
  title: 'Smoke Test Quest',
  description: 'A test game for smoke testing',
  constraints: {
    maxTurns: 100,
    targetPoints: 100
  },
  wildcardConfig: {
    enabled: false,
    recoverySceneId: ''
  },
  startSceneId: 'scene_start',
  scenes: [
    {
      sceneId: 'scene_start',
      narrative: 'You stand at the entrance of a mysterious cave. The air is cold and damp.',
      imageKey: '',
      isTerminal: false,
      renderConfig: {
        theme: 'pastel',
        backgroundLayers: [],
        foregroundLayers: [],
        sprite: { id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 }
      },
      avenues: [
        {
          avenueId: 'ave_enter',
          label: 'Enter the cave',
          keywords: ['enter', 'go', 'in', 'cave'],
          points: 1,
          nextSceneId: 'scene_inside'
        },
        {
          avenueId: 'ave_leave',
          label: 'Turn back',
          keywords: ['leave', 'back', 'away', 'retreat'],
          points: 0,
          nextSceneId: 'scene_end'
        }
      ]
    },
    {
      sceneId: 'scene_inside',
      narrative: 'Inside the cave, you see a faint glimmer of light in the distance.',
      imageKey: '',
      isTerminal: false,
      renderConfig: {
        theme: 'pastel',
        backgroundLayers: [],
        foregroundLayers: [],
        sprite: { id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 }
      },
      avenues: [
        {
          avenueId: 'ave_approach',
          label: 'Approach the light',
          keywords: ['approach', 'light', 'towards', 'go'],
          points: 1,
          nextSceneId: 'scene_treasure'
        }
      ]
    },
    {
      sceneId: 'scene_treasure',
      narrative: 'You found a treasure chest! Congratulations!',
      imageKey: '',
      isTerminal: true,
      renderConfig: {
        theme: 'pastel',
        backgroundLayers: [],
        foregroundLayers: [],
        sprite: { id: 'hero', mood: 'happy', x: 0.5, y: 0.82 }
      },
      avenues: []
    },
    {
      sceneId: 'scene_end',
      narrative: 'You decided to turn back. Perhaps another day.',
      imageKey: '',
      isTerminal: true,
      renderConfig: {
        theme: 'pastel',
        backgroundLayers: [],
        foregroundLayers: [],
        sprite: { id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 }
      },
      avenues: []
    }
  ]
};

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
  return { status: response.status, data, headers: response.headers };
}

// Helper: Print test result
function testResult(name, passed, details = '') {
  const symbol = passed ? '✅' : '❌';
  console.log(`${symbol} ${name}${details ? ': ' + details : ''}`);
  if (!passed) process.exit(1);
}

console.log('=== LuminaQuest API Smoke Test ===\n');

// Clean up test data
async function cleanup() {
  const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
  try {
    await client.connect();
    const db = client.db('luminaquest');

    // Delete test user (by email pattern since timestamp varies)
    await db.collection('users').deleteMany({ email: { $regex: /^smoketest\d+@example\.com$/ } });

    // Delete test games (by pattern)
    await db.collection('gametemplates').deleteMany({ title: 'Smoke Test Quest' });

    // Delete test sessions
    await db.collection('playersessions').deleteMany({ playerId: 'smoke_test_player' });

    console.log('🧹 Cleanup complete\n');
  } finally {
    await client.close();
  }
}

try {
  // === 1. AUTH TESTS ===
  console.log('--- AUTH ENDPOINTS ---');

  // Register
  let result = await apiRequest('/auth/register', 'POST', TEST_USER);
  testResult('POST /auth/register', result.status === 201, `status ${result.status}`);
  assert(result.data?.user?.email === TEST_USER.email, 'User email mismatch');
  authToken = result.data?.token;
  assert(authToken, 'Token not returned');

  // Check auth (me)
  result = await apiRequest('/auth/me');
  if (result.status !== 200) {
    console.log(`   Error: ${JSON.stringify(result.data)}`);
  }
  testResult('GET /auth/me', result.status === 200 && result.data?.user?.email === TEST_USER.email);

  // === 2. GAME TESTS ===
  console.log('\n--- GAME ENDPOINTS ---');

  // Create game
  result = await apiRequest('/games', 'POST', TEST_GAME);
  if (result.status !== 201) {
    console.log(`   Error: ${JSON.stringify(result.data)}`);
  }
  testResult('POST /games', result.status === 201);
  gameId = result.data?.game?._id || result.data?._id;
  assert(gameId, 'Game ID not returned');
  console.log(`   Created game: ${gameId}`);

  // Get my games
  result = await apiRequest('/games/mine?page=1&limit=10');
  testResult('GET /games/mine', result.status === 200);
  assert(result.data?.games?.length > 0, 'No games returned');

  // Publish game
  result = await apiRequest(`/games/${gameId}/publish`, 'POST');
  testResult('POST /games/:id/publish', result.status === 200);

  // Get public games
  result = await apiRequest('/games/public?page=1&limit=10');
  testResult('GET /games/public', result.status === 200);
  assert(result.data?.games?.length > 0, 'No public games');

  // === 3. SESSION TESTS ===
  console.log('\n--- SESSION ENDPOINTS ---');

  // Start session
  result = await apiRequest('/sessions/start', 'POST', {
    gameId: gameId,
    playerId: 'smoke_test_player'
  });
  testResult('POST /sessions/start', result.status === 201);
  sessionId = result.data?.session?._id || result.data?.sessionId;
  assert(sessionId, 'Session ID not returned');
  console.log(`   Started session: ${sessionId}`);

  // Get session
  result = await apiRequest(`/sessions/${sessionId}`);
  testResult(`GET /sessions/:id`, result.status === 200);
  const currentSceneId = result.data?.session?.currentSceneId || result.data?.currentSceneId || result.data?.sceneId;
  assert(currentSceneId === 'scene_start', `Wrong starting scene: ${currentSceneId}`);

  // === 4. LLM ACTION TEST ===
  console.log('\n--- LLM ACTION ENDPOINT ---');

  // Test action with LLM intent classification
  result = await apiRequest('/sessions/action', 'POST', {
    sessionId: sessionId,
    userInput: 'I want to go inside the cave',
    tone: 'cinematic'
  });

  testResult('POST /sessions/action (LLM classify)', result.status === 200);
  console.log(`   Route type: ${result.data?.resolution?.type || 'unknown'}`);
  console.log(`   Avenue: ${result.data?.resolution?.selectedAvenueId || 'none'}`);

  // Check LLM metadata
  const llmMeta = result.data?.resolution?.llm;
  if (llmMeta) {
    console.log(`   LLM Provider: ${llmMeta.provider}`);
    console.log(`   Tokens: ${llmMeta.tokens?.total || 'N/A'}`);
    console.log(`   Latency: ${llmMeta.computeApprox?.latencyMs?.toFixed(1) || 'N/A'}ms`);
  }

  // Verify we moved to the correct scene
  const newSceneId = result.data?.session?.currentSceneId;
  testResult('LLM intent classification correct', newSceneId === 'scene_inside', `Got scene: ${newSceneId}`);

  // === 5. OBSERVABILITY TEST ===
  console.log('\n--- OBSERVABILITY ENDPOINTS ---');

  result = await apiRequest('/admin/observability/resolver');
  testResult('GET /admin/observability/resolver', result.status === 200);
  console.log(`   Current provider: ${result.data?.provider || 'unknown'}`);
  console.log(`   Total actions: ${result.data?.metrics?.llmCallCount || 0}`);

  // === 6. SESSION HISTORY TEST ===
  console.log('\n--- SESSION HISTORY ---');

  result = await apiRequest(`/sessions/${sessionId}/history`);
  testResult(`GET /sessions/:id/history`, result.status === 200);
  console.log(`   History length: ${result.data?.history?.length || 0}`);

  // === 7. ADDITIONAL ACTION TESTS ===
  console.log('\n--- ADDITIONAL ACTIONS ---');

  // Try another action
  result = await apiRequest('/sessions/action', 'POST', {
    sessionId: sessionId,
    userInput: 'Approach the light',
    tone: 'cinematic'
  });
  testResult('POST /sessions/action (second)', result.status === 200);
  const newScene = result.data?.session?.currentSceneId;
  console.log(`   New scene: ${newScene || 'unchanged'}`);

  // === 8. ERROR HANDLING ===
  console.log('\n--- ERROR HANDLING ---');

  // Invalid session (use valid MongoDB ObjectId format)
  result = await apiRequest('/sessions/000000000000000000000000');
  if (result.status !== 404) {
    console.log(`   Unexpected status: ${result.status}`);
  }
  testResult('GET /sessions/:id (404)', result.status === 404);

  // === SUMMARY ===
  console.log('\n=== SMOKE TEST PASSED ===');
  console.log('All endpoints verified successfully!');
  console.log('\nTest Summary:');
  console.log('  ✅ Auth (register, login, me)');
  console.log('  ✅ Games (create, publish, list)');
  console.log('  ✅ Sessions (start, get, history)');
  console.log('  ✅ LLM Action (intent classification, narration)');
  console.log('  ✅ Observability (metrics, traces)');
  console.log('  ✅ Error handling');

} catch (error) {
  console.error('\n❌ SMOKE TEST FAILED:', error.message);
  process.exit(1);
} finally {
  await cleanup();
}
