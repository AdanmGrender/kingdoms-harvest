/**
 * QuickActionsSidebar — Left vertical rail with fast-access actions.
 * Inspired by Whiteout Survival / Last War layout.
 */
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import IconButton from '../ui/IconButton';
import { KH } from '../ui/kitPieces';

const ACTIONS = [
  { id: 'castle', sprite: 'castle', label: 'Bastión', color: KH.brass },
  { id: 'waves', sprite: 'tide', label: 'Marea', color: KH.seal },
  { id: 'missions', sprite: 'scroll', label: 'Misiones', color: KH.brass, badge: 3 },
  { id: 'build', sprite: 'blueprint', label: 'Construir', color: KH.ember },
  { id: 'explore', sprite: 'star', label: 'Marca', color: KH.macula },
  { id: 'settings', sprite: 'gear', label: 'Ajustes', color: KH.iron },
];

export default function QuickActionsSidebar() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  const missions = useGameStore((s) => s.missions);

  const missionCount = missions?.filter((m) => m.status === 'active' || m.status === 'available').length || 0;

  const handleAction = (id) => {
    switch (id) {
      case 'castle':
        EventBridge.emit('camera:centerOnCastle');
        break;
      case 'waves':
        setOverlay('waves', {});
        break;
      case 'missions':
        setOverlay('missions', {});
        break;
      case 'build':
        EventBridge.emit('building:toolbar:toggle');
        break;
      case 'explore':
        setOverlay('system', {});
        break;
      case 'settings':
        setOverlay('settings', {});
        break;
    }
  };

  return (
    <div className="absolute left-2 top-32 z-20 pointer-events-none flex flex-col gap-2">
      {ACTIONS.map((a) => {
        const badge = a.id === 'missions' ? missionCount : a.badge;
        return (
          <IconButton
            key={a.id}
            icon={a.sprite}
            label={a.label}
            accent={a.color}
            iconSize={a.id === 'castle' ? 40 : 32}
            title={a.label}
            onClick={() => handleAction(a.id)}
          >
            {badge > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold font-numeric"
                style={{ backgroundColor: KH.seal, color: KH.bone, border: `1px solid ${KH.ink}` }}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </IconButton>
        );
      })}
    </div>
  );
}
