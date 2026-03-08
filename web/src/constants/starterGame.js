export const starterGame = {
  title: 'The Gate of Emberfall',
  description: 'A compact 3-scene journey to validate the story engine.',
  constraints: { maxTurns: 4, targetPoints: 3 },
  wildcardConfig: {
    enabled: true,
    recoverySceneId: 'scene_square',
    highRewardPoints: 2,
    lowRewardPoints: 0
  },
  startSceneId: 'scene_start',
  scenes: [
    {
      sceneId: 'scene_start',
      narrative: 'You arrive at Emberfall gate. A wary guard blocks the entrance.',
      isTerminal: false,
      imageKey: 'gate',
      avenues: [
        {
          avenueId: 'a_talk',
          label: 'Reason with the guard',
          keywords: ['talk', 'reason', 'convince'],
          points: 2,
          nextSceneId: 'scene_square'
        },
        {
          avenueId: 'a_sneak',
          label: 'Sneak through side alley',
          keywords: ['sneak', 'stealth', 'alley'],
          points: 1,
          nextSceneId: 'scene_square'
        }
      ]
    },
    {
      sceneId: 'scene_square',
      narrative: 'Inside the square, you spot a relic chest and hear alarm bells.',
      isTerminal: false,
      imageKey: 'square',
      avenues: [
        {
          avenueId: 'a_help',
          label: 'Help civilians first',
          keywords: ['help', 'save', 'protect'],
          points: 2,
          nextSceneId: 'scene_end'
        },
        {
          avenueId: 'a_loot',
          label: 'Rush for the relic chest',
          keywords: ['loot', 'chest', 'relic'],
          points: -1,
          nextSceneId: 'scene_end'
        }
      ]
    },
    {
      sceneId: 'scene_end',
      narrative: 'The town records your actions. Dawn breaks over Emberfall.',
      isTerminal: true,
      imageKey: 'dawn',
      avenues: []
    }
  ]
};
