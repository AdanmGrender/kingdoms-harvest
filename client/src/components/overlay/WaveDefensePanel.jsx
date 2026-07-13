/**
 * WaveDefensePanel — Marea Disforme (F3 idle): estado de la escalera,
 * botón "Desafiar la Marea" y replay animado del log de rondas.
 * El combate es 100% automático server-side; aquí solo se prepara y se mira.
 */
import { useEffect, useRef, useState } from 'react';
import useGameStore from '../../store/gameStore';

// Bestiario visible (ids = WAVE_ENEMIES de shared/gameConfig.js; el arte vive en
// /assets/game/enemies/<id>.png). Nombres cortos para que entren a 8px.
const BESTIARY = [
  { id: 'carroneros',     short: 'Carroñeros', name: 'Carroñeros del Velo' },
  { id: 'brutos',         short: 'Brutos',     name: 'Brutos Retorcidos' },
  { id: 'aullador',       short: 'Aullador',   name: 'Aullador del Vacío' },
  { id: 'coloso',         short: 'Coloso',     name: 'Coloso de Ceniza' },
  { id: 'boss_devorador', short: 'Devorador',  name: 'Devorador de Auroras', boss: true },
  { id: 'boss_heraldo',   short: 'Heraldo',    name: 'Heraldo de la Estática', boss: true },
];

const REPLAY_MS = 550; // cadencia del replay línea a línea

