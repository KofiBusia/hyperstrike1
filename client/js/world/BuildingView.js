import { buildPieceMesh } from './MapBuilder.js';

export class BuildingView {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map();
  }

  sync(pieces) {
    const ids = new Set(pieces.map((p) => p.id));
    for (const [id, mesh] of this.meshes) {
      if (!ids.has(id)) {
        this.scene.remove(mesh);
        this.meshes.delete(id);
      }
    }
    for (const piece of pieces) {
      if (!this.meshes.has(piece.id)) {
        const mesh = buildPieceMesh(piece);
        this.scene.add(mesh);
        this.meshes.set(piece.id, mesh);
      }
      const mesh = this.meshes.get(piece.id);
      const healthFrac = piece.health / piece.maxHealth;
      mesh.material.opacity = 0.55 + healthFrac * 0.4;
    }
  }
}
