// main.js
import { loadJSON } from './modules/utils.js';
import { Menu } from './modules/menu.js';
import { Player } from './modules/player.js';
import { World } from './modules/world.js';
import { PokemonFactory } from './modules/pokemon.js';
import { Battle } from './modules/battle.js';

const DATA = { pokemons: null, types: null, wild: null, itemDrops: null };

async function init() {
  // --- загрузка данных
  DATA.pokemons = await loadJSON('data/pokemons.json');
  DATA.types = await loadJSON('data/types.json');
  DATA.wild = await loadJSON('data/wild.json');
  try { DATA.itemDrops = await loadJSON('data/itemDrops.json'); } catch (e) { DATA.itemDrops = null; }

  // --- основные объекты
  const menu = new Menu();
  const player = new Player();
  const world = new World(20, 12);
  const pokemonFactory = new PokemonFactory(DATA.pokemons);

  world.wildPool = DATA.wild;
  world.player = player;

  // --- сцены
  const scenes = {
    menu: document.getElementById('scene-menu'),
    choose: document.getElementById('scene-choose'),
    world: document.getElementById('scene-world'),
    battle: document.getElementById('scene-battle')
  };

  function showScene(name) {
    Object.values(scenes).forEach(s => s && s.classList.add('hidden'));
    if (scenes[name]) scenes[name].classList.remove('hidden');
  }

  // --- визуальные хелперы (интеграция с Battle.onVisual)
  function setupBattleScene(enemy, playerPokemon) {
    const arenaBg = document.getElementById('arena-bg');
    if (arenaBg) arenaBg.src = '/assets/battle/arena.png';

    const enemySprite = document.getElementById('enemy-sprite');
    const playerSprite = document.getElementById('player-sprite');

    if (enemySprite) enemySprite.src = `/assets/images/pokemons/${enemy.id}.png`;
    if (playerSprite) playerSprite.src = `/assets/images/pokemons/back/${playerPokemon.id}_back.png`;

    updateHP('enemy', enemy.currentHP, enemy.maxHP);
    updateHP('player', playerPokemon.currentHP, playerPokemon.maxHP);

    const scene = document.getElementById('battle-scene');
    if (scene) scene.classList.remove('hidden');
  }

  function updateHP(side, cur, max) {
    const wrap = side === 'player' ? document.getElementById('player-wrap') : document.getElementById('enemy-wrap');
    if (!wrap) return;
    const fill = wrap.querySelector('.hp-fill');
    if (!fill) return;
    const pct = Math.max(0, Math.min(100, Math.round((cur / Math.max(1, max)) * 100)));
    fill.style.width = pct + '%';
    if (pct < 30) fill.style.background = 'linear-gradient(90deg,#f44336,#ff9800)';
    else if (pct < 60) fill.style.background = 'linear-gradient(90deg,#ffeb3b,#ffc107)';
    else fill.style.background = 'linear-gradient(90deg,#4caf50,#8bc34a)';
  }

  function playAttackAnimation(attackerSide, onComplete) {
    const targetWrap = attackerSide === 'player' ? document.getElementById('enemy-wrap') : document.getElementById('player-wrap');
    if (!targetWrap) { if (typeof onComplete === 'function') onComplete(); return; }

    const attackerWrap = attackerSide === 'player' ? document.getElementById('player-wrap') : document.getElementById('enemy-wrap');
    if (attackerWrap) {
      attackerWrap.classList.add('lunge');
      setTimeout(() => attackerWrap.classList.remove('lunge'), 180);
    }

    targetWrap.classList.add('shake');
    const fx = document.createElement('div'); fx.className = 'flash';
    const effects = document.getElementById('battle-effects');
    if (effects) effects.appendChild(fx);

    setTimeout(() => {
      targetWrap.classList.remove('shake');
      if (fx && fx.parentNode) fx.parentNode.removeChild(fx);
      if (typeof onComplete === 'function') onComplete();
    }, 420);
  }

  function showDamage(amount, xPercent = 50, yPercent = 30) {
    const df = document.getElementById('damage-float');
    if (!df) return;
    const el = document.createElement('div');
    el.className = 'num';
    el.textContent = amount;
    el.style.position = 'absolute';
    el.style.left = xPercent + '%';
    el.style.top = yPercent + '%';
    df.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
  }

  function handleVisualEvent(evt, battleInstance) {
    if (!evt || !evt.type) return;
    switch (evt.type) {
      case 'start':
        if (evt.enemy && evt.player) setupBattleScene(evt.enemy, evt.player);
        break;

      case 'attack':
        playAttackAnimation(evt.attacker, () => {
          if (evt.damage != null) {
            const target = evt.attacker === 'player' ? 'enemy' : 'player';
            updateHP(target, (battleInstance && battleInstance[target] && battleInstance[target].currentHP) || 0,
              (battleInstance && battleInstance[target] && battleInstance[target].maxHP) || 1);
            showDamage(evt.damage, evt.attacker === 'player' ? 60 : 40, evt.attacker === 'player' ? 30 : 50);
          }
        });
        break;

      case 'damage':
        updateHP(evt.target, (battleInstance && battleInstance[evt.target] && battleInstance[evt.target].currentHP) || 0,
          (battleInstance && battleInstance[evt.target] && battleInstance[evt.target].maxHP) || 1);
        showDamage(evt.amount, evt.target === 'enemy' ? 60 : 40, evt.target === 'enemy' ? 30 : 50);
        break;

      case 'faint': {
        const wrap = evt.target === 'enemy' ? document.getElementById('enemy-wrap') : document.getElementById('player-wrap');
        if (wrap) {
          // убираем классы анимаций, затем добавляем класс fainted
          wrap.classList.remove('shake', 'lunge');
          // принудительно сбрасываем базовый transform (тот, что задаёт позицию/scale)
          // базовый transform задаётся в render(), поэтому просто добавляем класс fainted
          wrap.classList.add('fainted');
        }
        break;
      }

      case 'item':
        if (evt.target === 'player') {
          const p = document.getElementById('player-wrap');
          if (p) { p.classList.add('shake'); setTimeout(()=> p.classList.remove('shake'), 300); }
        }
        break;

      case 'switch':
        if (evt.pokemon) {
          const playerSprite = document.querySelector('#player-wrap img.sprite');
          if (playerSprite) {
            playerSprite.onerror = () => { playerSprite.onerror = null; playerSprite.src = '/assets/battle/missing.png'; };
            playerSprite.src = `/assets/images/pokemons/back/${evt.pokemon.id}_back.png`;
          }
          updateHP('player', evt.pokemon.currentHP, evt.pokemon.maxHP);
          // обновим info текст
          const wrap = document.getElementById('player-wrap');
          const info = wrap && wrap.querySelector('.info');
          if (info) info.innerHTML = `<strong class="name">${evt.pokemon.name}</strong><div class="lvl">L${evt.pokemon.level}</div>`;
        }
        break;

      // остальные случаи оставляем как есть
    }
  }


  function refreshBattleUI(battleInstance) {
    renderPanels();
    const extra = document.getElementById('battle-extra');
    if (!extra || extra.classList.contains('hidden')) return;
    if (extra.children.length > 0 && extra.children[0].textContent && extra.children[0].textContent.includes('(')) {
      extra.innerHTML = '';
      const active = player.active;
      if (!active) return;
      active.moves.forEach((m, idx) => {
        const b = document.createElement('button');
        b.textContent = `${m.name} (${m.currentPP}/${m.pp})`;
        b.addEventListener('click', () => {
          battle.playerActionAttack(idx);
        });
        extra.appendChild(b);
      });
    }
  }

  // --- уведомление о получении предмета / событиях
  function showPickupNotice(text) {
    const notice = document.getElementById('pickup-notice');
    if (!notice) return;
    notice.textContent = text;
    notice.classList.remove('hidden');
    clearTimeout(showPickupNotice._t);
    showPickupNotice._t = setTimeout(() => { notice.classList.add('hidden'); }, 3500);
  }

  function formatItemName(id) {
    const map = { pokeball: 'Pokeball', greatball: 'Greatball', potion: 'Potion', pp_restore: 'PP Restore' };
    return map[id] || id;
  }

  // --- отрисовка стартовых покемонов
  function renderStarters() {
    const container = document.getElementById('starters');
    if (!container) return;
    container.innerHTML = '';
    const starters = ['torchic', 'mudkip', 'treecko'];
    for (const id of starters) {
      const spec = DATA.pokemons.find(p => p.id === id);
      if (!spec) continue;
      const card = document.createElement('div');
      card.className = 'card';
      const imgPath = `/assets/images/pokemons/${spec.id}.png`;
      card.innerHTML = `
        <h3>${spec.name}</h3>
        <img src="${imgPath}" alt="${spec.name}" width="64" height="64" style="display:block;margin:6px 0"/>
        <div class="small-muted">Тип: ${spec.type}</div>
        <div style="margin-top:8px">
          <button data-id="${spec.id}">Выбрать</button>
        </div>
      `;
      container.appendChild(card);
      const btn = card.querySelector('button');
      if (btn) {
        btn.addEventListener('click', () => {
          const pkm = pokemonFactory.create(spec.id, 5);
          player.chooseStarter(pkm);
          enterWorld();
        });
      }
    }
  }

  // --- отрисовка карты мира
  function renderWorld() {
    const map = document.getElementById('map-container');
    if (!map) return;
    map.innerHTML = '';
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = document.createElement('div');
        tile.className = 'tile ' + world.tileAt(x, y);
        if (x === world.playerPos.x && y === world.playerPos.y) tile.classList.add('player');
        map.appendChild(tile);
      }
    }
  }

  // --- отрисовка панелей (команда + инвентарь)
  function renderPanels() {
    const partyEl = document.getElementById('party-panel');
    if (partyEl) {
      partyEl.innerHTML = '<strong>Команда</strong><br/>';
      player.party.forEach((p, idx) => {
        const img = `/assets/images/pokemons/${p.id}.png`;
        const activeMark = idx === player.activeIndex ? '> ' : '';
        partyEl.innerHTML += `${activeMark}<img src="${img}" alt="${p.name}" width="28" height="28" style="vertical-align:middle;margin-right:6px"/> ${p.name} L${p.level} HP ${p.currentHP}/${p.maxHP}<br/>`;
      });
    }

    const inv = document.getElementById('inventory-panel');
    if (inv) {
      const pok = player.inventory.pokeball || 0;
      const gr = player.inventory.greatball || 0;
      const pot = player.inventory.potion || 0;
      const pp = player.inventory.pp_restore || 0;

      inv.innerHTML = '<strong>Инвентарь</strong><br/>' +
        `<img src="/assets/images/items/pokeball.png" class="item-icon" alt="Pokeball" width="20" height="20"> ${pok} ` +
        `<img src="/assets/images/items/greatball.png" class="item-icon" alt="Greatball" width="20" height="20"> ${gr} ` +
        `<img src="/assets/images/items/potion.png" class="item-icon" alt="Potion" width="20" height="20"> ${pot} ` +
        `<img src="/assets/images/items/pp_restore.png" class="item-icon" alt="PP Restore" width="20" height="20"> ${pp}`;
    }
  }

  // --- вход в мир (пропустить первый энкаунтер)
  function enterWorld() {
    showScene('world');
    if (world) world.skipNextEncounter = true;
    renderWorld();
    renderPanels();
  }

  // --- обработка перемещения
  window.addEventListener('keydown', (e) => {
    if (!scenes.world || scenes.world.classList.contains('hidden')) return;
    const mapKeys = {
      ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ц: [0, -1], Ц: [0, -1],
      ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ы: [0, 1], Ы: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ф: [-1, 0], Ф: [-1, 0],
      ArrowRight: [1, 0], d: [1, 0], D: [1, 0], в: [1, 0], В: [1, 0]
    };
    if (!mapKeys[e.key]) return;
    const [dx, dy] = mapKeys[e.key];
    const res = world.move(dx, dy);
    if (res.moved) {
      renderWorld();
      const enc = world.tryEncounter(res.tile, 0.2);
      if (enc) {
        if (!player.active) {
          const notice = document.getElementById('pickup-notice');
          if (notice) {
            notice.textContent = 'Нет активного покемона — бой не начат';
            notice.classList.remove('hidden');
            setTimeout(() => notice.classList.add('hidden'), 2500);
          }
        } else {
          const enemy = pokemonFactory.create(enc.id, enc.level);
          startBattle(enemy);
        }
      }
    }
  });

  // --- начало боя
  function startBattle(enemy) {
    if (!player.active) {
      const log = document.getElementById('battle-log');
      if (log) log.textContent = 'Невозможно начать бой: нет активного покемона.';
      return;
    }

    showScene('battle');

    const battle = new Battle(player, enemy, { types: DATA.types, pokemons: DATA.pokemons, itemDrops: DATA.itemDrops }, pokemonFactory);

    // подписываемся на обновления и визуальные события
    battle.onUpdate = () => refreshBattleUI(battle);
    battle.onVisual = (evt) => handleVisualEvent(evt, { player: player.active, enemy: battle.enemy });

    // обработка дропа
    battle.onDrop = (itemId, qty) => {
      if (!player.inventory[itemId]) player.inventory[itemId] = 0;
      player.inventory[itemId] += qty;
      showPickupNotice(`Получено: ${qty} × ${formatItemName(itemId)}`);
      renderPanels();
    };

    battle.start();

    // действие "атака"
    const actAttack = document.getElementById('act-attack');
    if (actAttack) actAttack.onclick = () => {
      const extra = document.getElementById('battle-extra');
      if (!extra) return;
      extra.classList.remove('hidden');
      extra.innerHTML = '';
      const active = player.active;
      if (!active) return;
      active.moves.forEach((m, idx) => {
        const b = document.createElement('button');
        b.textContent = `${m.name} (${m.currentPP}/${m.pp})`;
        b.addEventListener('click', () => {
          battle.playerActionAttack(idx);
        });
        extra.appendChild(b);
      });
    };

    // действие "бежать"
    const actRun = document.getElementById('act-run');
    if (actRun) actRun.onclick = () => battle.playerActionRun();

    // действие "предметы"
    const actItem = document.getElementById('act-item');
    if (actItem) actItem.onclick = () => {
      const extra = document.getElementById('battle-extra');
      if (!extra) return;
      extra.classList.remove('hidden'); extra.innerHTML = '';
      const potion = document.createElement('button'); potion.textContent = `Potion (${player.inventory.potion || 0})`;
      potion.onclick = () => { battle.playerActionItem('potion'); renderPanels(); };
      const pokeb = document.createElement('button'); pokeb.textContent = `Pokeball (${player.inventory.pokeball || 0})`;
      pokeb.onclick = () => { battle.tryCatch('pokeball'); renderPanels(); };
      const great = document.createElement('button'); great.textContent = `Greatball (${player.inventory.greatball || 0})`;
      great.onclick = () => { battle.tryCatch('greatball'); renderPanels(); };
      const pp = document.createElement('button'); pp.textContent = `PP Restore (${player.inventory.pp_restore || 0})`;
      pp.onclick = () => { battle.playerActionItem('pp_restore'); renderPanels(); };
      extra.appendChild(potion); extra.appendChild(pokeb); extra.appendChild(great); extra.appendChild(pp);
    };

    // действие "сменить покемона"
    const actSwitch = document.getElementById('act-switch');
    if (actSwitch) actSwitch.onclick = () => {
      const extra = document.getElementById('battle-extra');
      if (!extra) return;
      extra.classList.remove('hidden'); extra.innerHTML = '';
      player.party.forEach((p, idx) => {
        const b = document.createElement('button'); b.textContent = `${p.name} L${p.level} HP ${p.currentHP}/${p.maxHP}`;
        b.onclick = () => { battle.playerActionSwitch(idx); renderPanels(); };
        extra.appendChild(b);
      });
    };

    // обработчик завершения боя
    battle.onEnd = (victory) => {
      if (world) world.skipNextEncounter = true;

      // если победа — дать опыт активному покемону и обработать возможную эволюцию
      if (victory && enemy) {
        const expAmount = 10 + (enemy.level || 1) * 2;
        player.giveExpToActive(expAmount, pokemonFactory, (fromId, toId, slotIndex) => {
          showPickupNotice(`Эволюция: ${fromId} → ${toId}`);
          renderPanels();
          const log = document.getElementById('battle-log');
          if (log) log.textContent = `${fromId} эволюционировал в ${toId}!`;
        });
      }

      showScene('world');
      renderWorld();
      renderPanels();
      const log = document.getElementById('battle-log');
      if (log) log.textContent = '';
      const extra = document.getElementById('battle-extra');
      if (extra) extra.classList.add('hidden');
    };
  }

  // --- привязки меню
  const btnNew = document.getElementById('btn-new');
  if (btnNew) btnNew.addEventListener('click', () => menu.triggerNew());
  const btnExit = document.getElementById('btn-exit');
  if (btnExit) btnExit.addEventListener('click', () => window.close?.());
  const btnBack = document.getElementById('btn-back-to-menu');
  if (btnBack) btnBack.addEventListener('click', () => showScene('menu'));
  const btnNewSmall = document.getElementById('btn-new-game-small');
  if (btnNewSmall) btnNewSmall.addEventListener('click', () => menu.triggerNew());

  menu.onNew = () => {
    player.reset();
    world.init();
    showScene('choose');
    renderStarters();
  };

  // начальный интерфейс
  showScene('menu');
  renderPanels();
}

init().catch(e => {
  console.error('Ошибка инициализации', e);
});
