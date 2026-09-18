import { predictCategory } from '../rulesEngine';
import type { MonetaTransaction } from '../../types/moneta';

export interface ParsedStatementRow {
  id: string;
  date: string; // YYYY-MM-DD
  payee: string;
  amount: number; // Negative for expense, positive for deposit
  memo: string;
  category: string;
  isDuplicate?: boolean;
  selected: boolean;
}

/**
 * Standardizes common date strings into YYYY-MM-DD
 */
export function normalizeDate(dateStr: string): string {
  const clean = dateStr.trim();
  if (!clean) return new Date().toISOString().split('T')[0];

  // Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Check DD Mon YYYY (e.g., "15 Jan 2026" or "15-Jan-2026")
  const monMatch = clean.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{4})$/);
  if (monMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const day = monMatch[1].padStart(2, '0');
    const mon = months[monMatch[2].toLowerCase()] || '01';
    const year = monMatch[3];
    return `${year}-${mon}-${day}`;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback Date parse
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Parses numeric currency strings like "1,234.50", "(50.00)", "$20.00"
 */
export function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  let clean = amountStr.trim().replace(/[$€£SGD\s]/gi, '');

  let isNegative = false;
  if (clean.startsWith('(') && clean.endsWith(')')) {
    isNegative = true;
    clean = clean.slice(1, -1);
  } else if (clean.startsWith('-')) {
    isNegative = true;
    clean = clean.slice(1);
  }

  // Strip thousands commas
  clean = clean.replace(/,/g, '');
  const val = parseFloat(clean);
  if (isNaN(val)) return 0;

  return isNegative ? -Math.abs(val) : Math.abs(val);
}

/**
 * Splits CSV text line while preserving quoted commas
 */
function splitCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Detect delimiter: comma, semicolon, or tab
 */
function detectDelimiter(sampleLines: string[]): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const line of sampleLines) {
    counts[','] += (line.match(/,/g) || []).length;
    counts[';'] += (line.match(/;/g) || []).length;
    counts['\t'] += (line.match(/\t/g) || []).length;
  }
  if (counts[';'] > counts[','] && counts[';'] > counts['\t']) return ';';
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  return ',';
}

/**
 * Parses Bank CSV statement
 */
