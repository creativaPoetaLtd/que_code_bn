// topUpProviders.ts
// Mobile money providers behind one interface. Real providers (MTN MoMo "Request to Pay",
// Airtel Money "Collections") are asynchronous: the payer approves on their phone and the
// result arrives later by callback or polling. The simulated provider reproduces that shape
// - it accepts the request, then reports the outcome after a delay - so the rest of the
// top-up flow is identical when a real integration replaces it.
import { v4 as uuidv4 } from "uuid";
import { TopUpProviderKey } from "../types/model";

export interface TopUpPaymentRequest {
  topUpId: string;
  amount: number;
  currency: string;
  phoneNumber: string; // normalized 2507XXXXXXXX
  note?: string | null;
}

export type TopUpResult =
  | { status: "successful"; providerReference?: string }
  | { status: "failed"; reason: string };

export interface TopUpProviderContext {
  /** Reports the final outcome. Real providers call this from their callback / poller. */
  settle: (result: TopUpResult) => Promise<void>;
}

export interface TopUpProvider {
  key: TopUpProviderKey;
  name: string;
  simulated: boolean;
  /** Starts the collection; resolves once the provider has accepted the request. */
  requestPayment(request: TopUpPaymentRequest, context: TopUpProviderContext): Promise<{ providerReference: string }>;
}

export const TOPUP_PROVIDER_NAMES: Record<TopUpProviderKey, string> = {
  mtn_momo: "MTN Mobile Money",
  airtel_money: "Airtel Money",
};

// Rwandan mobile prefixes per network (2507XXXXXXXX).
const PROVIDER_PREFIXES: Record<TopUpProviderKey, string[]> = {
  mtn_momo: ["25078", "25079"],
  airtel_money: ["25072", "25073"],
};

/** Accepts 07XXXXXXXX, 2507XXXXXXXX or +2507XXXXXXXX (spaces/dashes ignored). */
export const normalizeRwandaPhone = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[\s-]/g, "").replace(/^\+/, "");
  if (/^07\d{8}$/.test(digits)) return `250${digits.slice(1)}`;
  if (/^2507\d{8}$/.test(digits)) return digits;
  return null;
};

export const phoneMatchesProvider = (phone: string, provider: TopUpProviderKey): boolean =>
  PROVIDER_PREFIXES[provider].some((prefix) => phone.startsWith(prefix));

export const topUpSimulationEnabled = (): boolean => process.env.TOPUP_SIMULATION_ENABLED === "true";

const simulationDelayMs = (): number => {
  const value = parseInt(process.env.TOPUP_SIMULATION_DELAY_MS || "", 10);
  return Number.isFinite(value) && value >= 0 ? value : 5000;
};

/**
 * Test numbers, like the MoMo sandbox's magic MSISDNs - the last digits decide the outcome:
 *   ...0000 -> failed (payer declined)
 *   ...1111 -> failed (payer has insufficient funds)
 *   ...9999 -> never answers (stays pending until the expiry job times it out)
 *   anything else -> successful
 */
export const simulatedOutcomeFor = (phoneNumber: string): TopUpResult | null => {
  if (phoneNumber.endsWith("0000")) return { status: "failed", reason: "Payer declined the request" };
  if (phoneNumber.endsWith("1111")) return { status: "failed", reason: "Insufficient funds on mobile money account" };
  if (phoneNumber.endsWith("9999")) return null;
  return { status: "successful" };
};

const createSimulatedProvider = (key: TopUpProviderKey): TopUpProvider => ({
  key,
  name: TOPUP_PROVIDER_NAMES[key],
  simulated: true,
  async requestPayment(request, context) {
    const providerReference = `SIM-${uuidv4()}`;
    const outcome = simulatedOutcomeFor(request.phoneNumber);

    if (outcome) {
      // In-memory timer: lost on restart, after which the expiry job fails the top-up,
      // the same as a real provider that never calls back.
      setTimeout(() => {
        const result = outcome.status === "successful" ? { ...outcome, providerReference } : outcome;
        context.settle(result).catch((error) => {
          console.error(`[topups] Simulated settlement failed for ${request.topUpId}:`, error);
        });
      }, simulationDelayMs());
    }

    return { providerReference };
  },
});

/**
 * The provider for a key, or null when top-ups via that provider are unavailable.
 * Real integrations plug in here (e.g. return an MTN client when its env keys are set).
 */
export const getTopUpProvider = (key: TopUpProviderKey): TopUpProvider | null => {
  if (topUpSimulationEnabled()) return createSimulatedProvider(key);
  return null;
};

export const listTopUpProviders = () =>
  (Object.keys(TOPUP_PROVIDER_NAMES) as TopUpProviderKey[]).map((key) => {
    const provider = getTopUpProvider(key);
    return { key, name: TOPUP_PROVIDER_NAMES[key], available: !!provider, simulated: !!provider?.simulated };
  });
