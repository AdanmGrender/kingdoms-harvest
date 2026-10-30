import React from 'react';
import Panel from './Panel';
import Button from './Button';
import { KH } from './kitPieces';

/**
 * ResultBanner — resultado de combate/guerra/ataque (pantallas_b R15, R16).
 * Panel parchment (patrón de OfflineReportModal). `outcome`: 'victory' | 'defeat'
 * (cualquier otro valor se trata como derrota). Un solo Button primary de cierre.
 */
export default function ResultBanner({ outcome, title, children, onClose, closeLabel = 'Volver', className = '' }) {
  const victory = outcome === 'victory';
  return (
    <Panel
      variant="parchment"
      role="status"
      data-outcome={victory ? 'victory' : 'defeat'}
      className={`text-center animate-grow ${className}`.trim()}
    >
      <div
        data-banner-band
        className="font-display"
        style={
          victory
            ? { borderTop: `4px solid ${KH['brass-light']}`, borderBottom: `1px solid ${KH.brass}`, paddingTop: 6, paddingBottom: 6 }
            : { backgroundColor: KH.seal, color: KH.bone, paddingTop: 6, paddingBottom: 6 }
        }
      >
        <span style={{ fontSize: 22, lineHeight: 1.2 }}>{title}</span>
      </div>
      {children != null && <div className="mt-2 space-y-1">{children}</div>}
      {onClose && (
        <div className="mt-3 flex justify-center">
          <Button variant="primary" onClick={onClose}>{closeLabel}</Button>
        </div>
      )}
    </Panel>
  );
}
