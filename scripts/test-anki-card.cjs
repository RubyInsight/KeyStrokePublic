const assert = require('node:assert/strict');
const AnkiCards = require('../anki-card.js');

const first = AnkiCards.parseCloze('The {{c1::mitochondrion::organelle}} makes {{c2::ATP}}.', 0);
assert.equal(first.matched, true);
assert.equal(first.questionHtml, 'The [organelle] makes ATP.');
assert.deepEqual(first.answers, ['mitochondrion']);

const second = AnkiCards.parseCloze('The {{c1::mitochondrion}} makes {{c2::ATP}}.', 1);
assert.equal(second.questionHtml, 'The mitochondrion makes […].');
assert.deepEqual(second.answers, ['ATP']);

const clozeCard = AnkiCards.convertCard({
  ord: 1,
  flds: 'The {{c1::mitochondrion}} makes {{c2::ATP}}.\x1fExtra explanation'
}, { name: 'Cloze+', type: 1, fields: ['Text', 'Back Extra'], templates: ['Cloze'] });
assert.equal(clozeCard.kind, 'cloze');
assert.equal(clozeCard.termHtml, 'The mitochondrion makes […].');
assert.equal(clozeCard.definitionHtml, 'ATP');
assert.equal(clozeCard.answerExtraHtml, 'Extra explanation');

const occlusionHtml = [
  '{{c1::image-occlusion:rect:left=.05:top=.1:width=.15:height=.12:oi=1}}',
  '{{c2::image-occlusion:ellipse:left=.55:top=.1:rx=.1:ry=.08:oi=1}}',
  '{{c3::image-occlusion:polygon:left=.2:top=.3:points=.1,.1 .4,.1 .2,.4:oi=1}}',
  '{{c0::image-occlusion:text:left=.1:top=.8:text=Thorax\\: section}}'
].join('<br>');
const imageCard = AnkiCards.convertCard({
  ord: 2,
  flds: `${occlusionHtml}\x1f<img src="diagram.png">\x1fCell anatomy\x1f\x1f`
}, { name: 'Image Occlusion+', fields: ['Occlusion', 'Image', 'Header', 'Back Extra', 'Comments'], templates: ['Image Occlusion'] });
assert.equal(imageCard.kind, 'image-occlusion');
assert.equal(imageCard.manual, true);
assert.equal(imageCard.termHtml, 'Cell anatomy');
assert.deepEqual(imageCard.termMediaHtml, ['<img src="diagram.png">']);
assert.equal(imageCard.termOcclusions.length, 4);
assert.equal(imageCard.definitionOcclusions.length, 3);
assert.deepEqual(imageCard.termOcclusions.find(shape => shape.ordinal === 3).points.map(point => ({ x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) })), [
  { x: .2, y: .3 }, { x: .5, y: .3 }, { x: .3, y: .6 }
]);
assert.deepEqual(imageCard.termOcclusions.find(shape => shape.shape === 'ellipse'), {
  shape: 'ellipse', ordinal: 2, occludeInactive: true, angle: 0, left: .55, top: .1, width: .2, height: .16
});
assert.equal(imageCard.termOcclusions.find(shape => shape.annotation).text, 'Thorax: section');
assert.equal(imageCard.definitionOcclusions.some(shape => shape.ordinal === 3), false);

const hideOne = AnkiCards.parseImageOcclusionData([
  '{{c1::image-occlusion:rect:left=.1:top=.1:width=.2:height=.2}}',
  '{{c2::image-occlusion:rect:left=.5:top=.5:width=.2:height=.2}}'
].join(''), 0);
assert.deepEqual(hideOne.front.map(shape => shape.ordinal), [1]);
assert.deepEqual(hideOne.back, []);

const basicCard = AnkiCards.convertCard({ ord: 0, flds: 'mitosis\x1fcell division' }, {
  name: 'Basic', fields: ['Front', 'Back'], templates: ['Card 1']
});
assert.equal(basicCard.kind, 'basic');
assert.equal(basicCard.termHtml, 'mitosis');
assert.equal(basicCard.definitionHtml, 'cell division');

const oneFieldCard = AnkiCards.convertCard({ ord: 0, flds: 'single useful field\x1f' }, {
  name: 'Custom', fields: ['Prompt', 'Extra'], templates: ['Card 1']
});
assert.equal(oneFieldCard.manual, true);
assert.equal(oneFieldCard.termHtml, 'single useful field');

const emptyCard = AnkiCards.convertCard({ cid: 404, ord: 0, flds: '\x1f' }, {
  name: 'Unusual', fields: ['Front', 'Back'], templates: ['Card 1']
});
assert.equal(emptyCard.kind, 'empty');
assert.equal(emptyCard.manual, true);
assert.equal(emptyCard.termHtml, 'Anki card 404');

console.log('Anki card conversion checks passed.');