export default function WaveDefensePanel({ onClose }) {
  const waveStatus = useGameStore((s) => s.waveStatus);
  const loadWaveStatus = useGameStore((s) => s.loadWaveStatus);
  const startWaveRun = useGameStore((s) => s.startWaveRun);

  const [run, setRun] = useState(null);       // resultado del server
  const [shown, setShown] = useState(0);      // líneas de log reveladas
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => { loadWaveStatus(); }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [shown]);

  const challenge = async () => {
    if (running) return;
    setRunning(true);
    setRun(null);
    const result = await startWaveRun();
    setRunning(false);
    if (!result) return;
    setRun(result);
    setShown(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setShown((n) => {
        if (n >= result.log.length) { clearInterval(timerRef.current); return n; }
        return n + 1;
      });
    }, REPLAY_MS);
  };

  const skipReplay = () => {
    clearInterval(timerRef.current);
    if (run) setShown(run.log.length);
  };

  const replayDone = run && shown >= run.log.length;

  return (
    <div
      className="mx-2 mb-2 rounded-t-xl overflow-hidden flex flex-col"
      style={{
        // Telón de fondo: la muralla del bastión desde adentro con la horda
        // acercándose en la niebla. Va oscurecido para que el texto se lea.
        backgroundImage:
          'linear-gradient(rgba(23,21,26,0.92), rgba(23,21,26,0.97)), url(/assets/game/ambient/wave_bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: '1px solid rgba(179, 40, 33, 0.45)',
        maxHeight: '80vh',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-red-900/40 shrink-0 bg-black/30">
        <div>
          <h3 className="text-red-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
            🌊 Marea Disforme
          </h3>
          <p className="text-[10px] text-gray-500">Los horrores prueban tus muros — preparate y resistí</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => useGameStore.getState().setOverlay('squad', {})}
            className="text-[10px] px-2 py-1 rounded bg-black/40 border border-yellow-700/40 text-yellow-300"
          >
            🪖 Escuadra
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1">
        {/* Estado de la escalera */}
        {waveStatus && !run && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Oleada máxima" value={waveStatus.highestWave} icon="🏔️" />
            <Stat label="Próxima" value={waveStatus.nextWave} icon={waveStatus.nextIsBoss ? '💀' : '🌊'}
              highlight={waveStatus.nextIsBoss} />
            <Stat label="Desafíos" value={waveStatus.totalRuns} icon="⚔️" />
          </div>
        )}

        {/* Plantel de horrores: qué te vas a comer. Los jefes aparecen cada 5
            oleadas, así que se resaltan cuando la próxima ES boss. */}
        {waveStatus && !run && (
          <div className="rounded-lg p-2.5 bg-black/40 border border-gray-700/50">
            <p className="text-[10px] text-gray-400 font-semibold mb-2">Lo que acecha en la niebla</p>
            <div className="flex items-end justify-between gap-1">
              {BESTIARY.map((e) => (
                <div key={e.id} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div
                    className="rounded-md p-1 flex items-center justify-center"
                    style={{
                      background: e.boss ? 'rgba(179,40,33,0.18)' : 'rgba(255,255,255,0.04)',
                      border: e.boss
                        ? `1px solid rgba(179,40,33,${waveStatus.nextIsBoss ? 0.9 : 0.4})`
                        : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: e.boss && waveStatus.nextIsBoss ? '0 0 8px rgba(179,40,33,0.5)' : 'none',
                    }}
                  >
                    <img
                      src={`/assets/game/enemies/${e.id}.png`}
                      alt={e.name}
                      className="w-8 h-8 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <span className="text-[8px] text-gray-500 truncate w-full text-center leading-tight">
                    {e.short}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {waveStatus?.nextIsBoss && !run && (
          <p className="text-center text-[11px] text-red-400 animate-pulse">
            💀 La próxima oleada es un JEFE — reforzá muros y torretas
          </p>
        )}
        {waveStatus?.freeRunAvailable && !run && (
          <p className="text-center text-[11px] text-yellow-400">
            🩸 La Marea Carmesí trae un desafío bonificado
          </p>
        )}

        {/* Replay del log */}
        {run && (
          <div className="bg-black/50 border border-gray-700/50 rounded-lg p-2.5 max-h-56 overflow-y-auto font-mono">
            {run.log.slice(0, shown).map((l, i) => (
              <p key={i} className={`text-[10.5px] leading-relaxed ${
                l.type === 'defeat' ? 'text-red-400 font-bold'
                : l.type === 'wave_clear' ? 'text-green-400'
                : l.type === 'hero_skill' ? 'text-cyan-300'
                : l.type === 'wave_start' ? (l.boss ? 'text-red-300 font-bold' : 'text-purple-300')
                : l.type === 'losses' ? 'text-orange-300'
                : 'text-gray-400'
              }`}>
                {l.text}
              </p>
            ))}
            <div ref={logEndRef} />
          </div>
        )}

        {/* Resultado + recompensas */}
        {replayDone && (
          <div className={`rounded-lg p-3 text-center border animate-fade-in ${
            run.victory ? 'bg-green-900/20 border-green-600/40' : 'bg-red-900/20 border-red-600/40'
          }`}>
            <p className="font-bold text-sm mb-1" style={{ fontFamily: 'MedievalSharp, serif' }}>
              {run.victory
                ? `🏆 La Marea retrocede — oleada ${run.endWave} superada`
                : `☠️ Los muros cayeron en la oleada ${run.endWave + (run.wavesCleared > 0 ? 1 : 0)}`}
            </p>
            <div className="flex justify-center gap-3 text-[11px] mt-1">
              {run.rewards.gold > 0 && <span className="text-yellow-300">🪙 +{run.rewards.gold}</span>}
              {run.rewards.kh > 0 && <span className="text-kingdom-gold">💎 +{run.rewards.kh} KH</span>}
              {run.rewards.heroXp > 0 && <span className="text-cyan-300">🦸 +{run.rewards.heroXp} XP</span>}
              {run.rewards.item && <span className="text-purple-300">🎁 ¡Reliquia del jefe!</span>}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-3 pt-1 shrink-0 flex gap-2">
        {run && !replayDone && (
          <button onClick={skipReplay}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-300 bg-black/40 border border-gray-600/40">
            ⏩ Saltar
          </button>
        )}
        <button
          onClick={run && replayDone ? () => { setRun(null); loadWaveStatus(); } : challenge}
          disabled={running || (run && !replayDone)}
          className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white
                     bg-gradient-to-b from-red-700 to-red-900 border border-red-500/40
                     hover:from-red-600 hover:to-red-800 active:scale-95 transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? '⚔️ La Marea golpea…'
            : run && replayDone ? '↩️ Continuar'
            : run ? '👁️ Observando…'
            : '⚔️ Desafiar la Marea'}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, highlight }) {
  return (
    <div className={`rounded-lg py-2 border ${
      highlight ? 'bg-red-900/30 border-red-600/50' : 'bg-black/40 border-gray-700/40'
    }`}>
      <p className="text-lg leading-none mb-0.5">{icon}</p>
      <p className="text-base font-bold text-white leading-none">{value}</p>
      <p className="text-[9px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
