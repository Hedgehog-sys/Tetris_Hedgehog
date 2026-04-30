// ===== MATRIX TETRIS - OPTIMIZED MOBILE VERSION =====
const Game = {
    canvas: null, ctx: null, nextCanvas: null, nextCtx: null,
    COLS: 10, ROWS: 20, BLOCK: 20,
    arena: null, player: null,
    highScore: 0, score: 0, lines: 0, level: 0, speedBase: 1000,
    paused: false, gameOver: false, lastTime: 0, dropCounter: 0,
    keys: {}, keyRepeat: {}, animId: null,
    
    pieces: {
        I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
        J: [[1,0,0],[1,1,1],[0,0,0]],
        L: [[0,0,1],[1,1,1],[0,0,0]],
        O: [[1,1],[1,1]],
        S: [[0,1,1],[1,1,0],[0,0,0]],
        T: [[0,1,0],[1,1,1],[0,0,0]],
        Z: [[1,1,0],[0,1,1],[0,0,0]]
    },
    pieceKeys: ['I','J','L','O','S','T','Z'],
    
    init() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.nextCanvas = document.getElementById('next');
        this.nextCtx = this.nextCanvas.getContext('2d', { alpha: false });
        this.ctx.scale(this.BLOCK, this.BLOCK);
        this.nextCtx.scale(this.BLOCK, this.BLOCK);
        
        this.highScore = +localStorage.getItem('mt_highscore') || 0;
        const savedSpeed = +localStorage.getItem('mt_speed');
        if (savedSpeed >= 0 && savedSpeed <= 10) {
            document.getElementById('startSpeed').value = savedSpeed;
        }
        this.updateUI();
        this.arena = this.createMatrix(this.COLS, this.ROWS);
        this.setupControls();
    },
    
    createMatrix(w, h) {
        const m = [];
        while (h--) m.push(new Array(w).fill(0));
        return m;
    },
    
    start() {
        const speedInput = parseInt(document.getElementById('startSpeed').value, 10);
        this.level = Math.max(0, Math.min(10, isNaN(speedInput) ? 0 : speedInput));
        localStorage.setItem('mt_speed', this.level);
        
        this.score = 0; this.lines = 0;        this.arena.forEach(row => row.fill(0));
        this.paused = false; this.gameOver = false;
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('pauseMsg').style.display = 'none';
        
        this.player = {
            matrix: null, next: this.randomPiece(),
            pos: {x: 0, y: 0}, landed: false
        };
        this.playerReset();
        this.lastTime = performance.now();
        this.dropCounter = 0;
        
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animId = requestAnimationFrame(t => this.update(t));
    },
    
    reset() {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.start();
    },
    
    randomPiece() {
        const key = this.pieceKeys[(Math.random() * this.pieceKeys.length) | 0];
        return this.pieces[key].map(row => [...row]);
    },
    
    playerReset() {
        this.player.matrix = this.player.next;
        this.player.next = this.randomPiece();
        this.player.pos.y = 0;
        this.player.pos.x = ((this.arena[0].length / 2) | 0) - ((this.player.matrix[0].length / 2) | 0);
        this.player.landed = false;
        
        if (this.collide(this.arena, this.player)) {
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('mt_highscore', this.highScore);
            }
            this.gameOver = true;
            document.getElementById('hs_overlay').textContent = this.highScore;
            document.getElementById('overlay').style.display = 'flex';
        }
    },
    
    collide(arena, player) {
        const [m, o] = [player.matrix, player.pos];
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0) {                    const nx = x + o.x, ny = y + o.y;
                    if (ny < 0) continue;
                    if (nx < 0 || nx >= arena[0].length || ny >= arena.length) return true;
                    if (arena[ny][nx] !== 0) return true;
                }
            }
        }
        return false;
    },
    
    merge(arena, player) {
        player.matrix.forEach((row, y) => {
            row.forEach((val, x) => {
                if (val !== 0) arena[y + player.pos.y][x + player.pos.x] = val;
            });
        });
        this.score += 10;
    },
    
    rotate(matrix) {
        const N = matrix.length;
        const result = Array.from({length: N}, () => Array(N).fill(0));
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                result[x][N - 1 - y] = matrix[y][x]; // По часовой
            }
        }
        while (result.length && result[0].every(v => v === 0)) result.shift();
        while (result.length && result.every(row => row[row.length-1] === 0)) {
            for (const row of result) row.pop();
        }
        return result;
    },
    
    playerRotate() {
        if (this.paused || this.gameOver || this.player.landed) return;
        const original = this.player.matrix.map(r => [...r]);
        this.player.matrix = this.rotate(this.player.matrix);
        
        let offset = 0;
        while (this.collide(this.arena, this.player)) {
            this.player.pos.x += offset > 0 ? -1 : 1;
            offset = -offset - (offset >= 0 ? 1 : 0);
            if (offset < -2) {
                this.player.matrix = original;
                return;
            }
        }
    },
        playerDrop() {
        if (this.paused || this.gameOver) return;
        this.player.pos.y++;
        if (this.collide(this.arena, this.player)) {
            this.player.pos.y--;
            this.merge(this.arena, this.player);
            this.player.landed = true;
            if (!this.arenaSweep()) this.playerReset();
        }
        this.dropCounter = 0;
    },
    
    playerHardDrop() {
        if (this.paused || this.gameOver) return;
        while (!this.collide(this.arena, this.player)) this.player.pos.y++;
        this.player.pos.y--;
        this.merge(this.arena, this.player);
        this.player.landed = true;
        if (!this.arenaSweep()) this.playerReset();
        this.dropCounter = 0;
    },
    
    playerMove(dir) {
        if (this.paused || this.gameOver || this.player.landed) return;
        this.player.pos.x += dir;
        if (this.collide(this.arena, this.player)) this.player.pos.x -= dir;
    },
    
    arenaSweep() {
        let cleared = 0;
        outer: for (let y = this.ROWS - 1; y >= 0; --y) {
            for (let x = 0; x < this.COLS; ++x) {
                if (this.arena[y][x] === 0) continue outer;
            }
            const row = this.arena.splice(y, 1)[0].fill(0);
            this.arena.unshift(row);
            ++y; ++cleared;
        }
        if (cleared > 0) {
            this.score += 100 * cleared * (this.level + 1);
            this.lines += cleared;
            const newLevel = (this.lines / 10) | 0;
            if (newLevel > this.level) this.level = newLevel;
            this.updateUI();
            return true;
        }
        return false;
    },
    
    updateUI() {        document.getElementById('score').textContent = this.score;
        document.getElementById('hs').textContent = this.highScore;
        const speedPct = 100 + this.level * 10;
        document.getElementById('speedVal').textContent = speedPct + '%';
        document.getElementById('speedPct').textContent = '+' + (this.level * 10) + '%';
    },
    
    drawGrid(ctx, w, h) {
        ctx.strokeStyle = 'rgba(0, 100, 0, 0.15)';
        ctx.lineWidth = 0.02;
        for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y <= h; y++) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    },
    
    drawMatrix(matrix, offset, ctx, isNext = false) {
        matrix.forEach((row, y) => {
            row.forEach((val, x) => {
                if (val !== 0) {
                    ctx.fillStyle = '#0f0';
                    ctx.fillRect(x + offset.x, y + offset.y, 0.92, 0.92);
                    if (!isNext) {
                        ctx.strokeStyle = 'rgba(0,255,0,0.3)';
                        ctx.strokeRect(x + offset.x, y + offset.y, 0.92, 0.92);
                    }
                }
            });
        });
    },
    
    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.COLS, this.ROWS);
        this.drawGrid(ctx, this.COLS, this.ROWS);
        
        if (Math.random() < 0.03) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.08)';
            ctx.font = '0.8px monospace';
            const x = (Math.random() * this.COLS) | 0;
            const y = (Math.random() * this.ROWS) | 0;
            ctx.fillText(String.fromCharCode(0x30A0 + (Math.random() * 96) | 0), x + 0.2, y + 0.8);
        }
        
        this.arena.forEach((row, y) => {
            row.forEach((val, x) => {
                if (val !== 0) {
                    ctx.fillStyle = '#0f0';
                    ctx.fillRect(x, y, 0.92, 0.92);
                    ctx.strokeStyle = 'rgba(0,255,0,0.4)';
                    ctx.strokeRect(x, y, 0.92, 0.92);                }
            });
        });
        
        if (this.player.matrix && !this.player.landed) {
            this.drawMatrix(this.player.matrix, this.player.pos, ctx);
        }
        
        const nctx = this.nextCtx;
        nctx.fillStyle = '#000';
        nctx.fillRect(0, 0, 4, 4);
        if (this.player.next) {
            const offX = (4 - this.player.next[0].length) / 2;
            const offY = (4 - this.player.next.length) / 2;
            this.drawMatrix(this.player.next, {x: offX, y: offY}, nctx, true);
        }
    },
    
    update(time = 0) {
        if (this.gameOver) return;
        const dt = time - this.lastTime;
        this.lastTime = time;
        
        if (!this.paused) {
            this.dropCounter += dt;
            const speed = Math.max(80, this.speedBase - this.level * 90);
            if (this.dropCounter > speed) this.playerDrop();
            this.draw();
        }
        this.animId = requestAnimationFrame(t => this.update(t));
    },
    
    togglePause() {
        if (this.gameOver) return;
        this.paused = !this.paused;
        document.getElementById('pauseMsg').style.display = this.paused ? 'block' : 'none';
    },
    
    setupControls() {
        document.addEventListener('keydown', e => {
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
                e.preventDefault();
                if (!this.keys[e.key]) {
                    this.keys[e.key] = true;
                    this.handleKey(e.key, true);
                    if (!this.keyRepeat[e.key]) {
                        this.keyRepeat[e.key] = setTimeout(() => {
                            if (this.keys[e.key]) {
                                this.keyRepeat[e.key] = setInterval(() => this.handleKey(e.key, false), 60);
                            }                        }, 150);
                    }
                }
            } else if (e.key === 'p' || e.key === 'P') this.togglePause();
              else if (e.key === 'r' || e.key === 'R') this.reset();
        });
        
        document.addEventListener('keyup', e => {
            if (this.keys[e.key]) {
                this.keys[e.key] = false;
                if (this.keyRepeat[e.key]) {
                    clearTimeout(this.keyRepeat[e.key]);
                    clearInterval(this.keyRepeat[e.key]);
                    delete this.keyRepeat[e.key];
                }
            }
        });
        
        document.querySelectorAll('.d-btn, .btn-rot').forEach(btn => {
            const action = btn.dataset.action;
            const start = (e) => {
                e.preventDefault();
                btn.classList.add('active');
                this.handleAction(action, true);
                if (['left','right','down'].includes(action)) {
                    this.keyRepeat[action] = setInterval(() => this.handleAction(action, false), 60);
                }
            };
            const end = (e) => {
                e?.preventDefault();
                btn.classList.remove('active');
                if (this.keyRepeat[action]) {
                    clearInterval(this.keyRepeat[action]);
                    delete this.keyRepeat[action];
                }
            };
            btn.addEventListener('touchstart', start, {passive: false});
            btn.addEventListener('touchend', end);
            btn.addEventListener('touchcancel', end);
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', end);
        });
    },
    
    handleKey(key, isFirst) {
        if (this.paused || this.gameOver) return;
        switch(key) {
            case 'ArrowLeft': this.playerMove(-1); break;
            case 'ArrowRight': this.playerMove(1); break;            case 'ArrowDown': if (isFirst) this.playerDrop(); break;
            case 'ArrowUp': if (isFirst) this.playerHardDrop(); break;
            case ' ': if (isFirst) this.playerRotate(); break;
        }
    },
    
    handleAction(action, isFirst) {
        if (this.paused || this.gameOver) return;
        switch(action) {
            case 'left': this.playerMove(-1); break;
            case 'right': this.playerMove(1); break;
            case 'down': if (isFirst) this.playerDrop(); break;
            case 'hardDrop': if (isFirst) this.playerHardDrop(); break;
            case 'rotate': if (isFirst) this.playerRotate(); break;
        }
    }
};

// 🔧 ИСПРАВЛЕНИЕ: делаем объект доступным для onclick="game.start()" в HTML
window.game = Game;

// Запуск при готовности DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Game.init());
} else {
    Game.init();
    }
