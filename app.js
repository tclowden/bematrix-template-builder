const form = document.getElementById('template-form');
const summaryEl = document.getElementById('summary');
const previewWrapEl = document.getElementById('preview-wrap');
const previewSubtitleEl = document.getElementById('preview-subtitle');
const warningsEl = document.getElementById('warnings');
const outputNotesEl = document.getElementById('output-notes');
const downloadSvgBtn = document.getElementById('download-svg');
const downloadIllustratorBtn = document.getElementById('download-illustrator');
const statTemplate = document.getElementById('stat-template');
const segmentRowTemplate = document.getElementById('segment-row-template');
const widthRowsEl = document.getElementById('width-rows');
const heightRowsEl = document.getElementById('height-rows');
const addWidthBtn = document.getElementById('add-width');
const addHeightBtn = document.getElementById('add-height');

const INCH_TO_PX = 96;
const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;
const HARD_PANEL_REDUCTION_MM = 7;
const BEMATRIX_SIZES_MM = [62, 248, 434, 496, 558, 620, 992, 1984, 2419, 2976];

let currentSvgMarkup = '';
let currentIllustratorScript = '';
let currentFilename = 'bematrix-template.svg';
let currentIllustratorFilename = 'bematrix-template.jsx';

function mmToInches(mm) { return mm / MM_PER_INCH; }
function inchesToMm(inches) { return inches * MM_PER_INCH; }
function sourceToMm(value, unit) { return unit === 'in' ? inchesToMm(value) : value; }
function mmToPx(mm) { return mmToInches(mm) * INCH_TO_PX; }
function inchesToPx(inches) { return inches * INCH_TO_PX; }

function formatInches(value, decimals = 3) {
  const fixed = value.toFixed(decimals);
  if (decimals === 2) return `${fixed}"`;
  return `${fixed.replace(/\.000$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}"`;
}

function formatMm(value, decimals = 1) {
  return `${value.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')} mm`;
}

function formatOutput(valueInches, valueMm, unit) {
  return unit === 'mm' ? formatMm(valueMm, 1) : formatInches(valueInches, 2);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'template';
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cumulative(values) {
  const points = [];
  let running = 0;
  values.forEach((value) => {
    running += value;
    points.push(running);
  });
  return points;
}

function createSegmentRow(container, value = 992) {
  const row = segmentRowTemplate.content.firstElementChild.cloneNode(true);
  const select = row.querySelector('.segment-select');
  BEMATRIX_SIZES_MM.forEach((size) => {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = `${size} mm`;
    if (size === value) option.selected = true;
    select.appendChild(option);
  });
  row.querySelector('.remove-button').addEventListener('click', () => {
    if (container.children.length === 1) {
      select.value = '992';
      return;
    }
    row.remove();
  });
  container.appendChild(row);
}

function ensureStarterRows() {
  if (!widthRowsEl.children.length) createSegmentRow(widthRowsEl, 992);
  if (!heightRowsEl.children.length) createSegmentRow(heightRowsEl, 992);
}

function readSegmentRows(container, axisName, inputUnit) {
  const values = Array.from(container.querySelectorAll('.segment-select')).map((select) => Number(select.value));
  if (!values.length) throw new Error(`${axisName} sections are required.`);
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error(`${axisName} sections must be valid sizes.`);
  }
  return {
    source: inputUnit === 'mm' ? values : values.map(mmToInches),
    mm: values,
  };
}

function getInputs() {
  const inputUnit = document.getElementById('input-unit').value;
  return {
    templateType: document.getElementById('template-type').value,
    inputUnit,
    outputUnit: document.getElementById('output-unit').value,
    widthSegments: readSegmentRows(widthRowsEl, 'Width', inputUnit),
    heightSegments: readSegmentRows(heightRowsEl, 'Height', inputUnit),
    bleed: Number(document.getElementById('bleed').value),
    jobName: document.getElementById('job-name').value.trim(),
  };
}

function validate(input) {
  const warnings = [];
  if (!Number.isFinite(input.bleed) || input.bleed < 0) throw new Error('Bleed must be 0 or greater.');
  return warnings;
}

