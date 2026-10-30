import { useEffect, useState } from 'react';
import { KH } from '../ui/kitPieces';

/**
 * Fondo de mapa del kit B (R33, R34): fondo plano `oak` con capa oscura encima.
 * La imagen (webp de la etapa E) solo se pinta si carga; si falta o falla,
 * el mapa queda en `oak` plano y nada se rompe.
 */
export const MARCA_BG = '/assets/b/map/marca.webp';
export const REINOS_BG = '/assets/b/map/reinos.webp';
const DARK_LAYER = 'linear-gradient(rgba(20,17,13,0.78), rgba(20,17,13,0.78))';

export default function useMapBackground(src) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive) setOk(true); };
    img.onerror = () => { if (alive) setOk(false); };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return {
    backgroundColor: KH.oak,
    ...(ok ? {
      backgroundImage: `${DARK_LAYER}, url(${src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    } : {}),
  };
}
