import { fetchJson, fetchRows as fetchRowsJson, postCommandJson } from './apiClient.js';

async function loadLegacyDashboardEntries(entries) {
  const results = {};
  await Promise.all(
    entries.map(async ([key, loadEntry]) => {
      try {
        results[key] = await loadEntry();
      } catch (error) {
        results[key] = {
          ok: false,
          error: error?.message || String(error),
          endpointLoadFailed: true,
        };
      }
    }),
  );
  return results;
}

export async function loadDashboardState(query = '') {
  void query;

  const {
    latest,
    state,
    mt5Snapshot,
    secondaryMt5Snapshot,
    governance,
    backtest,
    paramStatus,
    paramResults,
    paramAutoScheduler,
    paramReportWatcher,
    runRecovery,
    autoTesterWindow,
    dailyReview,
    dailyAutopilot,
    mt5ResearchStats,
    strategyRegistry,
    shadowSignalRows,
    shadowOutcomeRows,
    shadowCandidateRows,
    shadowCandidateOutcomeRows,
    closeHistoryRows,
    tradeJournalRows,
    paramLabResultRows,
    paramLabAutoSchedulerRows,
    paramLabReportWatcherRows,
    paramLabRunRecoveryRows,
    autoTesterWindowRows,
    mt5ResearchStatsRows,
    strategyEvaluationRows,
    regimeEvaluationRows,
    tradingAuditRows,
    manualAlphaRows,
  } = await loadLegacyDashboardEntries([
    ['latest', () => fetchJson('/api/latest')],
    ['state', () => fetchJson('/api/dashboard/state')],
    ['mt5Snapshot', () => fetchJson('/api/mt5-readonly/snapshot')],
    ['secondaryMt5Snapshot', () => fetchJson('/api/mt5-readonly-secondary/snapshot')],
    ['governance', () => fetchJson('/api/governance/advisor')],
    ['backtest', () => fetchJson('/api/dashboard/backtest-summary')],
    ['paramStatus', () => fetchJson('/api/paramlab/status')],
    ['paramResults', () => fetchJson('/api/paramlab/results')],
    ['paramAutoScheduler', () => fetchJson('/api/paramlab/scheduler')],
    ['paramReportWatcher', () => fetchJson('/api/paramlab/report-watcher')],
    ['runRecovery', () => fetchJson('/api/paramlab/recovery')],
    ['autoTesterWindow', () => fetchJson('/api/paramlab/tester-window')],
    ['dailyReview', () => fetchJson('/api/daily-review')],
    ['dailyAutopilot', () => fetchJson('/api/daily-autopilot')],
    ['mt5ResearchStats', () => fetchJson('/api/research/stats')],
    ['strategyRegistry', () => fetchJson('/api/governance/version-registry')],
    ['shadowSignalRows', () => fetchRowsJson('/api/shadow/signals?limit=500')],
    ['shadowOutcomeRows', () => fetchRowsJson('/api/shadow/outcomes?limit=500')],
    ['shadowCandidateRows', () => fetchRowsJson('/api/shadow/candidates?limit=500')],
    ['shadowCandidateOutcomeRows', () => fetchRowsJson('/api/shadow/candidate-outcomes?limit=500')],
    ['closeHistoryRows', () => fetchRowsJson('/api/trades/close-history?limit=500')],
    ['tradeJournalRows', () => fetchRowsJson('/api/trades/journal?limit=500')],
    ['paramLabResultRows', () => fetchRowsJson('/api/paramlab/results-ledger?limit=500')],
    ['paramLabAutoSchedulerRows', () => fetchRowsJson('/api/paramlab/scheduler-ledger?limit=500')],
    ['paramLabReportWatcherRows', () => fetchRowsJson('/api/paramlab/report-watcher-ledger?limit=500')],
    ['paramLabRunRecoveryRows', () => fetchRowsJson('/api/paramlab/recovery-ledger?limit=500')],
    ['autoTesterWindowRows', () => fetchRowsJson('/api/paramlab/tester-window-ledger?limit=500')],
    ['mt5ResearchStatsRows', () => fetchRowsJson('/api/research/stats-ledger?limit=500')],
    ['strategyEvaluationRows', () => fetchRowsJson('/api/research/strategy-evaluation?limit=500')],
    ['regimeEvaluationRows', () => fetchRowsJson('/api/research/regime-evaluation?limit=500')],
    ['tradingAuditRows', () => fetchRowsJson('/api/trades/trading-audit?limit=500')],
    ['manualAlphaRows', () => fetchRowsJson('/api/research/manual-alpha?limit=500')],
  ]);

  return {
    mt5: {
      latest,
      state,
      snapshot: mt5Snapshot,
      secondarySnapshot: secondaryMt5Snapshot,
      governance,
      backtest,
      paramStatus,
      paramResults,
      paramAutoScheduler,
      paramReportWatcher,
      runRecovery,
      autoTesterWindow,
      dailyReview,
      dailyAutopilot,
      mt5ResearchStats,
      strategyRegistry,
      ledgers: {
        shadowSignals: shadowSignalRows,
        shadowOutcomes: shadowOutcomeRows,
        shadowCandidates: shadowCandidateRows,
        shadowCandidateOutcomes: shadowCandidateOutcomeRows,
        closeHistory: closeHistoryRows,
        tradeJournal: tradeJournalRows,
        paramLabResults: paramLabResultRows,
        paramLabAutoScheduler: paramLabAutoSchedulerRows,
        paramLabReportWatcher: paramLabReportWatcherRows,
        paramLabRunRecovery: paramLabRunRecoveryRows,
        autoTesterWindow: autoTesterWindowRows,
        mt5ResearchStats: mt5ResearchStatsRows,
        strategyEvaluation: strategyEvaluationRows,
        regimeEvaluation: regimeEvaluationRows,
        tradingAudit: tradingAuditRows,
        manualAlpha: manualAlphaRows,
      },
    },
  };
}

export async function evaluateAutoTesterWindow(payload = {}) {
  return postCommandJson('/api/paramlab/auto-tester/evaluate', payload);
}

export async function createAutoTesterLock(payload = {}) {
  return postCommandJson('/api/paramlab/auto-tester/lock', payload);
}

export async function startAutoTesterWindow(payload = {}) {
  return postCommandJson('/api/paramlab/auto-tester/run', payload);
}
