import { useState, useEffect } from 'react';

/**
 * Hook que muestra una cuenta regresiva hasta una fecha dada
 * @param {string} targetDate - ISO date string
 * @returns {string} Texto formateado del tiempo restante
 */
function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft('');
      return;
    }

    const update = () => {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('Listo!');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export default useCountdown;