export function parseCsvStatement(
  content: string,
  existingTransactions: MonetaTransaction[] = []
): ParsedStatementRow[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmptyLines = lines.map(l => l.trim()).filter(l => l.length > 0);
  if (nonEmptyLines.length === 0) return [];

  const delimiter = detectDelimiter(nonEmptyLines.slice(0, 10));

  // Find header line
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(nonEmptyLines.length, 25); i++) {
    const cols = splitCsvLine(nonEmptyLines[i], delimiter).map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
    // Look for Date AND (Amount OR Debit OR Credit OR Description OR Particulars)
    const hasDate = cols.some(c => c.includes('date'));
    const hasAmount = cols.some(c => c.includes('amount') || c.includes('debit') || c.includes('credit') || c.includes('withdrawal'));
    const hasPayee = cols.some(c => c.includes('desc') || c.includes('payee') || c.includes('particular') || c.includes('narrative') || c.includes('detail'));

    if (hasDate && (hasAmount || hasPayee)) {
      headerIndex = i;
      headers = splitCsvLine(nonEmptyLines[i], delimiter);
      break;
    }
  }

  if (headerIndex === -1) {
    // If no header found, assume row 0 is header or columns: date, payee, amount
    headerIndex = 0;
    headers = splitCsvLine(nonEmptyLines[0], delimiter);
  }

  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());

  // Index finders
  const dateIdx = normalizedHeaders.findIndex(h => h.includes('date'));
  const payeeIdx = normalizedHeaders.findIndex(h =>
    h.includes('payee') || h.includes('desc') || h.includes('narrative') || h.includes('particular') || h.includes('detail')
  );
  const debitIdx = normalizedHeaders.findIndex(h => h.includes('debit') || h.includes('withdrawal') || h.includes('outflow'));
  const creditIdx = normalizedHeaders.findIndex(h => h.includes('credit') || h.includes('deposit') || h.includes('inflow'));
  const amountIdx = normalizedHeaders.findIndex(h => h.includes('amount') && !h.includes('debit') && !h.includes('credit'));
  const memoIdx = normalizedHeaders.findIndex(h => h.includes('memo') || h.includes('ref') || h.includes('notes'));

  const parsedRows: ParsedStatementRow[] = [];

  for (let i = headerIndex + 1; i < nonEmptyLines.length; i++) {
    const rawCols = splitCsvLine(nonEmptyLines[i], delimiter);
    if (rawCols.length < 2) continue;

    const dateStr = dateIdx >= 0 ? rawCols[dateIdx] : rawCols[0];
    const cleanDate = normalizeDate(dateStr);

    let payeeStr = payeeIdx >= 0 ? rawCols[payeeIdx] : (rawCols[1] || 'Transaction');
    payeeStr = payeeStr.replace(/^["']|["']$/g, '').trim();

    const memoStr = memoIdx >= 0 ? rawCols[memoIdx] : '';

    let amount = 0;
    if (debitIdx >= 0 && creditIdx >= 0) {
      const debit = parseAmount(rawCols[debitIdx] || '');
      const credit = parseAmount(rawCols[creditIdx] || '');
      if (debit > 0) {
        amount = -debit;
      } else if (credit > 0) {
        amount = credit;
      }
    } else if (amountIdx >= 0) {
      amount = parseAmount(rawCols[amountIdx] || '');
    } else if (rawCols.length >= 3) {
      amount = parseAmount(rawCols[2]);
    }

    if (!payeeStr && amount === 0) continue;

    const predictedCat = predictCategory(payeeStr, memoStr);

    // Duplicate detection: check if existing transactions have exact same date and amount
    const isDuplicate = existingTransactions.some(
      tx => tx.date === cleanDate && Math.abs(tx.amount - amount) < 0.001
    );

    parsedRows.push({
      id: `imp-${Date.now()}-${i}`,
      date: cleanDate,
      payee: payeeStr || 'Merchant',
      amount,
      memo: memoStr,
      category: predictedCat,
      isDuplicate,
      selected: !isDuplicate, // Uncheck duplicates by default
    });
  }

  return parsedRows;
}

/**
 * Parses QIF (Quicken Interchange Format) statements
 */
export function parseQifStatement(
  content: string,
  existingTransactions: MonetaTransaction[] = []
): ParsedStatementRow[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows: ParsedStatementRow[] = [];

  let currentDate = '';
  let currentAmount = 0;
  let currentPayee = '';
  let currentMemo = '';
  let currentCategory = '';
  let count = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === '^') {
      // Record delimiter reached
      if (currentDate && (currentPayee || currentAmount !== 0)) {
        const cleanDate = normalizeDate(currentDate);
        const predicted = currentCategory || predictCategory(currentPayee, currentMemo);
        const isDuplicate = existingTransactions.some(
          tx => tx.date === cleanDate && Math.abs(tx.amount - currentAmount) < 0.001
        );

        rows.push({
          id: `qif-${Date.now()}-${count++}`,
          date: cleanDate,
          payee: currentPayee || 'Merchant',
          amount: currentAmount,
          memo: currentMemo,
          category: predicted,
          isDuplicate,
          selected: !isDuplicate,
        });
      }

      // Reset for next record
      currentDate = '';
      currentAmount = 0;
      currentPayee = '';
      currentMemo = '';
      currentCategory = '';
      continue;
    }

    const type = line[0];
    const value = line.slice(1).trim();

    switch (type) {
      case 'D':
        currentDate = value;
        break;
      case 'T':
      case 'U':
        currentAmount = parseAmount(value);
        break;
      case 'P':
        currentPayee = value;
        break;
      case 'M':
        currentMemo = value;
        break;
      case 'L':
        currentCategory = value;
        break;
    }
  }

  return rows;
}
