/**
 * SocialSidebar — Right rail lower: logros, alianza, rankings, mercado (fragmento dentro de
 * `.kh-rail--right`, ver App.jsx).
 */
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import IconButton from '../ui/IconButton';
import { KH } from '../ui/kitPieces';

const SOCIAL = [
  { id: 'achievements', sprite: 'star',   label: 'Logros',   color: KH.brass, metaTab: 'achievements' },
  { id: 'alliance',     sprite: 'medal',  label: 'Alianza',  color: KH.macula, metaTab: 'alliances' },
  { id: 'rankings',     sprite: 'scroll', label: 'Rankings', color: KH.iron, metaTab: 'rankings' },
  { id: 'market',       sprite: 'wallet', label: 'Mercado',  color: KH.ember, metaTab: 'market' },
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
    <>
      {SOCIAL.map((s) => (
        <IconButton
          key={s.id}
          icon={s.sprite}
          label={s.label}
          accent={s.color}
          title={s.label}
          onClick={() => handleClick(s)}
        >
          {s.badge > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold font-numeric"
              style={{ backgroundColor: KH.seal, color: KH.bone, border: `1px solid ${KH.ink}` }}
            >
              {s.badge > 99 ? '99+' : s.badge}
            </span>
          )}
        </IconButton>
      ))}
    </>
  );
}
