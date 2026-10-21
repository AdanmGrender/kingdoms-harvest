import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { createRequire } from 'node:module';
import React from 'react';

import EventBridge from '../game/EventBridge';
import BuildingInfoPopup from '../components/hud/BuildingInfoPopup';
import { buildSelectionPayload } from '../game/hub/hubLayout';

// shared/ es CommonJS fuera de la raíz de Vite: se lee solo en el test (nombres lore v2).
const require = createRequire(import.meta.url);
const { BUILDINGS } = require('../../../shared/gameConfig.js');

function select(payload) {
  act(() => {
    EventBridge.emit('entity:selected', payload);
  });
}

afterEach(() => {
  cleanup();
});

describe('BuildingInfoPopup — payload de entity:selected', () => {
  it('payload del hub (buildingId, buildSelectionPayload) muestra el nombre real', () => {
    render(<BuildingInfoPopup />);
    select(buildSelectionPayload({
      id: 2, building_id: 'farm_plot', level: 2, is_building: 0, position_x: 74, position_y: 64,
    }));

    expect(screen.getByText('Huerto Votivo')).toBeInTheDocument();
    expect(screen.getByText(`Nv. 2 / ${BUILDINGS.farm_plot.maxLevel}`)).toBeInTheDocument();
    expect(screen.queryByText('Edificio')).toBeNull();
    expect(screen.queryByText('🏠')).toBeNull();
  });

  it('payload legado en snake_case (building_id) sigue funcionando', () => {
    render(<BuildingInfoPopup />);
    select({ type: 'building', data: { id: 'barn', building_id: 'barn', level: 3 } });

    expect(screen.getByText('Granero')).toBeInTheDocument();
    expect(screen.getByText(`Nv. 3 / ${BUILDINGS.barn.maxLevel}`)).toBeInTheDocument();
    expect(screen.queryByText('Edificio')).toBeNull();
  });

  it('cada edificio de shared/gameConfig.js muestra su nombre lore v2', () => {
    render(<BuildingInfoPopup />);
    for (const [id, def] of Object.entries(BUILDINGS)) {
      select(buildSelectionPayload({ building_id: id, level: 1, is_building: 0, position_x: 0 }));
      expect(screen.getByText(def.name)).toBeInTheDocument();
      expect(screen.getByText(`Nv. 1 / ${def.maxLevel}`)).toBeInTheDocument();
    }
  });
});
