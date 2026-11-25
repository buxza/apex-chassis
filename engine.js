const state = {
  cash: 3500,
  rep: 0,
  level: 1,
  view: 'garage',
  garageFilter: 'all',
  discipline: 'drag',
  activeEvent: null,
  owned: {
    engine: ['r4_stock'], internals: ['int_stock'], induction: ['na_itb'],
    exhaust: ['ex_stock'], drivetrain: ['tr_street'], suspension: ['su_stock'],
    brakes: ['br_stock'], tires: ['ti_street'], aero: ['ae_stock']
  },
  prototypes: [],
  selected: {
    engine: 'r4_stock', internals: 'int_stock', induction: 'na_itb',
    exhaust: 'ex_stock', drivetrain: 'tr_street', suspension: 'su_stock',
    brakes: 'br_stock', tires: 'ti_street', aero: 'ae_stock'
  },
  precisionBonuses: {},
  tuning: { afr: 12.8, boost: 1.0, ign: 18, revLim: 8200, gear: 1.0, susp: 50, camber: -1.5, aero: 40, nosPower: 75 },
  health: 100,
  oilTemp: 90,
  nosCharge: 100,
  dynoPrev: [],
  dynoCurr: [],
  dynoAnim: 1,
  camYaw: 0.62,
  camPitch: 0.28,
  camZoom: 1.0,
  pinchDist: 0,
  draggingCam: false,
  lastX: 0, lastY: 0,
  exploded: true,
  carColor: '#ff5500',
  headlights: true,
  garageRevving: false,
  garageRpm: 950,
  hoveredHotspot: null,
  hotspots2D: [],
  pendingInstall: null,
  torqueNeedle: 0,
  torqueDir: 1,
  audioOn: false,
  hapticsOn: true
};

document.getElementById('haptic-btn').classList.add('on');

function notify(text, color = 'var(--gold)') {
  const feed = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderLeftColor = color;
  el.innerText = text;
  feed.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2800);
}

function getSelectedPart(cat) {
  const id = state.selected[cat];
  return DB[cat].find(p => p.id === id) || state.prototypes.find(p => p.id === id) || DB[cat][0];
}

function computeStats() {
  const eng = getSelectedPart('engine');
  const intl = getSelectedPart('internals');
  const ind = getSelectedPart('induction');
  const exh = getSelectedPart('exhaust');
  const trs = getSelectedPart('drivetrain');
  const sus = getSelectedPart('suspension');
  const brk = getSelectedPart('brakes');
  const tir = getSelectedPart('tires');
  const aero = getSelectedPart('aero');
  const t = state.tuning;

  let precMult = 1.0;
  Object.values(state.selected).forEach(id => { if (state.precisionBonuses[id]) precMult += 0.015; });

  const effBoost = ind.boostCap === 0 ? 0 : Math.min(t.boost, ind.boostCap);
  const afrMult = t.afr > 13.4 ? 1 + (t.afr - 13.4) * 0.065 : 1 - (13.4 - t.afr) * 0.028;
  const ignMult = 1 + (t.ign - 18) * 0.008;
  const boostMult = ind.boostCap === 0 ? ind.mult : (1 + effBoost * 0.48 * (ind.mult - 1) * 2.1);
  const hpHealth = 0.42 + 0.58 * (state.health / 100);

  const peakRaw = eng.hp * intl.hpMult * exh.hpMult * boostMult * afrMult * ignMult * precMult * hpHealth;
  const weightSave = (exh.weightSave || 0) + (brk.weightSave || 0) + (aero.weightSave || 0);
  const weight = Math.max(820, 960 + eng.weight - weightSave);
  const maxRpmLimit = Math.min(t.revLim, 8200 + (intl.revBonus || 0));

  const curve = [];
  let maxHp = 0, maxRpm = 0, maxNm = 0;
  const effLag = Math.max(0.01, ind.lag - (exh.spoolBonus || 0));
  for (let rpm = 1000; rpm <= maxRpmLimit; rpm += 250) {
    const n = (rpm - 1000) / Math.max(2000, maxRpmLimit - 1000);
    const spool = effLag > 0.04 ? Math.min(1, Math.max(0.18, (n - effLag * 0.4) / (1 - effLag * 0.4))) : 1;
    const ve = Math.sin(n * Math.PI * 0.8 + 0.28);
    const hp = Math.max(28, peakRaw * ve * (0.45 + 0.55 * spool));
    const nm = Math.round((hp * 7023) / rpm);
    if (hp > maxHp) { maxHp = Math.round(hp); maxRpm = rpm; }
    if (nm > maxNm) { maxNm = nm; }
    curve.push({ rpm, hp: Math.round(hp), nm });
  }

  const maxSafeBoost = eng.maxBoost + (intl.boostBonus || 0);
  const overboost = effBoost > maxSafeBoost;
  const leanRisk = (t.afr > 13.8 && effBoost > 1.25) || (t.ign > 28 && effBoost > 1.8);
  const egt = Math.round(610 + effBoost * 98 + (t.afr - 11.0) * 60 + (t.ign - 18) * 6);

  return {
    maxHp, maxRpm, maxNm, weight, curve, effBoost, maxSafeBoost, maxRpmLimit,
    overboost, leanRisk, egt, eng, intl, ind, exh, trs, sus, brk, tir, aero
  };
}

function toggleDrawerSize() {
  const vp = document.querySelector('.garage-viewport');
  vp.classList.toggle('expanded');
  haptic(12);
}

