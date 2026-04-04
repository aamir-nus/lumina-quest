/**
 * Docker Smoke Tests
 *
 * Runs automated integration tests when RUN_SMOKE_TESTS=true is set.
 * Tests admin operations (create/delete game) and user gameplay.
 */

import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { PlayerSession } from '../models/PlayerSession.js';
import { startSessionForUser, processSessionAction } from '../services/sessionEngineService.js';

const TEST_DELAY = 2000; // Delay between tests (ms)

function logTest(testName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[SMOKE TEST] ${testName}`);
  console.log('='.repeat(60));
}

function logResult(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[SMOKE TEST] ${status} - ${testName}`);
  if (details) console.log(`[SMOKE TEST] ${details}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test: Admin creates a game
 */
async function testCreateGame(adminUser) {
  logTest('Admin: Create Game');

  try {
    const gameData = {
      title: 'Smoke Test Game',
      description: 'Automated test game',
      constraints: {
        maxTurns: 10,
        targetPoints: 5
      },
      wildcardConfig: {
        enabled: false,
        recoverySceneId: '',
        highRewardPoints: 2,
        lowRewardPoints: 0
      },
      startSceneId: 'start',
      scenes: [
        {
          sceneId: 'start',
          narrative: 'You are at the entrance. There is a path forward.',
          isTerminal: false,
          renderConfig: {
            theme: 'pastel',
            backgroundLayers: [],
            foregroundLayers: [],
            sprite: { id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 }
          },
          avenues: [
            {
              avenueId: 'go_forward',
              label: 'Go Forward',
              keywords: ['go', 'forward', 'enter'],
              points: 5,
              nextSceneId: 'end',
              visualEffects: { transition: 'fade' }
            }
          ]
        },
        {
          sceneId: 'end',
          narrative: 'You have reached the end. Victory!',
          isTerminal: true,
          renderConfig: {
            theme: 'pastel',
            backgroundLayers: [],
            foregroundLayers: [],
            sprite: { id: 'hero', mood: 'heroic', x: 0.5, y: 0.82 }
          },
          avenues: []
        }
      ]
    };

    const game = await GameTemplate.create({
      ...gameData,
      adminId: adminUser._id,
      status: 'public'
    });

    logResult('Create Game', true, `Game ID: ${game._id}`);
    return game;
  } catch (error) {
    logResult('Create Game', false, error.message);
    return null;
  }
}

/**
 * Test: Admin deletes a game
 */
async function testDeleteGame(game) {
  logTest('Admin: Delete Game');

  if (!game) {
    logResult('Delete Game', false, 'No game to delete (create test failed)');
    return false;
  }

  try {
    await GameTemplate.findByIdAndDelete(game._id);
    const deleted = await GameTemplate.findById(game._id);

    const passed = deleted === null;
    logResult('Delete Game', passed, passed ? 'Game successfully deleted' : 'Game still exists');
    return passed;
  } catch (error) {
    logResult('Delete Game', false, error.message);
    return false;
  }
}

/**
 * Test: User plays game to completion
 */
async function testUserGameplay(testUser, testGame) {
  logTest('User: Play Game to Completion');

  if (!testGame) {
    logResult('User Gameplay', false, 'No game available (create test failed)');
    return false;
  }

  try {
    // Start session
    const session = await startSessionForUser({
      userId: testUser._id,
      gameId: testGame._id
    });

    console.log(`[SMOKE TEST] Session started: ${session._id}`);
    console.log(`[SMOKE TEST] Current scene: ${session.currentSceneId}`);

    // Take action to complete game (using exact avenue label)
    const result = await processSessionAction({
      userId: testUser._id,
      payload: {
        sessionId: session._id,
        userInput: 'Go Forward',
        tone: 'cinematic'
      }
    });

    // Verify completion
    const isComplete = result.session.status === 'won' || result.session.status === 'lost';
    const finalPoints = result.session.stats.points;
    const targetPoints = testGame.constraints.targetPoints;

    const passed = isComplete && finalPoints >= targetPoints;

    logResult(
      'User Gameplay',
      passed,
      `Status: ${result.session.status} | Points: ${finalPoints}/${targetPoints}`
    );

    return passed;
  } catch (error) {
    logResult('User Gameplay', false, error.message);
    return false;
  }
}

/**
 * Run all smoke tests
 */
export async function runDockerSmokeTests() {
  if (env.runSmokeTests !== 'true') {
    console.log('[SMOKE TEST] Disabled (set RUN_SMOKE_TESTS=true to enable)');
    return;
  }

  console.log('\n🧪 Starting Docker Smoke Tests...');
  console.log('[SMOKE TEST] RUN_SMOKE_TESTS=true detected');

  await sleep(TEST_DELAY);

  const results = {
    createGame: false,
    deleteGame: false,
    userGameplay: false
  };

  try {
    // Get admin user
    const adminUser = await User.findOne({ email: 'admin@luminaquest.local', role: 'admin' });
    if (!adminUser) {
      logResult('Smoke Tests', false, 'Admin user not found');
      return;
    }

    // Get or create test user
    let testUser = await User.findOne({ email: 'smoke-test@luminaquest.local' });
    if (!testUser) {
      const bcrypt = await import('bcryptjs');
      const { AUTH } = await import('../constants/appConstants.js');
      const passwordHash = await bcrypt.hash('test123', AUTH.BCRYPT_SALT_ROUNDS);
      testUser = await User.create({
        email: 'smoke-test@luminaquest.local',
        passwordHash,
        role: 'user'
      });
    }

    // Test 1: Admin creates game
    const testGame = await testCreateGame(adminUser);
    results.createGame = testGame !== null;

    await sleep(TEST_DELAY);

    // Test 2: User plays game (before deletion)
    if (testGame) {
      results.userGameplay = await testUserGameplay(testUser, testGame);
      await sleep(TEST_DELAY);
    }

    // Test 3: Admin deletes game
    results.deleteGame = await testDeleteGame(testGame);
    await sleep(TEST_DELAY);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('[SMOKE TEST] FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`[SMOKE TEST] Create Game:   ${results.createGame ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`[SMOKE TEST] User Gameplay:  ${results.userGameplay ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`[SMOKE TEST] Delete Game:   ${results.deleteGame ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = Object.values(results).every(v => v === true);
    console.log('='.repeat(60));
    console.log(`[SMOKE TEST] ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('[SMOKE TEST] Fatal error:', error);
  }
}
