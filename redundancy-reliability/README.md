# Redundancy Reliability Analyzer

這是一個基於 HTML、CSS (Vanilla, Glassmorphism) 與 Vanilla JavaScript 開發的系統備援可靠度計算工具。
理論與計算公式參考自 Dimitri Kececioglu《Reliability Engineering Handbook Vol 2》。

## 系統特色

1. **五種備援架構支援**：
   - 並聯備用 (Parallel Redundancy)
   - 冷備用 (Cold Standby) - Perfect Switch
   - 冷備用 (Cold Standby) - Imperfect Switch
   - 溫/熱備用 (Warm/Hot Standby) - Perfect Switch
   - 溫/熱備用 (Warm/Hot Standby) - Imperfect Switch

2. **多種失效分佈支援**：
   - **指數分佈 (Exponential)**：計算失效率 ($\lambda$)。
   - **韋伯分佈 (Weibull)**：透過高階數值積分 (Trapezoidal Rule) 計算形狀參數 ($\beta$) 與尺度參數 ($\eta$) 下的卷積 (Convolution)。

3. **現代化介面體驗**：
   - 無需後端伺服器，純瀏覽器端超高速運算。
   - 採用毛玻璃特效 (Glassmorphism) 與流暢動畫。
   - 內建 Chart.js，動態即時繪製可靠度隨時間變化的曲線。

## 執行方式

這是一個純前端的網頁應用程式，只需使用任何現代瀏覽器開啟 `index.html` 即可立即使用，無須安裝任何依賴或啟動伺服器。
