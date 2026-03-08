const counters = {
  total: 0,
  avenue: 0,
  wildcard: 0,
  clarification: 0,
  fallbacks: 0,
  providerErrors: 0,
  mockResponses: 0
};

export function recordRouteType(type) {
  counters.total += 1;
  if (type === 'avenue') counters.avenue += 1;
  if (type === 'wildcard') counters.wildcard += 1;
  if (type === 'clarification') counters.clarification += 1;
}

export function recordFallback() {
  counters.fallbacks += 1;
}

export function recordProviderError() {
  counters.providerErrors += 1;
}

export function recordMockResponse() {
  counters.mockResponses += 1;
}

export function getResolverMetrics() {
  return {
    ...counters,
    rates: {
      wildcardRate: counters.total ? counters.wildcard / counters.total : 0,
      clarificationRate: counters.total ? counters.clarification / counters.total : 0,
      fallbackRate: counters.total ? counters.fallbacks / counters.total : 0
    }
  };
}
