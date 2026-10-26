export interface SpatialEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export class SpatialGrid {
  #cells = new Map<string, Set<SpatialEntity>>();
  #entityCells = new Map<string, Set<string>>();
  #cellSize: number;

  constructor(cellSize: number) {
    this.#cellSize = cellSize;
  }

  #key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  #getCellsForEntity(e: SpatialEntity): string[] {
    const minX = Math.floor((e.x - e.radius) / this.#cellSize);
    const maxX = Math.floor((e.x + e.radius) / this.#cellSize);
    const minY = Math.floor((e.y - e.radius) / this.#cellSize);
    const maxY = Math.floor((e.y + e.radius) / this.#cellSize);
    const keys: string[] = [];
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        keys.push(this.#key(cx, cy));
      }
    }
    return keys;
  }

  insert(e: SpatialEntity) {
    const cells = this.#getCellsForEntity(e);
    const cellSet = new Set<string>();
    for (const k of cells) {
      if (!this.#cells.has(k)) this.#cells.set(k, new Set());
      this.#cells.get(k)!.add(e);
      cellSet.add(k);
    }
    this.#entityCells.set(e.id, cellSet);
  }

  remove(e: SpatialEntity) {
    const cellSet = this.#entityCells.get(e.id);
    if (!cellSet) return;
    for (const k of cellSet) {
      this.#cells.get(k)?.delete(e);
    }
    this.#entityCells.delete(e.id);
  }

  update(e: SpatialEntity) {
    this.remove(e);
    this.insert(e);
  }

  queryNearby(x: number, y: number, radius: number): SpatialEntity[] {
    const minX = Math.floor((x - radius) / this.#cellSize);
    const maxX = Math.floor((x + radius) / this.#cellSize);
    const minY = Math.floor((y - radius) / this.#cellSize);
    const maxY = Math.floor((y + radius) / this.#cellSize);
    const result = new Map<string, SpatialEntity>();
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = this.#cells.get(this.#key(cx, cy));
        if (!cell) continue;
        for (const e of cell) {
          if (!result.has(e.id)) result.set(e.id, e);
        }
      }
    }
    return Array.from(result.values());
  }

  clear() {
    this.#cells.clear();
    this.#entityCells.clear();
  }
}
