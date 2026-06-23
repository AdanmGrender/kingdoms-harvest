/**
 * SettingsPanel — bottom sheet with player preferences (notif toggle for now).
 * Wired from QuickActionsSidebar.settings.
 */
import { useEffect, useState } from 'react';
import api from '../../services/api';
import useGameStore from '../../store/gameStore';

export default function SettingsPanel({ onClose }) {
  const player = useGameStore((s) => s.player);
  const addNotification = useGameStore((s) => s.addNotification);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (player && typeof player.notif_enabled !== 'undefined') {
      setNotifEnabled(!!player.notif_enabled);
    }
  }, [player]);

  const toggleNotif = async () => {
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

  const version = import.meta.env.VITE_APP_VERSION || 'iso-rework';

  return (
    <div
      className="mx-2 mb-2 rounded-t-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(22, 33, 62, 0.97)',
        border: '1px solid rgba(255, 215, 0, 0.3)',
        maxHeight: '75vh',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30 shrink-0">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          ⚙️ Ajustes
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-4 py-3 space-y-4 overflow-y-auto flex-1">
        <Row
          icon="🔔"
          title="Notificaciones del bot"
          subtitle={notifEnabled ? 'Recibís DMs del bot' : 'Silenciado'}
          control={
            <Toggle on={notifEnabled} disabled={busy} onChange={toggleNotif} />
          }
        />

        <Row
          icon="🆔"
          title="Telegram ID"
          subtitle={String(player?.telegram_id || '—')}
        />

        <Row
          icon="🏷️"
          title="Versión"
          subtitle={version}
        />

        <p className="text-[10px] text-gray-500 text-center pt-2">
          Más opciones próximamente.
        </p>
      </div>
    </div>
  );
}

function Row({ icon, title, subtitle, control }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-2xl w-9 text-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-semibold truncate">{title}</p>
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
      className={`relative w-11 h-6 rounded-full transition-colors ${disabled ? 'opacity-50' : ''}`}
      style={{ background: on ? '#16a34a' : '#3f3f46' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
        style={{ left: on ? '22px' : '2px' }}
      />
    </button>
  );
}
