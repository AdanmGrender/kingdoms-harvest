// Escena del hub B (design.md §6). Se completa en T11.
import Phaser from 'phaser';
import { HUB_W, HUB_H, HUB_TEXTURES, computeHubViewport } from '../hub/hubLayout';

export default class HubSceneB extends Phaser.Scene {
  constructor() {
    super({ key: 'HubSceneB' });
  }

  preload() {
    for (const { key, url } of HUB_TEXTURES) this.load.image(key, url);
  }

  create() {
    this.add.image(HUB_W / 2, HUB_H, 'hubb_base').setOrigin(0.5, 1).setDisplaySize(HUB_W, HUB_W * (1766 / 1280));
    const apply = () => {
      const v = computeHubViewport(this.scale.width, this.scale.height);
      this.cameras.main.setSize(this.scale.width, this.scale.height).setZoom(v.zoom).centerOn(HUB_W / 2, HUB_H / 2);
    };
    apply();
    this.scale.on('resize', apply);
  }
}
