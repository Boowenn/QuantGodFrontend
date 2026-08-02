import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  buildBacktestTelegramMessage,
  runBacktestAiCycle,
  summarizeBacktest,
} from '../src/services/backtestAiApi.js';
import { TELEGRAM_DIGEST_MAX_CHARS, TELEGRAM_SHADOW_FOOTER } from '../src/utils/telegramStatus.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('summarizes backend backtest evidence in Chinese operator terms', () => {
  const summary = summarizeBacktest({
    ok: true,
    summary: {
      taskCount: 8,
      readyCount: 1,
      cautionCount: 7,
      topCandidateId: 'MA_Cross_EURUSDc_fast',
      topRouteKey: 'MA_Cross',
      topRankScore: 12.34,
    },
  });

  assert.equal(summary.taskCount, 8);
  assert.equal(summary.readyCount, 1);
  assert.equal(summary.topRouteKey, 'MA_Cross');
});

test('explicit backtest push uses exactly one external Telegram delivery endpoint', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('/api/mt5-backtest-loop/run')) {
      return jsonResponse({
        ok: true,
        summary: { taskCount: 2, cautionCount: 1, readyCount: 1, topRouteKey: 'RSI_Reversal' },
        rows: [{ routeKey: 'RSI_Reversal', symbol: 'USDJPYc', profitFactor: 1.21, sampleState: 'READY' }],
      });
    }
    if (String(url) === '/api/ai-analysis/deepseek-telegram/run') {
      return jsonResponse({
        ok: true,
        items: [
          {
            symbol: 'USDJPYc',
            deepseek: { advice: { verdict: '观望，等待确认', headline: 'AI 已完成中文复核' } },
          },
        ],
      });
    }
    if (String(url) === '/api/notify/test') {
      return jsonResponse({
        ok: true,
        sent: true,
        telegramMessageId: 81,
        sentAtIso: '2026-08-01T12:00:00Z',
      });
    }
    return jsonResponse({ ok: false }, 404);
  };

  const result = await runBacktestAiCycle({
    symbols: ['USDJPYc'],
    days: 30,
    maxTasks: 3,
    sendTelegram: true,
    noDeepseek: true,
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].url, '/api/mt5-backtest-loop/run?days=30&maxTasks=3');
  assert.equal(calls[1].url, '/api/ai-analysis/deepseek-telegram/run');
  assert.equal(calls[2].url, '/api/notify/test');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.headers['X-QuantGod-Local'], '1');
  assert.equal(calls[2].options.method, 'POST');
  assert.equal(calls[2].options.headers['X-QuantGod-Local'], '1');
  const aiBody = JSON.parse(calls[1].options.body);
  const notifyBody = JSON.parse(calls[2].options.body);
  assert.deepEqual(aiBody.symbols, ['USDJPYc']);
  assert.equal(aiBody.send, false);
  assert.equal(aiBody.dryRun, true);
  assert.equal(aiBody.force, false);
  assert.equal(aiBody.minIntervalSeconds, 900);
  assert.equal(notifyBody.eventType, 'BACKTEST_AI');
  assert.equal(notifyBody.send, true);
  assert.equal(notifyBody.dryRun, false);
  assert.equal(calls.filter((call) => call.url === '/api/notify/test').length, 1);
  assert.equal(Number(aiBody.send === true) + Number(notifyBody.dryRun === false), 1);
  assert.equal(result.sendTelegramRequested, true);
  assert.equal(result.backtest._api.method, 'GET');
  assert.equal(result.ai._api.method, 'POST');
  assert.equal(result.notify._api.method, 'POST');
});

test('backtest cycle defaults to analysis-only without force or Telegram delivery', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('/api/mt5-backtest-loop/run')) {
      return jsonResponse({ ok: true, rows: [], summary: { taskCount: 0 } });
    }
    if (String(url) === '/api/ai-analysis/deepseek-telegram/run') {
      return jsonResponse({ ok: true, items: [] });
    }
    return jsonResponse({ ok: false, error: 'unexpected_endpoint' }, 404);
  };

  const result = await runBacktestAiCycle();
  const aiCall = calls.find((call) => call.url === '/api/ai-analysis/deepseek-telegram/run');
  const aiBody = JSON.parse(aiCall.options.body);

  assert.deepEqual(
    calls.map((call) => call.url),
    ['/api/mt5-backtest-loop/run?days=180&maxTasks=20', '/api/ai-analysis/deepseek-telegram/run'],
  );
  assert.equal(aiBody.send, false);
  assert.equal(aiBody.dryRun, true);
  assert.equal(aiBody.force, false);
  assert.equal(aiBody.minIntervalSeconds, 900);
  assert.equal(result.sendTelegramRequested, false);
  assert.equal(result.notify, null);
});

test('one-click cycle stops immediately when any command omits explicit ok=true', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('/api/mt5-backtest-loop/run')) {
      return jsonResponse({ status: 'COMPLETED', rows: [] });
    }
    return jsonResponse({ ok: true });
  };

  await assert.rejects(runBacktestAiCycle({ sendTelegram: true }), /did not confirm ok=true/);
  assert.deepEqual(calls, ['/api/mt5-backtest-loop/run?days=180&maxTasks=20']);
});

test('Telegram backtest digest stays compact and preserves the fixed Shadow footer', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    routeKey: `BB_Triple_${'LONG_ROUTE_'.repeat(8)}${index}`,
    symbol: 'USDJPYc',
    timeframe: 'H1',
    profitFactor: 0.8,
    sampleState: 'KEEP_RESEARCH',
    blockers: [`history_sample_${'insufficient_'.repeat(12)}${index}`],
  }));
  const message = buildBacktestTelegramMessage({
    symbols: ['USDJPYc'],
    backtest: {
      generatedAtIso: '2026-08-01T12:00:00Z',
      summary: {
        taskCount: 5,
        cautionCount: 5,
        readyCount: 0,
        topRouteKey: `BB_Triple_${'LONG_ROUTE_'.repeat(8)}`,
      },
      rows,
    },
    ai: {
      items: [
        {
          deepseek: {
            advice: {
              verdict: '继续模拟观察',
              headline: `PF 未达标，${'继续收集样本。'.repeat(40)}`,
            },
          },
        },
      ],
    },
  });
  const lines = message.split('\n');

  assert.match(message, /QuantGod · AI 回测状态/);
  assert.equal(lines[1].startsWith('结论：'), true);
  assert.equal(lines.length >= 6 && lines.length <= 8, true);
  assert.equal(message.length <= TELEGRAM_DIGEST_MAX_CHARS, true);
  assert.equal(lines.at(-1), TELEGRAM_SHADOW_FOOTER);
  assert.doesNotMatch(message, /候选明细/);
});
