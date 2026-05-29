import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const NOTIFICATION_TYPES = [
  { key: 'crops',          icon: '🌾', label: 'Cultivos listos',      desc: 'Cuando tus cultivos están listos para cosechar' },
  { key: 'buildings',      icon: '🏗️', label: 'Construcciones',        desc: 'Cuando un edificio termina de construirse o mejorarse' },
  { key: 'troops',         icon: '⚔️', label: 'Tropas listas',          desc: 'Cuando el entrenamiento de tropas finaliza' },
  { key: 'animals',        icon: '🐄', label: 'Animales listos',        desc: 'Cuando tus animales tienen productos para recolectar' },
  { key: 'withdrawals',    icon: '💰', label: 'Retiros TON',            desc: 'Estado de tus retiros de tokens a TON' },
  { key: 'sieges',         icon: '🛡️', label: 'Ataques y asedios',     desc: 'Cuando recibes un ataque o se resuelve un asedio' },
  { key: 'events',         icon: '🌍', label: 'Eventos del mundo',      desc: 'Cuando aparecen nuevos eventos en el mapa' },
  { key: 'daily_reminder', icon: '📅', label: 'Recordatorio diario',   desc: 'Te avisamos si llevas más de 24 hs sin jugar' },
];

export default function NotificationPrefsPanel({ onClose }) {
  const notificationPrefs = useGameStore((s) => s.notificationPrefs);
  const loadNotificationPrefs = useGameStore((s) => s.loadNotificationPrefs);
  const toggleNotificationPref = useGameStore((s) => s.toggleNotificationPref);

  useEffect(() => {
    if (!notificationPrefs) loadNotificationPrefs();
  }, [notificationPrefs, loadNotificationPrefs]);

  const handleToggle = async (key) => {
    await toggleNotificationPref(key);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-4 pb-8"
        style={{ background: '#16213e', border: '1px solid rgba(255,215,0,0.3)', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-yellow-400" style={{ fontFamily: 'MedievalSharp, serif' }}>
              🔔 Notificaciones
            </h2>
            <p className="text-xs text-gray-400">Configurá las alertas del bot de Telegram</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {!notificationPrefs ? (
          <div className="text-center text-gray-400 py-8">Cargando...</div>
        ) : (
          <div className="space-y-2">
            {NOTIFICATION_TYPES.map(({ key, icon, label, desc }) => {
              const enabled = notificationPrefs[key] ?? false;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: enabled ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${enabled ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}` }}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-xl shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-[11px] text-gray-400 leading-tight">{desc}</p>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={() => handleToggle(key)}
                    className="shrink-0 ml-3 relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    style={{ background: enabled ? '#4ade80' : '#374151' }}
                  >
                    <span
                      className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                      style={{ transform: enabled ? 'translateX(22px)' : 'translateX(4px)' }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-gray-500 mt-4">
          También podés gestionar las notificaciones con el comando <span className="text-yellow-400">/notificaciones</span> en el bot.
        </p>
      </div>
    </div>
  );
}
