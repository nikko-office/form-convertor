import { describe, it, expect } from 'vitest';
import {
  calculateTotals,
  calculateLineAmount,
  formatCurrency,
  taxRateToPercent,
} from '../src/core/calculator.js';

describe('calculateTotals', () => {
  it('基本的な合計計算ができる', () => {
    const items = [
      { quantity: 100, unitPrice: 50 },
      { quantity: 200, unitPrice: 30 },
    ];
    const result = calculateTotals(items);

    expect(result.subtotal).toBe(11000);       // 5000 + 6000
    expect(result.taxRate).toBe(0.10);
    expect(result.taxAmount).toBe(1100);        // 11000 * 0.10
    expect(result.total).toBe(12100);           // 11000 + 1100
  });

  it('カスタム税率で計算できる', () => {
    const items = [{ quantity: 10, unitPrice: 1000 }];
    const result = calculateTotals(items, 0.08);

    expect(result.subtotal).toBe(10000);
    expect(result.taxRate).toBe(0.08);
    expect(result.taxAmount).toBe(800);
    expect(result.total).toBe(10800);
  });

  it('小数点以下は切り捨てする', () => {
    const items = [{ quantity: 3, unitPrice: 333 }];
    const result = calculateTotals(items);

    // 3 * 333 = 999
    expect(result.subtotal).toBe(999);
    expect(result.taxAmount).toBe(99);          // 999 * 0.10 = 99.9 → 99
    expect(result.total).toBe(1098);
  });

  it('空の明細行で0を返す', () => {
    const result = calculateTotals([]);
    expect(result.subtotal).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe('calculateLineAmount', () => {
  it('行金額を計算する', () => {
    expect(calculateLineAmount(100, 50)).toBe(5000);
  });

  it('小数点以下を切り捨てする', () => {
    expect(calculateLineAmount(3, 33.3)).toBe(99); // 99.9 → 99
  });
});

describe('formatCurrency', () => {
  it('3桁カンマ区切りにフォーマットする', () => {
    expect(formatCurrency(1234567)).toBe('1,234,567');
    expect(formatCurrency(0)).toBe('0');
    expect(formatCurrency(999)).toBe('999');
    expect(formatCurrency(1000)).toBe('1,000');
  });
});

describe('taxRateToPercent', () => {
  it('税率をパーセント表記に変換する', () => {
    expect(taxRateToPercent(0.10)).toBe('10');
    expect(taxRateToPercent(0.08)).toBe('8');
  });
});
