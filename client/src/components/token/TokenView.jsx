import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import DailyTaskList from './DailyTaskList';
import SocialTaskList from './SocialTaskList';
import BurnPanel from './BurnPanel';
import WalletPanel from './WalletPanel';
import ReferralPanel from './ReferralPanel';
import LeaderboardPanel from './LeaderboardPanel';

function TokenView() {
  const {
    tokenInfo, dailyTasks, socialTasks, streakInfo, referralStats, referralLink,
    loadTokenInfo, loadDailyTasks, loadSocialTasks, loadStreakInfo,
    loadReferralStats, loadReferralLink,
  } = useGameStore();

  const [activeSection, setActiveSection] = useState('tasks');

  useEffect(() => {
    loadTokenInfo();
    loadDailyTasks();
    loadSocialTasks();
    loadStreakInfo();
    loadReferralStats();
    loadReferralLink();
  }, []);

  const sections = [
    { id: 'tasks',       label: 'Tareas',    sprite: 'scroll' },
    { id: 'social',      label: 'Social',    sprite: 'castle_flag' },
    { id: 'leaderboard', label: 'Ranking',   sprite: 'medal' },
    { id: 'burn',        label: 'Quemar',    sprite: 'reward_bag' },
    { id: 'wallet',      label: 'Wallet',    sprite: 'backpack' },
    { id: 'referral',    label: 'Referidos', sprite: 'farmer' },
  ];

  return (
    <div className="space-y-3 pb-4">
      {/* Header: Balance + Streak */}
      <div className="game-card text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wider">KH Tokens</p>
        <div className="flex items-center justify-center gap-2 my-1">
          <SpriteIcon name="medal" size={36} />
          <p className="text-4xl font-bold text-purple-400">
            {tokenInfo?.balance || 0}
          </p>
        </div>
        <div className="flex justify-center gap-4 text-xs text-gray-400 mt-2">
          <span>Hoy: {tokenInfo?.dailyEarnedToday || 0}/{tokenInfo?.dailyCap || 0}</span>
          <span>|</span>
          <span>Racha: {tokenInfo?.currentStreak || 0} dias</span>
          {tokenInfo?.streakMultiplier > 1 && (
            <>
              <span>|</span>
              <span className="text-yellow-400">{tokenInfo.streakMultiplier}x bonus</span>
            </>
          )}
        </div>
        {/* Daily progress bar */}
        <div className="progress-bar mt-3">
          <div
            className="progress-fill bg-purple-500"
            style={{
              width: `${tokenInfo?.dailyCap ? (tokenInfo.dailyEarnedToday / tokenInfo.dailyCap) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Streak milestones */}
      {streakInfo && streakInfo.currentStreak > 0 && (
        <div className="game-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SpriteIcon name="medal" size={28} />
              <div>
                <p className="text-sm font-bold">Racha de {streakInfo.currentStreak} dias</p>
                <p className="text-xs text-gray-400">
                  Multiplicador: <span className="text-yellow-400">{streakInfo.multiplier}x</span>
                </p>
              </div>
            </div>
            {streakInfo.nextMilestone && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Proximo bonus</p>
                <p className="text-sm font-bold text-purple-400">Dia {streakInfo.nextMilestone}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-all flex items-center gap-1 ${
              activeSection === s.id
                ? 'bg-purple-600 text-white'
                : 'bg-kingdom-card text-gray-400 hover:text-white'
            }`}
          >
            <SpriteIcon name={s.sprite} size={16} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Active section */}
      {activeSection === 'tasks'       && <DailyTaskList tasks={dailyTasks} />}
      {activeSection === 'social'      && <SocialTaskList tasks={socialTasks} />}
      {activeSection === 'leaderboard' && <LeaderboardPanel />}
      {activeSection === 'burn'        && <BurnPanel tokenInfo={tokenInfo} />}
      {activeSection === 'wallet'      && <WalletPanel tokenInfo={tokenInfo} />}
      {activeSection === 'referral'    && <ReferralPanel stats={referralStats} link={referralLink} />}
    </div>
  );
}

export default TokenView;
