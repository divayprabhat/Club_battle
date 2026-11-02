export const ARENA_FORMS = ['ben', 'xlr8', 'alien3', 'alien4'];

export const ARENA_STATS = {
  ben: { name: 'Ben', speed: 245, damage: 24, cooldown: .28, maxHp: 100 },
  xlr8: { name: 'XLR8', speed: 390, damage: 16, cooldown: .12, maxHp: 82 },
  alien3: { name: 'Smash Alien', speed: 190, damage: 42, cooldown: .52, maxHp: 150 },
  alien4: { name: 'Tank Alien', speed: 155, damage: 30, cooldown: .36, maxHp: 220 },
};

export class Arena {
  constructor(canvas, { seed = 1, pixel = 1, onState = null } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onState = onState;
    this.seed = seed;
    this.pixel = Math.max(1, pixel);
    this.running = false;
    this.paused = false;
    this.status = 'ready';
    this.keys = {};
    this.pointer = { x: 0, y: 0, down: false };
    this.time = 0;
    this.spawnTimer = 0;
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.form = 'ben';
    this.maxHp = 100;
    this.hp = 100;
    this.charge = 0;
    this.attackTimer = 0;
    this.dashTimer = 0;
    this.invulnerable = 0;
    this.shotTimer = 0;
    this.player = { x: 0, y: 0, radius: 28, angle: 0 };
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.images = {};
    ARENA_FORMS.forEach(name => {
      const img = new Image();
      img.src = `${import.meta.env.BASE_URL}art/${name}.png`;
      this.images[name] = img;
    });
    this.emojiTargets = [];
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement || canvas);
  }

  resize() {
    const host = this.canvas.parentElement || this.canvas;
    const rect = host.getBoundingClientRect();
    this.w = Math.max(320, rect.width);
    this.h = Math.max(480, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.w * dpr / this.pixel);
    this.canvas.height = Math.floor(this.h * dpr / this.pixel);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(this.canvas.width / this.w, 0, 0, this.canvas.height / this.h, 0, 0);
    if (!this.player.x) { this.player.x = this.w / 2; this.player.y = this.h * .72; }
  }

  start() {
    if (this.status !== 'ready') return;
    this.status = 'playing';
    this.last = performance.now();
    this.running = true;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  pause(value) { this.paused = value; }

  setForm(form) {
    if (!ARENA_FORMS.includes(form) || form === this.form) return false;
    const oldRatio = this.hp / this.maxHp;
    this.form = form;
    const stats = ARENA_STATS[form];
    this.maxHp = stats.maxHp;
    this.hp = Math.max(35, stats.maxHp * oldRatio);
    for (let i = 0; i < 20; i++) this.spawnParticle(this.player.x, this.player.y, '#7dffd0');
    this.emit();
    return true;
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }

  addCharge(amount) {
    this.charge = Math.min(30, this.charge + amount);
    const tier = this.charge >= 30 ? 3 : this.charge >= 18 ? 2 : this.charge >= 8 ? 1 : 0;
    this.emit({ tier });
    return tier;
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(.033, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!this.paused) this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    if (this.status !== 'playing') return;
    this.time += dt;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shotTimer = Math.max(0, this.shotTimer - dt);
    this.wave = 1 + Math.floor(this.time / 18);
    this.spawnTimer -= dt;

    if (this.spawnTimer <= 0) {
      const count = 1 + Math.floor(this.wave / 3);
      for (let i = 0; i < count; i++) this.spawnEnemy();
      const interval = Math.max(.32, 1.15 - this.wave * .09);
      this.spawnTimer = interval * (.75 + Math.random() * .5);
    }

    let dx = 0, dy = 0;
    if (this.keys.ArrowLeft || this.keys.KeyA) dx--;
    if (this.keys.ArrowRight || this.keys.KeyD) dx++;
    if (this.keys.ArrowUp || this.keys.KeyW) dy--;
    if (this.keys.ArrowDown || this.keys.KeyS) dy++;
    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      const stats = ARENA_STATS[this.form];
      const dash = this.dashTimer > 0 ? 1.55 : 1;
      this.player.x = Math.max(45, Math.min(this.w - 45, this.player.x + dx / length * stats.speed * dash * dt));
      this.player.y = Math.max(120, Math.min(this.h - 45, this.player.y + dy / length * stats.speed * dash * dt));
    }
    this.player.angle = Math.atan2(this.pointer.y - this.player.y, this.pointer.x - this.player.x);

    if ((this.pointer.down || this.keys.Space) && this.attackTimer <= 0) this.attack();

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0 || p.x < -30 || p.x > this.w + 30 || p.y < -30 || p.y > this.h + 30) {
        this.projectiles.splice(i, 1);
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + 8) {
          this.damageEnemy(e, p.damage, p.vx, p.vy);
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;
      e.hitFlash = Math.max(0, (e.hitFlash || 0) - dt);
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < e.radius + this.player.radius) {
        if (e.attackTimer <= 0) {
          this.damagePlayer(e.damage);
          e.attackTimer = e.boss ? 0.8 : 1.05;
        }
        e.attackTimer -= dt;
      } else {
        e.attackTimer -= dt;
      }
      if (e.hp <= 0) this.enemies.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vx *= .98; p.vy *= .98;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.hp <= 0 && this.status === 'playing') {
      this.status = 'lost';
      this.running = false;
      this.emit();
    } else if (Math.random() < dt * .6) this.emit();
  }

  spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * this.w; y = 115; }
    if (side === 1) { x = this.w + 30; y = 140 + Math.random() * (this.h - 180); }
    if (side === 2) { x = Math.random() * this.w; y = this.h + 30; }
    if (side === 3) { x = -30; y = 140 + Math.random() * (this.h - 180); }
    const boss = this.wave % 5 === 0 && this.enemies.length === 0 && Math.random() < .35;
    const hp = boss ? 280 + this.wave * 18 : 48 + this.wave * 7;
    this.enemies.push({
      x, y, hp, maxHp: hp, radius: boss ? 48 : 24 + Math.random() * 8,
      speed: (boss ? 48 : 72 + this.wave * 8) * (.75 + Math.random() * .35),
      damage: boss ? 32 : 10 + this.wave * 2, boss, attackTimer: 0, hitFlash: 0,
    });
  }

  attack() {
    const stats = ARENA_STATS[this.form];
    this.attackTimer = stats.cooldown;
    const angle = this.player.angle;
    if (this.form === 'alien3') {
      this.projectiles.push({ x: this.player.x + Math.cos(angle) * 45, y: this.player.y + Math.sin(angle) * 45, vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620, life: .22, damage: 42, heavy: true });
      return;
    }
    if (this.form === 'alien4') {
      for (const spread of [-.22, 0, .22]) {
        const a = angle + spread;
        this.projectiles.push({ x: this.player.x + Math.cos(a) * 38, y: this.player.y + Math.sin(a) * 38, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 1.4, damage: 22 });
      }
      return;
    }
    if (this.form === 'xlr8') {
      this.dashTimer = .3;
      this.projectiles.push({ x: this.player.x, y: this.player.y, vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720, life: .28, damage: 14 });
    } else {
      this.projectiles.push({ x: this.player.x + Math.cos(angle) * 34, y: this.player.y + Math.sin(angle) * 34, vx: Math.cos(angle) * 610, vy: Math.sin(angle) * 610, life: 1.4, damage: 24 });
    }
  }

  dash() {
    if (this.form === 'xlr8') this.dashTimer = .55;
  }

  damageEnemy(enemy, damage, vx = 0, vy = 0) {
    enemy.hp -= damage;
    enemy.hitFlash = .12;
    enemy.x += vx * .018;
    enemy.y += vy * .018;
    for (let i = 0; i < 5; i++) this.spawnParticle(enemy.x, enemy.y, '#ff7ac8');
    if (enemy.hp <= 0) {
      this.score += enemy.boss ? 1500 : 100;
      this.kills++;
      this.addCharge(enemy.boss ? 5 : 1);
      if (this.kills % 4 === 0) this.heal(enemy.boss ? 30 : 8);
      for (let i = 0; i < (enemy.boss ? 28 : 12); i++) this.spawnParticle(enemy.x, enemy.y, enemy.boss ? '#7dffd0' : '#ffd24a');
    }
  }

  damagePlayer(amount) {
    if (this.invulnerable > 0) return;
    const armor = this.form === 'alien4' ? .55 : 1;
    this.hp -= amount * armor;
    this.invulnerable = this.form === 'alien4' ? .18 : .7;
    for (let i = 0; i < 10; i++) this.spawnParticle(this.player.x, this.player.y, '#ff3d7f');
    this.emit();
  }

  spawnParticle(x, y, color) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 220;
    this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .4 + Math.random() * .5, color });
  }

  emit(extra = {}) {
    if (!this.onState) return;
    this.onState({ status: this.status, hp: Math.max(0, this.hp), maxHp: this.maxHp, score: this.score, kills: this.kills, wave: this.wave, charge: this.charge, form: this.form, ...extra });
  }

  stop() {
    this.running = false;
    this.observer?.disconnect();
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#171126';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.fillStyle = '#0d0a18';
    ctx.fillRect(0, 0, this.w, 110);
    ctx.fillStyle = '#22183a';
    for (let i = 0; i < this.w; i += 44) ctx.fillRect(i, 62 + (i % 88 === 0 ? 8 : 0), 36, 48);
    ctx.fillStyle = '#2d2542';
    ctx.fillRect(0, this.h - 100, this.w, 100);
    ctx.strokeStyle = '#5b4d72';
    ctx.lineWidth = 4;
    for (let y = this.h - 80; y < this.h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke(); }

    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : e.boss ? '#8b1f36' : '#24202f';
      ctx.strokeStyle = e.boss ? '#ff5c7a' : '#ff9a2e';
      ctx.lineWidth = e.boss ? 8 : 4;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7dffd0';
      ctx.beginPath(); ctx.ellipse(-e.radius * .28, -4, 7, 4, 0, 0, Math.PI * 2); ctx.ellipse(e.radius * .28, -4, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (e.hp < e.maxHp) {
        ctx.fillStyle = '#120c1f';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 14, e.radius * 2, 7);
        ctx.fillStyle = '#ff5c7a';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 14, e.radius * 2 * Math.max(0, e.hp / e.maxHp), 7);
      }
    }

    ctx.fillStyle = '#7dffd0';
    for (const p of this.projectiles) { ctx.beginPath(); ctx.arc(p.x, p.y, p.heavy ? 13 : 7, 0, Math.PI * 2); ctx.fill(); }
    for (const p of this.particles) { ctx.globalAlpha = Math.max(0, p.life * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.globalAlpha = this.invulnerable > 0 && Math.floor(this.time * 16) % 2 ? .35 : 1;
    const img = this.images[this.form];
    const size = this.form === 'alien4' ? 92 : this.form === 'alien3' ? 84 : 78;
    if (img?.complete) ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();

    ctx.restore();
  }
}
