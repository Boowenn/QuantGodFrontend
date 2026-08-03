import { fetchJson, fetchRows, queryString as params } from './apiClient.js';

async function loadNamedEntries(entries, options = {}, concurrency = 6) {
  const results = {};
  let cursor = 0;

  async function worker() {
    while (cursor < entries.length && !options.signal?.aborted) {
      const [key, loadEntry] = entries[cursor];
      cursor += 1;
      try {
        results[key] = await loadEntry(options);
      } catch (error) {
        results[key] = {
          ok: false,
          status: 0,
          error: { message: error?.message || String(error) },
          endpointLoadFailed: true,
        };
      }
    }
  }

  const workerCount = Math.min(concurrency, entries.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

const operatorOverviewEntries = [['operatorOverview', (options) => loadOperatorOverview(options)]];

export async function loadOperatorOverview(options = {}) {
  return fetchJson('/api/operator/overview', null, { ...options, timeoutMs: 5000 });
}

export async function loadDashboardWorkspaceCore(options = {}) {
  // First paint uses the single-generation aggregate; detailed endpoints load in the background below.
  return loadNamedEntries(operatorOverviewEntries, options, 1);
}

const dashboardReadonlyRefreshEntries = [
  ...operatorOverviewEntries,
  ['mt5Snapshot', (options) => fetchJson('/api/mt5-readonly/snapshot', null, options)],
  [
    'secondaryMt5Snapshot',
    (options) => fetchJson('/api/mt5-readonly-secondary/snapshot', null, { ...options, timeoutMs: 10000 }),
  ],
];

export async function loadDashboardReadonlyRefresh(options = {}) {
  return loadNamedEntries(dashboardReadonlyRefreshEntries, options, 3);
}

export async function loadSnapshotHealthCore(options = {}) {
  return loadNamedEntries(operatorOverviewEntries, options, 1);
}

export async function loadDashboardWorkspace(options = {}) {
  const entries = [
    ['latest', (requestOptions) => fetchJson('/api/latest', null, requestOptions)],
    ['state', (requestOptions) => fetchJson('/api/dashboard/state', null, requestOptions)],
    ['backtest', (requestOptions) => fetchJson('/api/dashboard/backtest-summary', null, requestOptions)],
    ['dailyReview', (requestOptions) => fetchJson('/api/daily-review', null, requestOptions)],
    [
      'dailyAutopilotV2',
      (requestOptions) =>
        fetchJson('/api/usdjpy-strategy-lab/autonomous-agent/daily-autopilot-v2', null, requestOptions),
    ],
    [
      'agentOpsHealth',
      (requestOptions) => fetchJson('/api/usdjpy-strategy-lab/agent-ops-health/status', null, requestOptions),
    ],
    [
      'telegramGateway',
      (requestOptions) => fetchJson('/api/usdjpy-strategy-lab/telegram-gateway/status', null, requestOptions),
    ],
    ['mt5Snapshot', (requestOptions) => fetchJson('/api/mt5-readonly/snapshot', null, requestOptions)],
    [
      'secondaryMt5Snapshot',
      (requestOptions) => fetchJson('/api/mt5-readonly-secondary/snapshot', null, requestOptions),
    ],
    [
      'usdJpyLiveLoop',
      (requestOptions) => fetchJson('/api/usdjpy-strategy-lab/live-loop', null, requestOptions),
    ],
    [
      'productionEvidenceValidation',
      (requestOptions) => fetchJson('/api/production-evidence-validation/status', null, requestOptions),
    ],
    ...[
      'forex-live12-runtime-handoff',
      'forex-live12-capacity-expansion-review',
      'forex-live12-capacity-expansion-roadmap',
      'forex-live12-micro-expansion-review',
      'forex-live12-rsi-repair-plan',
      'forex-live12-rsi-shadow-candidate',
      'forex-live12-rsi-tester-request',
      'forex-live12-rsi-tester-run-gate',
      'forex-live12-rsi-candidate-promotion-gate',
      'forex-live12-rsi-tester-lock-draft',
    ].map((endpoint) => {
      const key = endpoint.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
      return [key, (requestOptions) => fetchJson(`/api/live-automation/${endpoint}`, null, requestOptions)];
    }),
  ];
  return loadNamedEntries(entries, options, 6);
}

const mt5CoreEntries = [
  ['operatorOverview', (options) => loadOperatorOverview(options)],
  ['status', (options) => fetchJson('/api/mt5-readonly/status', null, options)],
  ['account', (options) => fetchJson('/api/mt5-readonly/account', null, options)],
  [
    'secondaryAccount',
    (options) => fetchJson('/api/mt5-readonly-secondary/account', null, { ...options, timeoutMs: 10000 }),
  ],
  ['positions', (options) => fetchJson('/api/mt5-readonly/positions', null, options)],
  ['orders', (options) => fetchJson('/api/mt5-readonly/orders', null, options)],
  ['symbols', (options) => fetchJson('/api/mt5-symbol-registry/symbols', null, options)],
  ['snapshot', (options) => fetchJson('/api/mt5-readonly/snapshot', null, options)],
  [
    'secondarySnapshot',
    (options) => fetchJson('/api/mt5-readonly-secondary/snapshot', null, { ...options, timeoutMs: 10000 }),
  ],
  ['latest', (options) => fetchJson('/api/latest', null, options)],
  ['usdJpyLiveLoop', (options) => fetchJson('/api/usdjpy-strategy-lab/live-loop', null, options)],
];

export async function loadMt5WorkspaceCore(options = {}) {
  // /api/operator/overview is the canonical first-paint truth. /api/latest,
  // /api/mt5-readonly/snapshot, and /api/mt5-readonly-secondary/snapshot enrich the
  // page, but cannot override its connection, authorization, or readiness axes.
  return loadNamedEntries(mt5CoreEntries, options, 6);
}

export async function loadMt5Workspace(options = {}) {
  const focusSymbol = 'USDJPYc';
  const shadowLimit = 180;
  const tradeLimit = 200;
  const result = await loadNamedEntries(
    [
      ...mt5CoreEntries,
      [
        'closeHistory',
        (requestOptions) =>
          fetchRows(`/api/trades/close-history${params({ limit: tradeLimit })}`, requestOptions),
      ],
      [
        'secondaryCloseHistory',
        (requestOptions) =>
          fetchRows(
            `/api/trades/close-history${params({ limit: tradeLimit, scope: 'secondary' })}`,
            requestOptions,
          ),
      ],
      [
        'tradeJournal',
        (requestOptions) => fetchRows(`/api/trades/journal${params({ limit: tradeLimit })}`, requestOptions),
      ],
      [
        'secondaryTradeJournal',
        (requestOptions) =>
          fetchRows(
            `/api/trades/journal${params({ limit: tradeLimit, scope: 'secondary' })}`,
            requestOptions,
          ),
      ],
      ['dailyReview', (requestOptions) => fetchJson('/api/daily-review', null, requestOptions)],
      ['researchStats', (requestOptions) => fetchJson('/api/research/stats', null, requestOptions)],
      ['governanceAdvisor', (requestOptions) => fetchJson('/api/governance/advisor', null, requestOptions)],
      [
        'shadowSignals',
        (requestOptions) =>
          fetchJson(
            `/api/shadow/signals${params({ symbol: focusSymbol, limit: shadowLimit, days: 30 })}`,
            null,
            requestOptions,
          ),
      ],
      [
        'shadowOutcomes',
        (requestOptions) =>
          fetchJson(
            `/api/shadow/outcomes${params({ symbol: focusSymbol, limit: shadowLimit, days: 30 })}`,
            null,
            requestOptions,
          ),
      ],
      [
        'shadowCandidates',
        (requestOptions) =>
          fetchJson(
            `/api/shadow/candidates${params({ symbol: focusSymbol, limit: shadowLimit, days: 30 })}`,
            null,
            requestOptions,
          ),
      ],
      [
        'shadowCandidateOutcomes',
        (requestOptions) =>
          fetchJson(
            `/api/shadow/candidate-outcomes${params({ symbol: focusSymbol, limit: shadowLimit, days: 30 })}`,
            null,
            requestOptions,
          ),
      ],
      [
        'evidenceOS',
        (requestOptions) => fetchJson('/api/usdjpy-strategy-lab/evidence-os/status', null, requestOptions),
      ],
      [
        'evidenceParity',
        (requestOptions) => fetchJson('/api/usdjpy-strategy-lab/evidence-os/parity', null, requestOptions),
      ],
      [
        'evidenceExecutionFeedback',
        (requestOptions) =>
          fetchJson('/api/usdjpy-strategy-lab/evidence-os/execution-feedback', null, {
            ...requestOptions,
            timeoutMs: 10000,
          }),
      ],
    ],
    options,
    8,
  );
  return {
    ...result,
    evidenceOS: {
      ...(result.evidenceOS || {}),
      parity: result.evidenceParity || result.evidenceOS?.parity,
      executionFeedback: result.evidenceExecutionFeedback || result.evidenceOS?.executionFeedback,
    },
  };
}

export async function loadGovernanceWorkspace() {
  const [advisor, versionRegistry, promotionGate, optimizerV2] = await Promise.all([
    fetchJson('/api/governance/advisor'),
    fetchJson('/api/governance/version-registry'),
    fetchJson('/api/governance/promotion-gate'),
    fetchJson('/api/governance/optimizer-v2'),
  ]);
  return { advisor, versionRegistry, promotionGate, optimizerV2 };
}

export async function loadParamLabWorkspace(query = {}) {
  const limit = query.limit || 200;
  const [status, results, scheduler, recovery, reportWatcher, testerWindow, resultRows, schedulerRows] =
    await Promise.all([
      fetchJson('/api/paramlab/status'),
      fetchJson('/api/paramlab/results'),
      fetchJson('/api/paramlab/scheduler'),
      fetchJson('/api/paramlab/recovery'),
      fetchJson('/api/paramlab/report-watcher'),
      fetchJson('/api/paramlab/tester-window'),
      fetchRows(`/api/paramlab/results-ledger${params({ limit })}`),
      fetchRows(`/api/paramlab/scheduler-ledger${params({ limit })}`),
    ]);
  return { status, results, scheduler, recovery, reportWatcher, testerWindow, resultRows, schedulerRows };
}

export async function loadResearchWorkspace(query = {}) {
  const limit = query.limit || 300;
  const days = query.days || 30;
  const [
    stats,
    statsLedger,
    shadowSignals,
    shadowOutcomes,
    shadowCandidates,
    closeHistory,
    tradeJournal,
    strategyEvaluation,
    regimeEvaluation,
    manualAlpha,
  ] = await Promise.all([
    fetchJson('/api/research/stats'),
    fetchJson(`/api/research/stats-ledger${params({ limit })}`),
    fetchJson(`/api/shadow/signals${params({ limit, days })}`),
    fetchJson(`/api/shadow/outcomes${params({ limit, days })}`),
    fetchJson(`/api/shadow/candidates${params({ limit, days })}`),
    fetchRows(`/api/trades/close-history${params({ limit, days })}`),
    fetchRows(`/api/trades/journal${params({ limit, days })}`),
    fetchRows(`/api/research/strategy-evaluation${params({ limit })}`),
    fetchRows(`/api/research/regime-evaluation${params({ limit })}`),
    fetchRows(`/api/research/manual-alpha${params({ limit })}`),
  ]);
  return {
    stats,
    statsLedger,
    shadowSignals,
    shadowOutcomes,
    shadowCandidates,
    closeHistory,
    tradeJournal,
    strategyEvaluation,
    regimeEvaluation,
    manualAlpha,
  };
}

export async function reloadWorkspace(key, query = {}) {
  if (key === 'dashboard') return loadDashboardWorkspace(query);
  if (key === 'mt5') return loadMt5Workspace(query);
  if (key === 'governance') return loadGovernanceWorkspace(query);
  if (key === 'paramlab') return loadParamLabWorkspace(query);
  if (key === 'research') return loadResearchWorkspace(query);
  return null;
}
