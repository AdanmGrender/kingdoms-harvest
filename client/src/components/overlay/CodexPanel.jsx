import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

// F6 Códice de colección: héroes únicos poseídos → bono pasivo de ATK de escuadra.
export default function CodexPanel({ onClose }) {
  const codex = useGameStore((s) => s.codexState);
  const loadCodex = useGameStore((s) => s.loadCodex);

  useEffect(() => { loadCodex(); }, [loadCodex]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col p-4 pb-28" style={{ background: 'rgba(10,10,20,0.96)' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-yellow-400 text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'MedievalSharp, serif' }}>
          <SpriteIcon name="scroll" size={26} fallback="📖" /> Códice de Colección
        </h2>
        <button onClick={onClose} className="text-gray-400 text-2xl px-2">✕</button>
      </div>

      {!codex ? (
        <p className="text-gray-400 text-sm text-center mt-8">Cargando…</p>
      ) : (
        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="text-center">
            <p className="text-5xl font-bold text-yellow-300">{codex.unique}</p>
            <p className="text-gray-400 text-xs uppercase tracking-wide">héroes únicos</p>
          </div>

          <div className="w-full max-w-xs p-4 rounded-lg text-center"
            style={{ background: 'rgba(74,222,128,0.10)', border: '1px solid #4ade80' }}>
            <p className="text-green-400 text-2xl font-bold">+{codex.bonusPct}% ATK</p>
            <p className="text-gray-400 text-[11px] mt-1">bono pasivo de escuadra (máx +{codex.maxPct}%)</p>
          </div>

          {codex.nextAt != null && (
            <p className="text-gray-300 text-xs text-center">
              Próximo escalón a los <span className="text-yellow-300 font-semibold">{codex.nextAt}</span> únicos
              (cada {codex.heroesPerStep} héroes = +1% ATK)
            </p>
          )}
          {codex.nextAt == null && (
            <p className="text-yellow-300 text-xs font-semibold">¡Bono máximo alcanzado!</p>
          )}
        </div>
      )}
    </div>
  );
}
