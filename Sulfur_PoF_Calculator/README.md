# 失效物理硫化腐蝕計算工具 (PoF Sulfur Corrosion Calculator)

這是一個基於失效物理 (Physics of Failure, PoF) 原理所建立的單機版硫化腐蝕可靠度計算網頁工具。
將整體失效機制精準切分為**潛伏期 (Incubation Phase)** 與**腐蝕反應期 (Corrosion Phase)**，並各自應用 Arrhenius (阿瑞尼士) 模型進行溫度加速壽命推估。

## 雙區塊功能
### 1. 建立活化能推演模型 (Ea Modeling)
- 依據兩組不同溫度的實測腐蝕速率推算「腐蝕期活化能 $E_{a1}$」。
- 依據客戶總壽命要求減去第一階段計算出的所需腐蝕時間，反推並精算對應防護層阻擋氣體進入所需的「潛伏期活化能 $E_{a2}$」。

### 2. 客戶環境總壽命預測 (Life Prediction)
- 基於上述推演完成的一組 $E_{a1}, E_{a2}$ 參數。
- 只需輸入任何客戶環境之內部 Bead 溫度 (°C)。
- 系統將立刻推算出在目標環境下的：
  - 封裝層可撐住的潛伏期天數
  - 內部被徹底硫化腐蝕反應殆盡之天數
  - 合併後的「總可靠度壽命 (Total Predicted Life)」，支援天數、月數與年數。

## 開發技術
以純前端 (Vanilla HTML, JS, CSS) 應用程式撰寫，輕量級且具高資安保密性（無需連上外部伺服器），支援暗色模式 (Dark Mode) 以及現代化多視窗彈性介面設計。

## 分析流程圖

```mermaid
flowchart TD
    classDef titleStyle fill:#1f6feb,stroke:#fff,stroke-width:2px,color:#fff,font-weight:bold,font-size:16px;
    classDef processStyle fill:#238636,stroke:#fff,stroke-width:1px,color:#fff,font-weight:bold;
    classDef inputStyle fill:#0d1117,stroke:#58a6ff,stroke-width:1px,color:#c9d1d9,stroke-dasharray: 5 5;
    classDef outputStyle fill:#bd561d,stroke:#fff,stroke-width:2px,color:#fff,font-weight:bold,font-size:15px;

    Main(["🔍 失效物理硫化腐蝕分析 (PoF)"]):::titleStyle

    Main --> Phase1
    Main --> Phase2

    subgraph Phase1 [第一區：建立活化能推演模型 Ea Modeling]
        direction TB
        
        subgraph Sub_Corr [A. 腐蝕期活化能推算]
            direction TB
            C_Input[輸入: 溫濕度 T1, T2 實測與腐蝕速率]:::inputStyle --> C_Calc(利用 Arrhenius 公式\n比較兩組斜率差異) 
            C_Calc --> C_Result[得出 腐蝕期活化能 Ea1]:::processStyle
        end
        
        subgraph Sub_Inc [B. 潛伏期活化能推算]
            direction TB
            I_Req[輸入: 目標客戶總壽命要求\n扣除前項之純腐蝕時間]:::inputStyle --> I_Def(定義出：\n封裝必須撐住的潛伏期底線)
            I_Test[輸入: 測試環境下的實際潛伏時間]:::inputStyle --> I_Def
            I_Def --> I_Result[得出 潛伏期活化能 Ea2]:::processStyle
        end
    end

    subgraph Phase2 [第二區：客戶環境總壽命預測 Life Prediction]
        direction TB
        P_Input[輸入: 任何新客戶環境\n內部 Bead 溫度]:::inputStyle
        
        P_Input --> P_Inc(推算目標環境下\n封裝層潛伏期天數)
        P_Input --> P_Corr(推算目標環境下\n銀層腐蝕殆盡天數)
        
        P_Inc --> P_Final
        P_Corr --> P_Final
        
        P_Final{{"總預期壽命\n (Total Life)"}}:::outputStyle
    end

    C_Result -. "套用物理參數 Ea1" .-> P_Corr
    I_Result -. "套用物理參數 Ea2" .-> P_Inc

    style Phase1 fill:#f0f6fc10,stroke:#30363d,stroke-width:1px
    style Phase2 fill:#f0f6fc10,stroke:#30363d,stroke-width:1px
```
