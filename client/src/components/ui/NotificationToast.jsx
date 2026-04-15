import React from 'react';
import useGameStore from '../../store/gameStore';

const typeStyles = {
  success: 'bg-green-800/90 border-green-500',
  error: 'bg-red-800/90 border-red-500',
  info: 'bg-blue-800/90 border-blue-500',
};

function NotificationToast() {
  const { notifications } = useGameStore();

  return (
    <div className="fixed top-16 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`animate-fade-in text-sm px-4 py-2 rounded-lg border text-white shadow-lg max-w-sm text-center ${
            typeStyles[notif.type] || typeStyles.info
          }`}
        >
          {notif.message}
        </div>
      ))}
    </div>
  );
}

export default NotificationToast;
