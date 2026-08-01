import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  buildBacktestTelegramMessage,
  runBacktestAiCycle,
  summarizeBacktest,
} from '../src/services/backtestAiApi.js';

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

test('one-click cycle calls read-only backtest, AI monitor, and Telegram push endpoint', async () => {
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
      return jsonResponse({ ok: true, sent: true });
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
  assert.deepEqual(JSON.parse(calls[1].options.body).symbols, ['USDJPYc']);
  assert.equal(JSON.parse(calls[2].options.body).eventType, 'BACKTEST_AI');
  assert.equal(result.backtest._api.method, 'GET');
  assert.equal(result.ai._api.method, 'POST');
  assert.equal(result.notify._api.method, 'POST');
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

test('Telegram digest keeps the safety boundary visible', () => {
  const message = buildBacktestTelegramMessage({
    symbols: ['EURUSDc'],
    backtest: {
      summary: { taskCount: 1, cautionCount: 1, readyCount: 0, topRouteKey: 'BB_Triple' },
      rows: [{ routeKey: 'BB_Triple', symbol: 'EURUSDc', timeframe: 'H1', profitFactor: 0.8 }],
    },
    ai: {
      items: [
        {
          deepseek: { advice: { verdict: '继续模拟观察', headline: 'PF 未达标，暂不升实盘' } },
        },
      ],
    },
  });

  assert.match(message, /AI 回测闭环完成/);
  assert.match(message, /候选明细/);
  assert.match(message, /Telegram只推送/);
  assert.match(message, /不下单、不平仓、不撤单/);
});
