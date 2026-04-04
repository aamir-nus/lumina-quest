export function buildGameOptionPrompt({ title, premise, tone, difficulty, currentScene, nextScene, failScene, optionCounts }) {
  const { totalOptions, validOptions, failOptions } = optionCounts;

  return [
    'You are writing player-facing options for a guided graph game.',
    'This is a game, so surprising or mischievous options are acceptable if they still respect the authored graph.',
    '',
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
    '',
    'Return JSON only.'
  ].join('\n');
}
