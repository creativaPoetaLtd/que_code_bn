// Hardcoded expense categories
export const EXPENSE_CATEGORIES = [
  {
    id: 'food',
    name: 'Food & Dining',
    icon: '🍕',
    color: '#FF6B6B'
  },
  {
    id: 'transport',
    name: 'Transportation',
    icon: '🚗',
    color: '#4ECDC4'
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎬',
    color: '#45B7D1'
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: '🛍️',
    color: '#F7B731'
  },
  {
    id: 'bills',
    name: 'Bills & Utilities',
    icon: '⚡',
    color: '#5F27CD'
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    icon: '🏥',
    color: '#00D2D3'
  },
  {
    id: 'education',
    name: 'Education',
    icon: '📚',
    color: '#FF9FF3'
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: '✈️',
    color: '#54A0FF'
  },
  {
    id: 'other',
    name: 'Other',
    icon: '📦',
    color: '#747D8C'
  }
];

export const getCategoryById = (id: string) => {
  return EXPENSE_CATEGORIES.find(cat => cat.id === id);
};

export const getCategoryName = (id: string) => {
  const category = getCategoryById(id);
  return category ? category.name : 'Uncategorized';
};
