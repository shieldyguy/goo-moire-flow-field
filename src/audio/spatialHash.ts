/**
 * Spatial hash for fast proximity queries between two sets of 2D points.
 *
 * Divides the plane into cells of a given size. To find which points from
 * set B are near a point in set A, we only need to check the 3x3 cell
 * neighborhood — dropping per-dot checks from thousands to ~5-20.
 */

export class SpatialHash {
  readonly cellSize: number;
  private invCellSize: number;
  // Map from cell key → list of dot indices stored in that cell
  private cells: Map<number, number[]> = new Map();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
  }

  /** Remove all entries. Reuses array allocations. */
  clear(): void {
    for (const arr of this.cells.values()) {
      arr.length = 0;
    }
  }

  /**
   * Bulk-insert all positions into the hash.
   * @param positions  Interleaved Float32Array [x0, y0, x1, y1, ...]
   * @param count      Number of dots (positions.length >= count * 2)
   */
  insertAll(positions: Float32Array, count: number): void {
    for (let i = 0; i < count; i++) {
      const x = positions[i * 2];
      const y = positions[i * 2 + 1];
      const key = this.cellKey(x, y);

      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = [];
        this.cells.set(key, bucket);
      }
      bucket.push(i);
    }
  }

  /**
   * Find all dot indices in the 3x3 neighborhood around (x, y).
   * Returns indices into the positions array that was passed to insertAll.
   */
  queryNeighbors(x: number, y: number, out: number[]): void {
    const cx = Math.floor(x * this.invCellSize);
    const cy = Math.floor(y * this.invCellSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = (cy + dy) * 73856093 + (cx + dx);
        const bucket = this.cells.get(key);
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) {
            out.push(bucket[i]);
          }
        }
      }
    }
  }

  private cellKey(x: number, y: number): number {
    const cx = Math.floor(x * this.invCellSize);
    const cy = Math.floor(y * this.invCellSize);
    return cy * 73856093 + cx;
  }
}
