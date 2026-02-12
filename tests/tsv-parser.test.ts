import { describe, it, expect } from 'vitest';
import { parseTsv, tsvToJson } from '../src/core/tsv-parser.js';

describe('parseTsv', () => {
  it('基本的なTSVをパースできる', () => {
    const input = '品名\t数量\t単位\t単価\nボルト\t100\t本\t50\nナット\t200\t個\t30';
    const result = parseTsv(input);

    expect(result.headers).toEqual(['品名', '数量', '単位', '単価']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(['ボルト', '100', '本', '50']);
    expect(result.rows[1]).toEqual(['ナット', '200', '個', '30']);
  });

  it('\\r\\n改行（Windows/Excel）に対応する', () => {
    const input = '品名\t数量\r\nボルト\t100\r\nナット\t200';
    const result = parseTsv(input);

    expect(result.headers).toEqual(['品名', '数量']);
    expect(result.rows).toHaveLength(2);
  });

  it('空セルを保持する', () => {
    const input = '品名\t数量\t備考\nボルト\t100\t\nナット\t\t注意';
    const result = parseTsv(input);

    expect(result.rows[0]).toEqual(['ボルト', '100', '']);
    expect(result.rows[1]).toEqual(['ナット', '', '注意']);
  });

  it('ダブルクォートで囲まれたフィールドを処理する', () => {
    const input = '品名\t説明\n"M10ボルト"\t"タブ\tを含む"';
    const result = parseTsv(input);

    expect(result.rows[0][0]).toBe('M10ボルト');
    expect(result.rows[0][1]).toBe('タブ\tを含む');
  });

  it('エスケープされたダブルクォートを処理する', () => {
    const input = '品名\t説明\nボルト\t"サイズ""大""用"';
    const result = parseTsv(input);

    expect(result.rows[0][1]).toBe('サイズ"大"用');
  });

  it('ヘッダーなしモードで動作する', () => {
    const input = 'ボルト\t100\nナット\t200';
    const result = parseTsv(input, { hasHeader: false });

    expect(result.headers).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(['ボルト', '100']);
  });

  it('空入力に対して空結果を返す', () => {
    const result = parseTsv('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('カラム数が不揃いな行をパディングする', () => {
    const input = '品名\t数量\t単価\nボルト\t100';
    const result = parseTsv(input);

    expect(result.headers).toEqual(['品名', '数量', '単価']);
    expect(result.rows[0]).toEqual(['ボルト', '100', '']);
  });
});

describe('tsvToJson', () => {
  it('TSVをJSONオブジェクト配列に変換する', () => {
    const input = '品名\t数量\t単価\nボルト\t100\t50\nナット\t200\t30';
    const result = tsvToJson(input);

    expect(result).toEqual([
      { '品名': 'ボルト', '数量': '100', '単価': '50' },
      { '品名': 'ナット', '数量': '200', '単価': '30' },
    ]);
  });
});
