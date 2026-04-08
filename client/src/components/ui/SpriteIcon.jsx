import React from 'react';
import { getSprite } from '../../utils/spriteMap';

/**
 * SpriteIcon - Renders a sprite from a sprite sheet using CSS background-position.
 *
 * @param {string} name - Sprite ID or game alias (e.g. 'gold', 'wheat', 'knight')
 * @param {number} size - Display size in pixels (default 32). Used as both width & height for square sprites.
 * @param {number} [width] - Explicit width override (for non-square sprites)
 * @param {number} [height] - Explicit height override (for non-square sprites)
 * @param {string} className - Additional CSS classes
 * @param {string} fallback - Emoji fallback if sprite not found
 * @param {object} style - Additional inline styles
 */
function SpriteIcon({ name, size = 32, width, height, className = '', fallback = '', style = {} }) {
  const sprite = getSprite(name);

  if (!sprite) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={{ width: width || size, height: height || size, fontSize: (height || size) * 0.7, lineHeight: 1, ...style }}
      >
        {fallback || '?'}
      </span>
    );
  }

  // Actual display dimensions
  const displayW = width || size;
  const displayH = height || size;

  // Scale the sheet so this sprite's cell maps exactly to the display dimensions
  const scaleX = displayW / sprite.w;
  const scaleY = displayH / sprite.h;
  const bgWidth = sprite.sheetW * scaleX;
  const bgHeight = sprite.sheetH * scaleY;
  const bgPosX = -(sprite.x * scaleX);
  const bgPosY = -(sprite.y * scaleY);

  return (
    <span
      className={`inline-block sprite-icon ${className}`}
      role="img"
      aria-label={name}
      style={{
        width: displayW,
        height: displayH,
        backgroundImage: `url(${sprite.sheet})`,
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/**
 * CharacterSprite - For character sprites (taller aspect ratio 205:341).
 * Computes correct width from height to maintain aspect ratio.
 */
function CharacterSprite({ name, height = 48, className = '', style = {} }) {
  const sprite = getSprite(name);

  if (!sprite) {
    return <SpriteIcon name={name} size={height} className={className} style={style} fallback="?" />;
  }

  // Maintain aspect ratio: width = height * (cellW / cellH)
  const aspectWidth = Math.round(height * (sprite.w / sprite.h));

  return (
    <SpriteIcon
      name={name}
      width={aspectWidth}
      height={height}
      className={className}
      style={style}
    />
  );
}

export { CharacterSprite };
export default SpriteIcon;
