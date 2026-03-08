import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const traces = [];

function nowIso() {
  return new Date().toISOString();
}

export function startTrace(name, metadata = {}) {
  const trace = {
    id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    metadata,
    startedAt: nowIso(),
    endedAt: null,
    spans: []
  };

  traces.unshift(trace);
  if (traces.length > 200) traces.pop();
  return trace.id;
}

export function addSpan(traceId, name, data = {}) {
  const trace = traces.find((item) => item.id === traceId);
  if (!trace) return;

  trace.spans.push({
    name,
    at: nowIso(),
    data
  });
}

export function endTrace(traceId, result = {}) {
  const trace = traces.find((item) => item.id === traceId);
  if (!trace) return;

  trace.endedAt = nowIso();
  trace.result = result;
  void pushLangfuseTrace(trace);
}

export function getRecentTraces(limit = 20) {
  return traces.slice(0, limit);
}

async function pushLangfuseTrace(trace) {
  if (!env.langfuseHost || !env.langfusePublicKey || !env.langfuseSecretKey) return;

  try {
    const auth = Buffer.from(`${env.langfusePublicKey}:${env.langfuseSecretKey}`).toString('base64');
    await fetch(`${env.langfuseHost.replace(/\/$/, '')}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        batch: [
          {
            id: trace.id,
            type: 'trace-create',
            timestamp: trace.startedAt,
            body: {
              id: trace.id,
              name: trace.name,
              metadata: trace.metadata,
              output: trace.result,
              tags: ['luminaquest', 'iteration2']
            }
          }
        ]
      })
    });
  } catch (error) {
    logger.warn('Failed to push trace to Langfuse sink', { message: error.message });
  }
}
