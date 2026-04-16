import React, { useState } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import CaptchaPanel from './CaptchaPanel';

const TASK_SPRITES = {
  harvest_5: 'sunflower',
  sell_3: 'gold_pile',
  battle_win_1: 'castle_flag',
  mission_1: 'scroll',
  login: 'medal',
  captcha_daily: 'scroll',
};

function DailyTaskList({ tasks }) {
  const { claimDailyTask } = useGameStore();
  const [captchaOpen, setCaptchaOpen] = useState(false);

  if (!tasks || tasks.length === 0) {
    return (
      <div className="game-card text-center text-gray-400">
        <p>Cargando tareas diarias...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-gray-300 px-1">Tareas Diarias</h3>
      {tasks.map((task) => {
        const progress = Math.min(task.progress, task.target);
        const pct = (progress / task.target) * 100;
        const isComplete = task.completed;
        const isClaimed = task.reward_claimed;

        return (
          <div key={task.task_id} className="game-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <SpriteIcon name={TASK_SPRITES[task.task_id] || 'exclamation'} size={28} />
                <div>
                  <p className="text-sm font-bold">{task.desc}</p>
                  <p className="text-xs text-gray-400">
                    {progress}/{task.target} — <span className="text-purple-400">+{task.reward} KH</span>
                  </p>
                </div>
              </div>

              {isClaimed ? (
                <SpriteIcon name="medal" size={20} />
              ) : isComplete ? (
                <button
                  onClick={() => claimDailyTask(task.task_id)}
                  className="btn-primary text-xs px-3 py-1"
                >
                  Reclamar
                </button>
              ) : task.task_id === 'captcha_daily' ? (
                <button
                  onClick={() => setCaptchaOpen((v) => !v)}
                  className="text-xs text-purple-400 hover:text-purple-300 px-3 py-1 border border-purple-800 rounded transition-colors"
                >
                  {captchaOpen ? 'Cerrar' : 'Resolver 🧩'}
                </button>
              ) : null}
            </div>

            <div className="progress-bar">
              <div
                className={`progress-fill ${isComplete ? 'bg-green-500' : 'bg-purple-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Inline captcha panel for the captcha_daily task */}
            {task.task_id === 'captcha_daily' && captchaOpen && !isClaimed && !isComplete && (
              <CaptchaPanel />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DailyTaskList;
