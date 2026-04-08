/**
 * OverlayManager: Renders the correct overlay panel based on gameStore.overlayState.
 */
import { useCallback, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import DialogPanel from './DialogPanel';
import CropSelectMenu from './CropSelectMenu';

export default function OverlayManager() {
  const overlayState = useGameStore((s) => s.overlayState);
  const clearOverlay = useGameStore((s) => s.clearOverlay);

  // Listen for EventBridge overlay events
  useEffect(() => {
    const handleOpen = ({ type, data }) => {
      useGameStore.getState().setOverlay(type, data);
    };
    const handleClose = () => {
      useGameStore.getState().clearOverlay();
    };

    EventBridge.on('overlay:open', handleOpen);
    EventBridge.on('overlay:close', handleClose);

    return () => {
      EventBridge.off('overlay:open', handleOpen);
      EventBridge.off('overlay:close', handleClose);
    };
  }, []);

  // Listen for player interactions
  useEffect(() => {
    const handleInteraction = ({ type, data }) => {
      switch (type) {
        case 'npc':
          useGameStore.getState().setOverlay('dialog', data);
          break;
        case 'farm_plot':
          if (data.state === 'ready') {
            // Harvest directly (could also show confirm overlay)
            useGameStore.getState().setOverlay('harvest', data);
          } else {
            useGameStore.getState().setOverlay('cropSelect', data);
          }
          break;
        case 'building':
          useGameStore.getState().setOverlay('building', data);
          break;
        case 'animal':
          useGameStore.getState().setOverlay('animal', data);
          break;
        case 'war_gate':
          useGameStore.getState().setOverlay('combat', data);
          break;
        default:
          break;
      }
    };

    EventBridge.on('player:interact', handleInteraction);
    return () => EventBridge.off('player:interact', handleInteraction);
  }, []);

  const handleClose = useCallback(() => {
    clearOverlay();
    EventBridge.emit('overlay:close');
  }, [clearOverlay]);

  if (!overlayState?.type) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
        {renderPanel(overlayState, handleClose)}
      </div>
    </div>
  );
}

function renderPanel(overlayState, onClose) {
  switch (overlayState.type) {
    case 'dialog':
      return <DialogPanel data={overlayState.data} onClose={onClose} />;
    case 'cropSelect':
      return <CropSelectMenu data={overlayState.data} onClose={onClose} />;
    case 'building':
      return <BuildingInfoPanel data={overlayState.data} onClose={onClose} />;
    case 'animal':
      return <AnimalPanel data={overlayState.data} onClose={onClose} />;
    case 'combat':
      return <CombatQuickPanel data={overlayState.data} onClose={onClose} />;
    case 'harvest':
      return <HarvestPanel data={overlayState.data} onClose={onClose} />;
    default:
      return (
        <GenericPanel title={overlayState.type} onClose={onClose}>
          <p className="text-gray-300 text-sm">Panel: {overlayState.type}</p>
        </GenericPanel>
      );
  }
}

// ─── Simple inline panels (will be expanded later) ───

function GenericPanel({ title, onClose, children }) {
  return (
    <div className="mx-2 mb-2 p-4 rounded-t-xl"
      style={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          {title}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>
      {children}
    </div>
  );
}

function BuildingInfoPanel({ data, onClose }) {
  return (
    <GenericPanel title={`🏠 ${data.buildingId}`} onClose={onClose}>
      <p className="text-gray-300 text-sm">Edificio: {data.buildingId}</p>
      <p className="text-gray-400 text-xs mt-1">Funcionalidad completa disponible en Modo Clásico</p>
    </GenericPanel>
  );
}

function AnimalPanel({ data, onClose }) {
  return (
    <GenericPanel title={`🐾 ${data.animalType}`} onClose={onClose}>
      <p className="text-gray-300 text-sm">Animal: {data.animalType}</p>
      <div className="flex gap-2 mt-3">
        <button className="btn-gold text-xs px-3 py-1 rounded">Alimentar</button>
        <button className="btn-primary text-xs px-3 py-1 rounded">Recolectar</button>
      </div>
    </GenericPanel>
  );
}

function CombatQuickPanel({ data, onClose }) {
  return (
    <GenericPanel title="⚔️ Zona de Combate" onClose={onClose}>
      <p className="text-gray-300 text-sm">Accede al combate completo en Modo Clásico</p>
      <p className="text-gray-400 text-xs mt-1">Combate visual llegará pronto</p>
    </GenericPanel>
  );
}

function HarvestPanel({ data, onClose }) {
  return (
    <GenericPanel title="🌾 Cosecha lista!" onClose={onClose}>
      <p className="text-gray-300 text-sm">Parcela #{data.plotIndex + 1}</p>
      <button
        className="mt-2 bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded w-full"
        onClick={onClose}
      >
        Cosechar
      </button>
    </GenericPanel>
  );
}
