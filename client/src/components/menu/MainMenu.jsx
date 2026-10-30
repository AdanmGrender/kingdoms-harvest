/**
 * MainMenu — pantalla de título grimdark (F1 idle). Se muestra una vez por
 * sesión entre LoadingScreen y el juego; un tap y adentro.
 * Kit B (R3, R22–R25): botones `Button`, tokens kh, padding `--kh-safe-*`,
 * key art opcional con caída a fondo plano `ink` si falta (R24).
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import Button from '../ui/Button';
import { KH } from '../ui/kitPieces';

export const MENU_KEY_ART = '/assets/b/menu/key_art.webp';

export default function MainMenu() {
  const enterGame = useGameStore((s) => s.enterGame);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const player = useGameStore((s) => s.player);
  // Versión visible solo con una versión real o en desarrollo (T2)
  const version = import.meta.env.VITE_APP_VERSION || (import.meta.env.DEV ? 'dev' : '');

  // Key art: solo se pinta si carga; si falta queda el fondo plano `ink` (R24).
  const [artOk, setArtOk] = useState(false);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive) setArtOk(true); };
    img.onerror = () => { if (alive) setArtOk(false); };
    img.src = MENU_KEY_ART;
    return () => { alive = false; };
  }, []);

  const openSettings = () => {
    // Entra al juego con el panel de ajustes ya abierto (el overlay vive
    // dentro del layout del juego)
    enterGame();
    setOverlay('settings', {});
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center"
      style={{
        backgroundColor: KH.ink,
        paddingTop: 'var(--kh-safe-top)',
        paddingBottom: 'var(--kh-safe-bottom)',
        ...(artOk ? {
          backgroundImage: `url(${MENU_KEY_ART})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}),
      }}
    >
      {/* Capa oscura para legibilidad del texto */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: KH.ink, opacity: artOk ? 0.7 : 0 }}
      />

      <div className="relative z-10 text-center px-6">
        <p className="text-xs tracking-[0.4em] text-kh-bone-dim uppercase mb-2">
          En la oscuridad, solo la cosecha
        </p>
        <h1 className="text-5xl text-kh-bone mb-1 font-display">
          Kingdoms Harvest
        </h1>
        <p className="text-sm text-kh-brass-light tracking-widest uppercase mb-10 font-display">
          <SpriteIcon name="skull" size={28} /> Crónicas del Bastión <SpriteIcon name="skull" size={28} />
        </p>

        <Button variant="primary" onClick={enterGame} className="block w-64 mx-auto mb-3">
          <SpriteIcon name="sword" size={28} /> Entrar al Bastión
        </Button>

        <Button variant="secondary" onClick={openSettings} className="block w-64 mx-auto">
          <SpriteIcon name="gear" size={28} /> Configuración
        </Button>

        {player?.display_name && (
          <p className="text-xs text-kh-bone-dim mt-8">
            {/* No repetir "Comandante" si el nombre ya lo trae (T1) */}
            {player.display_name.startsWith('Comandante') ? null : 'Comandante '}
            <span className="text-kh-bone">{player.display_name}</span>
            {player.level ? ` · Nv. ${player.level}` : ''}
          </p>
        )}
        {version && <p className="text-xs text-kh-bone-dim mt-1">v{version}</p>}
      </div>
    </div>
  );
}
