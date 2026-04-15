/**
 * PEL (Product Engineering Life-cycle) 
 * 核心計算與邏輯引擎 v1.0
 */

// 根據 Excel 數據建模的判定基準 (最高允許溫度 ℃)
// 邏輯: 基於 20年 壽命基準
const LIFETIME_DATA = {
    "105": {
        "2000": 38.77, "3000": 44.62, "4000": 48.77, "5000": 51.99,
        "6000": 54.62, "7000": 56.85, "8000": 58.77, "9000": 60.47,
        "10000": 61.99, "12000": 64.62, "15000": 67.84, "20000": 71.99
    },
    "125": {
        "1000": 38.77, "1500": 44.62, "2000": 48.77, "2500": 51.99,
        "3000": 54.62, "3500": 56.85, "4000": 58.77, "4500": 60.47, "5000": 61.99,
        "6000": 64.62, "8000": 67.84, "10000": 71.99
    },
    "135": {
        "1000": 48.77, "1500": 54.62, "2000": 58.77, "2500": 61.99, "3000": 64.62,
        "4000": 67.84, "5000": 71.99
    }
};

const UI = {
    compType: document.getElementById('compType'),
    ecapSpecs: document.getElementById('ecapSpecs'),
    tjSpecs: document.getElementById('tjSpecs'),
    mechanicalSpecs: document.getElementById('mechanicalSpecs'),
    ledWavelengthGroup: document.getElementById('ledWavelengthGroup'),
    ledWavelength: document.getElementById('ledWavelength'),
    ratedTemp: document.getElementById('ratedTemp'),
    ratedLife: document.getElementById('ratedLife'),
    actualTemp: document.getElementById('actualTemp'),
    // 全域參數
    globalAmbTemp: document.getElementById('globalAmbTemp'),
    dailyOnOff: document.getElementById('dailyOnOff'),
    dailyUsage: document.getElementById('dailyUsage'),
    globalTargetYears: document.getElementById('globalTargetYears'),
    // Tj 系列雙向輸入
    inputTc: document.getElementById('inputTc'),
    inputTj: document.getElementById('inputTj'),
    // 機械系列輸入
    ratedCycles: document.getElementById('ratedCycles'),

    limitLabel: document.getElementById('limitLabel'),
    marginLabel: document.getElementById('marginLabel'),

    statusIcon: document.getElementById('statusIcon'),
    statusText: document.getElementById('statusText'),
    statusDesc: document.getElementById('statusDesc'),
    limitVal: document.getElementById('limitVal'),
    marginVal: document.getElementById('marginVal'),
    guidanceSection: document.getElementById('guidanceSection'),
    recommendations: document.getElementById('recommendations')
};

// Tj 系列零件配置 (判定基準與 Tc 補償)
// 基準取自 Excel "Profile" Sheet，考慮 15y, 10y, 5y 之判定上限
const TJ_CONFIGS = {
    'transistor': {
        name: 'Power Transistor',
        offset: 60,
        limits: { "15": 100.50, "10": 108.61, "5": 122.48 }
    },
    'optocoupler': {
        name: 'Optocoupler',
        offset: 25,
        limits: { "15": 92.29, "10": 104.33, "5": 126.87 }
    },
    'led': {
        name: 'LED',
        offset: 35,
        wavelengthLimits: {
            "0.85": { "15": 79.67, "10": 87.03, "5": 100.34 },
            "1.3": { "15": 158.69, "10": 169.76, "5": 190.06 }
        }
    }
};

let lastChangedField = 'tc'; // 用於 Tj 雙向連動判定最後修改者

