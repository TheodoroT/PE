// ============================================================
//  BRIO — script.js  v6.0
//  Onde intenção vira ação
// ============================================================

// ---- FIREBASE ----
const firebaseConfig = {
    apiKey: "AIzaSyB35Sk_dejonuP3Mp5taZ_fpclqiwdKyOg",
    authDomain: "brio---onde-intencao-vira-acao.firebaseapp.com",
    projectId: "brio---onde-intencao-vira-acao",
    storageBucket: "brio---onde-intencao-vira-acao.firebasestorage.app",
    messagingSenderId: "729656112196",
    appId: "1:729656112196:web:9dd0d9ced255cfef4ab811"
};
firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDb   = firebase.firestore();
fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

let _currentUser = null; // logged-in Firebase user object

// ---- DEFAULTS ----
const DEFAULT_CONFIG = {
    userName: '',
    inspirationalPhrase: 'Propósito, Valores e Execução',
    purpose: 'Exemplo: Construir uma vida com propósito, saúde e prosperidade — sendo a melhor versão de mim mesmo em cada papel que desempenho, e deixando um legado positivo para quem está ao meu redor.',
    values: [
        { id:'v1', name:'Saúde',          description:'Base física e mental para tudo que construo. Sem saúde, nada mais é possível.' },
        { id:'v2', name:'Família',         description:'Presença e compromisso com as pessoas que mais importam na minha vida.' },
        { id:'v3', name:'Integridade',     description:'Agir de acordo com meus princípios, mesmo quando ninguém está olhando.' },
        { id:'v4', name:'Crescimento',     description:'Compromisso contínuo com aprendizado, evolução e melhoria pessoal.' },
        { id:'v5', name:'Responsabilidade','description':'Assumir a autoria da minha vida e das consequências das minhas escolhas.' }
    ],
    pillarOrder: ['saude','financas','carreira','relacoes'],
    pillars: {
        saude:    { name:'Saúde & Corpo',     description:'Ser fisicamente forte, com energia alta e hábitos que sustentem uma vida longa e ativa.',     goals:[ { id:'g1', text:'Atingir e manter composição corporal ideal', pct:0 }, { id:'g2', text:'Praticar exercício físico regularmente', pct:0 }, { id:'g3', text:'Manter exames e check-ups em dia', pct:0 } ] },
        financas: { name:'Finanças',           description:'Construir patrimônio sólido, eliminar dívidas e criar fontes de renda consistentes.',         goals:[ { id:'g4', text:'Atingir reserva de emergência de 6 meses', pct:0 }, { id:'g5', text:'Investir pelo menos 20% da renda mensalmente', pct:0 }, { id:'g6', text:'Eliminar todas as dívidas de alto custo', pct:0 } ] },
        carreira: { name:'Carreira & Propósito', description:'Desenvolver competências de alto valor e construir trabalho com significado e impacto.',   goals:[ { id:'g7', text:'Atingir posição de liderança ou especialista na área', pct:0 }, { id:'g8', text:'Desenvolver habilidade de comunicação e influência', pct:0 } ] },
        relacoes: { name:'Relações',           description:'Cultivar relacionamentos profundos, saudáveis e recíprocos com família e pessoas próximas.', goals:[ { id:'g9', text:'Fortalecer rituais e presença com a família', pct:0 }, { id:'g10', text:'Construir rede de amizades significativas', pct:0 } ] }
    }
};

const TASK_STATUSES = ['Pendente','Em progresso','Pausada','Concluída','Encerrada'];
const TYPE_LABELS   = { contagem:'Contagem', valor:'Valor', marco:'Marco', habito:'Hábito', score:'Score' };
const FREQ_LABELS   = { none:'—', daily:'Diária', weekly:'Semanal', monthly:'Mensal' };

// ---- STATE ----
let state = { currentPillar: null, tasks: {}, revisoes: [], conquistas: [], config: deepClone(DEFAULT_CONFIG), filterStatus:'all', filterType:'all', focusMode:false };

// ---- UTILS ----
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function genId() { try { return crypto.randomUUID(); } catch { return Date.now().toString(36)+Math.random().toString(36).slice(2); } }
function escHtml(t) { const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; }
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(s) { if (!s) return 'Sem prazo'; return new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}); }
function fmtDateLong(s) { if (!s) return ''; return new Date(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}); }
function fmtNum(n) { if (n===undefined||n===null) return '0'; return typeof n==='number' ? n.toLocaleString('pt-BR', n%1!==0?{minimumFractionDigits:2,maximumFractionDigits:2}:{}) : n; }
function fmtWeek(w) { if (!w) return ''; const [y,n]=w.split('-W'); return `Semana ${n}/${y}`; }
function getISOWeek(d) { const t=new Date(d); t.setHours(0,0,0,0); t.setDate(t.getDate()+3-(t.getDay()+6)%7); const w=new Date(t.getFullYear(),0,4); return 1+Math.round(((t-w)/86400000-3+(w.getDay()+6)%7)/7); }
function getMonthKey(iso) { return iso ? iso.slice(0,7) : ''; }
function pillarOrder() { return state.config.pillarOrder||Object.keys(state.config.pillars); }
function addDays(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }

// ---- PERSIST ----
function loadState() {
    // If no pe_v6 data exists, clear all onboarding/tooltip flags so experience starts fresh
    if (!localStorage.getItem('pe_v6')) {
        ['ob_v2_done','ob_checklist_done',
         'tt_vision','tt_dashboard','tt_metas','tt_roadmap','tt_revisao']
        .forEach(k => localStorage.removeItem(k));
    }

    const raw = localStorage.getItem('pe_v6');
    if (!raw) return;
    try {
        const p = JSON.parse(raw);
        state.config = {
            ...deepClone(DEFAULT_CONFIG),
            ...(p.config||{}),
            pillars: {},
            pillarOrder: p.config?.pillarOrder || DEFAULT_CONFIG.pillarOrder,
            values: p.config?.values || deepClone(DEFAULT_CONFIG.values)
        };
        // Merge pillars
        const defPillars = deepClone(DEFAULT_CONFIG.pillars);
        const savedPillars = p.config?.pillars || {};
        pillarOrder().forEach(k => {
            state.config.pillars[k] = {
                ...(defPillars[k]||{}),
                ...(savedPillars[k]||{}),
                goals: savedPillars[k]?.goals || defPillars[k]?.goals || []
            };
        });
        // Migrate and normalize tasks
        state.tasks = {};
        pillarOrder().forEach(k => {
            state.tasks[k] = (p.tasks?.[k]||[]).map(normTask);
        });
        state.revisoes = p.revisoes||[];
        state.conquistas = p.conquistas||[];
        state.currentPillar = p.currentPillar || pillarOrder()[0];
    } catch(e) { console.error('loadState',e); }
}

function normTask(t) {
    return {
        id:             t.id||genId(),
        type:           t.type||'contagem',
        text:           t.text||'',
        goal:           parseFloat(t.goal)||1,
        current:        parseFloat(t.current)||0,
        unit:           t.unit||'',
        frequency:      t.frequency||'none',
        habitLimit:     parseInt(t.habitLimit)||3,
        habitMode:      t.habitMode||'min',
        habitCheckins:  t.habitCheckins||[],
        scoreGoal:      parseFloat(t.scoreGoal)||7,
        scorePeriod:    t.scorePeriod||'daily',
        scoreDirection: t.scoreDirection||'higher',
        scoreEntries:   t.scoreEntries||[],
        subtasks:       t.subtasks||[],
        priority:       t.priority||'medium',
        deadline:       t.deadline||null,
        startDate:      t.startDate||null,
        whyImportant:   t.whyImportant||'',
        isFocusTrimestral: t.isFocusTrimestral||false,
        isFocusMensal:     t.isFocusMensal||false,
        taskStatus:     t.taskStatus||(t.completed?'Concluída':'Pendente'),
        notes:          t.notes||'',
        checkins:       t.checkins||[], // [{date,note}] or legacy string[]
        valueEntries:   t.valueEntries||[], // [{date,amount,note,running}]
        createdAt:      t.createdAt||new Date().toISOString()
    };
}

function saveState() {
    localStorage.setItem('pe_v6', JSON.stringify(state));
    // Async sync to Firestore (non-blocking)
    if (_currentUser) {
        fbDb.collection('users').doc(_currentUser.uid)
            .set({ state: JSON.parse(JSON.stringify(state)), updatedAt: Date.now() })
            .catch(e => console.warn('Firestore save error:', e));
    }
}

async function loadStateFromFirestore(uid) {
    try {
        const doc = await fbDb.collection('users').doc(uid).get();
        if (doc.exists && doc.data().state) {
            const raw = doc.data().state;
            // Apply to local state
            _applyRawState(raw);
            // Update localStorage cache
            localStorage.setItem('pe_v6', JSON.stringify(state));
        } else {
            // New user — load from localStorage if exists, else fresh start
            loadState();
        }
    } catch(e) {
        console.warn('Firestore load failed, using localStorage:', e);
        loadState();
    }
}

function _applyRawState(p) {
    if (!p) return;
    state.config = {
        ...deepClone(DEFAULT_CONFIG),
        ...(p.config||{}),
        pillars: {},
        pillarOrder: p.config?.pillarOrder || DEFAULT_CONFIG.pillarOrder,
        values: p.config?.values || deepClone(DEFAULT_CONFIG.values)
    };
    const defPillars = deepClone(DEFAULT_CONFIG.pillars);
    const savedPillars = p.config?.pillars || {};
    pillarOrder().forEach(k => {
        state.config.pillars[k] = {
            ...(defPillars[k]||{}),
            ...(savedPillars[k]||{}),
            goals: savedPillars[k]?.goals || defPillars[k]?.goals || []
        };
    });
    state.tasks = {};
    pillarOrder().forEach(k => {
        state.tasks[k] = (p.tasks?.[k]||[]).map(normTask);
    });
    state.revisoes = p.revisoes||[];
    state.conquistas = p.conquistas||[];
    state.currentPillar = p.currentPillar || pillarOrder()[0];
}

// ---- INIT ----
function init() {
    loadState();
    if (!state.currentPillar || !state.config.pillars[state.currentPillar]) {
        state.currentPillar = pillarOrder()[0];
    }
    setupEventListeners();
    setupObListeners();
    _hookConquistasTab();
    applyDarkMode(localStorage.getItem('darkMode')==='1');
    renderAll();
    initOnboarding();
    showSectionTooltip('vision');
}

function _initAfterAuth(user) {
    _currentUser = user;
    if (!state.currentPillar || !state.config.pillars[state.currentPillar]) {
        state.currentPillar = pillarOrder()[0];
    }
    setupEventListeners();
    setupObListeners();
    _hookConquistasTab();
    applyDarkMode(localStorage.getItem('darkMode')==='1');
    renderAll();
    initOnboarding();
    showSectionTooltip('vision');
}

function renderAll() {
    applyConfig();
    renderPillarNav();
    renderVision();
    renderMetas();
    updateDashboard();
    renderRoadmap();
    renderRevisoes();
    renderAutoSummary();
}

// ---- DARK MODE ----
function applyDarkMode(on) {
    document.documentElement.classList.toggle('dark',!!on);
    localStorage.setItem('darkMode', on?'1':'0');
}

// ---- CONFIG ----
function applyConfig() {
    const c = state.config;
    const el = id => document.getElementById(id);
    const displayName = c.userName || (_currentUser?.displayName) || 'Brio';
    const n = el('header-username'); if (n) n.textContent = displayName;
    const ph = el('header-phrase'); if (ph) ph.textContent = c.inspirationalPhrase||'Onde intenção vira ação';
    const pu = el('purpose-text'); if (pu) pu.textContent = c.purpose||'';
}

