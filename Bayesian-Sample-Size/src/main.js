/**
 * Bayesian Reliability Planner - Unified Core Build
 * [v1.3.1 Hotfix for GitHub Pages]
 */

console.log("🚀 [System] Unified Core Loading...");

// ==========================================
// 1. 常數定義 (Constants)
// ==========================================
const DCC_MATRIX = [
  { id: 'major-imp', label: 'Major Improvement', mtbf50: 5.00, mtbf05: 1.00, beta: 1.50 },
  { id: 'medium-imp', label: 'Medium Improvement', mtbf50: 2.00, mtbf05: 0.98, beta: 1.20 },
  { id: 'minor-imp', label: 'Minor Improvement', mtbf50: 1.43, mtbf05: 0.95, beta: 1.05 },
  { id: 'carry-over', label: 'Carry-Over', mtbf50: 1.00, mtbf05: 0.83, beta: 1.00 },
  { id: 'minor-com', label: 'Minor Compromise', mtbf50: 0.77, mtbf05: 0.51, beta: 0.95 },
  { id: 'medium-com', label: 'Medium Compromise', mtbf50: 0.67, mtbf05: 0.33, beta: 0.83 },
  { id: 'major-com', label: 'Major Compromise', mtbf50: 0.56, mtbf05: 0.11, beta: 0.67 }
];

const RAM_ACTIVITIES = [
  { id: 'mission-profile', label: 'Mission Profile (任務剖面)', weight: 0.15 },
  { id: 'life-tests', label: 'Reliability/Life Tests (可靠度壽命測試)', weight: 0.30 },
  { id: 'dfmea-hist', label: 'DFMEA - Historical (歷史失效分析)', weight: 0.10 },
  { id: 'dfmea-change', label: 'DFMEA - Design Change (設計變更分析)', weight: 0.10 },
  { id: 'dev-tests', label: 'Engineering Development Tests (開發驗證測試)', weight: 0.35 }
];

// ==========================================
// 2. 核心數學引擎 (Math Core)
// ==========================================

function getBinomialConfidence(n, f, r) {
  if (n <= 0) return 0;
  const p_failure = 1 - r;
  return 1 - jStat.binomial.cdf(f, n, p_failure);
}

function getBinomialSampleSize(r, c, f) {
  let n = f;
  if (n === 0) n = 1; 
  while (true) {
    const conf = getBinomialConfidence(n, f, r);
    if (conf >= c) return n;
    n++;
    if (n > 10000) return 10000;
  }
}

function calculateRAM(scores, weightsMap) {
  let sumWeightedLogits = 0;
  for (let id in scores) {
    const p = scores[id];
    const eps = 0.0001;
    const safeP = Math.max(eps, Math.min(1 - eps, p));
    const logit = Math.log(safeP / (1 - safeP));
    sumWeightedLogits += logit * (weightsMap[id] || 0.2);
  }
  return Math.exp(sumWeightedLogits) / (1 + Math.exp(sumWeightedLogits));
}

// B1: 歷史實體數據
function solveMethodB1(historyN, historyF, targetR, targetC, targetF, dcc, ram) {
  const cHistory = getBinomialConfidence(historyN, historyF, targetR);
  const weight = dcc * ram;
  const cPrior = cHistory * weight;
  let nEq = 0;
  while (getBinomialConfidence(nEq, 0, targetR) < cPrior) {
    nEq++;
    if (nEq > 2000) break;
  }
  const nClassical = getBinomialSampleSize(targetR, targetC, targetF);
  const nFinal = Math.min(Math.max(0, nClassical - nEq), nClassical);
  return { nFinal, nClassical, nEq, cPrior, cHistory };
}

