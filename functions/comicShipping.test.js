import test from 'node:test';
import assert from 'node:assert/strict';
import { validateComicShipping } from './comicShipping.js';

const destination = (state = 'NY', postal_code = '10538', country = 'US') => ({
  name: 'Test Reader', address: { line1: '1 Main Street', city: 'Larchmont', state, postal_code, country },
});

test('accepts mainland and DC addresses, normalizes input, preserves ZIP+4', () => {
  assert.equal(validateComicShipping(destination()).address.line2, '');
  assert.equal(validateComicShipping(destination('DC', '20001')).address.state, 'DC');
  assert.equal(validateComicShipping(destination(' ny ', '10538-1234', 'us')).address.postal_code, '10538-1234');
});

test('rejects excluded states, territories, military and foreign destinations', () => {
  for (const [state, zip, country] of [
    ['AK', '99501'], ['HI', '96801'], ['PR', '00901'], ['GU', '96910'],
    ['AA', '34001'], ['AE', '09001'], ['AP', '96201'], ['NY', '10538', 'CA'],
  ]) assert.throws(() => validateComicShipping(destination(state, zip, country)));
});

test('excluded ZIP codes cannot bypass the restriction with a mainland state', () => {
  for (const zip of ['99501', '99950', '96701', '96801', '00901', '00601', '96910', '09001', '09801', '34001', '96201', '96601']) {
    assert.throws(() => validateComicShipping(destination('NY', zip)));
  }
});

test('rejects incomplete and malformed shipping data', () => {
  for (const value of [null, {}, { name: 'Reader' }, destination('NY', '123'), destination('NY', 'abcde')]) {
    assert.throws(() => validateComicShipping(value));
  }
  const value = destination();
  value.address.line1 = ' ';
  assert.throws(() => validateComicShipping(value));
});
