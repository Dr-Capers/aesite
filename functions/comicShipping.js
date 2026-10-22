export const SHIPPING_STATES = 'AL AZ AR CA CO CT DE DC FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');

export function validateComicShipping(value) {
  const shipping = { name: '', address: {} };
  const clean = (input, max, required = true) => {
    if (typeof input !== 'string' || input.trim().length > max || (required && !input.trim())) {
      throw new Error('Enter a complete shipping address.');
    }
    return input.trim();
  };
  shipping.name = clean(value?.name, 100);
  for (const key of ['line1', 'city']) shipping.address[key] = clean(value?.address?.[key], 100);
  shipping.address.line2 = clean(value?.address?.line2 ?? '', 100, false);
  shipping.address.country = clean(value?.address?.country, 2).toUpperCase();
  shipping.address.state = clean(value?.address?.state, 2).toUpperCase();
  shipping.address.postal_code = clean(value?.address?.postal_code, 10);
  const { country, state, postal_code: zip } = shipping.address;
  if (country !== 'US' || !SHIPPING_STATES.includes(state)) {
    throw new Error('We currently ship only to the lower 48 US states and Washington, DC.');
  }
  if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new Error('Enter a valid US ZIP code.');
  // Exclude territorial, military, Alaska and Hawaii ZIP ranges even with a mainland state selected.
  const prefix = Number(zip.slice(0, 3));
  if (prefix < 10 || (prefix >= 90 && prefix <= 98) || prefix === 340 ||
      (prefix >= 962 && prefix <= 969) || prefix >= 995) {
    throw new Error('This ZIP code is outside our current shipping area.');
  }
  return shipping;
}
