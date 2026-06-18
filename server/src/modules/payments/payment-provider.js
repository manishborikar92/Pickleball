export const assertPaymentProvider = (provider) => {
  const requiredMethods = ['createPaymentOrder'];
  const missing = requiredMethods.filter((method) => typeof provider?.[method] !== 'function');

  if (missing.length > 0) {
    throw new Error(`Payment provider is missing required methods: ${missing.join(', ')}`);
  }

  return provider;
};
