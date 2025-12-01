// modules/battle.js
import { logTo } from './utils.js';

const DEFAULT_DROPS = [
  { id: 'pokeball', chance: 0.05, min: 1, max: 2 },
  { id: 'greatball', chance: 0.025, min: 1, max: 2 },
  { id: 'potion', chance: 0.18, min: 1, max: 1 },
  { id: 'pp_restore', chance: 0.08, min: 1, max: 1 }
];

export class Battle {
  constructor(player, enemy, data = {}, pokemonFactory = null) {
    this.player = player;
    this.enemy = enemy;
    this.data = data;
    this.pokemonFactory = pokemonFactory;

    // callbacks (подключаются извне)
    this.onEnd = null;      // function(victory)
    this.onDrop = null;     // function(itemId, qty)
    this.onUpdate = null;   // вызывается при изменении состояния (PP, inventory, party, HP и т.д.)
    this.onVisual = null;   // визуальные события: {type:'start'|'attack'|'damage'|'faint'|'catch'|'item'|'throw'|'switch', ...}
  }

  _emitUpdate() {
    if (typeof this.onUpdate === 'function') {
      try { this.onUpdate(); } catch (e) { console.error('onUpdate handler error', e); }
    }
  }

  _emitVisual(evt) {
    if (typeof this.onVisual === 'function') {
      try { this.onVisual(evt); } catch (e) { console.error('onVisual handler error', e); }
    }
  }

  start() {
    logTo('#battle-log', `Дикий ${this.enemy.name} появился!`);
    this._emitVisual({ type: 'start', enemy: this.enemy, player: this.player.active });
    this.render();
    this._emitUpdate();
  }

  // В modules/battle.js — метод render()
  render() {
    const enemyWrap = document.getElementById('enemy-wrap');
    const playerWrap = document.getElementById('player-wrap');

    // helper: ensure hp-bar exists
    const ensureHp = (wrap) => {
      if (!wrap) return;
      if (!wrap.querySelector('.hp-bar')) {
        const bar = document.createElement('div');
        bar.className = 'hp-bar';
        bar.innerHTML = '<div class="hp-fill"></div>';
        wrap.appendChild(bar);
      }
    };
    ensureHp(enemyWrap);
    ensureHp(playerWrap);

    // helper: set sprite src safely if element exists
    const setSprite = (wrap, imgId, src) => {
      if (!wrap) return;
      let img = wrap.querySelector('img.sprite');
      if (!img) {
        img = document.createElement('img');
        img.className = 'sprite';
        img.alt = imgId || '';
        wrap.appendChild(img);
      }
      // центрируем через CSS; устанавливаем src
      img.onerror = () => { img.onerror = null; img.src = '/assets/battle/missing.png'; };
      img.src = src;
    };

    // ENEMY
    if (enemyWrap) {
      // позиционируем wrap (фиксируем базовый transform)
      enemyWrap.style.left = '62%';
      enemyWrap.style.top = '12%';
      enemyWrap.style.transform = 'translate(-50%, 0) scale(0.78)';

      setSprite(enemyWrap, 'enemy-sprite', `/assets/images/pokemons/${this.enemy.id}.png`);

      // info
      let info = enemyWrap.querySelector('.info');
      if (!info) { info = document.createElement('div'); info.className = 'info'; enemyWrap.appendChild(info); }
      info.innerHTML = `<strong class="name">${this.enemy.name}</strong><div class="lvl">L${this.enemy.level}</div>`;

      // hp text
      let hpText = enemyWrap.querySelector('.hp-text');
      if (!hpText) { hpText = document.createElement('div'); hpText.className = 'hp-text'; enemyWrap.appendChild(hpText); }
      hpText.textContent = `HP ${this.enemy.currentHP}/${this.enemy.maxHP}`;

      // hp fill
      const fill = enemyWrap.querySelector('.hp-fill');
      if (fill) {
        const pct = Math.max(0, Math.min(100, Math.round((this.enemy.currentHP / Math.max(1, this.enemy.maxHP)) * 100)));
        fill.style.width = pct + '%';
      }
    }

    // PLAYER
    const p = this.player.active;
    if (playerWrap) {
      playerWrap.style.left = '38%';
      playerWrap.style.top = '38%';
      playerWrap.style.transform = 'translate(-50%, 0) scale(1.02)';

      if (p) {
        setSprite(playerWrap, 'player-sprite', `/assets/images/pokemons/back/${p.id}_back.png`);

        let info = playerWrap.querySelector('.info');
        if (!info) { info = document.createElement('div'); info.className = 'info'; playerWrap.appendChild(info); }
        info.innerHTML = `<strong class="name">${p.name}</strong><div class="lvl">L${p.level}</div>`;

        let hpText = playerWrap.querySelector('.hp-text');
        if (!hpText) { hpText = document.createElement('div'); hpText.className = 'hp-text'; playerWrap.appendChild(hpText); }
        hpText.textContent = `HP ${p.currentHP}/${p.maxHP}`;

        const fill = playerWrap.querySelector('.hp-fill');
        if (fill) {
          const pct = Math.max(0, Math.min(100, Math.round((p.currentHP / Math.max(1, p.maxHP)) * 100)));
          fill.style.width = pct + '%';
        }
      } else {
        // нет активного покемона
        const info = playerWrap.querySelector('.info');
        if (info) info.innerHTML = `<strong class="name">Нет покемона</strong>`;
        const fill = playerWrap.querySelector('.hp-fill');
        if (fill) fill.style.width = '0%';
      }
    }

    // очищаем боковые панели, чтобы не дублировать
    const enemyEl = document.getElementById('battle-enemy');
    const playerEl = document.getElementById('battle-player');
    if (enemyEl) enemyEl.innerHTML = '';
    if (playerEl) playerEl.innerHTML = '';
  }