function selectGarageCat(cat) {
  state.garageFilter = cat;
  haptic(12);
  document.querySelectorAll('.cat-pill').forEach(b => {
    const active = b.dataset.cat === cat;
    b.classList.toggle('active', active);
    if (active) b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
  // Collapse expanded 3D view slightly so user sees parts immediately
  document.querySelector('.garage-viewport').classList.remove('expanded');
  renderGarageUI();
}

function renderGarageUI() {
  const container = document.getElementById('garage-sections-container');
  container.innerHTML = '';

  GARAGE_CATEGORIES.forEach(catObj => {
    if (state.garageFilter !== 'all' && state.garageFilter !== catObj.key) return;
    const box = document.createElement('div');
    box.className = 'box';
    box.innerHTML = `<div class="box-hdr"><span>${catObj.label}</span><span>${catObj.tag}</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'grid-2';

    const allItems = [...DB[catObj.key], ...state.prototypes.filter(p => p.cat === catObj.key)];
    allItems.forEach(item => {
      const isOwned = item.proto || state.owned[catObj.key].includes(item.id);
      const isSel = state.selected[catObj.key] === item.id;
      const hasBonus = state.precisionBonuses[item.id];
      const btn = document.createElement('button');
      btn.className = 'part-btn' + (isSel ? ' selected' : '') + (item.proto ? ' proto' : '');
      const tag = isSel ? (hasBonus ? 'ZAMONTOWANO (+5%)' : 'ZAMONTOWANO') : (isOwned ? 'ZAMONTUJ' : `KUP: $${item.price}`);
      btn.innerHTML = `<div class="t">${item.name}</div><div class="m">${item.spec}</div><div class="p">${tag}</div>`;
      btn.onclick = () => initiatePartInstall(catObj.key, item, isOwned);
      grid.appendChild(btn);
    });

    box.appendChild(grid);
    container.appendChild(box);
  });

  const inv = document.getElementById('proto-inventory');
  document.getElementById('proto-count').innerText = state.prototypes.length + ' szt.';
  if (state.prototypes.length > 0) {
    inv.innerHTML = '';
    state.prototypes.forEach(p => {
      const card = document.createElement('div');
      card.className = 'part-btn proto' + (state.selected[p.cat] === p.id ? ' selected' : '');
      card.innerHTML = `<div class="t">${p.name}</div><div class="m">${p.spec}</div><div class="p" style="color:var(--purple);">ZAMONTUJ</div>`;
      card.onclick = () => initiatePartInstall(p.cat, p, true);
      inv.appendChild(card);
    });
  }
}

function initiatePartInstall(cat, item, isOwned) {
  if (state.selected[cat] === item.id) return;
  if (!isOwned) {
    if (state.cash < item.price) {
      haptic([40, 40]);
      notify('Za mało gotówki! Wygraj wyścig lub licencję.', 'var(--red)');
      return;
    }
    state.cash -= item.price;
    state.owned[cat].push(item.id);
  }
  haptic(18);
  state.pendingInstall = { cat, item };
  state.torqueNeedle = 0;
  state.torqueDir = 1;
  document.getElementById('mg-part-name').innerText = item.name;
  document.getElementById('install-minigame').classList.add('active');
}

function confirmTorqueInstall(e) {
  if (e) e.preventDefault();
  if (!state.pendingInstall) return;
  const { cat, item } = state.pendingInstall;
  const hitSweetSpot = state.torqueNeedle >= 64 && state.torqueNeedle <= 86;
  triggerTorqueClick(hitSweetSpot);

  state.dynoPrev = [...state.dynoCurr];
  state.selected[cat] = item.id;
  if (hitSweetSpot) {
    state.precisionBonuses[item.id] = true;
    notify(`PERFEKCYJNY MOMENT! +5% bonusu: ${item.name}`, 'var(--green)');
  } else {
    notify(`Zamontowano: ${item.name}`, 'var(--cyan)');
  }

  state.pendingInstall = null;
  document.getElementById('install-minigame').classList.remove('active');
  renderGarageUI();
  updateAll();
}

function toggleExploded() {
  state.exploded = !state.exploded;
  haptic(15);
  document.getElementById('btn-explode').innerText = state.exploded ? 'ROZSTRZELONY: ON' : 'ROZSTRZELONY: OFF';
}
function toggleHeadlights() { state.headlights = !state.headlights; haptic(10); }
function setCarColor(hex) { state.carColor = hex; haptic(12); }
function startGarageRev(e) { if (e) e.preventDefault(); state.garageRevving = true; haptic(20); }
function stopGarageRev(e) {
  if (e) e.preventDefault();
  if (state.garageRevving && state.garageRpm > 4500) {
    triggerBlowOffValve();
    triggerExhaustPop();
  }
  state.garageRevving = false;
}

function repairCar() {
  if (state.health >= 100) return;
  if (state.cash < 350) { notify('Brak gotówki ($350) — użyj Sponsora.', 'var(--red)'); return; }
  state.cash -= 350; state.health = 100; state.oilTemp = 90;
  haptic([20, 30, 40]);
  notify('Silnik wyremontowany do 100%!', 'var(--green)');
  updateAll();
}
function sponsorBailout() {
  state.health = 100; state.oilTemp = 90;
  haptic(25);
  notify('Sponsor pokrył remont silnika (100%)!', 'var(--green)');
  updateAll();
}

// TOUCH GESTURES FOR 3D GARAGE: 1-FINGER ROTATE + 2-FINGER PINCH ZOOM + TAP HOTSPOT
const gCanvas = document.getElementById('garageCanvas');

gCanvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    state.draggingCam = false;
    state.pinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  } else if (e.touches.length === 1) {
    const rect = gCanvas.getBoundingClientRect();
    const mx = e.touches[0].clientX - rect.left;
    const my = e.touches[0].clientY - rect.top;
    // Larger 36px touch hit radius for fingers!
    for (const hs of state.hotspots2D) {
      if (Math.hypot(mx - hs.x, my - hs.y) < 36) {
        state.hoveredHotspot = hs;
        selectGarageCat(hs.cat);
        notify(`Strefa 3D: ${hs.label}`, 'var(--cyan)');
        return;
      }
    }
    state.draggingCam = true;
    state.lastX = e.touches[0].clientX;
    state.lastY = e.touches[0].clientY;
  }
}, { passive: true });

gCanvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && state.pinchDist > 0) {
    const newDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    state.camZoom = Math.max(0.65, Math.min(1.65, state.camZoom * (newDist / state.pinchDist)));
    state.pinchDist = newDist;
  } else if (e.touches.length === 1 && state.draggingCam) {
    state.camYaw += (e.touches[0].clientX - state.lastX) * 0.011;
    state.camPitch = Math.max(0.1, Math.min(0.65, state.camPitch + (e.touches[0].clientY - state.lastY) * 0.007));
    state.lastX = e.touches[0].clientX;
    state.lastY = e.touches[0].clientY;
  }
}, { passive: true });

gCanvas.addEventListener('touchend', () => { state.draggingCam = false; state.pinchDist = 0; });

gCanvas.addEventListener('mousedown', e => {
  const rect = gCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  for (const hs of state.hotspots2D) {
    if (Math.hypot(mx - hs.x, my - hs.y) < 28) {
      selectGarageCat(hs.cat);
      notify(`Strefa 3D: ${hs.label}`, 'var(--cyan)');
      return;
    }
  }
  state.draggingCam = true;
  state.lastX = e.clientX; state.lastY = e.clientY;
});
window.addEventListener('mouseup', () => { state.draggingCam = false; });
window.addEventListener('mousemove', e => {
  if (state.view !== 'garage' || !state.draggingCam) return;
  state.camYaw += (e.clientX - state.lastX) * 0.008;
  state.camPitch = Math.max(0.1, Math.min(0.65, state.camPitch + (e.clientY - state.lastY) * 0.005));
  state.lastX = e.clientX; state.lastY = e.clientY;
});

function drawGarage(now, dt) {
  const ctx = gCanvas.getContext('2d');
  if (gCanvas.width !== gCanvas.clientWidth || gCanvas.height !== gCanvas.clientHeight) {
    gCanvas.width = gCanvas.clientWidth; gCanvas.height = gCanvas.clientHeight;
  }
  const w = gCanvas.width, h = gCanvas.height;
  ctx.clearRect(0, 0, w, h);

  if (state.pendingInstall) {
    state.torqueNeedle += state.torqueDir * dt * 130;
    if (state.torqueNeedle >= 100) { state.torqueNeedle = 100; state.torqueDir = -1; }
    if (state.torqueNeedle <= 0) { state.torqueNeedle = 0; state.torqueDir = 1; }
    document.getElementById('mg-needle').style.left = state.torqueNeedle + '%';
  }

  const m = computeStats();
  if (state.garageRevving) {
    state.garageRpm = Math.min(m.maxRpmLimit, state.garageRpm + dt * 6500);
    updateEngineAudio(state.garageRpm, 1, m.effBoost, 0, false);
  } else {
    state.garageRpm = Math.max(950, state.garageRpm - dt * 4200);
    if (state.view === 'garage') updateEngineAudio(state.garageRpm, 0, 0, 0, false);
  }

  if (!state.draggingCam) state.camYaw += 0.002;
  const cosY = Math.cos(state.camYaw), sinY = Math.sin(state.camYaw);
  const cosP = Math.cos(state.camPitch), sinP = Math.sin(state.camPitch);
  const cx = w * 0.5, cy = h * 0.54;
  const scale = (Math.min(w, h) / 430) * state.camZoom;
  const expFactor = state.exploded ? 1 : 0;
  const hover = Math.sin(now * 0.0024) * 3.5 * expFactor;
  const vib = (state.garageRpm > 1200) ? (Math.random() - 0.5) * (state.garageRpm / 3500) : 0;

  function proj(x, y, z) {
    const rx = x * cosY - z * sinY;
    const rz1 = x * sinY + z * cosY;
    const ry = y * cosP - rz1 * sinP;
    const rz = y * sinP + rz1 * cosP;
    const persp = 720 / (720 + rz);
    return { x: cx + rx * scale * persp, y: cy + ry * scale * persp, z: rz };
  }

  const floorGrad = ctx.createRadialGradient(cx, cy + 70 * scale, 10, cx, cy + 70 * scale, 260 * scale);
  floorGrad.addColorStop(0, 'rgba(0, 229, 255, 0.16)');
  floorGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = floorGrad;
  ctx.beginPath(); ctx.ellipse(cx, cy + 72 * scale, 260 * scale, 80 * scale, 0, 0, Math.PI * 2); ctx.fill();

  function drawBox3D(x0, y0, z0, dx, dy, dz, topCol, sideCol, edgeCol) {
    const p = [
      proj(x0, y0, z0), proj(x0 + dx, y0, z0), proj(x0 + dx, y0, z0 + dz), proj(x0, y0, z0 + dz),
      proj(x0, y0 + dy, z0), proj(x0 + dx, y0 + dy, z0), proj(x0 + dx, y0 + dy, z0 + dz), proj(x0, y0 + dy, z0 + dz)
    ];
    ctx.lineWidth = 1.2; ctx.strokeStyle = edgeCol; ctx.fillStyle = sideCol;
    [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].forEach(f => {
      ctx.beginPath();
      f.forEach((idx, i) => i === 0 ? ctx.moveTo(p[idx].x, p[idx].y) : ctx.lineTo(p[idx].x, p[idx].y));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = topCol;
    ctx.beginPath();
    [0,1,2,3].forEach((idx, i) => i === 0 ? ctx.moveTo(p[idx].x, p[idx].y) : ctx.lineTo(p[idx].x, p[idx].y));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  drawBox3D(-165, 18, -56, 330, 14, 112, '#1a222f', '#0f141c', '#00e5ff');
  drawBox3D(-175, 24, 16, 230, 6, 10, m.exh.color || '#ff5500', '#1a202c', '#ffffff');

  if (state.garageRevving && state.garageRpm > 5200 && Math.random() < 0.45) {
    const tip = proj(-185, 27, 21);
    ctx.fillStyle = '#ffbe0b';
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 11 * scale, 0, Math.PI * 2); ctx.fill();
  }

  const ride = (50 - state.tuning.susp) * 0.24;
  const camberRad = (state.tuning.camber * Math.PI) / 180;
  const wheelSet = [
    { x: -118, z: -76, side: -1 }, { x: -118, z: 76, side: 1 },
    { x: 118, z: -76, side: -1 }, { x: 118, z: 76, side: 1 }
  ].map(wItem => ({ ...wItem, depth: proj(wItem.x, 38 + ride, wItem.z).z })).sort((a, b) => b.depth - a.depth);

  wheelSet.forEach(wl => {
    const wy = 38 + ride;
    const hub = proj(wl.x, wy, wl.z * 0.88);
    const strutTop = proj(wl.x, 6, wl.z * 0.65);
    ctx.strokeStyle = '#ff5500'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(strutTop.x, strutTop.y); ctx.lineTo(hub.x, hub.y); ctx.stroke();

    const segs = 16;
    const outerLoop = [], innerLoop = [], rotorLoop = [];
    const tireR = 30, tireW = 16;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const lx = Math.cos(a) * tireR, ly = Math.sin(a) * tireR;
      const tiltZ = -ly * Math.sin(camberRad) * wl.side;
      const tiltY = ly * Math.cos(camberRad);
      outerLoop.push(proj(wl.x + lx, wy + tiltY, wl.z + (tireW / 2) * wl.side + tiltZ));
      innerLoop.push(proj(wl.x + lx, wy + tiltY, wl.z - (tireW / 2) * wl.side + tiltZ));
      rotorLoop.push(proj(wl.x + lx * 0.56, wy + tiltY * 0.56, wl.z + (tireW / 2 + 1) * wl.side + tiltZ * 0.56));
    }

    ctx.fillStyle = '#090c10'; ctx.strokeStyle = m.tir.color || '#00e5ff'; ctx.lineWidth = 1.6;
    for (let i = 0; i < segs; i++) {
      const n = (i + 1) % segs;
      ctx.beginPath();
      ctx.moveTo(outerLoop[i].x, outerLoop[i].y); ctx.lineTo(outerLoop[n].x, outerLoop[n].y);
      ctx.lineTo(innerLoop[n].x, innerLoop[n].y); ctx.lineTo(innerLoop[i].x, innerLoop[i].y);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath();
    outerLoop.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#2d3748'; ctx.strokeStyle = m.brk.color || '#cbd5e0'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    rotorLoop.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });

  const engY = (-50 * expFactor - 12 * (1 - expFactor)) + hover + vib;
  drawBox3D(64, engY, -28, 72, 42, 56, 'rgba(22, 28, 38, 0.88)', 'rgba(13, 17, 24, 0.92)', m.eng.color || '#00e676');

  const pistonSpeed = state.garageRpm * 0.000045;
  for (let i = 0; i < 4; i++) {
    const px = 74 + i * 15;
    const pOff = Math.sin(now * pistonSpeed + i * 1.6) * 6;
    drawBox3D(px - 3, engY + 6 + pOff, -14, 6, 12, 10, '#fff', '#718096', m.eng.color || '#00e676');
  }

  const indY = engY - (42 * expFactor + 18 * (1 - expFactor)) - hover * 0.5;
  drawBox3D(95, indY, -22, 28, 22, 28, '#ff5500', '#3d1504', '#ffbe0b');
  drawBox3D(158, 4, -38, 12, 26, 76, '#cbd5e0', '#4a5568', '#00e5ff');

  const shY = (-120 * expFactor - 24 * (1 - expFactor)) - hover;
  const sPts = [
    proj(-168, shY + 26, -58), proj(-168, shY + 26, 58),
    proj(-122, shY - 12, -52), proj(-122, shY - 12, 52),
    proj(-35, shY - 38, -46), proj(-35, shY - 38, 46),
    proj(55, shY - 34, -46), proj(55, shY - 34, 46),
    proj(168, shY + 12, -56), proj(168, shY + 12, 56)
  ];
  ctx.strokeStyle = state.carColor;
  ctx.fillStyle = state.carColor + '22';
  ctx.lineWidth = 1.8;
  [[0,2,3,1],[2,4,5,3],[4,6,7,5],[6,8,9,7]].forEach(q => {
    ctx.beginPath();
    q.forEach((idx, i) => i === 0 ? ctx.moveTo(sPts[idx].x, sPts[idx].y) : ctx.lineTo(sPts[idx].x, sPts[idx].y));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });

  if (state.headlights) {
    [-40, 40].forEach(hz => {
      const hl = proj(168, shY + 10, hz);
      const beam = proj(255, shY + 22, hz * 1.4);
      const grad = ctx.createLinearGradient(hl.x, hl.y, beam.x, beam.y);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.7)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.strokeStyle = grad; ctx.lineWidth = 12 * scale;
      ctx.beginPath(); ctx.moveTo(hl.x, hl.y); ctx.lineTo(beam.x, beam.y); ctx.stroke();
    });
  }

  if (state.tuning.aero > 50 || state.selected.aero !== 'ae_stock') {
    drawBox3D(-178, shY - 20, -64, 18, 5, 128, state.carColor, '#1a202c', '#ffffff');
  }

  const rawSpots = [
    { cat: 'engine', label: 'SILNIK', pos: proj(100, engY + 15, 0) },
    { cat: 'induction', label: 'TURBO', pos: proj(108, indY + 10, -8) },
    { cat: 'exhaust', label: 'WYDECH', pos: proj(-90, 25, 22) },
    { cat: 'tires', label: 'KOŁA', pos: proj(118, 38 + ride, 76) },
    { cat: 'suspension', label: 'ZAWIAS', pos: proj(-118, 18, 65) },
    { cat: 'aero', label: 'AERO', pos: proj(-170, shY - 18, 0) }
  ];
  state.hotspots2D = rawSpots.map(s => ({ cat: s.cat, label: s.label, x: s.pos.x, y: s.pos.y }));

  // Mobile-friendly pulsing tap rings
  const pulse = 1 + Math.sin(now * 0.006) * 0.18;
  state.hotspots2D.forEach(hs => {
    const isSel = state.garageFilter === hs.cat;
    ctx.beginPath();
    ctx.arc(hs.x, hs.y, (isSel ? 12 : 9) * pulse, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? 'rgba(255, 85, 0, 0.9)' : 'rgba(0, 229, 255, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
  });
}

function renderEventsAndBosses() {
  const evBox = document.getElementById('events-container');
  evBox.innerHTML = '';
  EVENTS_DB.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'event-card ' + (ev.type === 'pink' ? 'pink' : (ev.type === 'spec' ? 'spec' : ''));
    const limitBadge = ev.maxHpLimit ? `<span style="color:var(--gold); font-size:10px;">MAX ${ev.maxHpLimit} KM</span>` : '';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:10.5px; font-weight:800; color:${ev.type === 'pink' ? 'var(--red)' : 'var(--cyan)'};">${ev.badge}</span>
        ${limitBadge}
      </div>
      <h3 style="font-size:15px;">${ev.title} ${ev.done ? '✅' : ''}</h3>
      <p style="font-size:11.5px; color:var(--muted);">${ev.desc}</p>
      <div style="font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--green);">NAGRODA: +$${ev.rewardCash} • +${ev.rewardRep} RP</div>
      <button class="btn-main" style="${ev.type === 'pink' ? 'background:var(--red); color:#fff;' : ''}" onclick="startEvent('${ev.id}')">
        ${ev.type === 'pink' ? 'POSTAW AUTO (PINK SLIPS)' : 'START ZAWODÓW'}
      </button>
    `;
    evBox.appendChild(card);
  });

  const list = document.getElementById('bosses-list');
  list.innerHTML = '';
  SYNDICATE_BOSSES.forEach(b => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.style.borderColor = 'rgba(255,85,0,0.4)';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span style="background:var(--red); color:#fff; font-size:9.5px; font-weight:800; padding:2px 6px; border-radius:3px;">${b.defeated ? 'POKONANY' : 'BOSS'}</span>
          <h3 style="margin-top:4px; font-size:14.5px;">${b.name}</h3>
          <div style="font-size:11px; color:var(--orange); font-weight:700;">${b.title}</div>
        </div>
        <div style="text-align:right; font-family:'JetBrains Mono',monospace;">
          <div style="color:var(--green); font-weight:800;">+$${b.rewardCash}</div>
          <div style="color:var(--gold); font-size:10.5px;">+${b.rewardRep} RP</div>
        </div>
      </div>
      <p style="font-size:11.5px; color:var(--muted);">${b.desc}</p>
      <div style="font-size:11px; font-weight:700; color:var(--cyan);">${b.targetText}</div>
      <button class="btn-main" onclick="challengeBoss('${b.id}')">WYZWANIE NA POJEDYNEK</button>
    `;
    list.appendChild(card);
  });
}

function startEvent(evId) {
  const ev = EVENTS_DB.find(e => e.id === evId);
  const m = computeStats();
  if (ev.maxHpLimit && m.maxHp > ev.maxHpLimit) {
    haptic([40, 40]);
    notify(`Zbyt duża moc (${m.maxHp} KM)! Obniż Boost poniżej ${ev.maxHpLimit} KM.`, 'var(--red)');
    return;
  }
  state.activeEvent = ev;
  setDiscipline(ev.disc);
  switchView('track');
}

function challengeBoss(id) {
  const boss = SYNDICATE_BOSSES.find(b => b.id === id);
  state.activeEvent = { ...boss, type: 'boss' };
  setDiscipline(boss.disc);
  switchView('track');
}

function openMysteryCrate(cost) {
  if (state.cash < cost) { haptic([40, 40]); notify('Brakuje gotówki ($1,200)!', 'var(--red)'); return; }
  state.cash -= cost;
  grantRandomPrototype();
  updateAll();
}

function grantRandomPrototype() {
  const unowned = PROTOTYPE_POOL.filter(p => !state.prototypes.some(o => o.id === p.id));
  const resEl = document.getElementById('crate-result');
  if (unowned.length > 0) {
    const won = unowned[Math.floor(Math.random() * unowned.length)];
    state.prototypes.push(won);
    state.selected[won.cat] = won.id;
    haptic([30, 40, 60]);
    if (resEl) resEl.innerText = `LEGENDARNY DROP! Zamontowano: ${won.name}`;
    notify(`PROTOTYP: ${won.name}!`, 'var(--purple)');
  } else {
    state.cash += 2200;
    if (resEl) resEl.innerText = 'Masz już wszystkie prototypy! Bonus: +$2,200';
  }
  renderGarageUI();
}

function updateTune() {
  state.dynoPrev = [...state.dynoCurr];
  state.tuning.afr = parseFloat(document.getElementById('s-afr').value);
  state.tuning.boost = parseFloat(document.getElementById('s-boost').value);
  state.tuning.ign = parseInt(document.getElementById('s-ign').value);
  state.tuning.revLim = parseInt(document.getElementById('s-revlim').value);
  state.tuning.gear = parseFloat(document.getElementById('s-gear').value);
  state.tuning.susp = parseInt(document.getElementById('s-susp').value);
  state.tuning.camber = parseFloat(document.getElementById('s-camber').value);
  state.tuning.aero = parseInt(document.getElementById('s-aero').value);
  state.tuning.nosPower = parseInt(document.getElementById('s-nos').value);

  document.getElementById('v-afr').innerText = state.tuning.afr.toFixed(1) + ' : 1';
  document.getElementById('v-boost').innerText = state.tuning.boost.toFixed(1) + ' bar';
  document.getElementById('v-ign').innerText = '+' + state.tuning.ign + '°';
  document.getElementById('v-revlim').innerText = state.tuning.revLim + ' RPM';
  document.getElementById('v-gear').innerText = state.tuning.gear.toFixed(2) + 'x';
  document.getElementById('v-susp').innerText = state.tuning.susp + '%';
  document.getElementById('v-camber').innerText = state.tuning.camber.toFixed(1) + '°';
  document.getElementById('v-aero').innerText = state.tuning.aero + '%';
  document.getElementById('v-nos').innerText = '+' + state.tuning.nosPower + ' KM';
  updateAll();
}

function applyPreset(mode) {
  haptic(15);
  state.dynoPrev = [...state.dynoCurr];
  const map = {
    drag: { afr: 12.6, boost: 2.1, ign: 22, revLim: 8800, gear: 1.35, susp: 85, camber: -0.2, aero: 10, nosPower: 150 },
    drift: { afr: 12.2, boost: 1.5, ign: 19, revLim: 8600, gear: 0.85, susp: 70, camber: -3.8, aero: 25, nosPower: 80 },
    rally: { afr: 12.1, boost: 1.4, ign: 17, revLim: 8000, gear: 0.80, susp: 20, camber: -1.2, aero: 45, nosPower: 90 },
    circuit: { afr: 12.7, boost: 1.7, ign: 21, revLim: 9000, gear: 1.05, susp: 90, camber: -3.2, aero: 95, nosPower: 100 }
  };
  Object.assign(state.tuning, map[mode]);
  document.getElementById('s-afr').value = state.tuning.afr;
  document.getElementById('s-boost').value = state.tuning.boost;
  document.getElementById('s-ign').value = state.tuning.ign;
  document.getElementById('s-revlim').value = state.tuning.revLim;
  document.getElementById('s-gear').value = state.tuning.gear;
  document.getElementById('s-susp').value = state.tuning.susp;
  document.getElementById('s-camber').value = state.tuning.camber;
  document.getElementById('s-aero').value = state.tuning.aero;
  document.getElementById('s-nos').value = state.tuning.nosPower;
  updateTune();
}

function runDynoPull() {
  state.dynoAnim = 0;
  haptic(25);
  const m = computeStats();
  if (m.overboost || m.leanRisk) {
    state.health = Math.max(10, state.health - 12);
    haptic([50, 50, 80]);
    notify('UWAGA: Stukowe spalanie uszkodziło silnik!', 'var(--red)');
  }
  updateAll();
}

function updateAll() {
  const m = computeStats();
  state.dynoCurr = m.curve;

  const ranks = ['ROOKIE', 'STREET TUNER', 'PRO MECHANIC', 'SYNDICATE ACE', 'APEX LEGEND'];
  document.getElementById('hdr-lvl').innerText = `LVL ${state.level} • ${ranks[Math.min(ranks.length - 1, state.level - 1)]}`;
  document.getElementById('hdr-cash').innerText = '$' + state.cash.toLocaleString();
  document.getElementById('hdr-rep').innerText = state.rep + ' RP';
  document.getElementById('hdr-hp').innerText = m.maxHp + ' KM';
  document.getElementById('hdr-wear').innerText = Math.round(state.health) + '%';
  document.getElementById('garage-hp-lbl').innerText = Math.round(state.health) + '%';
  document.getElementById('hdr-wear-chip').className = state.health < 50 ? 'chip warn' : 'chip';

  document.getElementById('garage-summary').innerText =
    `${m.weight} kg • ${Math.round((m.maxHp / m.weight) * 1000)} KM/t • Max ${m.maxSafeBoost.toFixed(1)} bar`;

  document.getElementById('dyno-peak').innerText = `SZCZYT: ${m.maxHp} KM @ ${m.maxRpm} RPM`;
  document.getElementById('dyno-sub').innerText = `${m.maxNm} Nm • EGT: ${m.egt}°C`;

  const panel = document.getElementById('crew-panel');
  const status = document.getElementById('crew-status');
  const advice = document.getElementById('crew-advice');
  if (m.overboost) {
    panel.style.borderColor = 'var(--red)'; status.style.color = 'var(--red)'; status.innerText = 'OVERBOOST!';
    advice.innerText = `Boost ${m.effBoost.toFixed(1)} bar przekracza wytrzymałość bloku (${m.maxSafeBoost.toFixed(1)} bar)!`;
  } else if (m.leanRisk) {
    panel.style.borderColor = 'var(--red)'; status.style.color = 'var(--red)'; status.innerText = 'DETONACJA!';
    advice.innerText = `Zbyt ubogie AFR lub zbyt agresywny zapłon (+${state.tuning.ign}°) przy wysokim doładowaniu!`;
  } else {
    panel.style.borderColor = 'var(--cyan)'; status.style.color = 'var(--cyan)'; status.innerText = 'OPTIMAL';
    advice.innerText = 'Przesuwaj suwaki palcem — wykres mocy na górze reaguje na żywo.';
  }
}

function drawDyno(dt) {
  const canvas = document.getElementById('dynoCanvas');
  const ctx = canvas.getContext('2d');
  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
  }
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const m = computeStats();
  if (state.dynoAnim < 1) {
    state.dynoAnim = Math.min(1, state.dynoAnim + dt * 0.65);
    updateEngineAudio(1000 + state.dynoAnim * (m.maxRpmLimit - 1000), state.dynoAnim < 0.98 ? 1 : 0, m.effBoost, 0, false);
  }

  const pad = { l: 42, r: 16, t: 54, b: 26 };
  const gw = w - pad.l - pad.r, gh = h - pad.t - pad.b;
  const maxY = 1200;

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.fillStyle = '#8290a3';
  ctx.font = '9.5px "JetBrains Mono"';
  for (let v = 0; v <= maxY; v += 300) {
    const y = pad.t + gh - (v / maxY) * gh;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + gw, y); ctx.stroke();
    ctx.fillText(v + '', 6, y + 3);
  }
  for (let rpm = 1000; rpm <= 10000; rpm += 2000) {
    const x = pad.l + ((rpm - 1000) / 9200) * gw;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + gh); ctx.stroke();
    ctx.fillText((rpm / 1000) + 'k', x - 8, pad.t + gh + 16);
  }

  function plot(data, key, col, lw, dash, ratio) {
    if (!data || !data.length) return;
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash);
    ctx.beginPath();
    const maxI = Math.max(1, Math.floor(data.length * ratio));
    for (let i = 0; i < maxI; i++) {
      const pt = data[i];
      const x = pad.l + ((pt.rpm - 1000) / 9200) * gw;
      const y = pad.t + gh - (Math.min(maxY, pt[key]) / maxY) * gh;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  plot(state.dynoPrev, 'hp', 'rgba(255,255,255,0.25)', 2, [4, 4], 1);
  plot(state.dynoCurr, 'nm', '#00e5ff', 2.5, [], state.dynoAnim);
  plot(state.dynoCurr, 'hp', '#ff5500', 3.5, [], state.dynoAnim);
}

function switchView(v) {
  state.view = v;
  haptic(10);
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + v).classList.add('active');
  if (v === 'track') resetRace();
  if (v === 'events' || v === 'market') renderEventsAndBosses();
}

function setDiscipline(d) {
  state.discipline = d;
  haptic(12);
  document.querySelectorAll('.disc-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('d-' + d).classList.add('active');
  const names = {
    drag: 'STREET DRAG 402M',
    drift: 'TOUGE DRIFT',
    rally: 'RALLYCROSS SZUTER',
    circuit: 'TIME ATTACK GP'
  };
  document.getElementById('track-title').innerText = state.activeEvent ? state.activeEvent.title : names[d];
  resetRace();
}

const keys = { left: false, right: false, gas: false, brake: false, hb: false, nos: false };
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && state.pendingInstall) { e.preventDefault(); confirmTorqueInstall(); return; }
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.gas = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.brake = true;
  if (e.code === 'Space') keys.hb = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyN') keys.nos = true;
  if (e.code === 'KeyR' && state.view === 'track') resetRace();
});
window.addEventListener('keyup', e => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.gas = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.brake = false;
  if (e.code === 'Space') keys.hb = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyN') keys.nos = false;
});

function bindTouch(id, prop) {
  const el = document.getElementById(id);
  const on = e => {
    e.preventDefault();
    if (!keys[prop]) haptic(prop === 'gas' || prop === 'nos' ? 16 : 10);
    keys[prop] = true;
    el.classList.add('pressed');
  };
  const off = e => {
    e.preventDefault();
    keys[prop] = false;
    el.classList.remove('pressed');
  };
  el.addEventListener('touchstart', on, { passive: false });
  el.addEventListener('touchend', off, { passive: false });
  el.addEventListener('touchcancel', off, { passive: false });
  el.addEventListener('mousedown', on);
  el.addEventListener('mouseup', off);
  el.addEventListener('mouseleave', off);
}
bindTouch('t-left', 'left'); bindTouch('t-right', 'right');
bindTouch('t-gas', 'gas'); bindTouch('t-brake', 'brake');
bindTouch('t-hb', 'hb'); bindTouch('t-nos', 'nos');

const car = {
  x: 200, y: 260, vx: 0, vy: 0, angle: 0, angularVel: 0,
  speed: 0, rpm: 1000, gear: 1, prevGas: 0,
  dist: 0, rivalDist: 0, time: 0,
  done: false, resultText: '', rewardSummary: '',
  driftPts: 0, combo: 1.0, comboTimer: 0,
  skids: [], particles: [], shake: 0,
  gLat: 0, gLong: 0, pitchAngle: 0,
  tireTemps: [48, 48, 48, 48]
};

(function initLeds() {
  const box = document.getElementById('rpm-leds');
  for (let i = 0; i < 12; i++) {
    const d = document.createElement('div');
    d.className = 'led'; d.id = 'led-' + i;
    box.appendChild(d);
  }
})();

function resetRace() {
  haptic(15);
  car.x = 180; car.y = 260; car.vx = 0; car.vy = 0; car.angle = 0; car.angularVel = 0;
  car.speed = 0; car.rpm = 1000; car.gear = 1;
  car.dist = 0; car.rivalDist = 0; car.time = 0;
  car.done = false; car.resultText = ''; car.rewardSummary = '';
  car.driftPts = 0; car.combo = 1.0; car.comboTimer = 0;
  car.skids = []; car.particles = []; car.shake = 0;
  car.gLat = 0; car.gLong = 0; car.pitchAngle = 0;
  car.tireTemps = [48, 48, 48, 48];
  state.oilTemp = 90;
  state.nosCharge = 100;
}

function handleEventOutcome(won) {
  haptic(won ? [40, 40, 80] : [80, 50, 80]);
  const ev = state.activeEvent;
  if (!ev) {
    const cash = won ? 950 : 250;
    const rep = won ? 180 : 40;
    car.done = true;
    car.resultText = won ? `ZWYCIĘSTWO! ${car.time.toFixed(2)}s` : `META! ${car.time.toFixed(2)}s`;
    car.rewardSummary = `+$${cash}  |  +${rep} RP`;
    state.cash += cash; state.rep += rep;
  } else if (ev.type === 'pink') {
    car.done = true;
    if (won) {
      car.resultText = 'PINK SLIPS WYGRANY! NOWY PROTOTYP!';
      car.rewardSummary = `+$${ev.rewardCash} | +${ev.rewardRep} RP`;
      state.cash += ev.rewardCash; state.rep += ev.rewardRep;
      grantRandomPrototype();
    } else {
      car.resultText = 'PRZEGRAŁEŚ PINK SLIPS!';
      car.rewardSummary = 'Rywal zabrał Twoje części — powrót do serii.';
      state.selected = {
        engine: 'r4_stock', internals: 'int_stock', induction: 'na_itb',
        exhaust: 'ex_stock', drivetrain: 'tr_street', suspension: 'su_stock',
        brakes: 'br_stock', tires: 'ti_street', aero: 'ae_stock'
      };
      renderGarageUI();
    }
    state.activeEvent = null;
  } else {
    car.done = true;
    if (won) {
      car.resultText = `ZALICZONO: ${ev.title}!`;
      car.rewardSummary = `+$${ev.rewardCash}  |  +${ev.rewardRep} RP`;
      state.cash += ev.rewardCash; state.rep += ev.rewardRep;
      const origEv = EVENTS_DB.find(e => e.id === ev.id);
      if (origEv) origEv.done = true;
      const origBoss = SYNDICATE_BOSSES.find(b => b.id === ev.id);
      if (origBoss) origBoss.defeated = true;
    } else {
      car.resultText = `NIEZALICZONE: ${ev.title}`;
      car.rewardSummary = 'Popraw strojenie w Hamowni ECU.';
    }
    state.activeEvent = null;
  }
  state.level = Math.floor(state.rep / 500) + 1;
  updateAll();
}

function drawGForceMeter() {
  const gc = document.getElementById('gforceCanvas');
  const gctx = gc.getContext('2d');
  gctx.clearRect(0, 0, 44, 44);
  gctx.strokeStyle = 'rgba(255,255,255,0.16)';
  gctx.beginPath(); gctx.moveTo(22, 3); gctx.lineTo(22, 41); gctx.moveTo(3, 22); gctx.lineTo(41, 22); gctx.stroke();
  gctx.beginPath(); gctx.arc(22, 22, 13, 0, Math.PI * 2); gctx.stroke();

  const gx = Math.max(-18, Math.min(18, car.gLat * 11));
  const gy = Math.max(-18, Math.min(18, -car.gLong * 11));
  gctx.fillStyle = '#ff5500';
  gctx.beginPath(); gctx.arc(22 + gx, 22 + gy, 3.5, 0, Math.PI * 2); gctx.fill();
}

function updateTireTempUI() {
  ['t-fl', 't-fr', 't-rl', 't-rr'].forEach((id, idx) => {
    const t = Math.round(car.tireTemps[idx]);
    const el = document.getElementById(id);
    el.querySelector('b').innerText = t + '°';
    el.style.background = t < 65 ? '#12263a' : (t <= 108 ? '#113826' : '#4a121b');
    el.style.borderColor = t < 65 ? '#00e5ff' : (t <= 108 ? '#00e676' : '#ff1744');
  });
}

function drawTrack(dt) {
  const canvas = document.getElementById('trackCanvas');
  const ctx = canvas.getContext('2d');
  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
  }
  const w = canvas.width, h = canvas.height;
  const m = computeStats();
  const disc = state.discipline;

  const gas = keys.gas ? 1 : 0;
  const brake = keys.brake ? 1 : 0;
  const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const hb = keys.hb ? 1 : 0;
  const nosOn = keys.nos && state.nosCharge > 2 && gas > 0 && !car.done && state.health > 0;

  if (car.prevGas === 1 && gas === 0 && car.rpm > 4500 && (state.tuning.afr < 12.6 || m.exh.pops)) {
    triggerExhaustPop();
    car.particles.push({
      x: disc === 'drag' ? 95 : car.x - Math.cos(car.angle) * 24,
      y: disc === 'drag' ? h * 0.56 + 30 : car.y - Math.sin(car.angle) * 24,
      vx: -90, vy: (Math.random() - 0.5) * 20, life: 0.18, col: '#ff5500'
    });
  }
  car.prevGas = gas;

  if (nosOn) { state.nosCharge = Math.max(0, state.nosCharge - dt * 28); car.shake = 2.8; }
  else { state.nosCharge = Math.min(100, state.nosCharge + dt * 6); car.shake = Math.max(0, car.shake - dt * 15); }

  if (!car.done && state.health > 0) {
    if (gas > 0 || car.speed > 2) car.time += dt;

    const ratios = [3.45, 2.25, 1.62, 1.24, 0.98, 0.80].map(r => r / state.tuning.gear);
    const wheelRpm = 1000 + (Math.abs(car.speed) * 44) * ratios[car.gear - 1];
    car.rpm += (Math.max(1000 + gas * 2500, wheelRpm) - car.rpm) * Math.min(1, dt * 14);

    if (car.rpm > m.maxRpmLimit - 150 && car.gear < 6) {
      car.gear++;
      car.rpm = 5400;
      if (m.effBoost > 0.5) triggerBlowOffValve();
    }
    if (car.rpm < 4100 && car.gear > 1 && gas === 0) car.gear--;

    const idx = Math.min(m.curve.length - 1, Math.max(0, Math.floor((car.rpm - 1000) / 250)));
    const hpNow = m.curve[idx].hp + (nosOn ? state.tuning.nosPower : 0);
    const force = (hpNow / m.weight) * 215 * ratios[car.gear - 1];

    const camberAbs = Math.abs(state.tuning.camber);
    const straightCamberPenalty = 1 - camberAbs * 0.035;
    const cornerCamberBonus = 1 + camberAbs * 0.055;
    const avgTireT = (car.tireTemps[0] + car.tireTemps[1] + car.tireTemps[2] + car.tireTemps[3]) / 4;
    const tempGripMult = 0.85 + 0.22 * Math.exp(-Math.pow((avgTireT - 88) / 38, 2));

    let baseGrip = m.tir.tireGrip * m.trs.grip * tempGripMult;
    if (disc === 'rally') {
      baseGrip = m.tir.offroad * m.sus.offroad * (m.trs.awd ? 1.25 : 0.72);
    }

    const heatDelta = (gas * (m.effBoost * 6 + (state.tuning.afr - 12.5) * 8 + (nosOn ? 11 : 0))) - 4.8;
    state.oilTemp = Math.max(85, state.oilTemp + heatDelta * dt);
    if (state.oilTemp > 132 || m.overboost || m.leanRisk) {
      state.health = Math.max(0, state.health - dt * (gas * 6.5));
    }

    if (disc === 'drag') {
      const prevSpeed = car.speed;
      const launchGrip = baseGrip * straightCamberPenalty * (1 + Math.max(0, car.gLong) * 0.18);
      const accel = Math.min(force, launchGrip * 440);
      car.speed += (gas * accel - brake * 540 * m.brk.brakeMult - car.speed * m.aero.drag * 1.3) * dt;
      car.speed = Math.max(0, car.speed);

      car.gLong = ((car.speed - prevSpeed) / Math.max(0.001, dt)) / 240;
      car.gLat = 0;
      const targetPitch = -car.gLong * 0.045 * (1.3 - state.tuning.susp / 100);
      car.pitchAngle += (targetPitch - car.pitchAngle) * Math.min(1, dt * 10);

      car.tireTemps[2] = Math.min(130, car.tireTemps[2] + gas * dt * 12 - dt * 2.5);
      car.tireTemps[3] = Math.min(130, car.tireTemps[3] + gas * dt * 12 - dt * 2.5);
      car.tireTemps[0] = Math.max(45, car.tireTemps[0] + (car.speed * 0.02 - 1.5) * dt);
      car.tireTemps[1] = Math.max(45, car.tireTemps[1] + (car.speed * 0.02 - 1.5) * dt);

      car.dist += (car.speed * 0.28) * dt;

      if (gas > 0 || car.time > 0.1) {
        const rivalTime = state.activeEvent ? state.activeEvent.targetVal : 12.4;
        const rivalSpd = (402 / rivalTime) * (Math.min(1, car.time / 2.2) * 1.15);
        car.rivalDist += rivalSpd * dt;
      }

      if (nosOn) {
        car.particles.push({ x: 92, y: h * 0.56 + 26, vx: -180, vy: (Math.random() - 0.5) * 25, life: 0.25, col: '#00e5ff' });
      }

      if (car.dist >= 402) {
        const targetT = state.activeEvent ? state.activeEvent.targetVal : 12.4;
        handleEventOutcome(car.time <= targetT);
      }
    } else {
      const prevVx = car.vx, prevVy = car.vy;
      const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
      const rx = -fy, ry = fx;

      car.vx += fx * gas * force * 1.38 * dt;
      car.vy += fy * gas * force * 1.38 * dt;

      if (brake > 0) {
        car.vx *= (1 - dt * 3.6 * m.brk.brakeMult);
        car.vy *= (1 - dt * 3.6 * m.brk.brakeMult);
      }

      const latVel = car.vx * rx + car.vy * ry;
      const aeroDownforceGrip = (state.tuning.aero / 100) * (car.speed / 160) * 3.4 * m.aero.downforce;
      let latGrip = (disc === 'drift' ? 2.15 : 5.5) * baseGrip * m.sus.cornerMult * cornerCamberBonus + aeroDownforceGrip;
      if (hb) latGrip *= 0.20;

      car.vx -= rx * latVel * Math.min(1, latGrip * dt);
      car.vy -= ry * latVel * Math.min(1, latGrip * dt);

      const dragC = 0.44 + m.aero.drag * 0.5;
      car.vx *= (1 - dragC * dt);
      car.vy *= (1 - dragC * dt);

      const ax = (car.vx - prevVx) / Math.max(0.001, dt);
      const ay = (car.vy - prevVy) / Math.max(0.001, dt);
      car.gLong = (ax * fx + ay * fy) / 220;
      car.gLat = (ax * rx + ay * ry) / 220;

      car.speed = Math.hypot(car.vx, car.vy);
      const angleMult = m.sus.driftAngle || 1.0;
      const targetYawRate = steer * (disc === 'drift' ? 3.6 * m.trs.drift * angleMult : 2.95) * Math.min(1, car.speed / 50);
      car.angularVel += (targetYawRate - car.angularVel) * Math.min(1, dt * 12);
      car.angle += car.angularVel * dt;

      car.x += car.vx * dt;
      car.y += car.vy * dt;

      if (car.x < 24) car.x = w - 24;
      if (car.x > w - 24) car.x = 24;
      if (car.y < 145) car.y = h - 115;
      if (car.y > h - 115) car.y = 145;

      const slipMag = Math.abs(latVel);
      const loadLeft = Math.max(0, car.gLat);
      const loadRight = Math.max(0, -car.gLat);
      car.tireTemps[0] = Math.min(135, Math.max(45, car.tireTemps[0] + (slipMag * 0.08 * (1 + loadLeft) - 2.2) * dt));
      car.tireTemps[1] = Math.min(135, Math.max(45, car.tireTemps[1] + (slipMag * 0.08 * (1 + loadRight) - 2.2) * dt));
      car.tireTemps[2] = Math.min(135, Math.max(45, car.tireTemps[2] + (slipMag * 0.11 * (1 + loadLeft) + gas * 2.5 - 2.2) * dt));
      car.tireTemps[3] = Math.min(135, Math.max(45, car.tireTemps[3] + (slipMag * 0.11 * (1 + loadRight) + gas * 2.5 - 2.2) * dt));

      const isSliding = slipMag > 38 && car.speed > 60;
      const isApexFast = disc === 'circuit' && car.speed > 130;

      if (isSliding || isApexFast) {
        car.comboTimer = 2.2;
        car.combo = Math.min(5.0, car.combo + dt * 0.65);
        car.driftPts += Math.round((isSliding ? slipMag : car.speed * 0.65) * dt * 2.1 * car.combo);

        if (isSliding) {
          car.skids.push({ x: car.x - fx * 15 - rx * 8, y: car.y - fy * 15 - ry * 8, a: 0.55 });
          car.skids.push({ x: car.x - fx * 15 + rx * 8, y: car.y - fy * 15 + ry * 8, a: 0.55 });
          if (car.skids.length > 320) car.skids.splice(0, 2);
        }
        if (Math.random() < 0.5) {
          car.particles.push({
            x: car.x - fx * 20, y: car.y - fy * 20,
            vx: -fx * 30 + (Math.random() - 0.5) * 22,
            vy: -fy * 30 + (Math.random() - 0.5) * 22,
            life: 0.5,
            col: nosOn ? '#00e5ff' : (disc === 'rally' ? 'rgba(175,130,85,0.45)' : 'rgba(235,240,245,0.35)')
          });
        }
      } else {
        car.comboTimer -= dt;
        if (car.comboTimer <= 0) car.combo = 1.0;
      }

      const target = state.activeEvent ? state.activeEvent.targetVal : 3000;
      if (car.driftPts >= target) handleEventOutcome(true);
    }
  }

  const boostNow = gas * m.effBoost * Math.min(1, Math.max(0, (car.rpm - 2200) / 5500));
  updateEngineAudio(car.rpm, gas, boostNow, car.speed, nosOn);
  drawGForceMeter();
  updateTireTempUI();

  ctx.save();
  if (car.shake > 0) ctx.translate((Math.random() - 0.5) * car.shake, (Math.random() - 0.5) * car.shake);
  ctx.clearRect(0, 0, w, h);

  if (disc === 'drag') {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.56);
    sky.addColorStop(0, '#040609'); sky.addColorStop(1, '#121926');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    const roadY = h * 0.56;
    ctx.fillStyle = '#181e28'; ctx.fillRect(0, roadY - 36, w, 125);
    ctx.fillStyle = state.carColor; ctx.fillRect(0, roadY - 38, w, 3);

    const pxPerM = 17;
    const camX = car.dist * pxPerM;
    ctx.font = '700 10.5px "JetBrains Mono"';
    for (let dm = 0; dm <= 450; dm += 25) {
      const sx = 135 + dm * pxPerM - camX;
      if (sx > -60 && sx < w + 60) {
        const fin = dm === 400;
        ctx.fillStyle = fin ? '#ff5500' : 'rgba(255,255,255,0.15)';
        ctx.fillRect(sx, roadY - 36, fin ? 8 : 2, 125);
        ctx.fillStyle = fin ? '#ff5500' : '#8290a3';
        ctx.fillText(fin ? '402M FINISH' : dm + 'M', sx + 6, roadY - 20);
      }
    }

    const rivalX = 135 + (car.rivalDist - car.dist) * pxPerM;
    if (rivalX > -100 && rivalX < w + 100) {
      ctx.fillStyle = 'rgba(0, 229, 255, 0.35)';
      ctx.beginPath(); ctx.roundRect(rivalX - 44, roadY - 12, 88, 20, 5); ctx.fill();
      ctx.fillStyle = '#00e5ff'; ctx.font = '700 9.5px "Chakra Petch"';
      ctx.fillText('RYWAL', rivalX - 18, roadY - 18);
    }

    const cx = 135, cy = roadY + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 15, 50, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(car.pitchAngle);
    ctx.fillStyle = state.carColor;
    ctx.beginPath();
    ctx.moveTo(-46, 7); ctx.lineTo(-42, -11);
    ctx.lineTo(-16, -25); ctx.lineTo(14, -25);
    ctx.lineTo(46, -7); ctx.lineTo(48, 7);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#0a0e14';
    ctx.beginPath();
    ctx.moveTo(-14, -22); ctx.lineTo(12, -22);
    ctx.lineTo(25, -10); ctx.lineTo(-23, -10);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    [-28, 29].forEach(wx => {
      ctx.fillStyle = '#06080b';
      ctx.beginPath(); ctx.arc(cx + wx, cy + 8, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a0aec0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx + wx, cy + 8, 6, 0, Math.PI * 2); ctx.stroke();
    });
  } else {
    ctx.fillStyle = disc === 'rally' ? '#1c140e' : (disc === 'drift' ? '#090c12' : '#0c1118');
    ctx.fillRect(0, 0, w, h);

    const padX = Math.max(46, w * 0.14);
    const padY = 165;
    const trackW = Math.min(96, w * 0.22);

    ctx.strokeStyle = disc === 'rally' ? '#5e4026' : '#ff5500';
    ctx.lineWidth = trackW + 8;
    ctx.beginPath(); ctx.roundRect(padX, padY, w - padX * 2, Math.max(140, h - padY - 135), 75); ctx.stroke();

    ctx.strokeStyle = disc === 'rally' ? '#3d2a1c' : '#1a202b';
    ctx.lineWidth = trackW;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2; ctx.setLineDash([14, 16]); ctx.stroke(); ctx.setLineDash([]);

    car.skids.forEach(s => {
      ctx.fillStyle = disc === 'rally' ? `rgba(30,18,10,${s.a})` : `rgba(4,6,9,${s.a})`;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    });

    if (car.combo > 1.05) {
      ctx.fillStyle = 'var(--gold)';
      ctx.font = '800 13px "Chakra Petch"';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${car.combo.toFixed(1)}`, car.x, car.y - 24);
      ctx.textAlign = 'left';
    }

    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    const steerVisual = steer * 0.42;
    [-10, 10].forEach(wy => {
      ctx.save();
      ctx.translate(12, wy);
      ctx.rotate(steerVisual);
      ctx.fillStyle = '#07090c';
      ctx.fillRect(-4.5, -2.5, 9, 5);
      ctx.restore();
    });

    if (state.headlights) {
      const cone = ctx.createLinearGradient(18, 0, 130, 0);
      cone.addColorStop(0, 'rgba(0, 229, 255, 0.35)');
      cone.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath(); ctx.moveTo(18, -7); ctx.lineTo(130, -30); ctx.lineTo(130, 30); ctx.lineTo(18, 7); ctx.fill();
    }

    const rollShift = Math.max(-2.5, Math.min(2.5, car.gLat * 1.5));
    ctx.fillStyle = state.carColor;
    ctx.beginPath(); ctx.roundRect(-21, -10 + rollShift, 42, 20, 5); ctx.fill();
    ctx.fillStyle = '#090c10';
    ctx.fillRect(-6, -7.5 + rollShift, 15, 15);

    if (state.tuning.aero > 50 || state.selected.aero !== 'ae_stock') {
      ctx.fillStyle = '#111';
      ctx.fillRect(-23, -12 + rollShift, 4.5, 24);
    }
    ctx.restore();
  }

  for (let i = car.particles.length - 1; i >= 0; i--) {
    const p = car.particles[i];
    p.life -= dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || -20) * dt;
    if (p.life <= 0) { car.particles.splice(i, 1); continue; }
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, (1 - p.life) * 14 + 4, 0, Math.PI * 2); ctx.fill();
  }

  if (state.health <= 0 || car.done) {
    const blown = state.health <= 0;
    const bw = Math.min(340, w - 24);
    ctx.fillStyle = 'rgba(6, 8, 11, 0.94)';
    ctx.fillRect(w / 2 - bw / 2, h / 2 - 54, bw, 108);
    ctx.strokeStyle = blown ? '#ff1744' : '#00e676';
    ctx.lineWidth = 2;
    ctx.strokeRect(w / 2 - bw / 2, h / 2 - 54, bw, 108);

    ctx.textAlign = 'center';
    ctx.fillStyle = blown ? '#ff1744' : '#00e676';
    ctx.font = '800 13.5px "Chakra Petch"';
    ctx.fillText(blown ? 'AWARIA SILNIKA! PANEWKI ZNISZCZONE' : car.resultText, w / 2, h / 2 - 14);

    ctx.fillStyle = '#ffbe0b';
    ctx.font = '700 12px "JetBrains Mono"';
    ctx.fillText(blown ? 'Wróć do Garażu 3D (Remont lub Sponsor).' : car.rewardSummary, w / 2, h / 2 + 12);

    ctx.fillStyle = '#8290a3';
    ctx.font = '11px "Chakra Petch"';
    ctx.fillText('Stuknij ↺ RESET na dole, aby pojechać ponownie.', w / 2, h / 2 + 34);
    ctx.textAlign = 'left';
  }

  ctx.restore();

  const spd = Math.round(car.speed * (disc === 'drag' ? 2.1 : 0.85));
  document.getElementById('cl-speed').innerText = spd;
  document.getElementById('cl-gear').innerText = car.gear;
  document.getElementById('cl-rpm').innerText = Math.round(car.rpm) + ' RPM';
  document.getElementById('cl-boost').innerText = boostNow.toFixed(1) + ' BAR';
  document.getElementById('cl-nos-pct').innerText = Math.round(state.nosCharge) + '%';
  document.getElementById('cl-nos-bar').style.width = state.nosCharge + '%';
  document.getElementById('cl-oil').innerText = Math.round(state.oilTemp) + '°';
  document.getElementById('hdr-wear').innerText = Math.round(state.health) + '%';

  const lit = Math.round(Math.max(0, (car.rpm - 2400) / Math.max(2000, m.maxRpmLimit - 2400)) * 12);
  for (let i = 0; i < 12; i++) {
    const l = document.getElementById('led-' + i);
    l.className = 'led' + (i < lit ? (i < 5 ? ' g' : (i < 9 ? ' y' : ' r')) : '');
  }

  document.getElementById('race-timer-hud').innerText = disc === 'drag' ? `${car.time.toFixed(2)}s` : `${car.driftPts} PKT`;
  document.getElementById('race-dist-hud').innerText = disc === 'drag' ? `${Math.min(402, Math.round(car.dist))}/402m` : `COMBO x${car.combo.toFixed(1)}`;
  const goalVal = state.activeEvent ? state.activeEvent.targetVal : (disc === 'drag' ? '12.40s' : '3000 PKT');
  document.getElementById('race-goal-hud').innerText = `CEL: ${goalVal}`;
}

let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (state.view === 'garage') drawGarage(now, dt);
  else if (state.view === 'dyno') drawDyno(dt);
  else if (state.view === 'track') drawTrack(dt);

  requestAnimationFrame(loop);
}

renderGarageUI();
renderEventsAndBosses();
updateAll();
requestAnimationFrame(loop);
