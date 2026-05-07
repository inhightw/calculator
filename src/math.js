import jStat from 'jstat';

/**
 * 數學核心模組 - 貝氏可靠性計算
 */

// --- 基礎統計函數 ---

/**
 * 計算二項式測試的信心水準 (Confidence Level)
 * 對應 Excel: 1 - BINOM.DIST(f, n, r, TRUE)
 */
export function getBinomialConfidence(n, f, r) {
  let sum = 0;
  for (let i = 0; i <= f; i++) {
    sum += jStat.binomial.pdf(i, n, 1 - r); // 1-r 是失敗率
  }
  return 1 - sum;
}

/**
 * 求解二項式測試所需樣本數 (n)
 * 尋找最小的 n 使得 1 - BINOM.DIST(f, n, r, TRUE) >= c
 */
export function getBinomialSampleSize(r, c, f) {
  let n = f;
  while (getBinomialConfidence(n, f, r) < c) {
    n++;
    if (n > 10000) break; // 防止無限迴圈
  }
  return n;
}

// --- 修正因子計算 ---

/**
 * 計算 RAM 因子
 * scores: { activityId: logitValue }
 * weights: { activityId: weightValue }
 */
export function calculateRAM(scores, weights) {
  let twl = 0;
  for (const id in scores) {
    twl += scores[id] * (weights[id] || 0.2);
  }
  return Math.exp(twl) / (1 + Math.exp(twl));
}

// --- 貝氏方法實作 ---

/**
 * Method B1: Bayesian Prior Confidence
 */
export function solveMethodB1(historyN, historyF, targetR, targetC, targetF, dcc, ram) {
  // 1. 計算歷史數據提供的信心
  const cHistory = getBinomialConfidence(historyN, historyF, targetR);
  
  // 2. 修正後的先驗信心
  const cPrior = cHistory * dcc * ram;
  
  // 3. 換算等效樣本數 n_eq
  // 尋找 n_eq 使得 getBinomialConfidence(n_eq, targetF, targetR) 最接近 cPrior
  let nEq = 0;
  let bestDiff = Infinity;
  for (let n = 0; n <= 1000; n++) {
    const conf = getBinomialConfidence(n, targetF, targetR);
    const diff = Math.abs(conf - cPrior);
    if (diff < bestDiff) {
      bestDiff = diff;
      nEq = n;
    } else {
      break; // 信心隨 n 增加，若 diff 開始變大則停止
    }
  }

  // 4. 計算傳統所需樣本數
  const nClassical = getBinomialSampleSize(targetR, targetC, targetF);
  
  // 5. 最終所需樣本數
  const nFinal = Math.max(0, nClassical - nEq);
  
  return { nClassical, nEq, nFinal, cPrior, cHistory };
}

/**
 * Method B2: Bayesian Beta Prior 3-Point
 */
export function solveMethodB2(lowR, mostR, highR, targetR, targetC, targetF, dcc, ram) {
  // 1. 修正 3 點估計 (針對失敗率進行縮放)
  const adjust = (r) => {
    const q = 1 - r;
    const qAdj = q / (dcc * ram);
    return Math.max(0.0001, Math.min(0.9999, 1 - qAdj));
  };

  const rL = adjust(lowR);
  const rM = adjust(mostR);
  const rH = Math.min(0.995, adjust(highR)); // 根據教材 242 頁上限 0.995

  // 2. PERT 估計平均值與變異數
  const mu = (rL + 4 * rM + rH) / 6;
  const sigma = (rH - rL) / 6;
  const variance = Math.pow(sigma, 2);

  // 3. 計算 Beta 分佈參數 alpha, beta
  const common = (mu * (1 - mu)) / variance - 1;
  const alpha = mu * common;
  const beta = (1 - mu) * common;

  // 4. 求解所需的 n
  // 公式: 1 - BETA.DIST(targetR, alpha + n - targetF, beta + targetF, TRUE) = targetC
  let n = targetF;
  while (true) {
    // jStat.beta.cdf(x, alpha, beta)
    const prob = 1 - jStat.beta.cdf(targetR, alpha + n - targetF, beta + targetF);
    if (prob >= targetC) break;
    n++;
    if (n > 10000) break;
  }

  const nClassical = getBinomialSampleSize(targetR, targetC, targetF);
  return { nClassical, nFinal: n, alpha, beta, mu, rL, rM, rH };
}

