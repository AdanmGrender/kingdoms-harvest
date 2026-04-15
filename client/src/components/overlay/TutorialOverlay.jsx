/**
 * TutorialOverlay: First-time onboarding guide with step-by-step tips.
 */
import { useState, useEffect } from 'react';

const TUTORIAL_KEY = 'kh_tutorial_done';

const STEPS = [
  {
    title: 'Bienvenido a Kingdoms Harvest',
    text: 'Construye tu reino, gestiona aldeanos y conquista territorios enemigos.',
    icon: '🏰',
  },
  {
    title: 'Camara',
    text: 'Arrastra para mover la camara. Usa la rueda del raton o pinza para hacer zoom.',
    icon: '🖱️',
  },
  {
    title: 'Construir',
    text: 'Toca el boton "Construir" abajo para colocar edificios. Cada edificio produce recursos.',
    icon: '🔨',
  },
  {
    title: 'Aldeanos',
    text: 'Tus aldeanos trabajan automaticamente. Toca uno para asignarlo a un edificio.',
    icon: '👤',
  },
  {
    title: 'Recursos',
    text: 'Los edificios producen recursos con el tiempo: trigo, madera, piedra, hierro y oro.',
    icon: '🪙',
  },
  {
    title: 'Guerra',
    text: 'Entrena tropas en el cuartel y declara guerra a otros reinos desde la Zona de Guerra.',
    icon: '⚔️',
  },
];

export default function TutorialOverlay() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TUTORIAL_KEY);
    if (!done) setVisible(true);
  }, []);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(TUTORIAL_KEY, '1');
      setVisible(false);
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/60" onClick={handleSkip} />
      <div
        className="relative z-10 mx-4 p-5 rounded-xl max-w-sm w-full"
        style={{ background: 'rgba(22, 33, 62, 0.97)', border: '2px solid rgba(255, 215, 0, 0.5)' }}
      >
        {/* Step indicator */}
        <div className="flex justify-center gap-1 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i === step ? 'bg-yellow-400' : 'bg-gray-600'}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">{current.icon}</div>
          <h3
            className="text-yellow-400 text-base font-bold mb-2"
            style={{ fontFamily: 'MedievalSharp, serif' }}
          >
            {current.title}
          </h3>
          <p className="text-gray-300 text-sm">{current.text}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            className="flex-1 text-gray-400 hover:text-white text-xs py-2"
            onClick={handleSkip}
          >
            Saltar
          </button>
          <button
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white text-sm py-2 rounded font-bold"
            onClick={handleNext}
          >
            {isLast ? 'Comenzar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
