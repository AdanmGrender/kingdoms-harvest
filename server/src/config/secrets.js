const fs = require('fs');
const path = require('path');

/**
 * Load a secret from a secrets file OR an environment variable (fallback).
 *
 * Priority:
 *   1. File at SECRETS_DIR/<name>  — compatible with Docker secrets,
 *      Kubernetes secrets, or any file-based secret manager.
 *   2. Environment variable named <name>
 *
 * SECRETS_DIR defaults to <project_root>/server/secrets/.
 * In production, emits a warning when falling back to env var so operators
 * know the more secure file-based path is available.
 */
function loadSecret(name) {
  const secretsDir = process.env.SECRETS_DIR
    || path.join(__dirname, '../../secrets');

  const filePath = path.join(secretsDir, name);

  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
  } catch {
    // fall through
  }

  const value = process.env[name] || null;

  if (value && process.env.NODE_ENV === 'production') {
    console.warn(
      `[Security] Secret '${name}' loaded from env var. ` +
      `For production, store it as a file at ${filePath} ` +
      `(or set SECRETS_DIR) to avoid embedding secrets in process environment.`
    );
  }

  return value;
}

module.exports = { loadSecret };
