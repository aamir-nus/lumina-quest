import { validateGameTemplate } from '../services/gameTemplateValidator.js';

export function validatePublishability(game) {
  return validateGameTemplate(game, { mode: 'publish' });
}
