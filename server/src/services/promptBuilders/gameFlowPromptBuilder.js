export function getDifficultyConfig(difficulty = 'easy') {
  if (difficulty === 'hard') {
    return { minBeats: 7, maxBeats: 10, optionCount: 5 };
  }
  if (difficulty === 'medium') {
    return { minBeats: 5, maxBeats: 7, optionCount: 4 };
  }
  return { minBeats: 3, maxBeats: 5, optionCount: 3 };
}

export function buildGameFlowPrompt({ title, description, premise, startGoal, endGoal, tone, difficulty }) {
  const config = getDifficultyConfig(difficulty);
  return [
    'You are designing a small single-player narrative game.',
    'This is a game. Dramatic, weird, risky, and playful ideas are allowed if they still produce a coherent guided graph.',
    '',
    `Title: ${title}`,
    `Description: ${description || 'A polished short adventure'}`,
    `Premise: ${premise}`,
    `Start goal: ${startGoal}`,
    `End goal: ${endGoal}`,
    `Tone: ${tone}`,
    `Difficulty: ${difficulty}`,
    '',
    'Return strict JSON only with this shape:',
    `{
  "start": {
    "sceneId": "scene_start",
    "narrative": "Opening scene text",
    "goalSummary": "What the player must achieve first"
  },
  "beats": [
    {
      "sceneId": "scene_1",
      "narrative": "What happens in this beat",
      "goalSummary": "What the player needs to do in this beat"
    }
  ],
  "endings": [
    {
      "sceneId": "scene_win",
      "narrative": "Winning ending text",
      "goalSummary": "Winning outcome summary",
      "endingType": "win"
    },
    {
      "sceneId": "scene_fail",
      "narrative": "Failure ending text",
      "goalSummary": "Failure outcome summary",
      "endingType": "fail"
    }
  ]
}`,
    '',
    `Rules:`,
    `- Create between ${config.minBeats} and ${config.maxBeats} beat scenes.`,
    '- Include exactly one start scene.',
    '- Include at least one win ending and one fail ending.',
    '- Beat summaries must naturally connect startGoal to endGoal in order.',
    '- Keep every scene concise and directly usable by an admin editor.',
    '',
    'Return JSON only.'
  ].join('\n');
}
