/**
 * Selection logic for AffiliateSuggestion — pure so it can be unit-tested
 * (tests/affiliates.test.ts) without rendering.
 */
import { type AffiliateConfig, type AffiliateSuggestionItem } from '~/config/affiliates';

/** Max suggestion cards rendered in the end-of-article slot. */
export const MAX_SUGGESTIONS = 2;

/**
 * Pick the suggestions to render for an article. An item with no
 * `categories` (or an empty list) matches every article; otherwise the
 * article's category must be listed.
 */
export function pickSuggestions(
  config: AffiliateConfig,
  category?: string,
  max: number = MAX_SUGGESTIONS,
): AffiliateSuggestionItem[] {
  return config.suggestions
    .filter(
      (item) =>
        !item.categories ||
        item.categories.length === 0 ||
        (category !== undefined && item.categories.includes(category)),
    )
    .slice(0, max);
}
