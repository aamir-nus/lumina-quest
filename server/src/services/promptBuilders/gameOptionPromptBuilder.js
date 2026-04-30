/**
 * Build prompt for generating game options with historical context
 *
 * @param {Object} params - Prompt parameters
 * @param {string} params.title - Game title
 * @param {string} params.premise - Game premise
 * @param {string} params.tone - Game tone
 * @param {string} params.difficulty - Game difficulty
 * @param {Object} params.currentScene - Scene we're generating options for
 * @param {Object} params.nextScene - Next scene in the story
 * @param {Object} params.failScene - Fail ending scene
 * @param {Object} params.optionCounts - Option count requirements
 * @param {Array<{scene: Object, options: Array}>} params.history - Historical context (previous scenes and their options)
 * @returns {string} - Formatted prompt for LLM
 */
export function buildGameOptionPrompt({ title, premise, tone, difficulty, currentScene, nextScene, failScene, optionCounts, history = [] }) {
  const { totalOptions, validOptions, failOptions } = optionCounts;

  const parts = [
    'You are writing player-facing options for a guided graph game.',
    'This is a game, so surprising or mischievous options are acceptable if they still respect the authored graph.',
    ''
  ];

  // Add historical context if available
  if (history.length > 0) {
    parts.push('=== STORY SO FAR ===');
    history.forEach((entry, index) => {
      parts.push(`Beat ${index + 1}: ${entry.scene.goalSummary || entry.scene.narrative || entry.scene.sceneId}`);
      if (entry.options && entry.options.length > 0) {
        parts.push('  Available options were:');
        entry.options.forEach((option) => {
          parts.push(`  - "${option.label}" (${option.outcome})`);
        });
      }
      parts.push('');
    });
    parts.push('=== CURRENT BEAT ===');
  }

  parts.push(
    `Title: ${title}`,
    `Premise: ${premise}`,
    `Tone: ${tone}`,
    `Difficulty: ${difficulty}`,
    '',
    `Current beat narrative: ${currentScene.narrative}`,
    `Current beat goal: ${currentScene.goalSummary}`,
    `Next intended beat/ending: ${nextScene?.goalSummary || nextScene?.narrative || 'Win ending'}`,
    `Fail ending summary: ${failScene?.goalSummary || failScene?.narrative || 'The player loses momentum and fails'}`,
    '',
    `Return strict JSON only with this shape:`,
    `{
  "options": [
    {
      "label": "Short player-facing option",
      "intent": "Expected semantic intent",
      "outcome": "success|partial|fail",
      "scoreImpact": 1,
      "nextSceneId": "${nextScene?.sceneId || 'scene_win'}",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}`,
    '',
    `Option Requirements (system-decided, follow exactly):`,
    `- Generate exactly ${totalOptions} total options.`,
    `- Exactly ${validOptions} options must lead to the next scene (outcome "success" or "partial").`,
    `- Exactly ${failOptions} options must lead to the fail ending (outcome "fail").`,
    '',
    `Additional Rules:`,
    '- At least one valid option must have outcome "success".',
    '- The remaining valid options can be "success" or "partial" as appropriate for the narrative.',
    '- scoreImpact should generally be in the range -2 to 2.',
    '- Keep labels short and punchy.',
    ''
  );

  // Add narrative consistency guidance if we have history
  if (history.length > 0) {
    parts.push(
      '=== NARRATIVE CONSISTENCY ===',
      '- Options should reference and build upon the story so far.',
      '- Consider what the player has already experienced when crafting new choices.',
      '- Maintain continuity with previous beats while offering meaningful progression.',
      ''
    );
  }

  parts.push('Return JSON only.');

  return parts.join('\n');
}
