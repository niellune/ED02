// Single source of truth for what each plan includes. Pricing copy on the
// website and limit enforcement in the app both read from here.
export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    maxDynamicCodes: 3,
    historyDays: 30,
    customColors: false,
    csvExport: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 5,
    priceYearly: 48,
    maxDynamicCodes: 250,
    historyDays: null, // unlimited
    customColors: true,
    csvExport: true,
  },
};

export function planFor(user) {
  return PLANS[user?.plan] || PLANS.free;
}
