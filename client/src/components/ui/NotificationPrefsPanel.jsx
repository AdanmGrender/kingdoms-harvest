import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from './SpriteIcon';
import Panel from './Panel';
import Toggle from './Toggle';
import { KH } from './kitPieces';

const NOTIFICATION_TYPES = [
  { key: 'crops',          icon: 'wheat', label: 'Cultivos listos',      desc: 'Cuando tus cultivos están listos para cosechar' },
  { key: 'buildings',      icon: 'hammer', label: 'Construcciones',        desc: 'Cuando un edificio termina de construirse o mejorarse' },
  { key: 'troops',         icon: 'sword', label: 'Tropas listas',          desc: 'Cuando el entrenamiento de tropas finaliza' },
  { key: 'animals',        icon: 'cow', label: 'Animales listos',        desc: 'Cuando tus animales tienen productos para recolectar' },
  { key: 'withdrawals',    icon: 'gold', label: 'Retiros TON',            desc: 'Estado de tus retiros de tokens a TON' },
  { key: 'sieges',         icon: 'shield', label: 'Ataques y asedios',     desc: 'Cuando recibes un ataque o se resuelve un asedio' },
  { key: 'events',         icon: 'world', label: 'Eventos del mundo',      desc: 'Cuando aparecen nuevos eventos en el mapa' },
  { key: 'daily_reminder', icon: 'scroll', label: 'Recordatorio diario',   desc: 'Te avisamos si llevas más de 24 hs sin jugar' },
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <Panel
        title="Notificaciones"
        onClose={onClose}
        className="w-full max-w-md pb-4"
        style={{ maxHeight: 'calc(var(--kh-frame-h) * 0.8)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs text-kh-bone-dim mb-3 px-1">Configurá las alertas del bot de Telegram</p>

        {!notificationPrefs ? (
          <div className="text-center text-kh-bone-dim py-8">Cargando...</div>
        ) : (
          <div className="space-y-2">
            {NOTIFICATION_TYPES.map(({ key, icon, label, desc }) => {
              const enabled = notificationPrefs[key] ?? false;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 rounded-lg"
                  style={{
                    backgroundColor: enabled ? KH['oak-light'] : KH.oak,
                    border: `1px solid ${enabled ? KH['brass-light'] : KH.iron}`,
                  }}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <SpriteIcon name={icon} size={28} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-kh-bone">{label}</p>
                      <p className="text-[11px] text-kh-bone-dim leading-tight">{desc}</p>
                    </div>
                  </div>

                  <Toggle on={enabled} label={label} onChange={() => handleToggle(key)} className="ml-2" />
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-kh-bone-dim mt-4">
          También podés gestionar las notificaciones con el comando <span className="text-kh-brass-light">/notificaciones</span> en el bot.
        </p>
      </Panel>
    </div>
  );
}