// B2: 專家 3 點估計
function solveMethodB2(rL_pct, rM_pct, rH_pct, targetR, targetC, targetF, dcc, ram) {
  const factor = dcc * ram;
  const L_prior = Math.min(0.995, (rL_pct / 100) * factor);
  const M_prior = Math.min(0.995, (rM_pct / 100) * factor);
  const H_prior = Math.min(0.995, (rH_pct / 100) * factor);
  const ER = (L_prior + 4 * M_prior + H_prior) / 6;
  const VarR = Math.pow((H_prior - L_prior) / 6, 2);
  const nClassical = getBinomialSampleSize(targetR, targetC, targetF);
  if (VarR < 0.00001) return { nFinal: nClassical, nClassical };
  const common = (ER - Math.pow(ER, 2)) / VarR - 1;
  const a = (1 - ER) * common;
  const b = ER * common;
  const targetP = 1 - targetR;
  let n = targetF;
  while (true) {
    const conf = jStat.beta.cdf(targetP, a + targetF, b + n - targetF);
    if (conf >= targetC) break;
    n++;
    if (n > 10000) break;
  }
  return { nFinal: Math.min(n, nClassical), nClassical, a, b, mu: ER, L_raw: rL_pct, M_raw: rM_pct, H_raw: rH_pct, L_prior, M_prior, H_prior, dccUsed: dcc, ramUsed: ram, targetR, targetC, targetF };
}

// B2: 直接輸入 Beta 參數
function solveMethodB2WithParams(a, b, targetR, targetC, targetF, dcc, ram) {
  const nClassical = getBinomialSampleSize(targetR, targetC, targetF);
  const targetP = 1 - targetR;
  let n = targetF;
  while (true) {
    const conf = jStat.beta.cdf(targetP, a + targetF, b + n - targetF);
    if (conf >= targetC) break;
    n++;
    if (n > 10000) break;
  }
  return { nFinal: Math.min(n, nClassical), nClassical, a, b };
}

// B3: 子系統組合 (Guo et al. 2010)
function solveMethodB3(subsystems, targetR, targetC, targetF, dcc, ram) {
  if (!subsystems || subsystems.length === 0) return { nFinal: 0, nClassical: 0 };
  const subs = subsystems.map(s => {
    const ni = parseInt(s.n) || 0;
    const fi = parseInt(s.f) || 0;
    const si = ni - fi;
    const er = si / (ni + 1);
    const vr = (si * (ni + 1 - si)) / (Math.pow(ni + 1, 2) * (ni + 2));
    return { er, vr };
  });
  const sysER_raw = subs.reduce((prod, s) => prod * s.er, 1);
  const term1 = subs.reduce((prod, s) => prod * (Math.pow(s.er, 2) + s.vr), 1);
  const sysVarR = Math.max(0.000001, term1 - Math.pow(sysER_raw, 2));
  
  const factor = dcc * ram;
  const sysER = Math.min(0.995, sysER_raw * factor);

  const common = (sysER - Math.pow(sysER, 2)) / sysVarR - 1;
  const a = (1 - sysER) * common;
  const b = sysER * common;
  const nClassical = getBinomialSampleSize(targetR, targetC, targetF);
  const targetP = 1 - targetR;
  let n = targetF;
  while (true) {
    const conf = jStat.beta.cdf(targetP, a + targetF, b + n - targetF);
    if (conf >= targetC) break;
    n++;
    if (n > 10000) break;
  }
  return { nFinal: Math.min(n, nClassical), nClassical, a, b, mu: sysER, targetR, targetC, targetF };
}

// B4: MTBF 歷史信心點位 (對標 B4.1: 自動執行 Hist * DCC * RAM 的轉換)
function solveMethodB4(histMTBF, lowMTBF, targetMTBF, targetC, targetF, dcc1, dcc2, ram) {
  const m50 = histMTBF * dcc1 * ram;
  const m05 = lowMTBF * dcc2 * ram;
  const L50 = 1 / m50;
  const L95 = 1 / m05;
  const ratio = L95 / L50;
  let a = 0.1;
  let minDiff = Infinity;
  for (let i = 0.1; i <= 100; i += 0.1) {
    const r = jStat.chisquare.inv(0.95, 2 * i) / jStat.chisquare.inv(0.50, 2 * i);
    const diff = Math.abs(r - ratio);
    if (diff < minDiff) { minDiff = diff; a = i; }
  }
  
  // 對標教材 B4.1: b = (MTBF50 * Chi2_inv(0.5, 2a)) / 2
  const b = (m50 * jStat.chisquare.inv(0.50, 2 * a)) / 2;
  const targetL = 1 / targetMTBF;
  let T = 0;
  while (true) {
    // 對標教材 B4.1: 後驗 Shape = a + f, 後驗 Scale = 1 / (b + T)
    const prob = jStat.gamma.cdf(targetL, a + targetF, 1 / (b + T));
    if (prob >= targetC) break;
    T += 1;
    if (T > 100000) break;
  }
  const tClassical = (jStat.chisquare.inv(targetC, 2 * (targetF + 1)) * targetMTBF) / 2;
  return { nFinal: Math.min(T, tClassical), nClassical: tClassical, a, b, dccUsed: dcc1, ramUsed: ram };
}

