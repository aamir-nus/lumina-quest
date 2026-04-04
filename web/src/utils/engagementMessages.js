const FLOW_GENERATION_MESSAGES = {
  easy: [
    'Consulting the ancient tomes of story...',
    'Weaving simple tales of adventure...',
    'Sketching the outline of your journey...',
    'Preparing a straightforward path for you...',
    'Gathering basic story elements...'
  ],
  medium: [
    'Charting the twists and turns ahead...',
    'Balancing challenge and accessibility...',
    'Crafting meaningful choices for you...',
    'Mapping the narrative branches...',
    'Designing obstacles and rewards...'
  ],
  hard: [
    'Forging a complex web of consequences...',
    'Calculating intricate difficulty curves...',
    'Weaving tales of triumph and tragedy...',
    'Designing brutal challenges ahead...',
    'Constructing a labyrinth of choices...'
  ],
  default: [
    'Consulting the story archives...',
    'Weaving narrative threads...',
    'Preparing your adventure...',
    'Crafting unique story elements...',
    'Designing memorable moments...'
  ]
};

const OPTION_GENERATION_MESSAGES = {
  easy: [
    'Considering simple choices...',
    'Drafting straightforward options...',
    'Preparing clear paths forward...',
    'Creating basic decision points...'
  ],
  medium: [
    'Balancing risk and reward...',
    'Crafting meaningful dilemmas...',
    'Designing tactical options...',
    'Preparing challenging decisions...'
  ],
  hard: [
    'Calculating consequences...',
    'Weighing brutal trade-offs...',
    'Designing deadly options...',
    'Preparing desperate measures...'
  ],
  default: [
    'Generating choices...',
    'Crafting decision points...',
    'Considering options...',
    'Preparing pathways...'
  ]
};

export function getRandomEngagementMessage(type, difficulty = 'medium') {
  const messages = type === 'flow' ? FLOW_GENERATION_MESSAGES : OPTION_GENERATION_MESSAGES;
  const difficultyMessages = messages[difficulty] || messages.default;
  return difficultyMessages[Math.floor(Math.random() * difficultyMessages.length)];
}
