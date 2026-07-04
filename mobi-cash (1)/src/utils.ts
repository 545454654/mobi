import { Platform, Transaction } from './types';

// Deterministic Arabic name generator based on ID
export const getPlayerName = (id: string): string => {
  if (!id || id.trim() === '') return '';

  // Exact match preset IDs for an extremely realistic feel
  const presetNames: Record<string, string> = {
    '123456': 'أحمد محمد العشري',
    '882341': 'مروان عبد العزيز الجبالي',
    '991203': 'كريم حسام المنشاوي',
    '112233': 'يوسف صلاح الدين رضوان',
    '554433': 'عمرو فاروق النحاس',
    '778899': 'خالد سليمان الشافعي',
    '101010': 'مصطفى شريف التميمي',
    '202020': 'زياد طارق الهواري'
  };

  const cleanId = id.trim();
  if (presetNames[cleanId]) {
    return presetNames[cleanId];
  }

  // Fallback: Deterministic hashing to generate unique names for any ID
  let hash = 0;
  for (let i = 0; i < cleanId.length; i++) {
    hash = cleanId.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const firstNames = [
    'أحمد', 'مروان', 'كريم', 'يوسف', 'مصطفى', 
    'محمد', 'طارق', 'هشام', 'عمرو', 'علي', 
    'خالد', 'زياد', 'عمر', 'محمود', 'سامح', 
    'إيهاب', 'رامي', 'حسن', 'صلاح', 'شريف',
    'سليمان', 'نادر', 'عادل', 'ماجد', 'وائل'
  ];

  const fatherNames = [
    'محمود', 'عبد العزيز', 'حسام', 'عادل', 'إبراهيم', 
    'سعد', 'حسن', 'حسين', 'سعيد', 'مجدي', 
    'كمال', 'شريف', 'طه', 'صلاح', 'صبري', 
    'فاروق', 'جمال', 'رأفت', 'ممدوح', 'جلال',
    'عثمان', 'شاكر', 'نبيل', 'عطية', 'بدوي'
  ];

  const familyNames = [
    'الشافعي', 'التميمي', 'الهواري', 'المصري', 'سليم', 
    'المنشاوي', 'رضوان', 'زكي', 'غانم', 'الجبالي', 
    'سلامة', 'عاشور', 'فودة', 'خليل', 'بكر', 
    'النحاس', 'الفيومي', 'البحيري', 'الحداد', 'رشوان',
    'المهدي', 'سرور', 'حماد', 'العربي', 'الجزار'
  ];

  const first = firstNames[hash % firstNames.length];
  const father = fatherNames[(hash >> 2) % fatherNames.length];
  const family = familyNames[(hash >> 4) % familyNames.length];

  return `${first} ${father} ${family}`;
};

// Supported Platforms
export const PLATFORMS: Platform[] = [
  {
    id: 'megapari',
    name: 'MegaPari',
    logoText: 'MEGAPARI',
    gradient: 'from-red-600 to-rose-800',
    accentColor: 'bg-red-600',
    borderColor: 'border-red-600',
    hoverColor: 'hover:bg-red-700',
    minDeposit: 150,
    maxDeposit: 1000000
  },
  {
    id: 'wowbit',
    name: 'WowBit',
    logoText: 'WowBit',
    gradient: 'from-indigo-600 to-violet-800',
    accentColor: 'bg-indigo-600',
    borderColor: 'border-indigo-600',
    hoverColor: 'hover:bg-indigo-700',
    minDeposit: 100,
    maxDeposit: 1000000
  }
];

// Mock Transactions
export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TX882341A',
    amount: 1500,
    accountId: '882341',
    platformId: 'megapari',
    platformName: 'MegaPari',
    playerName: 'مروان عبد العزيز الجبالي',
    date: '2026-06-30',
    type: 'deposit',
    status: 'success'
  },
  {
    id: 'TX991203B',
    amount: 500,
    accountId: '991203',
    platformId: 'wowbit',
    platformName: 'WowBit',
    playerName: 'كريم حسام المنشاوي',
    date: '2026-06-29',
    type: 'deposit',
    status: 'success'
  },
  {
    id: 'TX112233C',
    amount: 3200,
    accountId: '112233',
    platformId: 'megapari',
    platformName: 'MegaPari',
    playerName: 'يوسف صلاح الدين رضوان',
    date: '2026-06-28',
    type: 'deposit',
    status: 'success'
  }
];
