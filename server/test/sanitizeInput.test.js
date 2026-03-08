import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInput } from '../src/middleware/sanitizeInput.js';

test('sanitizeInput strips dollar and dot keys', () => {
  const req = {
    body: { '$where': 'x', 'user.name': 'aamir' },
    query: {},
    params: {}
  };

  sanitizeInput(req, {}, () => {});

  assert.equal(req.body.where, 'x');
  assert.equal(req.body.user_name, 'aamir');
});
