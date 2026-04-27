/**
 * SocialSidebar — Right rail lower: alliance, mail, achievements, inventory.
 */
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

const SOCIAL = [
  { id: 'achievements', icon: '⭐', label: 'Logros',  color: '#ffd750', metaTab: 'achievements' },
  { id: 'alliance',     icon: '🤝', label: 'Facción', color: '#8fd4ff', metaTab: 'factions' },
  { id: 'mail',         icon: '📊', label: 'Rankings', color: '#b8ffb8', metaTab: 'rankings' },
  { id: 'bag',          icon: '🎒', label: 'Bolsa',   color: '#ffcc88' },
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
          style={{
            background: 'linear-gradient(180deg, rgba(25,28,50,0.95) 0%, rgba(12,14,28,0.92) 100%)',
            border: `1.5px solid ${s.color}55`,
            boxShadow: `0 2px 8px rgba(0,0,0,0.5), 0 0 10px ${s.color}22, inset 0 1px 0 rgba(255,255,255,0.08)`,
          }}
          title={s.label}
        >
          <span className="text-xl drop-shadow">{s.icon}</span>
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