function buildPlan(input) {
  const warnings = validate(input);
  const widthSegmentsBaseMm = input.widthSegments.mm;
  const heightSegmentsBaseMm = input.heightSegments.mm;
  const widthSegmentsSource = input.widthSegments.source;
  const heightSegmentsSource = input.heightSegments.source;
  const widthSegmentsMm = input.templateType === 'hard'
    ? widthSegmentsBaseMm.map((value) => value === 62 ? 62 : value - HARD_PANEL_REDUCTION_MM)
    : widthSegmentsBaseMm;
  const heightSegmentsMm = input.templateType === 'hard'
    ? heightSegmentsBaseMm.map((value) => value === 62 ? 62 : value - HARD_PANEL_REDUCTION_MM)
    : heightSegmentsBaseMm;

  if (widthSegmentsMm.some((value) => value <= 0) || heightSegmentsMm.some((value) => value <= 0)) {
    throw new Error('Hard panel reduction made one or more sections zero or negative.');
  }

  const finishedWidthMm = widthSegmentsMm.reduce((sum, value) => sum + value, 0);
  const finishedHeightMm = heightSegmentsMm.reduce((sum, value) => sum + value, 0);
  const finishedWidthIn = mmToInches(finishedWidthMm);
  const finishedHeightIn = mmToInches(finishedHeightMm);
  const artboardWidthIn = finishedWidthIn + (input.bleed * 2);
  const artboardHeightIn = finishedHeightIn + (input.bleed * 2);

  if (input.templateType === 'hard') {
    warnings.push('Hard panel SVG remains a visual proof. Use the Illustrator script export for real adjacent artboards in Adobe.');
  }

  return {
    ...input,
    warnings,
    widthSegmentsSource,
    heightSegmentsSource,
    widthSegmentsBaseMm,
    heightSegmentsBaseMm,
    widthSegmentsMm,
    heightSegmentsMm,
    widthBreaksMm: cumulative(widthSegmentsMm),
    heightBreaksMm: cumulative(heightSegmentsMm),
    finishedWidthMm,
    finishedHeightMm,
    finishedWidthIn,
    finishedHeightIn,
    artboardWidthIn,
    artboardHeightIn,
    trimXIn: input.bleed,
    trimYIn: input.bleed,
    segmentColumns: widthSegmentsMm.length,
    segmentRows: heightSegmentsMm.length,
    totalPieces: widthSegmentsMm.length * heightSegmentsMm.length,
  };
}

function formatSourceList(values, unit) {
  return values.map((value) => unit === 'mm' ? `${Number(value).toFixed(0)} mm` : `${Number(value).toFixed(2)} in`).join(' • ');
}

function renderWarnings(warnings) {
  warningsEl.innerHTML = '';
  warnings.forEach((warning) => {
    const div = document.createElement('div');
    div.className = 'warning';
    div.textContent = warning;
    warningsEl.appendChild(div);
  });
}

