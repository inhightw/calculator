import jStat from 'jstat';

/**
 * 貝氏可靠度測試規劃 - 核心計算模組
 */

// --- 基礎工具函數 ---

/**
 * 計算單項 Binomial 信心水準
 * 注意：jStat.binomial.cdf(f, n, p) 這裡的 p 必須是「失效機率」
 */
export function getBinomialConfidence(n, f, r) {
  if (n <= 0) return 0;
  const p_failure = 1 - r;
  // 信心 C = P(觀察到失效數 <= f | 實際失效率 = 1-r)
  // 但我們要求的是「當觀察到 f 個失效時，可靠度 >= r」的信心，即 1 - P(X <= f | p_failure)
  return 1 - jStat.binomial.cdf(f, n, p_failure);
}

export function getBinomialSampleSize(r, c, f) {
  let n = f;
  if (n === 0) n = 1; 
  while (true) {
    const conf = getBinomialConfidence(n, f, r);
    if (conf >= c) return n;
    n++;
    if (n > 10000) return 10000;
  }
}

// --- 貝氏方法實作 ---

/**
 * Method B1: Bayesian Prior Confidence (歷史實體數據)
 */
export function solveMethodB1(historyN, historyF, targetR, targetC, targetF, dcc, ram) {
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

/**
 * Method B2: Expert 3-point Estimate (專家 3 點估計)
 */
export function solveMethodB2(rL_pct, rM_pct, rH_pct, targetR, targetC, targetF, dcc, ram) {
  // 1. 修正因子作用於 R%，並遵循教材規則：超過 1.0 則封頂於 0.995
  const factor = dcc * ram;
  const L_prior = Math.min(0.995, (rL_pct / 100) * factor);
  const M_prior = Math.min(0.995, (rM_pct / 100) * factor);
  const H_prior = Math.min(0.995, (rH_pct / 100) * factor);

  // 2. 計算修正後的期望值與變異數 (回歸最高精度，不進行中間截斷)
  const ER = (L_prior + 4 * M_prior + H_prior) / 6;
  const VarR = Math.pow((H_prior - L_prior) / 6, 2);
  
  // 避免 VarR 過小導致計算崩潰
  const nClassical = getBinomialSampleSize(targetR, targetC, targetF);
  if (VarR < 0.00001) return { nFinal: nClassical, nClassical };

  // 3. 計算 Beta 參數 a (失敗項) 與 b (成功項)
  const common = (ER - Math.pow(ER, 2)) / VarR - 1;
  const a = (1 - ER) * common;
  const b = ER * common;

  // 4. 求解 n (對標教材 Excel 公式)
  const targetP = 1 - targetR;
  let n = targetF;
  while (true) {
    // 教材公式: Beta.DIST(p, a + x, b + n - x, TRUE)
    const conf = jStat.beta.cdf(targetP, a + targetF, b + n - targetF);
    if (conf >= targetC) break;
    n++;
    if (n > 10000) break;
  }
  
  return { 
    nFinal: Math.min(n, nClassical), 
    nClassical, 
    a, b, 
    mu: ER, 
    L_raw: rL_pct, M_raw: rM_pct, H_raw: rH_pct,
    L_prior, M_prior, H_prior,
    dccUsed: dcc, ramUsed: ram,
    targetR, targetC, targetF
  };
}

/**
 * Method B2: 直接輸入 Beta 參數 (Alpha/Beta)
 */
export function solveMethodB2WithParams(a, b, targetR, targetC, targetF, dcc, ram) {
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

/**
 * Method B3: Subsystems (子系統組合先驗)
 */
export function solveMethodB3(subsystems, targetR, targetC, targetF, dcc, ram) {
  const sysStats = subsystems.map(s => {
    const b = 1 + s.n - s.f; 
    const a = 1 + s.f;       
    const m = b / (a + b);   
    const v = (a * b) / (Math.pow(a + b, 2) * (a + b + 1));
    return { m, v };
  });

  const muSys = sysStats.reduce((acc, curr) => acc * curr.m, 1);
  const varSys = sysStats.reduce((acc, curr) => acc * (curr.v + Math.pow(curr.m, 2)), 1) - Math.pow(muSys, 2);

  const factor = dcc * ram;
  const muPrior = Math.min(0.999, muSys * factor);
  const varPrior = varSys;

  const common = (muPrior - Math.pow(muPrior, 2)) / varPrior - 1;
  const b = muPrior * common;
  const a = (1 - muPrior) * common;

  const nClassical = getBinomialSampleSize(targetR, targetC, targetF);
  const targetP = 1 - targetR;
  let n = targetF;
  while (true) {
    const conf = jStat.beta.cdf(targetP, a + targetF, b + n - targetF);
    if (conf >= targetC) break;
    n++;
    if (n > 10000) break;
  }
  
  return { nFinal: Math.min(n, nClassical), nClassical, a, b, muSys: muPrior };
}

/**
 * Method B3: Subsystem Combination (子系統組合先驗)
 * 邏輯：a_sys = sum(f_i) + 1, b_sys = min(n_i - f_i) + 1
 */
export function solveMethodB3(subsystems, targetR, targetC, targetF) {
  if (!subsystems || subsystems.length === 0) return { nFinal: 0, nClassical: 0 };

  // 1. 計算每個子系統的 E(Ri) 與 Var(Ri)
  const subs = subsystems.map(s => {
    const ni = parseInt(s.n) || 0;
    const fi = parseInt(s.f) || 0;
    const si = ni - fi; // 成功數
    
    const er = si / (ni + 1);
    const vr = (si * (ni + 1 - si)) / (Math.pow(ni + 1, 2) * (ni + 2));
    return { er, vr };
  });

  // 2. 依據 Guo et al. (2010) 合成系統層級的 E(R) 與 Var(R)
  const sysER = subs.reduce((prod, s) => prod * s.er, 1);
  
  const term1 = subs.reduce((prod, s) => prod * (Math.pow(s.er, 2) + s.vr), 1);
  const term2 = Math.pow(sysER, 2);
  const sysVarR = Math.max(0.000001, term1 - term2);

  // 3. 利用動差法反推系統 Beta 參數 a, b
  const common = (sysER - Math.pow(sysER, 2)) / sysVarR - 1;
  const a = (1 - sysER) * common; // 失效項
  const b = sysER * common;       // 成功項

  // 4. 求解貝氏樣本數
  const nClassical = getBinomialSampleSize(targetR, targetC, targetF);
  const targetP = 1 - targetR;
  let n = targetF;
  while (true) {
    const conf = jStat.beta.cdf(targetP, a + targetF, b + n - targetF);
    if (conf >= targetC) break;
    n++;
    if (n > 10000) break;
  }

  return { 
    nFinal: Math.min(n, nClassical), 
    nClassical, 
    a, b, 
    mu: sysER,
    targetR, targetC, targetF 
  };
}

/**
 * Method B4: MTBF Confidence Points
 */
export function solveMethodB4(mtbf50, mtbf05, targetMTBF, targetC, targetF, dcc, ram) {
  const m50 = mtbf50 * dcc * ram;
  const m05 = mtbf05 * dcc * ram;
  const L50 = 1 / m50;
  const L95 = 1 / m05;
  const ratio = L95 / L50;

  let a = 0.1;
  let minDiff = Infinity;
  for (let i = 0.1; i <= 100; i += 0.1) {
    const r = jStat.chisquare.inv(0.95, 2 * i) / jStat.chisquare.inv(0.50, 2 * i);
    const diff = Math.abs(r - ratio);
    if (diff < minDiff) {
      minDiff = diff;
      a = i;
    }
  }

  const b = L50 / jStat.chisquare.inv(0.50, 2 * a);
  const targetL = 1 / targetMTBF;
  let T = 0;
  while (true) {
    const prob = jStat.gamma.cdf(targetL, a + targetF + 1, 1 / (1/b + T));
    if (prob >= targetC) break;
    T += 1;
    if (T > 100000) break;
  }

  const tClassical = (jStat.chisquare.inv(targetC, 2 * (targetF + 1)) * targetMTBF) / 2;
  const tFinal = Math.min(T, tClassical);
  return { tFinal, tClassical, a, b };
}

/**
 * Method B5: BAZE (Gamma Prior)
 */
export function solveMethodB5(alpha, beta, targetMTBF, targetC) {
  const targetL = 1 / targetMTBF;
  let T = 0;
  while (true) {
    const prob = jStat.gamma.cdf(targetL, alpha, 1 / (beta + T));
    if (prob >= targetC) break;
    T += 1;
    if (T > 100000) break;
  }
  const tClassical = (jStat.chisquare.inv(targetC, 2) * targetMTBF) / 2;
  return { tFinal: Math.min(T, tClassical), tClassical };
}

/**
 * Logit 加權平均計算 RAM Factor
 */
export function calculateRAM(scores, weights) {
  let sumWeightedLogits = 0;
  for (let id in scores) {
    const p = scores[id];
    const eps = 0.0001;
    const safeP = Math.max(eps, Math.min(1 - eps, p));
    const logit = Math.log(safeP / (1 - safeP));
    sumWeightedLogits += logit * weights[id];
  }
  return Math.exp(sumWeightedLogits) / (1 + Math.exp(sumWeightedLogits));
}