function calculate() {
    const type = UI.compType.value;
    const targetYears = UI.globalTargetYears.value; // 字串格式以配對 key

    let isOk = false;
    let finalLimit = 100; // 預設 100%
    let margin = 0;
    let currentJudgeVal = 0;
    let unit = '℃';

    // 更新標籤文字
    if (['relay', 'switch', 'connector'].includes(type)) {
        UI.limitLabel.innerText = '額定次數基準';
        UI.marginLabel.innerText = '次數餘量';
        unit = ' 次';
    } else {
        UI.limitLabel.innerText = '溫度判定基準';
        UI.marginLabel.innerText = '溫度餘量';
        unit = '℃';
    }

    // 介面初始隱藏所有專用區塊
    UI.ecapSpecs.style.display = 'none';
    UI.tjSpecs.style.display = 'none';
    UI.mechanicalSpecs.style.display = 'none';
    UI.ledWavelengthGroup.style.display = 'none';

    // 控制說明文字顯示
    const isTjType = ['transistor', 'optocoupler', 'led'].includes(type);
    document.getElementById('tjRef').style.display = isTjType ? 'block' : 'none';
    document.getElementById('formulaRef').style.display = (type === 'ecap' || isTjType) ? 'block' : 'none';

    if (type === 'ecap') {
        UI.ecapSpecs.style.display = 'block';
        const T_rated = parseFloat(UI.ratedTemp.value);
        const L_rated = parseFloat(UI.ratedLife.value);
        const currentTc = parseFloat(UI.actualTemp.value);

        const targetHours = parseFloat(targetYears) * 8760;
        finalLimit = T_rated - 10 * Math.log2(targetHours / L_rated);
        currentJudgeVal = currentTc;
        margin = finalLimit - currentJudgeVal;
    } else if (['transistor', 'optocoupler', 'led'].includes(type)) {
        UI.tjSpecs.style.display = 'block';
        const config = TJ_CONFIGS[type];

        if (type === 'led') {
            UI.ledWavelengthGroup.style.display = 'block';
            const wave = UI.ledWavelength.value;
            finalLimit = config.wavelengthLimits[wave][targetYears] || config.wavelengthLimits[wave]["15"];
        } else {
            finalLimit = config.limits[targetYears] || config.limits["15"];
        }

        let Tc = parseFloat(UI.inputTc.value);
        let Tj = parseFloat(UI.inputTj.value);

        if (!isNaN(Tc) || !isNaN(Tj)) {
            if (lastChangedField === 'tc' && !isNaN(Tc)) {
                Tj = Tc + config.offset;
                UI.inputTj.value = Tj.toFixed(2);
            } else if (lastChangedField === 'tj' && !isNaN(Tj)) {
                Tc = Tj - config.offset;
                UI.inputTc.value = Tc.toFixed(2);
            }
            currentJudgeVal = Tj;
            margin = finalLimit - currentJudgeVal;
        } else {
            updateUI(true, finalLimit.toFixed(2), "---", type, 0, unit, true);
            return;
        }
    } else if (['relay', 'switch', 'connector'].includes(type)) {
        UI.mechanicalSpecs.style.display = 'block';
        const ratedCyc = parseFloat(UI.ratedCycles.value);
        const years = parseFloat(targetYears);
        const dailyCount = (type === 'relay') ? parseFloat(UI.dailyOnOff.value) : parseFloat(UI.dailyUsage.value);

        const requiredTotal = dailyCount * 365 * years;
        // 反轉邏輯: 基準 = 客戶需求，當前 = 零件能力
        finalLimit = requiredTotal;
        currentJudgeVal = ratedCyc;
        margin = currentJudgeVal - finalLimit; // 能力 - 需求 = 餘裕

        if (isNaN(ratedCyc)) {
            updateUI(true, finalLimit.toLocaleString(), "---", type, 0, unit, true);
            UI.statusDesc.innerText = `請輸入零件額定壽命以進行評估（需求目標: ${finalLimit.toLocaleString()} 次）`;
            return;
        }
    }

    isOk = margin >= 0;
    updateUI(isOk, finalLimit.toLocaleString(), margin.toLocaleString(), type, currentJudgeVal, unit, false);
}

