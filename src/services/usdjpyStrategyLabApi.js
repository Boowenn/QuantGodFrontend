import { fetchJson, postCommandJson } from './apiClient.js';

const BASE = '/api/usdjpy-strategy-lab';

function fetchUSDJPYLabJson(path, options = {}) {
  return fetchJson(path, null, options);
}

function postUSDJPYLabJson(path, payload = {}, options = {}) {
  return postCommandJson(path, payload, options);
}

function optionalQuery(query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== false && value !== '')
      params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function fetchUSDJPYStrategyLabStatus() {
  return fetchUSDJPYLabJson(`${BASE}/status`);
}

export function fetchUSDJPYStrategyCatalog() {
  return fetchUSDJPYLabJson(`${BASE}/catalog`);
}

export function fetchUSDJPYStrategySignals({ limit = 20 } = {}) {
  return fetchUSDJPYLabJson(`${BASE}/signals?limit=${encodeURIComponent(limit)}`);
}

export function runUSDJPYStrategySignals() {
  return postUSDJPYLabJson(`${BASE}/signals/run`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYStrategyBacktestPlan() {
  return fetchUSDJPYLabJson(`${BASE}/backtest-plan`);
}

export function buildUSDJPYStrategyBacktestPlan() {
  return postUSDJPYLabJson(`${BASE}/backtest-plan/build`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYImportedBacktests({ limit = 20 } = {}) {
  return fetchUSDJPYLabJson(`${BASE}/imported-backtests?limit=${encodeURIComponent(limit)}`);
}

export function importUSDJPYBacktest({ source, strategy = '' }) {
  return postUSDJPYLabJson(`${BASE}/import-backtest`, { source, strategy, focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYStrategyRiskCheck() {
  return fetchUSDJPYLabJson(`${BASE}/risk-check`);
}

export function fetchUSDJPYCandidatePolicy() {
  return fetchUSDJPYLabJson(`${BASE}/candidate-policy`);
}

export function buildUSDJPYCandidatePolicy() {
  return postUSDJPYLabJson(`${BASE}/candidate-policy/build`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYStrategyLabTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/telegram-text${query}`);
}

export function runUSDJPYStrategyLab() {
  return postUSDJPYLabJson(`${BASE}/run`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYStrategyDryRun() {
  return fetchUSDJPYLabJson(`${BASE}/dry-run`);
}

export function fetchUSDJPYLiveLoop({ write = false } = {}) {
  const query = write ? '?write=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/live-loop${query}`);
}

export function runUSDJPYLiveLoop() {
  return postUSDJPYLabJson(`${BASE}/live-loop/run`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYLiveLoopTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/live-loop/telegram-text${query}`);
}

export function fetchUSDJPYEvolutionStatus(options = {}) {
  return fetchUSDJPYLabJson(`${BASE}/evolution/status`, options);
}

export function runUSDJPYEvolutionBuild() {
  return postUSDJPYLabJson(`${BASE}/evolution/build`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYReplayReport({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/evolution/replay${query}`);
}

export function runUSDJPYReplayReport() {
  return postUSDJPYLabJson(`${BASE}/evolution/replay`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYParamTuning({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/evolution/tune${query}`);
}

export function runUSDJPYParamTuning() {
  return postUSDJPYLabJson(`${BASE}/evolution/tune`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYConfigProposal({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/evolution/proposal${query}`);
}

export function runUSDJPYConfigProposal() {
  return postUSDJPYLabJson(`${BASE}/evolution/proposal`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYEvolutionTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/evolution/telegram-text${query}`);
}

export function fetchUSDJPYBarReplayStatus({ refresh = false } = {}, options = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/bar-replay/status${query}`, options);
}

export function runUSDJPYBarReplayBuild() {
  return postUSDJPYLabJson(`${BASE}/bar-replay/build`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYBarReplayEntry({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/bar-replay/entry${query}`);
}

export function fetchUSDJPYBarReplayExit({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/bar-replay/exit${query}`);
}

export function fetchUSDJPYBarReplayTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/bar-replay/telegram-text${query}`);
}

export function fetchUSDJPYWalkForwardStatus({ refresh = false } = {}, options = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/walk-forward/status${query}`, options);
}

export function runUSDJPYWalkForwardBuild() {
  return postUSDJPYLabJson(`${BASE}/walk-forward/build`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYWalkForwardSelection({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/walk-forward/selection${query}`);
}

export function fetchUSDJPYWalkForwardProposal({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/walk-forward/proposal${query}`);
}

export function fetchUSDJPYWalkForwardTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/walk-forward/telegram-text${query}`);
}

export function fetchUSDJPYAutonomousAgent({ refresh = false } = {}, options = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/state${query}`, options);
}

export function runUSDJPYAutonomousAgent() {
  return postUSDJPYLabJson(`${BASE}/autonomous-agent/run`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYAutonomousDecision({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/decision${query}`);
}

export function fetchUSDJPYAutonomousPatch({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/patch${query}`);
}

export function fetchUSDJPYAutonomousLifecycle({ refresh = false } = {}, options = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/lifecycle${query}`, options);
}

export function fetchUSDJPYAutonomousLanes({ refresh = false } = {}, options = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/lanes${query}`, options);
}

export function fetchUSDJPYMt5ShadowLane({ refresh = false } = {}, options = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/mt5-shadow${query}`, options);
}

export function fetchUSDJPYEaReproducibility({ refresh = false } = {}, options = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/ea-repro${query}`, options);
}

export function fetchUSDJPYDailyAutopilotV2({ refresh = false } = {}, options = {}) {
  const query = optionalQuery({ refresh: refresh ? '1' : '' });
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/daily-autopilot-v2${query}`, options);
}

export function runUSDJPYDailyAutopilotV2() {
  return postUSDJPYLabJson(`${BASE}/autonomous-agent/daily-autopilot-v2/run`, {
    focusSymbol: 'USDJPYc',
  });
}

export function fetchUSDJPYDailyAutopilotV2TelegramText({ refresh = false } = {}) {
  const query = optionalQuery({ refresh: refresh ? '1' : '' });
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/daily-autopilot-v2/telegram-text${query}`);
}

export function fetchUSDJPYAgentDailyTodo({ refresh = false } = {}, options = {}) {
  const query = optionalQuery({ refresh: refresh ? '1' : '' });
  return fetchUSDJPYLabJson(`${BASE}/daily-todo${query}`, options);
}

export function runUSDJPYAgentDailyTodo() {
  return postUSDJPYLabJson(`${BASE}/daily-todo/run`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYAgentDailyTodoTelegramText({ refresh = false } = {}) {
  const query = optionalQuery({ refresh: refresh ? '1' : '' });
  return fetchUSDJPYLabJson(`${BASE}/daily-todo/telegram-text${query}`);
}

export function fetchUSDJPYAgentDailyReview({ refresh = false } = {}, options = {}) {
  const query = optionalQuery({ refresh: refresh ? '1' : '' });
  return fetchUSDJPYLabJson(`${BASE}/daily-review${query}`, options);
}

export function runUSDJPYAgentDailyReview() {
  return postUSDJPYLabJson(`${BASE}/daily-review/run`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYAgentDailyReviewTelegramText({ refresh = false } = {}) {
  const query = optionalQuery({ refresh: refresh ? '1' : '' });
  return fetchUSDJPYLabJson(`${BASE}/daily-review/telegram-text${query}`);
}

export function fetchUSDJPYAutonomousTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/autonomous-agent/telegram-text${query}`);
}

export function fetchUSDJPYGAStatus({ write = false } = {}, options = {}) {
  const query = write ? '?write=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/ga/status${query}`, options);
}

export function runUSDJPYGAGeneration() {
  return postUSDJPYLabJson(`${BASE}/ga/run-generation`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYGAGenerations() {
  return fetchUSDJPYLabJson(`${BASE}/ga/generations`);
}

export function fetchUSDJPYGACandidates(options = {}) {
  return fetchUSDJPYLabJson(`${BASE}/ga/candidates`, options);
}

export function fetchUSDJPYGACandidate(seedId, options = {}) {
  return fetchUSDJPYLabJson(`${BASE}/ga/candidate/${encodeURIComponent(seedId)}`, options);
}

export function fetchUSDJPYGAEvolutionPath(options = {}) {
  return fetchUSDJPYLabJson(`${BASE}/ga/evolution-path`, options);
}

export function fetchUSDJPYGABlockers(options = {}) {
  return fetchUSDJPYLabJson(`${BASE}/ga/blockers`, options);
}

export function fetchUSDJPYGATelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/ga/telegram-text${query}`);
}

export function fetchUSDJPYStrategyContractStatus({ write = false } = {}, options = {}) {
  const query = write ? '?write=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/strategy-contract/status${query}`, options);
}

export function buildUSDJPYStrategyContract() {
  return postUSDJPYLabJson(`${BASE}/strategy-contract/build`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYStrategyContractTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/strategy-contract/telegram-text${query}`);
}

export function fetchUSDJPYStrategyBacktestStatus(options = {}) {
  return fetchUSDJPYLabJson(`${BASE}/strategy-backtest/status`, options);
}

export function fetchUSDJPYStrategyBacktestProductionStatus(options = {}) {
  return fetchUSDJPYLabJson(`${BASE}/strategy-backtest/production-status`, options);
}

export function seedUSDJPYStrategyBacktest({ overwrite = false } = {}) {
  const query = overwrite ? '?overwrite=1' : '';
  return postUSDJPYLabJson(`${BASE}/strategy-backtest/sample${query}`, { focusSymbol: 'USDJPYc' });
}

export function runUSDJPYStrategyBacktest() {
  return postUSDJPYLabJson(`${BASE}/strategy-backtest/run`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYStrategyBacktestTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/strategy-backtest/telegram-text${query}`);
}

export function syncUSDJPYStrategyBacktestKlines() {
  return postUSDJPYLabJson(`${BASE}/strategy-backtest/sync-klines`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYEvidenceOSStatus(options = {}) {
  return fetchUSDJPYLabJson(`${BASE}/evidence-os/status`, options);
}

export function runUSDJPYEvidenceOS() {
  return postUSDJPYLabJson(`${BASE}/evidence-os/run`, { focusSymbol: 'USDJPYc' });
}

export function fetchUSDJPYEvidenceOSParity() {
  return fetchUSDJPYLabJson(`${BASE}/evidence-os/parity`);
}

export function fetchUSDJPYExecutionFeedback() {
  return fetchUSDJPYLabJson(`${BASE}/evidence-os/execution-feedback`);
}

export function fetchUSDJPYCaseMemory() {
  return fetchUSDJPYLabJson(`${BASE}/evidence-os/case-memory`);
}

export function fetchUSDJPYEvidenceOSTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchUSDJPYLabJson(`${BASE}/evidence-os/telegram-text${query}`);
}

export function fetchUSDJPYTelegramGatewayStatus(options = {}) {
  return fetchUSDJPYLabJson(`${BASE}/telegram-gateway/status`, options);
}

export function enqueueUSDJPYTelegramGatewayTest({ text = '' } = {}) {
  return postUSDJPYLabJson(`${BASE}/telegram-gateway/test-event`, {
    focusSymbol: 'USDJPYc',
    text:
      text ||
      '【QuantGod Telegram Gateway 测试】独立 Gateway 已接入队列、去重、限频和投递账本；不会接收交易命令。',
  });
}

export function dispatchUSDJPYTelegramGateway({ send = false, limit = 8 } = {}) {
  return postUSDJPYLabJson(`${BASE}/telegram-gateway/dispatch`, {
    focusSymbol: 'USDJPYc',
    send: Boolean(send),
    dryRun: !send,
    limit,
  });
}

export function fetchUSDJPYAgentOpsHealth({ refresh = false } = {}) {
  const query = optionalQuery({ refresh: refresh ? '1' : '' });
  return fetchUSDJPYLabJson(`${BASE}/agent-ops-health/status${query}`);
}