/**
 * Method B3: Sub-Systems (Series)
 * subsystems: Array of { n, f }
 */
export function solveMethodB3(subsystems, targetR, targetC, targetF) {
  // 1. 計算各子系統的 mu 與 var (Beta Prior)
  // 假設使用無母數先驗 (alpha=1, beta=1) 或基於測試數據
  const sysStats = subsystems.map(s => {
    const a = 1 + s.n - s.f;
    const b = 1 + s.f;
    const mu = a / (a + b);
    const v = (a * b) / (Math.pow(a + b, 2) * (a + b + 1));
    return { mu, v };
  });

  // 2. 系統整體 mu 與 var
  const muSys = sysStats.reduce((acc, s) => acc * s.mu, 1);
  const varSys = sysStats.reduce((acc, s) => acc * (s.v + Math.pow(s.mu, 2)), 1) - Math.pow(muSys, 2);

  // 3. 換算系統 alpha, beta
  const common = (muSys * (1 - muSys)) / varSys - 1;
  const alpha = muSys * common;
  const beta = (1 - muSys) * common;

  // 4. 求解 n
  let n = targetF;
  while (true) {
    const prob = 1 - jStat.beta.cdf(targetR, alpha + n - targetF, beta + targetF);
    if (prob >= targetC) break;
    n++;
    if (n > 10000) break;
  }

  return { nFinal: n, alpha, beta, muSys };
}

/**
 * Method B4: Gamma Prior 50/95
 * mtbf50, mtbf05: MTBF 分位數
 * targetMTBF, targetC, targetF
 */
export function solveMethodB4(mtbf50, mtbf05, targetMTBF, targetC, targetF, dcc, ram) {
  // 1. 修正 MTBF (乘上因子)
  const m50 = mtbf50 * dcc * ram;
  const m05 = mtbf05 * dcc * ram;
  
  // 2. 換算為 Failure Rate 分位數 (lambda = 1/MTBF)
  // lambda05 (來自 m50) = 1/m50, lambda95 (來自 m05) = 1/m05
  const L50 = 1 / m50;
  const L95 = 1 / m05;
  const ratio = L95 / L50;

  // 3. 透過比例求解 Gamma shape 參數 'a'
  // 比例 = jStat.gamma.inv(0.95, a, 1) / jStat.gamma.inv(0.50, a, 1)
  let a = 0.1;
  let minDiff = Infinity;
  for (let i = 0.1; i <= 100; i += 0.1) {
    const r = jStat.gamma.inv(0.95, i, 1) / jStat.gamma.inv(0.50, i, 1);
    const diff = Math.abs(r - ratio);
    if (diff < minDiff) {
      minDiff = diff;
      a = i;
    }
  }

  // 4. 求解 scale 參數 'b'
  // L50 = jStat.gamma.inv(0.50, a, b)
  const b = L50 / jStat.gamma.inv(0.50, a, 1);

  // 5. 求解總測試時間 T
  // Posterior Gamma(a + f, b / (1 + b * T))
  // P(lambda <= 1/targetMTBF) >= targetC
  const targetL = 1 / targetMTBF;
  let T = 0;
  while (true) {
    const bPost = b / (1 + b * T);
    const prob = jStat.gamma.cdf(targetL, a + targetF, bPost);
    if (prob >= targetC) break;
    T += 1;
    if (T > 100000) break;
  }

  // 傳統方法所需時間 (Chi-square)
  const tClassical = (jStat.chisquare.inv(targetC, 2 * (targetF + 1)) * targetMTBF) / 2;

  return { tFinal: T, tClassical, a, b };
}

/**
 * Method B5: BAZE (Bayesian Zero-Failure)
 */
export function solveMethodB5(alpha, beta, targetMTBF, targetC) {
  // BAZE 專注於零失效
  const targetL = 1 / targetMTBF;
  let T = 0;
  while (true) {
    // 根據教材 268 頁，BAZE 公式涉及到 alpha, beta (Gamma 先驗)
    // P(lambda <= targetL | f=0) = targetC
    const bPost = beta / (1 + beta * T);
    const prob = jStat.gamma.cdf(targetL, alpha, bPost);
    if (prob >= targetC) break;
    T += 1;
    if (T > 100000) break;
  }
  return { tFinal: T };
}
