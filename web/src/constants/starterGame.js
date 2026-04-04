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
      renderConfig: {
        theme: 'pastel',
        backgroundLayers: ['mist-hills', 'city-wall'],
        foregroundLayers: ['gate-arch', 'lantern'],
        sprite: { id: 'hero', mood: 'curious', x: 0.5, y: 0.82 }
      },
      avenues: [
        {
          avenueId: 'a_talk',
          label: 'Reason with the guard',
          keywords: ['talk', 'reason', 'convince'],
          points: 2,
          nextSceneId: 'scene_square',
          visualEffects: {
            transition: 'fade',
            spriteMood: 'calm',
            setTheme: 'sunrise',
            enableLayers: ['guard-friendly'],
            disableLayers: ['gate-arch']
          }
        },
        {
          avenueId: 'a_sneak',
          label: 'Sneak through side alley',
          keywords: ['sneak', 'stealth', 'alley'],
          points: 1,
          nextSceneId: 'scene_square',
          visualEffects: {
            transition: 'scanline',
            spriteMood: 'focused',
            setTheme: 'night',
            enableLayers: ['shadow-trail'],
            disableLayers: ['lantern']
          }
        }
      ]
    },
    {
      sceneId: 'scene_square',
      narrative: 'Inside the square, you spot a relic chest and hear alarm bells.',
      isTerminal: false,
      imageKey: 'square',
      renderConfig: {
        theme: 'sunrise',
        backgroundLayers: ['market-stalls', 'watchtower'],
        foregroundLayers: ['chest', 'crowd'],
        sprite: { id: 'hero', mood: 'alert', x: 0.5, y: 0.82 }
      },
      avenues: [
        {
          avenueId: 'a_help',
          label: 'Help civilians first',
          keywords: ['help', 'save', 'protect'],
          points: 2,
          nextSceneId: 'scene_end',
          visualEffects: {
            transition: 'arcade-flash',
            spriteMood: 'heroic',
            setTheme: 'victory',
            enableLayers: ['banner-light'],
            disableLayers: ['crowd']
          }
        },
        {
          avenueId: 'a_loot',
          label: 'Rush for the relic chest',
          keywords: ['loot', 'chest', 'relic'],
          points: -1,
          nextSceneId: 'scene_end',
          visualEffects: {
            transition: 'glitch',
            spriteMood: 'greedy',
            setTheme: 'crimson',
            enableLayers: ['alarm-runes'],
            disableLayers: ['banner-light']
          }
        }
      ]
    },
    {
      sceneId: 'scene_end',
      narrative: 'The town records your actions. Dawn breaks over Emberfall.',
      isTerminal: true,
      imageKey: 'dawn',
      renderConfig: {
        theme: 'victory',
        backgroundLayers: ['horizon', 'tower-bells'],
        foregroundLayers: ['town-plaza'],
        sprite: { id: 'hero', mood: 'resolved', x: 0.5, y: 0.82 }
      },
      avenues: []
    }
  ]
};
