/**
 * Utilidades de sanitización para prevenir XSS y ataques de inyección.
 */

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

const HTML_ESCAPE_RE = /[&<>"']/g;

/**
 * Escapa caracteres HTML peligrosos para prevenir XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Sanitiza texto de usuario: recorta espacios, limita longitud y escapa HTML.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string|null}
 */
function sanitizeDisplayText(str, maxLen = 50) {
  if (typeof str !== 'string' || !str.trim()) return null;
  return escapeHtml(str.trim().slice(0, maxLen));
}

/**
 * Escapa caracteres especiales de Telegram MarkdownV2.
 * @param {string} str
 * @returns {string}
 */
function escapeTelegramMarkdown(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[*_`\[\]()~>#+\-=|{}.!\\]/g, '\\$&');
}

module.exports = { escapeHtml, sanitizeDisplayText, escapeTelegramMarkdown };
