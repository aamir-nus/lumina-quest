import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const MAX_SCENES = 10;
const MAX_AVENUES_PER_SCENE = 3;

function createClient() {
  if (env.llmProvider === 'lmstudio') {
    return new OpenAI({
      apiKey: env.lmStudioApiKey || 'lm-studio',
      baseURL: env.lmStudioBaseUrl
    });
  }

  return new OpenAI({
    apiKey: env.openRouterApiKey || 'missing-key',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': env.openRouterSiteUrl,
      'X-Title': env.openRouterSiteName
    }
  });
}

function parseOutput(response, fallback = {}) {
  const outputText =
    response.output_text ||
    response.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text ||
    '{}';

  try {
    return JSON.parse(outputText);
  } catch (error) {
    logger.warn('Failed to parse LLM JSON output; using fallback', {
      message: error.message
    });
    return fallback;
  }
}

/**
 * Generate a complete game template from a story description using LLM.
 */
export async function generateGameFromStory({ title, description, story }) {
  console.log('[GAME_GENERATOR] 🎮 Starting game generation...');
  console.log(`[GAME_GENERATOR] 📖 Title: "${title}"`);
  console.log(`[GAME_GENERATOR] 📝 Story: "${story.substring(0, 100)}..."`);

  const client = createClient();
  const prompt = [
    `You are a game designer creating a text-based adventure game.`,
    '',
    `Game Title: ${title}`,
    `Description: ${description || 'A mysterious adventure'}`,
    `Story Flow: ${story}`,
    '',
    `CONSTRAINTS (strict):`,
    `- Maximum ${MAX_SCENES} scenes (including start and end)`,
    `- Each non-terminal scene must have 2-3 dialog options (avenues)`,
    `- At least one avenue must progress toward the ending`,
    `- One avenue can lead to a dead end (negative consequence)`,
    `- The final scene must be terminal with no avenues`,
    '',
    `OUTPUT FORMAT (strict JSON):`,
    `{
  "scenes": [
    {
      "sceneId": "scene_<unique>",
      "narrative": "<vivid 2-3 sentence description>",
      "isTerminal": false,
      "imageKey": "<word>",
      "renderConfig": {
        "theme": "pastel|night|sunrise|victory|crimson",
        "backgroundLayers": ["<layer1>", "<layer2>"],
        "foregroundLayers": ["<layer1>", "<layer2>"],
        "sprite": { "id": "hero", "mood": "neutral|alert|heroic|greedy|focused", "x": 0.5, "y": 0.82 }
      },
      "avenues": [
        {
          "avenueId": "a_<unique>",
          "label": "<short action name>",
          "keywords": ["<keyword1>", "<keyword2>"],
          "points": <1-2 for good, -1 for bad, 0 for neutral>,
          "nextSceneId": "scene_<target>",
          "visualEffects": {
            "transition": "fade|scanline|arcade-flash|glitch",
            "spriteMood": "<mood>",
            "setTheme": "<theme>",
            "enableLayers": ["<layer>"],
            "disableLayers": ["<layer>"]
          }
        }
      ]
    }
  ],
  "startSceneId": "scene_<first>",
  "constraints": { "maxTurns": <${MAX_SCENES}>, "targetPoints": <3-5> },
  "wildcardConfig": { "enabled": true, "recoverySceneId": "scene_<early>", "highRewardPoints": 2, "lowRewardPoints": 0 }
}`,
    '',
    `Create a cohesive story where player choices matter. The first scene should introduce the setting and present 2-3 clear choices. Subsequent scenes should branch and eventually converge to an ending scene that reflects the player's journey.`,
    '',
    `Return ONLY the JSON object above. No extra text.`
  ].join('\n');

  try {
    console.log('[GAME_GENERATOR] 🔄 Calling LLM provider...');
    const response = await client.responses.create({
      model: env.llmProvider === 'lmstudio' ? env.lmStudioModel : env.openRouterModel,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'You are an expert game designer who creates structured text adventure games with meaningful choices and vivid narratives.'
            }
          ]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }]
        }
      ]
    });

    console.log('[GAME_GENERATOR] ✅ Got LLM response, parsing...');
    const parsed = parseOutput(response);

    if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error('Invalid LLM output: missing scenes array');
    }

    // Validate constraints
    if (parsed.scenes.length > MAX_SCENES) {
      console.warn(`[GAME_GENERATOR] ⚠️  LLM returned ${parsed.scenes.length} scenes, truncating to ${MAX_SCENES}`);
      parsed.scenes = parsed.scenes.slice(0, MAX_SCENES);
    }

    // Validate each scene's avenues
    for (const scene of parsed.scenes) {
      if (!scene.isTerminal && scene.avenues && scene.avenues.length > MAX_AVENUES_PER_SCENE) {
        console.warn(`[GAME_GENERATOR] ⚠️  Scene ${scene.sceneId} has ${scene.avenues.length} avenues, truncating to ${MAX_AVENUES_PER_SCENE}`);
        scene.avenues = scene.avenues.slice(0, MAX_AVENUES_PER_SCENE);
      }
    }

    // Build complete game template
    const gameTemplate = {
      title,
      description: description || 'An AI-generated adventure',
      constraints: parsed.constraints || { maxTurns: MAX_SCENES, targetPoints: 3 },
      wildcardConfig: parsed.wildcardConfig || {
        enabled: true,
        recoverySceneId: parsed.scenes[0]?.sceneId || 'scene_start',
        highRewardPoints: 2,
        lowRewardPoints: 0
      },
      startSceneId: parsed.startSceneId || parsed.scenes[0]?.sceneId,
      scenes: parsed.scenes.map((scene, idx) => ({
        sceneId: scene.sceneId || `scene_${idx}`,
        narrative: scene.narrative || 'You find yourself in a mysterious place.',
        isTerminal: scene.isTerminal || false,
        imageKey: scene.imageKey || 'unknown',
        renderConfig: scene.renderConfig || {
          theme: 'pastel',
          backgroundLayers: [],
          foregroundLayers: [],
          sprite: { id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 }
        },
        avenues: (scene.avenues || []).map((avenue, avenueIdx) => ({
          avenueId: avenue.avenueId || `a_${idx}_${avenueIdx}`,
          label: avenue.label || 'Choose this path',
          keywords: avenue.keywords || [],
          points: avenue.points ?? 1,
          nextSceneId: avenue.nextSceneId,
          visualEffects: avenue.visualEffects || {
            transition: 'fade',
            spriteMood: 'neutral',
            setTheme: '',
            enableLayers: [],
            disableLayers: []
          }
        }))
      }))
    };

    console.log(`[GAME_GENERATOR] ✅ Generated game with ${gameTemplate.scenes.length} scenes`);
    console.log(`[GAME_GENERATOR] 📊 Start: ${gameTemplate.startSceneId} | Terminal: ${gameTemplate.scenes.filter(s => s.isTerminal).length}`);

    return { success: true, game: gameTemplate };
  } catch (error) {
    console.error(`[GAME_GENERATOR] ❌ Generation failed: ${error.message}`);
    logger.error('Game generation failed', { message: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message || 'Failed to generate game. Please check your LLM provider configuration.'
    };
  }
}