// ---- EVENT LISTENERS ----
function setupEventListeners() {
    // Nav
    document.querySelectorAll('.nav-btn').forEach(b =>
        b.addEventListener('click', e => switchSection(e.currentTarget.dataset.section))
    );
    // Dark
    document.getElementById('dark-toggle-btn')?.addEventListener('click', () => applyDarkMode(!document.documentElement.classList.contains('dark')));
    // Settings
    document.getElementById('open-settings-btn')?.addEventListener('click', openSettings);
    document.getElementById('close-settings-btn')?.addEventListener('click', closeSettings);
    document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
    document.getElementById('settings-overlay')?.addEventListener('click', e => { if(e.target.id==='settings-overlay') closeSettings(); });
    document.querySelectorAll('.settings-tab').forEach(b => b.addEventListener('click', e => switchSettingsTab(e.currentTarget.dataset.tab)));
    document.getElementById('add-value-btn')?.addEventListener('click', addValueField);
    document.getElementById('add-pillar-btn')?.addEventListener('click', addPillarField);
    document.getElementById('cfg-values-list')?.addEventListener('click', e => { if(e.target.closest('[data-action="remove-value"]')) { state.config.values.splice(parseInt(e.target.closest('[data-action]').dataset.idx),1); renderSettingsValues(); } });
    document.getElementById('cfg-pillars-list')?.addEventListener('click', handlePillarSettingsClick);

    // Pillar nav
    document.getElementById('pillar-nav')?.addEventListener('click', e => { const b=e.target.closest('.pillar-btn'); if(b) switchPillar(b.dataset.pillar); });

    // Vision pillars
    document.getElementById('pillars-container')?.addEventListener('click', e => { const h=e.target.closest('.pillar-header'); if(h) h.closest('.pillar-item')?.classList.toggle('expanded'); });
    document.getElementById('pillars-container')?.addEventListener('input', e => {
        const inp = e.target.closest('.goal-pct-input');
        if (!inp) return;
        const k = inp.dataset.pillar, gi = parseInt(inp.dataset.gi);
        const v = Math.min(100, Math.max(0, parseInt(inp.value)||0));
        if (state.config.pillars[k]?.goals?.[gi]) state.config.pillars[k].goals[gi].pct = v;
        inp.value = v;
        saveState();
        updatePillarProgress(k);
        updateDashboard();
    });

    document.getElementById('metas-view-list-btn')?.addEventListener('click', ()=>toggleMetasView('list'));
    document.getElementById('metas-view-gantt-btn')?.addEventListener('click', ()=>toggleMetasView('gantt'));

    // Add task toggle
    document.getElementById('toggle-add-task-btn')?.addEventListener('click', () => { document.getElementById('add-task-form')?.classList.toggle('hidden'); });
    document.getElementById('close-add-task-btn')?.addEventListener('click', () => document.getElementById('add-task-form')?.classList.add('hidden'));
    document.getElementById('add-task-btn')?.addEventListener('click', addTask);
    document.getElementById('task-input')?.addEventListener('keypress', e => e.key==='Enter' && addTask());
    document.getElementById('task-type')?.addEventListener('change', e => switchFormType(e.target.value));
    document.getElementById('task-deadline')?.addEventListener('change', clearDeadlineError);

    // Task list delegation
    const tl = document.getElementById('tasks-list');
    if (tl) {
        tl.addEventListener('click', e => {
            // Gantt row click — open edit panel
            const mgRow = e.target.closest('.mg-row');
            if (mgRow && !e.target.closest('[data-action]')) {
                openEditPanel(mgRow.dataset.id);
                return;
            }
            handleTaskClick(e);
        });
        tl.addEventListener('change', handleTaskChange);
        tl.addEventListener('input', handleTaskInput);
    }

    // Edit panel
    document.getElementById('close-edit-btn')?.addEventListener('click', closeEditPanel);
    document.getElementById('edit-overlay')?.addEventListener('click', e => { if(e.target.id==='edit-overlay') closeEditPanel(); });
    document.getElementById('save-edit-btn')?.addEventListener('click', saveEditTask);

    // History panel
    document.getElementById('close-history-btn')?.addEventListener('click', ()=>{ _historyId=null; closeSidePanel('history-overlay')(); });
    document.getElementById('history-overlay')?.addEventListener('click', e => { if(e.target.id==='history-overlay') { _historyId=null; closeSidePanel('history-overlay')(); } });
    document.getElementById('history-content')?.addEventListener('click', handleHistoryClick);

    // Roadmap
    document.getElementById('roadmap-content')?.addEventListener('click', e => {
        const b=e.target.closest('[data-action="goto-pillar"]');
        if(b) { switchSection('metas'); switchPillar(b.dataset.pillar); return; }

        const btn=e.target.closest('[data-action]'); if(!btn) return;
        const {action, id, pillar}=btn.dataset;
        if (!id) return;

        if (action==='roadmap-checkin') {
            // Contagem — switch to that pillar temporarily for checkin
            const prevPillar=state.currentPillar;
            state.currentPillar=pillar;
            checkinTask(id);
            state.currentPillar=prevPillar;
            renderRoadmap();
            updateDashboard();
        } else if (action==='roadmap-habito') {
            const prevPillar=state.currentPillar;
            state.currentPillar=pillar;
            habitCheckin(id);
            state.currentPillar=prevPillar;
            renderRoadmap();
        } else if (action==='roadmap-marco') {
            const prevPillar=state.currentPillar;
            state.currentPillar=pillar;
            completeMarco(id);
            state.currentPillar=prevPillar;
            renderRoadmap();
        } else if (action==='roadmap-valor') {
            openValorModal(id);
        }
    });

    // Footer
    document.getElementById('export-btn')?.addEventListener('click', exportData);
    document.getElementById('import-btn')?.addEventListener('click', ()=>document.getElementById('import-file')?.click());
    document.getElementById('import-file')?.addEventListener('change', importData);
    document.getElementById('reset-all-btn')?.addEventListener('click', ()=>showConfirm('Apagar todos os dados? Esta ação não pode ser desfeita.',resetAllData));
    document.getElementById('export-report-btn')?.addEventListener('click', exportReport);
    document.getElementById('export-pdf-btn')?.addEventListener('click', ()=>{ buildPdfReport(); window.print(); });

    // Filters
    // Filter toggle
    document.getElementById('filter-toggle-btn')?.addEventListener('click', () => {
        const bar = document.getElementById('filter-bar');
        const btn = document.getElementById('filter-toggle-btn');
        const isHidden = bar?.classList.contains('hidden');
        bar?.classList.toggle('hidden', !isHidden);
        btn?.classList.toggle('active', isHidden);
    });

    document.getElementById('filter-bar')?.addEventListener('click', e => {
        const chip = e.target.closest('[data-filter-status]');
        const ctype = e.target.closest('[data-filter-type]');
        if (chip) {
            state.filterStatus = chip.dataset.filterStatus;
            document.querySelectorAll('[data-filter-status]').forEach(c=>c.classList.toggle('active', c.dataset.filterStatus===state.filterStatus));
            renderMetas();
        }
        if (ctype) {
            state.filterType = ctype.dataset.filterType;
            document.querySelectorAll('[data-filter-type]').forEach(c=>c.classList.toggle('active', c.dataset.filterType===state.filterType));
            renderMetas();
        }
    });

    // Focus mode
    document.getElementById('focus-mode-btn')?.addEventListener('click', () => {
        state.focusMode = !state.focusMode;
        document.getElementById('focus-mode-btn')?.classList.toggle('active', state.focusMode);
        renderMetas();
    });

    // Curves toggle
    document.getElementById('curves-toggle-btn')?.addEventListener('click', toggleCurves);

    // Roadmap view toggle
    document.getElementById('roadmap-list-btn')?.addEventListener('click', ()=>{ switchRoadmapView('list'); });
    document.getElementById('roadmap-gantt-btn')?.addEventListener('click', ()=>{ switchRoadmapView('gantt'); });

    // Revisão
    document.getElementById('new-revisao-btn')?.addEventListener('click', ()=>{
        document.getElementById('revisao-form')?.classList.remove('hidden');
        const now=new Date(); const wk=document.getElementById('revisao-week'); if(wk) wk.value=`${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2,'0')}`;
        renderBriefingSemana();
    });

    // Week score picker
    document.getElementById('week-score-picker')?.addEventListener('click', e=>{
        const btn=e.target.closest('.wsp-btn'); if(!btn) return;
        document.querySelectorAll('.wsp-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        const inp=document.getElementById('revisao-score'); if(inp) inp.value=btn.dataset.score;
    });

    // Help
    document.getElementById('open-help-btn')?.addEventListener('click', openHelp);
    document.getElementById('close-help-btn')?.addEventListener('click', ()=>closeSidePanel('help-overlay')());
    document.getElementById('help-overlay')?.addEventListener('click', e=>{ if(e.target.id==='help-overlay') closeSidePanel('help-overlay')(); });
    document.getElementById('save-revisao-btn')?.addEventListener('click', saveRevisao);
    document.getElementById('cancel-revisao-btn')?.addEventListener('click', ()=>closeRevisaoForm());
    document.getElementById('revisao-list')?.addEventListener('click', e => { const b=e.target.closest('[data-action="del-revisao"]'); if(b) showConfirm('Deletar esta revisão?',()=>{ state.revisoes=state.revisoes.filter(r=>r.id!==b.dataset.id); saveState(); renderRevisoes(); }); });

    // Modals
    document.getElementById('valor-cancel-btn')?.addEventListener('click', ()=>document.getElementById('valor-modal')?.classList.add('hidden'));
    document.getElementById('score-cancel-btn')?.addEventListener('click', ()=>document.getElementById('score-modal')?.classList.add('hidden'));
    document.getElementById('subtask-close-btn')?.addEventListener('click', closeSubtaskModal);
    document.getElementById('subtask-add-btn')?.addEventListener('click', addSubtask);
    document.getElementById('subtask-input')?.addEventListener('keypress', e=>e.key==='Enter'&&addSubtask());
    document.getElementById('subtask-list')?.addEventListener('click', handleSubtaskClick);
    document.getElementById('modal-cancel-btn')?.addEventListener('click', closeConfirm);
}

// ---- SECTIONS ----
function openAddWithType(type) {
    const form = document.getElementById('add-task-form');
    if (form) form.classList.remove('hidden');
    const sel = document.getElementById('task-type');
    if (sel) { sel.value = type; switchFormType(type); }
    document.getElementById('task-input')?.focus();
}

function switchPillar(k) {
    if(!state.config.pillars[k]) return;
    state.currentPillar=k; saveState();
    document.querySelectorAll('.pillar-btn').forEach(b=>b.classList.toggle('active',b.dataset.pillar===k));
    const pt=document.getElementById('pillar-title'); if(pt) pt.textContent=state.config.pillars[k].name;
    renderMetas();
}

function switchFormType(type) {
    document.querySelectorAll('.type-fields').forEach(d=>d.classList.remove('active'));
    document.getElementById('fields-'+type)?.classList.add('active');
    // Show required marker for types that need a deadline
    const needsDeadline = ['contagem','valor','marco'].includes(type);
    const marker = document.getElementById('deadline-required-marker');
    const hint = document.getElementById('task-deadline')?.parentElement?.querySelector('span.field-error');
    if (marker) marker.style.display = needsDeadline ? '' : 'none';
    // Clear any existing error when switching types
    clearDeadlineError();
}

function clearDeadlineError() {
    const inp = document.getElementById('task-deadline');
    const err = document.getElementById('deadline-error');
    if (inp) inp.classList.remove('input-error');
    if (err) err.style.display = 'none';
}

function closeSidePanel(id) { return () => { const o=document.getElementById(id); o?.classList.remove('visible'); setTimeout(()=>o?.classList.add('hidden'),260); }; }
function openSidePanel(id) { const o=document.getElementById(id); o?.classList.remove('hidden'); requestAnimationFrame(()=>o?.classList.add('visible')); }

// ---- RENDER PILLAR NAV ----
function renderPillarNav() {
    const nav=document.getElementById('pillar-nav'); if(!nav) return;
    nav.innerHTML=pillarOrder().map(k=>{
        const p=state.config.pillars[k]; if(!p) return '';
        return `<button class="pillar-btn${state.currentPillar===k?' active':''}" data-pillar="${k}">${escHtml(p.name)}</button>`;
    }).join('');
}

// ---- RENDER VISION ----
function renderVision() {
    applyConfig();
    renderValuesGrid();
    renderPillarsList();
    renderVisionChecklist();
    renderRadarChart();
}

function renderValuesGrid() {
    const g=document.getElementById('values-grid'); if(!g) return;
    const vals=state.config.values||[];
    g.innerHTML=vals.map((v,i)=>`
        <div class="value-card">
            <div class="value-card-index">${String(i+1).padStart(2,'0')}</div>
            <div class="value-card-body">
                <div class="value-card-name">${escHtml(v.name)}</div>
                <div class="value-card-desc">${escHtml(v.description)}</div>
            </div>
        </div>
    `).join('');
}

function renderPillarsList() {
    const c=document.getElementById('pillars-container'); if(!c) return;
    c.innerHTML=pillarOrder().map(k=>{
        const p=state.config.pillars[k]; if(!p) return '';
        const goals=p.goals||[];
        const avg=goals.length ? Math.round(goals.reduce((a,g)=>a+(parseFloat(g.pct)||0),0)/goals.length) : 0;
        return `
        <div class="pillar-item" data-pillar="${k}">
            <div class="pillar-header">
                <div class="pillar-header-left">
                    <span class="pillar-name">${escHtml(p.name)}</span>
                </div>
                <span class="pillar-toggle">▼</span>
            </div>
            <div class="pillar-content">
                <div class="pillar-body">
                    <p class="pillar-description">${escHtml(p.description)}</p>
                    <div class="pillar-goals-section">
                        <div class="pillar-goals-header">Metas 2028 <span class="pillar-goals-hint">— edite o % de cada meta</span></div>
                        ${goals.map((g,gi)=>`
                        <div class="pillar-goal-row">
                            <span class="pillar-goal-text">${escHtml(g.text)}</span>
                            <div class="pillar-goal-pct-wrap">
                                <input type="number" class="goal-pct-input" data-pillar="${k}" data-gi="${gi}" value="${g.pct||0}" min="0" max="100">
                                <span class="goal-pct-sym">%</span>
                            </div>
                        </div>`).join('')}
                    </div>
                </div>
                <div class="pillar-footer-bar">
                    <div class="pillar-footer-bar-label">
                        <span class="pillar-footer-bar-title">Progresso 2028</span>
                        <span class="pillar-footer-bar-pct" id="ppct-${k}">${avg}%</span>
                    </div>
                    <div class="pillar-footer-bar-track">
                        <div class="pillar-footer-bar-fill" id="pbar-${k}" style="width:${avg}%"></div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function updatePillarProgress(k) {
    const p=state.config.pillars[k]; if(!p) return;
    const goals=p.goals||[];
    const avg=goals.length ? Math.round(goals.reduce((a,g)=>a+(parseFloat(g.pct)||0),0)/goals.length) : 0;
    const bar=document.getElementById('pbar-'+k); if(bar) bar.style.width=avg+'%';
    const pct=document.getElementById('ppct-'+k); if(pct) pct.textContent=avg+'%';
    renderRadarChart();
}

// ---- PILAR STATS STRIP ----
function renderPilarStats() {
    const wrap = document.getElementById('pilar-stats-wrap'); if (!wrap) return;
    const k = state.currentPillar;
    const tasks = state.tasks[k] || [];
    if (!tasks.length) { wrap.innerHTML=''; return; }

    const total = tasks.length;
    const concluidas = tasks.filter(t=>t.taskStatus==='Concluída').length;
    const encerradas = tasks.filter(t=>t.taskStatus==='Encerrada').length;
    const active = total - concluidas - encerradas;
    const statuses = tasks.map(t=>calcStatus(t));
    const positivas = statuses.filter(s=>s.css==='on-track'||s.css==='adiantada').length;
    const atencao = statuses.filter(s=>s.css==='off-track'||s.css==='at-risk').length;
    const avgPct = total ? Math.round(tasks.reduce((a,t)=>a+Math.min(1,getProgress(t)),0)/total*100) : 0;

    wrap.innerHTML=`<div class="pilar-stats-strip">
        <div class="pstat-card">
            <span class="pstat-val">${total}</span>
            <span class="pstat-label">Total de metas</span>
        </div>
        <div class="pstat-card${concluidas>0?' positive':''}">
            <span class="pstat-val">${concluidas}</span>
            <span class="pstat-label">Concluídas</span>
        </div>
        <div class="pstat-card accent">
            <span class="pstat-val">${avgPct}%</span>
            <span class="pstat-label">Progresso médio</span>
        </div>
        <div class="pstat-card${positivas>0?' positive':''}">
            <span class="pstat-val">${positivas}</span>
            <span class="pstat-label">No ritmo / Adiantadas</span>
        </div>
        <div class="pstat-card${atencao>0?' warning':''}">
            <span class="pstat-val">${atencao}</span>
            <span class="pstat-label">Em risco / Atrasadas</span>
        </div>
    </div>`;
}

// ---- CURVES TOGGLE ----
let _showCurves = false;
function toggleCurves() {
    _showCurves = !_showCurves;
    document.body.classList.toggle('show-curves', _showCurves);
    document.getElementById('curves-toggle-btn')?.classList.toggle('active', _showCurves);
}
function getProgress(t) {
    if (t.type==='marco') return t.taskStatus==='Concluída' ? 1 : 0;
    if (t.type==='habito') {
        const weeks=getHabitWeekData(t,8);
        if(!weeks.length) return 0;
        return weeks.filter(w=>w.met).length/weeks.length;
    }
    if (t.type==='score') {
        const entries=t.scoreEntries||[];
        if(!entries.length) return 0;
        const recent=entries.slice(-10);
        const avg=recent.reduce((a,e)=>a+e.value,0)/recent.length;
        return t.scoreDirection==='higher' ? Math.min(1,avg/t.scoreGoal) : Math.min(1,t.scoreGoal/Math.max(0.01,avg));
    }
    if (t.type==='valor') {
        return t.goal>0 ? Math.min(1,t.current/t.goal) : 0;
    }
    return t.goal>0 ? Math.min(1,t.current/t.goal) : 0;
}

function calcStatus(t) {
    const s=t.taskStatus;
    if (s==='Concluída') return { label:'Concluída',  css:'on-track' };
    if (s==='Encerrada') return { label:'Encerrada',  css:'neutral' };
    if (s==='Pausada')   return { label:'Pausada',    css:'at-risk' };

    // MARCO
    if (t.type==='marco') {
        if (!t.deadline) return { label:'Pendente', css:'neutral' };
        const now=new Date(), dl=new Date(t.deadline+'T12:00:00');
        const dr=Math.round((dl-now)/86400000);
        if (dr<=0)  return { label:'Prazo expirado', css:'off-track' };
        if (dr<=7)  return { label:'Urgente', css:'off-track' };
        if (dr<=30) return { label:'Em risco', css:'at-risk' };
        return { label:'No prazo', css:'on-track' };
    }

    // HABITO
    if (t.type==='habito') {
        if (!t.habitCheckins.length) {
            // max mode: zero check-ins is within the limit — no ritmo
            // min mode: no check-ins yet — not started
            return t.habitMode==='max'
                ? { label:'No Ritmo', css:'on-track' }
                : { label:'Não iniciada', css:'neutral' };
        }
        const weeks=getHabitWeekData(t,4);
        if(!weeks.length) return { label:'Sem dados', css:'neutral' };
        const metCount=weeks.filter(w=>w.met).length;
        const thisWeek=getHabitThisWeek(t);
        const thisWeekMet=t.habitMode==='min'?thisWeek>=t.habitLimit:thisWeek<=t.habitLimit;
        if (metCount===4 || (metCount>=3&&thisWeekMet)) return { label:'No Ritmo', css:'on-track' };
        if (metCount>=2) return { label:'Em Risco', css:'at-risk' };
        return { label:'Atrasada', css:'off-track' };
    }

    // SCORE
    if (t.type==='score') {
        const entries=t.scoreEntries||[];
        if(!entries.length) return { label:'Sem dados', css:'neutral' };
        const recent=entries.slice(-7);
        const avg=recent.reduce((a,e)=>a+e.value,0)/recent.length;
        const ratio=t.scoreDirection==='higher' ? avg/t.scoreGoal : t.scoreGoal/Math.max(0.01,avg);
        if (ratio>=1.20) return { label:'Adiantada', css:'adiantada' };
        if (ratio>=1.00) return { label:'No Ritmo',  css:'on-track' };
        if (ratio>=0.85) return { label:'Em Risco',  css:'at-risk' };
        return { label:'Atrasada', css:'off-track' };
    }

    // CONTAGEM / VALOR — taxa de progresso sobre o que FALTA
    const realizado = t.current;
    const objetivo  = t.goal;
    if (!objetivo || objetivo<=0) return { label:'Sem objetivo', css:'neutral' };

    // Meta atingida (guarda contra divisão por zero de faltaTotal=0)
    if (realizado >= objetivo) return { label:'Meta atingida', css:'on-track' };

    const faltaTotal = objetivo - realizado;

    if (!t.deadline) {
        if (realizado===0) return { label:'Não iniciada', css:'neutral' };
        return { label:'Em progresso', css:'on-track' };
    }

    const now = new Date();
    const dl  = new Date(t.deadline+'T12:00:00');
    // Usa startDate se definida, senão createdAt
    const startRef = t.startDate ? new Date(t.startDate+'T12:00:00') : new Date(t.createdAt);

    // Prazo expirado
    if (dl <= now) {
        if (realizado >= objetivo) return { label:'Concluída', css:'on-track' };
        return { label:'Prazo expirado', css:'off-track' };
    }

    // Meta ainda não iniciou (startDate no futuro)
    if (startRef > now) return { label:'Não iniciada', css:'neutral' };

    if (realizado===0) return { label:'Não iniciada', css:'neutral' };

    const diasRestantes  = Math.max(0.5, (dl - now) / 86400000);
    // Piso de 1 dia — evita ritmo fictício no primeiro dia
    const diasDecorridos = Math.max(1, (now - startRef) / 86400000);

    // Ritmo necessário = o que falta / dias restantes
    const ritmoNecessario = faltaTotal / diasRestantes;
    // Ritmo atual = realizado / dias decorridos
    const ritmoAtual = realizado / diasDecorridos;

    // gap = ritmoAtual / ritmoNecessario
    const gap = ritmoNecessario > 0 ? ritmoAtual / ritmoNecessario : 2;

    if (gap >= 1.20) return { label:'Adiantada', css:'adiantada' };
    if (gap >= 1.00) return { label:'No Ritmo',  css:'on-track' };
    if (gap >= 0.85) return { label:'Em Risco',  css:'at-risk' };
    return              { label:'Atrasada',    css:'off-track' };
}

function calcStatusDetail(t) {
    const st = calcStatus(t);
    let hint = '';
    if ((t.type==='contagem'||t.type==='valor') && t.deadline && t.current>0 && t.current<t.goal) {
        const now=new Date(), dl=new Date(t.deadline+'T12:00:00');
        const startRef = t.startDate ? new Date(t.startDate+'T12:00:00') : new Date(t.createdAt);
        const diasRestantes=Math.max(1,(dl-now)/86400000);
        const falta=Math.max(0,t.goal-t.current);
        const ritmoNec=falta/diasRestantes;
        const diasDec=Math.max(1,(now-startRef)/86400000);
        const ritmoAtual=t.current/diasDec;
        if (t.type==='valor') hint=`Ritmo atual: ${t.unit||''}${fmtNum(ritmoAtual.toFixed(2))}/dia · Necessário: ${t.unit||''}${fmtNum(ritmoNec.toFixed(2))}/dia`;
        else hint=`Ritmo atual: ${fmtNum(ritmoAtual.toFixed(1))}/dia · Necessário: ${fmtNum(ritmoNec.toFixed(1))}/dia`;
    }
    return { ...st, hint };
}

// ---- ADD TASK ----
function addTask() {
    const txt=document.getElementById('task-input')?.value.trim();
    if(!txt) return showToast('Digite um nome para a meta');
    const type=document.getElementById('task-type')?.value||'contagem';
    const priority=document.getElementById('task-priority')?.value||'medium';
    const deadline=document.getElementById('task-deadline')?.value||null;
    const startDate=document.getElementById('task-startdate')?.value||null;
    const whyImportant=document.getElementById('task-why')?.value.trim()||'';

    // Validate required deadline
    const needsDeadline = ['contagem','valor','marco'].includes(type);
    if (needsDeadline && !deadline) {
        const inp = document.getElementById('task-deadline');
        const err = document.getElementById('deadline-error');
        if (inp) { inp.classList.add('input-error'); inp.focus(); }
        if (err) err.style.display = 'block';
        return;
    }
    clearDeadlineError();

    const task={
        id:genId(), type, text:txt, priority, deadline, startDate, whyImportant,
        taskStatus:'Pendente', notes:'', checkins:[], valueEntries:[],
        habitCheckins:[], scoreEntries:[], subtasks:[],
        createdAt:new Date().toISOString(),
        goal:1, current:0, unit:'', frequency:'none',
        habitLimit:3, habitMode:'min', scoreGoal:7, scorePeriod:'daily', scoreDirection:'higher'
    };

    if(type==='contagem') {
        task.goal=parseInt(document.getElementById('task-goal-contagem')?.value)||10;
        task.frequency=document.getElementById('task-frequency')?.value||'none';
    } else if(type==='valor') {
        task.goal=parseFloat(document.getElementById('task-goal-valor')?.value)||10000;
        task.unit=document.getElementById('task-unit')?.value.trim()||'';
    } else if(type==='habito') {
        task.habitLimit=parseInt(document.getElementById('task-habit-limit')?.value)||3;
        task.habitMode=document.getElementById('task-habit-mode')?.value||'min';
    } else if(type==='score') {
        task.scoreGoal=parseFloat(document.getElementById('task-goal-score')?.value)||7;
        task.scorePeriod=document.getElementById('task-score-period')?.value||'daily';
        task.scoreDirection=document.getElementById('task-score-direction')?.value||'higher';
    }

    if(!state.tasks[state.currentPillar]) state.tasks[state.currentPillar]=[];
    state.tasks[state.currentPillar].push(task);
    saveState();
    // Check conquistas
    const totalMetas=pillarOrder().reduce((a,k)=>a+(state.tasks[k]||[]).length,0);
    if(totalMetas===1) checkConquista('primeira_meta');

    // Reset form
    document.getElementById('task-input').value='';
    document.getElementById('task-why').value='';
    document.getElementById('task-deadline').value='';
    document.getElementById('task-startdate').value='';
    document.getElementById('task-type').value='contagem';
    document.getElementById('task-goal-contagem').value='10';
    document.getElementById('task-goal-valor').value='10000';
    document.getElementById('task-unit').value='';
    document.getElementById('task-frequency').value='none';
    switchFormType('contagem');

    document.getElementById('add-task-form')?.classList.add('hidden');
    renderMetas(); updateDashboard(); showToast('Meta adicionada ✓');
}

// ---- TASK DELEGATION ----
function handleTaskClick(e) {
    // Three-dot menu toggle
    const menuBtn = e.target.closest('.task-menu-btn');
    if (menuBtn) {
        e.stopPropagation();
        const wrap = menuBtn.closest('.task-menu-wrap');
        const dd = wrap?.querySelector('.task-menu-dropdown');
        const isOpen = dd?.classList.contains('open');
        // Close all open menus
        document.querySelectorAll('.task-menu-dropdown.open').forEach(d=>d.classList.remove('open'));
        if (!isOpen && dd) dd.classList.add('open');
        return;
    }
    // Close menus on outside click
    if (!e.target.closest('.task-menu-dropdown')) {
        document.querySelectorAll('.task-menu-dropdown.open').forEach(d=>d.classList.remove('open'));
    }

    const b=e.target.closest('[data-action]'); if(!b) return;
    const id=b.dataset.id, action=b.dataset.action;
    if(action==='checkin')         checkinTask(id);
    else if(action==='undo')       undoCheckin(id);
    else if(action==='delete')     showConfirm('Deletar esta meta?',()=>deleteTask(id));
    else if(action==='edit')       openEditPanel(id);
    else if(action==='history')    openHistory(id);
    else if(action==='toggle-focus-trim')  toggleFocusTrimestral(id);
    else if(action==='toggle-focus-mensal') toggleFocusMensal(id);
    else if(action==='open-valor') openValorModal(id);
    else if(action==='complete-marco') completeMarco(id);
    else if(action==='open-subtasks')  openSubtaskModal(id);
    else if(action==='habito-checkin') habitCheckin(id);
    else if(action==='habito-undo')    habitUndo(id);
    else if(action==='open-score')     openScoreModal(id);
    else if(action==='toggle-notes')   toggleCollapsible(`notes-${id}`);
}

function handleTaskChange(e) {
    const s=e.target.closest('[data-action="status"]'); if(!s) return;
    const t=getTask(s.dataset.id);
    if(t) { t.taskStatus=s.value; saveState(); renderMetas(); updateDashboard(); }
}

function handleTaskInput(e) {
    const ta=e.target.closest('[data-action="notes"]'); if(!ta) return;
    const t=getTask(ta.dataset.id);
    if(t) { t.notes=ta.value; saveState(); }
}

function toggleCollapsible(key) {
    document.querySelector(`[data-toggle="${key}"]`)?.classList.toggle('visible');
}

function getTask(id) {
    for(const k of pillarOrder()) { const t=(state.tasks[k]||[]).find(t=>t.id===id); if(t) return t; }
    return null;
}
function getTaskPillar(id) {
    for(const k of pillarOrder()) { if((state.tasks[k]||[]).find(t=>t.id===id)) return k; }
    return null;
}

// ---- CHECKIN (CONTAGEM) ----
function checkinTask(id) {
    const t=(state.tasks[state.currentPillar]||[]).find(t=>t.id===id);
    if(!t||t.type!=='contagem') return;
    t.current++;
    t.checkins.push({ date:todayStr(), note:'' });
    if(t.taskStatus==='Pendente') t.taskStatus='Em progresso';
    const wasConc = t.current>=t.goal && t.taskStatus==='Em progresso';
    if(wasConc) t.taskStatus='Concluída';
    saveState(); renderMetas(); updateDashboard();
    if(wasConc) { showToast('Meta concluída! Parabéns!', 'success'); flashTask(id,'concluded-flash'); _checkAfterCheckin(id); }
    else { showToast('Check-in registrado ✓'); flashTask(id,'checkin-flash'); _checkAfterCheckin(id); }
    refreshHistoryIfOpen(id);
}

function flashTask(id, cls) {
    setTimeout(()=>{
        const el = document.querySelector(`.task-item[data-task-id="${id}"]`);
        if (el) { el.classList.add(cls); setTimeout(()=>el.classList.remove(cls), 1200); }
    }, 50);
}

function undoCheckin(id) {
    const t=(state.tasks[state.currentPillar]||[]).find(t=>t.id===id);
    if(!t||t.current<=0) return;
    t.current--;
    if(t.checkins.length) t.checkins.pop();
    if(t.taskStatus==='Concluída'&&t.current<t.goal) t.taskStatus='Em progresso';
    saveState(); renderMetas(); updateDashboard(); showToast('Check-in desfeito'); refreshHistoryIfOpen(id);
}

function deleteTask(id) {
    const k=getTaskPillar(id); if(k) state.tasks[k]=state.tasks[k].filter(t=>t.id!==id);
    saveState(); renderMetas(); updateDashboard();
}

// ---- FOCO TRIMESTRAL / MENSAL ----
function toggleFocusTrimestral(id) {
    const t=getTask(id); if(!t) return;
    if (!t.isFocusTrimestral) {
        // Check max 3
        const all=[]; pillarOrder().forEach(k=>(state.tasks[k]||[]).forEach(x=>all.push(x)));
        const count=all.filter(x=>x.isFocusTrimestral).length;
        if(count>=3) return showToast('Máximo 3 metas no Foco Trimestral');
    }
    t.isFocusTrimestral=!t.isFocusTrimestral;
    saveState(); renderMetas(); updateDashboard();
    showToast(t.isFocusTrimestral?'Adicionada ao Foco Trimestral':'Removida do Foco Trimestral');
    if(t.isFocusTrimestral) checkConquista('primeiro_foco');
}
function toggleFocusMensal(id) {
    const t=getTask(id); if(!t) return;
    if (!t.isFocusMensal) {
        const all=[]; pillarOrder().forEach(k=>(state.tasks[k]||[]).forEach(x=>all.push(x)));
        const count=all.filter(x=>x.isFocusMensal).length;
        if(count>=5) return showToast('Máximo 5 metas no Foco Mensal');
    }
    t.isFocusMensal=!t.isFocusMensal;
    saveState(); renderMetas(); updateDashboard();
    showToast(t.isFocusMensal?'Adicionada ao Foco Mensal':'Removida do Foco Mensal');
}

function renderFocoWidget() {
    const wrap=document.getElementById('foco-widget-wrap'); if(!wrap) return;
    const allTasks=[];
    pillarOrder().forEach(k=>(state.tasks[k]||[]).forEach(t=>allTasks.push({...t,pillarKey:k})));
    const trim=allTasks.filter(t=>t.isFocusTrimestral);
    const mensal=allTasks.filter(t=>t.isFocusMensal);
    if(!trim.length&&!mensal.length) { wrap.innerHTML=''; return; }

    const renderList=(items)=>items.map(t=>{
        const pct=Math.round(Math.min(1,getProgress(t))*100);
        const pName=state.config.pillars[t.pillarKey]?.name||t.pillarKey;
        return `<div class="foco-item">
            <span class="foco-item-name">${escHtml(t.text)}</span>
            <span class="foco-item-pillar">${escHtml(pName)}</span>
            <span class="foco-item-pct">${pct}%</span>
        </div>`;
    }).join('');

    wrap.innerHTML=`<div class="foco-widget">
        <div class="foco-widget-header">
            <div>
                <div class="foco-widget-title">Foco Estratégico</div>
                <div class="foco-widget-sub">Prioridades declaradas</div>
            </div>
            <div class="foco-tabs">
                <button class="foco-tab active" id="foco-tab-trim">Trimestral</button>
                <button class="foco-tab" id="foco-tab-mensal">Mensal</button>
            </div>
        </div>
        <div id="foco-list-trim" class="foco-list">${trim.length?renderList(trim):'<div class="foco-empty">Nenhuma meta marcada. Use o menu ··· em uma meta para adicionar.<br><span class="foco-empty-cta" onclick="switchSection(\'metas\')">Ir para Metas</span></div>'}</div>
        <div id="foco-list-mensal" class="foco-list" style="display:none">${mensal.length?renderList(mensal):'<div class="foco-empty">Nenhuma meta marcada. Use o menu ··· em uma meta para adicionar.<br><span class="foco-empty-cta" onclick="switchSection(\'metas\')">Ir para Metas</span></div>'}</div>
    </div>`;

    wrap.querySelector('#foco-tab-trim')?.addEventListener('click',()=>{
        wrap.querySelector('#foco-tab-trim').classList.add('active');
        wrap.querySelector('#foco-tab-mensal').classList.remove('active');
        wrap.querySelector('#foco-list-trim').style.display='';
        wrap.querySelector('#foco-list-mensal').style.display='none';
    });
    wrap.querySelector('#foco-tab-mensal')?.addEventListener('click',()=>{
        wrap.querySelector('#foco-tab-mensal').classList.add('active');
        wrap.querySelector('#foco-tab-trim').classList.remove('active');
        wrap.querySelector('#foco-list-mensal').style.display='';
        wrap.querySelector('#foco-list-trim').style.display='none';
    });
}

// ---- VALOR ----
let _valorId=null;
function openValorModal(id) {
    _valorId=id;
    const t=getTask(id); if(!t) return;
    document.getElementById('valor-modal-title').textContent=`Registrar: ${t.text}`;
    document.getElementById('valor-modal-sub').textContent=`Atual: ${t.unit}${fmtNum(t.current)} → Objetivo: ${t.unit}${fmtNum(t.goal)}`;
    document.getElementById('valor-date').value=todayStr();
    document.getElementById('valor-input').value='';
    document.getElementById('valor-note').value='';
    document.getElementById('valor-modal')?.classList.remove('hidden');
    const btn=document.getElementById('valor-confirm-btn');
    const nb=btn.cloneNode(true); btn.parentNode.replaceChild(nb,btn);
    nb.addEventListener('click',()=>{
        const t2=getTask(_valorId); if(!t2) return;
        const amount=parseFloat(document.getElementById('valor-input')?.value);
        if(isNaN(amount)||amount<=0) return showToast('Informe um valor positivo');
        const date=document.getElementById('valor-date')?.value||todayStr();
        const note=document.getElementById('valor-note')?.value.trim()||'';
        t2.current=parseFloat((t2.current+amount).toFixed(10));
        t2.valueEntries.push({ date, amount, note, running:t2.current });
        t2.valueEntries.sort((a,b)=>a.date.localeCompare(b.date));
        // Recalc all running totals in date order
        let running2=0;
        t2.valueEntries.forEach(e=>{ running2=parseFloat((running2+e.amount).toFixed(10)); e.running=running2; });
        t2.current=running2;
        if(t2.taskStatus==='Pendente') t2.taskStatus='Em progresso';
        if(t2.current>=t2.goal&&t2.taskStatus==='Em progresso') t2.taskStatus='Concluída';
        saveState(); renderMetas(); updateDashboard();
        document.getElementById('valor-modal')?.classList.add('hidden');
        showToast('Valor registrado ✓');
        refreshHistoryIfOpen(_valorId);
    });
}

// ---- MARCO ----
function completeMarco(id) {
    const t=getTask(id); if(!t) return;
    if(t.taskStatus==='Concluída') { t.taskStatus='Em progresso'; showToast('Marco reaberto'); }
    else { t.taskStatus='Concluída'; t.checkins.push({ date:todayStr(), note:'' }); showToast('Marco concluído'); }
    saveState(); renderMetas(); updateDashboard();
}

// ---- SUBTASKS ----
let _subtaskId=null;
function openSubtaskModal(id) {
    _subtaskId=id;
    const t=getTask(id); if(!t) return;
    document.getElementById('subtask-modal-title').textContent=`Subtarefas: ${t.text}`;
    renderSubtaskList(t);
    document.getElementById('subtask-modal')?.classList.remove('hidden');
    document.getElementById('subtask-input')?.focus();
}
function renderSubtaskList(t) {
    const list=document.getElementById('subtask-list'); if(!list) return;
    if(!t.subtasks.length) { list.innerHTML='<p class="subtask-empty">Adicione subtarefas abaixo.</p>'; return; }
    list.innerHTML=t.subtasks.map(s=>`
        <div class="subtask-row${s.done?' done':''}">
            <button class="subtask-check" data-action="toggle-sub" data-sid="${s.id}">${s.done?'✓':'○'}</button>
            <span class="subtask-text">${escHtml(s.text)}</span>
            <button class="subtask-del" data-action="del-sub" data-sid="${s.id}">✕</button>
        </div>`).join('');
}
function handleSubtaskClick(e) {
    const b=e.target.closest('[data-action]'); if(!b) return;
    const t=getTask(_subtaskId); if(!t) return;
    if(b.dataset.action==='toggle-sub') { const s=t.subtasks.find(s=>s.id===b.dataset.sid); if(s) { s.done=!s.done; if(t.subtasks.length&&t.subtasks.every(s=>s.done)&&t.taskStatus!=='Concluída') { t.taskStatus='Concluída'; showToast('Todas subtarefas concluídas'); } } }
    else if(b.dataset.action==='del-sub') { t.subtasks=t.subtasks.filter(s=>s.id!==b.dataset.sid); }
    saveState(); renderSubtaskList(t); renderMetas();
}
function addSubtask() {
    const inp=document.getElementById('subtask-input'); const txt=inp?.value.trim(); if(!txt) return;
    const t=getTask(_subtaskId); if(!t) return;
    t.subtasks.push({ id:genId(), text:txt, done:false });
    saveState(); renderSubtaskList(t); renderMetas(); inp.value=''; inp.focus();
}
function closeSubtaskModal() { document.getElementById('subtask-modal')?.classList.add('hidden'); _subtaskId=null; }

// ---- HABITO ----
function habitCheckin(id) {
    const t=getTask(id); if(!t||t.type!=='habito') return;
    t.habitCheckins.push(todayStr());
    if(t.taskStatus==='Pendente') t.taskStatus='Em progresso';
    saveState(); renderMetas(); updateDashboard(); showToast('Ocorrência registrada ✓'); refreshHistoryIfOpen(id);
}
function habitUndo(id) {
    const t=getTask(id); if(!t||!t.habitCheckins.length) return;
    const today=todayStr();
    const idx=t.habitCheckins.lastIndexOf(today);
    if(idx>=0) t.habitCheckins.splice(idx,1); else t.habitCheckins.pop();
    saveState(); renderMetas(); updateDashboard(); showToast('Ocorrência desfeita'); refreshHistoryIfOpen(id);
}
function getHabitWeekData(t,numWeeks) {
    const now=new Date(), weeks=[];
    for(let w=0;w<numWeeks;w++) {
        const d=new Date(now); d.setDate(d.getDate()-w*7);
        const wn=getISOWeek(d), yr=d.getFullYear();
        const count=t.habitCheckins.filter(c=>{
            const cd=new Date(c+'T12:00:00');
            return getISOWeek(cd)===wn && cd.getFullYear()===yr;
        }).length;
        const met=t.habitMode==='min'?count>=t.habitLimit:count<=t.habitLimit;
        weeks.push({ week:wn, year:yr, count, met });
    }
    return weeks.reverse();
}
function getHabitThisWeek(t) {
    const now=new Date(), wn=getISOWeek(now), yr=now.getFullYear();
    return t.habitCheckins.filter(c=>{ const cd=new Date(c+'T12:00:00'); return getISOWeek(cd)===wn&&cd.getFullYear()===yr; }).length;
}
function getHabitStreak(t) {
    let streak=0;
    for(let w=1;w<52;w++) {
        const d=new Date(); d.setDate(d.getDate()-w*7);
        const wn=getISOWeek(d), yr=d.getFullYear();
        const count=t.habitCheckins.filter(c=>{ const cd=new Date(c+'T12:00:00'); return getISOWeek(cd)===wn&&cd.getFullYear()===yr; }).length;
        const met=t.habitMode==='min'?count>=t.habitLimit:count<=t.habitLimit;
        if(met) streak++; else break;
    }
    return streak;
}

// ---- SCORE ----
let _scoreId=null;
function openScoreModal(id) {
    _scoreId=id;
    const t=getTask(id); if(!t) return;
    document.getElementById('score-modal-title').textContent=`Registrar: ${t.text}`;
    document.getElementById('score-modal-sub').textContent=`Meta: ${t.scoreGoal} · Direção: ${t.scoreDirection==='higher'?'↑ maior melhor':'↓ menor melhor'}`;
    document.getElementById('score-date').value=todayStr();
    document.getElementById('score-input').value='';
    document.getElementById('score-note').value='';
    document.getElementById('score-modal')?.classList.remove('hidden');
    const btn=document.getElementById('score-confirm-btn');
    const nb=btn.cloneNode(true); btn.parentNode.replaceChild(nb,btn);
    nb.addEventListener('click',()=>{
        const t2=getTask(_scoreId); if(!t2) return;
        const value=parseFloat(document.getElementById('score-input')?.value);
        if(isNaN(value)) return showToast('Valor inválido');
        const date=document.getElementById('score-date')?.value||todayStr();
        const note=document.getElementById('score-note')?.value.trim()||'';
        t2.scoreEntries.push({ date, value, note });
        t2.scoreEntries.sort((a,b)=>a.date.localeCompare(b.date));
        if(t2.taskStatus==='Pendente') t2.taskStatus='Em progresso';
        saveState(); renderMetas(); updateDashboard();
        document.getElementById('score-modal')?.classList.add('hidden');
        showToast('Score registrado ✓');
        refreshHistoryIfOpen(_scoreId);
    });
}

let _metasView = 'list'; // 'list' | 'gantt'

function toggleMetasView(v) {
    _metasView = v;
    document.getElementById('metas-view-list-btn')?.classList.toggle('active', v==='list');
    document.getElementById('metas-view-gantt-btn')?.classList.toggle('active', v==='gantt');
    renderMetas();
}

function renderMetas() {
    const list=document.getElementById('tasks-list');
    const pt=document.getElementById('pillar-title');
    const tc=document.getElementById('tasks-count');
    if(!list) return;
    const k=state.currentPillar, p=state.config.pillars[k];
    if(pt) pt.textContent=p?.name||'—';
    const tasks=state.tasks[k]||[];
    const done=tasks.filter(t=>t.taskStatus==='Concluída').length;
    if(tc) tc.textContent=`${done}/${tasks.length} concluídas`;

    // Render onboarding
    renderOnboarding();
    renderPilarStats();

    if (_metasView === 'gantt') {
        list.innerHTML = renderMetasGanttView(tasks, k);
        return;
    }

    const allTasks=tasks;
    if(!allTasks.length) {
        list.innerHTML=`<div class="empty-rich">
            <div class="empty-rich-title">Nenhuma meta em ${p?.name||'este pilar'}</div>
            <div class="empty-rich-sub">Escolha um tipo de meta abaixo para começar.</div>
            <div class="empty-types-grid">
                <div class="empty-type-card" onclick="openAddWithType('contagem')">
                    <div class="empty-type-name">Contagem</div>
                    <div class="empty-type-desc">Acompanhe um número que cresce. Ex: livros lidos, km corridos, artigos escritos.</div>
                </div>
                <div class="empty-type-card" onclick="openAddWithType('valor')">
                    <div class="empty-type-name">Valor acumulado</div>
                    <div class="empty-type-desc">Rastreie valores financeiros ou quantitativos. Ex: R$ investidos, patrimônio, peso perdido.</div>
                </div>
                <div class="empty-type-card" onclick="openAddWithType('marco')">
                    <div class="empty-type-name">Marco</div>
                    <div class="empty-type-desc">Meta binária — concluída ou não. Ex: publicar um livro, tirar carteira, montar empresa.</div>
                </div>
                <div class="empty-type-card" onclick="openAddWithType('habito')">
                    <div class="empty-type-name">Hábito periódico</div>
                    <div class="empty-type-desc">Monitore frequência semanal. Ex: treinar ≥4x/sem, limitar redes ≤1h/dia.</div>
                </div>
                <div class="empty-type-card" onclick="openAddWithType('score')">
                    <div class="empty-type-name">Score / Qualidade</div>
                    <div class="empty-type-desc">Registre avaliações numéricas. Ex: qualidade do sono de 0–10, nível de energia.</div>
                </div>
            </div>
        </div>`;
        return;
    }

    const pw={high:3,medium:2,low:1};
    let sorted=[...allTasks].sort((a,b)=>{
        const af=['Concluída','Encerrada'].includes(a.taskStatus), bf=['Concluída','Encerrada'].includes(b.taskStatus);
        if(af!==bf) return af?1:-1;
        const pd=(pw[b.priority]||0)-(pw[a.priority]||0);
        if(pd!==0) return pd;
        if(a.deadline&&b.deadline) return a.deadline.localeCompare(b.deadline);
        return a.deadline?-1:1;
    });

    // Apply focus mode (only Atrasada + Em Risco)
    if (state.focusMode) {
        sorted = sorted.filter(t => { const s=calcStatus(t); return s.css==='off-track'||s.css==='at-risk'; });
    }
    // Apply status filter
    if (state.filterStatus !== 'all') {
        sorted = sorted.filter(t => calcStatus(t).css === state.filterStatus);
    }
    // Apply type filter
    if (state.filterType !== 'all') {
        sorted = sorted.filter(t => t.type === state.filterType);
    }

    if (!sorted.length) {
        list.innerHTML='<div class="empty-state"><p>Nenhuma meta encontrada</p><p class="empty-sub">Ajuste os filtros ou o modo foco.</p></div>';
        return;
    }
    list.innerHTML=sorted.map(t=>renderTaskItem(t)).join('');
}

function renderTaskItem(t) {
    const fin=['Concluída','Encerrada'].includes(t.taskStatus);
    const tracking=calcStatusDetail(t);
    const opts=TASK_STATUSES.map(s=>`<option value="${s}"${t.taskStatus===s?' selected':''}>${s}</option>`).join('');
    let body='', controls='';

    if(t.type==='contagem') {
        const pct=t.goal>0?Math.min(100,Math.round(t.current/t.goal*100)):0;
        const delta=calcDeltaRestante(t);
        const proj=calcProjection(t);
        const curve=renderMiniCurve(t);
        body=`
            <div class="task-progress-section">
                <div class="progress-row">
                    <div class="progress-bar-container"><div class="progress-bar${pct>=100?' complete':''}" style="width:${pct}%"></div></div>
                    <span class="progress-text">${t.current}/${t.goal} (${pct}%)</span>
                </div>
                ${tracking.hint?`<div class="status-hint">${escHtml(tracking.hint)}</div>`:''}
                ${delta?`<div class="delta-restante">Faltam <strong>${delta.falta}</strong> · ~${delta.ritmoNec}/dia necessário</div>`:''}
                ${proj?`<div class="projection-label ${proj.cls}">Projeção: ${proj.text}</div>`:''}
                ${curve}
            </div>`;
        controls=`
            <button class="checkin-btn" data-action="checkin" data-id="${t.id}">+ Check-in</button>
            ${t.current>0?`<button class="task-action-btn" data-action="undo" data-id="${t.id}">Desfazer</button>`:''}
            <button class="task-action-btn" data-action="history" data-id="${t.id}">Histórico</button>`;
    } else if(t.type==='valor') {
        const pct=t.goal>0?Math.min(100,Math.round(t.current/t.goal*100)):0;
        const delta=calcDeltaRestante(t);
        const proj=calcProjection(t);
        const curve=renderMiniCurve(t);
        body=`
            <div class="task-progress-section">
                <div class="valor-display">
                    <span class="valor-current">${t.unit}${fmtNum(t.current)}</span>
                    <span class="valor-arrow">→</span>
                    <span class="valor-goal">${t.unit}${fmtNum(t.goal)}</span>
                </div>
                <div class="progress-row">
                    <div class="progress-bar-container"><div class="progress-bar${pct>=100?' complete':''}" style="width:${pct}%"></div></div>
                    <span class="progress-text">${pct}%</span>
                </div>
                ${tracking.hint?`<div class="status-hint">${escHtml(tracking.hint)}</div>`:''}
                ${delta?`<div class="delta-restante">Faltam <strong>${t.unit}${delta.falta}</strong> · ~${t.unit}${delta.ritmoNec}/dia</div>`:''}
                ${proj?`<div class="projection-label ${proj.cls}">Projeção: ${proj.text}</div>`:''}
                ${curve}
            </div>`;
        controls=`
            <button class="checkin-btn" data-action="open-valor" data-id="${t.id}">+ Registrar aporte</button>
            <button class="task-action-btn" data-action="history" data-id="${t.id}">Extrato</button>`;
    } else if(t.type==='marco') {
        const done=t.taskStatus==='Concluída';
        const sd=t.subtasks.filter(s=>s.done).length, st=t.subtasks.length;
        body=`
            <div class="task-progress-section marco-progress">
                <div class="marco-status${done?' done':' pending'}">${done?'Concluído':'Pendente'}</div>
                ${st>0?`<span class="subtask-progress">${sd}/${st} subtarefas</span>`:''}
            </div>`;
        controls=`
            <button class="checkin-btn${done?' btn-reopen':''}" data-action="complete-marco" data-id="${t.id}">${done?'Reabrir':'Concluir'}</button>
            <button class="task-action-btn" data-action="open-subtasks" data-id="${t.id}">Subtarefas${st>0?` (${sd}/${st})`:''}</button>
            <button class="task-action-btn" data-action="history" data-id="${t.id}">Histórico</button>`;
    } else if(t.type==='habito') {
        const weeks=getHabitWeekData(t,8);
        const streak=getHabitStreak(t);
        const tw=getHabitThisWeek(t);
        const twMet=t.habitMode==='min'?tw>=t.habitLimit:tw<=t.habitLimit;
        const modeLabel=t.habitMode==='min'?`≥${t.habitLimit}×/sem`:`≤${t.habitLimit}×/sem`;
        body=`
            <div class="task-progress-section">
                <div class="habito-header-row">
                    <span class="habito-rule">${modeLabel}</span>
                    <span class="habito-thisweek${twMet?' met':' unmet'}">${tw} esta semana ${twMet?'OK':'—'}</span>
                </div>
                <div class="habito-mini-grid">${weeks.map(w=>`<div class="hw${w.met?' met':' unmet'}" title="Sem.${w.week}: ${w.count}×">${w.count}</div>`).join('')}</div>
            </div>`;
        controls=`
            <button class="checkin-btn" data-action="habito-checkin" data-id="${t.id}">+ Registrar</button>
            ${t.habitCheckins.length>0?`<button class="task-action-btn" data-action="habito-undo" data-id="${t.id}">Desfazer</button>`:''}
            <button class="task-action-btn" data-action="history" data-id="${t.id}">Histórico</button>`;
    } else if(t.type==='score') {
        const entries=t.scoreEntries||[];
        const recent=entries.slice(-7);
        const avg=recent.length?recent.reduce((a,e)=>a+e.value,0)/recent.length:null;
        const pct=avg!==null?(t.scoreDirection==='higher'?Math.min(100,Math.round(avg/t.scoreGoal*100)):Math.min(100,Math.round(t.scoreGoal/Math.max(0.01,avg)*100))):0;
        const dirLabel=t.scoreDirection==='higher'?'meta min.':'meta max.';
        body=`
            <div class="task-progress-section">
                <div class="score-display">
                    <span class="score-avg">${avg!==null?avg.toFixed(1):'—'}</span>
                    <span class="score-vs">${dirLabel} ${t.scoreGoal}</span>
                    ${entries.length?`<span class="score-count">${entries.length} registros</span>`:''}
                </div>
                <div class="progress-row">
                    <div class="progress-bar-container"><div class="progress-bar${pct>=100?' complete':''}" style="width:${pct}%"></div></div>
                    <span class="progress-text">${pct}%</span>
                </div>
            </div>`;
        controls=`
            <button class="checkin-btn" data-action="open-score" data-id="${t.id}">+ Registrar score</button>
            <button class="task-action-btn" data-action="history" data-id="${t.id}">Histórico</button>`;
    }

    const hasNotes = !!(t.notes && t.notes.trim());
    const isConcluded = ['Concluída','Encerrada'].includes(t.taskStatus);
    const focoClasses = (t.isFocusTrimestral?' foco-trimestral':'')+(t.isFocusMensal?' foco-mensal':'');

    // Streak scale for habito
    let streakHtml = '';
    if (t.type==='habito') {
        const streak = getHabitStreak(t);
        if (streak > 0) {
            const sc = streak>=16?'streak-s4':streak>=8?'streak-s3':streak>=4?'streak-s2':'streak-s1';
            streakHtml = `<span class="streak-badge ${sc}"><span class="streak-num">${streak}</span> sem.</span>`;
        }
    }

    // Focus badges
    const focoBadges = [
        t.isFocusTrimestral ? `<span class="focus-trim-badge trim">T</span>` : '',
        t.isFocusMensal     ? `<span class="focus-trim-badge mensal">M</span>` : ''
    ].join('');

    return `
    <li class="task-item priority-${t.priority}${fin?' finished':''} type-${t.type}${isConcluded?' is-concluded':''}${focoClasses}" data-task-id="${t.id}">
        <div class="task-header">
            <div class="task-content">
                <div class="task-title-row">
                    <span class="task-text">${escHtml(t.text)}</span>
                </div>
                ${t.whyImportant?`<div class="task-why-text">${escHtml(t.whyImportant)}</div>`:''}
                <div class="task-diag-col">
                    <span class="microlabel">Diagnóstico</span>
                    <div class="task-badges-primary">
                        ${isConcluded
                            ? `<span class="concluded-badge">Concluída</span>`
                            : `<span class="tracking-badge ${tracking.css}">${tracking.label}</span>`}
                        ${t.deadline?`<span class="deadline-badge">${fmtDate(t.deadline)}</span>`:''}
                        ${focoBadges}
                        ${streakHtml}
                    </div>
                    <div class="task-badges-secondary">
                        <span class="type-badge type-${t.type}">${TYPE_LABELS[t.type]}</span>
                        <span class="priority-badge ${t.priority}">${t.priority==='high'?'Alta':t.priority==='medium'?'Média':'Baixa'}</span>
                    </div>
                </div>
            </div>
            <div class="task-status-col">
                <span class="microlabel" style="text-align:right">Operacional</span>
                <select class="status-select" data-action="status" data-id="${t.id}" title="Status operacional">${opts}</select>
            </div>
            <div class="task-menu-wrap">
                <button class="task-menu-btn" title="Ações">···</button>
                <div class="task-menu-dropdown">
                    <button class="task-menu-item" data-action="edit" data-id="${t.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Editar
                    </button>
                    <button class="task-menu-item" data-action="toggle-focus-trim" data-id="${t.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        ${t.isFocusTrimestral?'Remover do Foco Trimestral':'Foco Trimestral'}
                    </button>
                    <button class="task-menu-item" data-action="toggle-focus-mensal" data-id="${t.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${t.isFocusMensal?'Remover do Foco Mensal':'Foco Mensal'}
                    </button>
                    <button class="task-menu-item" data-action="toggle-notes" data-id="${t.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        Notas${hasNotes?'<span class="notes-dot"></span>':''}
                    </button>
                    <button class="task-menu-item" data-action="history" data-id="${t.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Histórico
                    </button>
                    <button class="task-menu-item danger" data-action="delete" data-id="${t.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Remover
                    </button>
                </div>
            </div>
        </div>
        ${body}
        <div class="task-controls">
            ${controls}
        </div>
        <div class="collapsible-section" data-toggle="notes-${t.id}">
            <textarea data-action="notes" data-id="${t.id}" placeholder="Anotações, contexto, bloqueios...">${escHtml(t.notes||'')}</textarea>
        </div>
    </li>`;
}

// ---- HISTORY PANEL ----
function openHistory(id) {
    const t=getTask(id); if(!t) return;
    _historyId=id;
    const title=document.getElementById('history-title');
    const badge=document.getElementById('history-type-badge');
    const content=document.getElementById('history-content');
    if(title) title.textContent=t.text;
    if(badge) { badge.textContent=TYPE_LABELS[t.type]; badge.className=`type-badge type-${t.type}`; }
    if(content) content.innerHTML=renderHistoryContent(t);
    openSidePanel('history-overlay');
}

function renderHistoryContent(t) {
    if(t.type==='contagem') return renderContagemHistory(t);
    if(t.type==='valor')    return renderValorHistory(t);
    if(t.type==='marco')    return renderMarcoHistory(t);
    if(t.type==='habito')   return renderHabitoHistory(t);
    if(t.type==='score')    return renderScoreHistory(t);
    return '<p class="empty-state">Sem histórico disponível.</p>';
}

function renderContagemHistory(t) {
    // Monthly calendar-style contribution grid
    const checkins=t.checkins||[];
    const dateMap={};
    checkins.forEach(c=>{ const d=typeof c==='string'?c:c.date; if(d) dateMap[d]=(dateMap[d]||0)+1; });
    // Get last 6 months
    const months=[];
    const now=new Date();
    for(let m=5;m>=0;m--) { const d=new Date(now.getFullYear(),now.getMonth()-m,1); months.push({ year:d.getFullYear(), month:d.getMonth(), label:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) }); }

    const totalCheckins=checkins.length;
    const daysActive=Object.keys(dateMap).length;
    const max=Math.max(1,...Object.values(dateMap));

    let html=`<div class="hist-summary-row">
        <div class="hist-stat"><span class="hist-stat-val">${totalCheckins}</span><span class="hist-stat-label">check-ins total</span></div>
        <div class="hist-stat"><span class="hist-stat-val">${daysActive}</span><span class="hist-stat-label">dias ativos</span></div>
        <div class="hist-stat"><span class="hist-stat-val">${t.current}/${t.goal}</span><span class="hist-stat-label">progresso</span></div>
    </div>`;

    html+=`<div class="hist-add-retro">
        <span class="hist-section-label">Registrar em data anterior</span>
        <div class="hist-retro-row">
            <input type="date" id="retro-date-${t.id}" max="${todayStr()}" value="${todayStr()}">
            <input type="number" id="retro-qty-${t.id}" placeholder="Qtd" min="1" value="1" style="width:70px">
            <button class="btn-secondary" data-action="retro-add" data-id="${t.id}">+ Adicionar</button>
        </div>
    </div>`;

    // List of individual checkins with delete buttons
    const sortedCheckins=[...checkins].sort((a,b)=>{
        const da=typeof a==='string'?a:a.date, db=typeof b==='string'?b:b.date;
        return db.localeCompare(da);
    });
    html+=`<div class="hist-section-label" style="margin-top:16px">Registros individuais</div>
    <div class="hist-extrato">
        ${sortedCheckins.slice(0,50).map((c,i)=>{
            const d=typeof c==='string'?c:c.date;
            const note=typeof c==='string'?'':c.note||'';
            const realIdx=checkins.length-1-i; // reverse index for deletion
            return `<div class="extrato-row">
                <div class="extrato-left">
                    <span class="extrato-date">${fmtDate(d)}</span>
                    ${note?`<span class="extrato-note">${escHtml(note)}</span>`:''}
                </div>
                <div class="extrato-right">
                    <button class="hist-del-btn" data-action="del-checkin" data-id="${t.id}" data-idx="${realIdx}" title="Excluir">✕</button>
                </div>
            </div>`;
        }).join('')}
    </div>`;

    html+=`<div class="hist-section-label" style="margin-top:16px">Atividade mensal <span class="hist-cal-hint">— clique num dia para registrar/remover check-in</span></div>`;
    months.forEach(({year,month,label})=>{
        const daysInMonth=new Date(year,month+1,0).getDate();
        const firstDay=(new Date(year,month,1).getDay()+6)%7; // 0=Mon
        const monthTotal=Object.entries(dateMap).filter(([d])=>d.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).reduce((a,[,v])=>a+v,0);
        html+=`<div class="hist-month">
            <div class="hist-month-label">${label} <span class="hist-month-count">${monthTotal>0?`${monthTotal} check-ins`:''}</span></div>
            <div class="hist-cal-grid">
                <div class="hist-cal-dow">S</div><div class="hist-cal-dow">T</div><div class="hist-cal-dow">Q</div>
                <div class="hist-cal-dow">Q</div><div class="hist-cal-dow">S</div><div class="hist-cal-dow">S</div><div class="hist-cal-dow">D</div>
                ${Array(firstDay).fill('<div class="hist-cal-empty"></div>').join('')}
                ${Array.from({length:daysInMonth},(_,i)=>{
                    const d=`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
                    const n=dateMap[d]||0;
                    const intensity=n===0?'zero':n>=max*0.75?'high':n>=max*0.4?'med':'low';
                    const isFuture=d>todayStr();
                    return `<div class="hist-cal-day ${isFuture?'future':intensity}${isFuture?'':' clickable-day'}" data-action="cal-toggle" data-id="${t.id}" data-date="${d}" data-count="${n}" title="${d}${n>0?': '+n+' check-in(s)':''}">${i+1}</div>`;
                }).join('')}
            </div>
        </div>`;
    });
    return html;
}

function renderValorHistory(t) {
    const entries=t.valueEntries||[];
    let html=`<div class="hist-summary-row">
        <div class="hist-stat"><span class="hist-stat-val">${t.unit}${fmtNum(t.current)}</span><span class="hist-stat-label">acumulado</span></div>
        <div class="hist-stat"><span class="hist-stat-val">${t.unit}${fmtNum(t.goal)}</span><span class="hist-stat-label">objetivo</span></div>
        <div class="hist-stat"><span class="hist-stat-val">${t.goal>0?Math.round(t.current/t.goal*100):0}%</span><span class="hist-stat-label">progresso</span></div>
    </div>`;

    html+=`<div class="hist-add-retro">
        <span class="hist-section-label">Registrar aporte retroativo</span>
        <div class="hist-retro-row">
            <input type="date" id="retro-valor-date-${t.id}" max="${todayStr()}" value="${todayStr()}">
            <input type="number" id="retro-valor-amt-${t.id}" placeholder="Valor" min="0" step="any">
            <input type="text" id="retro-valor-note-${t.id}" placeholder="Observação..." style="min-width:100px">
            <button class="btn-secondary" data-action="retro-valor" data-id="${t.id}">+ Adicionar</button>
        </div>
    </div>`;

    if(!entries.length) { html+='<p class="hist-empty">Nenhum registro ainda.</p>'; return html; }

    // Mini sparkline from entries
    const sortedE=[...entries].sort((a,b)=>a.date.localeCompare(b.date));
    const maxRunning=Math.max(...sortedE.map(e=>e.running||0), t.goal);
    html+=`<div class="hist-section-label" style="margin-top:16px">Curva de evolução</div>
    <div class="valor-sparkline">
        ${sortedE.map((e,i)=>{
            const h=Math.max(8,Math.round((e.running||0)/maxRunning*80));
            return `<div class="vs-bar" style="height:${h}px" title="${e.date}: +${t.unit}${fmtNum(e.amount)} (total: ${t.unit}${fmtNum(e.running||0)})"></div>`;
        }).join('')}
        <div class="vs-goal-line" style="bottom:${Math.round(t.goal/maxRunning*80)}px" title="Objetivo: ${t.unit}${fmtNum(t.goal)}"></div>
    </div>`;

    html+=`<div class="hist-section-label" style="margin-top:16px">Extrato de aportes</div>
    <div class="hist-extrato">
        ${[...sortedE].reverse().map((e,i)=>`
        <div class="extrato-row">
            <div class="extrato-left">
                <span class="extrato-date">${fmtDate(e.date)}</span>
                ${e.note?`<span class="extrato-note">${escHtml(e.note)}</span>`:''}
            </div>
            <div class="extrato-right">
                <span class="extrato-amount">+${t.unit}${fmtNum(e.amount)}</span>
                <span class="extrato-running">${t.unit}${fmtNum(e.running||0)}</span>
                <button class="hist-del-btn" data-action="del-valor" data-id="${t.id}" data-idx="${sortedE.length-1-i}" title="Excluir">✕</button>
            </div>
        </div>`).join('')}
    </div>`;
    return html;
}

function renderMarcoHistory(t) {
    let html=`<div class="hist-summary-row">
        <div class="hist-stat"><span class="hist-stat-val">${t.taskStatus}</span><span class="hist-stat-label">status</span></div>
        <div class="hist-stat"><span class="hist-stat-val">${t.subtasks.filter(s=>s.done).length}/${t.subtasks.length}</span><span class="hist-stat-label">subtarefas</span></div>
        ${t.deadline?`<div class="hist-stat"><span class="hist-stat-val">${fmtDate(t.deadline)}</span><span class="hist-stat-label">prazo</span></div>`:''}
    </div>`;

    html+=`<div class="hist-section-label" style="margin-top:16px">Linha do tempo</div>
    <div class="timeline">
        <div class="tl-item"><div class="tl-dot created"></div><div class="tl-body"><span class="tl-label">Criada</span><span class="tl-date">${fmtDateLong(t.createdAt)}</span></div></div>
        ${t.subtasks.filter(s=>s.done).map(s=>`<div class="tl-item"><div class="tl-dot subtask"></div><div class="tl-body"><span class="tl-label">${escHtml(s.text)}</span><span class="tl-date">subtarefa concluída</span></div></div>`).join('')}
        ${t.taskStatus==='Concluída'?`<div class="tl-item"><div class="tl-dot done"></div><div class="tl-body"><span class="tl-label">Concluída</span><span class="tl-date">${t.checkins.length?fmtDate(typeof t.checkins[t.checkins.length-1]==='string'?t.checkins[t.checkins.length-1]:t.checkins[t.checkins.length-1].date||todayStr()):''}</span></div></div>`:''}
        ${t.deadline?`<div class="tl-item${new Date(t.deadline+'T12:00:00')<new Date()?' expired':''}"><div class="tl-dot deadline"></div><div class="tl-body"><span class="tl-label">Prazo</span><span class="tl-date">${fmtDate(t.deadline)}</span></div></div>`:''}
    </div>`;
    return html;
}

function renderHabitoHistory(t) {
    const weeks=getHabitWeekData(t,16);
    const streak=getHabitStreak(t);
    const compliance=weeks.length?Math.round(weeks.filter(w=>w.met).length/weeks.length*100):0;
    const modeLabel=t.habitMode==='min'?`Mínimo ${t.habitLimit}×/semana`:`Máximo ${t.habitLimit}×/semana`;

    let html=`<div class="hist-summary-row">
        <div class="hist-stat"><span class="hist-stat-val">${compliance}%</span><span class="hist-stat-label">compliance (16 sem.)</span></div>
        <div class="hist-stat"><span class="hist-stat-val">${streak}</span><span class="hist-stat-label">semanas seguidas</span></div>
        <div class="hist-stat"><span class="hist-stat-val">${t.habitCheckins.length}</span><span class="hist-stat-label">ocorrências total</span></div>
    </div>
    <div class="hist-habit-rule">${modeLabel}</div>`;

    html+=`<div class="hist-add-retro">
        <span class="hist-section-label">Registrar em semana anterior</span>
        <div class="hist-retro-row">
            <input type="week" id="retro-habito-week-${t.id}">
            <input type="number" id="retro-habito-qty-${t.id}" placeholder="Ocorrências" min="0" value="1" style="width:120px">
            <button class="btn-secondary" data-action="retro-habito" data-id="${t.id}">+ Adicionar</button>
        </div>
    </div>`;

    html+=`<div class="hist-section-label" style="margin-top:16px">Grade semanal (últimas 16 semanas)</div>
    <div class="hist-habit-grid">
        ${weeks.map(w=>`
        <div class="hhg-row">
            <span class="hhg-week">S${w.week}</span>
            <div class="hhg-bar-wrap">
                <div class="hhg-bar${w.met?' met':' unmet'}" style="width:${t.habitLimit>0?Math.min(100,Math.round(w.count/t.habitLimit*100)):0}%"></div>
            </div>
            <span class="hhg-count${w.met?' met':' unmet'}">${w.count}×</span>
            <span class="hhg-status">${w.met?'✓':'✗'}</span>
        </div>`).join('')}
    </div>`;

    html+=`<div class="hist-section-label" style="margin-top:16px">Calendário — clique para registrar/remover <span class="hist-cal-hint">(cada clique = 1 ocorrência)</span></div>`;
    const now2=new Date();
    const checkinSet=new Set(t.habitCheckins);
    for(let m=5;m>=0;m--) {
        const d=new Date(now2.getFullYear(),now2.getMonth()-m,1);
        const year=d.getFullYear(), month=d.getMonth();
        const label=d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
        const daysInMonth=new Date(year,month+1,0).getDate();
        const firstDay=(new Date(year,month,1).getDay()+6)%7;
        const monthStr=`${year}-${String(month+1).padStart(2,'0')}`;
        const monthCount=[...t.habitCheckins].filter(c=>c.startsWith(monthStr)).length;
        html+=`<div class="hist-month">
            <div class="hist-month-label">${label} <span class="hist-month-count">${monthCount>0?`${monthCount} ocorrências`:''}</span></div>
            <div class="hist-cal-grid">
                <div class="hist-cal-dow">S</div><div class="hist-cal-dow">T</div><div class="hist-cal-dow">Q</div>
                <div class="hist-cal-dow">Q</div><div class="hist-cal-dow">S</div><div class="hist-cal-dow">S</div><div class="hist-cal-dow">D</div>
                ${Array(firstDay).fill('<div class="hist-cal-empty"></div>').join('')}
                ${Array.from({length:daysInMonth},(_,i)=>{
                    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
                    const has=checkinSet.has(ds);
                    const isFuture=ds>todayStr();
                    return `<div class="hist-cal-day ${isFuture?'future':has?'high':'zero'}${isFuture?'':' clickable-day'}" data-action="cal-habito-toggle" data-id="${t.id}" data-date="${ds}" title="${ds}${has?' — registrado':''}">${i+1}</div>`;
                }).join('')}
            </div>
        </div>`;
    }
    const sortedHC=[...t.habitCheckins].sort((a,b)=>b.localeCompare(a));
    if(sortedHC.length) {
        html+=`<div class="hist-section-label" style="margin-top:16px">Registros individuais</div>
        <div class="hist-extrato">
            ${sortedHC.slice(0,50).map((d,i)=>`
            <div class="extrato-row">
                <div class="extrato-left"><span class="extrato-date">${fmtDate(d)}</span></div>
                <div class="extrato-right">
                    <button class="hist-del-btn" data-action="del-habito" data-id="${t.id}" data-idx="${t.habitCheckins.lastIndexOf(d)}" title="Excluir">✕</button>
                </div>
            </div>`).join('')}
        </div>`;
    }
    return html;
}

function renderScoreHistory(t) {
    const entries=[...(t.scoreEntries||[])].sort((a,b)=>a.date.localeCompare(b.date));
    const avg=entries.length?entries.reduce((a,e)=>a+e.value,0)/entries.length:null;
    const best=entries.length?(t.scoreDirection==='higher'?Math.max(...entries.map(e=>e.value)):Math.min(...entries.map(e=>e.value))):null;
    const recent7=entries.slice(-7);
    const avg7=recent7.length?recent7.reduce((a,e)=>a+e.value,0)/recent7.length:null;

    let html=`<div class="hist-summary-row">
        <div class="hist-stat"><span class="hist-stat-val">${avg!==null?avg.toFixed(1):'—'}</span><span class="hist-stat-label">média geral</span></div>
        <div class="hist-stat"><span class="hist-stat-val">${avg7!==null?avg7.toFixed(1):'—'}</span><span class="hist-stat-label">média (7 últ.)</span></div>
        <div class="hist-stat"><span class="hist-stat-val">${best!==null?best:'—'}</span><span class="hist-stat-label">${t.scoreDirection==='higher'?'melhor':'menor'}</span></div>
    </div>`;

    html+=`<div class="hist-add-retro">
        <span class="hist-section-label">Registrar em data anterior</span>
        <div class="hist-retro-row">
            <input type="date" id="retro-score-date-${t.id}" max="${todayStr()}" value="${todayStr()}">
            <input type="number" id="retro-score-val-${t.id}" placeholder="Valor" step="0.1">
            <input type="text" id="retro-score-note-${t.id}" placeholder="Obs..." style="min-width:80px">
            <button class="btn-secondary" data-action="retro-score" data-id="${t.id}">+ Adicionar</button>
        </div>
    </div>`;

    if(!entries.length) { html+='<p class="hist-empty">Nenhum registro ainda.</p>'; return html; }

    const maxV=Math.max(...entries.map(e=>e.value), t.scoreGoal)*1.1;
    html+=`<div class="hist-section-label" style="margin-top:16px">Evolução</div>
    <div class="score-chart">
        <div class="score-goal-line" style="bottom:${Math.round(t.scoreGoal/maxV*120)}px" title="Meta: ${t.scoreGoal}"></div>
        <div class="score-bars">
            ${entries.map(e=>{
                const h=Math.max(4,Math.round(e.value/maxV*120));
                const good=t.scoreDirection==='higher'?e.value>=t.scoreGoal:e.value<=t.scoreGoal;
                return `<div class="sc-bar${good?' good':' bad'}" style="height:${h}px" title="${e.date}: ${e.value}${e.note?' — '+e.note:''}"></div>`;
            }).join('')}
        </div>
    </div>`;

    html+=`<div class="hist-section-label" style="margin-top:16px">Registros</div>
    <div class="hist-extrato">
        ${[...entries].reverse().slice(0,30).map((e,i)=>`
        <div class="extrato-row">
            <div class="extrato-left"><span class="extrato-date">${fmtDate(e.date)}</span>${e.note?`<span class="extrato-note">${escHtml(e.note)}</span>`:''}</div>
            <div class="extrato-right">
                <span class="extrato-amount${t.scoreDirection==='higher'?e.value>=t.scoreGoal?' ok':' bad':e.value<=t.scoreGoal?' ok':' bad'}">${e.value}</span>
                <button class="hist-del-btn" data-action="del-score" data-id="${t.id}" data-idx="${entries.length-1-i}" title="Excluir">✕</button>
            </div>
        </div>`).join('')}
    </div>`;
    return html;
}

// ---- HISTORY CLICK (retro entries) ----
function handleHistoryClick(e) {
    const b=e.target.closest('[data-action]'); if(!b) return;
    const id=b.dataset.id, action=b.dataset.action;
    const t=getTask(id); if(!t) return;

    if(action==='retro-add') {
        const date=document.getElementById(`retro-date-${id}`)?.value;
        const qty=parseInt(document.getElementById(`retro-qty-${id}`)?.value)||1;
        if(!date) return showToast('Selecione uma data');
        if(date>todayStr()) return showToast('Data não pode ser futura');
        for(let i=0;i<qty;i++) { t.checkins.push({ date, note:'retroativo' }); t.current++; }
        if(t.taskStatus==='Pendente') t.taskStatus='Em progresso';
        if(t.current>=t.goal&&t.taskStatus==='Em progresso') t.taskStatus='Concluída';
        saveState(); renderMetas(); updateDashboard();
        document.getElementById('history-content').innerHTML=renderHistoryContent(t);
        showToast(`${qty} check-in(s) adicionado(s) em ${fmtDate(date)} ✓`);
    } else if(action==='retro-valor') {
        const date=document.getElementById(`retro-valor-date-${id}`)?.value;
        const amt=parseFloat(document.getElementById(`retro-valor-amt-${id}`)?.value);
        const note=document.getElementById(`retro-valor-note-${id}`)?.value.trim()||'';
        if(!date||isNaN(amt)||amt<=0) return showToast('Preencha data e valor');
        t.current=parseFloat((t.current+amt).toFixed(10));
        t.valueEntries.push({ date, amount:amt, note, running:t.current });
        t.valueEntries.sort((a,b)=>a.date.localeCompare(b.date));
        // Recalc running totals
        let running=0;
        t.valueEntries.forEach(e=>{ running=parseFloat((running+e.amount).toFixed(10)); e.running=running; });
        t.current=running;
        if(t.taskStatus==='Pendente') t.taskStatus='Em progresso';
        if(t.current>=t.goal&&t.taskStatus==='Em progresso') t.taskStatus='Concluída';
        saveState(); renderMetas(); updateDashboard();
        document.getElementById('history-content').innerHTML=renderHistoryContent(t);
        showToast('Aporte retroativo adicionado ✓');
    } else if(action==='retro-habito') {
        const weekVal=document.getElementById(`retro-habito-week-${id}`)?.value;
        const qty=parseInt(document.getElementById(`retro-habito-qty-${id}`)?.value)||1;
        if(!weekVal) return showToast('Selecione uma semana');
        const [yr,wn]=weekVal.split('-W'); const year=parseInt(yr), week=parseInt(wn);
        // Add entries for that week (use Monday of that week)
        const jan4=new Date(year,0,4);
        const monday=new Date(jan4.getTime()+(week-1)*7*86400000-(((jan4.getDay()+6)%7)*86400000));
        for(let i=0;i<qty;i++) {
            const d=new Date(monday); d.setDate(d.getDate()+i%7);
            if(d>new Date()) continue;
            t.habitCheckins.push(d.toISOString().split('T')[0]);
        }
        if(t.taskStatus==='Pendente') t.taskStatus='Em progresso';
        saveState(); renderMetas(); updateDashboard();
        document.getElementById('history-content').innerHTML=renderHistoryContent(t);
        showToast('Registros adicionados ✓');
    } else if(action==='cal-toggle') {
        // Click on calendar day — toggle checkin for that date
        const date = b.dataset.date;
        const count = parseInt(b.dataset.count)||0;
        if (!date) return;
        if (count > 0) {
            // Has checkins — remove last one for this date
            const idx = t.checkins.findLastIndex
                ? t.checkins.findLastIndex(c=>(typeof c==='string'?c:c.date)===date)
                : [...t.checkins].reverse().findIndex(c=>(typeof c==='string'?c:c.date)===date);
            const realIdx = t.checkins.findLastIndex
                ? idx
                : t.checkins.length - 1 - idx;
            if (realIdx >= 0) {
                t.checkins.splice(realIdx, 1);
                t.current = Math.max(0, t.current - 1);
                if (t.taskStatus==='Concluída' && t.current < t.goal) t.taskStatus='Em progresso';
            }
        } else {
            // No checkins — add one
            t.checkins.push({ date, note:'retroativo' });
            t.current++;
            if (t.taskStatus==='Pendente') t.taskStatus='Em progresso';
            if (t.current >= t.goal && t.taskStatus==='Em progresso') t.taskStatus='Concluída';
        }
        saveState(); renderMetas(); updateDashboard();
        document.getElementById('history-content').innerHTML = renderHistoryContent(t);
    } else if(action==='cal-habito-toggle') {
        const date = b.dataset.date;
        const hasCheckin = t.habitCheckins.includes(date);
        if (hasCheckin) {
            const idx = t.habitCheckins.lastIndexOf(date);
            if (idx >= 0) t.habitCheckins.splice(idx, 1);
        } else {
            t.habitCheckins.push(date);
            t.habitCheckins.sort();
            if (t.taskStatus==='Pendente') t.taskStatus='Em progresso';
        }
        saveState(); renderMetas(); updateDashboard();
        document.getElementById('history-content').innerHTML = renderHistoryContent(t);

    } else if(action==='retro-score') {
        const date=document.getElementById(`retro-score-date-${id}`)?.value;
        const value=parseFloat(document.getElementById(`retro-score-val-${id}`)?.value);
        const note=document.getElementById(`retro-score-note-${id}`)?.value.trim()||'';
        if(!date||isNaN(value)) return showToast('Preencha data e valor');
        t.scoreEntries.push({ date, value, note });
        t.scoreEntries.sort((a,b)=>a.date.localeCompare(b.date));
        if(t.taskStatus==='Pendente') t.taskStatus='Em progresso';
        saveState(); renderMetas(); updateDashboard();
        document.getElementById('history-content').innerHTML=renderHistoryContent(t);
        showToast('Score retroativo adicionado ✓');

    } else if(action==='del-checkin') {
        const idx=parseInt(b.dataset.idx);
        showConfirm('Excluir este check-in?', ()=>{
            if(idx>=0&&idx<t.checkins.length) {
                t.checkins.splice(idx,1);
                t.current=Math.max(0,t.current-1);
                if(t.taskStatus==='Concluída'&&t.current<t.goal) t.taskStatus='Em progresso';
            }
            saveState(); renderMetas(); updateDashboard();
            document.getElementById('history-content').innerHTML=renderHistoryContent(t);
            showToast('Registro excluído');
        });

    } else if(action==='del-valor') {
        const idx=parseInt(b.dataset.idx);
        showConfirm('Excluir este aporte?', ()=>{
            if(idx>=0&&idx<t.valueEntries.length) {
                t.valueEntries.splice(idx,1);
                // Recalculate running totals and current
                let running=0;
                t.valueEntries.sort((a,bb)=>a.date.localeCompare(bb.date));
                t.valueEntries.forEach(e=>{ running=parseFloat((running+e.amount).toFixed(10)); e.running=running; });
                t.current=running;
                if(t.taskStatus==='Concluída'&&t.current<t.goal) t.taskStatus='Em progresso';
            }
            saveState(); renderMetas(); updateDashboard();
            document.getElementById('history-content').innerHTML=renderHistoryContent(t);
            showToast('Aporte excluído');
        });

    } else if(action==='del-habito') {
        const idx=parseInt(b.dataset.idx);
        showConfirm('Excluir este registro?', ()=>{
            if(idx>=0&&idx<t.habitCheckins.length) {
                t.habitCheckins.splice(idx,1);
            }
            saveState(); renderMetas(); updateDashboard();
            document.getElementById('history-content').innerHTML=renderHistoryContent(t);
            showToast('Registro excluído');
        });

    } else if(action==='del-score') {
        const idx=parseInt(b.dataset.idx);
        showConfirm('Excluir este score?', ()=>{
            if(idx>=0&&idx<t.scoreEntries.length) {
                t.scoreEntries.splice(idx,1);
            }
            saveState(); renderMetas(); updateDashboard();
            document.getElementById('history-content').innerHTML=renderHistoryContent(t);
            showToast('Score excluído');
        });
    }
}

// ---- EDIT PANEL ----
let _editId=null, _historyId=null;

function refreshHistoryIfOpen(id) {
    if (!_historyId||_historyId!==id) return;
    const overlay=document.getElementById('history-overlay');
    if (!overlay||overlay.classList.contains('hidden')) return;
    const t=getTask(id); if(!t) return;
    const content=document.getElementById('history-content');
    if (content) content.innerHTML=renderHistoryContent(t);
}
function openEditPanel(id) {
    _editId=id;
    const t=getTask(id); if(!t) return;
    const body=document.getElementById('edit-task-body'); if(!body) return;
    body.innerHTML=`
    <div class="edit-form">
        <div class="settings-field"><label>Nome</label><input type="text" id="edit-text" value="${escHtml(t.text)}"></div>
        <div class="settings-field"><label>Por que esta meta importa</label><input type="text" id="edit-why" value="${escHtml(t.whyImportant||'')}" placeholder="Opcional — a razão estratégica desta meta"></div>
        <div class="settings-field"><label>Prioridade</label>
            <select id="edit-priority">
                <option value="low"${t.priority==='low'?' selected':''}>Baixa</option>
                <option value="medium"${t.priority==='medium'?' selected':''}>Média</option>
                <option value="high"${t.priority==='high'?' selected':''}>Alta</option>
            </select>
        </div>
        <div class="settings-field"><label>Prazo</label><input type="date" id="edit-deadline" value="${t.deadline||''}"></div>
        <div class="settings-field"><label>Data de início</label><input type="date" id="edit-startdate" value="${t.startDate||''}"></div>
        <div class="settings-field"><label>Status</label>
            <select id="edit-status">${TASK_STATUSES.map(s=>`<option value="${s}"${t.taskStatus===s?' selected':''}>${s}</option>`).join('')}</select>
        </div>
        ${(t.type==='contagem')?`<div class="settings-field"><label>Objetivo (quantidade total)</label><input type="number" id="edit-goal" value="${t.goal}" min="1"></div><div class="settings-hint">Progresso atual (${t.current} registros) é editável apenas pelo Histórico — use "Registrar em data anterior" ou exclua registros individuais.</div>`:'' }
        ${(t.type==='valor')?`<div class="settings-field"><label>Objetivo (${t.unit||'valor'})</label><input type="number" id="edit-goal" value="${t.goal}" min="0" step="any"></div><div class="settings-field"><label>Unidade</label><input type="text" id="edit-unit" value="${escHtml(t.unit||'')}"></div><div class="settings-hint">Total acumulado (${t.unit}${fmtNum(t.current)}) é calculado pelos aportes registrados no Histórico.</div>`:'' }
        ${(t.type==='habito')?`<div class="settings-field"><label>Limite semanal</label><input type="number" id="edit-habit-limit" value="${t.habitLimit}" min="1"></div><div class="settings-field"><label>Modo</label><select id="edit-habit-mode"><option value="min"${t.habitMode==='min'?' selected':''}>Mínimo</option><option value="max"${t.habitMode==='max'?' selected':''}>Máximo</option></select></div>`:'' }
        ${(t.type==='score')?`<div class="settings-field"><label>Meta / alvo</label><input type="number" id="edit-score-goal" value="${t.scoreGoal}" step="0.1"></div><div class="settings-field"><label>Direção</label><select id="edit-score-dir"><option value="higher"${t.scoreDirection==='higher'?' selected':''}>↑ Maior melhor</option><option value="lower"${t.scoreDirection==='lower'?' selected':''}>↓ Menor melhor</option></select></div>`:'' }
        <div class="settings-field"><label>Notas</label><textarea id="edit-notes" rows="4">${escHtml(t.notes||'')}</textarea></div>
        <div class="edit-type-badge">Tipo: <span class="type-badge type-${t.type}">${TYPE_LABELS[t.type]}</span> <span class="edit-type-note">(não editável após criação)</span></div>
    </div>`;
    openSidePanel('edit-overlay');
    document.getElementById('edit-text')?.focus();
}

function closeEditPanel() { closeSidePanel('edit-overlay')(); _editId=null; }

function saveEditTask() {
    const t=getTask(_editId); if(!t) return;
    t.text=document.getElementById('edit-text')?.value.trim()||t.text;
    t.whyImportant=document.getElementById('edit-why')?.value.trim()||'';
    t.priority=document.getElementById('edit-priority')?.value||t.priority;
    t.deadline=document.getElementById('edit-deadline')?.value||null;
    t.startDate=document.getElementById('edit-startdate')?.value||null;
    t.taskStatus=document.getElementById('edit-status')?.value||t.taskStatus;
    t.notes=document.getElementById('edit-notes')?.value||'';
    if(t.type==='contagem') {
        t.goal=parseFloat(document.getElementById('edit-goal')?.value)||t.goal;
        // current is NOT editable here — only via history
    }
    if(t.type==='valor') {
        t.goal=parseFloat(document.getElementById('edit-goal')?.value)||t.goal;
        t.unit=document.getElementById('edit-unit')?.value.trim()||t.unit;
    }
    if(t.type==='habito') {
        t.habitLimit=parseInt(document.getElementById('edit-habit-limit')?.value)||t.habitLimit;
        t.habitMode=document.getElementById('edit-habit-mode')?.value||t.habitMode;
    }
    if(t.type==='score') {
        t.scoreGoal=parseFloat(document.getElementById('edit-score-goal')?.value)||t.scoreGoal;
        t.scoreDirection=document.getElementById('edit-score-dir')?.value||t.scoreDirection;
    }
    saveState(); renderMetas(); updateDashboard();
    refreshHistoryIfOpen(_editId);
    closeEditPanel(); showToast('Meta atualizada ✓');
}

// ---- DASHBOARD ----
function updateDashboard() {
    const counts={adiantada:0,noritmo:0,emrisco:0,atrasada:0};
    const pillarStats={};
    let totalTasks=0,completedTasks=0;
    const allTasks=[];

    pillarOrder().forEach(k=>{
        const tasks=state.tasks[k]||[];
        const done=tasks.filter(t=>t.taskStatus==='Concluída').length;
        totalTasks+=tasks.length; completedTasks+=done;
        const avgP=tasks.length?tasks.reduce((a,t)=>a+Math.min(1,getProgress(t)),0)/tasks.length:0;
        pillarStats[k]={ total:tasks.length, completed:done, percentage:Math.round(avgP*100) };
        tasks.forEach(t=>{
            const st=calcStatus(t);
            if(st.css==='adiantada') counts.adiantada++;
            else if(st.css==='on-track') counts.noritmo++;
            else if(st.css==='at-risk') counts.emrisco++;
            else if(st.css==='off-track') counts.atrasada++;
            allTasks.push({...t,pillarKey:k,tracking:st});
        });
    });

    const withTasks=pillarOrder().filter(k=>pillarStats[k]?.total>0);
    const overallPct=withTasks.length?Math.round(withTasks.reduce((a,k)=>a+pillarStats[k].percentage,0)/withTasks.length):0;
    const active=totalTasks-completedTasks-allTasks.filter(t=>t.taskStatus==='Encerrada').length;
    const compRate=totalTasks>0?Math.round(completedTasks/totalTasks*100):0;

    const s=id=>{ const e=document.getElementById(id); return e; };
    const sv=(id,v)=>{ const e=s(id); if(e) e.textContent=v; };
    sv('overall-progress',overallPct+'%');
    sv('active-goals',active);
    sv('completed-goals',completedTasks);
    sv('completion-rate',compRate+'%');
    const bar=s('overall-bar'); if(bar) bar.style.width=overallPct+'%';
    sv('st-adiantada',counts.adiantada); sv('st-noritmo',counts.noritmo);
    sv('st-emrisco',counts.emrisco); sv('st-atrasada',counts.atrasada);
    renderFocoWidget();

    // Global streak
    const gsWrap=s('global-streak-wrap');
    if(gsWrap) {
        const sg=calcStreakGeral();
        gsWrap.innerHTML=sg>0?`<div class="global-streak-card">
            <div class="gstreak-icon">◈</div>
            <div><div class="gstreak-val">${sg}</div><div class="gstreak-label">dias seguidos com atividade registrada</div></div>
        </div>`:'';
    }

    const chart=s('pillars-chart');
    if(chart) chart.innerHTML=pillarOrder().map(k=>{
        const ps=pillarStats[k],p=state.config.pillars[k]; if(!p) return '';
        return `<div class="pillar-bar"><div class="pillar-bar-label"><span>${escHtml(p.name)}</span><span>${ps.percentage}% <small>(${ps.completed}/${ps.total})</small></span></div><div class="pillar-bar-track"><div class="pillar-bar-fill" style="width:${ps.percentage}%"></div></div></div>`;
    }).join('');

    const urgency={'off-track':0,'at-risk':1,'neutral':2,'adiantada':3,'on-track':4};
    const sorted=[...allTasks].filter(t=>t.taskStatus!=='Encerrada').sort((a,b)=>(urgency[a.tracking.css]||4)-(urgency[b.tracking.css]||4)).slice(0,10);
    const radEl=s('metas-status');
    if(radEl) radEl.innerHTML=sorted.length?sorted.map(t=>{
        const pName=state.config.pillars[t.pillarKey]?.name||t.pillarKey;
        const pct=Math.round(Math.min(1,getProgress(t))*100);
        return `<div class="meta-status-card ${t.tracking.css}">
            <div class="meta-status-title">${escHtml(t.text)}</div>
            <div class="meta-status-info"><span class="meta-pillar-tag">${escHtml(pName)}</span><span>${pct}% · ${TYPE_LABELS[t.type]}</span></div>
            <div class="meta-status-footer"><span class="tracking-badge ${t.tracking.css}">${t.tracking.label}</span><span class="meta-manual-status">${t.taskStatus}</span></div>
        </div>`;
    }).join(''):'<p class="empty-dash">Nenhuma meta criada ainda.</p>';
}

// ---- ROADMAP ----
function renderRoadmap() {
    const el=document.getElementById('roadmap-content'); if(!el) return;
    if (_roadmapView === 'gantt') { el.innerHTML=renderGanttView(); return; }
    const now=new Date();
    const allTasks=[];
    pillarOrder().forEach(k=>(state.tasks[k]||[]).forEach(t=>allTasks.push({...t,pillarKey:k,tracking:calcStatus(t)})));
    const withDl=allTasks.filter(t=>t.deadline&&t.taskStatus!=='Encerrada').sort((a,b)=>a.deadline.localeCompare(b.deadline));
    const noDl=allTasks.filter(t=>!t.deadline&&t.taskStatus!=='Encerrada');
    if(!allTasks.filter(t=>t.taskStatus!=='Encerrada').length) { el.innerHTML='<div class="empty-state"><p>Nenhuma meta criada</p></div>'; return; }
    const groups=[
        { label:'Expiradas',          tasks:withDl.filter(t=>new Date(t.deadline+'T12:00:00')<now) },
        { label:'Próximos 7 dias',    tasks:withDl.filter(t=>{ const d=new Date(t.deadline+'T12:00:00'); return d>=now&&d<=addDays(now,7); }) },
        { label:'Próximos 30 dias',   tasks:withDl.filter(t=>{ const d=new Date(t.deadline+'T12:00:00'); return d>addDays(now,7)&&d<=addDays(now,30); }) },
        { label:'Próximos 90 dias',   tasks:withDl.filter(t=>{ const d=new Date(t.deadline+'T12:00:00'); return d>addDays(now,30)&&d<=addDays(now,90); }) },
        { label:'Além de 90 dias',    tasks:withDl.filter(t=>new Date(t.deadline+'T12:00:00')>addDays(now,90)) },
        { label:'Sem prazo',          tasks:noDl }
    ];
    el.innerHTML=groups.filter(g=>g.tasks.length).map(g=>`
        <div class="roadmap-group">
            <div class="roadmap-group-label">${g.label} <span class="roadmap-count">${g.tasks.length}</span></div>
            ${g.tasks.map(t=>{
                const pName=state.config.pillars[t.pillarKey]?.name||t.pillarKey;
                const pct=Math.round(Math.min(1,getProgress(t))*100);
                const dr=t.deadline?Math.round((new Date(t.deadline+'T12:00:00')-now)/86400000):null;
                return `<div class="roadmap-item priority-${t.priority}${['Concluída','Encerrada'].includes(t.taskStatus)?' finished':''}">
                    <div class="roadmap-item-top">
                        <div class="roadmap-item-left">
                            <span class="roadmap-task-name">${escHtml(t.text)}</span>
                            <div class="roadmap-badges">
                                <span class="meta-pillar-tag" data-action="goto-pillar" data-pillar="${t.pillarKey}">${escHtml(pName)}</span>
                                <span class="type-badge type-${t.type}">${TYPE_LABELS[t.type]}</span>
                                <span class="tracking-badge ${t.tracking.css}">${t.tracking.label}</span>
                                ${dr!==null?`<span class="days-badge${dr<0?' expired':''}">${dr<0?Math.abs(dr)+'d expirado':dr+'d restantes'}</span>`:''}
                            </div>
                        </div>
                        <div class="roadmap-item-right">
                            <span class="roadmap-pct">${pct}%</span>
                            ${(t.type==='contagem'&&!['Concluída','Encerrada'].includes(t.taskStatus))?`<button class="roadmap-checkin-btn" data-action="roadmap-checkin" data-id="${t.id}" data-pillar="${t.pillarKey}">+ Check-in</button>`:''}
                            ${(t.type==='habito'&&!['Concluída','Encerrada'].includes(t.taskStatus))?`<button class="roadmap-checkin-btn" data-action="roadmap-habito" data-id="${t.id}" data-pillar="${t.pillarKey}">+ Registrar</button>`:''}
                            ${(t.type==='marco'&&!['Concluída','Encerrada'].includes(t.taskStatus))?`<button class="roadmap-checkin-btn" data-action="roadmap-marco" data-id="${t.id}" data-pillar="${t.pillarKey}">Concluir</button>`:''}
                            ${(t.type==='valor'&&!['Concluída','Encerrada'].includes(t.taskStatus))?`<button class="roadmap-checkin-btn" data-action="roadmap-valor" data-id="${t.id}" data-pillar="${t.pillarKey}">+ Registrar</button>`:''}
                        </div>
                    </div>
                    <div class="progress-bar-container roadmap-bar"><div class="progress-bar${pct>=100?' complete':''}" style="width:${pct}%"></div></div>
                </div>`;
            }).join('')}
        </div>`).join('');
}

// ---- REVISÃO ----
function closeRevisaoForm() {
    document.getElementById('revisao-form')?.classList.add('hidden');
    ['revisao-week','r-wins','r-blockers','r-focus','r-reflection'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    const scoreInp=document.getElementById('revisao-score'); if(scoreInp) scoreInp.value='';
    document.querySelectorAll('.wsp-btn').forEach(b=>b.classList.remove('selected'));
}
function saveRevisao() {
    const week=document.getElementById('revisao-week')?.value;
    if(!week) return showToast('Selecione a semana');
    const wins=document.getElementById('r-wins')?.value.trim();
    const blockers=document.getElementById('r-blockers')?.value.trim();
    const focus=document.getElementById('r-focus')?.value.trim();
    const reflection=document.getElementById('r-reflection')?.value.trim();
    const score=parseInt(document.getElementById('revisao-score')?.value)||null;
    if(!wins&&!blockers&&!focus&&!reflection) return showToast('Preencha ao menos um campo');
    state.revisoes.unshift({ id:genId(), week, wins, blockers, focus, reflection, score, createdAt:new Date().toISOString() });
    saveState(); closeRevisaoForm(); renderRevisoes();
    showToast('Revisão salva ✓');
    // Check milestone
    checkConquista('primeira_revisao');
    if(state.revisoes.length===4) checkConquista('quatro_revisoes');
}
function renderRevisoes() {
    const list=document.getElementById('revisao-list'); if(!list) return;
    if(!state.revisoes.length) { list.innerHTML='<div class="empty-state"><p>Nenhuma revisão</p><p class="empty-sub">Clique em "+ Nova Revisão"</p></div>'; return; }
    list.innerHTML=state.revisoes.map(r=>{
        const scoreClass=r.score>=8?'high':r.score>=5?'mid':'low';
        return `
        <div class="revisao-card">
            <div class="revisao-card-header">
                <div>
                    <h3>${fmtWeek(r.week)}${r.score?` <span class="revisao-score-display ${scoreClass}">${r.score}/10</span>`:''}</h3>
                    <span class="revisao-date">${fmtDateLong(r.createdAt)}</span>
                </div>
                <button class="task-action-btn danger-btn" data-action="del-revisao" data-id="${r.id}">✕</button>
            </div>
            ${r.wins?`<div class="revisao-section"><strong>Funcionou</strong><p>${escHtml(r.wins)}</p></div>`:''}
            ${r.blockers?`<div class="revisao-section"><strong>Travou</strong><p>${escHtml(r.blockers)}</p></div>`:''}
            ${r.focus?`<div class="revisao-section"><strong>Próxima semana</strong><p>${escHtml(r.focus)}</p></div>`:''}
            ${r.reflection?`<div class="revisao-section"><strong>Reflexão</strong><p>${escHtml(r.reflection)}</p></div>`:''}
        </div>`;
    }).join('');

    // Comparativo semanal after the list
    const compWrap=document.createElement('div');
    compWrap.innerHTML=renderComparativoSemanal(state.revisoes);
    list.appendChild(compWrap);
}
function renderAutoSummary() {
    const el=document.getElementById('auto-summary'); if(!el) return;
    const now=new Date(), weekAgo=addDays(now,-7), fwdWeek=addDays(now,7), ago14=addDays(now,-14);
    const allTasks=[];
    pillarOrder().forEach(k=>(state.tasks[k]||[]).forEach(t=>allTasks.push({...t,pillarKey:k})));
    const active=allTasks.filter(t=>!['Concluída','Encerrada'].includes(t.taskStatus));
    const advanced=active.filter(t=>[...(t.checkins||[]),...(t.habitCheckins||[]),...(t.scoreEntries||[]),...(t.valueEntries||[])].some(c=>new Date((typeof c==='string'?c:(c.date||c))+'T12:00:00')>weekAgo));
    const stalled=active.filter(t=>{ const all=[...(t.checkins||[]),...(t.habitCheckins||[])]; return all.length&&!all.some(c=>new Date((typeof c==='string'?c:(c.date||c))+'T12:00:00')>ago14); });
    const urgent=active.filter(t=>t.deadline&&new Date(t.deadline+'T12:00:00')>=now&&new Date(t.deadline+'T12:00:00')<=fwdWeek);
    if(!advanced.length&&!stalled.length&&!urgent.length) { el.innerHTML=''; return; }
    const items=[];
    if(advanced.length) items.push(`<span class="summary-chip green">${advanced.length} meta${advanced.length>1?'s avançaram':' avançou'}</span>`);
    if(stalled.length) items.push(`<span class="summary-chip amber">${stalled.length} sem atividade há 14+ dias</span>`);
    if(urgent.length) items.push(`<span class="summary-chip red">${urgent.length} prazo nos próximos 7 dias</span>`);
    el.innerHTML=`<div class="auto-summary-inner"><span class="summary-label">Resumo automático</span>${items.join('')}</div>`;
}

// ---- SETTINGS ----
function openSettings() { populateSettingsForm(); renderProfilePanel(); openSidePanel('settings-overlay'); }
function closeSettings() { closeSidePanel('settings-overlay')(); }
function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    document.querySelectorAll('.settings-tab-content').forEach(c=>c.classList.toggle('active',c.id===`tab-${tab}`));
}
function populateSettingsForm() {
    const c=state.config;
    const s=(id,v)=>{ const e=document.getElementById(id); if(e) e.value=v||''; };
    s('cfg-name',c.userName); s('cfg-phrase',c.inspirationalPhrase); s('cfg-purpose',c.purpose);
    renderSettingsValues(); renderSettingsPillars();
}
function renderSettingsValues() {
    const list=document.getElementById('cfg-values-list'); if(!list) return;
    list.innerHTML=(state.config.values||[]).map((v,i)=>`
        <div class="cfg-item" data-idx="${i}">
            <div class="cfg-item-fields">
                <input type="text" class="cfg-val-name" value="${escHtml(v.name)}" placeholder="Nome" data-idx="${i}" data-field="name">
                <input type="text" class="cfg-val-desc" value="${escHtml(v.description)}" placeholder="Descrição" data-idx="${i}" data-field="description">
            </div>
            <button class="cfg-remove-btn" data-action="remove-value" data-idx="${i}">✕</button>
        </div>`).join('');
    list.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',e=>{ const i=parseInt(e.target.dataset.idx),f=e.target.dataset.field; if(state.config.values[i]) state.config.values[i][f]=e.target.value; }));
}
function addValueField() { state.config.values.push({ id:genId(),name:'',description:'' }); renderSettingsValues(); }

function renderSettingsPillars() {
    const list=document.getElementById('cfg-pillars-list'); if(!list) return;
    const order=pillarOrder();
    list.innerHTML=order.map((k,idx)=>{
        const p=state.config.pillars[k]||{};
        const goals=(p.goals||[]).map((g,gi)=>`
            <div class="cfg-goal-row">
                <input type="text" class="cfg-goal-input" value="${escHtml(g.text||g)}" data-pillar="${k}" data-gi="${gi}">
                <button class="cfg-remove-btn small" data-action="remove-goal" data-pillar="${k}" data-gi="${gi}">✕</button>
            </div>`).join('');
        return `<div class="cfg-pillar-block" data-pillar="${k}">
            <div class="cfg-pillar-header">
                <input type="text" class="cfg-pillar-name" value="${escHtml(p.name||k)}" data-pillar="${k}" placeholder="Nome">
                <div class="cfg-pillar-btns">
                    ${idx>0?`<button class="cfg-order-btn" data-action="pillar-up" data-pillar="${k}">↑</button>`:''}
                    ${idx<order.length-1?`<button class="cfg-order-btn" data-action="pillar-down" data-pillar="${k}">↓</button>`:''}
                    <button class="cfg-remove-btn" data-action="remove-pillar" data-pillar="${k}">✕</button>
                </div>
            </div>
            <div class="settings-field"><label>Descrição</label><textarea class="cfg-pillar-desc" data-pillar="${k}" rows="2">${escHtml(p.description||'')}</textarea></div>
            <div class="settings-field"><label>Metas 2028</label><div class="cfg-goals-list">${goals}</div><button class="btn-secondary small" data-action="add-goal" data-pillar="${k}">+ Meta</button></div>
        </div>`;
    }).join('');
    list.querySelectorAll('.cfg-pillar-name').forEach(inp=>inp.addEventListener('input',e=>{ const k=e.target.dataset.pillar; if(state.config.pillars[k]) state.config.pillars[k].name=e.target.value; }));
    list.querySelectorAll('.cfg-pillar-desc').forEach(ta=>ta.addEventListener('input',e=>{ const k=e.target.dataset.pillar; if(state.config.pillars[k]) state.config.pillars[k].description=e.target.value; }));
    list.querySelectorAll('.cfg-goal-input').forEach(inp=>inp.addEventListener('input',e=>{ const k=e.target.dataset.pillar,gi=parseInt(e.target.dataset.gi); if(state.config.pillars[k]?.goals?.[gi]) state.config.pillars[k].goals[gi].text=e.target.value; }));
}
function handlePillarSettingsClick(e) {
    const b=e.target.closest('[data-action]'); if(!b) return;
    const action=b.dataset.action,k=b.dataset.pillar,order=pillarOrder();
    if(action==='add-goal'&&state.config.pillars[k]) { state.config.pillars[k].goals=state.config.pillars[k].goals||[]; state.config.pillars[k].goals.push({ id:genId(),text:'',pct:0 }); renderSettingsPillars(); }
    else if(action==='remove-goal') { const gi=parseInt(b.dataset.gi); if(state.config.pillars[k]?.goals) { state.config.pillars[k].goals.splice(gi,1); renderSettingsPillars(); } }
    else if(action==='remove-pillar') { const n=(state.tasks[k]||[]).length; showConfirm(`Remover "${state.config.pillars[k]?.name}"?${n>0?` (apagará ${n} meta(s))`:''}`,()=>{ state.config.pillarOrder=order.filter(x=>x!==k); delete state.config.pillars[k]; delete state.tasks[k]; if(state.currentPillar===k) state.currentPillar=state.config.pillarOrder[0]; renderSettingsPillars(); }); }
    else if(action==='pillar-up') { const i=order.indexOf(k); if(i>0) { [order[i-1],order[i]]=[order[i],order[i-1]]; state.config.pillarOrder=order; renderSettingsPillars(); } }
    else if(action==='pillar-down') { const i=order.indexOf(k); if(i<order.length-1) { [order[i],order[i+1]]=[order[i+1],order[i]]; state.config.pillarOrder=order; renderSettingsPillars(); } }
}
function addPillarField() {
    const key='p_'+Date.now();
    state.config.pillars[key]={ name:'Novo Pilar',description:'',goals:[] };
    state.config.pillarOrder=[...pillarOrder(),key];
    state.tasks[key]=[];
    renderSettingsPillars();
}
function saveSettings() {
    const g=id=>document.getElementById(id)?.value.trim()||'';
    state.config.userName=g('cfg-name'); state.config.inspirationalPhrase=g('cfg-phrase'); state.config.purpose=g('cfg-purpose');
    pillarOrder().forEach(k=>{ if(!state.tasks[k]) state.tasks[k]=[]; });
    saveState(); renderAll(); closeSettings(); showToast('Configurações salvas ✓');
}

// ---- EXPORT/IMPORT ----
// ---- PDF REPORT BUILDER ----
function buildPdfReport() {
    const c = state.config;
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });

    // Aggregate dashboard stats
    let totalTasks=0, completedTasks=0, activeTasks=0;
    const statusCounts = { adiantada:0, noritmo:0, emrisco:0, atrasada:0 };
    const allTasksFlat = [];
    pillarOrder().forEach(k=>{
        const tasks = state.tasks[k]||[];
        tasks.forEach(t=>{
            totalTasks++;
            if (t.taskStatus==='Concluída') completedTasks++;
            else if (t.taskStatus!=='Encerrada') activeTasks++;
            const st = calcStatus(t);
            if (st.css==='adiantada') statusCounts.adiantada++;
            else if (st.css==='on-track') statusCounts.noritmo++;
            else if (st.css==='at-risk') statusCounts.emrisco++;
            else if (st.css==='off-track') statusCounts.atrasada++;
            allTasksFlat.push({...t, pillarKey:k, st});
        });
    });
    const avgProgress = totalTasks ? Math.round(allTasksFlat.reduce((a,t)=>a+Math.min(1,getProgress(t)),0)/totalTasks*100) : 0;

    const statusBadgeCls = s => s.css==='adiantada'?'green':s.css==='on-track'?'blue':s.css==='at-risk'?'amber':s.css==='off-track'?'red':'slate';

    // Section 1: Capa
    let html = `<div class="pdf-page">
    <div class="pdf-cover">
        <div class="pdf-cover-name">${escHtml(c.userName||'Planejamento Estratégico')}</div>
        <div class="pdf-cover-phrase">${escHtml(c.inspirationalPhrase||'')}</div>
        <div class="pdf-cover-date">Relatório gerado em ${dateStr}</div>
    </div>`;

    // Section 2: Propósito e Valores
    html += `<div class="pdf-section">
        <div class="pdf-section-title">Propósito</div>
        <div class="pdf-purpose">${escHtml(c.purpose||'')}</div>`;
    if ((c.values||[]).length) {
        html += `<div class="pdf-values-grid">
            ${c.values.map(v=>`<div class="pdf-value-item">
                <div class="pdf-value-name">${escHtml(v.name)}</div>
                <div class="pdf-value-desc">${escHtml(v.description)}</div>
            </div>`).join('')}
        </div>`;
    }
    html += `</div>`;

    // Section 3: Resumo Executivo
    html += `<div class="pdf-section">
        <div class="pdf-section-title">Resumo Executivo</div>
        <div class="pdf-metrics-row">
            <div class="pdf-metric"><span class="pdf-metric-val">${totalTasks}</span><span class="pdf-metric-lbl">Total de Metas</span></div>
            <div class="pdf-metric"><span class="pdf-metric-val">${completedTasks}</span><span class="pdf-metric-lbl">Concluídas</span></div>
            <div class="pdf-metric"><span class="pdf-metric-val">${activeTasks}</span><span class="pdf-metric-lbl">Ativas</span></div>
            <div class="pdf-metric"><span class="pdf-metric-val">${avgProgress}%</span><span class="pdf-metric-lbl">Progresso Médio</span></div>
        </div>
        <div class="pdf-metrics-row">
            <div class="pdf-metric"><span class="pdf-metric-val">${statusCounts.adiantada}</span><span class="pdf-metric-lbl">Adiantadas</span></div>
            <div class="pdf-metric"><span class="pdf-metric-val">${statusCounts.noritmo}</span><span class="pdf-metric-lbl">No Ritmo</span></div>
            <div class="pdf-metric"><span class="pdf-metric-val">${statusCounts.emrisco}</span><span class="pdf-metric-lbl">Em Risco</span></div>
            <div class="pdf-metric"><span class="pdf-metric-val">${statusCounts.atrasada}</span><span class="pdf-metric-lbl">Atrasadas</span></div>
        </div>
    </div>`;

    // Section 4: Pilares e Metas
    html += `<div class="pdf-section"><div class="pdf-section-title">Pilares Estratégicos e Metas</div>`;
    pillarOrder().forEach(k=>{
        const p = c.pillars[k]; if(!p) return;
        const tasks = state.tasks[k]||[];
        const goals = p.goals||[];
        const pillarPct = goals.length ? Math.round(goals.reduce((a,g)=>a+(parseFloat(g.pct)||0),0)/goals.length) : 0;
        html += `<div class="pdf-pillar-block">
            <div class="pdf-pillar-name">${escHtml(p.name)}</div>
            <div class="pdf-pillar-desc">${escHtml(p.description)}</div>
            <div class="pdf-pillar-pct">Progresso 2028: ${pillarPct}%</div>
            <div class="pdf-pillar-bar-wrap"><div class="pdf-pillar-bar-fill" style="width:${pillarPct}%"></div></div>`;
        if (tasks.length) {
            tasks.forEach(t=>{
                const pct = Math.round(Math.min(1,getProgress(t))*100);
                const st = calcStatus(t);
                html += `<div class="pdf-task-row">
                    <span class="pdf-task-name">${escHtml(t.text)}</span>
                    <span class="pdf-task-status ${statusBadgeCls(st)}">${st.label}</span>
                    <span class="pdf-task-pct">${pct}%</span>
                    ${t.deadline?`<span style="font-size:10px;color:#8A8B8E;min-width:70px;text-align:right">${fmtDate(t.deadline)}</span>`:''}
                </div>`;
            });
        } else {
            html += `<div style="font-size:11px;color:#8A8B8E;padding:6px 0">Nenhuma meta registrada.</div>`;
        }
        html += `</div>`;
    });
    html += `</div>`;

    // Section 5: Revisões recentes
    const revisoes = (state.revisoes||[]).slice(0,4);
    if (revisoes.length) {
        html += `<div class="pdf-section"><div class="pdf-section-title">Revisões Semanais Recentes</div>`;
        revisoes.forEach(r=>{
            html += `<div class="pdf-revisao-card">
                <div class="pdf-revisao-week">${fmtWeek(r.week)} — ${fmtDateLong(r.createdAt)}</div>
                ${r.wins?`<div class="pdf-revisao-field"><strong>Funcionou:</strong> ${escHtml(r.wins)}</div>`:''}
                ${r.blockers?`<div class="pdf-revisao-field"><strong>Travou:</strong> ${escHtml(r.blockers)}</div>`:''}
                ${r.focus?`<div class="pdf-revisao-field"><strong>Próxima semana:</strong> ${escHtml(r.focus)}</div>`:''}
                ${r.reflection?`<div class="pdf-revisao-field"><strong>Reflexão:</strong> ${escHtml(r.reflection)}</div>`:''}
            </div>`;
        });
        html += `</div>`;
    }

    html += `</div>`; // close pdf-page

    const page = document.getElementById('pdf-report-page');
    if (page) page.innerHTML = html;
}

function exportData() { dlBlob(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),`planejamento-${todayStr()}.json`); showToast('JSON exportado'); }
function importData(e) {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader();
    r.onload=ev=>{ try { const p=JSON.parse(ev.target.result); if(!p.tasks) throw new Error(); showConfirm('Importar? Dados atuais serão substituídos.',()=>{ localStorage.setItem('pe_v6',JSON.stringify(p)); loadState(); renderAll(); showToast('Dados importados ✓'); }); } catch { showToast('Arquivo JSON inválido'); } e.target.value=''; };
    r.readAsText(file);
}
function exportReport() {
    let r='=== RELATÓRIO ESTRATÉGICO ===\n'+`Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    pillarOrder().forEach(k=>{ const tasks=state.tasks[k]||[],p=state.config.pillars[k]; const avg=tasks.length?Math.round(tasks.reduce((a,t)=>a+Math.min(1,getProgress(t)),0)/tasks.length*100):0; r+=`\n${(p?.name||k).toUpperCase()} — ${avg}% médio\n${'─'.repeat(40)}\n`; tasks.forEach(t=>{ const pct=Math.round(Math.min(1,getProgress(t))*100); const st=calcStatus(t); r+=`  • [${TYPE_LABELS[t.type]}] ${t.text}\n    ${pct}% | ${t.taskStatus} | ${st.label} | ${t.priority}${t.deadline?' | prazo: '+fmtDate(t.deadline):''}\n${t.notes?'    Nota: '+t.notes+'\n':''}`; }); });
    dlBlob(new Blob([r],{type:'text/plain'}),`relatorio-${todayStr()}.txt`); showToast('Relatório exportado ✓');
}
function dlBlob(blob,name) { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function resetAllData() {
    state={ currentPillar:DEFAULT_CONFIG.pillarOrder[0], tasks:{}, revisoes:[], config:deepClone(DEFAULT_CONFIG) };
    DEFAULT_CONFIG.pillarOrder.forEach(k=>{ state.tasks[k]=[]; });
    saveState(); renderAll(); showToast('Dados apagados');
}

// ---- TOAST ----
function showToast(msg, type='') { const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.className='toast'+(type?' '+type:''); clearTimeout(showToast._t); showToast._t=setTimeout(()=>t.classList.add('hidden'),3000); }

// ---- CONFIRM ----
let _confirmCb=null;
function showConfirm(msg,cb) {
    const m=document.getElementById('confirm-modal'),me=document.getElementById('modal-message'); if(!m) { if(cb) cb(); return; }
    if(me) me.textContent=msg; _confirmCb=cb; m.classList.remove('hidden');
    const btn=document.getElementById('modal-confirm-btn'),nb=btn.cloneNode(true); btn.parentNode.replaceChild(nb,btn);
    nb.addEventListener('click',()=>{ if(_confirmCb) _confirmCb(); closeConfirm(); });
}
function closeConfirm() { document.getElementById('confirm-modal')?.classList.add('hidden'); _confirmCb=null; }

// ---- DELTA RESTANTE ----
function calcDeltaRestante(t) {
    if ((t.type!=='contagem'&&t.type!=='valor')||!t.deadline||t.current<=0) return null;
    if (t.current>=t.goal) return null;
    const now=new Date(), dl=new Date(t.deadline+'T12:00:00');
    if (dl<=now) return null;
    const falta=t.goal-t.current;
    const diasRest=Math.max(1,(dl-now)/86400000);
    const ritmoNec=falta/diasRest;
    if (t.type==='valor') return { falta:fmtNum(falta.toFixed(2)), ritmoNec:fmtNum(ritmoNec.toFixed(2)) };
    return { falta:fmtNum(Math.ceil(falta)), ritmoNec:fmtNum(ritmoNec.toFixed(1)) };
}

// ---- PROJEÇÃO DE CONCLUSÃO ----
function calcProjection(t) {
    if ((t.type!=='contagem'&&t.type!=='valor')||!t.deadline||t.current<=0) return null;
    if (t.current>=t.goal) return null;
    const now=new Date(), dl=new Date(t.deadline+'T12:00:00');
    const startRef=t.startDate?new Date(t.startDate+'T12:00:00'):new Date(t.createdAt);
    if (startRef>=now) return null;
    const diasDec=Math.max(1,(now-startRef)/86400000);
    const ritmoAtual=t.current/diasDec;
    if (ritmoAtual<=0) return null;
    const falta=t.goal-t.current;
    const diasParaConcluir=falta/ritmoAtual;
    const projDate=new Date(now.getTime()+diasParaConcluir*86400000);
    const projStr=projDate.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});
    const onTime=projDate<=dl;
    return { text:projStr, cls:onTime?'early':'late' };
}

// ---- MINI CURVA IDEAL VS REAL (melhorada) ----
function renderMiniCurve(t) {
    const isContagem = t.type==='contagem';
    const isValor    = t.type==='valor';
    if ((!isContagem && !isValor) || !t.deadline) return '';

    let rawPoints = [];
    if (isContagem) {
        if (t.checkins.length < 2) return '';
        const sorted = [...t.checkins].sort((a,b)=>{
            const da=typeof a==='string'?a:a.date, db=typeof b==='string'?b:b.date;
            return da.localeCompare(db);
        });
        let cum = 0;
        sorted.forEach(c=>{ cum++; rawPoints.push({ date:(typeof c==='string'?c:c.date), y:cum/t.goal }); });
    } else {
        if (!t.valueEntries || t.valueEntries.length < 2) return '';
        const sorted = [...t.valueEntries].sort((a,b)=>a.date.localeCompare(b.date));
        sorted.forEach(e=>rawPoints.push({ date:e.date, y:(e.running||0)/t.goal }));
    }

    const startRef = t.startDate ? new Date(t.startDate+'T12:00:00') : new Date(t.createdAt);
    const dl       = new Date(t.deadline+'T12:00:00');
    const now      = new Date();
    const totalMs  = dl - startRef;
    if (totalMs <= 0) return '';
    const elapsedRatio = Math.min(1, (now - startRef) / totalMs);

    const W=280, H=90, PAD_B=20; // bottom padding for date labels
    const innerH = H - PAD_B;
    const px = x => Math.round(x * W);
    const py = y => Math.round(innerH - Math.min(1.05, Math.max(0, y)) * innerH);

    // Real curve points
    const realPts = rawPoints.map(p=>({
        x: Math.max(0, Math.min(1, (new Date(p.date+'T12:00:00') - startRef) / totalMs)),
        y: Math.min(1.05, p.y)
    }));

    const realPath    = realPts.map((p,i)=>`${i===0?'M':'L'}${px(p.x)},${py(p.y)}`).join(' ');
    const fillPath    = `${realPath} L${px(realPts[realPts.length-1].x)},${innerH} L${px(realPts[0].x)},${innerH} Z`;
    const idealPath   = `M${px(0)},${py(0)} L${px(elapsedRatio)},${py(elapsedRatio)}`;
    const goalLiney   = py(1);
    const lastPt      = realPts[realPts.length-1];

    // Date labels
    const fmt = d => d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    const labelStart  = fmt(startRef);
    const labelNow    = fmt(now);
    const labelEnd    = fmt(dl);
    const nowX        = px(elapsedRatio);

    const uid = 'gc'+Math.random().toString(36).slice(2,7);

    return `<div class="mini-curve-wrap">
        <div class="mini-curve-label">
            <span class="mini-curve-leg real">Real</span>
            <span class="mini-curve-leg ideal">Ideal</span>
        </div>
        <svg class="mini-curve-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent-vivid)" stop-opacity=".35"/>
                    <stop offset="100%" stop-color="var(--accent-vivid)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <!-- Goal line -->
            <line x1="0" y1="${goalLiney}" x2="${W}" y2="${goalLiney}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>
            <!-- Fill under real curve -->
            <path d="${fillPath}" fill="url(#${uid})"/>
            <!-- Ideal line -->
            <path d="${idealPath}" stroke="var(--border-strong)" stroke-width="1.5" stroke-dasharray="5 4" fill="none" opacity=".8"/>
            <!-- Real curve -->
            <path d="${realPath}" stroke="var(--accent-vivid)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Current position dot -->
            <circle cx="${px(lastPt.x)}" cy="${py(lastPt.y)}" r="4" fill="var(--accent-vivid)" stroke="var(--bg-surface)" stroke-width="2"/>
            <!-- Today marker -->
            <line x1="${nowX}" y1="0" x2="${nowX}" y2="${innerH}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3 3" opacity=".4"/>
            <!-- Date labels -->
            <text x="2" y="${H-4}" font-size="9" fill="var(--text-muted)" font-family="var(--font-body)">${labelStart}</text>
            <text x="${nowX}" y="${H-4}" font-size="9" fill="var(--text-muted)" font-family="var(--font-body)" text-anchor="middle">Hoje</text>
            <text x="${W-2}" y="${H-4}" font-size="9" fill="var(--text-muted)" font-family="var(--font-body)" text-anchor="end">${labelEnd}</text>
        </svg>
    </div>`;
}

// ============================================================
//  ONBOARDING SYSTEM
// ============================================================

let _obStep = 0;
let _obSelectedPillar = null;

function initOnboarding() {
    if (localStorage.getItem('ob_v2_done')) return;
    _obStep = 0;
    _obSelectedPillar = null;
    showObStep(0);
    document.getElementById('ob-modal-overlay')?.classList.remove('hidden');
}

// ---- VISION CHECKLIST ----
function renderVisionChecklist() {
    const wrap = document.getElementById('vision-checklist-wrap'); if (!wrap) return;
    if (localStorage.getItem('ob_checklist_done')) { wrap.innerHTML=''; return; }
    const hasPurpose = !!(state.config.purpose?.trim() && state.config.purpose.trim().length > 20 && state.config.purpose !== DEFAULT_CONFIG.purpose);
    const hasCustomValues = (state.config.values||[]).some(v=>v.name?.trim() && !['Saúde','Família','Integridade','Crescimento','Responsabilidade'].includes(v.name));
    const hasMetas = pillarOrder().some(k=>(state.tasks[k]||[]).length>0);
    const steps = [
        { done:hasPurpose,       title:'Escreva seu Propósito',   desc:'A âncora de todas as suas decisões estratégicas.',  idx:0, action:()=>{ openSettings(); switchSettingsTab('proposito'); } },
        { done:hasCustomValues,  title:'Defina seus Valores',      desc:'Os princípios que guiam suas escolhas diárias.',    idx:1, action:()=>{ openSettings(); switchSettingsTab('valores'); } },
        { done:hasMetas,         title:'Crie sua primeira Meta',   desc:'Escolha um pilar e registre uma meta concreta.',    idx:2, action:()=>{ switchSection('metas'); setTimeout(()=>document.getElementById('toggle-add-task-btn')?.click(),200); } },
    ];
    if (steps.every(s=>s.done)) { localStorage.setItem('ob_checklist_done','1'); wrap.innerHTML=''; return; }
    const doneCount = steps.filter(s=>s.done).length;
    wrap.innerHTML=`<div class="vision-checklist">
        <div class="vision-checklist-title">Configure seu planejamento <span style="color:var(--accent-vivid);font-weight:800">${doneCount}/3 completos</span></div>
        <div class="vision-checklist-sub">Complete os passos abaixo para ter uma experiência completa.</div>
        <div class="vision-checklist-steps">
            ${steps.map(s=>`
            <button class="vc-step${s.done?' done':''}" data-vc-idx="${s.idx}">
                <div class="vc-step-check">${s.done?'✓':s.idx+1}</div>
                <div class="vc-step-body">
                    <span class="vc-step-title">${s.title}</span>
                    <span class="vc-step-desc">${s.desc}</span>
                </div>
                ${!s.done?`<span class="vc-step-action">Configurar →</span>`:''}
            </button>`).join('')}
        </div>
    </div>`;
    wrap.querySelectorAll('.vc-step:not(.done)').forEach(btn=>{
        const idx=parseInt(btn.dataset.vcIdx);
        btn.addEventListener('click', ()=>steps[idx]?.action());
    });
}

// ---- CONTEXTUAL TOOLTIPS ----
const SECTION_TOOLTIPS = {
    vision:    'Aqui você define sua estratégia de vida: Propósito, Valores e Pilares com metas de longo prazo.',
    dashboard: 'Visão consolidada do seu desempenho. Acompanhe o progresso de todas as metas em um só lugar.',
    metas:     'Crie e gerencie suas metas por pilar. Use os filtros, o Modo Foco e os Gráficos para acompanhar.',
    roadmap:   'Todas as suas metas com prazo, ordenadas por urgência. Alterne entre Lista e Gantt.',
    revisao:   'Feche o ciclo semanal: reflita sobre o que funcionou, o que travou e o foco da próxima semana.',
};

function showSectionTooltip(section) {
    const key = `tt_${section}`;
    if (localStorage.getItem(key)) return;
    const msg = SECTION_TOOLTIPS[section]; if (!msg) return;
    const sec = document.getElementById(section); if (!sec) return;
    const existing = sec.querySelector('.section-tooltip-bar');
    if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.className = 'section-tooltip-bar';
    bar.innerHTML = `<span>${msg}</span><button onclick="this.closest('.section-tooltip-bar').remove();localStorage.setItem('${key}','1')">✕</button>`;
    sec.insertBefore(bar, sec.firstChild);
    setTimeout(()=>{ if(bar.parentNode){ bar.remove(); localStorage.setItem(key,'1'); } }, 6000);
}

// ---- COMPAT stub ----
function renderOnboarding() {
    const wrap=document.getElementById('onboarding-banner-wrap');
    if (wrap) wrap.innerHTML='';
}

// ---- GLOBAL STREAK ----
function calcStreakGeral() {
    let streak=0;
    const now=new Date();
    for(let d=1;d<=365;d++) {
        const dt=new Date(now); dt.setDate(dt.getDate()-d);
        const ds=dt.toISOString().split('T')[0];
        const hasActivity=pillarOrder().some(k=>(state.tasks[k]||[]).some(t=>{
            if(t.checkins?.some(c=>(typeof c==='string'?c:c.date)===ds)) return true;
            if(t.valueEntries?.some(e=>e.date===ds)) return true;
            if(t.habitCheckins?.some(c=>c===ds)) return true;
            if(t.scoreEntries?.some(e=>e.date===ds)) return true;
            return false;
        }));
        if(hasActivity) streak++; else break;
    }
    return streak;
}

// ---- GANTT VIEW ----
let _roadmapView = 'list';
function switchRoadmapView(v) {
    _roadmapView=v;
    document.getElementById('roadmap-list-btn')?.classList.toggle('active',v==='list');
    document.getElementById('roadmap-gantt-btn')?.classList.toggle('active',v==='gantt');
    renderRoadmap();
}

function renderGanttView() {
    const allTasks=[];
    pillarOrder().forEach(k=>{
        (state.tasks[k]||[]).filter(t=>t.deadline).forEach(t=>allTasks.push({...t,pillarKey:k}));
    });
    if(!allTasks.length) return '<p class="empty-state">Nenhuma meta com prazo definida.</p>';
    allTasks.sort((a,b)=>a.deadline.localeCompare(b.deadline));
    const rows=allTasks.map(t=>{
        const st=calcStatus(t);
        const pct=Math.round(Math.min(1,getProgress(t))*100);
        const expired=new Date(t.deadline+'T12:00:00')<new Date();
        return `<tr>
            <td><div class="gantt-name" title="${escHtml(t.text)}">${escHtml(t.text)}</div><div class="gantt-pillar">${escHtml(state.config.pillars[t.pillarKey]?.name||t.pillarKey)}</div></td>
            <td class="gantt-bar-cell">
                <div class="gantt-bar-wrap">
                    <div class="gantt-bar-fill ${st.css}" style="width:${pct}%"></div>
                </div>
            </td>
            <td><span style="font-size:11px;font-weight:700">${pct}%</span></td>
            <td><span class="gantt-deadline${expired?' expired':''}">${fmtDate(t.deadline)}</span></td>
            <td><span class="tracking-badge ${st.css} gantt-status-badge">${st.label}</span></td>
        </tr>`;
    }).join('');
    return `<div class="gantt-container"><table class="gantt-table">
        <thead><tr><th>Meta</th><th>Progresso</th><th>%</th><th>Prazo</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
    </table></div>`;
}

// ---- BRIEFING DA SEMANA ----
function renderBriefingSemana() {
    const wrap=document.getElementById('briefing-semana-wrap'); if(!wrap) return;
    const now=new Date();
    const weekAgo=new Date(now); weekAgo.setDate(weekAgo.getDate()-7);
    const wkStr=weekAgo.toISOString().split('T')[0];

    let advanced=0, stalled=0, urgent=0;
    const advNames=[], stalledNames=[], urgNames=[];

    pillarOrder().forEach(k=>{
        (state.tasks[k]||[]).forEach(t=>{
            const st=calcStatus(t);
            // Avançou: teve check-in nos últimos 7 dias
            const recentActivity=[
                ...(t.checkins||[]).map(c=>typeof c==='string'?c:c.date),
                ...(t.valueEntries||[]).map(e=>e.date),
                ...(t.habitCheckins||[]),
                ...(t.scoreEntries||[]).map(e=>e.date)
            ].some(d=>d>=wkStr);
            if(recentActivity) { advanced++; if(advNames.length<3) advNames.push(t.text); }
            else if(t.taskStatus!=='Concluída'&&t.taskStatus!=='Encerrada') { stalled++; if(stalledNames.length<3) stalledNames.push(t.text); }
            if(t.deadline) {
                const dl=new Date(t.deadline+'T12:00:00');
                const dr=(dl-now)/86400000;
                if(dr>=0&&dr<=7) { urgent++; if(urgNames.length<3) urgNames.push(t.text); }
            }
        });
    });

    const streakG=calcStreakGeral();
    // Foco metas
    const focoTrim=[]; const focoMensal=[];
    pillarOrder().forEach(k=>{
        (state.tasks[k]||[]).forEach(t=>{
            if(t.isFocusTrimestral) focoTrim.push(t.text);
            if(t.isFocusMensal) focoMensal.push(t.text);
        });
    });

    wrap.innerHTML=`<div class="briefing-semana">
        <div class="briefing-title">Contexto da semana — use abaixo para refletir</div>
        <div class="briefing-grid">
            <div class="briefing-stat"><span class="briefing-val">${advanced}</span><span class="briefing-lbl">metas ativas</span></div>
            <div class="briefing-stat"><span class="briefing-val">${urgent}</span><span class="briefing-lbl">prazos em 7 dias</span></div>
            <div class="briefing-stat"><span class="briefing-val">${streakG}d</span><span class="briefing-lbl">streak geral</span></div>
        </div>
        <div class="briefing-items">
            ${focoTrim.length?`<div class="briefing-item"><strong>Foco Trimestral:</strong> ${focoTrim.map(n=>escHtml(n)).join(' · ')}</div>`:''}
            ${focoMensal.length?`<div class="briefing-item"><strong>Foco Mensal:</strong> ${focoMensal.map(n=>escHtml(n)).join(' · ')}</div>`:''}
            ${advNames.length?`<div class="briefing-item">Ativas esta semana: ${advNames.map(n=>escHtml(n)).join(' · ')}</div>`:''}
            ${stalledNames.length?`<div class="briefing-item">Sem atividade: ${stalledNames.map(n=>escHtml(n)).join(' · ')}</div>`:''}
            ${urgNames.length?`<div class="briefing-item">Prazo urgente: ${urgNames.map(n=>escHtml(n)).join(' · ')}</div>`:''}
        </div>
    </div>`;
}

// ---- COMPARATIVO SEMANAL ----
function renderComparativoSemanal(revisoes) {
    if (revisoes.length < 2) return '';
    const last=revisoes[revisoes.length-1];
    const prev=revisoes[revisoes.length-2];
    const now=new Date();
    const metrics=[
        { label:'Metas ativas', val: (last._stats?.active||0), prevVal:(prev._stats?.active||0) },
        { label:'Streak (dias)', val:(last._stats?.streak||0), prevVal:(prev._stats?.streak||0) },
        { label:'Prazos urgentes', val:(last._stats?.urgent||0), prevVal:(prev._stats?.urgent||0) },
    ];
    const rows=metrics.map(m=>{
        const diff=m.val-m.prevVal;
        const cls=diff>0?'up':diff<0?'down':'flat';
        const sign=diff>0?'+':'';
        return `<tr><td>${m.label}</td><td>${m.prevVal}</td><td>${m.val}</td><td class="comp-delta ${cls}">${diff!==0?sign+diff:'—'}</td></tr>`;
    }).join('');
    return `<div class="comparativo-card">
        <div class="comparativo-title">Comparativo — semana atual vs anterior</div>
        <table class="comp-table">
            <thead><tr><th>Métrica</th><th>Semana ant.</th><th>Esta semana</th><th>Δ</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

// ---- INDIVIDUAL HISTORY DELETION ----
// (handled in handleHistoryClick - see retro-del-* actions)

// ============================================================
//  HELP SYSTEM
// ============================================================
const HELP_CONTENT = {
    vision: {
        title: 'Visão Estratégica',
        subtitle: 'Seu fundamento estratégico',
        sections: [
            { title: 'O que é esta seção', items: [
                { name: 'Propósito', desc: 'A frase que ancora todas as suas decisões. Responde: por que eu faço o que faço? Edite nas Configurações → Propósito.' },
                { name: 'Valores', desc: 'Os princípios que guiam suas escolhas diárias. Inegociáveis. Edite nas Configurações → Valores.' },
                { name: 'Pilares Estratégicos', desc: 'Os grandes domínios da sua vida. Cada pilar contém metas 2028 com percentual de progresso editável.' },
            ]},
            { title: 'Como usar', items: [
                { name: 'Atualize o % das metas 2028', desc: 'Dentro de cada pilar, edite o percentual de cada meta para refletir seu progresso real.' },
                { name: 'Releia regularmente', desc: 'Abrir esta aba e reler seu propósito é em si um ato estratégico. Crie o hábito.' },
            ]},
            { title: 'Dica estratégica', items: [
                { name: '', desc: 'Propósito e valores não são declarações — são filtros de decisão. Quando surgir uma nova oportunidade, pergunte: isso serve ao meu propósito?' },
            ]},
        ]
    },
    dashboard: {
        title: 'Dashboard',
        subtitle: 'Visão consolidada de desempenho',
        sections: [
            { title: 'Métricas', items: [
                { name: 'Progresso Geral', desc: 'Média ponderada do progresso de todos os pilares com metas.' },
                { name: 'Foco Estratégico', desc: 'Suas prioridades declaradas — Trimestral (máx 3) e Mensal (máx 5). Marque metas pelo menu ··· em cada card.' },
                { name: 'Radar de Metas', desc: 'As 10 metas que merecem mais atenção agora, ordenadas por urgência.' },
                { name: 'Streak Geral', desc: 'Dias consecutivos com pelo menos 1 registro em qualquer meta.' },
            ]},
            { title: 'Dica estratégica', items: [
                { name: '', desc: 'Use o Dashboard semanalmente antes da Revisão. Ver os números antes de refletir sobre eles muda a qualidade da reflexão.' },
            ]},
        ]
    },
    metas: {
        title: 'Metas',
        subtitle: 'Execução diária dos seus objetivos',
        sections: [
            { title: 'Tipos de meta', items: [
                { name: 'Contagem', desc: 'Um número que cresce com check-ins. Ex: livros lidos, km corridos. Precisa de prazo.' },
                { name: 'Valor Acumulado', desc: 'Valores financeiros ou quantitativos. Ex: R$ investidos, patrimônio. Precisa de prazo.' },
                { name: 'Marco', desc: 'Meta binária — concluída ou não. Ideal para projetos únicos. Precisa de prazo.' },
                { name: 'Hábito Periódico', desc: 'Frequência semanal com mínimo ou máximo. Ex: treinar ≥4x/sem.' },
                { name: 'Score / Qualidade', desc: 'Avaliações numéricas subjetivas. Ex: qualidade do sono 0–10.' },
            ]},
            { title: 'Diagnóstico de status', items: [
                { name: 'Adiantada (verde)', desc: 'Seu ritmo atual é 20%+ acima do necessário.' },
                { name: 'No Ritmo (azul)', desc: 'Você está no caminho certo — ritmo atual ≥ necessário.' },
                { name: 'Em Risco (âmbar)', desc: 'Ritmo atual entre 85-100% do necessário. Atenção.' },
                { name: 'Atrasada (vermelho)', desc: 'Ritmo atual abaixo de 85% do necessário. Ação urgente.' },
            ]},
            { title: 'Recursos', items: [
                { name: 'Foco Trimestral / Mensal', desc: 'Menu ··· em qualquer meta para marcar como prioridade. Aparece em destaque no Dashboard.' },
                { name: 'Gráficos', desc: 'Botão "Gráficos" na barra de filtros mostra a curva real vs ideal em todas as metas.' },
                { name: 'Modo Foco', desc: 'Exibe apenas metas Atrasadas e Em Risco. Ideal para revisões rápidas.' },
                { name: 'Histórico', desc: 'Cada meta tem histórico detalhado com registros individuais que podem ser excluídos.' },
            ]},
        ]
    },
    roadmap: {
        title: 'Roadmap',
        subtitle: 'Visão temporal das suas metas',
        sections: [
            { title: 'Visualizações', items: [
                { name: 'Lista', desc: 'Metas agrupadas por urgência de prazo: Expiradas, 7 dias, 30 dias, 90 dias, Além de 90 dias.' },
                { name: 'Gantt', desc: 'Tabela com barra de progresso, prazo e status de cada meta com prazo definido.' },
            ]},
            { title: 'Dica estratégica', items: [
                { name: '', desc: 'Abra o Roadmap quinzenalmente. Se você tem mais de 3 metas na faixa "Próximos 30 dias", concentre energia ali antes de criar novas.' },
            ]},
        ]
    },
    revisao: {
        title: 'Revisão Semanal',
        subtitle: 'Fechar o ciclo é a disciplina mais rara',
        sections: [
            { title: 'Como funciona', items: [
                { name: 'Briefing automático', desc: 'Ao abrir a revisão, o sistema mostra suas prioridades de foco e as metas mais ativas — para você refletir com contexto real.' },
                { name: 'Score da semana', desc: 'Dê uma nota de 1-10 para a semana. Ela aparece no histórico de revisões e revela padrões ao longo do tempo.' },
                { name: 'Campos de reflexão', desc: 'O que funcionou · O que travou · Foco da próxima semana · Reflexão livre. Preencha pelo menos 2.' },
            ]},
            { title: 'Dica estratégica', items: [
                { name: '', desc: 'Revisão semanal sem dados reais é diário. Com o briefing automático vinculado às suas metas, ela se torna inteligência estratégica. Reserve 15 minutos toda sexta-feira.' },
            ]},
        ]
    },
};

let _currentSection = 'vision';
function openHelp() {
    const content = HELP_CONTENT[_currentSection] || HELP_CONTENT.vision;
    document.getElementById('help-title').textContent = content.title;
    document.getElementById('help-subtitle').textContent = content.subtitle;

    const body = document.getElementById('help-content');
    body.innerHTML = content.sections.map(sec=>`
        <div class="help-section">
            <div class="help-section-title">${sec.title}</div>
            ${sec.items.map(item=>`
            <div class="help-item">
                ${item.name?`<div class="help-item-name">${item.name}</div>`:''}
                <div class="help-item-desc">${item.desc}</div>
            </div>`).join('')}
        </div>
    `).join('');
    openSidePanel('help-overlay');
}

// Track current section for help context
const _origSwitchSection = switchSection;

// ============================================================
//  CONQUISTAS & CELEBRATION
// ============================================================
const CONQUISTA_DEFS = {
    primeira_meta:     { icon:'◈', title:'Primeira meta criada',       msg:'Você saiu do planejamento para a execução. Isso já te coloca à frente de 80% das pessoas.' },
    primeira_conclusao:{ icon:'◈', title:'Primeira meta concluída',    msg:'Uma intenção transformada em realidade. Você provou que consegue executar.' },
    primeira_revisao:  { icon:'◈', title:'Primeira revisão semanal',   msg:'Você fechou seu primeiro ciclo. Quem revisa, aprende. Quem aprende, melhora.' },
    streak_7:          { icon:'◈', title:'7 dias de consistência',     msg:'Uma semana inteira de atividade registrada. Hábitos se formam em repetição.' },
    streak_30:         { icon:'◈', title:'30 dias de consistência',    msg:'Um mês de comprometimento com sua estratégia pessoal. Isso é raro.' },
    cinco_metas:       { icon:'◈', title:'5 metas concluídas',         msg:'Cinco intenções transformadas em realidade. Você é alguém que executa.' },
    quatro_revisoes:   { icon:'◈', title:'4 revisões semanais',        msg:'Um mês de ciclos fechados. Consistência na reflexão é a base da melhoria contínua.' },
    primeiro_foco:     { icon:'◈', title:'Foco declarado',             msg:'Você priorizou. Saber o que importa mais é metade da batalha estratégica.' },
};

function checkConquista(id) {
    if (!CONQUISTA_DEFS[id]) return;
    if ((state.conquistas||[]).find(c=>c.id===id)) return; // already earned
    const def = CONQUISTA_DEFS[id];
    state.conquistas = state.conquistas||[];
    state.conquistas.push({ id, earnedAt: new Date().toISOString() });
    saveState();
    showCelebration(def.icon, def.title, def.msg);
}

function showCelebration(icon, title, msg) {
    const modal = document.getElementById('celebration-modal'); if(!modal) return;
    document.getElementById('celebration-icon').textContent = icon;
    document.getElementById('celebration-title').textContent = title;
    document.getElementById('celebration-msg').textContent = msg;
    modal.classList.remove('hidden');
    // Auto-dismiss after 5s
    const timer = setTimeout(()=>modal.classList.add('hidden'), 5000);
    const closeBtn = document.getElementById('celebration-close');
    const nb = closeBtn.cloneNode(true); closeBtn.parentNode.replaceChild(nb,closeBtn);
    nb.addEventListener('click',()=>{ clearTimeout(timer); modal.classList.add('hidden'); });
}

function renderConquistas() {
    const list = document.getElementById('conquistas-list'); if(!list) return;
    const earned = state.conquistas||[];
    if(!earned.length) {
        list.innerHTML='<div class="conquista-empty">Nenhuma conquista ainda.<br>Complete metas, faça revisões e registre atividade consecutiva para desbloquear.</div>';
        return;
    }
    list.innerHTML = earned.map(c=>{
        const def = CONQUISTA_DEFS[c.id]; if(!def) return '';
        return `<div class="conquista-item">
            <div class="conquista-icon">${def.icon}</div>
            <div class="conquista-body">
                <div class="conquista-title">${def.title}</div>
                <div class="conquista-desc">${def.msg}</div>
                <div class="conquista-date">${fmtDateLong(c.earnedAt)}</div>
            </div>
        </div>`;
    }).join('');
}

// Hook conquistas checks into existing actions
function _checkAfterCheckin(id) {
    const allTasks=[]; pillarOrder().forEach(k=>(state.tasks[k]||[]).forEach(t=>allTasks.push(t)));
    const concluded=allTasks.filter(t=>t.taskStatus==='Concluída').length;
    if(concluded===1) checkConquista('primeira_conclusao');
    if(concluded===5) checkConquista('cinco_metas');
    const sg=calcStreakGeral();
    if(sg>=7)  checkConquista('streak_7');
    if(sg>=30) checkConquista('streak_30');
}

// ============================================================
//  UPDATED ONBOARDING (4 screens with Pilares)
// ============================================================
function showObStep(step) {
    _obStep = step;
    const total = 4;
    document.querySelectorAll('.ob-screen').forEach((s,i)=>s.classList.toggle('active', i===step));
    document.querySelectorAll('.ob-step-dot').forEach((d,i)=>{
        d.classList.toggle('active', i===step);
        d.classList.toggle('done', i<step);
    });
    const notes = ['Passo 1 de 4','Passo 2 de 4','Passo 3 de 4','Passo 4 de 4'];
    const nextLabels = ['Próximo →','Próximo →','Próximo →','Começar agora'];
    const noteEl = document.getElementById('ob-progress-note');
    const nextEl = document.getElementById('ob-next-btn');
    if (noteEl) noteEl.textContent = notes[step];
    if (nextEl) { nextEl.textContent = nextLabels[step]; nextEl.disabled = (step===1 && !_obSelectedPillar); }
    if (step===3) renderObPilarsEdit();
}

function renderObPilarsEdit() {
    const wrap = document.getElementById('ob-pillars-edit'); if(!wrap) return;
    wrap.innerHTML = pillarOrder().map((k,i)=>{
        const p = state.config.pillars[k]; if(!p) return '';
        return `<div class="ob-pillar-edit-row">
            <div class="ob-pillar-edit-num">${i+1}</div>
            <input type="text" value="${escHtml(p.name)}" data-pillar="${k}" placeholder="Nome do pilar">
        </div>`;
    }).join('');
    wrap.querySelectorAll('input').forEach(inp=>{
        inp.addEventListener('input', e=>{
            const k=e.target.dataset.pillar;
            if(state.config.pillars[k]) state.config.pillars[k].name=e.target.value;
        });
    });
}

// Override setupObListeners to handle 4 screens
function setupObListeners() {
    document.getElementById('ob-next-btn')?.addEventListener('click', () => {
        if (_obStep === 0) { showObStep(1); return; }
        if (_obStep === 1) {
            if (!_obSelectedPillar) return;
            if (state.config.pillars[_obSelectedPillar]) state.currentPillar = _obSelectedPillar;
            showObStep(2);
            return;
        }
        if (_obStep === 2) {
            const purpose = document.getElementById('ob-purpose-input')?.value.trim();
            if (purpose && purpose.length > 10) state.config.purpose = purpose;
            showObStep(3);
            return;
        }
        if (_obStep === 3) {
            finishOnboarding();
        }
    });
    document.getElementById('ob-skip-btn')?.addEventListener('click', finishOnboarding);
    document.getElementById('ob-use-example')?.addEventListener('click', () => {
        const inp = document.getElementById('ob-purpose-input');
        if (inp) inp.value = 'Construir uma vida com propósito, saúde e prosperidade — sendo a melhor versão de mim mesmo em cada papel que desempenho, e deixando um legado positivo para quem está ao meu redor.';
    });
    document.getElementById('ob-pillars-grid')?.addEventListener('click', e => {
        const btn = e.target.closest('.ob-pillar-btn'); if (!btn) return;
        document.querySelectorAll('.ob-pillar-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        _obSelectedPillar = btn.dataset.pillar;
        // Re-enable next button
        const nextBtn = document.getElementById('ob-next-btn');
        if (nextBtn) nextBtn.disabled = false;
    });
}

function finishOnboarding() {
    localStorage.setItem('ob_v2_done', '1');
    document.getElementById('ob-modal-overlay')?.classList.add('hidden');
    saveState();
    renderAll();
    if (_obSelectedPillar && state.config.pillars[_obSelectedPillar]) {
        switchSection('metas');
        switchPillar(_obSelectedPillar);
        setTimeout(()=>document.getElementById('toggle-add-task-btn')?.click(), 400);
    }
}

// Open settings and render conquistas when tab is clicked
function _hookConquistasTab() {
    document.querySelectorAll('.settings-tab').forEach(b=>b.addEventListener('click', e=>{
        if(e.currentTarget.dataset.tab==='conquistas') setTimeout(renderConquistas, 50);
        if(e.currentTarget.dataset.tab==='perfil') setTimeout(renderProfilePanel, 50);
    }));
}

// Track current section for help
function switchSection(s) {
    _currentSection = s;
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.section===s));
    document.querySelectorAll('.section').forEach(sec=>sec.classList.toggle('active',sec.id===s));
    if(s==='dashboard') updateDashboard();
    if(s==='roadmap') renderRoadmap();
    if(s==='revisao') renderAutoSummary();
    if(s==='vision') renderVisionChecklist();
    showSectionTooltip(s);
}
// ============================================================
//  METAS GANTT VIEW
// ============================================================
function renderMetasGanttView(tasks, pillarKey) {
    if (!tasks.length) return `<div class="empty-state"><p>Nenhuma meta neste pilar</p><p class="empty-sub">Clique em "+ Nova Meta" para adicionar.</p></div>`;

    const now = new Date();
    const withDl = tasks.filter(t=>t.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline));
    const noDl   = tasks.filter(t=>!t.deadline);

    if (!withDl.length) return `<div class="mg-no-deadline"><p>Nenhuma meta com prazo definido.</p><p>O Gantt requer data de início e encerramento para mostrar a linha do tempo.</p></div>`;

    // Timeline range: earliest start or creation to latest deadline
    const starts = withDl.map(t=> t.startDate ? new Date(t.startDate+'T12:00:00') : new Date(t.createdAt));
    const ends   = withDl.map(t=> new Date(t.deadline+'T12:00:00'));
    const minDate = new Date(Math.min(...starts.map(d=>d.getTime())));
    const maxDate = new Date(Math.max(...ends.map(d=>d.getTime())));
    const totalMs = Math.max(1, maxDate - minDate);

    // Generate month labels
    const monthLabels = [];
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
        const pct = (cur - minDate) / totalMs * 100;
        monthLabels.push({ label: cur.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}), pct });
        cur.setMonth(cur.getMonth()+1);
    }

    const nowPct = Math.max(0, Math.min(100, (now - minDate) / totalMs * 100));

    const rows = withDl.map(t=>{
        const st = calcStatus(t);
        const pct = Math.round(Math.min(1, getProgress(t)) * 100);
        const startRef = t.startDate ? new Date(t.startDate+'T12:00:00') : new Date(t.createdAt);
        const endRef   = new Date(t.deadline+'T12:00:00');
        const left  = Math.max(0, Math.min(100, (startRef - minDate) / totalMs * 100));
        const width = Math.max(1, Math.min(100 - left, (endRef - startRef) / totalMs * 100));
        const statusCls = st.css==='adiantada'?'green':st.css==='on-track'?'blue':st.css==='at-risk'?'amber':'red';

        return `<div class="mg-row" data-id="${t.id}" title="Clique para abrir">
            <div class="mg-name">
                <span class="mg-name-text">${escHtml(t.text)}</span>
                <span class="tracking-badge ${st.css}">${st.label}</span>
            </div>
            <div class="mg-bar-area">
                <div class="mg-bar-wrap" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%">
                    <div class="mg-bar-fill mg-fill-${statusCls}" style="width:${pct}%"></div>
                    <span class="mg-bar-label">${pct}%</span>
                </div>
            </div>
        </div>`;
    }).join('');

    const noDlRows = noDl.length ? `<div class="mg-section-label">Sem prazo definido</div>${noDl.map(t=>{
        const st=calcStatus(t);
        const pct=Math.round(Math.min(1,getProgress(t))*100);
        return `<div class="mg-row mg-no-dl-row" data-id="${t.id}">
            <div class="mg-name"><span class="mg-name-text">${escHtml(t.text)}</span><span class="tracking-badge ${st.css}">${st.label}</span></div>
            <div class="mg-bar-area"><div class="mg-bar-nodl"><div class="mg-bar-fill mg-fill-slate" style="width:${pct}%"></div><span class="mg-bar-label">${pct}%</span></div></div>
        </div>`;
    }).join('')}` : '';

    return `<div class="mg-container">
        <div class="mg-timeline-header">
            ${monthLabels.map(m=>`<div class="mg-month-label" style="left:${m.pct.toFixed(1)}%">${m.label}</div>`).join('')}
        </div>
        <div class="mg-rows">
            <div class="mg-today-bar" style="left:calc(220px + (100% - 220px) * ${(nowPct/100).toFixed(4)})" title="Hoje"></div>
            ${rows}
        </div>
        ${noDlRows}
    </div>`;
}

