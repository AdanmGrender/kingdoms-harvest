/**
 * MainMenu — pantalla de título grimdark (F1 idle). Se muestra una vez por
 * sesión entre LoadingScreen y el juego; un tap y adentro.
 */
import useGameStore from '../../store/gameStore';

export default function MainMenu() {
  const enterGame = useGameStore((s) => s.enterGame);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const player = useGameStore((s) => s.player);
  const version = import.meta.env.VITE_APP_VERSION || 'dev';

  const openSettings = () => {
    // Entra al juego con el panel de ajustes ya abierto (el overlay vive
    // dentro del layout del juego)
    enterGame();
    setOverlay('settings', {});
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{
        backgroundColor: '#17151a',
        backgroundImage: 'url(/assets/game/ambient/menu_bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Capa oscura para legibilidad del texto sobre la fortaleza */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 42%, rgba(23,21,26,0.35) 0%, rgba(23,21,26,0.72) 60%, rgba(10,8,12,0.92) 100%)',
        }}
      />
      {/* Viñeta */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 200px 70px rgba(5,4,8,0.95)' }}
      />

      <div className="relative z-10 text-center px-6">
        <p className="text-[11px] tracking-[0.4em] text-gray-500 uppercase mb-2">
          En la oscuridad, solo la cosecha
        </p>
        <h1
          className="text-5xl text-kingdom-gold mb-1"
          style={{ fontFamily: 'MedievalSharp, serif', textShadow: '0 0 24px rgba(217,164,65,0.35), 0 4px 0 #17151a' }}
        >
          Kingdoms Harvest
        </h1>
        <p className="text-sm text-red-400/90 tracking-widest uppercase mb-10"
          style={{ fontFamily: 'MedievalSharp, serif' }}>
          💀 Crónicas del Bastión 💀
        </p>

        <button
          onClick={enterGame}
          className="block w-64 mx-auto py-3 mb-3 rounded-lg text-sm font-bold text-white
                     bg-gradient-to-b from-red-700 to-red-900 border border-red-500/40
                     hover:from-red-600 hover:to-red-800 active:scale-95 transition-all"
          style={{ boxShadow: '0 0 24px rgba(179,40,33,0.35)' }}
        >
          ⚔️ Entrar al Bastión
        </button>

        <button
          onClick={openSettings}
          className="block w-64 mx-auto py-2.5 rounded-lg text-xs font-bold text-gray-300
                     bg-black/40 border border-gray-600/40 hover:bg-black/60 transition-all"
        >
          ⚙️ Configuración
        </button>

        {player?.display_name && (
          <p className="text-[11px] text-gray-500 mt-8">
            Comandante <span className="text-gray-300">{player.display_name}</span>
            {player.level ? ` · Nv. ${player.level}` : ''}
          </p>
        )}
        <p className="text-[10px] text-gray-600 mt-1">v{version}</p>
      </div>
    </div>
  );
}
