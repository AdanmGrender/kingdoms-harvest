/**
 * captchaService: Simple in-game challenge tasks for daily rewards + anti-bot protection.
 *
 * Three challenge types:
 *   - math:     "Cuanto es 7 + 13?" → answer "20"
 *   - sequence: "Que sigue? 2, 4, 8, 16, ?" → answer "32"
 *   - word:     "Desordena: LEHTKSNI" → answer "KNIGHTS"
 *
 * Challenges expire in 5 minutes. Max 5 attempts per day per player.
 * All state is in-memory (resets on server restart — intentional).
 */

const crypto = require('crypto');

// In-memory store: playerId -> { answer, question, type, expiresAt, attemptsToday, attemptDate }
const store = new Map();

const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_DAILY_ATTEMPTS = 5;

// Medieval-themed words for the word scramble challenge
const WORD_LIST = [
  'HARVEST', 'KINGDOM', 'CASTLE', 'KNIGHT', 'ARCHER',
  'FARMER', 'MILLER', 'SHIELD', 'BATTLE', 'TAVERN',
  'MARKET', 'WINTER', 'FORGE', 'BANNER', 'THRONE',
];

// ─── Challenge generators ───────────────────────────────────────────────────

function generateMathChallenge() {
  const ops = ['+', '-', '*'];
  const op = ops[crypto.randomInt(0, ops.length)];
  let a, b, answer;

  if (op === '+') {
    a = crypto.randomInt(1, 20);
    b = crypto.randomInt(1, 20);
    answer = a + b;
  } else if (op === '-') {
    a = crypto.randomInt(5, 25);
    b = crypto.randomInt(1, a); // ensure non-negative
    answer = a - b;
  } else {
    a = crypto.randomInt(2, 10);
    b = crypto.randomInt(2, 10);
    answer = a * b;
  }

  return {
    type: 'math',
    question: `Cuanto es ${a} ${op} ${b}?`,
    answer: String(answer),
  };
}

function generateSequenceChallenge() {
  const start = crypto.randomInt(1, 6);
  const ratio = crypto.randomInt(2, 5);
  // Geometric: start, start*r, start*r^2, start*r^3, start*r^4
  const terms = [start, start * ratio, start * ratio ** 2, start * ratio ** 3];
  const next = start * ratio ** 4;

  return {
    type: 'sequence',
    question: `Que sigue? ${terms.join(', ')}, ?`,
    answer: String(next),
  };
}

function generateWordChallenge() {
  const word = WORD_LIST[crypto.randomInt(0, WORD_LIST.length)];
  // Fisher-Yates shuffle of letters
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const scrambled = letters.join('');

  return {
    type: 'word',
    question: `Desordena esta palabra medieval: ${scrambled}`,
    answer: word,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate (or regenerate) a captcha challenge for a player.
 * Returns { question, type, expiresAt } — never includes the answer.
 */
function generateChallenge(playerId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const existing = store.get(playerId);

  // Count today's attempts
  let attemptsToday = 0;
  if (existing && existing.attemptDate === today) {
    attemptsToday = existing.attemptsToday;
  }

  if (attemptsToday >= MAX_DAILY_ATTEMPTS) {
    throw new Error(`Limite diario de intentos alcanzado (${MAX_DAILY_ATTEMPTS}/dia). Vuelve manana!`);
  }

  // Pick a random challenge type
  const types = ['math', 'sequence', 'word'];
  const type = types[crypto.randomInt(0, types.length)];

  let challenge;
  if (type === 'math') challenge = generateMathChallenge();
  else if (type === 'sequence') challenge = generateSequenceChallenge();
  else challenge = generateWordChallenge();

  const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();

  store.set(playerId, {
    answer: challenge.answer,
    question: challenge.question,
    type: challenge.type,
    expiresAt,
    attemptsToday,
    attemptDate: today,
  });

  return {
    question: challenge.question,
    type: challenge.type,
    expiresAt,
    attemptsRemaining: MAX_DAILY_ATTEMPTS - attemptsToday,
  };
}

/**
 * Verify a player's answer against their stored challenge.
 * Returns { correct: boolean, message: string, attemptsRemaining?: number }
 * On correct: deletes the challenge from store.
 */
function solveChallenge(playerId, answer) {
  const entry = store.get(playerId);

  if (!entry) {
    throw new Error('No hay desafio activo. Genera uno primero.');
  }

  if (new Date(entry.expiresAt) <= new Date()) {
    store.delete(playerId);
    throw new Error('El desafio expiro. Genera uno nuevo.');
  }

  const today = new Date().toISOString().slice(0, 10);

  // Normalize: trim + uppercase for case-insensitive comparison
  const normalized = answer.trim().toUpperCase();
  const expected = entry.answer.trim().toUpperCase();

  if (normalized === expected) {
    store.delete(playerId);
    return { correct: true, message: '¡Correcto! +5 KH Tokens' };
  }

  // Wrong answer — increment attempt count
  const newAttempts = (entry.attemptDate === today ? entry.attemptsToday : 0) + 1;
  store.set(playerId, {
    ...entry,
    attemptsToday: newAttempts,
    attemptDate: today,
  });

  const remaining = MAX_DAILY_ATTEMPTS - newAttempts;

  if (remaining <= 0) {
    store.delete(playerId);
    return {
      correct: false,
      message: 'Incorrecto. Sin intentos restantes por hoy.',
      attemptsRemaining: 0,
    };
  }

  return {
    correct: false,
    message: `Incorrecto. Te quedan ${remaining} intento(s) hoy.`,
    attemptsRemaining: remaining,
  };
}

// Prune expired challenges every 10 minutes to prevent memory leaks
setInterval(() => {
  const now = new Date();
  for (const [playerId, entry] of store.entries()) {
    if (new Date(entry.expiresAt) <= now) {
      store.delete(playerId);
    }
  }
}, 10 * 60 * 1000);

module.exports = { generateChallenge, solveChallenge };
