/**
 * 貝氏樣本數計算工具 - 常數定義
 */

// DCC (Design Change Condition) 因子
// 根據教材第 207 頁
export const DCC_FACTORS = [
  { id: 'major_improvement', label: '大幅改進 (Major Improvement)', value: 1.5 },
  { id: 'medium_improvement', label: '中度改進 (Medium Improvement)', value: 1.2 },
  { id: 'minor_improvement', label: '輕微改進 (Minor Improvement)', value: 1.05 },
  { id: 'carry_over', label: '沿用設計 (Carry-Over)', value: 1.0 },
  { id: 'minor_compromise', label: '輕微折衷 (Minor Compromise)', value: 0.95 },
  { id: 'medium_compromise', label: '中度折衷 (Medium Compromise)', value: 0.8 },
  { id: 'major_compromise', label: '大幅折衷 (Major Compromise)', value: 0.7 },
];

// RAM (Reliability Activities Maturity) Odds 與 Logit 對照表
// 根據教材第 209 頁
export const RAM_ODDS_TABLE = [
  { label: '幾乎不可能 (0.01)', odds: '1/99', logit: -4.6, value: 0.01 },
  { label: '極不可能 (0.05)', odds: '1/19', logit: -2.94, value: 0.05 },
  { label: '非常不可能 (0.1)', odds: '1/9', logit: -2.2, value: 0.1 },
  { label: '不可能 (0.2)', odds: '1/4', logit: -1.39, value: 0.2 },
  { label: '有點不可能 (0.3)', odds: '3/7', logit: -0.85, value: 0.3 },
  { label: '可能不 (0.4)', odds: '2/3', logit: -0.41, value: 0.4 },
  { label: '一半一半 (0.5)', odds: '1/1', logit: 0, value: 0.5 },
  { label: '可能 (0.6)', odds: '3/2', logit: 0.41, value: 0.6 },
  { label: '有點可能 (0.7)', odds: '7/3', logit: 0.85, value: 0.7 },
  { label: '很有可能 (0.8)', odds: '4/1', logit: 1.39, value: 0.8 },
  { label: '非常可能 (0.9)', odds: '9/1', logit: 2.2, value: 0.9 },
  { label: '極其可能 (0.95)', odds: '19/1', logit: 2.94, value: 0.95 },
  { label: '幾乎確定 (0.99)', odds: '99/1', logit: 4.6, value: 0.99 },
];

// RAM 五項關鍵活動
// 根據教材第 208 頁
export const RAM_ACTIVITIES = [
  { id: 'mission_profile', label: '任務剖面 (Mission Profile)', weight: 0.2 },
  { id: 'life_tests', label: '壽命測試 (Reliability/Life Tests)', weight: 0.2 },
  { id: 'dfmea_historical', label: 'DFMEA (類似歷史問題)', weight: 0.2 },
  { id: 'dfmea_new', label: 'DFMEA (新故障模式)', weight: 0.2 },
  { id: 'dev_tests', label: '工程開發測試 (Development Tests)', weight: 0.2 },
];
