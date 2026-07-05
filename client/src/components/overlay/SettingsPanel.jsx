/**
 * SettingsPanel v2 (F1 idle) — bottom sheet de configuración completa:
 *  - Master toggle del bot + los 9 flags granulares de notification_preferences
 *  - Audio (mute/volumen — gancho vía EventBridge 'settings:audio', persiste
 *    en localStorage; el juego aún no tiene sonido, el gancho queda listo)
 *  - Gráficos: toggle de efectos de ambiente (viñeta/cielo/glows) para
 *    teléfonos débiles — EventBridge 'settings:ambient'
 */
import { useEffect, useState } from 'react';
import api from '../../services/api';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

const NOTIF_TYPES = [
  { key: 'crops',          icon: '🌾', label: 'Cultivos listos' },
  { key: 'buildings',      icon: '🏗️', label: 'Construcciones' },
  { key: 'troops',         icon: '🪖', label: 'Tropas entrenadas' },
  { key: 'animals',        icon: '🐾', label: 'Bestias' },
  { key: 'research',       icon: '🔬', label: 'Investigación' },
  { key: 'sieges',         icon: '💥', label: 'Asedios' },
  { key: 'events',         icon: '🌩️', label: 'Eventos y tormentas' },
  { key: 'withdrawals',    icon: '💎', label: 'Retiros KH' },
  { key: 'daily_reminder', icon: '⏰', label: 'Recordatorio diario' },
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

  const toggleAmbient = () => {
    const next = !ambientFx;
    setAmbientFx(next);
    saveLocal('kh_ambient_fx', next);
    EventBridge.emit('settings:ambient', { enabled: next });
    addNotification(next ? 'Efectos de ambiente activados' : 'Efectos de ambiente apagados (recarga para aplicar todo)', 'info');
  };

  const version = import.meta.env.VITE_APP_VERSION || 'dev';

  return (
    <div
      className="mx-2 mb-2 rounded-t-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(23, 21, 26, 0.97)',
        border: '1px solid rgba(217, 164, 65, 0.3)',
        maxHeight: '75vh',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30 shrink-0">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          ⚙️ Configuración
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-4 py-3 space-y-4 overflow-y-auto flex-1">
        {/* ── Audio y gráficos ── */}
        <Section title="Juego">
          <Row icon="🔇" title="Silenciar audio" subtitle={muted ? 'Silenciado' : 'Sonido activo'}
            control={<Toggle on={!muted} onChange={toggleMute} />} />
          <Row icon="🌫️" title="Efectos de ambiente" subtitle="Viñeta, cielo, luces — apagar en teléfonos lentos"
            control={<Toggle on={ambientFx} onChange={toggleAmbient} />} />
        </Section>

        {/* ── Notificaciones del bot ── */}
        <Section title="Notificaciones del bot">
          <Row icon="🔔" title="Todas las notificaciones"
            subtitle={notifEnabled ? 'Recibís DMs del bot' : 'Silenciado'}
            control={<Toggle on={notifEnabled} disabled={busy} onChange={toggleMaster} />} />

          {notifEnabled && prefs && NOTIF_TYPES.map(({ key, icon, label }) => (
            <Row key={key} icon={icon} title={label} small
              control={<Toggle on={prefs[key] !== 0 && prefs[key] !== false} onChange={() => togglePref(key)} />} />
          ))}
        </Section>

        {/* ── Cuenta ── */}
        <Section title="Cuenta">
          <Row icon="🆔" title="Telegram ID" subtitle={String(player?.telegram_id || '—')} />
          <Row icon="🏷️" title="Versión" subtitle={version} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ icon, title, subtitle, control, small }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${small ? 'text-lg w-7' : 'text-2xl w-9'} text-center`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`${small ? 'text-xs' : 'text-sm'} text-white font-semibold truncate`}>{title}</p>
        {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
      </div>
      {control}
    </div>
  );
}

function Toggle({ on, disabled, onChange }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${disabled ? 'opacity-50' : ''}`}
      style={{ background: on ? '#16a34a' : '#3f3f46' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
        style={{ left: on ? '22px' : '2px' }}
      />
    </button>
  );
}
