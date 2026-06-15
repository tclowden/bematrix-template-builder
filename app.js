const form = document.getElementById('template-form');
const summaryEl = document.getElementById('summary');
const previewWrapEl = document.getElementById('preview-wrap');
const warningsEl = document.getElementById('warnings');
const downloadSvgBtn = document.getElementById('download-svg');
const statTemplate = document.getElementById('stat-template');

const INCH_TO_PX = 96;
const MM_PER_INCH = 25.4;
let currentSvgMarkup = '';
let currentFilename = 'bematrix-seg-template.svg';

function getInputs() {
  return {
    widthSegmentsRaw: document.getElementById('width-segments').value.trim(),
    heightSegmentsRaw: document.getElementById('height-segments').value.trim(),
    bleed: Number(document.getElementById('bleed').value),
    templateType: document.getElementById('template-type').value,
    jobName: document.getElementById('job-name').value.trim(),
  };
}

function parseSegments(raw, axisName) {
  const pieces = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (!pieces.length) throw new Error(`${axisName} segments are required.`);
  const values = pieces.map((piece) => Number(piece));
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error(`${axisName} segments must be positive numbers in millimeters.`);
  }
  return values;
}

function mmToInches(mm) {
  return mm / MM_PER_INCH;
}

function formatInches(value) {
  return `${value.toFixed(3).replace(/\.000$/, '')}"`;
}

function formatMm(value) {
  return `${value.toFixed(0)} mm`;
}

