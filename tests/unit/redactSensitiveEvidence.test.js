import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_REDACTION_MARKERS,
  redactSensitiveEvidence,
} from '../../src/utils/redactSensitiveEvidence.js';

describe('redactSensitiveEvidence', () => {
  it('deeply redacts account identity, server, and secret fields without mutating evidence', () => {
    const evidence = {
      account: {
        login: '90000001',
        number: 90000001,
        name: 'Synthetic Operator',
        server: 'SyntheticBroker-Primary',
        balance: 100,
      },
      nested: [
        {
          accountId: '90000002',
          clientName: 'Synthetic Client',
          trade_server: 'SyntheticBroker-Secondary',
          credentials: { token: 'do-not-render', password: 'do-not-render' },
        },
      ],
      authorization: 'Bearer do-not-render',
    };

    const redacted = redactSensitiveEvidence(evidence);

    expect(redacted).toMatchObject({
      account: {
        login: EVIDENCE_REDACTION_MARKERS.account,
        number: EVIDENCE_REDACTION_MARKERS.account,
        name: EVIDENCE_REDACTION_MARKERS.identity,
        server: EVIDENCE_REDACTION_MARKERS.identity,
        balance: 100,
      },
      nested: [
        {
          accountId: EVIDENCE_REDACTION_MARKERS.account,
          clientName: EVIDENCE_REDACTION_MARKERS.identity,
          trade_server: EVIDENCE_REDACTION_MARKERS.identity,
          credentials: EVIDENCE_REDACTION_MARKERS.secret,
        },
      ],
      authorization: EVIDENCE_REDACTION_MARKERS.secret,
    });
    expect(evidence.account.login).toBe('90000001');
    expect(evidence.account.number).toBe(90000001);
  });

  it('redacts number and id only when they identify an account', () => {
    const redacted = redactSensitiveEvidence({
      account: { number: 90000001, id: 'account-1', balance: 100 },
      metrics: { number: 7, id: 'metric-1' },
    });

    expect(redacted.account).toMatchObject({
      number: EVIDENCE_REDACTION_MARKERS.account,
      id: EVIDENCE_REDACTION_MARKERS.account,
      balance: 100,
    });
    expect(redacted.metrics).toEqual({ number: 7, id: 'metric-1' });
  });

  it('scrubs secrets embedded in diagnostic strings', () => {
    const rendered = JSON.stringify(
      redactSensitiveEvidence({
        error: 'Bearer hidden-value token=hidden-value https://user:pass@example.test/path',
      }),
    );

    expect(rendered).not.toContain('hidden-value');
    expect(rendered).not.toContain('user:pass');
    expect(rendered).toContain(EVIDENCE_REDACTION_MARKERS.secret);
  });

  it('scrubs account and identity fields when a raw JSON string is passed through', () => {
    const rendered = redactSensitiveEvidence(
      '{"login":"90000001","name":"Synthetic Person","server":"Synthetic-Live","token":"hidden-value"}',
    );

    expect(rendered).not.toContain('90000001');
    expect(rendered).not.toContain('Synthetic Person');
    expect(rendered).not.toContain('Synthetic-Live');
    expect(rendered).not.toContain('hidden-value');
    expect(rendered).toContain(EVIDENCE_REDACTION_MARKERS.account);
    expect(rendered).toContain(EVIDENCE_REDACTION_MARKERS.identity);
    expect(rendered).toContain(EVIDENCE_REDACTION_MARKERS.secret);
  });
});
