document.addEventListener('DOMContentLoaded', () => {
    // 預設樣本數
    const sampleSizes = [5, 10, 22, 30];

    // 取得 DOM 元素
    const inputs = {
        appTemp: document.getElementById('app-temp'),
        lifeExpectancy: document.getElementById('life-expectancy'),
        targetRel: document.getElementById('target-rel'),
        targetConf: document.getElementById('target-conf'),
        testTemp: document.getElementById('test-temp'),
        activationEnergy: document.getElementById('activation-energy'),
        weibullBeta: document.getElementById('weibull-beta')
    };

    const outputs = {
        calcAf: document.getElementById('calc-af'),
        resultsBody: document.getElementById('results-body')
    };

    // 常數
    const K_BOLTZMANN = 8.6173e-5; // eV/K

    // 計算與更新邏輯
    function calculateAndRender() {
        // 取得輸入值
        const T_use = parseFloat(inputs.appTemp.value) + 273.15; // 轉絕對溫度 K
        const T_test = parseFloat(inputs.testTemp.value) + 273.15;
        const years = parseFloat(inputs.lifeExpectancy.value);
        const R = parseFloat(inputs.targetRel.value) / 100;
        const C = parseFloat(inputs.targetConf.value) / 100;
        const Ea = parseFloat(inputs.activationEnergy.value);
        const beta = parseFloat(inputs.weibullBeta.value);

        // 驗證數值 (避免 NaN 或不合理的輸入)
        if (isNaN(T_use) || isNaN(T_test) || isNaN(years) || isNaN(R) || isNaN(C) || isNaN(Ea) || isNaN(beta) ||
            R <= 0 || R >= 1 || C <= 0 || C >= 1) {
            return; 
        }

        // 1. 計算加速係數 (AF) - Arrhenius 模型
        const af = Math.exp((Ea / K_BOLTZMANN) * ((1 / T_use) - (1 / T_test)));
        
        // 2. 計算等效應用壽命 (小時)
        const lifeHours = years * 365 * 24;

        // 更新統計看板
        if (outputs.calcAf) outputs.calcAf.textContent = af.toFixed(2);

        // 3. 計算各樣本數下的測試時間
        // 零失效抽樣計畫公式: Test Time = (Life / AF) * [ ln(1-C) / (n * ln(R)) ]^(1/beta)
        
        let tableHTML = '';
        
        sampleSizes.forEach(n => {
            const numerator = Math.log(1 - C);
            const denominator = n * Math.log(R);
            
            // 注意：這裡分子分母都是負數，相除為正數
            const factor = Math.pow(numerator / denominator, 1 / beta);
            const testTimeHours = (lifeHours / af) * factor;
            const testTimeDays = testTimeHours / 24;

            tableHTML += `
                <tr>
                    <td>${n}</td>
                    <td>${Math.round(testTimeHours).toLocaleString()}</td>
                    <td>${testTimeDays.toFixed(1)}</td>
                </tr>
            `;
        });

        outputs.resultsBody.innerHTML = tableHTML;
    }

    // 綁定事件監聽器：當任何 input 改變時，重新計算
    Object.values(inputs).forEach(input => {
        input.addEventListener('input', calculateAndRender);
    });

    // 初始計算
    calculateAndRender();
});
