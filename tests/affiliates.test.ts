/**
 * pickSuggestions tests — the AffiliateSuggestion slot's selection logic.
 */
import { describe, expect, test } from 'vitest';
import { pickSuggestions } from '~/lib/affiliates';
import { type AffiliateConfig } from '~/config/affiliates';

const config: AffiliateConfig = {
  suggestions: [
    { url: 'https://store.example/anvil', title: 'Anvil Quest on Steam' },
    { url: 'https://gear.example/mouse', title: 'Gaming mouse', categories: ['guides'] },
    { url: 'https://codes.example', title: 'Code tracker', categories: [] },
    { url: 'https://extra.example', title: 'Never reached' },
  ],
};

describe('pickSuggestions', () => {
  test('empty config renders nothing (out-of-box contract)', () => {
    expect(pickSuggestions({ suggestions: [] }, 'guides')).toEqual([]);
  });

  test('items without categories match every article', () => {
    const picks = pickSuggestions(config, 'bosses');
    expect(picks.map((p) => p.title)).toEqual(['Anvil Quest on Steam', 'Code tracker']);
  });

  test('category-scoped items only match their categories', () => {
    const picks = pickSuggestions(config, 'guides');
    expect(picks.some((p) => p.title === 'Gaming mouse')).toBe(true);
  });

  test('caps at 2 suggestions', () => {
    const big: AffiliateConfig = {
      suggestions: [1, 2, 3, 4, 5].map((i) => ({ url: `https://x/${i}`, title: `T${i}` })),
    };
    expect(pickSuggestions(big, 'guides')).toHaveLength(2);
  });
});