// B5: BAZE (Gamma Prior) - 修正版
function solveMethodB5(alpha, beta, targetMTBF, targetC, targetF, dcc1, dcc2, ram) {
  // 對標 BAZE 模型：
  // a_adj 為先驗失效數 (通常 alpha = f_prior + 1)
  // b_adj 為先驗等效時間，受 DCC (變更因子) 與 RAM (信心) 影響
  // 注意：DCC 與 RAM 是縮減先驗時間的，所以是相乘 (dcc < 1 表示變更大)
  const a_adj = alpha; 
  const b_adj = beta * dcc2 * ram; 
  
  const targetL = 1 / targetMTBF;
  let T = 0;
  
  // 求解 P(lambda < 1/MTBF_goal) >= C
  // 使用 Gamma 後驗: shape = a + f, rate = b + T => scale = 1/(b+T)
  while (true) {
    const prob = jStat.gamma.cdf(targetL, a_adj + targetF, 1 / (b_adj + T));
    if (prob >= targetC) break;
    T += 0.5; // 提高求解精度
    if (T > 200000) break;
  }
  
  // 經典卡方作為基準 (無先驗時)
  const tClassical = (jStat.chisquare.inv(targetC, 2 * (targetF + 1)) * targetMTBF) / 2;
  const nFinal = Math.max(0, T);
  
  return { 
    nFinal, 
    nClassical: tClassical, 
    a: a_adj, 
    b: b_adj, 
    dccUsed: dcc2, 
    ramUsed: ram,
    saving: tClassical > 0 ? (1 - nFinal / tClassical) * 100 : 0
  };
}

// ==========================================
// 3. UI 狀態管理 (App State)
// ==========================================
let selectedMethod = 'B1';
let appData = {
  targetType: 'count',
  target: { r: 90, c: 80, f: 0, mtbf: 1000 },
  factors: { dcc: 1.0, ram: 0.5 },
  ramScores: {},
  ramWeights: { 'mission-profile': 0.15, 'life-tests': 0.30, 'dfmea-hist': 0.10, 'dfmea-change': 0.10, 'dev-tests': 0.35 },
  subsystems: [{ id: 1, n: 20, f: 0 }],
  results: null
};

// ==========================================
// 4. 初始化與渲染 (UI & Initialization)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 [System] DOMContentLoaded Fired.");
  const safeInit = (name, fn) => {
    try {
      fn();
      console.log(`✅ [System] ${name} initialized.`);
    } catch (e) {
      console.error(`❌ [System] ${name} FAILED:`, e);
    }
  };

  safeInit('Icons', () => {
    if (_lucide && _lucide.createIcons) {
      _lucide.createIcons({ icons: _lucide.icons || _lucide });
    }
  });
  safeInit('TargetSelector', initTargetTypeSelector);
  safeInit('DCC', initDCCSelect);
  safeInit('RAM', initRAMActivities);
  safeInit('MethodSelector', initMethodSelector);
  safeInit('Wizard', initWizard);
  safeInit('B2Toggle', initB2Toggle);
  safeInit('B2Helper', initB2Helper);
  safeInit('Subsystem', initSubsystemManager);
  safeInit('Calculate', initCalculateBtn);
  safeInit('Download', initDownloadBtn);

  // === [v1.3.2] 強制掛載全域，解決 GitHub Pages 作用域問題 ===
  window.appData = appData;
  window.restartWizard = initWizard; 
  console.log("💎 [System] Global API Exposed.");
});

// 修正 Lucide 全域變數對照
const _lucide = window.lucide || window.Lucide;

function initTargetTypeSelector() {
  const options = document.querySelectorAll('.type-card');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      appData.targetType = opt.dataset.type;
      if (appData.targetType === 'count') {
        document.querySelectorAll('.count-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.time-only').forEach(el => el.style.display = 'none');
      } else {
        document.querySelectorAll('.count-only').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.time-only').forEach(el => el.style.display = 'block');
      }
    });
  });
}

