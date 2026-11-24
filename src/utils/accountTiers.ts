// accountTiers.ts
// Single source of truth for QC account types (see "QC ACCOUNTS TYPE" spec).
// Every gate, fee and limit check reads from TIERS - changing a price, fee or limit
// is a one-line edit here. "On demand" cells are unlocked per account with a FeatureGrant.

export const USER_TIERS = ["STARTER", "PREMIUM", "VIP", "FREELANCE", "AGENT"] as const;
export const ORGANIZATION_TIERS = ["BUSINESS", "NPO"] as const;

export type UserTier = (typeof USER_TIERS)[number];
export type OrganizationTier = (typeof ORGANIZATION_TIERS)[number];
export type AccountTier = UserTier | OrganizationTier;

export const DEFAULT_USER_TIER: UserTier = "STARTER";
export const DEFAULT_ORGANIZATION_TIER: OrganizationTier = "BUSINESS";

// Tiers an account can buy itself from the wallet. AGENT, BUSINESS and NPO are
// assigned by an admin (agent onboarding, business quote, NPO approval).
export const SELF_SERVICE_TIERS: UserTier[] = ["STARTER", "PREMIUM", "VIP", "FREELANCE"];

export const FEATURE_KEYS = [
  "instantTransfer",
  "personalizedTransfer",
  "comment",
  "scheduledPayment",
  "blockedTransfer",
  "transferTracking",
  "bulkPayment",
  "categoryCreation",
  "secondQc",
  "actionCreation",
  "instantMoneyReceipt",
  "paymentAmountSetting",
  "storingInformation",
  "aiChatbot",
  "employeeManagement",
  "productManagement",
  "receiveAnyMoney",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  instantTransfer: "Instant transfer",
  personalizedTransfer: "Personalized transfer",
  comment: "Communication (comment)",
  scheduledPayment: "Scheduled payment",
  blockedTransfer: "Blocked transfer",
  transferTracking: "Transfer tracking",
  bulkPayment: "Bulk payment",
  categoryCreation: "Category creation",
  secondQc: "Second QC",
  actionCreation: "Action creation",
  instantMoneyReceipt: "Instant money receipt",
  paymentAmountSetting: "Payment amount setting",
  storingInformation: "Storing information",
  aiChatbot: "AI chatbot",
  employeeManagement: "Employee management system",
  productManagement: "Product management system",
  receiveAnyMoney: "Receiving any type of money",
};

export interface FeatureAccess {
  allowed: boolean;
  fee: number; // RWF charged per use when allowed
  onDemand: boolean; // not allowed by default, but an admin can grant it
}

export type SupportLevel = "email" | "mail_chat" | "24_7";

export interface TierDefinition {
  tier: AccountTier;
  name: string;
  accountKind: "user" | "organization";
  priceRwf: number | null; // monthly; null = quote on demand
  dailyTransferLimit: number | null; // RWF; null = on demand (no limit unless granted)
  currencies: string[];
  support: SupportLevel;
  features: Record<FeatureKey, FeatureAccess>;
}

const FREE: FeatureAccess = { allowed: true, fee: 0, onDemand: false };
const NO: FeatureAccess = { allowed: false, fee: 0, onDemand: false };
const ON_DEMAND: FeatureAccess = { allowed: false, fee: 0, onDemand: true };
const FEE = (fee: number): FeatureAccess => ({ allowed: true, fee, onDemand: false });

const STANDARD_FEE = 115;

// Features only professional / NPO accounts get - "-" on every private tier.
const PROFESSIONAL_ONLY_NO = {
  actionCreation: NO,
  instantMoneyReceipt: NO,
  paymentAmountSetting: NO,
  storingInformation: NO,
  aiChatbot: NO,
  employeeManagement: NO,
  productManagement: NO,
  receiveAnyMoney: NO,
};

