import { describe, it, expect } from 'vitest';
import { parseRowKey, toRowKey } from '@numezis/server/services/i18nTranslationsService';

describe('i18nTranslationsService helpers', () => {
  it('parses rowKey into namespace and key', () => {
    expect(parseRowKey('about.about_cta_primary')).toEqual({ namespace: 'about', key: 'about_cta_primary' });
    expect(parseRowKey('access.errors.invalid_portal_context')).toEqual({
      namespace: 'access',
      key: 'errors.invalid_portal_context',
    });
  });

  it('returns null for invalid rowKey', () => {
    expect(parseRowKey('')).toBeNull();
    expect(parseRowKey('noDot')).toBeNull();
    expect(parseRowKey('.leading')).toBeNull();
    expect(parseRowKey('trailing.')).toBeNull();
  });

  it('builds rowKey from namespace/key', () => {
    expect(toRowKey({ namespace: 'ns', key: 'k' })).toBe('ns.k');
  });
});