function validate(input) {
  const warnings = [];
  if (!Number.isFinite(input.bleed) || input.bleed < 0) throw new Error('Bleed must be 0 or greater.');
  if (input.templateType !== 'seg') warnings.push('Only SEG output is enabled in this first version.');
  return warnings;
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

function buildPlan(input) {
  const warnings = validate(input);
  const widthSegmentsMm = parseSegments(input.widthSegmentsRaw, 'Width');
  const heightSegmentsMm = parseSegments(input.heightSegmentsRaw, 'Height');

  const finishedWidthMm = widthSegmentsMm.reduce((sum, value) => sum + value, 0);
  const finishedHeightMm = heightSegmentsMm.reduce((sum, value) => sum + value, 0);
  const finishedWidth = mmToInches(finishedWidthMm);
  const finishedHeight = mmToInches(finishedHeightMm);
  const artboardWidth = finishedWidth + (input.bleed * 2);
  const artboardHeight = finishedHeight + (input.bleed * 2);

  return {
    ...input,
    warnings,
    widthSegmentsMm,
    heightSegmentsMm,
    widthBreaksMm: cumulative(widthSegmentsMm),
    heightBreaksMm: cumulative(heightSegmentsMm),
    finishedWidthMm,
    finishedHeightMm,
    finishedWidth,
    finishedHeight,
    artboardWidth,
    artboardHeight,
    trimX: input.bleed,
    trimY: input.bleed,
    segmentColumns: widthSegmentsMm.length,
    segmentRows: heightSegmentsMm.length,
  };
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
  const stats = [
    ['Template type', 'SEG', 'Single Illustrator artboard'],
    ['Width segments', `${plan.segmentColumns} segments`, plan.widthSegmentsMm.map(formatMm).join(' • ')],
    ['Height segments', `${plan.segmentRows} segments`, plan.heightSegmentsMm.map(formatMm).join(' • ')],
    ['Finished size', `${formatInches(plan.finishedWidth)} × ${formatInches(plan.finishedHeight)}`, `${formatMm(plan.finishedWidthMm)} × ${formatMm(plan.finishedHeightMm)}`],
    ['Artboard size', `${formatInches(plan.artboardWidth)} × ${formatInches(plan.artboardHeight)}`, 'Includes bleed on all sides'],
    ['Bleed', formatInches(plan.bleed), 'Applied top, right, bottom, and left'],
    ['Color mode', 'CMYK', 'Set in Illustrator after opening the SVG'],
  ];

  stats.forEach(([label, value, note]) => {
    const node = statTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.label').textContent = label;
    node.querySelector('.value').textContent = value;
    node.querySelector('.note').textContent = note;
    summaryEl.appendChild(node);
  });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSvg(plan) {
  const widthPx = plan.artboardWidth * INCH_TO_PX;
  const heightPx = plan.artboardHeight * INCH_TO_PX;
  const trimXPx = plan.trimX * INCH_TO_PX;
  const trimYPx = plan.trimY * INCH_TO_PX;
  const finishedWidthPx = plan.finishedWidth * INCH_TO_PX;
  const finishedHeightPx = plan.finishedHeight * INCH_TO_PX;

  const verticals = plan.widthBreaksMm.slice(0, -1).map((mm) => {
    const x = trimXPx + (mmToInches(mm) * INCH_TO_PX);
    return `<line x1="${x}" y1="${trimYPx}" x2="${x}" y2="${trimYPx + finishedHeightPx}" stroke="#94a3b8" stroke-width="1" />`;
  });

  const horizontals = plan.heightBreaksMm.slice(0, -1).map((mm) => {
    const y = trimYPx + (mmToInches(mm) * INCH_TO_PX);
    return `<line x1="${trimXPx}" y1="${y}" x2="${trimXPx + finishedWidthPx}" y2="${y}" stroke="#94a3b8" stroke-width="1" />`;
  });

  const widthLabels = [];
  let runningXmm = 0;
  plan.widthSegmentsMm.forEach((segment, index) => {
    const start = trimXPx + (mmToInches(runningXmm) * INCH_TO_PX);
    const mid = start + ((mmToInches(segment) * INCH_TO_PX) / 2);
    widthLabels.push(`<text x="${mid}" y="${trimYPx - 14}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#475569">W${index + 1}: ${Math.round(segment)}mm</text>`);
    runningXmm += segment;
  });

  const heightLabels = [];
  let runningYmm = 0;
  plan.heightSegmentsMm.forEach((segment, index) => {
    const start = trimYPx + (mmToInches(runningYmm) * INCH_TO_PX);
    const mid = start + ((mmToInches(segment) * INCH_TO_PX) / 2);
    heightLabels.push(`<text x="${trimXPx - 10}" y="${mid}" text-anchor="end" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="14" fill="#475569">H${index + 1}: ${Math.round(segment)}mm</text>`);
    runningYmm += segment;
  });

  const cellLabels = [];
  let yStartMm = 0;
  plan.heightSegmentsMm.forEach((hSeg, rowIndex) => {
    let xStartMm = 0;
    plan.widthSegmentsMm.forEach((wSeg, colIndex) => {
      const x = trimXPx + (mmToInches(xStartMm) * INCH_TO_PX) + ((mmToInches(wSeg) * INCH_TO_PX) / 2);
      const y = trimYPx + (mmToInches(yStartMm) * INCH_TO_PX) + ((mmToInches(hSeg) * INCH_TO_PX) / 2);
      cellLabels.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="20" fill="#64748b">R${rowIndex + 1} / C${colIndex + 1}</text>`);
      xStartMm += wSeg;
    });
    yStartMm += hSeg;
  });

  const title = plan.jobName ? `${escapeXml(plan.jobName)} • ` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${plan.artboardWidth}in" height="${plan.artboardHeight}in" viewBox="0 0 ${widthPx} ${heightPx}">
  <title>${title}beMatrix SEG Template</title>
  <desc>CMYK-targeted SEG template with ${plan.bleed} inch bleed and segment guides.</desc>
  <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="#ffffff" />
  <rect x="0.5" y="0.5" width="${widthPx - 1}" height="${heightPx - 1}" fill="none" stroke="#f84209" stroke-width="2" stroke-dasharray="14 10" />
  <rect x="${trimXPx}" y="${trimYPx}" width="${finishedWidthPx}" height="${finishedHeightPx}" fill="none" stroke="#020c14" stroke-width="3" />
  <g>${verticals.join('')}</g>
  <g>${horizontals.join('')}</g>
  <g>${widthLabels.join('')}</g>
  <g>${heightLabels.join('')}</g>
  <g>${cellLabels.join('')}</g>
  <text x="36" y="44" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#020c14">${title}beMatrix SEG Template</text>
  <text x="36" y="76" font-family="Arial, sans-serif" font-size="18" fill="#63666a">Finished size: ${formatInches(plan.finishedWidth)} × ${formatInches(plan.finishedHeight)} • Artboard: ${formatInches(plan.artboardWidth)} × ${formatInches(plan.artboardHeight)} • Bleed: ${formatInches(plan.bleed)}</text>
  <text x="36" y="104" font-family="Arial, sans-serif" font-size="16" fill="#63666a">CMYK target • Single artboard • Width segments ${escapeXml(plan.widthSegmentsMm.join(', '))} mm • Height segments ${escapeXml(plan.heightSegmentsMm.join(', '))} mm</text>
</svg>`;
}

function renderPreview(svgMarkup) {
  previewWrapEl.innerHTML = `<div class="preview-stage">${svgMarkup.replace('<svg ', '<svg class="template-preview" ')}</div>`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seg-template';
}

function buildCurrentPlan() {
  const input = getInputs();
  const plan = buildPlan(input);
  renderWarnings(plan.warnings);
  renderSummary(plan);
  currentSvgMarkup = buildSvg(plan);
  currentFilename = `${plan.jobName ? slugify(plan.jobName) + '-' : ''}bematrix-seg-template.svg`;
  renderPreview(currentSvgMarkup);
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
  const blob = new Blob([currentSvgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = currentFilename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});

buildCurrentPlan();