export const TIERS: Record<AccountTier, TierDefinition> = {
  STARTER: {
    tier: "STARTER",
    name: "Starter (Bronze)",
    accountKind: "user",
    priceRwf: 0,
    dailyTransferLimit: 35000,
    currencies: ["RWF"],
    support: "mail_chat",
    features: {
      instantTransfer: FEE(STANDARD_FEE),
      personalizedTransfer: FEE(STANDARD_FEE),
      comment: FEE(STANDARD_FEE),
      scheduledPayment: FEE(STANDARD_FEE),
      blockedTransfer: FEE(STANDARD_FEE),
      transferTracking: FEE(STANDARD_FEE),
      bulkPayment: FEE(STANDARD_FEE),
      categoryCreation: NO,
      secondQc: NO,
      ...PROFESSIONAL_ONLY_NO,
    },
  },
  PREMIUM: {
    tier: "PREMIUM",
    name: "Premium (Silver)",
    accountKind: "user",
    priceRwf: 1490,
    dailyTransferLimit: 150000,
    currencies: ["RWF"],
    support: "mail_chat",
    features: {
      instantTransfer: FREE,
      personalizedTransfer: FREE,
      comment: FREE,
      scheduledPayment: FREE,
      blockedTransfer: FEE(STANDARD_FEE),
      transferTracking: FEE(STANDARD_FEE),
      bulkPayment: FREE,
      categoryCreation: NO,
      secondQc: NO,
      ...PROFESSIONAL_ONLY_NO,
    },
  },
  VIP: {
    tier: "VIP",
    name: "V.I.P (Gold)",
    accountKind: "user",
    priceRwf: 4900,
    dailyTransferLimit: 4000000,
    currencies: ["RWF", "USD", "EUR"],
    support: "24_7",
    features: {
      instantTransfer: FREE,
      personalizedTransfer: FREE,
      comment: FREE,
      scheduledPayment: FREE,
      blockedTransfer: FREE,
      transferTracking: FREE,
      bulkPayment: FREE,
      categoryCreation: FREE,
      secondQc: ON_DEMAND,
      ...PROFESSIONAL_ONLY_NO,
    },
  },
  FREELANCE: {
    tier: "FREELANCE",
    name: "Freelance",
    accountKind: "user",
    priceRwf: 2490,
    dailyTransferLimit: 500000,
    currencies: ["RWF"],
    support: "mail_chat",
    features: {
      instantTransfer: FREE,
      personalizedTransfer: FREE,
      comment: FREE,
      scheduledPayment: FREE,
      blockedTransfer: FEE(STANDARD_FEE),
      transferTracking: FEE(STANDARD_FEE),
      bulkPayment: FREE,
      categoryCreation: NO,
      secondQc: NO,
      actionCreation: NO,
      instantMoneyReceipt: FREE,
      paymentAmountSetting: FREE,
      storingInformation: NO,
      aiChatbot: NO,
      employeeManagement: NO,
      productManagement: NO,
      receiveAnyMoney: NO,
    },
  },
  AGENT: {
    tier: "AGENT",
    name: "Special Agent",
    accountKind: "user",
    priceRwf: 0,
    dailyTransferLimit: null,
    currencies: ["RWF", "USD", "EUR"],
    support: "24_7",
    features: {
      instantTransfer: FREE,
      personalizedTransfer: FREE,
      comment: FREE,
      scheduledPayment: FREE,
      blockedTransfer: NO,
      transferTracking: FREE,
      bulkPayment: NO,
      categoryCreation: FREE,
      secondQc: NO,
      actionCreation: NO,
      instantMoneyReceipt: FREE,
      paymentAmountSetting: FREE,
      storingInformation: NO,
      aiChatbot: NO,
      employeeManagement: NO,
      productManagement: NO,
      receiveAnyMoney: NO,
    },
  },
  BUSINESS: {
    tier: "BUSINESS",
    name: "Business",
    accountKind: "organization",
    priceRwf: null,
    dailyTransferLimit: null,
    currencies: ["RWF"],
    support: "24_7",
    features: {
      instantTransfer: FREE,
      personalizedTransfer: FREE,
      comment: FREE,
      scheduledPayment: FREE,
      blockedTransfer: FREE,
      transferTracking: FREE,
      bulkPayment: FREE,
      categoryCreation: NO,
      secondQc: ON_DEMAND,
      actionCreation: FREE,
      instantMoneyReceipt: FREE,
      paymentAmountSetting: FREE,
      storingInformation: FREE,
      aiChatbot: ON_DEMAND,
      employeeManagement: ON_DEMAND,
      productManagement: ON_DEMAND,
      receiveAnyMoney: NO,
    },
  },
  NPO: {
    tier: "NPO",
    name: "Non-profit organisation",
    accountKind: "organization",
    priceRwf: 0,
    dailyTransferLimit: 500000,
    currencies: ["RWF", "USD", "EUR"],
    support: "mail_chat",
    features: {
      instantTransfer: FREE,
      personalizedTransfer: FREE,
      comment: FREE,
      scheduledPayment: FREE,
      blockedTransfer: FEE(STANDARD_FEE),
      transferTracking: FEE(STANDARD_FEE),
      bulkPayment: FEE(STANDARD_FEE),
      categoryCreation: ON_DEMAND,
      secondQc: ON_DEMAND,
      actionCreation: FREE,
      instantMoneyReceipt: FREE,
      paymentAmountSetting: FREE,
      storingInformation: ON_DEMAND,
      aiChatbot: ON_DEMAND,
      employeeManagement: ON_DEMAND,
      productManagement: ON_DEMAND,
      receiveAnyMoney: FREE,
    },
  },
};

export const SUBSCRIPTION_PERIOD_DAYS = 30;
export const SUBSCRIPTION_GRACE_DAYS = 3;

export const isAccountTier = (value: unknown): value is AccountTier =>
  typeof value === "string" && value in TIERS;

export const isFeatureKey = (value: unknown): value is FeatureKey =>
  typeof value === "string" && (FEATURE_KEYS as readonly string[]).includes(value);

export const tiersForKind = (kind: "user" | "organization"): AccountTier[] =>
  kind === "user" ? [...USER_TIERS] : [...ORGANIZATION_TIERS];

// Fees are off until QA signs them off; gates and limits apply regardless.
export const feesEnabled = (): boolean => process.env.FEES_ENABLED === "true";
export const transferLimitsEnabled = (): boolean => process.env.TRANSFER_LIMITS_ENABLED !== "false";
