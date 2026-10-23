# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Una entrada por feature, añadida por el `implementer` al cerrar (`status: done`).
La historia anterior al harness (2026-10-20) está en `git log` y en
`docs/project-spec.md` §14.

## [Unreleased]

### Added
- Spike de dirección de arte B: combate ilustrado grimdark renacentista en Phaser 3 + pipeline de arte IA (`spike_combate_b`)
- Harness SDD (leader / spec_author / implementer / reviewer, `feature_list.json`, `specs/`) adaptado de SSD-HARNESS-TEMPLATE
- Hub idle vivo — escena base ilustrada (`hub_b_escena`): HubSceneB grimdark renacentista por capas, 17 ranuras de edificios, trabajadores y humo animados, ambiente por tormenta, render a resolución de dispositivo; se retira el hub viejo de WorldScene
- Hub idle — recolección como objetos en la escena (B1.2) (`hub_b_recoleccion`)
- Kit de UI e íconos B en todo el chrome React (B3): IM Fell English, tokens `kh-*`, Panel/Button/IconButton/Bar/PortraitRing y hoja de íconos B reemplazando emojis y `grim_icons` (`ui_kit_b`)

### Changed
- Lore v2 grimdark renacentista en todos los textos visibles; glosario v1→v2 (`lore_v2`)

### Fixed
- El popup de edificio muestra el nombre real (lore v2) y su nivel máximo (`fix_building_popup_id`)
- Arreglar test preexistente GameHUD Lv5 (`fix_test_gamehud_lv5`)
- Encuadre y alineación de los botones del hub (`fix_botones_hub`)
