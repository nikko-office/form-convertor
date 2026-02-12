// 金額計算モジュール：小計・消費税・合計の計算

export interface CalculationResult {
  subtotal: number;       // 小計
  taxRate: number;        // 税率 (e.g., 0.10)
  taxAmount: number;      // 消費税額
  total: number;          // 合計（税込）
}

export interface LineItem {
  quantity: number;
  unitPrice: number;
}

/**
 * 明細行から合計を計算する
 * 各行の金額 = 数量 × 単価（小数点以下切り捨て）
 * 消費税は小計に対して計算（小数点以下切り捨て）
 */
export function calculateTotals(
  items: LineItem[],
  taxRate: number = 0.10
): CalculationResult {
  const subtotal = items.reduce((sum, item) => {
    return sum + Math.floor(item.quantity * item.unitPrice);
  }, 0);

  const taxAmount = Math.floor(subtotal * taxRate);
  const total = subtotal + taxAmount;

  return { subtotal, taxRate, taxAmount, total };
}

/**
 * 行ごとの金額を計算する（数量 × 単価、小数点以下切り捨て）
 */
export function calculateLineAmount(quantity: number, unitPrice: number): number {
  return Math.floor(quantity * unitPrice);
}

/**
 * 数値を3桁カンマ区切りにフォーマットする
 * 例: 1234567 → "1,234,567"
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ja-JP');
}

/**
 * 税率をパーセント表記に変換する
 * 例: 0.10 → "10"
 */
export function taxRateToPercent(rate: number): string {
  return String(Math.round(rate * 100));
}
