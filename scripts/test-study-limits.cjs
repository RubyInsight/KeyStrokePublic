const assert = require('node:assert/strict');
const Limits = require('../study-limits.js');

const cards = Array.from({ length: 8 }, (_, index) => ({ id: String(index + 1) }));
const reviews = new Map([
  ['6', { dueAt: 100 }],
  ['7', { dueAt: 100 }],
  ['8', { dueAt: 1000 }]
]);
const options = {
  now: 500,
  newLimit: 3,
  reviewLimit: 1,
  day: {},
  getReview: card => reviews.get(card.id),
  getKey: card => card.id
};

const limited = Limits.selectDue(cards, options);
assert.equal(limited.totalDue, 7);
assert.equal(limited.newDue, 5);
assert.equal(limited.reviewDue, 2);
assert.equal(limited.newSelected, 3);
assert.equal(limited.reviewSelected, 1);
assert.equal(limited.entries.length, 4);
assert.equal(limited.limited, true);

let day = Limits.record({}, { key: '1', category: 'new', correct: true });
day = Limits.record(day, { key: '1', category: 'new', correct: false });
day = Limits.record(day, { key: '6', category: 'review', correct: true });
assert.equal(day.reviewed, 3);
assert.equal(day.correct, 2);
assert.equal(day.newReviewed, 1);
assert.equal(day.reviewReviewed, 1);

const afterStudy = Limits.selectDue(cards, { ...options, day, newLimit: 2, reviewLimit: 1 });
assert.equal(afterStudy.entries.some(entry => entry.key === '1'), true, 'A same-day learning repeat should not be hidden by the limit.');
assert.equal(afterStudy.entries.some(entry => entry.key === '6'), true, 'A same-day review repeat should not be hidden by the limit.');
assert.equal(afterStudy.newSelected, 2);
assert.equal(afterStudy.reviewSelected, 1);

const unlimited = Limits.selectDue(cards, { ...options, newLimit: 0, reviewLimit: 0 });
assert.equal(unlimited.entries.length, 7);
assert.equal(unlimited.limited, false);

assert.equal(Limits.normalizeLimit(-4), 0);
assert.equal(Limits.normalizeLimit('25.9'), 25);
assert.equal(Limits.normalizeLimit(50000), 9999);
assert.equal(Limits.categoryFor(cards[0], null, '1', day), 'new');
assert.equal(Limits.categoryFor(cards[5], reviews.get('6'), '6', day), 'review');

console.log('Daily study limit checks passed.');
