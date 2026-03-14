const BrewApp = {
    state: {
        running: false, startTime: 0, elapsed: 0, stepIndex: 0, 
        activeRecipe: null, rafId: null, wakeLock: null,
        history: JSON.parse(localStorage.getItem('sj_history') || '[]'),
        batches: JSON.parse(localStorage.getItem('sj_batches') || '[]'),
        customRecipes: JSON.parse(localStorage.getItem('sj_custom') || '[]'),
        lastSettings: JSON.parse(localStorage.getItem('sj_last_settings') || '{}'),
        currentTasteValue: '0'
    },

    init() { UI.renderHome(); },

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
            const weight = BrewApp.Utils.simulateWeight(elapsed, recipe.steps);
            const isPouring = (elapsed - currentStep.time) < (currentStep.pourTime || 10);

            document.getElementById('vGrams').innerHTML = `${Math.floor(weight)}<small>g</small>`;
            document.getElementById('vTime').innerText = BrewApp.Utils.formatTime(elapsed);
            
            const badge = document.getElementById('status-badge');
            if (badge) {
                if (isPouring) { badge.innerText = "Despejar"; badge.classList.remove('status-wait'); }
                else { badge.innerText = "Aguardar"; badge.classList.add('status-wait'); }
            }

            document.getElementById('vMetaStep').innerText = `${currentStep.target}g`;
            document.getElementById('vAddWater').innerText = `+${Math.max(0, currentStep.target - Math.floor(weight))}g`;

            const nextStep = recipe.steps[stepIndex + 1];
            if (nextStep) {
                if (elapsed >= nextStep.time) { BrewApp.state.stepIndex++; BrewApp.Utils.alert(); UI.updateStepView(); }
                document.getElementById('vNextStepTime').innerText = BrewApp.Utils.formatTime(nextStep.time - elapsed);
            } else { document.getElementById('vNextStepTime').innerText = "FIM"; }
            
            const fill = document.getElementById('liquid-fill');
            if(fill) fill.style.height = `${Math.min((weight / recipe.water) * 100, 100)}%`;
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
        vibrate: p => navigator.vibrate && navigator.vibrate(p),
        async requestWakeLock() { if ('wakeLock' in navigator) { try { BrewApp.state.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} } },
        releaseWakeLock() { if (BrewApp.state.wakeLock) { BrewApp.state.wakeLock.release(); BrewApp.state.wakeLock = null; } },
        alert() { const b = document.getElementById('beep'); b && b.play().catch(()=>{}); this.vibrate([200, 100, 200]); }
    }
};