  playerActionAttack(moveIndex) {
    const active = this.player.active;
    if (!active || active.currentHP <= 0) {
      logTo('#battle-log', 'Ваш покемон не может атаковать: 0 HP.');
      return;
    }

    const res = active.attack(moveIndex, this.enemy, this.data.types);
    if (!res.success) {
      logTo('#battle-log', 'Нет PP для этого приёма');
      return;
    }

    this._emitUpdate();
    this._emitVisual({ type: 'attack', attacker: 'player', move: res.moveName, damage: res.damage });

    logTo('#battle-log', `${active.name} использовал ${res.moveName} и нанес ${res.damage} урона`);
    if (res.effective > 1) logTo('#battle-log', 'Это супер эффективно!');
    else if (res.effective < 1 && res.effective > 0) logTo('#battle-log', 'Это не очень эффективно...');
    else if (res.effective === 0) logTo('#battle-log', 'Атака не действует!');

    this._emitVisual({ type: 'damage', target: 'enemy', amount: res.damage });

    if (this.enemy.currentHP <= 0) {
      this._emitVisual({ type: 'faint', target: 'enemy' });
      this._emitUpdate();
      return this.onEnemyFainted();
    }

    setTimeout(() => {
      this.enemyTurn();
      this.render();
      this._emitUpdate();
    }, 300);

    this.render();
  }

  playerActionRun() {
    const active = this.player.active;
    if (!active || active.currentHP <= 0) {
      logTo('#battle-log', 'Бежать нельзя: у активного покемона 0 HP.');
      return;
    }
    const base = 0.5;
    const spdDiff = active.spd - this.enemy.spd;
    const levelDiff = active.level - this.enemy.level;
    const chance = Math.min(0.95, Math.max(0.05, base + spdDiff * 0.02 + levelDiff * 0.01));
    if (Math.random() < chance) {
      logTo('#battle-log', 'Вы убежали!');
      this.endBattle(false);
    } else {
      logTo('#battle-log', 'Не удалось убежать!');
      setTimeout(() => { this.enemyTurn(); this.render(); this._emitUpdate(); }, 300);
    }
  }

  playerActionItem(itemId) {
    if (itemId === 'potion') {
      if (!this.player.inventory.potion || this.player.inventory.potion <= 0) { logTo('#battle-log','Нет Potion'); return; }
      this.player.inventory.potion--;
      this.player.active.currentHP = Math.min(this.player.active.maxHP, this.player.active.currentHP + 20);
      logTo('#battle-log', `${this.player.active.name} восстановил HP`);
      this._emitVisual({ type: 'item', item: 'potion', target: 'player' });
      this._emitUpdate();
      setTimeout(()=> { this.enemyTurn(); this.render(); this._emitUpdate(); }, 300);
      return;
    }

    if (itemId === 'pp_restore') {
      if (!this.player.inventory.pp_restore || this.player.inventory.pp_restore <= 0) { logTo('#battle-log','Нет PP Restore'); return; }
      this.player.inventory.pp_restore--;
      const p = this.player.active;
      if (!p) { logTo('#battle-log','Нет активного покемона'); return; }
      p.moves.forEach(m => { m.currentPP = m.pp; });
      logTo('#battle-log', `${p.name} восстановил все PP`);
      this._emitVisual({ type: 'item', item: 'pp_restore', target: 'player' });
      this._emitUpdate();
      setTimeout(()=> { this.enemyTurn(); this.render(); this._emitUpdate(); }, 300);
      return;
    }

    logTo('#battle-log', 'Предмет не поддерживается в бою.');
  }

  playerActionSwitch(index) {
    if (index === this.player.activeIndex) {
      logTo('#battle-log', 'Вы уже используете этого покемона.');
      return;
    }
    if (!this.player.switchTo(index)) {
      logTo('#battle-log', 'Смена невозможна');
      return;
    }
    logTo('#battle-log', `Вы сменили на ${this.player.active.name}`);
    this._emitVisual({ type: 'switch', toIndex: index, pokemon: this.player.active });
    this._emitUpdate();
    setTimeout(()=> { this.enemyTurn(); this.render(); this._emitUpdate(); }, 300);
  }

