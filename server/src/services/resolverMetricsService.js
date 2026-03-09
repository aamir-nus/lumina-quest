const counters = {
  total: 0,
  avenue: 0,
  wildcard: 0,
  clarification: 0,
  fallbacks: 0,
  providerErrors: 0,
  mockResponses: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  llmCalls: 0
};

const computeWindow = [];
const MAX_COMPUTE_SAMPLES = 50;

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

export function recordLlmUsage(usage = {}) {
  const input = Number(usage.inputTokens || 0);
  const output = Number(usage.outputTokens || 0);
  const total = Number(usage.totalTokens || input + output || 0);

  counters.inputTokens += input;
  counters.outputTokens += output;
  counters.totalTokens += total;
  counters.llmCalls += 1;
}

export function recordComputeApprox(sample = {}) {
  computeWindow.unshift({
    at: new Date().toISOString(),
    provider: sample.provider || 'unknown',
    latencyMs: Number(sample.latencyMs || 0),
    cpuUserMs: Number(sample.cpuUserMs || 0),
    cpuSystemMs: Number(sample.cpuSystemMs || 0),
    rssMb: Number(sample.rssMb || 0),
    heapUsedMb: Number(sample.heapUsedMb || 0)
  });
  if (computeWindow.length > MAX_COMPUTE_SAMPLES) computeWindow.pop();
}

function aggregateCompute() {
  if (computeWindow.length === 0) {
    return {
      samples: 0,
      avgLatencyMs: 0,
      avgCpuUserMs: 0,
      avgCpuSystemMs: 0,
      avgRssMb: 0,
      avgHeapUsedMb: 0,
      latest: null
    };
  }

  const sums = computeWindow.reduce(
    (acc, item) => {
      acc.latency += item.latencyMs;
      acc.cpuUser += item.cpuUserMs;
      acc.cpuSystem += item.cpuSystemMs;
      acc.rss += item.rssMb;
      acc.heap += item.heapUsedMb;
      return acc;
    },
    { latency: 0, cpuUser: 0, cpuSystem: 0, rss: 0, heap: 0 }
  );

  const count = computeWindow.length;
  return {
    samples: count,
    avgLatencyMs: sums.latency / count,
    avgCpuUserMs: sums.cpuUser / count,
    avgCpuSystemMs: sums.cpuSystem / count,
    avgRssMb: sums.rss / count,
    avgHeapUsedMb: sums.heap / count,
    latest: computeWindow[0]
  };
}

export function getResolverMetrics() {
  return {
    ...counters,
    rates: {
      wildcardRate: counters.total ? counters.wildcard / counters.total : 0,
      clarificationRate: counters.total ? counters.clarification / counters.total : 0,
      fallbackRate: counters.total ? counters.fallbacks / counters.total : 0
    },
    computeApprox: aggregateCompute()
  };
}