const UI = {
    injectNav(active) {
        const nav = `<nav id="bottom-nav">
            <button class="nav-item ${active==='home'?'active':''}" onclick="UI.renderHome()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span>Home</span></button>
            <button class="nav-item ${active==='recipes'?'active':''}" onclick="UI.renderRecipes()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Métodos</span></button>
            <button class="nav-item ${active==='batches'?'active':''}" onclick="UI.renderBatches()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 8V21H3V8M1 3H23V8H1V3ZM10 12H14"/></svg><span>Grãos</span></button>
            <button class="nav-item ${active==='history'?'active':''}" onclick="UI.renderHistory()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span>Diário</span></button>
        </nav>`;
        const old = document.getElementById('bottom-nav'); if(old) old.remove();
        document.getElementById('app-wrapper').insertAdjacentHTML('beforeend', nav);
    },

    renderHome() {
        BrewApp.state.running = false;
        document.getElementById('screen').innerHTML = `<div style="padding:40px 20px"><h1>Superjoint Ritual</h1><p style="color:var(--text-dim)">“Aperfeiçoe seu ritual do café.”</p></div>
            <div class="card" onclick="UI.setupBrew('signature_v60')" style="cursor:pointer; border-left:4px solid var(--gold)">
                <span class="label">Signature</span><div style="font-size:1.3rem; font-weight:700; margin:10px 0">Ritual V60 (300ml)</div>
            </div>`;
        this.injectNav('home');
    },

    renderRecipes() {
        const all = [...InitialRecipes, ...BrewApp.state.customRecipes];
        document.getElementById('screen').innerHTML = `<div style="padding:20px"><h3>Biblioteca</h3>
            <button class="btn-main-capsule" style="width:100%; height:45px; margin-bottom:20px" onclick="UI.renderCreator()">+ Nova Receita</button>
            ${all.map(r => `<div class="card" style="display:flex; justify-content:space-between; align-items:center" onclick="UI.setupBrew('${r.id}')">
                <div><strong>${r.name}</strong><br><small style="color:var(--text-dim)">Ratio 1:${r.ratio}</small></div>
                ${r.id.startsWith('c_') ? `<button style="border:none; background:none; color:#e74c3c" onclick="event.stopPropagation(); UI.delRecipe('${r.id}')">✕</button>` : ''}
            </div>`).join('')}</div>`;
        this.injectNav('recipes');
    },

    renderBatches() {
        document.getElementById('screen').innerHTML = `<div style="padding:20px"><h3>Lotes</h3>
            <div class="card"><span class="label">Novo Grão</span><input id="nbName" placeholder="Nome"><input id="nbRoast" type="date"><textarea id="nbNotes" placeholder="Anotações..."></textarea><button class="btn-main-capsule" style="width:100%; height:45px" onclick="UI.addBatch()">Salvar</button></div>
            ${BrewApp.state.batches.map(b => `<div class="card"><div style="display:flex; justify-content:space-between"><strong>${b.name}</strong><button style="border:none; background:none; color:var(--text-dim)" onclick="UI.delBatch(${b.id})">✕</button></div><small style="color:var(--gold)">Torra: ${b.date}</small><p style="font-size:0.8rem; color:var(--text-dim)">${b.notes || ''}</p></div>`).join('')}</div>`;
        this.injectNav('batches');
    },

    addBatch() {
        const n = document.getElementById('nbName').value, d = document.getElementById('nbRoast').value, nt = document.getElementById('nbNotes').value;
        if(n) { BrewApp.state.batches.unshift({id:Date.now(), name:n, date:d, notes:nt}); localStorage.setItem('sj_batches', JSON.stringify(BrewApp.state.batches)); UI.renderBatches(); }
    },

    delBatch(id) { if(confirm("Remover grão?")) { BrewApp.state.batches = BrewApp.state.batches.filter(b=>b.id!==id); localStorage.setItem('sj_batches', JSON.stringify(BrewApp.state.batches)); UI.renderBatches(); } },
    delRecipe(id) { if(confirm("Remover receita?")) { BrewApp.state.customRecipes = BrewApp.state.customRecipes.filter(r=>r.id!==id); localStorage.setItem('sj_custom', JSON.stringify(BrewApp.state.customRecipes)); UI.renderRecipes(); } },

    renderHistory() {
        const list = BrewApp.state.history.map(h => `<div class="card" style="display:flex; justify-content:space-between; align-items:center"><div><strong>${h.taste}</strong><br><small>${h.recipe}</small></div><div style="text-align:right"><b>${h.time}</b><br><small>${h.clicks}clks</small></div></div>`).join('');
        document.getElementById('screen').innerHTML = `<div style="padding:20px"><h3>Diário</h3>${list || '<p style="padding:20px; color:var(--text-dim)">Sem registros.</p>'}</div>`;
        this.injectNav('history');
    },

    setupBrew(id) {
        const all = [...InitialRecipes, ...BrewApp.state.customRecipes];
        const r = JSON.parse(JSON.stringify(all.find(x => x.id === id))); BrewApp.state.activeRecipe = r;
        
        // Memória de Barista: Carrega últimos parâmetros
        const last = BrewApp.state.lastSettings[id] || { clicks: r.clicks, temp: r.temp, time: '--' };
        const coffeeOpts = BrewApp.state.batches.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
        
        document.getElementById('screen').innerHTML = `<div style="padding:20px">
            <div class="card" style="border-color:var(--gold); background:rgba(201,162,39,0.05); margin-bottom:15px">
                <span class="label" style="color:var(--gold)">Dial-In Assistant</span>
                <p id="vAssistantTip" style="font-size:0.9rem; margin-top:10px; line-height:1.4">Último preparo: ${last.time} com ${last.clicks}clks.</p>
            </div>
            <div class="card" style="margin:0">
                <span class="label">Volume Final (ml)</span><input type="number" id="inYield" value="300" oninput="UI.recalc(this.value)">
                <span class="label">Grão</span><select id="selBatch"><option value="Avulso">Avulso</option>${coffeeOpts}</select>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px">
                    <div><span class="label">K6 Clicks</span><input type="number" id="inClicks" value="${last.clicks}" oninput="UI.updateAssistantTip()"></div>
                    <div><span class="label">Temp (°C)</span><input type="number" id="inTemp" value="${last.temp}" oninput="UI.updateAssistantTip()"></div>
                </div>
                <div style="display:flex; justify-content:space-between; margin:10px 0; font-weight:700"><span id="vDoseCalc">--</span><span id="vWaterCalc">--</span></div>
                <div class="preview-list" id="vStepsPreview"></div>
            </div>
            <button class="btn-main-capsule" style="width:100%; margin-top:20px" onclick="UI.startTimer()">Iniciar Ritual</button></div>`;
        UI.recalc(300);
        UI.injectNav('recipes');
    },

    updateAssistantTip() {
        const id = BrewApp.state.activeRecipe.id;
        const last = BrewApp.state.lastSettings[id];
        if(!last) return;

        const currentC = parseInt(document.getElementById('inClicks').value);
        const currentT = parseInt(document.getElementById('inTemp').value);
        let msg = "";

        if (currentC < last.clicks) msg = "👉 Moagem mais fina: aumenta a extração e o corpo, mas pode amargar.";
        else if (currentC > last.clicks) msg = "👉 Moagem mais grossa: aumenta a clareza e acidez, fluxo mais rápido.";
        
        if (currentT > last.temp) msg += " <br>🔥 Temperatura alta extrai mais doçura rapidamente.";
        else if (currentT < last.temp) msg += " <br>❄️ Temperatura baixa preserva notas delicadas e evita amargor.";

        if (currentC == last.clicks && currentT == last.temp) msg = `Mantendo os mesmos parâmetros da última extração (${last.time}).`;

        document.getElementById('vAssistantTip').innerHTML = msg;
    },

    recalc(ml) {
        const yieldML = parseFloat(ml) || 300, r = BrewApp.state.activeRecipe;
        r.water = Math.round(yieldML / (1 - 2/r.ratio)); r.coffee = Math.round(r.water / r.ratio);
        document.getElementById('vDoseCalc').innerText = `Pó: ${r.coffee}g`;
        document.getElementById('vWaterCalc').innerText = `Água: ${r.water}g`;
        r.steps.forEach(s => s.target = Math.round(r.water * s.targetPct));
        const preview = r.steps.map(s => `<div class="preview-item"><span>${s.title}</span><span>${s.target}g • ${BrewApp.Utils.formatTime(s.time)}</span></div>`).join('');
        document.getElementById('vStepsPreview').innerHTML = `<span class="label">Mapa de Preparo</span>` + preview;
    },

    startTimer() {
        const r = BrewApp.state.activeRecipe;
        r.clicks = document.getElementById('inClicks').value; r.temp = document.getElementById('inTemp').value;
        BrewApp.state.stepIndex = 0; BrewApp.state.elapsed = 0; BrewApp.state.running = false;
        document.getElementById('screen').innerHTML = `<div class="timer-container">
            <div style="text-align:center; padding-top:10px"><div id="vStepCount" class="label">Etapa 1</div><div id="vStepTitle" style="font-weight:700; font-size:1.2rem">Ritual</div></div>
            <div class="zone-timer"><div class="timer-circle"><div class="status-container"><div id="status-badge" class="status-badge">Pronto</div></div><div class="liquid-fill" id="liquid-fill"></div><div style="display:flex; flex-direction:column; align-items:center; z-index:10"><span id="vGrams">0<small>g</small></span><div id="vTime">0:00</div><div class="target-ref">Alvo: ${BrewApp.Utils.formatTime(r.total)}</div></div></div></div>
            <div class="step-dashboard">
                <div class="step-info-box"><span class="lbl">Meta</span><span class="val" id="vMetaStep">--</span></div>
                <div class="step-info-box" style="border-left:1px solid #111; border-right:1px solid #111"><span class="lbl">Add</span><span class="val" id="vAddWater">--</span></div>
                <div class="step-info-box"><span class="lbl">Próximo</span><span class="val" id="vNextStepTime">--</span></div>
            </div>
            <div style="text-align:center; padding:0 40px; min-height:60px"><p id="vTip" style="font-size:0.8rem; color:var(--text-dim); margin:0">Toque em Iniciar.</p><div id="vNextStep" class="next-up"></div></div>
            <div style="padding-bottom:20px; display:flex; flex-direction:column; align-items:center; gap:10px">
                <button id="btnCtrl" class="btn-main-capsule" onclick="UI.toggle()">Iniciar</button>
                <div style="display:flex; gap:40px"><button class="btn-secondary-text" onclick="UI.skipStep()">Pular</button><button class="btn-secondary-text" onclick="UI.finish()">Finalizar</button></div>
            </div></div>`;
        UI.updateStepView();
    },

    toggle() {
        const btn = document.getElementById('btnCtrl');
        if(BrewApp.state.running) { BrewApp.state.running = false; btn.innerText = "Continuar"; BrewApp.Utils.releaseWakeLock(); }
        else { document.getElementById('beep').play().catch(()=>{}); BrewApp.state.startTime = performance.now() - (BrewApp.state.elapsed * 1000); BrewApp.state.running = true; btn.innerText = "Pausar"; BrewApp.Timer.loop(); BrewApp.Utils.requestWakeLock(); }
    },

    skipStep() {
        const next = BrewApp.state.activeRecipe.steps[BrewApp.state.stepIndex + 1];
        if (next) { BrewApp.state.startTime = performance.now() - (next.time * 1000); } else { this.finish(); }
    },

    updateStepView() {
        const steps = BrewApp.state.activeRecipe.steps, s = steps[BrewApp.state.stepIndex], next = steps[BrewApp.state.stepIndex + 1];
        document.getElementById('vStepCount').innerText = `Etapa ${BrewApp.state.stepIndex + 1} de ${steps.length}`;
        document.getElementById('vStepTitle').innerText = s.title; document.getElementById('vTip').innerText = s.tip;
        if(next) document.getElementById('vNextStep').innerText = `A SEGUIR: ${next.title} (${next.target}g)`;
        else document.getElementById('vNextStep').innerText = "A SEGUIR: FINALIZAR";
    },

    finish() {
        BrewApp.state.running = false; BrewApp.Utils.releaseWakeLock();
        document.getElementById('screen').innerHTML = `<div style="padding:40px 20px; text-align:center"><h2>Sabor?</h2>
            <div class="sensory-scale"><button class="circle-btn c-2" onclick="UI.setTaste('-2', this)"></button><button class="circle-btn c-1" onclick="UI.setTaste('-1', this)"></button><button class="circle-btn c0 active" onclick="UI.setTaste('0', this)"></button><button class="circle-btn c1" onclick="UI.setTaste('+1', this)"></button><button class="circle-btn c2" onclick="UI.setTaste('+2', this)"></button></div>
            <p id="vTasteLabel" style="color:var(--gold); font-weight:700">Equilibrado</p><button class="btn-main-capsule" style="margin-top:40px" onclick="UI.saveHistory()">Salvar</button></div>`;
        BrewApp.state.currentTasteValue = '0';
    },

    setTaste(v, el) { document.querySelectorAll('.circle-btn').forEach(b => b.classList.remove('active')); el.classList.add('active'); BrewApp.state.currentTasteValue = v;
        const labels = {"-2":"Muito Ácido", "-1":"Ácido", "0":"Equilibrado", "+1":"Amargo", "+2":"Muito Amargo"}; document.getElementById('vTasteLabel').innerText = labels[v];
    },

    saveHistory() {
        const r = BrewApp.state.activeRecipe, labels = {"-2":"🍋 M. Ácido", "-1":"🍋 Ácido", "0":"💎 OK", "+1":"🔥 Amargo", "+2":"🔥 M. Amargo"};
        const timeStr = BrewApp.Utils.formatTime(BrewApp.state.elapsed);
        
        // Salva memória de Barista para a próxima vez
        BrewApp.state.lastSettings[r.id] = { clicks: r.clicks, temp: r.temp, time: timeStr };
        localStorage.setItem('sj_last_settings', JSON.stringify(BrewApp.state.lastSettings));

        BrewApp.state.history.unshift({ recipe: r.name, taste: labels[BrewApp.state.currentTasteValue], clicks: r.clicks, temp: r.temp, time: timeStr, date: new Date().toLocaleDateString() });
        localStorage.setItem('sj_history', JSON.stringify(BrewApp.state.history.slice(0,50))); UI.renderHome();
    },

    renderCreator() {
        document.getElementById('screen').innerHTML = `<div style="padding:20px"><h3>Criar Ritual</h3><div class="card">
            <span class="label">Nome</span><input id="cnName"><span class="label">Ratio Base</span><input type="number" id="cnRatio" value="17">
            <div id="stepCreatorList"><div class="step-edit-card"><span class="label">Etapa 1</span><input placeholder="Título" class="st" value="Bloom"><input placeholder="Segundos" type="number" class="si" value="0"><input placeholder="% Água (ex: 0.18)" type="number" class="sp" value="0.18"></div></div>
            <button class="btn-secondary-text" style="color:var(--gold); margin-bottom:20px" onclick="UI.addStepField()">+ Passo</button>
            <button class="btn-main-capsule" style="width:100%" onclick="UI.saveCustom()">Salvar</button></div></div>`;
        this.injectNav('recipes');
    },

    addStepField() {
        const count = document.querySelectorAll('.step-edit-card').length + 1;
        document.getElementById('stepCreatorList').insertAdjacentHTML('beforeend', `<div class="step-edit-card"><span class="label">Etapa ${count}</span><input placeholder="Título" class="st"><input placeholder="Segundos" type="number" class="si"><input placeholder="% Água" type="number" class="sp"></div>`);
    },

    saveCustom() {
        const name = document.getElementById('cnName').value, ratio = parseFloat(document.getElementById('cnRatio').value);
        const steps = Array.from(document.querySelectorAll('.step-edit-card')).map(el => ({ time: parseInt(el.querySelector('.si').value), title: el.querySelector('.st').value, targetPct: parseFloat(el.querySelector('.sp').value), tip: "Personalizado", pourTime: 10 }));
        if(name) { BrewApp.state.customRecipes.push({ id:'c_'+Date.now(), name, ratio, temp:94, clicks:85, total:steps[steps.length-1].time + 60, steps });
        localStorage.setItem('sj_custom', JSON.stringify(BrewApp.state.customRecipes)); UI.renderRecipes(); }
    }
};

BrewApp.init();