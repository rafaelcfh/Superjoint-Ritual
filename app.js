const BrewApp = {
    state: {
        running: false, startTime: 0, elapsed: 0, stepIndex: 0, 
        activeRecipe: null, rafId: null, wakeLock: null,
        history: JSON.parse(localStorage.getItem('sj_history') || '[]'),
        batches: JSON.parse(localStorage.getItem('sj_batches') || '[]'),
        customRecipes: JSON.parse(localStorage.getItem('sj_custom') || '[]'),
        lastSettings: JSON.parse(localStorage.getItem('sj_last_settings') || '{}'),
        activeGrinder: localStorage.getItem('sj_grinder') || 'k6',
        favoriteId: localStorage.getItem('sj_fav') || 'hoff_v60',
        currentTasteValue: '0',
        tempClicks: 0, tempTemp: 0 // Cache para garantir o salvamento
    },

    init() { UI.renderHome(); },

    Grinders: {
        'k6': { name: 'Kingrinder K6', factor: 1.0 },
        'k4': { name: 'Kingrinder K4', factor: 1.0 },
        'k2': { name: 'Kingrinder K2', factor: 0.85 },
        'p1': { name: 'Kingrinder P1/P2', factor: 0.50 },
        'c40': { name: 'Comandante C40', factor: 0.26 }
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
            const weight = BrewApp.Utils.simulateWeight(elapsed, recipe.steps);
            const isPouring = (elapsed - currentStep.time) < (currentStep.pourTime || 10);

            document.getElementById('vGrams').innerHTML = `${Math.floor(weight)}<small>g</small>`;
            document.getElementById('vTime').innerText = BrewApp.Utils.formatTime(elapsed);
            
            const badge = document.getElementById('status-badge');
            if (badge) {
                badge.innerText = isPouring ? "Despejar" : "Aguardar";
                isPouring ? badge.classList.remove('status-wait') : badge.classList.add('status-wait');
            }
            document.getElementById('vMetaStep').innerText = `${currentStep.target}g`;
            document.getElementById('vAddWater').innerText = `+${Math.max(0, currentStep.target - Math.floor(weight))}g`;

            const nextStep = recipe.steps[stepIndex + 1];
            if (nextStep && elapsed >= nextStep.time) { 
                BrewApp.state.stepIndex++; BrewApp.Utils.alert(); UI.updateStepView(); 
            }
            if (nextStep) document.getElementById('vNextStepTime').innerText = BrewApp.Utils.formatTime(nextStep.time - elapsed);
            
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
        getDialInAdvice(taste, elapsed, targetTotal, method) {
            if (taste === "-2" || taste === "-1") return "🍋 <b>Dica:</b> Sub-extraído. Moa mais fino.";
            if (taste === "+1" || taste === "+2") return "🔥 <b>Dica:</b> Sobre-extraído. Moa mais grosso.";
            if (taste === "0") return "💎 <b>Ritual Perfeito.</b>";
            return "";
        },
        getFresheness(date) {
            if(!date) return {label:'-', class:'f-dim'};
            const diff = Math.floor((new Date() - new Date(date)) / 86400000);
            if(diff <= 3) return {label:'Descansando', class:'f-blue'};
            if(diff <= 21) return {label:'Ideal', class:'f-gold'};
            return {label:'Antigo', class:'f-dim'};
        },
        alert() { const b = document.getElementById('beep'); b && b.play().catch(()=>{}); navigator.vibrate && navigator.vibrate([200, 100, 200]); }
    }
};

