import { createIcons, ShieldCheck, Target, Edit3, Database, BarChart3, ArrowRight, ArrowLeft, Info, Calculator, Download, Award, TrendingUp, Layers, Clock } from 'lucide';
import './style.css';
import { DCC_FACTORS, RAM_ACTIVITIES, RAM_ODDS_TABLE } from './constants';
import * as MathCore from './math';
import * as XLSX from 'xlsx';

// --- 狀態管理 ---
let currentStep = 1;
let selectedMethod = 'B1';
let appData = {
  target: { r: 90, c: 80, f: 0 },
  factors: { dcc: 1.0, ram: 0.5 },
  ramScores: {},
  results: null
};

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  initDCCSelect();
  initRAMActivities();
  initMethodSelector();
  initCalculateBtn();
  initDownloadBtn();
});

function initIcons() {
  createIcons({
    icons: { ShieldCheck, Target, Edit3, Database, BarChart3, ArrowRight, ArrowLeft, Info, Calculator, Download, Award, TrendingUp, Layers, Clock }
  });
}

function initDCCSelect() {
  const select = document.getElementById('dcc-select');
  const desc = document.getElementById('dcc-description');
  
  DCC_FACTORS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.value;
    opt.textContent = f.label;
    select.appendChild(opt);
  });

  select.addEventListener('change', (e) => {
    appData.factors.dcc = parseFloat(e.target.value);
  });
}

function initRAMActivities() {
  const container = document.getElementById('ram-activities-container');
  RAM_ACTIVITIES.forEach(activity => {
    const div = document.createElement('div');
    div.className = 'ram-activity';
    div.innerHTML = `
      <label>${activity.label}</label>
      <select class="ram-score-select" data-id="${activity.id}">
        ${RAM_ODDS_TABLE.map(o => `<option value="${o.logit}" ${o.logit === 0 ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
    `;
    container.appendChild(div);
    appData.ramScores[activity.id] = 0; // 預設 Even Odds (Logit 0)
  });

  document.querySelectorAll('.ram-score-select').forEach(select => {
    select.addEventListener('change', (e) => {
      appData.ramScores[e.target.dataset.id] = parseFloat(e.target.value);
      updateRAMDisplay();
    });
  });
}

function updateRAMDisplay() {
  const weights = {};
  RAM_ACTIVITIES.forEach(a => weights[a.id] = a.weight);
  appData.factors.ram = MathCore.calculateRAM(appData.ramScores, weights);
  document.getElementById('ram-value').textContent = appData.factors.ram.toFixed(3);
}

function initMethodSelector() {
  const options = document.querySelectorAll('.method-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedMethod = opt.dataset.method;
      
      // 切換輸入面板
      document.querySelectorAll('.method-inputs').forEach(i => i.classList.remove('active'));
      const activeInput = document.getElementById(`inputs-${selectedMethod}`);
      if (activeInput) activeInput.classList.add('active');
    });
  });
}

// --- 導航控制 ---
window.nextStep = (step) => {
  if (step === 2) {
    appData.target.r = parseFloat(document.getElementById('target-r').value) / 100;
    appData.target.c = parseFloat(document.getElementById('target-c').value) / 100;
    appData.target.f = parseInt(document.getElementById('target-f').value);
  }
  
  changeStep(step);
};

window.prevStep = (step) => {
  changeStep(step);
};

function changeStep(step) {
  document.querySelectorAll('.step-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
  
  document.querySelectorAll('.step').forEach(s => {
    const sNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (sNum === step) s.classList.add('active');
    if (sNum < step) s.classList.add('completed');
  });
  
  currentStep = step;
  window.scrollTo(0, 0);
}

// --- 計算邏輯 ---
function initCalculateBtn() {
  document.getElementById('calculate-btn').addEventListener('click', () => {
    let result = null;
    const { r, c, f } = appData.target;
    const { dcc, ram } = appData.factors;

    if (selectedMethod === 'B1') {
      const hN = parseInt(document.getElementById('b1-n').value);
      const hF = parseInt(document.getElementById('b1-f').value);
      result = MathCore.solveMethodB1(hN, hF, r, c, f, dcc, ram);
    } else if (selectedMethod === 'B2') {
      const low = parseFloat(document.getElementById('b2-low').value) / 100;
      const most = parseFloat(document.getElementById('b2-most').value) / 100;
      const high = parseFloat(document.getElementById('b2-high').value) / 100;
      result = MathCore.solveMethodB2(low, most, high, r, c, f, dcc, ram);
    }

    if (result) {
      appData.results = result;
      displayResults();
      nextStep(4);
    }
  });
}

function displayResults() {
  const res = appData.results;
  document.getElementById('res-classical').textContent = res.nClassical || '-';
  document.getElementById('res-bayesian').textContent = res.nFinal || res.tFinal?.toFixed(1) || '-';
  
  const saving = res.nClassical ? Math.round((1 - res.nFinal / res.nClassical) * 100) : 0;
  document.getElementById('res-saving').textContent = saving;
  
  let advice = `根據您的輸入，傳統方法需要 ${res.nClassical} 個樣本，而貝氏方法透過整合先驗資訊後，建議只需 ${res.nFinal} 個樣本。`;
  if (saving > 50) advice += " 這是一個顯著的樣本數優化，建議與客戶確認貝氏修正因子的合理性。";
  document.getElementById('res-advice').textContent = advice;
}

// --- Excel 匯出 ---
function initDownloadBtn() {
  document.getElementById('download-excel').addEventListener('click', () => {
    const data = [
      ["可靠性測試樣本數計算報告", ""],
      ["日期", new Date().toLocaleDateString()],
      ["", ""],
      ["[輸入參數]", ""],
      ["目標可靠度", appData.target.r * 100 + "%"],
      ["信心水準", appData.target.c * 100 + "%"],
      ["允許失效數", appData.target.f],
      ["設計變更因子 (DCC)", appData.factors.dcc],
      ["成熟度因子 (RAM)", appData.factors.ram.toFixed(3)],
      ["", ""],
      ["[計算結果]", ""],
      ["傳統方法樣本數", appData.results.nClassical],
      ["貝氏優化後樣本數", appData.results.nFinal],
      ["節省比例", Math.round((1 - appData.results.nFinal / appData.results.nClassical) * 100) + "%"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reliability Report");
    XLSX.writeFile(wb, "Reliability_Sample_Size_Report.xlsx");
  });
}