  enemyTurn() {
    if (this.enemy.currentHP <= 0) return;
    const target = this.player.active;
    if (!target) return;

    this._emitVisual({ type: 'attack', attacker: 'enemy', move: (this.enemy.moves && this.enemy.moves[0] && this.enemy.moves[0].name) || 'атака' });

    const res = this.enemy.attack(0, target, this.data.types);
    this._emitUpdate();

    logTo('#battle-log', `${this.enemy.name} атаковал и нанес ${res.damage}`);
    if (res.effective > 1) logTo('#battle-log', 'Это супер эффективно!');
    else if (res.effective < 1 && res.effective > 0) logTo('#battle-log', 'Это не очень эффективно...');
    else if (res.effective === 0) logTo('#battle-log', 'Атака не действует!');

    this._emitVisual({ type: 'damage', target: 'player', amount: res.damage });

    if (this.player.active && this.player.active.currentHP <= 0) {
      this._emitVisual({ type: 'faint', target: 'player' });
      this._emitUpdate();
      this.onPlayerFainted();
    }

    this.render();
  }

  onEnemyFainted() {
    logTo('#battle-log', `${this.enemy.name} пал!`);
    if (this.player.active) this.player.active.gainExp(10 + this.enemy.level * 2);

    this._emitVisual({ type: 'faint', target: 'enemy' });
    this._emitUpdate();

    const dropsCfg = Array.isArray(this.data.itemDrops) ? this.data.itemDrops : DEFAULT_DROPS;
    const drops = [];
    for (const d of dropsCfg) {
      const chance = typeof d.chance === 'number' ? d.chance : 0;
      if (Math.random() < chance) {
        const qty = (d.min === d.max) ? d.min : (d.min + Math.floor(Math.random() * (d.max - d.min + 1)));
        drops.push({ id: d.id, qty });
      }
    }

    if (drops.length > 0 && typeof this.onDrop === 'function') {
      for (const it of drops) {
        try { this.onDrop(it.id, it.qty); } catch(e){ console.error('onDrop handler error', e); }
      }
    }

    this.endBattle(true);
  }

  onPlayerFainted() {
    if (!this.player.active) return;
    logTo('#battle-log', `${this.player.active.name} пал и покинул ваш отряд!`);
    this.player.party.splice(this.player.activeIndex, 1);
    this._emitUpdate();

    if (this.player.party.length > 0) {
      this.player.activeIndex = 0;
      logTo('#battle-log', `Вы отправили ${this.player.active.name}`);
      this.render();
    } else {
      logTo('#battle-log', 'Все покемоны повержены.');
      this.endBattle(false);
    }
  }

  tryCatch(ballType) {
    if (!this.player || !this.enemy) { logTo('#battle-log','Ошибка: нет игрока или противника.'); return; }
    const inv = this.player.inventory || {};
    if (typeof inv[ballType] !== 'number' || inv[ballType] <= 0) { logTo('#battle-log', `Нет ${ballType}`); return; }
    if (!this.player.canCatch()) { logTo('#battle-log','Нет места в команде для нового покемона.'); return; }

    inv[ballType]--;
    this._emitUpdate();

    let baseChance = 0.3;
    if (ballType === 'greatball') baseChance = 0.5;
    if (ballType === 'pokeball') baseChance = 0.3;

    const hpFactor = 1 - (this.enemy.currentHP / Math.max(1, this.enemy.maxHP));
    const chance = Math.min(0.95, Math.max(0.01, baseChance + hpFactor * 0.5));

    logTo('#battle-log', `Попытка поймать ${this.enemy.name} (${Math.round(chance*100)}% шанс)`);
    this._emitVisual({ type: 'throw', ball: ballType });

    if (Math.random() < chance) {
      logTo('#battle-log', `Вы поймали ${this.enemy.name}!`);
      const caught = this.pokemonFactory ? this.pokemonFactory.create(this.enemy.id, this.enemy.level) : this.enemy;
      caught.currentHP = Math.max(1, Math.floor(caught.maxHP * 0.5));
      const added = this.player.addToParty(caught);
      if (!added) {
        logTo('#battle-log', 'Пойман, но в команде нет места — покемон убежал.');
        setTimeout(()=> { this.enemyTurn(); this.render(); this._emitUpdate(); }, 300);
        return;
      }

      this._emitVisual({ type: 'catch', success: true, pokemon: caught });
      this._emitUpdate();
      this.endBattle(true);
    } else {
      logTo('#battle-log', `${this.enemy.name} вырвался!`);
      this._emitVisual({ type: 'catch', success: false });
      setTimeout(()=> { this.enemyTurn(); this.render(); this._emitUpdate(); }, 300);
    }
  }

  endBattle(victory) {
    if (typeof this.onEnd === 'function') {
      try { this.onEnd(victory); } catch (e) { console.error('onEnd handler error', e); }
    }
  }
}
