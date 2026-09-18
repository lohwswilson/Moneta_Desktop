import type { CategorizationRule } from '../types/moneta';

export const DEFAULT_RULES: CategorizationRule[] = [
  // Groceries
  { id: 'rule-1', priority: 1, match_field: 'payee', match_pattern: 'fairprice', category_name: 'Groceries' },
  { id: 'rule-2', priority: 1, match_field: 'payee', match_pattern: 'cold storage', category_name: 'Groceries' },
  { id: 'rule-3', priority: 1, match_field: 'payee', match_pattern: 'sheng siong', category_name: 'Groceries' },
  { id: 'rule-4', priority: 1, match_field: 'payee', match_pattern: 'don don donki', category_name: 'Groceries' },
  { id: 'rule-5', priority: 1, match_field: 'payee', match_pattern: 'redmart', category_name: 'Groceries' },

  // Dining & Cafes
  { id: 'rule-6', priority: 2, match_field: 'payee', match_pattern: 'starbucks', category_name: 'Dining & Cafes' },
  { id: 'rule-7', priority: 2, match_field: 'payee', match_pattern: 'bacha coffee', category_name: 'Dining & Cafes' },
  { id: 'rule-8', priority: 2, match_field: 'payee', match_pattern: 'mcdonald', category_name: 'Dining & Cafes' },
  { id: 'rule-9', priority: 2, match_field: 'payee', match_pattern: 'toast box', category_name: 'Dining & Cafes' },
  { id: 'rule-10', priority: 2, match_field: 'payee', match_pattern: 'kopitiam', category_name: 'Dining & Cafes' },
  { id: 'rule-11', priority: 2, match_field: 'payee', match_pattern: 'foodpanda', category_name: 'Dining & Cafes' },
  { id: 'rule-12', priority: 2, match_field: 'payee', match_pattern: 'deliveroo', category_name: 'Dining & Cafes' },

  // Transportation
  { id: 'rule-13', priority: 3, match_field: 'payee', match_pattern: 'grab', category_name: 'Transportation' },
  { id: 'rule-14', priority: 3, match_field: 'payee', match_pattern: 'gojek', category_name: 'Transportation' },
  { id: 'rule-15', priority: 3, match_field: 'payee', match_pattern: 'simplygo', category_name: 'Transportation' },
  { id: 'rule-16', priority: 3, match_field: 'payee', match_pattern: 'smrt', category_name: 'Transportation' },
  { id: 'rule-17', priority: 3, match_field: 'payee', match_pattern: 'comfortdelgro', category_name: 'Transportation' },
  { id: 'rule-18', priority: 3, match_field: 'payee', match_pattern: 'shell', category_name: 'Transportation' },
  { id: 'rule-19', priority: 3, match_field: 'payee', match_pattern: 'esso', category_name: 'Transportation' },

  // Utilities & Telco
  { id: 'rule-20', priority: 4, match_field: 'payee', match_pattern: 'sp services', category_name: 'Utilities' },
  { id: 'rule-21', priority: 4, match_field: 'payee', match_pattern: 'sp power', category_name: 'Utilities' },
  { id: 'rule-22', priority: 4, match_field: 'payee', match_pattern: 'singtel', category_name: 'Utilities' },
  { id: 'rule-23', priority: 4, match_field: 'payee', match_pattern: 'starhub', category_name: 'Utilities' },
  { id: 'rule-24', priority: 4, match_field: 'payee', match_pattern: 'm1 limited', category_name: 'Utilities' },

  // Subscriptions & Tech
  { id: 'rule-25', priority: 5, match_field: 'payee', match_pattern: 'apple.com', category_name: 'Subscriptions' },
  { id: 'rule-26', priority: 5, match_field: 'payee', match_pattern: 'netflix', category_name: 'Subscriptions' },
  { id: 'rule-27', priority: 5, match_field: 'payee', match_pattern: 'spotify', category_name: 'Subscriptions' },
  { id: 'rule-28', priority: 5, match_field: 'payee', match_pattern: 'openai', category_name: 'Subscriptions' },
  { id: 'rule-29', priority: 5, match_field: 'payee', match_pattern: 'claude.ai', category_name: 'Subscriptions' },
  { id: 'rule-30', priority: 5, match_field: 'payee', match_pattern: 'google cloud', category_name: 'Subscriptions' },

  // Income
  { id: 'rule-31', priority: 6, match_field: 'payee', match_pattern: 'salary', category_name: 'Income & Salary' },
  { id: 'rule-32', priority: 6, match_field: 'payee', match_pattern: 'payroll', category_name: 'Income & Salary' },
  { id: 'rule-33', priority: 6, match_field: 'payee', match_pattern: 'dividend', category_name: 'Investments' },
];

export const predictCategory = (
  payee: string,
  memo: string = '',
  customRules: CategorizationRule[] = []
): string => {
  const allRules = [...customRules, ...DEFAULT_RULES].sort((a, b) => a.priority - b.priority);
  const targetPayee = (payee || '').toLowerCase();
  const targetMemo = (memo || '').toLowerCase();

  for (const rule of allRules) {
    const pattern = rule.match_pattern.toLowerCase().trim();
    if (!pattern) continue;

    const sourceText = rule.match_field === 'memo' ? targetMemo : targetPayee;

    if (sourceText.includes(pattern)) {
      return rule.category_name;
    }
  }

  return 'General';
};