// ============================================================
//  RADAR CHART — Pilares Estratégicos
// ============================================================
function renderRadarChart() {
    const wrap = document.getElementById('radar-chart-wrap'); if (!wrap) return;
    const order = pillarOrder();
    const n = order.length;
    if (n < 3) { wrap.innerHTML=''; return; }

    const values = order.map(k=>{
        const p = state.config.pillars[k];
        const goals = p?.goals||[];
        return goals.length ? Math.round(goals.reduce((a,g)=>a+(parseFloat(g.pct)||0),0)/goals.length) : 0;
    });
    const labels = order.map(k => state.config.pillars[k]?.name||k);

    const W=420, H=380, CX=210, CY=195, R=110, LABEL_R=142;
    const angleStep = (2*Math.PI) / n;
    const startAngle = -Math.PI/2;

    // Grid rings
    const rings = [20,40,60,80,100];
    const gridSvg = rings.map(pct=>{
        const r = R * pct/100;
        const pts = order.map((_,i)=>{
            const a = startAngle + i*angleStep;
            return `${(CX+r*Math.cos(a)).toFixed(1)},${(CY+r*Math.sin(a)).toFixed(1)}`;
        }).join(' ');
        return `<polygon points="${pts}" fill="none" stroke="var(--border)" stroke-width="${pct===100?1.5:1}" opacity="${pct===100?'.5':'.3'}"/>`;
    }).join('');

    // Axis lines
    const axesSvg = order.map((_,i)=>{
        const a = startAngle + i*angleStep;
        return `<line x1="${CX}" y1="${CY}" x2="${(CX+R*Math.cos(a)).toFixed(1)}" y2="${(CY+R*Math.sin(a)).toFixed(1)}" stroke="var(--border)" stroke-width="1" opacity=".4"/>`;
    }).join('');

    // Data polygon
    const dataPts = values.map((v,i)=>{
        const r = R * Math.min(100,v)/100;
        const a = startAngle + i*angleStep;
        return `${(CX+r*Math.cos(a)).toFixed(1)},${(CY+r*Math.sin(a)).toFixed(1)}`;
    }).join(' ');

    // Dot points on polygon
    const dots = values.map((v,i)=>{
        const r = R * Math.min(100,v)/100;
        const a = startAngle + i*angleStep;
        return `<circle cx="${(CX+r*Math.cos(a)).toFixed(1)}" cy="${(CY+r*Math.sin(a)).toFixed(1)}" r="4" fill="var(--accent-vivid)" stroke="var(--bg-surface)" stroke-width="2"/>`;
    }).join('');

    // Labels — absolute y positioning, no dy double-application
    const labelsSvg = labels.map((lbl,i)=>{
        const a = startAngle + i*angleStep;
        const lx = CX + LABEL_R*Math.cos(a);
        const ly = CY + LABEL_R*Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.15 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        const pct = values[i];
        const words = lbl.split(' ');
        const nLines = words.length > 2 ? 2 : 1;
        const lineH = 14;
        const totalH = nLines * lineH + lineH; // name lines + % line
        const isTop    = Math.sin(a) < -0.3;
        const isBottom = Math.sin(a) > 0.3;

        // y_start: top of the label group
        let y_start;
        if (isTop)         y_start = ly - totalH + 4;   // group ends just above anchor
        else if (isBottom) y_start = ly + 4;             // group starts just below anchor
        else               y_start = ly - totalH / 2;    // centered on anchor

        // Name lines
        let nameSvg;
        if (nLines === 2) {
            const half = Math.ceil(words.length / 2);
            nameSvg = `<text x="${lx.toFixed(1)}" y="${(y_start).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="800" fill="var(--text-primary)" font-family="var(--font-body)">${escHtml(words.slice(0,half).join(' '))}</text>
                       <text x="${lx.toFixed(1)}" y="${(y_start+lineH).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="800" fill="var(--text-primary)" font-family="var(--font-body)">${escHtml(words.slice(half).join(' '))}</text>`;
        } else {
            nameSvg = `<text x="${lx.toFixed(1)}" y="${(y_start).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="800" fill="var(--text-primary)" font-family="var(--font-body)">${escHtml(lbl)}</text>`;
        }

        // % line always below the name block
        const y_pct = y_start + nLines * lineH + 2;
        const pctSvg = `<text x="${lx.toFixed(1)}" y="${(y_pct).toFixed(1)}" text-anchor="${anchor}" font-size="10" fill="var(--accent-vivid)" font-family="var(--font-body)" font-weight="700">${pct}%</text>`;

        return nameSvg + pctSvg;
    }).join('');

    // Ring pct labels
    const ringLabels = rings.map(pct=>{
        const r = R * pct/100;
        return `<text x="${(CX+4).toFixed(1)}" y="${(CY-r+3).toFixed(1)}" font-size="8" fill="var(--text-muted)" font-family="var(--font-body)">${pct}</text>`;
    }).join('');

    wrap.innerHTML=`<div class="radar-wrap">
        <div class="radar-title">Equilíbrio Estratégico</div>
        <div class="radar-sub">Progresso médio das metas 2028 por pilar</div>
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="radar-svg" style="max-width:420px">
            ${gridSvg}
            ${axesSvg}
            ${ringLabels}
            <polygon points="${dataPts}" fill="var(--accent-vivid)" fill-opacity=".18" stroke="var(--accent-vivid)" stroke-width="2.5" stroke-linejoin="round"/>
            ${dots}
            ${labelsSvg}
        </svg>
    </div>`;
}

