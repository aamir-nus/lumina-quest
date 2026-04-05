/**
 * Deterministic option count generation with difficulty-based randomness.
 * The system decides how many options to generate, not the LLM.
 */

/**
 * Get the range of total options per scene based on difficulty.
 * Easier levels have smaller ranges for more predictable gameplay.
 *
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {{ min: number, max: number }} Range of total options
 */
function getTotalOptionRange(difficulty) {
  switch (difficulty) {
    case 'hard':
      // Hard: 1-6 options (larger max for unpredictability)
      return { min: 1, max: 6 };
    case 'medium':
      // Medium: 1-5 options (moderate max)
      return { min: 1, max: 5 };
    case 'easy':
    default:
      // Easy: 1-3 options (smaller max for predictability)
      return { min: 1, max: 3 };
  }
}

/**
 * Get the range of valid options (success/partial outcomes) based on total options.
 * At least one option must always be valid to progress the story.
 *
 * @param {number} totalOptions - Total number of options being generated
 * @returns {{ min: number, max: number }} Range of valid options
 */
function getValidOptionRange(totalOptions) {
  // At least 1 valid option, at most totalOptions - 1 (to leave room for fail options)
  const minValid = 1;
  const maxValid = Math.max(1, totalOptions - 1);
  return { min: minValid, max: maxValid };
}

/**
 * Generate a random integer between min and max (inclusive).
 * Uses Math.random() for unpredictability while keeping ranges controlled.
 *
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer in range [min, max]
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Determine option counts for a scene based on difficulty.
 * Returns system-decided counts that will be passed to the LLM.
 *
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {{
 *   totalOptions: number,
 *   validOptions: number,
 *   failOptions: number
 * }}
 */
export function generateOptionCounts(difficulty = 'easy') {
  const totalRange = getTotalOptionRange(difficulty);
  const totalOptions = randomInt(totalRange.min, totalRange.max);

  const validRange = getValidOptionRange(totalOptions);
  const validOptions = randomInt(validRange.min, validRange.max);

  const failOptions = totalOptions - validOptions;

  return {
    totalOptions,
    validOptions,
    failOptions
  };
}

/**
 * Get the expected range for UI display purposes.
 * Returns the min/max that can be generated for a given difficulty.
 *
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {{ min: number, max: number }} Expected range
 */
export function getExpectedOptionRange(difficulty = 'easy') {
  return getTotalOptionRange(difficulty);
}
