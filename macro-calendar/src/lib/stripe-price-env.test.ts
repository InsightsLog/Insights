import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getStripePriceEnv", () => {
  // Store original env values
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules before each test to ensure fresh env parsing
    vi.resetModules();
    // Create a fresh copy of process.env for each test
    process.env = { ...originalEnv };
    // Set required env vars for the module to load
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
  });

  afterEach(() => {
    // Restore original env after each test
    process.env = originalEnv;
  });

  it("returns empty config when no Stripe price env vars are set", async () => {
    // Ensure Stripe price vars are not set
    delete process.env.STRIPE_PRICE_PLUS_MONTHLY;
    delete process.env.STRIPE_PRICE_PLUS_YEARLY;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    delete process.env.STRIPE_PRICE_PRO_YEARLY;
    delete process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY;
    delete process.env.STRIPE_PRICE_ENTERPRISE_YEARLY;

    // Import the function fresh to pick up new env values
    const { getStripePriceEnv } = await import("./env");
    const result = getStripePriceEnv();

    expect(result).toEqual({
      plus: { monthly: undefined, yearly: undefined },
      pro: { monthly: undefined, yearly: undefined },
      enterprise: { monthly: undefined, yearly: undefined },
    });
  });

  it("returns Plus monthly price when STRIPE_PRICE_PLUS_MONTHLY is set", async () => {
    process.env.STRIPE_PRICE_PLUS_MONTHLY = "price_plus_monthly_123";

    const { getStripePriceEnv } = await import("./env");
    const result = getStripePriceEnv();

    expect(result.plus?.monthly).toBe("price_plus_monthly_123");
    expect(result.plus?.yearly).toBeUndefined();
  });

  it("returns Plus yearly price when STRIPE_PRICE_PLUS_YEARLY is set", async () => {
    process.env.STRIPE_PRICE_PLUS_YEARLY = "price_plus_yearly_456";

    const { getStripePriceEnv } = await import("./env");
    const result = getStripePriceEnv();

    expect(result.plus?.yearly).toBe("price_plus_yearly_456");
    expect(result.plus?.monthly).toBeUndefined();
  });

  it("returns Pro prices when both Pro env vars are set", async () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_789";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_yearly_101";

    const { getStripePriceEnv } = await import("./env");
    const result = getStripePriceEnv();

    expect(result.pro?.monthly).toBe("price_pro_monthly_789");
    expect(result.pro?.yearly).toBe("price_pro_yearly_101");
  });

  it("returns Enterprise prices when Enterprise env vars are set", async () => {
    process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY = "price_ent_monthly_111";
    process.env.STRIPE_PRICE_ENTERPRISE_YEARLY = "price_ent_yearly_222";

    const { getStripePriceEnv } = await import("./env");
    const result = getStripePriceEnv();

    expect(result.enterprise?.monthly).toBe("price_ent_monthly_111");
    expect(result.enterprise?.yearly).toBe("price_ent_yearly_222");
  });

  it("returns all prices when all env vars are set", async () => {
    process.env.STRIPE_PRICE_PLUS_MONTHLY = "price_plus_m";
    process.env.STRIPE_PRICE_PLUS_YEARLY = "price_plus_y";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_m";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_y";
    process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY = "price_ent_m";
    process.env.STRIPE_PRICE_ENTERPRISE_YEARLY = "price_ent_y";

    const { getStripePriceEnv } = await import("./env");
    const result = getStripePriceEnv();

    expect(result).toEqual({
      plus: { monthly: "price_plus_m", yearly: "price_plus_y" },
      pro: { monthly: "price_pro_m", yearly: "price_pro_y" },
      enterprise: { monthly: "price_ent_m", yearly: "price_ent_y" },
    });
  });
});
