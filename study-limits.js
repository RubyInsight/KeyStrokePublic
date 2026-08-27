(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KeystrokeStudyLimits = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function normalizeLimit(value) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) ? Math.min(9999, Math.max(0, number)) : 0;
  }

  function idsFor(day, category) {
    const field = category === 'new' ? 'newCardIds' : 'reviewCardIds';
    return Array.isArray(day?.[field]) ? day[field].map(String) : [];
  }

  function usedCount(day, category) {
    const ids = idsFor(day, category);
    if (ids.length) return new Set(ids).size;
    const field = category === 'new' ? 'newReviewed' : 'reviewReviewed';
    return Math.max(0, Number(day?.[field]) || 0);
  }

  function categoryFor(card, review, key, day = {}) {
    const normalizedKey = String(key || '');
    if (idsFor(day, 'new').includes(normalizedKey)) return 'new';
    if (idsFor(day, 'review').includes(normalizedKey)) return 'review';
    return review ? 'review' : 'new';
  }

  function selectDue(cards, options) {
    const now = Number(options.now) || Date.now();
    const day = options.day || {};
    const newLimit = normalizeLimit(options.newLimit);
    const reviewLimit = normalizeLimit(options.reviewLimit);
    const newUsed = usedCount(day, 'new');
    const reviewUsed = usedCount(day, 'review');
    const countedNew = new Set(idsFor(day, 'new'));
    const countedReviews = new Set(idsFor(day, 'review'));
    let newRemaining = newLimit ? Math.max(0, newLimit - newUsed) : Infinity;
    let reviewRemaining = reviewLimit ? Math.max(0, reviewLimit - reviewUsed) : Infinity;
    const entries = [];
    const totals = { new: 0, review: 0 };
    const selected = { new: 0, review: 0 };

    for (const card of cards || []) {
      const review = options.getReview(card);
      if (review && Number(review.dueAt) > now) continue;
      const key = String(options.getKey(card));
      const category = categoryFor(card, review, key, day);
      totals[category]++;
      const alreadyCounted = (category === 'new' ? countedNew : countedReviews).has(key);
      const remaining = category === 'new' ? newRemaining : reviewRemaining;
      if (!alreadyCounted && remaining <= 0) continue;
      entries.push({ card, key, category, alreadyCounted });
      selected[category]++;
      if (!alreadyCounted && Number.isFinite(remaining)) {
        if (category === 'new') newRemaining--;
        else reviewRemaining--;
      }
    }

    return {
      entries,
      totalDue: totals.new + totals.review,
      newDue: totals.new,
      reviewDue: totals.review,
      newSelected: selected.new,
      reviewSelected: selected.review,
      limited: selected.new < totals.new || selected.review < totals.review,
      newUsed,
      reviewUsed
    };
  }

  function record(day, { key, category, correct }) {
    const next = day || {};
    next.reviewed = Math.max(0, Number(next.reviewed) || 0) + 1;
    next.correct = Math.max(0, Number(next.correct) || 0) + (correct ? 1 : 0);
    if (!['new', 'review'].includes(category) || !key) return next;
    const field = category === 'new' ? 'newCardIds' : 'reviewCardIds';
    const ids = new Set(idsFor(next, category));
    ids.add(String(key));
    next[field] = [...ids];
    next[category === 'new' ? 'newReviewed' : 'reviewReviewed'] = ids.size;
    return next;
  }

  return { categoryFor, normalizeLimit, record, selectDue, usedCount };
});