function initDCCSelect() {
  const select = document.getElementById('dcc-select');
  if (!select) return;
  DCC_MATRIX.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.label} (Beta Factor: ${item.beta})`;
    if (item.id === 'minor-imp') opt.selected = true;
    select.appendChild(opt);
  });
}

function initRAMActivities() {
  const container = document.getElementById('ram-activities-container');
  if (!container) return;
  const defaultScores = [95, 95, 90, 90, 95.2];
  RAM_ACTIVITIES.forEach((activity, idx) => {
    const val = defaultScores[idx] || 50;
    const div = document.createElement('div');
    div.className = 'ram-activity-v2 mb-2';
    div.innerHTML = `
      <div class="ram-info" style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div style="flex: 1; padding-right: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <span style="font-weight: 700; color: #fff;">${activity.label}</span>
            <span style="background: rgba(var(--primary-rgb), 0.2); color: var(--primary); font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(var(--primary-rgb), 0.3);">權重 ${activity.weight * 100}%</span>
          </div>
          <div id="label-${activity.id}" style="font-size: 0.8rem; color: var(--primary); opacity: 0.9; font-family: monospace;">信心估計: ${val}%</div>
        </div>
        <div class="ram-input-group" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 4px;">
          <input type="number" step="0.1" class="ram-number-input" data-id="${activity.id}" min="1" max="99.9" value="${val}" style="width: 70px; height: 36px; border-radius: 6px; text-align: center; font-weight: bold;">
          <span style="font-size: 0.9rem; opacity: 0.7;">%</span>
        </div>
      </div>
    `;
    container.appendChild(div);
    appData.ramScores[activity.id] = val / 100;
  });

  const updateRAMDisplay = () => {
    appData.factors.ram = calculateRAM(appData.ramScores, appData.ramWeights);
    const display = document.getElementById('ram-value');
    if (display) display.textContent = appData.factors.ram.toFixed(3);
    window.dispatchEvent(new CustomEvent('ram-updated'));
  };

  document.querySelectorAll('.ram-number-input').forEach(input => {
    input.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      if (isNaN(val)) return;
      val = Math.max(1, Math.min(99.9, val));
      const id = e.target.dataset.id;
      appData.ramScores[id] = val / 100;
      const labelEl = document.getElementById(`label-${id}`);
      if (labelEl) labelEl.textContent = `信心估計: ${val}%`;
      updateRAMDisplay();
    });
  });
  updateRAMDisplay();
}

// Step 2 導航邏輯：三路徑扁平化
window.selectPath = function(path) {
  const wizardContent = document.getElementById('method-wizard-content');
  const inputsContainer = document.getElementById('method-inputs-container');
  
  // 先全部隱藏
  wizardContent.style.display = 'none';
  inputsContainer.style.display = 'none';
  ['B1', 'B2', 'B3', 'B4', 'B5'].forEach(id => {
    document.getElementById(`inputs-${id}`).style.display = 'none';
  });
  
  if (path === 'B4') {
    appData.selectedMethod = 'B4';
    inputsContainer.style.display = 'block';
    document.getElementById('inputs-B4').style.display = 'block';
  } else if (path === 'B5') {
    appData.selectedMethod = 'B5';
    inputsContainer.style.display = 'block';
    document.getElementById('inputs-B5').style.display = 'block';
  } else if (path === 'B13') {
    wizardContent.style.display = 'block';
    // 呼叫內部的 restartWizard
    if (typeof window.restartWizard === 'function') {
      window.restartWizard();
    }
  }
};

function initMethodSelector() {
  const options = document.querySelectorAll('.method-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedMethod = opt.dataset.method;
      document.querySelectorAll('.method-inputs').forEach(i => i.classList.remove('active'));
      const activeInput = document.getElementById(`inputs-${selectedMethod}`);
      if (activeInput) activeInput.classList.add('active');
    });
  });
}

function initWizard() {
  const questionEl = document.getElementById('wizard-question-text');
  const optionsEl = document.getElementById('wizard-options');
  const recBadge = document.getElementById('recommended-method-info');
  const recName = document.getElementById('rec-method-name');

  const questions = {
    start: () => {
      if (appData.targetType === 'count') {
        renderQuestion("您目前掌握哪種型態的可靠度 (R%) 先驗資訊？", [
          { text: "我有歷史測試數據 (n, f 實體數據)", next: 'has_data' },
          { text: "我使用專家估計 (三點估計法)", method: 'B2' }
        ]);
      } else {
        renderQuestion("您具備哪種型態的 MTBF 先驗資訊？", [
          { text: "我有 MTBF 歷史統計值 (點估計/下限)", method: 'B4' },
          { text: "我有 Gamma 先驗參數 (Alpha/Beta)", method: 'B5' }
        ]);
      }
    },
    has_data: () => {
      renderQuestion("您的數據是單一系統，還是由多個子系統組成的？", [
        { text: "單一系統數據", method: 'B1', directCalc: true },
        { text: "多個子系統數據", method: 'B3', directCalc: true }
      ]);
    }
  };

  function renderQuestion(text, choices) {
    console.log("🛠️ [Wizard] Rendering Question:", text);
    if (!questionEl || !optionsEl) return;
    questionEl.textContent = text;
    optionsEl.innerHTML = '';
    choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'wizard-btn';
      btn.textContent = choice.text;
      btn.onclick = () => {
        if (choice.method) {
          selectMethod(choice.method);
          if (choice.directCalc) {
            const nextBtn = document.querySelector(`#inputs-${choice.method} .btn-next-step`);
            if (nextBtn) {
              nextBtn.innerHTML = `查看計算結果 <i data-lucide="calculator"></i>`;
              nextBtn.onclick = () => document.getElementById('calculate-btn').click();
              if (_lucide && _lucide.createIcons) _lucide.createIcons({ icons: _lucide.icons || _lucide });
            }
          }
        }
        else if (choice.next) questions[choice.next]();
      };
      optionsEl.appendChild(btn);
    });
  }

  function selectMethod(methodId) {
    appData.selectedMethod = methodId;
    const container = document.getElementById('method-inputs-container');
    container.style.display = 'block';
    
    // 隱藏所有輸入區，顯示目標區
    ['B1', 'B2', 'B3', 'B4', 'B5'].forEach(id => {
      const el = document.getElementById(`inputs-${id}`);
      if (el) el.style.display = 'none';
    });
    
    const activeInput = document.getElementById(`inputs-${methodId}`);
    if (activeInput) activeInput.style.display = 'block';
    
    recBadge.style.display = 'flex';
    recName.textContent = `Method ${methodId}`;
    setTimeout(() => container.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  window.restartWizard = questions.start;
  questions.start();
}

function initB2Toggle() {
  const btns = document.querySelectorAll('.btn-toggle');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.closest('#inputs-B2')) return;
      const parent = btn.closest('.toggle-group');
      parent.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.b2Mode;
      document.getElementById('b2-pert-inputs').style.display = mode === 'pert' ? 'grid' : 'none';
      document.getElementById('b2-helper-inputs').style.display = mode === 'helper' ? 'block' : 'none';
      document.getElementById('b2-params-inputs').style.display = mode === 'params' ? 'grid' : 'none';
    });
  });
}

