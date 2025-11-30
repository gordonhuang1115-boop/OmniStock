import { Product, InventoryRecord, Transaction, Warehouse } from "../types";

interface AnalysisContext {
  products: Product[];
  inventory: InventoryRecord[];
  transactions: Transaction[];
  warehouses: Warehouse[];
}

export const analyzeInventory = async (context: AnalysisContext): Promise<string> => {
  try {
    const prompt = `
      你是庫存管理與物流分析專家。
      請分析目前的庫存、交易紀錄與倉庫分佈狀況。

      提供的數據：
      - 倉庫列表: ${JSON.stringify(context.warehouses)}
      - 產品列表: ${JSON.stringify(context.products)}
      - 庫存水位: ${JSON.stringify(context.inventory)}
      - 近期交易: ${JSON.stringify(context.transactions.slice(0, 5))}

      請提供一份簡潔但具洞察力的報告，需包含：
      1. **庫存健康度**: 指出哪些商品庫存過低(危險)或過高(滯銷)。
      2. **分佈優化建議**: 建議是否需要在不同倉庫間調撥貨物 (例如某個倉庫一直在負責特定產品的出貨)。
      3. **銷售趨勢**: 根據交易紀錄，簡述哪些商品流動較快。
      4. **行動建議**: 給倉庫管理員的 3 點具體建議。

      請使用繁體中文 (Traditional Chinese) 並以 Markdown 格式輸出。保持專業語氣。
    `;

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        systemInstruction: "你是一位專業的物流與庫存專家助手。"
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text || "目前無法產生分析報告。";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "連線 AI 服務失敗，請檢查後端服務是否啟動。";
  }
};