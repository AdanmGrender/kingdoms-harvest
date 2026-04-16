/**
 * CaptchaPanel: In-game challenge panel for the daily CAPTCHA task.
 * Supports math, sequence, and word scramble challenges.
 * Earns 5 KH Tokens on a correct solve.
 */
import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

function formatExpiry(expiresAt) {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt) - Date.now();
  if (ms <= 0) return 'Expirado';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function CaptchaPanel() {
  const {
    captchaChallenge,
    loadCaptchaChallenge,
    solveCaptcha,
  } = useGameStore();

  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null); // { correct, message }
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!captchaChallenge) {
      loadCaptchaChallenge();
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!captchaChallenge?.expiresAt) return;
    const interval = setInterval(() => {
      const t = formatExpiry(captchaChallenge.expiresAt);
      setTimeLeft(t);
      if (t === 'Expirado') {
        clearInterval(interval);
        // Auto-reload a new challenge after expiry
        setTimeout(() => {
          setResult(null);
          setAnswer('');
          loadCaptchaChallenge();
        }, 1500);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [captchaChallenge?.expiresAt]);

  const handleSolve = async () => {
    if (!answer.trim() || isLoading) return;
    setIsLoading(true);
    const res = await solveCaptcha(answer.trim());
    setResult(res);
    setIsLoading(false);
    if (res?.correct) {
      setAnswer('');
    }
  };

  const handleNewChallenge = () => {
    setResult(null);
    setAnswer('');
    loadCaptchaChallenge();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSolve();
  };

  const typeLabel = {
    math: 'Matemáticas',
    sequence: 'Secuencia',
    word: 'Palabras',
  };

  return (
    <div className="game-card mt-2 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧩</span>
          <div>
            <p className="text-sm font-bold text-yellow-300" style={{ fontFamily: 'MedievalSharp, serif' }}>
              Desafio del Dia
            </p>
            {captchaChallenge && (
              <p className="text-[10px] text-gray-400">
                Tipo: {typeLabel[captchaChallenge.type] || captchaChallenge.type}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-purple-400 font-bold">+5 KH</p>
          {captchaChallenge && timeLeft && (
            <p className={`text-[10px] ${timeLeft === 'Expirado' ? 'text-red-400' : 'text-gray-400'}`}>
              {timeLeft === 'Expirado' ? '⏰ Expirado' : `⏱ ${timeLeft}`}
            </p>
          )}
        </div>
      </div>

      {/* Challenge question */}
      {captchaChallenge ? (
        <div className="bg-kingdom-bg rounded-lg p-3 border border-purple-800">
          <p className="text-sm text-white font-medium text-center">
            {captchaChallenge.question}
          </p>
        </div>
      ) : (
        <div className="text-center text-gray-400 text-sm py-2">Cargando desafio...</div>
      )}

      {/* Result message */}
      {result && (
        <div className={`text-center text-sm font-bold py-1 rounded ${
          result.correct ? 'text-green-400' : 'text-red-400'
        }`}>
          {result.correct ? '✅ ' : '❌ '}{result.message}
        </div>
      )}

      {/* Input + submit */}
      {captchaChallenge && !result?.correct && (
        <div className="flex gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tu respuesta..."
            maxLength={30}
            className="flex-1 bg-kingdom-bg border border-gray-600 rounded px-3 py-2 text-sm text-white
                       focus:outline-none focus:border-purple-500 placeholder-gray-500"
          />
          <button
            onClick={handleSolve}
            disabled={isLoading || !answer.trim()}
            className="btn-primary px-4 py-2 text-sm rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? '...' : 'OK'}
          </button>
        </div>
      )}

      {/* Attempts info */}
      {captchaChallenge?.attemptsRemaining != null && (
        <p className="text-[10px] text-gray-500 text-center">
          Intentos restantes hoy: {captchaChallenge.attemptsRemaining}
        </p>
      )}

      {/* Get new challenge button (after wrong answer or expiry) */}
      {(result && !result.correct) && (
        <button
          onClick={handleNewChallenge}
          className="w-full text-xs text-purple-400 hover:text-purple-300 py-1 transition-colors"
        >
          🔄 Nuevo desafio
        </button>
      )}
    </div>
  );
}
