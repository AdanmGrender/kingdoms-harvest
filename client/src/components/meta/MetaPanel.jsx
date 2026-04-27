import React, { useState } from 'react';
import AchievementsPanel from './AchievementsPanel';
import RankingsPanel from './RankingsPanel';
import TechTreePanel from '../castle/TechTreePanel';
import FactionPanel from '../world/FactionPanel';
import TerritoryMapPanel from '../world/TerritoryMapPanel';

/**
 * MetaPanel — full-screen-ish overlay surfacing every "meta" progression
 * surface (achievements, rankings, tech tree, factions, world map). Mounted
 * by OverlayManager when overlayState.type === 'meta'. The optional
 * data.tab field lets sidebar buttons deep-link into a specific section.
 */
const TABS = [
  { id: 'achievements', label: '🏆 Logros' },
  { id: 'rankings',     label: '📊 Rankings' },
  { id: 'tech',         label: '🔬 Tech' },
  { id: 'factions',     label: '🛡️ Facción' },
  { id: 'world',        label: '🗺️ Mundo' },
];

export default function MetaPanel({ data, onClose }) {
  const initial = TABS.find((t) => t.id === data?.tab)?.id || 'achievements';
  const [tab, setTab] = useState(initial);

  return (
    <div
      className="mx-2 mb-2 rounded-t-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(22, 33, 62, 0.97)',
        border: '1px solid rgba(255, 215, 0, 0.3)',
        maxHeight: '80vh',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30 shrink-0">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          🏰 Reino
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg px-2"
        >✕</button>
      </div>

      <div className="px-3 pt-3 pb-2 overflow-x-auto shrink-0">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-1.5 px-3 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                tab === t.id ? 'bg-kingdom-accent text-white' : 'bg-kingdom-blue/50 text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pb-3 overflow-y-auto flex-1">
        {tab === 'achievements' && <AchievementsPanel />}
        {tab === 'rankings'     && <RankingsPanel />}
        {tab === 'tech'         && <TechTreePanel />}
        {tab === 'factions'     && <FactionPanel />}
        {tab === 'world'        && <TerritoryMapPanel />}
      </div>
    </div>
  );
}
