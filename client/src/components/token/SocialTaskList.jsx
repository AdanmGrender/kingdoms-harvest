import React from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

const SOCIAL_SPRITES = {
  join_channel: 'castle_flag',
  invite_1: 'farmer',
  invite_5: 'farmer',
  invite_10: 'farmer',
};

function SocialTaskList({ tasks }) {
  const { verifySocialTask } = useGameStore();

  if (!tasks || tasks.length === 0) {
    return (
      <div className="game-card text-center text-gray-400">
        <p>Cargando tareas sociales...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-gray-300 px-1">Tareas Sociales (una vez)</h3>
      {tasks.map((task) => (
        <div key={task.id} className="game-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SpriteIcon name={SOCIAL_SPRITES[task.id] || 'castle_flag'} size={28} />
              <div>
                <p className="text-sm font-bold">{task.desc}</p>
                <p className="text-xs text-purple-400">+{task.reward} KH Tokens</p>
              </div>
            </div>

            {task.completed ? (
              <span className="text-green-400 text-xs font-bold flex items-center gap-1">
                <SpriteIcon name="medal" size={16} /> Completada
              </span>
            ) : (
              <button
                onClick={() => verifySocialTask(task.id)}
                className="btn-primary text-xs px-3 py-1"
              >
                Verificar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default SocialTaskList;
