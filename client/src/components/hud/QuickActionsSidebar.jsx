/**
 * QuickActionsSidebar — Left vertical rail with fast-access actions.
 * Inspired by Whiteout Survival / Last War layout.
 */
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

const ACTIONS = [
  { id: 'castle', icon: '🏠', label: 'Castillo', color: '#ffd750' },
  { id: 'missions', icon: '📜', label: 'Misiones', color: '#8fd4ff', badge: 3 },
  { id: 'explore', icon: '🗺️', label: 'Explorar', color: '#8fff9e' },
  { id: 'settings', icon: '⚙️', label: 'Ajustes', color: '#cccccc' },
];

export default function QuickActionsSidebar() {
  const addNotification = useGameStore((s) => s.addNotification);
  const missions = useGameStore((s) => s.missions);

  const missionCount = missions?.length || 0;

  const handleAction = (id) => {
    switch (id) {
      case 'castle':
        EventBridge.emit('camera:centerOnCastle');
        break;
      case 'missions':
        addNotification(`${missionCount} misiones activas`, 'info');
        break;
      case 'explore':
        addNotification('Exploración próximamente', 'info');
        break;
      case 'settings':
        addNotification('Ajustes próximamente', 'info');
        break;
    }
  };

  return (
    <div className="absolute left-2 top-20 z-20 pointer-events-none flex flex-col gap-2">
      {ACTIONS.map((a) => {
        const badge = a.id === 'missions' ? missionCount : a.badge;
        return (
          <button
            key={a.id}
            onClick={() => handleAction(a.id)}
            className="pointer-events-auto relative w-11 h-11 rounded-xl flex items-center justify-center transition-transform active:scale-90 hover:scale-105"
            style={{
              background: `linear-gradient(180deg, rgba(25,28,50,0.95) 0%, rgba(12,14,28,0.92) 100%)`,
              border: `1.5px solid ${a.color}55`,
              boxShadow: `0 2px 8px rgba(0,0,0,0.5), 0 0 10px ${a.color}22, inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
            title={a.label}
          >
            <span className="text-xl drop-shadow">{a.icon}</span>
            {badge > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                  boxShadow: '0 0 6px rgba(255,68,68,0.7)',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
