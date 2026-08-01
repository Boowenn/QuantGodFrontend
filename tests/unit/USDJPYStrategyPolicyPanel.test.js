import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import USDJPYStrategyPolicyPanel from '../../src/components/USDJPYStrategyPolicyPanel.vue';

function response(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

async function mountWithRisk(riskPayload) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (String(url).includes('/risk-check')) return response(riskPayload);
      return response({ ok: true });
    }),
  );
  const wrapper = mount(USDJPYStrategyPolicyPanel);
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('USDJPYStrategyPolicyPanel safety evidence', () => {
  it('blocks when aggregate riskOk is missing even if every child field is true', async () => {
    const wrapper = await mountWithRisk({
      ok: true,
      runtimeOk: true,
      fastlaneOk: true,
      newsOk: true,
      shadowOnly: true,
    });

    expect(wrapper.get('[data-testid="risk-decision"]').text()).toBe('BLOCKED');
    wrapper.unmount();
  });

  it('renders missing safety evidence as UNKNOWN and removes synthetic trading limits', async () => {
    const wrapper = await mountWithRisk({ ok: true, riskOk: true });
    const text = wrapper.text();

    expect(wrapper.get('[data-testid="risk-decision"]').text()).toBe('BLOCKED');
    expect(text).toContain('UNKNOWN');
    expect(text).toContain('研究容量上限 不可用');
    expect(text).toContain('影子建议证据不可用');
    expect(text).not.toContain('2.00');
    expect(text).not.toContain('只允许 RSI_Reversal');
    wrapper.unmount();
  });
});
