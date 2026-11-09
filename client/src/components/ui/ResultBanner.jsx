import React from 'react';
import Panel from './Panel';
import Button from './Button';
import { KH } from './kitPieces';

/**
 * ResultBanner — resultado de combate/guerra/ataque (pantallas_b R15, R16).
 * Panel parchment (patrón de OfflineReportModal). `outcome`: 'victory' | 'defeat'
 * (cualquier otro valor se trata como derrota). Un solo Button primary de cierre. `compact`: título y botón en una
 * fila, para no tapar la escena (combate).
 */
export default function ResultBanner({ outcome, title, children, onClose, closeLabel = 'Volver', className = '', compact = false }) {
  const victory = outcome === 'victory';
  const band = victory
    ? { borderTop: `4px solid ${KH['brass-light']}`, borderBottom: `1px solid ${KH.brass}`, paddingTop: 6, paddingBottom: 6 }
    : { backgroundColor: KH.seal, color: KH.bone, paddingTop: 6, paddingBottom: 6 };
  if (compact) {
    // Cartel compacto (combate_b T10.7, decisión del owner del 2026-11-09): título y botón en una sola fila, ≤ 70 px de alto.
    return (
      <Panel
        variant="parchment"
        role="status"
        data-outcome={victory ? 'victory' : 'defeat'}
        data-compact="true"
        className={`text-center animate-grow ${className}`.trim()}
        style={{ padding: '8px 12px' }}
      >
        <div className="flex items-center gap-3">
          <div data-banner-band className="font-display flex-1 min-w-0" style={band}>
            <span style={{ fontSize: 22, lineHeight: 1.2 }}>{title}</span>
          </div>
          {onClose && <Button variant="primary" onClick={onClose}>{closeLabel}</Button>}
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      variant="parchment"
      role="status"
      data-outcome={victory ? 'victory' : 'defeat'}
      className={`text-center animate-grow ${className}`.trim()}
    >
      <div data-banner-band className="font-display" style={band}>
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
