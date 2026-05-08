/**
 * 貝氏可靠度計算機 - 常數定義 (對標教材 RAM 矩陣)
 */

// 完整的 DCC 因子矩陣
export const DCC_MATRIX = [
  { id: 'major-imp', label: 'Major Improvement', mtbf50: 5.00, mtbf05: 1.00, beta: 1.50 },
  { id: 'medium-imp', label: 'Medium Improvement', mtbf50: 2.00, mtbf05: 0.98, beta: 1.20 },
  { id: 'minor-imp', label: 'Minor Improvement', mtbf50: 1.43, mtbf05: 0.95, beta: 1.05 },
  { id: 'carry-over', label: 'Carry-Over', mtbf50: 1.00, mtbf05: 0.83, beta: 1.00 },
  { id: 'minor-com', label: 'Minor Compromise', mtbf50: 0.77, mtbf05: 0.51, beta: 0.95 },
  { id: 'medium-com', label: 'Medium Compromise', mtbf50: 0.67, mtbf05: 0.33, beta: 0.83 },
  { id: 'major-com', label: 'Major Compromise', mtbf50: 0.56, mtbf05: 0.11, beta: 0.67 }
];

// 信心程度評估 (RAM) 項目與教材對標權重
export const RAM_ACTIVITIES = [
  { id: 'mission-profile', label: 'Mission Profile (任務剖面)', weight: 0.15 },
  { id: 'life-tests', label: 'Reliability/Life Tests (可靠度壽命測試)', weight: 0.30 },
  { id: 'dfmea-hist', label: 'DFMEA - Historical (歷史失效分析)', weight: 0.10 },
  { id: 'dfmea-change', label: 'DFMEA - Design Change (設計變更分析)', weight: 0.10 },
  { id: 'dev-tests', label: 'Engineering Development Tests (開發驗證測試)', weight: 0.35 }
];
