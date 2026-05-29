import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';

function LoadingSpinner() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div
        className="w-8 h-8 rounded-full border-2 border-yellow-900/40 border-t-yellow-400 animate-spin"
      />
      <p className="text-gray-500 text-xs">Cargando prestige...</p>
    </div>
  );
}

/**
 * Renders filled/empty dot indicators for upgrade level.
 * Shows up to 5 dots; if maxLevel > 5 falls back to text "N/maxLevel".
 */
function LevelDots({ current, max }) {
  if (max > 5) {
    return (
      <span className="text-[11px] text-gray-400 font-mono">
        {current}/{max}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="w-2.5 h-2.5 rounded-full border"
          style={{
            background: i < current ? '#ffd700' : 'transparent',
            borderColor: i < current ? '#ffd700' : 'rgba(255,215,0,0.25)',
          }}
        />
      ))}
    </div>
  );
}

function UpgradeCard({ upgrade, availablePoints, onPurchase }) {
  const [loading, setLoading] = useState(false);

  const currentLevel = upgrade.currentLevel ?? upgrade.level ?? 0;
  const maxLevel     = upgrade.maxLevel ?? upgrade.max_level ?? 5;
  const cost         = upgrade.cost ?? upgrade.costPerLevel ?? 1;
  const bonus        = upgrade.bonus ?? '';
  const atMax        = currentLevel >= maxLevel;
  const canAfford    = availablePoints >= cost;

  const handleClick = async () => {
    if (atMax || !canAfford || loading) return;
    setLoading(true);
    await onPurchase(upgrade.id);
    setLoading(false);
  };

  return (
    <div
      className="rounded-xl p-3 border transition-all"
      style={{
        background: atMax
          ? 'rgba(255,215,0,0.04)'
          : 'rgba(255,255,255,0.03)',
        border: atMax
          ? '1px solid rgba(255,215,0,0.2)'
          : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Name + level dots */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className={`text-xs font-bold ${atMax ? 'text-yellow-400' : 'text-white'}`}>
          {upgrade.name}
          {atMax && <span className="ml-1 text-yellow-600 text-[9px]">MAX</span>}
        </p>
        <LevelDots current={currentLevel} max={maxLevel} />
      </div>

      {/* Description */}
      {upgrade.desc && (
        <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">{upgrade.desc}</p>
      )}

      {/* Bonus + cost + button row */}
      <div className="flex items-center gap-2">
        {bonus && (
          <span className="text-[11px] text-green-400 font-semibold flex-1">{bonus}</span>
        )}
        {!atMax && (
          <>
            <span className="text-[10px] text-purple-300 font-semibold shrink-0">
              {cost} pts
            </span>
            <button
              onClick={handleClick}
              disabled={atMax || !canAfford || loading}
              className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 transition-opacity"
              style={{
                background: canAfford
                  ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  : 'rgba(100,80,150,0.3)',
              }}
            >
              {loading ? '...' : 'Mejorar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PrestigePanel({ onClose }) {
  const prestigeInfo           = useGameStore((s) => s.prestigeInfo);
  const loadPrestige           = useGameStore((s) => s.loadPrestige);
  const executePrestige        = useGameStore((s) => s.executePrestige);
  const purchasePrestigeUpgrade = useGameStore((s) => s.purchasePrestigeUpgrade);

  const [prestiging, setPrestiging] = useState(false);

  useEffect(() => {
    loadPrestige();
  }, []);

  const handlePrestige = async () => {
    const confirmed = window.confirm(
      '⭐ ¿Hacer Prestige?\n\nTu progreso de reino se reinicia, pero conservarás héroes, tokens y logros. ¡Esta acción no se puede deshacer!'
    );
    if (!confirmed) return;
    setPrestiging(true);
    await executePrestige();
    setPrestiging(false);
    onClose();
  };

  const handlePurchase = async (upgradeId) => {
    await purchasePrestigeUpgrade(upgradeId);
    await loadPrestige();
  };

  if (!prestigeInfo) return <LoadingSpinner />;

  const prestigeCount   = prestigeInfo.prestigeCount ?? prestigeInfo.count ?? 0;
  const availablePoints = prestigeInfo.availablePoints ?? prestigeInfo.points ?? 0;
  const canPrestige     = prestigeInfo.canPrestige ?? false;
  const currentLevel    = prestigeInfo.currentLevel ?? prestigeInfo.level ?? 1;
  const minLevel        = prestigeInfo.minLevel ?? 20;
  const upgrades        = prestigeInfo.upgrades ?? [];

  const levelPct = Math.min(100, Math.round((currentLevel / minLevel) * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(22,33,62,0.97)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-yellow-900/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">⭐</span>
          <h2
            className="text-yellow-400 font-bold text-lg"
            style={{ fontFamily: 'MedievalSharp, serif' }}
          >
            Prestige
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 text-2xl leading-none hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Prestige count + points */}
        <div
          className="rounded-xl p-4 border border-yellow-900/30 text-center"
          style={{ background: 'rgba(255,215,0,0.05)' }}
        >
          {/* Star × N */}
          <p
            className="text-3xl font-bold text-yellow-400 mb-1"
            style={{ fontFamily: 'MedievalSharp, serif', letterSpacing: '0.05em' }}
          >
            {prestigeCount > 0
              ? `${'★'.repeat(Math.min(prestigeCount, 5))} × ${prestigeCount}`
              : '☆ Sin prestige'}
          </p>

          {/* Available points */}
          <p className="text-sm text-purple-300 font-semibold mb-3">
            {availablePoints} Puntos de Prestige disponibles
          </p>

          {/* Level progress toward minLevel */}
          <div className="mb-1">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Nivel {currentLevel}</span>
              <span>Meta: Nivel {minLevel} para Prestige</span>
            </div>
            <div className="h-2 rounded-full bg-gray-700/60">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${levelPct}%`,
                  background: canPrestige
                    ? 'linear-gradient(90deg, #b45309, #ffd700)'
                    : 'linear-gradient(90deg, #7c3aed, #a855f7)',
                }}
              />
            </div>
          </div>

          {!canPrestige && (
            <p className="text-[10px] text-gray-500 mt-1">
              Nivel {currentLevel} / {minLevel} para desbloquear Prestige
            </p>
          )}
        </div>

        {/* Prestige action */}
        {canPrestige && (
          <div
            className="rounded-xl p-4 border border-yellow-600/30"
            style={{ background: 'rgba(255,215,0,0.06)' }}
          >
            <button
              onClick={handlePrestige}
              disabled={prestiging}
              className="w-full py-3 rounded-lg text-sm font-bold disabled:opacity-50 transition-opacity mb-2"
              style={{ background: 'linear-gradient(135deg, #b45309, #ffd700)', color: '#1a1a2e' }}
            >
              {prestiging ? '⏳ Procesando...' : '⭐ HACER PRESTIGE'}
            </button>
            <p className="text-[10px] text-yellow-700 text-center leading-relaxed">
              ¡Reinicia tu progreso pero conserva héroes, tokens y logros!
            </p>
          </div>
        )}

        {/* Permanent upgrades */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">
            Mejoras Permanentes
          </p>

          {upgrades.length === 0 ? (
            <p className="text-center text-gray-600 text-xs py-8">
              No hay mejoras disponibles
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {upgrades.map((upg) => (
                <UpgradeCard
                  key={upg.id}
                  upgrade={upg}
                  availablePoints={availablePoints}
                  onPurchase={handlePurchase}
                />
              ))}
            </div>
          )}
        </div>

        {/* Points explainer */}
        {upgrades.length > 0 && (
          <p className="text-center text-[10px] text-gray-600 pb-2">
            Los puntos de Prestige se obtienen al hacer Prestige. Cada Prestige otorga más puntos.
          </p>
        )}
      </div>
    </div>
  );
}
