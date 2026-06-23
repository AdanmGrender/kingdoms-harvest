const { escapeHtml } = require('../utils/sanitize');

/**
 * Propiedades peligrosas para prototype pollution.
 */
const DANGEROUS_PROPS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Middleware de validación de inputs.
 * Recibe un schema { campo: { type, required, min, max, maxLength, pattern, maxKeys } }
 *
 * Seguridad:
 * - Auto-escapa HTML en todos los campos string validados (defensa anti-XSS)
 * - Bloquea prototype pollution en campos object
 * - Limita número de propiedades en objetos (maxKeys)
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const source = req.body;

    for (const [field, rules] of Object.entries(schema)) {
      const value = source[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} es requerido`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rules.type === 'number') {
        const num = Number(value);
        if (isNaN(num) || !Number.isFinite(num)) {
          errors.push(`${field} debe ser un número válido`);
          continue;
        }
        if (!Number.isInteger(num)) {
          errors.push(`${field} debe ser un número entero`);
          continue;
        }
        if (rules.min !== undefined && num < rules.min) {
          errors.push(`${field} debe ser al menos ${rules.min}`);
        }
        if (rules.max !== undefined && num > rules.max) {
          errors.push(`${field} debe ser como máximo ${rules.max}`);
        }
        // Coerce to number in body
        req.body[field] = num;
      }

      if (rules.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${field} debe ser texto`);
          continue;
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} debe tener máximo ${rules.maxLength} caracteres`);
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} tiene un formato inválido`);
        }
        // Auto-escape HTML en strings validados (defensa anti-XSS)
        req.body[field] = escapeHtml(value);
      }

      if (rules.type === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push(`${field} debe ser verdadero o falso`);
          continue;
        }
      }

      if (rules.type === 'object') {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push(`${field} debe ser un objeto`);
          continue;
        }
        // Guardia anti-prototype-pollution
        const keys = Object.keys(value);
        if (keys.some((k) => DANGEROUS_PROPS.has(k))) {
          errors.push(`${field} contiene propiedades no permitidas`);
          continue;
        }
        // Limitar número de propiedades
        if (rules.maxKeys && keys.length > rules.maxKeys) {
          errors.push(`${field} tiene demasiadas propiedades (máx ${rules.maxKeys})`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    next();
  };
}

module.exports = { validate };
