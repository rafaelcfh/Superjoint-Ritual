const BrewApp = {
    state: {
        running: false, isCountingDown: false, startTime: 0, elapsed: 0, stepIndex: 0, 
        activeRecipe: null, rafId: null, audioCtx: null, wakeLock: null,
        history: JSON.parse(localStorage.getItem('sj_history') || '[]'),
        batches: JSON.parse(localStorage.getItem('sj_batches') || '[]'),
        customRecipes: JSON.parse(localStorage.getItem('sj_custom') || '[]'),
        activeGrinder: localStorage.getItem('sj_grinder') || 'k6',
        favoriteId: localStorage.getItem('sj_fav') || 'hoff_v60',
        currentTasteValue: '0', 
        lastAlertSecond: -1,
        tempClicks: 0, tempTemp: 0, selectedBatchId: null
    },

    init() { 
        // Splash Screen Logic
        setTimeout(() => {
            const splash = document.getElementById('splash');
            if(splash) splash.classList.add('splash-hidden');
            UI.renderHome(); 
        }, 2200);

        document.addEventListener('visibilitychange', () => { 
            if (document.visibilityState === 'visible' && BrewApp.state.running) BrewApp.Utils.requestWakeLock(); 
        }); 
    },

    Grinders: {
        'k6': { name: 'Kingrinder K6', factor: 1.0 },
        'c40': { name: 'Comandante C40', factor: 0.33 },
        'tm_c3': { name: 'Timemore C3', factor: 0.18 },
        'tm_c2': { name: 'Timemore C2', factor: 0.23 },
        '1z_k': { name: '1Zpresso K-Ultra', factor: 0.90 },
        '1z_q2': { name: '1Zpresso Q2', factor: 0.60 },
        'k2': { name: 'Kingrinder K2', factor: 0.70 },
        'p1': { name: 'Kingrinder P1/P2', factor: 0.45 }
    },

    Timer: {
        loop() {
            if (!BrewApp.state.running) return;
            BrewApp.state.elapsed = (performance.now() - BrewApp.state.startTime) / 1000;
            this.update();
            BrewApp.state.rafId = requestAnimationFrame(() => this.loop());
        },
        update() {
            const { elapsed, activeRecipe: recipe, stepIndex } = BrewApp.state;
            const currentStep = recipe.steps[stepIndex];
            if(!currentStep) return;
            
            const weightRaw = BrewApp.Utils.simulateWeight(elapsed, recipe.steps);
            const weightClean = Math.round(weightRaw);
            const isPouring = (elapsed - currentStep.time) < (currentStep.pourTime || 10);

            document.getElementById('vGrams').innerHTML = `${weightClean}<small>g</small>`;
            document.getElementById('vTime').innerText = BrewApp.Utils.formatTime(elapsed);
            
            const badge = document.getElementById('status-badge');
            if (badge) {
                badge.innerText = isPouring ? "Despejar" : "Aguardar";
                isPouring ? badge.classList.remove('status-wait') : badge.classList.add('status-wait');
            }
            
            document.getElementById('vMetaStep').innerText = `${currentStep.target}g`;
            document.getElementById('vAddWater').innerText = `+${Math.max(0, currentStep.target - weightClean)}g`;

            const nextStep = recipe.steps[stepIndex + 1];
            if (nextStep) {
                const timeLeft = nextStep.time - elapsed;
                const roundedTime = Math.ceil(timeLeft);
                if (roundedTime <= 3 && roundedTime > 0 && BrewApp.state.lastAlertSecond !== roundedTime) {
                    BrewApp.state.lastAlertSecond = roundedTime;
                    BrewApp.Utils.beep(880, 0.1);
                }
                if (elapsed >= nextStep.time) { 
                    BrewApp.state.stepIndex++; BrewApp.state.lastAlertSecond = -1;
                    BrewApp.Utils.beep(1200, 0.3); UI.updateStepView(); 
                }
                document.getElementById('vNextStepTime').innerText = BrewApp.Utils.formatTime(nextStep.time - elapsed);
            } else {
                document.getElementById('vNextStepTime').innerText = "FIM";
            }

            const fill = document.getElementById('liquid-fill');
            if(fill) fill.style.height = `${Math.min((weightRaw / recipe.water) * 100, 100)}%`;
        }
    },

    Utils: {
        formatTime: s => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`,
        simulateWeight(elapsed, steps) {
            const idx = steps.findLastIndex(s => elapsed >= s.time);
            if (idx === -1 || elapsed <= 0) return 0;
            const current = steps[idx], prevTarget = idx > 0 ? steps[idx-1].target : 0, timeIn = elapsed - current.time;
            const pTime = current.pourTime || 10;
            if (pTime > 0 && timeIn < pTime) return prevTarget + (current.target - prevTarget) * (timeIn / pTime);
            return current.target;
        },
        beep(freq, duration) {
            try {
                if (!BrewApp.state.audioCtx) BrewApp.state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const ctx = BrewApp.state.audioCtx; if (ctx.state === 'suspended') ctx.resume();
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.type = 'sine'; osc.frequency.setValueAtTime(freq, ctx.currentTime);
                gain.gain.setValueAtTime(0, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(); osc.stop(ctx.currentTime + duration);
            } catch(e) {}
            if (navigator.vibrate) navigator.vibrate(50);
        },
        async requestWakeLock() {
            if ('wakeLock' in navigator) {
                try { BrewApp.state.wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
            }
        },
        releaseWakeLock() {
            if (BrewApp.state.wakeLock) { BrewApp.state.wakeLock.release().then(() => { BrewApp.state.wakeLock = null; }); }
        },
        getBaristaAdvice(taste) {
            if (taste === "-2" || taste === "-1") return `🍋 <b>Dica:</b> Ácido detectado. Moa <b>mais fino</b> na próxima.`;
            if (taste === "+1" || taste === "+2") return `🔥 <b>Dica:</b> Amargo detectado. Moa <b>mais grosso</b> na próxima.`;
            return "💎 <b>Equilíbrio Perfeito!</b>";
        },
        getFresheness(date) {
            if(!date) return { label: '-', class: 'f-dim', days: 0 };
            const diff = Math.floor((new Date() - new Date(date)) / 86400000);
            if(diff <= 6) return { label: 'Jovem', class: 'f-blue', days: diff };
            if(diff <= 25) return { label: 'Ápice', class: 'f-gold', days: diff };
            return { label: 'Antigo', class: 'f-dim', days: diff };
        },
        getExpertTip(batchId) {
            const batch = BrewApp.state.batches.find(b => b.id == batchId);
            if(!batch) return "Selecione um café.";
            const tip = batch.roast === 'clara' ? "💎 <b>Torra Clara:</b> Água 95°C." : (batch.roast === 'media' ? "⚖️ <b>Média:</b> Água 92°C." : "🍫 <b>Escura:</b> Água 89°C.");
            return tip;
        }
    }
};

const UI = {
    injectNav(active) {
        const nav = `<nav id="bottom-nav">
            <button class="nav-item ${active==='home'?'active':''}" onclick="UI.renderHome()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span>Home</span></button>
            <button class="nav-item ${active==='recipes'?'active':''}" onclick="UI.renderRecipes()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Métodos</span></button>
            <button class="nav-item ${active==='kit'?'active':''}" onclick="UI.renderKit()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 7h-9m3 3H7m14-3a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v2zM3 13h18v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z"/></svg><span>Meu Kit</span></button>
            <button class="nav-item ${active==='history'?'active':''}" onclick="UI.renderHistory()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span>Diário</span></button>
        </nav>`;
        document.getElementById('bottom-nav')?.remove();
        document.getElementById('app-wrapper').insertAdjacentHTML('beforeend', nav);
    },

    renderHome() {
        BrewApp.state.running = false; BrewApp.Utils.releaseWakeLock();
        const last = BrewApp.state.history[0];
        const all = [...InitialRecipes, ...BrewApp.state.customRecipes];
        const fav = all.find(r => r.id === BrewApp.state.favoriteId) || all[0];
        
        document.getElementById('screen').innerHTML = `
            <div style="padding:40px 20px 20px 20px; text-align:center">
                <svg style="width: 45px; height: 45px; margin-bottom: 10px;" viewBox="0 0 24 24" fill="none" stroke="#C9A227" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                    <line x1="6" y1="1" x2="6" y2="4"></line>
                    <line x1="10" y1="1" x2="10" y2="4"></line>
                    <line x1="14" y1="1" x2="14" y2="4"></line>
                </svg>
                <h1 style="margin-top:0; font-weight:300; letter-spacing:2px">SUPERJOINT</h1>
                <p style="color:var(--text-dim); font-size:0.7rem; margin-top:-10px">Domine seu café especial</p>
            </div>
            <div style="padding:0 15px">
                <span class="label">⭐ Favorita</span>
                <div class="card" onclick="UI.setupBrew('${fav.id}')" style="cursor:pointer; border-left:4px solid var(--gold); margin-bottom:20px">
                    <strong>${fav.name}</strong><br><small>Foco no equilíbrio</small>
                </div>
                ${last ? `<span class="label">🕒 Último Ritual</span><div class="card" onclick="UI.setupBrewByName('${last.recipe}')" style="cursor:pointer"><strong>${last.recipe}</strong><br><small>${last.date} • ${last.clicks} clks</small></div>` : ''}
            </div>`;
        this.injectNav('home');
    },

    setupBrewByName(name) {
        const r = [...InitialRecipes, ...BrewApp.state.customRecipes].find(x => x.name === name);
        if(r) this.setupBrew(r.id);
    },

    renderRecipes() {
        const all = [...InitialRecipes, ...BrewApp.state.customRecipes];
        let html = `<div style="padding:20px"><h3>Biblioteca</h3>`;
        ['V60', 'Espresso', 'Prensa Francesa', 'AeroPress', 'Imersão'].forEach(m => {
            const filtered = all.filter(r => r.method === m);
            if(filtered.length > 0) {
                html += `<div class="label" style="margin:20px 0 10px 5px; color:var(--gold)">☕ ${m}</div>`;
                html += filtered.map(r => `<div class="card" style="display:flex; justify-content:space-between; align-items:center" onclick="UI.setupBrew('${r.id}')">
                    <div style="flex:1"><strong>${r.name}</strong><br><small>Ratio 1:${r.ratio}</small></div>
                    <div style="display:flex; gap:10px">
                        ${r.id.startsWith('c_') ? `<button style="border:none; background:none; color:#e74c3c" onclick="event.stopPropagation(); UI.delRecipe('${r.id}')">✕</button>` : ''}
                        <button style="border:none; background:none; color:${BrewApp.state.favoriteId===r.id?'var(--gold)':'#333'}" onclick="event.stopPropagation(); UI.setFav('${r.id}')">★</button>
                    </div>
                </div>`).join('');
            }
        });
        document.getElementById('screen').innerHTML = html + `</div>`;
        this.injectNav('recipes');
    },

    setFav(id) { BrewApp.state.favoriteId = id; localStorage.setItem('sj_fav', id); UI.renderRecipes(); },

    renderKit() {
        const grinderOpts = Object.entries(BrewApp.Grinders).map(([id, g]) => `<option value="${id}" ${BrewApp.state.activeGrinder === id ? 'selected' : ''}>${g.name}</option>`).join('');
        document.getElementById('screen').innerHTML = `<div style="padding:20px"><h3>Meu Kit</h3><div class="card"><span class="label">Moedor</span><select id="selGrinder" onchange="UI.setGrinder(this.value)">${grinderOpts}</select></div><div class="card"><span class="label">Novo Grão</span><input id="nbName" placeholder="Nome"><input id="nbRoast" type="date"><select id="nbRoastType"><option value="media">Torra Média</option><option value="clara">Torra Clara</option><option value="escura">Torra Escura</option></select><input id="nbQty" type="number" placeholder="Gramas"><button class="btn-main-capsule" style="width:100%" onclick="UI.addBatch()">Salvar</button></div>${BrewApp.state.batches.map(b => { const f = BrewApp.Utils.getFresheness(b.date); return `<div class="card"><div style="display:flex; justify-content:space-between"><strong>${b.name}</strong><button onclick="UI.delBatch(${b.id})" style="background:none; border:none; color:#e74c3c">✕</button></div><div style="margin:5px 0"><span class="fresh-badge ${f.class}">${f.label}</span> <span class="fresh-badge f-dim">Torra ${b.roast || 'Média'}</span></div><small style="color:var(--gold)">${b.remaining}g restantes</small></div>`; }).join('')}</div>`;
        this.injectNav('kit');
    },

    setGrinder(id) { BrewApp.state.activeGrinder = id; localStorage.setItem('sj_grinder', id); },
    addBatch() { const n = document.getElementById('nbName').value, d = document.getElementById('nbRoast').value, q = parseInt(document.getElementById('nbQty').value) || 0, rt = document.getElementById('nbRoastType').value; if(n) { BrewApp.state.batches.unshift({id:Date.now(), name:n, date:d, roast:rt, initial:q, remaining:q}); localStorage.setItem('sj_batches', JSON.stringify(BrewApp.state.batches)); UI.renderKit(); } },
    delBatch(id) { if(confirm("Deletar lote?")) { BrewApp.state.batches = BrewApp.state.batches.filter(x=>x.id!==id); localStorage.setItem('sj_batches', JSON.stringify(BrewApp.state.batches)); UI.renderKit(); } },

    setupBrew(id) {
        const all = [...InitialRecipes, ...BrewApp.state.customRecipes];
        const r = JSON.parse(JSON.stringify(all.find(x => x.id === id))); BrewApp.state.activeRecipe = r;
        const grinder = BrewApp.Grinders[BrewApp.state.activeGrinder];
        const convClicks = Math.round(r.clicks * grinder.factor);
        const coffeeOpts = BrewApp.state.batches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        document.getElementById('screen').innerHTML = `<div style="padding:20px">
            <div style="text-align:center; margin-bottom:20px"><h3 style="margin:0">${r.name}</h3></div>
            <div style="display:flex; gap:10px; margin-bottom:15px"><div class="card" style="flex:1; margin:0; padding:10px; text-align:center"><span class="label">${grinder.name}</span><b>${convClicks} clks</b></div><div class="card" style="flex:1; margin:0; padding:10px; text-align:center"><span class="label">Temperatura</span><b>${r.temp}°C</b></div></div>
            <div class="card" style="margin:0 0 15px 0; border:1px solid var(--gold); background:rgba(201,162,39,0.05)"><span class="label" style="color:var(--gold)">Dica Especialista</span><p id="vExpertTip" style="font-size:0.8rem; margin:5px 0 0 0">Selecione um café.</p></div>
            <div class="card" style="margin:0"><span class="label">Dose de Café (g)</span><input type="number" id="inCoffee" value="18" oninput="UI.recalc(this.value)"><span class="label">Grão</span><select id="selBatch" onchange="UI.updateExpertTip(this.value)"><option value="">Avulso</option>${coffeeOpts}</select>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px"><div><span class="label">Ajustar Clicks</span><input type="number" id="inClicks" value="${convClicks}"></div><div><span class="label">Ajustar Temp</span><input type="number" id="inTemp" value="${r.temp}"></div></div>
                <div style="display:flex; justify-content:space-between; margin:10px 0; font-weight:700; color:var(--gold)"><span id="vWaterCalc">--</span><span id="vYieldCalc">Xícara: --</span></div>
                <div id="vStepsPreview" style="margin-top:10px"></div></div>
            <button class="btn-main-capsule" style="width:100%; margin-top:20px; border-radius:30px" onclick="UI.startTimer()">Iniciar Ritual</button></div>`;
        UI.recalc(18); this.injectNav('recipes');
    },

    updateExpertTip(id) { document.getElementById('vExpertTip').innerHTML = BrewApp.Utils.getExpertTip(id); },

    recalc(qty) {
        const dose = parseFloat(qty) || 18, r = BrewApp.state.activeRecipe;
        r.water = (r.method === "Espresso" || r.method === "AeroPress") ? Math.round(dose * r.ratio) : Math.round(dose * r.ratio / (1 - (2/r.ratio)));
        r.yield = (r.method === "Espresso" || r.method === "AeroPress") ? r.water : Math.round(r.water - (2 * dose));
        document.getElementById('vWaterCalc').innerText = `Água: ${r.water}g`; document.getElementById('vYieldCalc').innerText = `Xícara: ~${r.yield}g`;
        r.steps.forEach((s, idx) => s.target = idx === r.steps.length - 1 ? r.water : Math.round(r.water * (s.targetPct / 100)));
        
        // ROADMAP DETALHADO (AQUI ESTÁ O QUE TINHA SUMIDO)
        document.getElementById('vStepsPreview').innerHTML = r.steps.map(s => `
            <div style="padding:8px 0; border-bottom:1px solid #111">
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600">
                    <span>${BrewApp.Utils.formatTime(s.time)} • ${s.title}</span>
                    <span style="color:var(--gold)">${s.target}g</span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px">${s.tip}</div>
            </div>`).join('');
    },

    startTimer() {
        const r = BrewApp.state.activeRecipe; BrewApp.state.tempClicks = document.getElementById('inClicks').value;
        BrewApp.state.tempTemp = document.getElementById('inTemp').value; BrewApp.state.selectedBatchId = document.getElementById('selBatch').value;
        BrewApp.state.stepIndex = 0; BrewApp.state.elapsed = 0; BrewApp.state.running = false;
        
        document.getElementById('screen').innerHTML = `
            <div class="top-progress-container"><div id="top-progress-fill"></div></div>
            <div class="timer-container">
                <div class="zone-timer">
                    <div class="timer-circle">
                        <div id="countdown-overlay"><span id="countdown-number">3</span></div>
                        <div id="vStepTitle" class="circle-step-label">RITUAL</div>
                        <span id="vGrams">0<small>g</small></span>
                        <div id="vTime">0:00</div>
                        <div class="target-time-label">Alvo: ${BrewApp.Utils.formatTime(r.total || 0)}</div>
                        <div class="liquid-fill" id="liquid-fill"></div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; width:100%; gap:15px">
                    <div id="status-badge" class="status-badge">PRONTO</div>
                    <div class="step-dashboard">
                        <div class="step-info-box"><span class="lbl">Meta</span><span class="val" id="vMetaStep">${r.steps[0].target}g</span></div>
                        <div class="step-info-box" style="border-left:1px solid #111; border-right:1px solid #111"><span class="lbl">Add</span><span class="val" id="vAddWater">+${r.steps[0].target}g</span></div>
                        <div class="step-info-box"><span class="lbl">Tempo</span><span class="val" id="vNextStepTime">--</span></div>
                    </div>
                    <div id="vNextStepLabel" class="next-step-preview"></div>
                    <div id="vTip" class="timer-tip">Prepare-se...</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; width:100%; gap:5px">
                    <button id="btnCtrl" class="btn-main-capsule" onclick="UI.toggle()">Iniciar</button>
                    <div style="display:flex; gap:20px">
                        <button class="btn-secondary-text" onclick="UI.skipStep()">Pular</button>
                        <button class="btn-secondary-text" onclick="UI.finish()">Finalizar</button>
                    </div>
                </div>
            </div>`;
        UI.updateStepView();
    },

    toggle() {
        if(BrewApp.state.isCountingDown) return; const btn = document.getElementById('btnCtrl');
        if(BrewApp.state.running) { BrewApp.state.running = false; btn.innerText = "Continuar"; BrewApp.Utils.releaseWakeLock(); } 
        else {
            if (!BrewApp.state.audioCtx) BrewApp.state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = BrewApp.state.audioCtx; if (ctx.state === 'suspended') ctx.resume();
            BrewApp.Utils.requestWakeLock();
            if (BrewApp.state.elapsed === 0) { UI.runCountdown(() => { BrewApp.state.startTime = performance.now(); BrewApp.state.running = true; btn.innerText = "Pausar"; BrewApp.Timer.loop(); }); } 
            else { BrewApp.state.startTime = performance.now() - (BrewApp.state.elapsed * 1000); BrewApp.state.running = true; btn.innerText = "Pausar"; BrewApp.Timer.loop(); }
        }
    },

    runCountdown(onComplete) {
        BrewApp.state.isCountingDown = true; const overlay = document.getElementById('countdown-overlay'); const number = document.getElementById('countdown-number');
        overlay.style.display = 'flex'; let count = 3; number.innerText = count; BrewApp.Utils.beep(880, 0.1);
        const interval = setInterval(() => { count--; if (count > 0) { number.innerText = count; BrewApp.Utils.beep(880, 0.1); } else { clearInterval(interval); overlay.style.display = 'none'; BrewApp.state.isCountingDown = false; BrewApp.Utils.beep(1200, 0.4); onComplete(); } }, 1000);
    },

    skipStep() { const steps = BrewApp.state.activeRecipe.steps, next = steps[BrewApp.state.stepIndex + 1]; if (next) { BrewApp.state.stepIndex++; BrewApp.state.startTime = performance.now() - (next.time * 1000); BrewApp.state.elapsed = next.time; BrewApp.Timer.update(); UI.updateStepView(); } else { this.finish(); } },

    updateStepView() {
        const steps = BrewApp.state.activeRecipe.steps, s = steps[BrewApp.state.stepIndex], next = steps[BrewApp.state.stepIndex + 1];
        document.getElementById('vStepTitle').innerText = s.title; document.getElementById('vTip').innerText = s.tip;
        const progress = ((BrewApp.state.stepIndex + 1) / steps.length) * 100;
        const bar = document.getElementById('top-progress-fill'); if(bar) bar.style.width = `${progress}%`;
        if(next) { document.getElementById('vNextStepLabel').innerText = `PRÓXIMO: ${next.title} (${next.target}g)`; } else { document.getElementById('vNextStepLabel').innerText = "FINALIZANDO"; }
    },

    finish() {
        BrewApp.state.running = false; BrewApp.Utils.releaseWakeLock();
        document.getElementById('screen').innerHTML = `<div style="padding:40px 20px; text-align:center"><h2>Sabor?</h2>
            <div class="sensory-scale"><button class="circle-btn c-2" onclick="UI.setTaste('-2', this)"></button><button class="circle-btn c-1" onclick="UI.setTaste('-1', this)"></button><button class="circle-btn c0 active" onclick="UI.setTaste('0', this)"></button><button class="circle-btn c1" onclick="UI.setTaste('+1', this)"></button><button class="circle-btn c2" onclick="UI.setTaste('+2', this)"></button></div>
            <p id="vTasteLabel" style="color:var(--gold); font-weight:700; margin-bottom:10px; font-size:1.2rem">Equilibrado</p>
            <div id="vAdviceBox" style="font-size:0.9rem; color:var(--text-dim); background:#0a0a0a; padding:15px; border-radius:12px; min-height:60px; margin-bottom:20px; border:1px solid #111; line-height:1.4">Feedback do barista...</div>
            <textarea id="vNotes" placeholder="Anotações..." style="width:100%; height:80px; background:var(--card); border:1px solid var(--border); color:white; border-radius:8px; padding:10px; font-family:inherit; margin-bottom:20px"></textarea>
            <button class="btn-main-capsule" onclick="UI.saveHistory()">Salvar Ritual</button></div>`;
        setTimeout(() => UI.setTaste('0', document.querySelector('.circle-btn.c0')), 100);
    },

    setTaste(v, el) { 
        document.querySelectorAll('.circle-btn').forEach(b => b.classList.remove('active')); 
        el.classList.add('active'); BrewApp.state.currentTasteValue = v; 
        const labels = {"-2":"Muito Ácido", "-1":"Ácido", "0":"Equilibrado", "+1":"Amargo", "+2":"Muito Amargo"}; 
        document.getElementById('vTasteLabel').innerText = labels[v];
        document.getElementById('vAdviceBox').innerHTML = BrewApp.Utils.getBaristaAdvice(v);
    },

    saveHistory() {
        const r = BrewApp.state.activeRecipe, bId = BrewApp.state.selectedBatchId, clicks = BrewApp.state.tempClicks, temp = BrewApp.state.tempTemp;
        const advice = BrewApp.Utils.getBaristaAdvice(BrewApp.state.currentTasteValue);
        if(bId) { const b = BrewApp.state.batches.find(x => x.id == bId); if(b) { b.remaining = Math.max(0, b.remaining - r.coffee); localStorage.setItem('sj_batches', JSON.stringify(BrewApp.state.batches)); } }
        const original = InitialRecipes.find(x => x.id === r.id), grinder = BrewApp.Grinders[BrewApp.state.activeGrinder];
        if(original && (clicks != Math.round(original.clicks * grinder.factor) || temp != original.temp)) { const copy = {...original, id: 'c_'+Date.now(), name: `Ajuste: ${original.name}`, clicks: Math.round(clicks / grinder.factor), temp: parseInt(temp) }; BrewApp.state.customRecipes.push(copy); localStorage.setItem('sj_custom', JSON.stringify(BrewApp.state.customRecipes)); }
        const entry = { id: Date.now(), recipe: r.name, taste: document.getElementById('vTasteLabel').innerText, clicks, temp, time: BrewApp.Utils.formatTime(BrewApp.state.elapsed), date: new Date().toLocaleDateString(), notes: document.getElementById('vNotes').value, advice, yield: r.yield };
        BrewApp.state.history.unshift(entry); localStorage.setItem('sj_history', JSON.stringify(BrewApp.state.history.slice(0,50))); UI.renderHome();
    },

    delHistoryEntry(id) { if(confirm("Deletar registro?")) { BrewApp.state.history = BrewApp.state.history.filter(x=>x.id!==id); localStorage.setItem('sj_history', JSON.stringify(BrewApp.state.history)); UI.renderHistory(); } },
    renderHistory() {
        const list = BrewApp.state.history.map(h => `<div class="card"><div style="display:flex; justify-content:space-between"><strong>${h.taste}</strong><button onclick="UI.delHistoryEntry(${h.id})" style="background:none; border:none; color:#e74c3c">✕</button></div><small>${h.recipe} • ${h.clicks} clks • ${h.temp}°C • ${h.yield}g</small><p style="font-size:0.8rem; color:var(--text-dim); margin-top:8px">${h.notes || ''}</p>${h.advice ? `<p style="font-size:0.75rem; color:var(--gold); border-top:1px solid #111; margin-top:8px; padding-top:8px">${h.advice}</p>` : ''}</div>`).join('');
        document.getElementById('screen').innerHTML = `<div style="padding:20px"><h3>Diário</h3>${list || '<p>Sem registros.</p>'}</div>`; this.injectNav('history');
    },
    delRecipe(id) { if(confirm("Deletar personalizada?")) { BrewApp.state.customRecipes = BrewApp.state.customRecipes.filter(x=>x.id!==id); localStorage.setItem('sj_custom', JSON.stringify(BrewApp.state.customRecipes)); UI.renderRecipes(); } }
};

BrewApp.init();
