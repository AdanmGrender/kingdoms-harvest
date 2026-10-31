/**
 * Selección de la fuente de eventos (combate_b R21–R22, design §7). PURO.
 *  - `state.events` presente y `eventsVersion === 1` → 'events' (eventos reales del motor v2).
 *  - `state.events` ausente (motor v1)               → 'adapter'.
 *  - `state.events` presente con otra versión        → 'adapter' + un warn (una vez por versión).
 */
import { deriveEvents } from './v1Adapter';
import { eventsForRound } from './eventPlanner';

const warned = new Set();
export function _resetWarnings() { warned.clear(); }

export function selectEventSource(state, prev, warn = console.warn.bind(console)) {
  if (!state || !Array.isArray(state.events)) return 'adapter';
  if (state.eventsVersion === 1) return 'events';
  const key = String(state.eventsVersion);
  if (!warned.has(key)) {
    warned.add(key);
    warn(`[combat] eventsVersion ${key} no soportada: se usa el adaptador v1`);
  }
  return 'adapter';
}

/**
 * Eventos de la ronda que acaba de responder el servidor, venga de donde venga.
 * @returns { source, events }
 */
export function eventsForStep({ prev, state, roundLog, action, result, warn }) {
  const source = selectEventSource(state, prev, warn);
  if (source === 'events') return { source, events: eventsForRound(state, roundLog) };
  return { source, events: deriveEvents(prev, state, roundLog, { action, result }) };
}