function renderSummary(plan) {
  summaryEl.innerHTML = '';
  const typeLabel = plan.templateType === 'hard' ? 'Hard Panels' : 'SEG';
  const typeNote = plan.templateType === 'hard' ? `${plan.totalPieces} individual panel artboards/pieces` : 'Single Illustrator artboard';
  const stats = [
    ['Template type', typeLabel, typeNote],
    ['Input unit', plan.inputUnit.toUpperCase(), `Selected from beMatrix size list`],
    ['Output unit', plan.outputUnit.toUpperCase(), plan.outputUnit === 'in' ? 'Displayed/exported in inches rounded to 0.01' : 'Displayed/exported in millimeters'],
    ['Width sections', `${plan.segmentColumns} sections`, plan.templateType === 'hard' ? `${plan.widthSegmentsBaseMm.map((value, i) => `${value}→${plan.widthSegmentsMm[i]} mm`).join(' • ')} • total ${formatOutput(plan.finishedWidthIn, plan.finishedWidthMm, plan.outputUnit)}` : `${formatSourceList(plan.widthSegmentsSource, plan.inputUnit)} • total ${formatOutput(plan.finishedWidthIn, plan.finishedWidthMm, plan.outputUnit)}`],
    ['Height sections', `${plan.segmentRows} sections`, plan.templateType === 'hard' ? `${plan.heightSegmentsBaseMm.map((value, i) => `${value}→${plan.heightSegmentsMm[i]} mm`).join(' • ')} • total ${formatOutput(plan.finishedHeightIn, plan.finishedHeightMm, plan.outputUnit)}` : `${formatSourceList(plan.heightSegmentsSource, plan.inputUnit)} • total ${formatOutput(plan.finishedHeightIn, plan.finishedHeightMm, plan.outputUnit)}`],
    ['Finished size', `${formatOutput(plan.finishedWidthIn, plan.finishedWidthMm, plan.outputUnit)} × ${formatOutput(plan.finishedHeightIn, plan.finishedHeightMm, plan.outputUnit)}`, `${formatMm(plan.finishedWidthMm)} × ${formatMm(plan.finishedHeightMm)}`],
    ['Bleed', plan.outputUnit === 'mm' ? formatMm(inchesToMm(plan.bleed), 1) : formatInches(plan.bleed, 2), 'Applied top, right, bottom, and left'],
    ['Export sizing', plan.templateType === 'hard' ? `Each piece labeled in ${plan.outputUnit}` : `${formatOutput(plan.artboardWidthIn, inchesToMm(plan.artboardWidthIn), plan.outputUnit)} × ${formatOutput(plan.artboardHeightIn, inchesToMm(plan.artboardHeightIn), plan.outputUnit)}`, plan.templateType === 'hard' ? 'Illustrator script creates adjacent artboards' : 'Single artboard includes bleed on all sides'],
    ['Color mode', 'CMYK', 'Set in Illustrator after opening the SVG or running the JSX'],
  ];

  stats.forEach(([label, value, note]) => {
    const node = statTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.label').textContent = label;
    node.querySelector('.value').textContent = value;
    node.querySelector('.note').textContent = note;
    summaryEl.appendChild(node);
  });
}

function renderNotes(plan) {
  outputNotesEl.innerHTML = '';
  const notes = [
    'Color mode target: CMYK',
    'Bleed applied on all four sides',
    'SVG opens in Illustrator for save-as .ai',
  ];
  if (plan.templateType === 'seg') {
    notes.push('SEG output uses one artboard sized to final graphic + bleed');
    notes.push('Illustrator script creates one labeled artboard');
  } else {
    notes.push('Hard panel sizes are reduced by 7 mm per selected width/height section for frame allowance, except 62 mm sections stay 62 mm');
    notes.push('Hard panel SVG is a layout proof');
    notes.push('Illustrator script creates real adjacent artboards for each hard panel piece');
  }
  notes.forEach((note) => {
    const li = document.createElement('li');
    li.textContent = note;
    outputNotesEl.appendChild(li);
  });
}