function initB2Helper() {
  const nInput = document.getElementById('b2-helper-n');
  const rInput = document.getElementById('b2-helper-r');
  const applyBtn = document.getElementById('apply-b2-helper');
  if (!nInput || !rInput) return;
  const update = () => {
    const n = parseInt(nInput.value);
    const r = parseInt(rInput.value);
    if (isNaN(n) || isNaN(r) || n < r) return;
    const L = jStat.beta.inv(0.05, n - r, r + 1) * 100;
    const M = jStat.beta.inv(0.50, n - r, r + 1) * 100;
    const H = jStat.beta.inv(0.95, n - r, r + 1) * 100;
    const L_final = Math.floor(L * 10) / 10;
    const M_final = Math.floor(M * 10) / 10;
    const H_final = Math.floor(H * 10) / 10;
    document.getElementById('help-l').textContent = L_final.toFixed(1);
    document.getElementById('help-m').textContent = M_final.toFixed(1);
    document.getElementById('help-h').textContent = H_final.toFixed(1);
  };
  nInput.addEventListener('input', update);
  rInput.addEventListener('input', update);
  applyBtn?.addEventListener('click', () => {
    document.getElementById('b2-low').value = document.getElementById('help-l').textContent;
    document.getElementById('b2-most').value = document.getElementById('help-m').textContent;
    document.getElementById('b2-high').value = document.getElementById('help-h').textContent;
    document.getElementById('calculate-btn')?.scrollIntoView({ behavior: 'smooth' });
  });
  update();
}

