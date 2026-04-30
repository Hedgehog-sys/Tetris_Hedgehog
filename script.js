(function() {
    'use strict';
    const Game = {
        canvas: null, ctx: null, nextCanvas: null, nextCtx: null,
        COLS: 10, ROWS: 20, BLOCK: 20,
        arena: [], player: null,
        highScore: 0, score: 0, lines: 0, level: 0,
        paused: false, gameOver: false, lastTime: 0, dropCounter: 0,
        inputIntervals: {}, loopId: null,
        
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
        bgChars: [],

        init() {
            this.canvas = document.getElementById('game');
            this.ctx = this.canvas.getContext('2d', { alpha: false });
            this.nextCanvas = document.getElementById('next');
            this.nextCtx = this.nextCanvas.getContext('2d', { alpha: false });
            this.ctx.scale(this.BLOCK, this.BLOCK);
            this.nextCtx.scale(this.BLOCK, this.BLOCK);

            this.highScore = +(localStorage.getItem('mt_highscore') || 0);
            const saved = +(localStorage.getItem('mt_speed') || 0);
            document.getElementById('startSpeed').value = isNaN(saved) ? 0 : saved;
            this.updateUI();
            
            this.arena = Array.from({length: this.ROWS}, () => Array(this.COLS).fill(0));
            this.setupBg();
            this.setupControls();
            this.loop = this.loop.bind(this);
        },

        setupBg() {
            // Лёгкий матричный фон без нагрузки на процессор
            this.bgChars = Array.from({length: 15}, () => ({
                x: Math.random() * this.COLS,
                y: Math.random() * this.ROWS,
                speed: 0.5 + Math.random() * 1.5,
                char: String.fromCharCode(0x30A0 + (Math.random() * 96) | 0)
            }));
        },
        start() {
            const val = parseInt(document.getElementById('startSpeed').value, 10);
            this.level = Math.max(0, Math.min(10, isNaN(val) ? 0 : val));
            localStorage.setItem('mt_speed', this.level);

            this.score = 0; this.lines = 0;
            this.arena.forEach(r => r.fill(0));
            this.paused = false; this.gameOver = false;
            document.getElementById('overlay').style.display = 'none';
            document.getElementById('pauseMsg').style.display = 'none';

            this.player = { matrix: null, next: this.randomPiece(), pos: {x:0, y:0} };
            this.playerReset();
            this.lastTime = performance.now();
            this.dropCounter = 0;
            if (this.loopId) cancelAnimationFrame(this.loopId);
            this.loopId = requestAnimationFrame(this.loop);
        },

        reset() {
            if (this.loopId) cancelAnimationFrame(this.loopId);
            this.start();
        },

        randomPiece() {
            const k = this.pieceKeys[(Math.random() * this.pieceKeys.length) | 0];
            return this.pieces[k].map(r => [...r]);
        },

        playerReset() {
            this.player.matrix = this.player.next;
            this.player.next = this.randomPiece();
            this.player.pos.y = 0;
            this.player.pos.x = ((this.COLS / 2) | 0) - ((this.player.matrix[0].length / 2) | 0);

            if (this.collide(this.arena, this.player)) {
                this.player.pos.y = -1; // Спрятать фигуру
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    localStorage.setItem('mt_highscore', this.highScore);
                }
                this.gameOver = true;
                document.getElementById('hs_overlay').textContent = this.highScore;
                document.getElementById('overlay').style.display = 'flex';
            }
        },

        collide(arena, p) {
            const [m, o] = [p.matrix, p.pos];            for (let y = 0; y < m.length; y++) {
                for (let x = 0; x < m[y].length; x++) {
                    if (m[y][x] !== 0) {
                        const nx = x + o.x, ny = y + o.y;
                        if (ny < 0) continue;
                        if (nx < 0 || nx >= this.COLS || ny >= this.ROWS || arena[ny][nx] !== 0) return true;
                    }
                }
            }
            return false;
        },

        merge(arena, p) {
            p.matrix.forEach((row, y) => row.forEach((v, x) => {
                if (v !== 0) arena[y + p.pos.y][x + p.pos.x] = v;
            }));
            this.score += 10;
        },

        rotate(matrix) {
            const N = matrix.length;
            const res = Array.from({length: N}, () => Array(N).fill(0));
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) res[x][N-1-y] = matrix[y][x];
            // Обрезаем пустые строки/столбцы
            while (res.length && res[0].every(v => !v)) res.shift();
            while (res.length && res.every(r => r[r.length-1] === 0)) res.forEach(r => r.pop());
            return res;
        },

        playerRotate() {
            if (this.paused || this.gameOver) return;
            const orig = this.player.matrix.map(r => [...r]);
            this.player.matrix = this.rotate(this.player.matrix);
            const origX = this.player.pos.x;
            // Проверка отступов (wall kick)
            for (const k of [0, -1, 1, -2, 2]) {
                this.player.pos.x = origX + k;
                if (!this.collide(this.arena, this.player)) return;
            }
            this.player.matrix = orig;
            this.player.pos.x = origX;
        },

        playerDrop() {
            if (this.paused || this.gameOver) return;
            this.player.pos.y++;
            if (this.collide(this.arena, this.player)) {
                this.player.pos.y--;
                this.merge(this.arena, this.player);
                this.arenaSweep();                this.playerReset();
            }
            this.dropCounter = 0;
        },

        playerHardDrop() {
            if (this.paused || this.gameOver) return;
            while (!this.collide(this.arena, this.player)) this.player.pos.y++;
            this.player.pos.y--;
            this.merge(this.arena, this.player);
            this.arenaSweep();
            this.playerReset();
            this.dropCounter = 0;
        },

        playerMove(dir) {
            if (this.paused || this.gameOver) return;
            this.player.pos.x += dir;
            if (this.collide(this.arena, this.player)) this.player.pos.x -= dir;
        },

        arenaSweep() {
            let cleared = 0;
            for (let y = this.ROWS - 1; y >= 0; y--) {
                if (this.arena[y].every(v => v !== 0)) {
                    this.arena.splice(y, 1);
                    this.arena.unshift(Array(this.COLS).fill(0));
                    cleared++;
                    y++; // Проверить ту же строку снова
                }
            }
            if (cleared > 0) {
                this.score += 100 * cleared * (this.level + 1);
                this.lines += cleared;
                const newLvl = (this.lines / 10) | 0;
                if (newLvl > this.level) this.level = newLvl;
                this.updateUI();
            }
        },

        updateUI() {
            document.getElementById('score').textContent = this.score;
            document.getElementById('hs').textContent = this.highScore;
            const pct = 100 + this.level * 10;
            document.getElementById('speedVal').textContent = pct + '%';
            document.getElementById('speedPct').textContent = '+' + (this.level * 10) + '%';
        },

        drawGrid(ctx) {
            ctx.strokeStyle = 'rgba(0, 80, 0, 0.25)';            ctx.lineWidth = 0.03;
            for (let x = 0; x <= this.COLS; x++) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.ROWS); ctx.stroke(); }
            for (let y = 0; y <= this.ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.COLS,y); ctx.stroke(); }
        },

        drawBlock(ctx, x, y, isNext=false) {
            ctx.fillStyle = '#0f0';
            ctx.fillRect(x+0.04, y+0.04, 0.92, 0.92);
            if (!isNext) {
                ctx.strokeStyle = 'rgba(0,255,0,0.4)';
                ctx.strokeRect(x+0.04, y+0.04, 0.92, 0.92);
            }
        },

        loop(time=0) {
            if (this.gameOver) return;
            const dt = time - this.lastTime;
            this.lastTime = time;

            if (!this.paused) {
                this.dropCounter += dt;
                const speed = Math.max(80, 1000 - this.level * 90);
                if (this.dropCounter > speed) this.playerDrop();

                // Фон и отрисовка
                const ctx = this.ctx;
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, this.COLS, this.ROWS);
                this.drawGrid(ctx);
                
                // Лёгкие символы матрицы
                ctx.font = '0.7px monospace';
                ctx.fillStyle = 'rgba(0,255,0,0.06)';
                this.bgChars.forEach(c => {
                    c.y += c.speed * (dt / 16);
                    if (c.y > this.ROWS) { c.y = 0; c.x = Math.random() * this.COLS; c.char = String.fromCharCode(0x30A0 + (Math.random() * 96) | 0); }
                    ctx.fillText(c.char, c.x, c.y);
                });

                // Застывшие блоки
                this.arena.forEach((row, y) => row.forEach((v, x) => { if(v) this.drawBlock(ctx, x, y); }));
                // Активная фигура
                if (this.player.matrix) this.player.matrix.forEach((row, y) => row.forEach((v, x) => { if(v) this.drawBlock(ctx, x+this.player.pos.x, y+this.player.pos.y); }));
                
                // Next
                const nctx = this.nextCtx;
                nctx.fillStyle = '#000'; nctx.fillRect(0,0,4,4);
                if (this.player.next) {
                    const ox = (4 - this.player.next[0].length)/2;
                    const oy = (4 - this.player.next.length)/2;                    this.player.next.forEach((row, y) => row.forEach((v, x) => { if(v) this.drawBlock(nctx, x+ox, y+oy, true); }));
                }
            }
            this.loopId = requestAnimationFrame(this.loop);
        },

        togglePause() {
            if (this.gameOver) return;
            this.paused = !this.paused;
            document.getElementById('pauseMsg').style.display = this.paused ? 'block' : 'none';
        },

        handleAction(action, isInit) {
            if (this.gameOver) return;
            switch(action) {
                case 'left': this.playerMove(-1); break;
                case 'right': this.playerMove(1); break;
                case 'down': if (isInit) this.playerDrop(); break;
                case 'hardDrop': if (isInit) this.playerHardDrop(); break;
                case 'rotate': if (isInit) this.playerRotate(); break;
            }
        },

        setupControls() {
            // Клавиатура
            const keyMap = {ArrowLeft:'left', ArrowRight:'right', ArrowDown:'down', ArrowUp:'hardDrop', ' ':'rotate'};
            document.addEventListener('keydown', e => {
                if (keyMap[e.key]) {
                    e.preventDefault();
                    if (!this.inputIntervals[e.key]) {
                        this.handleAction(keyMap[e.key], true);
                        this.inputIntervals[e.key] = setTimeout(() => {
                            this.inputIntervals[e.key] = setInterval(() => this.handleAction(keyMap[e.key], false), 50);
                        }, 170);
                    }
                } else if (e.key === 'p' || e.key === 'P') this.togglePause();
                  else if (e.key === 'r' || e.key === 'R') this.reset();
            });
            document.addEventListener('keyup', e => {
                if (this.inputIntervals[e.key]) { clearTimeout(this.inputIntervals[e.key]); clearInterval(this.inputIntervals[e.key]); delete this.inputIntervals[e.key]; }
            });

            // Тач/Мышь
            document.querySelectorAll('.d-btn, .btn-rot').forEach(btn => {
                const act = btn.dataset.action;
                const start = e => { e.preventDefault(); btn.classList.add('active'); this.handleAction(act, true); this.inputIntervals[act] = setInterval(() => this.handleAction(act, false), 60); };
                const end = e => { e?.preventDefault(); btn.classList.remove('active'); if (this.inputIntervals[act]) { clearInterval(this.inputIntervals[act]); delete this.inputIntervals[act]; } };
                btn.addEventListener('touchstart', start, {passive:false});
                btn.addEventListener('touchend', end); btn.addEventListener('touchcancel', end);
                btn.addEventListener('mousedown', start); btn.addEventListener('mouseup', end); btn.addEventListener('mouseleave', end);            });
        }
    };

    window.game = Game;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Game.init());
    else Game.init();
})();