const UI = {
    injectNav(active) {
        const nav = `<nav id="bottom-nav">
            <button class="nav-item ${active==='home'?'active':''}" onclick="UI.renderHome()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span>Home</span></button>
            <button class="nav-item ${active==='recipes'?'active':''}" onclick="UI.renderRecipes()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Métodos</span></button>
            <button class="nav-item ${active==='kit'?'active':''}" onclick="UI.renderKit()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 7h-9m3 3H7m14-3a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v2zM3 13h18v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z"/></svg><span>Kit</span></button>
            <button class="nav-item ${active==='history'?'active':''}" onclick="UI.renderHistory()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span>Diário</span></button>
        </nav>`;
        const old = document.getElementById('bottom-nav'); if(old) old.remove();
        document.getElementById('app-wrapper').insertAdjacentHTML('beforeend', nav);
    },

    renderHome() {
        const last = BrewApp.state.history[0];
        const all = [...InitialRecipes, ...BrewApp.state.customRecipes];
        const fav = all.find(r => r.id === BrewApp.state.favoriteId) || all[0];
        document.getElementById('screen').innerHTML = `<div style="padding:40px 20px"><h1>Superjoint Ritual</h1><p style="color:var(--text-dim)">“Aperfeiçoe seu ritual.”</p></div>
            <div style="padding:0 15px">
                <span class="label">⭐ Favorita</span>
                <div class="card" onclick="UI.setupBrew('${fav.id}')" style="cursor:pointer; border-left:4px solid var(--gold); margin-bottom:20px">
                    <strong>${fav.name}</strong><br><small>${fav.method} • Ratio 1:${fav.ratio}</small>
                </div>
                ${last ? `<span class="label">🕒 Último Ritual</span><div class="card" onclick="UI.setupBrewByName('${last.recipe}')" style="cursor:pointer"><strong>${last.recipe}</strong><br><small>${last.date} • ${last.time}</small></div>` : ''}
            </div>`;
        this.injectNav('home');
    },

    setupBrewByName(name) {
        const r = [...InitialRecipes, ...BrewApp.state.customRecipes].find(x => x.name === name);
        if(r) this.setupBrew(r.id);
    },

    renderRecipes() {
        const all = [...InitialRecipes, ...BrewApp.state.customRecipes];
        const methods = ['V60', 'Espresso', 'Prensa Francesa'];
        let html = `<div style="padding:20px"><h3>Biblioteca</h3>`;
        methods.forEach(m => {
            const filtered = all.filter(r => r.method === m);
            if(filtered.length > 0) {
                html += `<div class="label" style="margin:20px 0 10px 5px; color:var(--gold)">☕ ${m}</div>`;
                html += filtered.map(r => `<div class="card" style="display:flex; justify-content:space-between; align-items:center" onclick="UI.setupBrew('${r.id}')">
                    <div><strong>${r.name}</strong><br><small>Ratio 1:${r.ratio}</small></div>
                    <button style="border:none; background:none; color:${BrewApp.state.favoriteId===r.id?'var(--gold)':'#333'}" onclick="event.stopPropagation(); UI.setFav('${r.id}')">★</button>
                </div>`).join('');
            }
        });
        document.getElementById('screen').innerHTML = html + `</div>`;
        this.injectNav('recipes');
    },

    setFav(id) { BrewApp.state.favoriteId = id; localStorage.setItem('sj_fav', id); UI.renderRecipes(); },

    renderKit() {
        const grinderOpts = Object.entries(BrewApp.Grinders).map(([id, g]) => 
            `<option value="${id}" ${BrewApp.state.activeGrinder === id ? 'selected' : ''}>${g.name}</option>`
        ).join('');
        document.getElementById('screen').innerHTML = `<div style="padding:20px"><h3>Meu Kit</h3>
            <div class="card" style="border-color:var(--gold)"><span class="label">Moedor Ativo</span><select id="selGrinder" onchange="UI.setGrinder(this.value)">${grinderOpts}</select></div>
            <div class="card"><span class="label">Novo Grão</span><input id="nbName" placeholder="Nome"><input id="nbRoast" type="date"><input id="nbQty" type="number" placeholder="Gramas"><button class="btn-main-capsule" style="width:100%" onclick="UI.addBatch()">Salvar</button></div>
            ${BrewApp.state.batches.map(b => `<div class="card"><div style="display:flex; justify-content:space-between"><strong>${b.name}</strong><button style="border:none; background:none; color:var(--text-dim)" onclick="UI.delBatch(${b.id})">✕</button></div><span class="fresh-badge ${BrewApp.Utils.getFresheness(b.date).class}">${BrewApp.Utils.getFresheness(b.date).label}</span><br><small style="color:var(--gold)">${b.remaining}g restantes</small></div>`).join('')}</div>`;
        this.injectNav('kit');
    },

    setGrinder(id) { BrewApp.state.activeGrinder = id; localStorage.setItem('sj_grinder', id); },
    addBatch() {
        const n = document.getElementById('nbName').value, d = document.getElementById('nbRoast').value, q = parseInt(document.getElementById('nbQty').value) || 0;
        if(n) { BrewApp.state.batches.unshift({id:Date.now(), name:n, date:d, initial:q, remaining:q}); localStorage.setItem('sj_batches', JSON.stringify(BrewApp.state.batches)); UI.renderKit(); }
    },
    delBatch(id) { if(confirm("Deletar lote?")) { BrewApp.state.batches = BrewApp.state.batches.filter(x=>x.id!==id); localStorage.setItem('sj_batches', JSON.stringify(BrewApp.state.batches)); UI.renderKit(); } },

    setupBrew(id) {
        const all = [...InitialRecipes, ...BrewApp.state.customRecipes];
        const r = JSON.parse(JSON.stringify(all.find(x => x.id === id))); BrewApp.state.activeRecipe = r;
        const grinder = BrewApp.Grinders[BrewApp.state.activeGrinder];
        const convClicks = Math.round(r.clicks * grinder.factor);
        const coffeeOpts = BrewApp.state.batches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        
        document.getElementById('screen').innerHTML = `<div style="padding:20px">
            <div style="display:flex; gap:10px; margin-bottom:15px">
                <div class="card" style="flex:1; margin:0; padding:10px; text-align:center"><span class="label">${grinder.name}</span><b>${convClicks} clks</b></div>
                <div class="card" style="flex:1; margin:0; padding:10px; text-align:center"><span class="label">Temperatura</span><b>${r.temp}°C</b></div>
            </div>
            <div class="card" style="margin:0">
                <span class="label">Dose de Café (g)</span><input type="number" id="inCoffee" value="18" oninput="UI.recalcByCoffee(this.value)">
                <span class="label">Lote</span><select id="selBatch"><option value="">Avulso</option>${coffeeOpts}</select>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px">
                    <div><span class="label">Ajustar Clicks</span><input type="number" id="inClicks" value="${convClicks}"></div>
                    <div><span class="label">Ajustar Temp</span><input type="number" id="inTemp" value="${r.temp}"></div>
                </div>
                <div style="display:flex; justify-content:space-between; margin:10px 0; font-weight:700; color:var(--gold)"><span id="vWaterCalc">--</span><span id="vYieldCalc">Xícara: --</span></div>
                <div class="preview-list" id="vStepsPreview"></div>
            </div>
            <button class="btn-main-capsule" style="width:100%; margin-top:20px" onclick="UI.startTimer()">Iniciar Ritual</button></div>`;
        UI.recalcByCoffee(18);
        this.injectNav('recipes');
    },

    recalcByCoffee(qty) {
        const dose = parseFloat(qty) || 18, r = BrewApp.state.activeRecipe;
        r.coffee = dose;
        r.water = r.method === "Espresso" ? Math.round(dose * r.ratio) : Math.round(dose * r.ratio / (1 - (2/r.ratio)));
        const yieldQty = r.method === "Espresso" ? r.water : Math.round(r.water - (2 * dose));
        r.yield = yieldQty;

        document.getElementById('vWaterCalc').innerText = `Total Água: ${r.water}g`;
        document.getElementById('vYieldCalc').innerText = `Na Xícara: ~${yieldQty}g`;
        
        r.steps.forEach(s => s.target = Math.round(r.water * s.targetPct));
        document.getElementById('vStepsPreview').innerHTML = `<span class="label">Mapa</span>` + r.steps.map(s => `<div class="preview-item"><span>${s.title}</span><span>${s.target}g</span></div>`).join('');
    },

    startTimer() {
        const r = BrewApp.state.activeRecipe;
        // Salva os valores de ajuste no state antes de trocar a tela
        BrewApp.state.tempClicks = document.getElementById('inClicks').value;
        BrewApp.state.tempTemp = document.getElementById('inTemp').value;
        BrewApp.state.stepIndex = 0; BrewApp.state.elapsed = 0; BrewApp.state.running = false;
        
        document.getElementById('screen').innerHTML = `<div class="timer-container">
            <div style="text-align:center; padding-top:10px"><div id="vStepCount" class="label">Etapa 1</div><div id="vStepTitle" style="font-weight:700; font-size:1.2rem">Ritual</div></div>
            <div class="zone-timer"><div class="timer-circle">
                <div class="status-container"><div id="status-badge" class="status-badge">Pronto</div></div>
                <div class="liquid-fill" id="liquid-fill"></div>
                <span id="vGrams">0<small>g</small></span><div id="vTime">0:00</div>
                <div class="target-ref">Alvo: ${BrewApp.Utils.formatTime(r.total)}</div>
            </div></div>
            <div class="step-dashboard">
                <div class="step-info-box"><span class="lbl">Meta</span><span class="val" id="vMetaStep">${r.steps[0].target}g</span></div>
                <div class="step-info-box" style="border-left:1px solid #111; border-right:1px solid #111"><span class="lbl">Add</span><span class="val" id="vAddWater">+${r.steps[0].target}g</span></div>
                <div class="step-info-box"><span class="lbl">Próximo</span><span class="val" id="vNextStepTime">--</span></div>
            </div>
            <div style="text-align:center; padding:0 20px; min-height:80px"><p id="vTip" style="font-size:1.15rem; color:white; font-weight:600; margin:10px 0"></p><div id="vNextStep" class="next-up" style="font-size:0.9rem"></div></div>
            <div style="padding-bottom:20px; display:flex; flex-direction:column; align-items:center; gap:10px">
                <button id="btnCtrl" class="btn-main-capsule" onclick="UI.toggle()">Iniciar</button>
                <div style="display:flex; gap:40px"><button class="btn-secondary-text" onclick="UI.skipStep()">Pular</button><button class="btn-secondary-text" onclick="UI.finish()">Finalizar</button></div>
            </div></div>`;
        UI.updateStepView();
    },

    toggle() {
        const btn = document.getElementById('btnCtrl');
        if(BrewApp.state.running) { BrewApp.state.running = false; btn.innerText = "Continuar"; }
        else { document.getElementById('beep').play().catch(()=>{}); BrewApp.state.startTime = performance.now() - (BrewApp.state.elapsed * 1000); BrewApp.state.running = true; btn.innerText = "Pausar"; BrewApp.Timer.loop(); }
    },

    skipStep() {
        const steps = BrewApp.state.activeRecipe.steps;
        const next = steps[BrewApp.state.stepIndex + 1];
        if (next) { BrewApp.state.stepIndex++; BrewApp.state.startTime = performance.now() - (next.time * 1000); BrewApp.state.elapsed = next.time; BrewApp.Timer.update(); UI.updateStepView(); } 
        else { this.finish(); }
    },

    updateStepView() {
        const steps = BrewApp.state.activeRecipe.steps, s = steps[BrewApp.state.stepIndex], next = steps[BrewApp.state.stepIndex + 1];
        document.getElementById('vStepCount').innerText = `Etapa ${BrewApp.state.stepIndex + 1} de ${steps.length}`;
        document.getElementById('vStepTitle').innerText = s.title; document.getElementById('vTip').innerText = s.tip;
        if(next) document.getElementById('vNextStep').innerText = `PRÓXIMO: ${next.title} (${next.target}g)`;
        else document.getElementById('vNextStep').innerText = "FINALIZAR";
    },

    finish() {
        BrewApp.state.running = false;
        document.getElementById('screen').innerHTML = `<div style="padding:40px 20px; text-align:center"><h2>Sabor?</h2>
            <div class="sensory-scale">
                <button class="circle-btn c-2" onclick="UI.setTaste('-2', this)"></button><button class="circle-btn c-1" onclick="UI.setTaste('-1', this)"></button>
                <button class="circle-btn c0 active" onclick="UI.setTaste('0', this)"></button><button class="circle-btn c1" onclick="UI.setTaste('+1', this)"></button>
                <button class="circle-btn c2" onclick="UI.setTaste('+2', this)"></button>
            </div>
            <p id="vTasteLabel" style="color:var(--gold); font-weight:700; margin-bottom:10px">Equilibrado</p>
            <div id="vAdviceBox" style="font-size:0.85rem; color:var(--text-dim); background:#111; padding:15px; border-radius:12px; min-height:60px; margin-bottom:20px; border:1px solid #1a1a1a; line-height:1.4">Selecione o sabor.</div>
            <textarea id="vNotes" placeholder="Anotações..." style="width:100%; height:100px; background:var(--card); border:1px solid var(--border); color:white; border-radius:12px; padding:10px; font-family:inherit; margin-bottom:20px"></textarea>
            <button class="btn-main-capsule" onclick="UI.saveHistory()">Salvar</button></div>`;
        UI.setTaste('0', document.querySelector('.circle-btn.c0'));
    },

    setTaste(v, el) { 
        document.querySelectorAll('.circle-btn').forEach(b => b.classList.remove('active')); 
        el.classList.add('active'); BrewApp.state.currentTasteValue = v;
        const labels = {"-2":"Muito Ácido", "-1":"Ácido", "0":"Equilibrado", "+1":"Amargo", "+2":"Muito Amargo"}; 
        document.getElementById('vTasteLabel').innerText = labels[v];
        document.getElementById('vAdviceBox').innerHTML = BrewApp.Utils.getDialInAdvice(v, BrewApp.state.elapsed, BrewApp.state.activeRecipe.total, BrewApp.state.activeRecipe.method);
    },

    saveHistory() {
        const r = BrewApp.state.activeRecipe;
        const clicks = BrewApp.state.tempClicks;
        const temp = BrewApp.state.tempTemp;
        const notes = document.getElementById('vNotes').value;
        const advice = BrewApp.Utils.getDialInAdvice(BrewApp.state.currentTasteValue, BrewApp.state.elapsed, r.total, r.method);
        
        const entry = { id: Date.now(), recipe: r.name, taste: document.getElementById('vTasteLabel').innerText, clicks, temp, time: BrewApp.Utils.formatTime(BrewApp.state.elapsed), date: new Date().toLocaleDateString(), notes, advice, yield: r.yield };
        
        BrewApp.state.history.unshift(entry);
        localStorage.setItem('sj_history', JSON.stringify(BrewApp.state.history.slice(0,50)));
        UI.renderHome();
    },

    renderHistory() {
        const list = BrewApp.state.history.map(h => `<div class="card">
            <div style="display:flex; justify-content:space-between"><strong>${h.taste}</strong><button style="border:none; background:none; color:#e74c3c" onclick="UI.delHistoryEntry(${h.id})">✕</button></div>
            <small>${h.recipe} • ${h.date} • ${h.time} • ${h.clicks}clks</small><br>
            <small style="color:var(--gold)">Resultado: ${h.yield || '--'}g na xícara</small>
            <p style="font-size:0.8rem; color:var(--text-dim); margin-top:8px">${h.notes || ''}</p>
            ${h.advice ? `<p style="font-size:0.75rem; color:var(--gold); border-top:1px solid #1a1a1a; margin-top:8px; padding-top:8px">${h.advice}</p>` : ''}
            </div>`).join('');
        document.getElementById('screen').innerHTML = `<div style="padding:20px"><h3>Diário</h3>${list || '<p>Sem registros.</p>'}</div>`;
        this.injectNav('history');
    },

    delHistoryEntry(id) { if(confirm("Deletar registro?")) { BrewApp.state.history = BrewApp.state.history.filter(x=>x.id!==id); localStorage.setItem('sj_history', JSON.stringify(BrewApp.state.history)); UI.renderHistory(); } }
};

BrewApp.init();