function updateUI(isOk, limit, margin, type, currentVal, unit, isEmpty) {
    const limitLabel = document.querySelector('label[for="limitVal"]') || { innerText: '判定基準' };
    const marginLabel = document.querySelector('label[for="marginVal"]') || { innerText: '餘量' };

    UI.limitVal.innerText = limit + unit;
    UI.marginVal.innerText = margin + (isEmpty ? "" : unit);
    UI.marginVal.style.color = isOk ? 'var(--success)' : 'var(--danger)';

    if (isEmpty) {
        UI.statusIcon.innerText = '?';
        UI.statusIcon.className = 'status-circle';
        UI.statusText.innerText = '等待輸入資料';
        UI.statusText.style.color = 'var(--text-muted)';
        UI.statusDesc.innerText = `請輸入規格參數以開始評估`;
        UI.guidanceSection.style.display = 'none';
        return;
    }

    if (isOk) {
        UI.statusIcon.innerText = 'OK';
        UI.statusIcon.className = 'status-circle status-check';
        UI.statusText.innerText = '符合需求';
        UI.statusText.style.color = 'var(--success)';

        let desc = "";
        if (type === 'ecap') desc = `表面溫度 Tc (${currentVal.toFixed(1)}${unit}) 低於要求基準`;
        else if (['transistor', 'optocoupler', 'led'].includes(type)) desc = `結溫 Tj (${currentVal.toFixed(1)}${unit}) 符合環境配置`;
        else desc = `預計總次數 (${currentVal.toLocaleString()}${unit}) 低於零件額定次數`;

        UI.statusDesc.innerText = desc;
        UI.guidanceSection.style.display = 'none';
    } else {
        UI.statusIcon.innerText = 'FAIL';
        UI.statusIcon.className = 'status-circle status-fail';
        UI.statusText.innerText = '不滿足需求';
        UI.statusText.style.color = 'var(--danger)';

        let desc = "";
        if (type === 'ecap') desc = `表面溫度 Tc (${currentVal.toFixed(1)}${unit}) 已超過目標年限限制！`;
        else if (['transistor', 'optocoupler', 'led'].includes(type)) desc = `結溫 Tj (${currentVal.toFixed(1)}${unit}) 已超過規範上限！`;
        else desc = `零件額定次數不足！(預計需求: ${currentVal.toLocaleString()}${unit})`;

        UI.statusDesc.innerText = desc;
        generateGuidance(type, margin);
        UI.guidanceSection.style.display = 'block';
    }
}

function generateGuidance(type, margin) {
    UI.recommendations.innerHTML = '';
    const recs = [];

    if (type === 'ecap') {
        recs.push(`環境溫度過高。建議藉由佈局優化或加強風流，將零件周溫降低約 <b>${Math.abs(margin).toFixed(1)} ℃</b>。`);
        recs.push(`考慮改用更高耐溫等級（如 125℃）或更高額定壽命（如 5000hr）的電容。`);
    } else if (['transistor', 'optocoupler', 'led'].includes(type)) {
        recs.push(`結溫 Tj 超標。建議增加散熱面積（Heat Sink）或改善封裝導熱。`);
        recs.push(`檢查零件驅動電流，適度降額（Derating）可能有助於大幅降低 Tj。`);
        recs.push(`若無法改善熱環境，應更換更高工業等級之零件。`);
    } else {
        recs.push(`預計操作次數已超過零件極限。請考慮更換為「長效型」規格。`);
        recs.push(`針對 Relay，可檢查負載端是否有湧浪電流，加入保護電路可延長接點壽命。`);
        recs.push(`針對 Connector，評估是否能減少插拔頻率，或改用高等級材料零件。`);
    }

    recs.forEach(text => {
        const li = document.createElement('li');
        li.innerHTML = text;
        UI.recommendations.appendChild(li);
    });
}

// 動態更新壽命選項
function updateLifeOptions() {
    const temp = UI.ratedTemp.value;
    const lives = Object.keys(LIFETIME_DATA[temp] || {}).sort((a, b) => parseInt(a) - parseInt(b));

    UI.ratedLife.innerHTML = '';
    lives.forEach(life => {
        const opt = document.createElement('option');
        opt.value = life;
        opt.innerText = `${life} hr`;
        UI.ratedLife.appendChild(opt);
    });
}

// 事件監聽
UI.compType.addEventListener('change', () => {
    if (UI.compType.value === 'ecap') {
        UI.actualTemp.value = UI.globalAmbTemp.value;
        updateLifeOptions(); // 切換回電容時更新選項
    } else {
        UI.inputTc.value = '';
        UI.inputTj.value = '';
    }
    calculate();
});

UI.ledWavelength.addEventListener('change', calculate);

UI.ratedTemp.addEventListener('change', () => {
    updateLifeOptions();
    calculate();
});

UI.inputTc.addEventListener('input', () => {
    lastChangedField = 'tc';
    calculate();
});

UI.inputTj.addEventListener('input', () => {
    lastChangedField = 'tj';
    calculate();
});

UI.globalAmbTemp.addEventListener('input', () => {
    if (UI.compType.value === 'ecap') {
        UI.actualTemp.value = UI.globalAmbTemp.value;
    }
    calculate();
});

[UI.dailyOnOff, UI.dailyUsage, UI.globalTargetYears, UI.ratedCycles, UI.ratedLife, UI.actualTemp].forEach(el => {
    if (el) {
        el.addEventListener('change', calculate);
        el.addEventListener('input', calculate);
    }
});

// 初始化
updateLifeOptions();
calculate();
