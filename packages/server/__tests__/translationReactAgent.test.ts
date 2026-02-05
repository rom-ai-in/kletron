import { describe, it, expect } from 'vitest';
import {
  TranslationAgentOutputSchema,
  computeChangedLocales,
  type TranslationAgentRowInput,
} from '@numezis/server/services/translationReactAgent';

describe('translationReactAgent', () => {
  it('validates a minimal agent output payload', () => {
    const parsed = TranslationAgentOutputSchema.parse({
      recommendations: [
        {
          rowKey: 'about.about_cta_primary',
          decision: 'KEEP',
          confidence: 0.5,
          rationale: 'Already good.',
        },
      ],
    });
    expect(parsed.recommendations).toHaveLength(1);
    expect(parsed.recommendations[0].rowKey).toBe('about.about_cta_primary');
  });

  it('rejects invalid confidence', () => {
    expect(() =>
      TranslationAgentOutputSchema.parse({
        recommendations: [
          {
            rowKey: 'x.y',
            decision: 'KEEP',
            confidence: 1.2,
            rationale: 'nope',
          },
        ],
      })
    ).toThrow();
  });

  it('computes changed locales from proposed values', () => {
    const row: TranslationAgentRowInput = {
      rowKey: 'ns.key',
      namespace: 'ns',
      key: 'key',
      source_file: 'packages/i18n/messages/ns/en.json',
      context_usage: 'app/page.tsx',
      status: 'active',
      en: 'Hello',
      de: 'Hallo',
      fr: 'Bonjour',
      it: 'Ciao',
    };

    const changed = computeChangedLocales(row, { en: 'Hello', de: 'Guten Tag', fr: 'Bonjour', it: 'Ciao!!' });
    expect(changed).toEqual(['de', 'it']);
  });
});

