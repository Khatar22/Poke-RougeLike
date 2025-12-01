// modules/player.js
export class Player {
  constructor() {
    this.party = [];
    this.inventory = { pokeball: 5, greatball: 2, potion: 3, pp_restore: 1 };
    this.activeIndex = -1;
    this.gameOver = false;
  }

  reset() {
    this.party = [];
    this.inventory = { pokeball: 5, greatball: 2, potion: 3, pp_restore: 1 };
    this.activeIndex = -1;
    this.gameOver = false;
  }

  chooseStarter(pokemon) {
    this.party = [pokemon];
    this.activeIndex = 0;
  }

  addToParty(pokemon) {
    if (this.party.length >= 3) return false;
    this.party.push(pokemon);
    if (this.activeIndex === -1) this.activeIndex = 0;
    return true;
  }

  canCatch() {
    return this.party.length < 3;
  }

  switchTo(index) {
    if (index < 0 || index >= this.party.length) return false;
    if (index === this.activeIndex) return false;
    if (this.party[index].currentHP <= 0) return false;
    this.activeIndex = index;
    return true;
  }

  get active() {
    if (this.activeIndex < 0 || this.activeIndex >= this.party.length) return null;
    return this.party[this.activeIndex];
  }

  giveExpToActive(expAmount, pokemonFactory, onEvolveCallback) {
    const p = this.active;
    if (!p) return;
    p.exp = (p.exp || 0) + (expAmount || 0);
    let need = (p.level || 1) * 10 + 20;
    while (p.exp >= need) {
      p.exp -= need;
      p.level = (p.level || 1) + 1;
      p.currentHP = p.maxHP;
      // проверяем эволюцию
      this._checkEvolutionForActive(pokemonFactory, onEvolveCallback);
      need = (p.level || 1) * 10 + 20;
    }
  }

  _checkEvolutionForActive(pokemonFactory, onEvolveCallback) {
    const p = this.active;
    if (!p) return;
    if (!pokemonFactory || typeof pokemonFactory.findSpec !== 'function') return;
    const spec = pokemonFactory.findSpec(p.id);
    if (!spec || !Array.isArray(spec.evolution) || spec.evolution.length === 0) return;
    const evo = spec.evolution.find(e => typeof e.level === 'number' && p.level >= e.level);
    if (!evo) return;

    if (typeof pokemonFactory.create !== 'function') {
      const oldId = p.id;
      p.id = evo.to;
      p.name = evo.to;
      if (typeof onEvolveCallback === 'function') onEvolveCallback(oldId, evo.to, this.activeIndex);
      return;
    }

    const newPokemon = pokemonFactory.create(evo.to, p.level);
    if (!newPokemon) return;

    const oldMax = p.maxHP || 1;
    const hpRatio = oldMax > 0 ? (p.currentHP / oldMax) : 1;
    newPokemon.exp = p.exp || 0;
    newPokemon.currentHP = Math.max(1, Math.floor(newPokemon.maxHP * hpRatio));
    this.party[this.activeIndex] = newPokemon;

    if (typeof onEvolveCallback === 'function') onEvolveCallback(p.id, evo.to, this.activeIndex);
  }
}
