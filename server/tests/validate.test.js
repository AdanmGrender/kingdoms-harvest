const { validate } = require('../src/middleware/validate');

function mockReqRes(body) {
  const req = { body: { ...body } };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Validation Middleware', () => {
  // ---- Required fields ----
  describe('Required fields', () => {
    const middleware = validate({
      name: { type: 'string', required: true },
    });

    test('passes when required field present', () => {
      const { req, res, next } = mockReqRes({ name: 'hello' });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('fails when required field missing', () => {
      const { req, res, next } = mockReqRes({});
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/requerido/i);
      expect(next).not.toHaveBeenCalled();
    });

    test('fails when required field is empty string', () => {
      const { req, res, next } = mockReqRes({ name: '' });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('fails when required field is null', () => {
      const { req, res, next } = mockReqRes({ name: null });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---- Number validation ----
  describe('Number type', () => {
    const middleware = validate({
      amount: { type: 'number', required: true, min: 1, max: 9999 },
    });

    test('valid number passes', () => {
      const { req, res, next } = mockReqRes({ amount: 50 });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('string number gets coerced', () => {
      const { req, res, next } = mockReqRes({ amount: '42' });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.amount).toBe(42);
    });

    test('NaN rejected', () => {
      const { req, res, next } = mockReqRes({ amount: 'abc' });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/número válido/i);
    });

    test('float rejected (must be integer)', () => {
      const { req, res, next } = mockReqRes({ amount: 3.5 });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/entero/i);
    });

    test('below min rejected', () => {
      const { req, res, next } = mockReqRes({ amount: 0 });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/al menos/i);
    });

    test('above max rejected', () => {
      const { req, res, next } = mockReqRes({ amount: 10000 });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/máximo/i);
    });

    test('Infinity rejected', () => {
      const { req, res, next } = mockReqRes({ amount: Infinity });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
    });
  });

  // ---- String validation ----
  describe('String type', () => {
    const middleware = validate({
      cropId: { type: 'string', required: true, pattern: /^[a-z_]+$/, maxLength: 30 },
    });

    test('valid string passes', () => {
      const { req, res, next } = mockReqRes({ cropId: 'wheat' });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('invalid pattern rejected', () => {
      const { req, res, next } = mockReqRes({ cropId: 'DROP TABLE;' });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/formato/i);
    });

    test('too long string rejected', () => {
      const { req, res, next } = mockReqRes({ cropId: 'a'.repeat(31) });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/caracteres/i);
    });

    test('number value rejected for string type', () => {
      const { req, res, next } = mockReqRes({ cropId: 12345 });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/texto/i);
    });
  });

  // ---- Object validation ----
  describe('Object type', () => {
    const middleware = validate({
      army: { type: 'object', required: true },
    });

    test('valid object passes', () => {
      const { req, res, next } = mockReqRes({ army: { militia: 5 } });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('array rejected', () => {
      const { req, res, next } = mockReqRes({ army: [1, 2, 3] });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/objeto/i);
    });

    test('null rejected', () => {
      const { req, res, next } = mockReqRes({ army: null });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('string rejected', () => {
      const { req, res, next } = mockReqRes({ army: 'not an object' });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
    });
  });

  // ---- Optional fields ----
  describe('Optional fields', () => {
    const middleware = validate({
      name: { type: 'string', maxLength: 30 },
    });

    test('missing optional field passes', () => {
      const { req, res, next } = mockReqRes({});
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('null optional field passes', () => {
      const { req, res, next } = mockReqRes({ name: null });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ---- Multiple fields ----
  describe('Multiple field validation', () => {
    const middleware = validate({
      resourceId: { type: 'string', required: true, pattern: /^[a-z_]+$/ },
      quantity: { type: 'number', required: true, min: 1, max: 9999 },
    });

    test('all valid passes', () => {
      const { req, res, next } = mockReqRes({ resourceId: 'gold', quantity: 10 });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('multiple errors reported', () => {
      const { req, res, next } = mockReqRes({ resourceId: '', quantity: 'abc' });
      middleware(req, res, next);
      expect(res.statusCode).toBe(400);
      // Should contain errors for both fields
      expect(res.body.error).toMatch(/resourceId/);
    });
  });
});