function initSubsystemManager() {
  const container = document.getElementById('subsystems-container');
  if (!container) return;
  const render = () => {
    container.innerHTML = appData.subsystems.map((s, index) => {
      const letter = String.fromCharCode(65 + index);
      return `
        <div class="subsystem-row glass-dark p-4 mb-4" style="border-left: 4px solid var(--primary);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h4 style="color: var(--primary); font-weight: 700; margin: 0;">子系統 ${letter}</h4>
            <button class="btn-remove" data-index="${index}" style="background:rgba(239,68,68,0.1); color:#ef4444; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">移除</button>
          </div>
          <div class="input-grid">
            <div class="form-group"><label>樣本數 n</label><input type="number" class="sub-n" data-index="${index}" value="${s.n}"></div>
            <div class="form-group"><label>失效數 f</label><input type="number" class="sub-f" data-index="${index}" value="${s.f}"></div>
          </div>
        </div>
      `;
    }).join('');
    document.querySelectorAll('.sub-n').forEach(i => i.onchange = (e) => appData.subsystems[e.target.dataset.index].n = parseInt(e.target.value));
    document.querySelectorAll('.sub-f').forEach(i => i.onchange = (e) => appData.subsystems[e.target.dataset.index].f = parseInt(e.target.value));
    document.querySelectorAll('.btn-remove').forEach(b => b.onclick = (e) => {
      appData.subsystems.splice(e.target.dataset.index, 1);
      render();
    });
  };
  document.getElementById('add-subsystem-btn')?.addEventListener('click', () => {
    appData.subsystems.push({ id: Date.now(), n: 20, f: 0 });
    render();
  });
  render();
}

function initCalculateBtn() {
  const btn = document.getElementById('calculate-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    try {
      const getVal = (id, def = 0) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const v = parseFloat(el.value);
        return isNaN(v) ? def : v;
      };

      const r = getVal('target-r', 90) / 100;
      const c = getVal('target-c', 80) / 100;
      const f = getVal('target-f', 0);
      const dccId = document.getElementById('dcc-select')?.value || 'carry-over';
      const dccRow = DCC_MATRIX.find(m => m.id === dccId) || DCC_MATRIX[3];
      const dccBeta = dccRow.beta;
      const ram = appData.factors.ram || 0.5;

      console.log("📊 [Calculate] Inputs:", { method: appData.selectedMethod, r, c, f, dccId, ram });

      let result = null;
      const method = appData.selectedMethod;
      if (method === 'B1') {
        result = solveMethodB1(getVal('b1-n'), getVal('b1-f'), r, c, f, dccBeta, ram);
      } else if (method === 'B2') {
        const mode = document.querySelector('#inputs-B2 .btn-toggle.active')?.dataset.b2Mode || 'pert';
        if (mode === 'pert' || mode === 'helper') {
          result = solveMethodB2(getVal('b2-low'), getVal('b2-most'), getVal('b2-high'), r, c, f, dccBeta, ram);
        } else {
          result = solveMethodB2WithParams(getVal('b2-a'), getVal('b2-b'), r, c, f, dccBeta, ram);
        }
      } else if (method === 'B3') {
        result = solveMethodB3(appData.subsystems, r, c, f, dccBeta, ram);
      } else if (method === 'B4') {
        const hist = getVal('b4-hist-mtbf', 600);
        const low = getVal('b4-hist-low', 580);
        const tGoal = getVal('target-mtbf', 1000);
        result = solveMethodB4(hist, low, tGoal, c, f, dccRow.mtbf50, dccRow.mtbf05, ram);
      } else if (method === 'B5') {
        const tGoal = getVal('target-mtbf', 1000);
        // B5 專業模式：強制將 DCC 與 RAM 設為 1.0，代表輸入值即為最终先驗
        result = solveMethodB5(getVal('b5-alpha'), getVal('b5-beta'), tGoal, c, f, 1, 1, 1);
      }

      if (result) {
        displayResults(result);
        if (window.nextStep) window.nextStep(4);
      }
    } catch (err) {
      console.error(err);
      alert("計算發生錯誤，請檢查數值。");
    }
  });

  // 額外綁定 B5 專屬直達按鈕
  document.getElementById('calculate-btn-b5')?.addEventListener('click', () => {
    document.getElementById('calculate-btn').click(); 
  });
}

