// modules/world.js
export class World {
  constructor(width = 20, height = 12) {
    this.width = width; this.height = height;
    this.grid = []; this.playerPos = { x: Math.floor(width/2), y: Math.floor(height/2) };
    this.wildPool = [];
    this.player = null; // будет установлен из main
  }

  init() {
    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        const r = Math.random();
        this.grid[y][x] = r < 0.12 ? 'water' : (r < 0.45 ? 'grass' : 'ground');
      }
    }
    this.grid[this.playerPos.y][this.playerPos.x] = 'ground';
  }

  tileAt(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 'water';
    return this.grid[y][x];
  }

  move(dx, dy) {
    const nx = this.playerPos.x + dx;
    const ny = this.playerPos.y + dy;
    const tile = this.tileAt(nx, ny);
    if (tile === 'water') return { moved: false };
    this.playerPos = { x: nx, y: ny };
    return { moved: true, tile };
  }

  tryEncounter(tile, chance = 0.2) {
    // если игрок не передан или у него нет активного покемона — не генерируем энкаунтер
    if (!this.player || !Array.isArray(this.player.party) || this.player.party.length === 0) return null;
    if (!this.player.active) return null;

    // если флаг пропуска энкаунтера установлен — пропускаем один энкаунтер
    if (this.skipNextEncounter) {
      this.skipNextEncounter = false;
      return null;
    }

    if (tile !== 'grass') return null;
    if (Math.random() >= chance) return null;

    const pool = Array.isArray(this.wildPool) ? this.wildPool : [];
    if (pool.length === 0) return null;

    const valid = pool.filter(p => p && typeof p.id === 'string' && typeof p.chance === 'number' && p.chance > 0);
    if (valid.length === 0) return null;

    const total = valid.reduce((s, p) => s + p.chance, 0);
    if (!isFinite(total) || total <= 0) return null;

    const roll = Math.random() * total;
    let sum = 0;
    let chosen = valid[valid.length - 1];
    for (const p of valid) {
      sum += p.chance;
      if (roll <= sum) { chosen = p; break; }
    }

    const base = (this.player && this.player.active && typeof this.player.active.level === 'number') ? this.player.active.level : 5;
    const level = Math.max(2, base + Math.floor(Math.random() * 5) - 2);
    return { id: chosen.id, level };
  }
}
