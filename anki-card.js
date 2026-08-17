(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KeystrokeAnkiCards = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function visibleText(value) {
    return String(value || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<img\b[^>]*>/gi, ' image ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function parseCloze(html, cardOrdinal) {
    const target = Number(cardOrdinal) + 1;
    const answers = [];
    let matched = false;
    const questionHtml = String(html || '').replace(/\{\{c(\d+)::([\s\S]*?)(?:::(.*?))?\}\}/gi,
      (whole, number, answer, hint) => {
        if (Number(number) !== target) return answer;
        matched = true;
        answers.push(answer);
        return `[${visibleText(hint) || '…'}]`;
      });
    return { target, matched, questionHtml, answers };
  }

  function finiteFraction(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : null;
  }

  function splitShapeSegments(value) {
    const segments = [];
    let current = '';
    let escaped = false;
    for (const character of String(value || '')) {
      if (escaped) { current += character; escaped = false; }
      else if (character === '\\') escaped = true;
      else if (character === ':') { segments.push(current); current = ''; }
      else current += character;
    }
    segments.push(current);
    return segments;
  }

  function shapeFromToken(token, ordinal) {
    const segments = splitShapeSegments(token);
    const shape = (segments.shift() || 'rect').toLowerCase();
    const values = {};
    for (const segment of segments) {
      const separator = segment.indexOf('=');
      if (separator > 0) values[segment.slice(0, separator)] = segment.slice(separator + 1);
    }
    const left = finiteFraction(values.left);
    const top = finiteFraction(values.top);
    const angle = Number(values.angle);
    const common = {
      shape,
      ordinal: Number(ordinal),
      occludeInactive: values.oi === '1',
      angle: Number.isFinite(angle) ? angle : 0
    };

    if (shape === 'text') {
      if (left == null || top == null || !values.text) return null;
      return { ...common, left, top, text: values.text, annotation: true };
    }
    if (shape === 'polygon') {
      const points = String(values.points || '').split(/\s+/).map(pair => {
        const [x, y] = pair.split(',').map(finiteFraction);
        return x == null || y == null ? null : { x, y };
      }).filter(Boolean);
      if (left == null || top == null || points.length < 3) return null;
      const minX = Math.min(...points.map(point => point.x));
      const minY = Math.min(...points.map(point => point.y));
      return { ...common, left: 0, top: 0, width: 1, height: 1, points: points.map(point => ({ x: point.x + left - minX, y: point.y + top - minY })) };
    }

    let width = finiteFraction(values.width);
    let height = finiteFraction(values.height);
    if (shape === 'ellipse') {
      const rx = finiteFraction(values.rx);
      const ry = finiteFraction(values.ry);
      if (width == null && rx != null) width = Math.min(1, rx * 2);
      if (height == null && ry != null) height = Math.min(1, ry * 2);
    }
    if ([left, top, width, height].some(value => value == null)) return null;
    return { ...common, left, top, width, height };
  }

  function parseImageOcclusionData(html, cardOrdinal) {
    const target = Number(cardOrdinal) + 1;
    const shapes = [];
    const pattern = /\{\{c(\d+)::image-occlusion:([^}]+)\}\}/gi;
    for (const match of String(html || '').matchAll(pattern)) {
      const shape = shapeFromToken(match[2], match[1]);
      if (shape) shapes.push(shape);
    }
    const annotations = shapes.filter(shape => shape.annotation);
    const masks = shapes.filter(shape => !shape.annotation);
    const active = masks.filter(shape => shape.ordinal === target);
    const inactive = masks.filter(shape => shape.ordinal !== target && shape.occludeInactive);
    return {
      front: [...annotations, ...active, ...inactive],
      back: [...annotations, ...inactive],
      active,
      inactive,
      target
    };
  }

  function parseImageOcclusions(html, cardOrdinal) {
    return parseImageOcclusionData(html, cardOrdinal).active;
  }

  function namedIndex(names, pattern) {
    return names.findIndex(name => pattern.test(String(name || '').trim()));
  }

  function usableIndexes(fields) {
    return fields.map((field, index) => visibleText(field) ? index : -1).filter(index => index >= 0);
  }

  function convertCard(row, noteType = {}) {
    const fields = String(row.flds || '').split('\x1f');
    const names = Array.isArray(noteType.fields) ? noteType.fields : [];
    const typeName = String(noteType.name || '');
    const target = Number(row.ord || 0) + 1;
    const clozeField = fields.findIndex(field => /\{\{c\d+::/i.test(field));
    const occlusionField = fields.findIndex(field => /image-occlusion:/i.test(field));

    if (occlusionField >= 0 || /image occlusion/i.test(typeName)) {
      let imageField = namedIndex(names, /^image$/i);
      if (imageField < 0) imageField = fields.findIndex(field => /<img\b/i.test(field));
      const headerField = namedIndex(names, /^(header|question|prompt)$/i);
      const extraIndexes = names.map((name, index) => /^(back extra|comments?|extra)$/i.test(name) ? index : -1).filter(index => index >= 0);
      const extra = extraIndexes.map(index => fields[index]).filter(visibleText).join('<br><br>');
      const imageHtml = imageField >= 0 ? fields[imageField] : '';
      const header = headerField >= 0 ? fields[headerField] : '';
      const occlusions = parseImageOcclusionData(fields[occlusionField] || '', row.ord);
      return {
        kind: 'image-occlusion',
        manual: true,
        termHtml: visibleText(header) ? header : `Image occlusion ${target}`,
        definitionHtml: visibleText(extra) ? extra : 'Check the revealed image.',
        answerExtraHtml: '',
        termMediaHtml: [imageHtml],
        definitionMediaHtml: [imageHtml, extra],
        termOcclusions: occlusions.front,
        definitionOcclusions: occlusions.back
      };
    }

    if (clozeField >= 0 || /cloze/i.test(typeName) || Number(noteType.type) === 1) {
      const textField = namedIndex(names, /^text$/i);
      const sourceIndex = textField >= 0 ? textField : Math.max(0, clozeField);
      const parsed = parseCloze(fields[sourceIndex], row.ord);
      const extras = fields.filter((field, index) => index !== sourceIndex && visibleText(field));
      if (parsed.matched && parsed.answers.length) {
        return {
          kind: 'cloze',
          manual: false,
          termHtml: parsed.questionHtml,
          definitionHtml: parsed.answers.join('<br>'),
          answerExtraHtml: extras.join('<br><br>'),
          termMediaHtml: [parsed.questionHtml],
          definitionMediaHtml: [fields[sourceIndex], ...extras],
          termOcclusions: [],
          definitionOcclusions: []
        };
      }
    }

    const usable = usableIndexes(fields);
    if (!usable.length) {
      return {
        kind: 'empty',
        manual: true,
        termHtml: `Anki card ${row.cid || target}`,
        definitionHtml: 'This Anki card has no visible text or supported image.',
        answerExtraHtml: '',
        termMediaHtml: fields,
        definitionMediaHtml: fields,
        termOcclusions: [],
        definitionOcclusions: []
      };
    }
    let front = namedIndex(names, /^(front|question|term|word|prompt)$/i);
    let back = namedIndex(names, /^(back|answer|definition|meaning)$/i);
    if (front < 0 || !visibleText(fields[front])) front = usable[0];
    if (back < 0 || back === front || !visibleText(fields[back])) back = usable.find(index => index !== front) ?? -1;
    let manual = false;
    if (back < 0) {
      back = front;
      manual = true;
    }
    const templateName = String(noteType.templates?.[Number(row.ord)] || '');
    if (Number(row.ord) > 0 && /reverse|back.*front/i.test(`${typeName} ${templateName}`)) {
      [front, back] = [back, front];
    }
    const extraIndexes = usable.filter(index => index !== front && index !== back);
    return {
      kind: 'basic',
      manual,
      termHtml: fields[front],
      definitionHtml: fields[back],
      answerExtraHtml: extraIndexes.map(index => fields[index]).join('<br><br>'),
      termMediaHtml: [fields[front]],
      definitionMediaHtml: [fields[back], ...extraIndexes.map(index => fields[index])],
      termOcclusions: [],
      definitionOcclusions: []
    };
  }

  return { convertCard, parseCloze, parseImageOcclusions, parseImageOcclusionData, visibleText, unique };
});