function displayResults(result) {
  const nC = result.nClassical || 0;
  const nB = result.nFinal || 0;
  const unit = appData.targetType === 'count' ? '台' : '小時';
  
  document.getElementById('res-classical').textContent = nC.toLocaleString(undefined, {maximumFractionDigits: 1});
  document.getElementById('res-bayesian').textContent = nB.toLocaleString(undefined, {maximumFractionDigits: 1});
  
  // 更新前兩個框的單位顯示，排除節省率框
  const unitEls = document.querySelectorAll('.box-value small');
  if (unitEls[0]) unitEls[0].textContent = unit;
  if (unitEls[1]) unitEls[1].textContent = unit;
  if (unitEls[2]) unitEls[2].textContent = '%';

  const saving = nC > 0 ? Math.round((1 - nB / nC) * 100) : 0;
  document.getElementById('res-saving').textContent = Math.max(0, saving);
  const adviceEl = document.getElementById('res-advice');
  if (saving <= 0) {
    adviceEl.innerHTML = `<strong>提示：</strong> 目前的先驗信心低於測試目標，貝氏方法無法提供減免。`;
  } else {
    adviceEl.innerHTML = `傳統需要 ${nC.toFixed(1)} ${unit}，貝氏優化後只需 ${nB.toFixed(1)} ${unit}。節省了 ${saving}% 的測試資源。`;
  }
  const techDetails = document.getElementById('tech-details');
  if (techDetails) {
    techDetails.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px;">
        <div>
          <p style="color: var(--primary); font-weight: bold; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(var(--primary-rgb), 0.3);">[1. 診斷與修正]</p>
          DCC 修正: ${result.dccUsed || '?'}<br>
          RAM 因子: ${(result.ramUsed || 1).toFixed(3)}
        </div>
        <div>
          <p style="color: var(--primary); font-weight: bold; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(var(--primary-rgb), 0.3);">[2. 貝氏分佈擬合]</p>
          Alpha (a): ${result.a?.toFixed(2) || '?'}<br>
          Beta (b): ${result.b?.toFixed(2) || '?'}
        </div>
        <div>
          <p style="color: var(--primary); font-weight: bold; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(var(--primary-rgb), 0.3);">[3. 樣本數求解]</p>
          傳統: ${nC.toFixed(1)} | 貝氏: ${nB.toFixed(1)}
        </div>
      </div>
      <div class="mt-6 pt-4" style="border-top: 1px solid rgba(255,255,255,0.05);">
        <p style="color: var(--primary); font-size: 0.9rem; margin-bottom: 0.5rem;">核心公式清單 (對標當前模式)：</p>
        <ul style="list-style: none; padding: 0; opacity: 0.8; font-size: 0.8rem;">
          ${appData.targetType === 'count' ? `
            <li>• 修正因子: $R_{prior} = \min(0.995, R_{input} \times DCC \times RAM)$</li>
            <li>• 擬合參數: $a = (1 - E(R)) \times common, b = E(R) \times common$</li>
            <li>• 貝氏求解: $Confidence = \text{Beta.DIST}(1-R_{target}, a+f, b+n-f, \text{TRUE})$</li>
          ` : `
            <li>• 修正點位: $MTBF_{prior} = MTBF_{hist} \times DCC \times RAM$</li>
            <li>• 擬合參數: $a$ 來自 $\chi^2$ 比例擬合, $b = (MTBF_{50} \times \chi^2_{0.5, 2a}) / 2$</li>
            <li>• 貝氏求解: $Confidence = \text{Gamma.DIST}(1/MTBF_{target}, a+f+1, 1/(1/b + T), \text{TRUE})$</li>
          `}
        </ul>
      </div>
    `;
  }
}


function initDownloadBtn() {
  document.getElementById('download-excel')?.addEventListener('click', () => {
    const ws_data = [["貝氏規劃報告"], ["產出日期", new Date().toLocaleDateString()], ["傳統樣本", document.getElementById('res-classical').textContent], ["貝氏樣本", document.getElementById('res-bayesian').textContent]];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "RDT_Report.xlsx");
  });
}
