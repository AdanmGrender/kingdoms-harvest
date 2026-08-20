/**
 * SocialSidebar — Right rail lower: alliance, mail, achievements, inventory.
 */
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon from '../ui/SpriteIcon';
import { grimBtn } from './grimChrome';

const SOCIAL = [
  { id: 'achievements', sprite: 'star',   icon: '⭐', label: 'Logros',   color: '#d9a441', metaTab: 'achievements' },
  { id: 'alliance',     sprite: 'medal',  icon: '🤝', label: 'Alianza',  color: '#4fd8c8', metaTab: 'alliances' },
  { id: 'rankings',     sprite: 'scroll', icon: '📊', label: 'Rankings', color: '#8a8378', metaTab: 'rankings' },
  { id: 'market',       sprite: 'wallet', icon: '💱', label: 'Mercado',  color: '#e8933a', metaTab: 'market' },
];

export default function SocialSidebar() {
  const addNotification = useGameStore((s) => s.addNotification);
  const setOverlay = useGameStore((s) => s.setOverlay);

  const handleClick = (item) => {
    if (item.metaTab) {
      setOverlay('meta', { tab: item.metaTab });
      EventBridge.emit('overlay:open', { type: 'meta', data: { tab: item.metaTab } });
    } else {
      addNotification(`${item.label} próximamente`, 'info');
    }
  };

  return (
    <div className="absolute right-2 bottom-24 z-20 pointer-events-none flex flex-col gap-2">
      {SOCIAL.map((s) => (
        <button
          key={s.id}
          onClick={() => handleClick(s)}
          className="pointer-events-auto relative w-11 h-11 rounded-xl flex items-center justify-center transition-transform active:scale-90 hover:scale-105"
          style={grimBtn(s.color)}
          title={s.label}
        >
          <SpriteIcon name={s.sprite} size={22} fallback={s.icon} />
          {s.badge > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                boxShadow: '0 0 6px rgba(255,68,68,0.7)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              {s.badge > 99 ? '99+' : s.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