function buildSegSvg(plan) {
  const widthPx = inchesToPx(plan.artboardWidthIn);
  const heightPx = inchesToPx(plan.artboardHeightIn);
  const trimXPx = inchesToPx(plan.trimXIn);
  const trimYPx = inchesToPx(plan.trimYIn);
  const finishedWidthPx = inchesToPx(plan.finishedWidthIn);
  const finishedHeightPx = inchesToPx(plan.finishedHeightIn);

  const verticals = plan.widthBreaksMm.slice(0, -1).map((mm) => {
    const x = trimXPx + mmToPx(mm);
    return `<line x1="${x}" y1="${trimYPx}" x2="${x}" y2="${trimYPx + finishedHeightPx}" stroke="#94a3b8" stroke-width="1" />`;
  }).join('');

  const horizontals = plan.heightBreaksMm.slice(0, -1).map((mm) => {
    const y = trimYPx + mmToPx(mm);
    return `<line x1="${trimXPx}" y1="${y}" x2="${trimXPx + finishedWidthPx}" y2="${y}" stroke="#94a3b8" stroke-width="1" />`;
  }).join('');

  const widthLabels = [];
  let runningXmm = 0;
  plan.widthSegmentsMm.forEach((segment, index) => {
    const start = trimXPx + mmToPx(runningXmm);
    const mid = start + (mmToPx(segment) / 2);
    widthLabels.push(`<text x="${mid}" y="${trimYPx - 14}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#475569">W${index + 1}: ${plan.outputUnit === 'mm' ? formatMm(segment, 1) : formatInches(mmToInches(segment), 2)}</text>`);
    runningXmm += segment;
  });

  const heightLabels = [];
  let runningYmm = 0;
  plan.heightSegmentsMm.forEach((segment, index) => {
    const start = trimYPx + mmToPx(runningYmm);
    const mid = start + (mmToPx(segment) / 2);
    heightLabels.push(`<text x="${trimXPx - 10}" y="${mid}" text-anchor="end" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="14" fill="#475569">H${index + 1}: ${plan.outputUnit === 'mm' ? formatMm(segment, 1) : formatInches(mmToInches(segment), 2)}</text>`);
    runningYmm += segment;
  });

  const cellLabels = [];
  let yStartMm = 0;
  plan.heightSegmentsMm.forEach((hSeg, rowIndex) => {
    let xStartMm = 0;
    plan.widthSegmentsMm.forEach((wSeg, colIndex) => {
      const x = trimXPx + mmToPx(xStartMm) + (mmToPx(wSeg) / 2);
      const y = trimYPx + mmToPx(yStartMm) + (mmToPx(hSeg) / 2);
      cellLabels.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="20" fill="#64748b">R${rowIndex + 1} / C${colIndex + 1}</text>`);
      xStartMm += wSeg;
    });
    yStartMm += hSeg;
  });

  const title = plan.jobName ? `${escapeXml(plan.jobName)} • ` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${plan.artboardWidthIn}in" height="${plan.artboardHeightIn}in" viewBox="0 0 ${widthPx} ${heightPx}">
  <title>${title}beMatrix SEG Template</title>
  <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="#ffffff" />
  <rect x="0.5" y="0.5" width="${widthPx - 1}" height="${heightPx - 1}" fill="none" stroke="#f84209" stroke-width="2" stroke-dasharray="14 10" />
  <rect x="${trimXPx}" y="${trimYPx}" width="${finishedWidthPx}" height="${finishedHeightPx}" fill="none" stroke="#020c14" stroke-width="3" />
  <g>${verticals}</g>
  <g>${horizontals}</g>
  <g>${widthLabels.join('')}</g>
  <g>${heightLabels.join('')}</g>
  <g>${cellLabels.join('')}</g>
  <text x="36" y="44" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#020c14">${title}beMatrix SEG Template</text>
  <text x="36" y="76" font-family="Arial, sans-serif" font-size="18" fill="#63666a">Finished size: ${formatOutput(plan.finishedWidthIn, plan.finishedWidthMm, plan.outputUnit)} × ${formatOutput(plan.finishedHeightIn, plan.finishedHeightMm, plan.outputUnit)} • Artboard: ${formatOutput(plan.artboardWidthIn, inchesToMm(plan.artboardWidthIn), plan.outputUnit)} × ${formatOutput(plan.artboardHeightIn, inchesToMm(plan.artboardHeightIn), plan.outputUnit)} • Bleed: ${plan.outputUnit === 'mm' ? formatMm(inchesToMm(plan.bleed), 1) : formatInches(plan.bleed, 2)}</text>
  <text x="36" y="104" font-family="Arial, sans-serif" font-size="16" fill="#63666a">Input ${plan.inputUnit.toUpperCase()} • output ${plan.outputUnit.toUpperCase()} • CMYK target</text>
</svg>`;
}

function buildHardSvg(plan) {
  const gapPx = 48;
  const marginPx = 36;
  const titleSpacePx = 78;
  const bleedPx = inchesToPx(plan.bleed);
  const colWidthsPx = plan.widthSegmentsMm.map(mmToPx);
  const rowHeightsPx = plan.heightSegmentsMm.map(mmToPx);
  const maxPieceWidth = Math.max(...colWidthsPx) + (bleedPx * 2);
  const maxPieceHeight = Math.max(...rowHeightsPx) + (bleedPx * 2);
  const totalWidthPx = marginPx * 2 + (plan.segmentColumns * maxPieceWidth) + ((plan.segmentColumns - 1) * gapPx);
  const totalHeightPx = marginPx * 2 + titleSpacePx + (plan.segmentRows * maxPieceHeight) + ((plan.segmentRows - 1) * gapPx);
  const pieces = [];

  plan.heightSegmentsMm.forEach((heightMm, rowIndex) => {
    plan.widthSegmentsMm.forEach((widthMm, colIndex) => {
      const pieceWidthPx = mmToPx(widthMm) + (bleedPx * 2);
      const pieceHeightPx = mmToPx(heightMm) + (bleedPx * 2);
      const pieceX = marginPx + colIndex * (maxPieceWidth + gapPx);
      const pieceY = marginPx + titleSpacePx + rowIndex * (maxPieceHeight + gapPx);
      const trimX = pieceX + bleedPx;
      const trimY = pieceY + bleedPx;
      const label = `R${rowIndex + 1} / C${colIndex + 1}`;
      pieces.push(`
        <g>
          <rect x="${pieceX}" y="${pieceY}" width="${pieceWidthPx}" height="${pieceHeightPx}" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
          <rect x="${pieceX + 0.5}" y="${pieceY + 0.5}" width="${pieceWidthPx - 1}" height="${pieceHeightPx - 1}" fill="none" stroke="#f84209" stroke-width="1.5" stroke-dasharray="10 7" />
          <rect x="${trimX}" y="${trimY}" width="${mmToPx(widthMm)}" height="${mmToPx(heightMm)}" fill="none" stroke="#020c14" stroke-width="2.5" />
          <text x="${pieceX + 16}" y="${pieceY + 24}" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#020c14">${label}</text>
          <text x="${pieceX + 16}" y="${pieceY + 44}" font-family="Arial, sans-serif" font-size="13" fill="#63666a">Trim: ${formatOutput(mmToInches(widthMm), widthMm, plan.outputUnit)} × ${formatOutput(mmToInches(heightMm), heightMm, plan.outputUnit)}</text>
          <text x="${pieceX + 16}" y="${pieceY + 62}" font-family="Arial, sans-serif" font-size="13" fill="#63666a">Artboard: ${formatOutput(mmToInches(widthMm) + plan.bleed * 2, widthMm + inchesToMm(plan.bleed * 2), plan.outputUnit)} × ${formatOutput(mmToInches(heightMm) + plan.bleed * 2, heightMm + inchesToMm(plan.bleed * 2), plan.outputUnit)}</text>
          <text x="${pieceX + pieceWidthPx / 2}" y="${pieceY + pieceHeightPx / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="18" fill="#64748b">${label}</text>
        </g>`);
    });
  });

  const title = plan.jobName ? `${escapeXml(plan.jobName)} • ` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${(totalWidthPx / INCH_TO_PX).toFixed(3)}in" height="${(totalHeightPx / INCH_TO_PX).toFixed(3)}in" viewBox="0 0 ${totalWidthPx} ${totalHeightPx}">
  <title>${title}beMatrix Hard Panel Template</title>
  <rect x="0" y="0" width="${totalWidthPx}" height="${totalHeightPx}" fill="#f8fafc" />
  <text x="${marginPx}" y="${marginPx + 12}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#020c14">${title}beMatrix Hard Panel Pieces</text>
  <text x="${marginPx}" y="${marginPx + 38}" font-family="Arial, sans-serif" font-size="16" fill="#63666a">Input ${plan.inputUnit.toUpperCase()} • output ${plan.outputUnit.toUpperCase()} • Bleed ${plan.outputUnit === 'mm' ? formatMm(inchesToMm(plan.bleed), 1) : formatInches(plan.bleed, 2)} • ${plan.totalPieces} total pieces</text>
  ${pieces.join('')}
</svg>`;
}

function buildSvg(plan) {
  return plan.templateType === 'hard' ? buildHardSvg(plan) : buildSegSvg(plan);
}

function buildIllustratorScript(plan) {
  const title = plan.jobName || 'beMatrix Template';
  const gapIn = 0;
  const hardColumnArtWidthsIn = plan.widthSegmentsMm.map((widthMm) => mmToInches(widthMm) + (plan.bleed * 2));
  const hardRowArtHeightsIn = plan.heightSegmentsMm.map((heightMm) => mmToInches(heightMm) + (plan.bleed * 2));
  const hardColumnLeftsIn = hardColumnArtWidthsIn.map((_, index) => hardColumnArtWidthsIn.slice(0, index).reduce((sum, value) => sum + value, 0));
  const totalHardHeightIn = hardRowArtHeightsIn.reduce((sum, value) => sum + value, 0);
  const hardRowTopsIn = hardRowArtHeightsIn.map((heightIn, index) => totalHardHeightIn - hardRowArtHeightsIn.slice(0, index).reduce((sum, value) => sum + value, 0));

  const pieces = plan.templateType === 'hard'
    ? plan.heightSegmentsMm.flatMap((heightMm, rowIndex) => plan.widthSegmentsMm.map((widthMm, colIndex) => ({
      label: `R${rowIndex + 1} / C${colIndex + 1}`,
      trimWidthIn: mmToInches(widthMm),
      trimHeightIn: mmToInches(heightMm),
      artboardWidthIn: mmToInches(widthMm) + (plan.bleed * 2),
      artboardHeightIn: mmToInches(heightMm) + (plan.bleed * 2),
      trimWidthMm: widthMm,
      trimHeightMm: heightMm,
      leftIn: hardColumnLeftsIn[colIndex],
      topIn: hardRowTopsIn[rowIndex],
    })))
    : [{
      leftIn: 0,
      topIn: 0,
      label: 'SEG Master',
      trimWidthIn: plan.finishedWidthIn,
      trimHeightIn: plan.finishedHeightIn,
      artboardWidthIn: plan.artboardWidthIn,
      artboardHeightIn: plan.artboardHeightIn,
      trimWidthMm: plan.finishedWidthMm,
      trimHeightMm: plan.finishedHeightMm,
    }];

  const trimFormatExpr = plan.outputUnit === 'mm'
    ? `piece.trimWidthMm.toFixed(1).replace(/\\.0$/, '') + ' mm × ' + piece.trimHeightMm.toFixed(1).replace(/\\.0$/, '') + ' mm'`
    : `piece.trimWidthIn.toFixed(2) + ' in × ' + piece.trimHeightIn.toFixed(2) + ' in'`;

  const artFormatExpr = plan.outputUnit === 'mm'
    ? `(piece.trimWidthMm + payload.bleedIn * 2 * 25.4).toFixed(1).replace(/\\.0$/, '') + ' mm × ' + (piece.trimHeightMm + payload.bleedIn * 2 * 25.4).toFixed(1).replace(/\\.0$/, '') + ' mm'`
    : `piece.artboardWidthIn.toFixed(2) + ' in × ' + piece.artboardHeightIn.toFixed(2) + ' in'`;

  const payload = {
    title,
    bleedIn: plan.bleed,
    gapIn,
    pieces,
  };

  return `#target illustrator
(function () {
  var payload = ${JSON.stringify(payload, null, 2)};
  var PT = ${POINTS_PER_INCH};
  function toPt(inches) { return inches * PT; }
  function makeCmyk(c, m, y, k) { var color = new CMYKColor(); color.cyan = c; color.magenta = m; color.yellow = y; color.black = k; return color; }
  function addLabel(layer, textValue, left, top, size, color) {
    var frame = layer.textFrames.add();
    frame.contents = textValue;
    frame.position = [left, top];
    var tr = frame.textRange.characterAttributes;
    tr.size = size;
    tr.fillColor = color;
    return frame;
  }
  var first = payload.pieces[0];
  var doc = app.documents.add(DocumentColorSpace.CMYK, toPt(first.artboardWidthIn), toPt(first.artboardHeightIn));
  doc.rulerUnits = RulerUnits.Inches;
  var layer = doc.layers[0];
  layer.name = payload.title;
  var artboards = doc.artboards;
  var bleedPt = toPt(payload.bleedIn);
  var strokeTrim = makeCmyk(75, 68, 67, 90);
  var strokeBleed = makeCmyk(0, 82, 93, 0);
  var textColor = makeCmyk(73, 55, 48, 18);

  for (var i = 0; i < payload.pieces.length; i++) {
    var piece = payload.pieces[i];
    var artW = toPt(piece.artboardWidthIn);
    var artH = toPt(piece.artboardHeightIn);
    var left = toPt(piece.leftIn || 0);
    var topOrigin = toPt(piece.topIn || 0);
    var rect = [left, topOrigin, left + artW, topOrigin - artH];
    if (i === 0) {
      artboards[0].artboardRect = rect;
    } else {
      artboards.add(rect);
    }
    artboards[i].name = piece.label;

    var bleedRect = layer.pathItems.rectangle(topOrigin, left, artW, artH);
    bleedRect.stroked = true;
    bleedRect.filled = false;
    bleedRect.strokeWidth = 1;
    bleedRect.strokeColor = strokeBleed;
    bleedRect.strokeDashes = [8, 6];

    var trimRect = layer.pathItems.rectangle(topOrigin - bleedPt, left + bleedPt, toPt(piece.trimWidthIn), toPt(piece.trimHeightIn));
    trimRect.stroked = true;
    trimRect.filled = false;
    trimRect.strokeWidth = 1.5;
    trimRect.strokeColor = strokeTrim;

    addLabel(layer, piece.label, left + 10, topOrigin - 18, 12, textColor);
    addLabel(layer, 'Trim: ' + (${trimFormatExpr}), left + 10, topOrigin - 34, 10, textColor);
    addLabel(layer, 'Artboard: ' + (${artFormatExpr}), left + 10, topOrigin - 48, 10, textColor);
  }

  app.activeDocument = doc;
  alert('Illustrator template created with ' + payload.pieces.length + ' artboard(s).');
})();
`;
}

function renderPreview(svgMarkup, plan) {
  previewSubtitleEl.textContent = plan.templateType === 'hard'
    ? 'Hard panel mode shows individual pieces. Use the Illustrator script for real adjacent artboards in Adobe.'
    : 'SEG mode shows one continuous artboard with segment guides and labels.';
  previewWrapEl.innerHTML = `<div class="preview-stage">${svgMarkup.replace('<svg ', '<svg class="template-preview" ')}</div>`;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildCurrentPlan() {
  const input = getInputs();
  const plan = buildPlan(input);
  renderWarnings(plan.warnings);
  renderSummary(plan);
  renderNotes(plan);
  currentSvgMarkup = buildSvg(plan);
  currentIllustratorScript = buildIllustratorScript(plan);
  currentFilename = `${plan.jobName ? slugify(plan.jobName) + '-' : ''}bematrix-${plan.templateType}-template.svg`;
  currentIllustratorFilename = `${plan.jobName ? slugify(plan.jobName) + '-' : ''}bematrix-${plan.templateType}-template.jsx`;
  renderPreview(currentSvgMarkup, plan);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    buildCurrentPlan();
  } catch (error) {
    renderWarnings([error.message]);
    summaryEl.innerHTML = '';
    previewWrapEl.innerHTML = '';
  }
});

downloadSvgBtn.addEventListener('click', () => {
  if (!currentSvgMarkup) buildCurrentPlan();
  downloadTextFile(currentFilename, currentSvgMarkup, 'image/svg+xml;charset=utf-8');
});

downloadIllustratorBtn.addEventListener('click', () => {
  if (!currentIllustratorScript) buildCurrentPlan();
  downloadTextFile(currentIllustratorFilename, currentIllustratorScript, 'text/javascript;charset=utf-8');
});

addWidthBtn.addEventListener('click', () => createSegmentRow(widthRowsEl, 992));
addHeightBtn.addEventListener('click', () => createSegmentRow(heightRowsEl, 992));

ensureStarterRows();
buildCurrentPlan();
