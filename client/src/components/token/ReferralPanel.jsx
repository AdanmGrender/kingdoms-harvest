import React, { useState } from 'react';
import SpriteIcon from '../ui/SpriteIcon';

function ReferralPanel({ stats, link }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!link) return;
    const text = `Juga Kingdoms Harvest conmigo y gana KH Tokens!\n${link}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Juga Kingdoms Harvest conmigo y gana KH Tokens!')}`;
    window.open(shareUrl, '_blank');
  };

  return (
    <div className="space-y-3">
      {/* Referral Link */}
      <div className="game-card">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
          <SpriteIcon name="farmer" size={20} /> Tu Link de Referido
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          Invita amigos y gana 25 KH por cada uno + 5% de sus ganancias.
        </p>

        {link && (
          <div className="bg-kingdom-blue rounded-lg p-2 mb-3">
            <p className="text-xs text-gray-300 font-mono break-all">{link}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleCopy} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1">
            <SpriteIcon name="scroll" size={14} />
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button onClick={handleShare} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1">
            <SpriteIcon name="back" size={14} />
            Compartir
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="game-card">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-1">
          <SpriteIcon name="medal" size={20} /> Estadisticas
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">{stats?.totalReferrals || 0}</p>
            <p className="text-xs text-gray-400">Amigos invitados</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats?.totalCommission || 0}</p>
            <p className="text-xs text-gray-400">KH ganados</p>
          </div>
        </div>
      </div>

      {/* Referee list */}
      {stats?.referees && stats.referees.length > 0 && (
        <div className="game-card">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
            <SpriteIcon name="reward_bag" size={20} /> Tus Referidos
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {stats.referees.map((ref, i) => (
              <div key={i} className="flex justify-between items-center text-xs border-b border-gray-700 pb-2">
                <div>
                  <p className="font-bold">{ref.name}</p>
                  <p className="text-gray-500">Nv. {ref.level}</p>
                </div>
                <span className="text-purple-400 font-bold">+{ref.commission} KH</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReferralPanel;
