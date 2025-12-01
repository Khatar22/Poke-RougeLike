// modules/pokemon.js
export class Pokemon {
  constructor(spec, level = 5, factory = null) {
    this.factory = factory;
    this.id = spec.id;
    this.name = spec.name;
    this.type = spec.type;
    this.level = level;
    this.exp = spec.exp || 0;
    this.baseStats = Object.assign({}, spec.baseStats || { hp: 10, atk: 10, def: 10, spd: 10 });
    // moves в spec уже должны быть подготовлены фабрикой с лимитом; инициализируем currentPP
    this.moves = (spec.moves || []).map(m => ({ ...m, currentPP: (m.pp || 0) }));
    this.evolution = spec.evolution || [];
    this.currentHP = this.maxHP;
  }

  get maxHP() {
    return Math.max(1, Math.floor(this.baseStats.hp * 0.6 + this.level * 1.2));
  }
  get atk() {
    return Math.max(1, Math.floor(this.baseStats.atk * 0.5 + this.level * 0.9));
  }
  get def() {
    return Math.max(1, Math.floor(this.baseStats.def * 0.6 + this.level * 0.9));
  }
  get spd() {
    return Math.max(1, Math.floor(this.baseStats.spd * 0.5 + this.level * 0.8));
  }

  attack(moveIndex, target, typeChart) {
    const move = this.moves[moveIndex];
    if (!move || move.currentPP <= 0) return { success:false, reason:'noPP' };
    move.currentPP--;
    const base = move.power || 0;
    const stab = 1; // STAB отключён по требованиям
    const eff = (typeChart && typeChart[move.type] && typeChart[move.type][target.type]) || 1;
    const raw = (this.atk * base) / Math.max(1, target.def * 6);
    const variance = 0.85 + Math.random() * 0.3;
    const damage = Math.max(1, Math.floor(raw * stab * eff * variance));
    target.currentHP = Math.max(0, target.currentHP - damage);
    return { success:true, damage, effective: eff, moveName: move.name };
  }

  gainExp(amount) {
    this.exp = (this.exp || 0) + amount;
    const need = this.level * 10 + 20;
    while (this.exp >= need) {
      this.exp -= need;
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.currentHP = this.maxHP;
    this.tryEvolve();
  }

  tryEvolve() {
    const evo = (this.evolution || []).find(e => e.level && e.level <= this.level);
    if (!evo) return;
    if (!this.factory) {
      this.id = evo.to;
      this.name = evo.to;
      return;
    }
    const newSpec = this.factory.findSpec(evo.to);
    if (!newSpec) {
      this.id = evo.to;
      this.name = evo.to;
      return;
    }
    const hpRatio = this.maxHP > 0 ? (this.currentHP / this.maxHP) : 1;
    this.id = newSpec.id;
    this.name = newSpec.name;
    this.type = newSpec.type;
    this.baseStats = Object.assign({}, newSpec.baseStats);
    this.evolution = newSpec.evolution || [];

    const stage = this.factory.getEvolutionStage(this.id);
    const limit = this.factory.movesLimitForStage(stage);
    const rawMoves = Array.isArray(newSpec.moves) ? newSpec.moves.map(m => ({ ...m })) : [];
    const selected = rawMoves.slice(0, limit);
    this.moves = selected.map(m => ({ ...m, currentPP: m.pp || 0 }));

    const newMax = this.maxHP;
    this.currentHP = Math.max(1, Math.floor(newMax * hpRatio));
  }
}

export class PokemonFactory {
  constructor(pokemons) {
    this.pokemons = Array.isArray(pokemons) ? pokemons : [];
  }

  findSpec(id) {
    return this.pokemons.find(p => p.id === id) || null;
  }

  getEvolutionStage(pokemonId) {
    const self = this.findSpec(pokemonId);
    if (!self) return 1;
    const hasPre = this.pokemons.some(p => Array.isArray(p.evolution) && p.evolution.some(e => e.to === pokemonId));
    const hasNext = Array.isArray(self.evolution) && self.evolution.some(e => !!e.to);
    if (!hasPre && hasNext) return 1;
    if (hasPre && hasNext) return 2;
    if (hasPre && !hasNext) return 3;
    return 1;
  }

  movesLimitForStage(stage) {
    if (stage === 1) return 2;
    if (stage === 2) return 3;
    return 4;
  }

  resolveMoveSpec(moveId) {
    for (const p of this.pokemons) {
      if (!Array.isArray(p.moves)) continue;
      const m = p.moves.find(x => x.id === moveId);
      if (m) return Object.assign({}, m);
    }
    return { id: moveId, name: moveId, power: 0, type: 'Normal', pp: 10 };
  }

  create(id, level = 5) {
    const spec = this.findSpec(id);
    if (!spec) throw new Error('Unknown pokemon ' + id);
    const stage = this.getEvolutionStage(id);
    const limit = this.movesLimitForStage(stage);
    const rawMoves = Array.isArray(spec.moves) ? spec.moves.map(m => ({ ...m })) : [];
    const selected = rawMoves.slice(0, limit);
    const specCopy = { ...spec, moves: selected };
    return new Pokemon(specCopy, level, this);
  }
}
