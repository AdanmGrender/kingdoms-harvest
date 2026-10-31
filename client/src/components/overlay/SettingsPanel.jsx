/**
 * SettingsPanel v2 (F1 idle) — bottom sheet de configuración completa:
 *  - Master toggle del bot + los 9 flags granulares de notification_preferences
 *  - Audio (mute + slider de volumen — vía EventBridge 'settings:audio' con
 *    { muted } / { volume }, persiste en localStorage 'kh_audio_muted' /
 *    'kh_audio_volume'. Lo consume client/src/audio/AudioEngine.js)
 *  - Gráficos: toggle de efectos de ambiente (viñeta/cielo/glows) para
 *    teléfonos débiles — EventBridge 'settings:ambient'
 */
import { useEffect, useState } from 'react';
import api from '../../services/api';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon from '../ui/SpriteIcon';
import Panel from '../ui/Panel';
import Toggle from '../ui/Toggle';
import { KH } from '../ui/kitPieces';

const NOTIF_TYPES = [
  { key: 'crops',          icon: 'wheat', label: 'Cultivos listos' },
  { key: 'buildings',      icon: 'hammer', label: 'Construcciones' },
  { key: 'troops',         icon: 'sword', label: 'Tropas entrenadas' },
  { key: 'animals',        icon: 'cow', label: 'Bestias' },
  { key: 'research',       icon: 'tech', label: 'Investigación' },
  { key: 'sieges',         icon: 'flame', label: 'Asedios' },
  { key: 'events',         icon: 'flame', label: 'Eventos y tormentas' },
  { key: 'withdrawals',    icon: 'gem', label: 'Retiros KH' },
  { key: 'daily_reminder', icon: 'speedup', label: 'Recordatorio diario' },
];

function loadLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

export default function SettingsPanel({ onClose }) {
  const player = useGameStore((s) => s.player);
  const addNotification = useGameStore((s) => s.addNotification);

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [prefs, setPrefs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(() => loadLocal('kh_audio_muted', false));
  const [volume, setVolume] = useState(() => loadLocal('kh_audio_volume', 0.7));
  const [ambientFx, setAmbientFx] = useState(() => loadLocal('kh_ambient_fx', true));

  useEffect(() => {
    if (player && typeof player.notif_enabled !== 'undefined') {
      setNotifEnabled(!!player.notif_enabled);
    }
    api.get('/notifications/prefs')
      .then(({ data }) => setPrefs(data))
      .catch(() => setPrefs({}));
  }, [player]);

  const toggleMaster = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.patch('/player/notif', { enabled: !notifEnabled });
      setNotifEnabled(!!data.enabled);
      addNotification(data.enabled ? 'Notificaciones activadas' : 'Notificaciones silenciadas', 'info');
    } catch (err) {
      addNotification(err.response?.data?.error || 'No se pudo cambiar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const togglePref = async (key) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimista
    try {
      await api.post('/notifications/toggle', { type: key });
    } catch (err) {
      setPrefs(prefs); // revertir
      addNotification(err.response?.data?.error || 'No se pudo cambiar', 'error');
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    saveLocal('kh_audio_muted', next);
    EventBridge.emit('settings:audio', { muted: next });
  };

  // Volumen maestro 0..1 → el motor de audio lo aplica al master gain.
  const changeVolume = (v) => {
    const next = Math.max(0, Math.min(1, v));
    setVolume(next);
    saveLocal('kh_audio_volume', next);
    EventBridge.emit('settings:audio', { volume: next });
  };

  const toggleAmbient = () => {
    const next = !ambientFx;
    setAmbientFx(next);
    saveLocal('kh_ambient_fx', next);
    EventBridge.emit('settings:ambient', { enabled: next });
    addNotification(next ? 'Efectos de ambiente activados' : 'Efectos de ambiente apagados (recarga para aplicar todo)', 'info');
  };

  const version = import.meta.env.VITE_APP_VERSION || 'dev';

  return (
    <Panel
      title={<><SpriteIcon name="gear" size={28} /> Configuración</>}
      onClose={onClose}
      className="mx-2 mb-2 overflow-hidden flex flex-col"
      style={{ maxHeight: 'calc(var(--kh-frame-h) * 0.75)' }}
    >
      <div className="px-2 py-1 space-y-4 overflow-y-auto flex-1 min-h-0">
        {/* ── Audio y gráficos ── */}
        <Section title="Juego">
          <Row icon="moon" title="Silenciar audio" subtitle={muted ? 'Silenciado' : 'Sonido activo'}
            control={<Toggle on={!muted} label="Silenciar audio" onChange={toggleMute} />} />
          <VolumeRow value={volume} disabled={muted} onChange={changeVolume} />
          <Row icon="sun" title="Efectos de ambiente" subtitle="Viñeta, cielo, luces — apagar en teléfonos lentos"
            control={<Toggle on={ambientFx} label="Efectos de ambiente" onChange={toggleAmbient} />} />
        </Section>

        {/* ── Notificaciones del bot ── */}
        <Section title="Notificaciones del bot">
          <Row icon="scroll" title="Todas las notificaciones"
            subtitle={notifEnabled ? 'Recibís DMs del bot' : 'Silenciado'}
            control={<Toggle on={notifEnabled} disabled={busy} label="Todas las notificaciones" onChange={toggleMaster} />} />

          {notifEnabled && prefs && NOTIF_TYPES.map(({ key, icon, label }) => (
            <Row key={key} icon={icon} title={label} small
              control={<Toggle on={prefs[key] !== 0 && prefs[key] !== false} label={label} onChange={() => togglePref(key)} />} />
          ))}
        </Section>

        {/* ── Cuenta ── */}
        <Section title="Cuenta">
          <Row icon="gear" title="Telegram ID" subtitle={String(player?.telegram_id || '—')} />
          <Row icon="gear" title="Versión" subtitle={version} />
        </Section>
      </div>
    </Panel>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] text-kh-bone-dim uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ icon, title, subtitle, control, small }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${small ? 'text-lg w-7' : 'text-2xl w-9'} text-center`}><SpriteIcon name={icon} size={28} /></div>
      <div className="flex-1 min-w-0">
        <p className={`${small ? 'text-xs' : 'text-sm'} text-kh-bone font-semibold truncate`}>{title}</p>
        {subtitle && <p className="text-[11px] leading-tight text-kh-bone-dim line-clamp-2 break-words">{subtitle}</p>}
      </div>
      {control}
    </div>
  );
}

// Slider de volumen maestro (0–100%). Ocupa fila completa por el ancho del range.
function VolumeRow({ value, disabled, onChange }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="text-2xl w-9 text-center"><SpriteIcon name="tide" size={32} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm text-kh-bone font-semibold truncate">Volumen</p>
          <span className="text-[11px] text-kh-bone-dim tabular-nums">{pct}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={pct}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full mt-1 cursor-pointer disabled:cursor-default"
          style={{ height: '44px', accentColor: KH['brass-light'] }}
          aria-label="Volumen maestro"
        />
      </div>
    </div>
  );
}

