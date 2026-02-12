// TSVパーサー：ExcelからコピーしたTSVデータを構造化する

export interface TsvParseOptions {
  hasHeader: boolean;          // 1行目をヘッダーとして扱う
  columnMap?: ColumnMapping;   // カラム名マッピング（テンプレート別）
}

export interface ColumnMapping {
  [templateField: string]: number; // テンプレート項目名 → TSVカラムインデックス
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  rawText: string;             // 元のTSV文字列（復元用）
}

/**
 * TSV文字列をパースして構造化データに変換する
 * Excelからのコピペ（タブ区切り、\r\n改行）に対応
 */
export function parseTsv(input: string, options?: TsvParseOptions): ParsedTable {
  const hasHeader = options?.hasHeader ?? true;
  const rawText = input;

  // 改行で行分割（\r\n と \n の両方に対応）
  const lines = input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(line => line.length > 0); // 空行除去

  if (lines.length === 0) {
    return { headers: [], rows: [], rawText };
  }

  // 各行をタブで分割（クォートフィールド対応）
  const allRows = lines.map(line => parseRow(line));

  // 最大カラム数に合わせてパディング
  const maxCols = Math.max(...allRows.map(r => r.length));
  const paddedRows = allRows.map(row => {
    while (row.length < maxCols) {
      row.push('');
    }
    return row;
  });

  if (hasHeader && paddedRows.length > 0) {
    const headers = paddedRows[0];
    const rows = paddedRows.slice(1);
    return { headers, rows, rawText };
  }

  return { headers: [], rows: paddedRows, rawText };
}

/**
 * TSV文字列をJSONオブジェクト配列に変換する
 * ヘッダー行をキーとして使用
 */
export function tsvToJson(input: string, options?: TsvParseOptions): Record<string, string>[] {
  const parsed = parseTsv(input, { ...options, hasHeader: true });
  return parsed.rows.map(row => {
    const obj: Record<string, string> = {};
    parsed.headers.forEach((header, i) => {
      obj[header] = row[i] ?? '';
    });
    return obj;
  });
}

/**
 * 1行のTSVをタブで分割する
 * ダブルクォートで囲まれたフィールド内のタブ・改行をエスケープ処理
 */
function parseRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // 連続ダブルクォート → エスケープされた"
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // クォート終了
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"' && current.length === 0) {
        // クォート開始
        inQuotes = true;
        i++;
        continue;
      }
      if (char === '\t') {
        fields.push(current);
        current = '';
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  fields.push(current);
  return fields;
}