// ============================================================
//  AUTH & LOGIN
// ============================================================
function showLoginScreen()   { document.getElementById('login-screen')?.classList.remove('hidden'); }
function hideLoginScreen()   { document.getElementById('login-screen')?.classList.add('hidden'); }
function showLoadingScreen() { document.getElementById('loading-screen')?.classList.remove('hidden'); }
function hideLoadingScreen() { document.getElementById('loading-screen')?.classList.add('hidden'); }
function showLoginError(msg) {
    const el = document.getElementById('login-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
function hideLoginError() { document.getElementById('login-error')?.classList.add('hidden'); }

let _loginMode = 'login'; // 'login' | 'signup'

function setupLoginListeners() {
    // Google login
    document.getElementById('login-google-btn')?.addEventListener('click', async () => {
        hideLoginError();
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await fbAuth.signInWithPopup(provider);
        } catch(e) {
            showLoginError(friendlyAuthError(e.code));
        }
    });

    // Email submit
    document.getElementById('login-submit-btn')?.addEventListener('click', async () => {
        hideLoginError();
        const email    = document.getElementById('login-email')?.value.trim();
        const password = document.getElementById('login-password')?.value;
        const name     = document.getElementById('login-name')?.value.trim();
        if (!email || !password) return showLoginError('Preencha email e senha.');
        try {
            if (_loginMode === 'signup') {
                if (!name) return showLoginError('Digite seu nome.');
                if (password.length < 6) return showLoginError('Senha deve ter pelo menos 6 caracteres.');
                const cred = await fbAuth.createUserWithEmailAndPassword(email, password);
                await cred.user.updateProfile({ displayName: name });
            } else {
                await fbAuth.signInWithEmailAndPassword(email, password);
            }
        } catch(e) {
            showLoginError(friendlyAuthError(e.code));
        }
    });

    // Toggle login/signup
    document.getElementById('login-toggle-btn')?.addEventListener('click', () => {
        _loginMode = _loginMode === 'login' ? 'signup' : 'login';
        const isSignup = _loginMode === 'signup';
        document.getElementById('login-name-field').style.display  = isSignup ? '' : 'none';
        document.getElementById('login-toggle-text').textContent   = isSignup ? 'Já tem conta?' : 'Não tem conta?';
        document.getElementById('login-toggle-btn').textContent    = isSignup ? 'Entrar' : 'Criar conta';
        document.getElementById('login-submit-btn').textContent    = isSignup ? 'Criar conta' : 'Entrar';
        document.getElementById('login-forgot-btn').style.display  = isSignup ? 'none' : '';
        hideLoginError();
    });

    // Forgot password
    document.getElementById('login-forgot-btn')?.addEventListener('click', async () => {
        hideLoginError();
        const email = document.getElementById('login-email')?.value.trim();
        if (!email) return showLoginError('Digite seu email acima primeiro.');
        try {
            await fbAuth.sendPasswordResetEmail(email);
            showLoginError('Email de recuperação enviado. Verifique sua caixa de entrada.');
            document.getElementById('login-error').style.color = 'var(--green)';
        } catch(e) {
            showLoginError(friendlyAuthError(e.code));
        }
    });

    // Enter key on email/password fields
    ['login-email','login-password','login-name'].forEach(id=>{
        document.getElementById(id)?.addEventListener('keypress', e=>{
            if(e.key==='Enter') document.getElementById('login-submit-btn')?.click();
        });
    });
}

function friendlyAuthError(code) {
    const msgs = {
        'auth/user-not-found':        'Email não encontrado.',
        'auth/wrong-password':        'Senha incorreta.',
        'auth/invalid-credential':    'Email ou senha incorretos.',
        'auth/email-already-in-use':  'Este email já está cadastrado.',
        'auth/weak-password':         'Senha muito fraca. Use pelo menos 6 caracteres.',
        'auth/invalid-email':         'Email inválido.',
        'auth/too-many-requests':     'Muitas tentativas. Aguarde alguns minutos.',
        'auth/popup-closed-by-user':  'Login cancelado.',
        'auth/network-request-failed':'Sem conexão. Verifique sua internet.',
    };
    return msgs[code] || 'Erro ao autenticar. Tente novamente.';
}

function logout() {
    showConfirm('Deseja sair da sua conta?', async () => {
        await fbAuth.signOut();
        _currentUser = null;
        // Reset state
        state = { currentPillar: null, tasks: {}, revisoes: [], conquistas: [], config: deepClone(DEFAULT_CONFIG), filterStatus:'all', filterType:'all', focusMode:false };
        showLoginScreen();
    });
}

// ---- PROFILE PANEL ----
function renderProfilePanel() {
    const panel = document.getElementById('profile-panel'); if (!panel) return;
    const user = _currentUser;
    if (!user) { panel.innerHTML='<p class="settings-hint">Não autenticado.</p>'; return; }

    const name     = user.displayName || state.config.userName || 'Usuário';
    const email    = user.email || '';
    const photoURL = user.photoURL || '';
    const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const memberSince = user.metadata?.creationTime
        ? new Date(user.metadata.creationTime).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})
        : '—';
    const daysSince = user.metadata?.creationTime
        ? Math.floor((Date.now() - new Date(user.metadata.creationTime)) / 86400000)
        : 0;

    // Stats
    const allTasks = []; pillarOrder().forEach(k=>(state.tasks[k]||[]).forEach(t=>allTasks.push(t)));
    const totalMetas   = allTasks.length;
    const concluded    = allTasks.filter(t=>t.taskStatus==='Concluída').length;
    const streakRecord = calcStreakGeral();
    const phrase       = state.config.inspirationalPhrase || '';

    panel.innerHTML = `
    <div class="profile-avatar-wrap">
        ${photoURL
            ? `<img src="${photoURL}" class="profile-avatar-img" alt="${escHtml(name)}">`
            : `<div class="profile-avatar-initials">${initials}</div>`}
        <div class="profile-user-info">
            <div class="profile-name">${escHtml(name)}</div>
            <div class="profile-email">${escHtml(email)}</div>
        </div>
    </div>

    <div class="profile-stats-row">
        <div class="profile-stat">
            <span class="profile-stat-val">${totalMetas}</span>
            <span class="profile-stat-lbl">Metas criadas</span>
        </div>
        <div class="profile-stat">
            <span class="profile-stat-val">${concluded}</span>
            <span class="profile-stat-lbl">Concluídas</span>
        </div>
        <div class="profile-stat">
            <span class="profile-stat-val">${streakRecord}d</span>
            <span class="profile-stat-lbl">Streak atual</span>
        </div>
    </div>

    <div class="profile-member-since">Membro desde ${memberSince} · ${daysSince} dia${daysSince!==1?'s':''} de jornada</div>

    <div class="settings-field" style="margin-top:16px">
        <label>Seu nome de exibição</label>
        <input type="text" id="cfg-name" value="${escHtml(state.config.userName||name)}" placeholder="Como quer ser chamado?">
    </div>
    <div class="settings-field">
        <label>Frase pessoal <span style="font-weight:400;color:var(--text-muted)">(aparece no header)</span></label>
        <input type="text" id="cfg-phrase" value="${escHtml(phrase)}" placeholder="Ex: Disciplina é liberdade.">
    </div>

    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <button class="footer-btn danger" id="logout-btn" style="width:100%">Sair da conta</button>
    </div>`;

    document.getElementById('logout-btn')?.addEventListener('click', logout);
}

// ---- BOOT ----
document.addEventListener('DOMContentLoaded', () => {
    showLoadingScreen();
    setupLoginListeners();

    fbAuth.onAuthStateChanged(async (user) => {
        if (user) {
            _currentUser = user;
            hideLoginScreen();
            await loadStateFromFirestore(user.uid);
            hideLoadingScreen();
            // Clear stale onboarding flags if fresh user
            const userKey = `ob_v2_done_${user.uid}`;
            if (!localStorage.getItem(userKey)) {
                ['ob_v2_done','ob_checklist_done',
                 'tt_vision','tt_dashboard','tt_metas','tt_roadmap','tt_revisao']
                .forEach(k => localStorage.removeItem(k));
                localStorage.setItem(userKey, '1');
            }
            _initAfterAuth(user);
        } else {
            hideLoadingScreen();
            showLoginScreen();
        }
    });
});
