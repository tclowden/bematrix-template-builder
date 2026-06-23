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
const MIN_WORKING_AREA_WIDTH_IN = 24;
const MIN_WORKING_AREA_HEIGHT_IN = 24;
const CUSTOM_OPTION_VALUE = '__custom__';
const BEMATRIX_OPTIONS = [
  { id: 'std-62', group: 'Standard', label: '62', segMm: 62, hardMm: 62 },
  { id: 'std-248', group: 'Standard', label: '248', segMm: 248, hardMm: 248 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-434', group: 'Standard', label: '434', segMm: 434, hardMm: 434 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-496', group: 'Standard', label: '496', segMm: 496, hardMm: 496 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-558', group: 'Standard', label: '558', segMm: 558, hardMm: 558 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-620', group: 'Standard', label: '620', segMm: 620, hardMm: 620 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-992', group: 'Standard', label: '992', segMm: 992, hardMm: 992 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-1178', group: 'Standard', label: '1178', segMm: 1178, hardMm: 1178 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-1488', group: 'Standard', label: '1488', segMm: 1488, hardMm: 1488 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-1984', group: 'Standard', label: '1984', segMm: 1984, hardMm: 1984 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-2418', group: 'Standard', label: '2418', segMm: 2418, hardMm: 2418 - HARD_PANEL_REDUCTION_MM },
  { id: 'std-2976', group: 'Standard', label: '2976', segMm: 2976, hardMm: 2976 - HARD_PANEL_REDUCTION_MM },
  { id: 'curved-248-int', group: 'Curved Interior', label: '248 - Curved Interior', segMm: 320, hardMm: 317 },
  { id: 'curved-496-int', group: 'Curved Interior', label: '496 - Curved Interior', segMm: 710, hardMm: 707 },
  { id: 'curved-992-int-45', group: 'Curved Interior', label: '992 - Curved Interior 45°', segMm: 730, hardMm: 725 },
  { id: 'curved-992-int-90', group: 'Curved Interior', label: '992 - Curved Interior 90°', segMm: 1461, hardMm: 1458 },
  { id: 'curved-1488-int', group: 'Curved Interior', label: '1488 - Curved Interior', segMm: 1120, hardMm: 1116 },
  { id: 'curved-2976-int', group: 'Curved Interior', label: '2976 - Curved Interior', segMm: 1144, hardMm: 1150 },
  { id: 'curved-248-ext', group: 'Curved Exterior', label: '248 - Curved Exterior', segMm: 418, hardMm: 408 },
  { id: 'curved-496-ext', group: 'Curved Exterior', label: '496 - Curved Exterior', segMm: 807, hardMm: 798 },
  { id: 'curved-992-ext-45', group: 'Curved Exterior', label: '992 - Curved Exterior 45°', segMm: 779, hardMm: 771 },
  { id: 'curved-992-ext-90', group: 'Curved Exterior', label: '992 - Curved Exterior 90°', segMm: 1558, hardMm: 1549 },
  { id: 'curved-1488-ext', group: 'Curved Exterior', label: '1488 - Curved Exterior', segMm: 1168, hardMm: 1161 },
  { id: 'curved-2976-ext', group: 'Curved Exterior', label: '2976 - Curved Exterior', segMm: 1168, hardMm: 1161 },
];

let currentSvgMarkup = '';
let currentIllustratorScript = '';
let currentFilename = 'bematrix-template.svg';
let currentIllustratorFilename = 'bematrix-template.jsx';
let currentPreviewPlan = null;

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

function setCustomVisibility(select, customInput) {
  const isCustom = select.value === CUSTOM_OPTION_VALUE;
  customInput.hidden = !isCustom;
  customInput.required = isCustom;
}

function getOptionById(id) {
  return BEMATRIX_OPTIONS.find((option) => option.id === id) || null;
}

function createSegmentRow(container, initial = { type: 'preset', optionId: 'std-992' }, insertAfterRow = null) {
  const row = segmentRowTemplate.content.firstElementChild.cloneNode(true);
  const select = row.querySelector('.segment-select');
  const customInput = row.querySelector('.segment-custom-input');

  const groups = new Map();
  BEMATRIX_OPTIONS.forEach((option) => {
    if (!groups.has(option.group)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = option.group;
      groups.set(option.group, optgroup);
      select.appendChild(optgroup);
    }
    const item = document.createElement('option');
    item.value = option.id;
    item.textContent = option.label;
    if (initial.type === 'preset' && option.id === initial.optionId) item.selected = true;
    groups.get(option.group).appendChild(item);
  });

  const customOption = document.createElement('option');
  customOption.value = CUSTOM_OPTION_VALUE;
  customOption.textContent = 'Custom…';
  if (initial.type === 'custom') {
    customOption.selected = true;
    customInput.value = String(initial.value);
  }
  select.appendChild(customOption);

  select.addEventListener('change', () => setCustomVisibility(select, customInput));
  setCustomVisibility(select, customInput);

  row.querySelector('.duplicate-button').addEventListener('click', () => {
    const duplicateInitial = select.value === CUSTOM_OPTION_VALUE
      ? { type: 'custom', value: Number(customInput.value) }
      : { type: 'preset', optionId: select.value };
    createSegmentRow(container, duplicateInitial, row);
  });

  row.querySelector('.remove-button').addEventListener('click', () => {
    if (container.children.length === 1) {
      select.value = 'std-992';
      customInput.value = '';
      setCustomVisibility(select, customInput);
      return;
    }
    row.remove();
  });

  if (insertAfterRow && insertAfterRow.parentNode === container) {
    insertAfterRow.insertAdjacentElement('afterend', row);
  } else {
    container.appendChild(row);
  }
}

function ensureStarterRows() {
  if (!widthRowsEl.children.length) createSegmentRow(widthRowsEl, { type: 'preset', optionId: 'std-992' });
  if (!heightRowsEl.children.length) createSegmentRow(heightRowsEl, { type: 'preset', optionId: 'std-992' });
}

function readSegmentRows(container, axisName, inputUnit) {
  const items = Array.from(container.querySelectorAll('.segment-row')).map((row) => {
    const select = row.querySelector('.segment-select');
    const customInput = row.querySelector('.segment-custom-input');
    if (select.value === CUSTOM_OPTION_VALUE) {
      const value = Number(customInput.value);
      return {
        label: `Custom ${inputUnit === 'mm' ? `${value} mm` : `${value} in`}`,
        segMm: sourceToMm(value, inputUnit),
        hardMm: sourceToMm(value, inputUnit),
        sourceValue: value,
        isCustom: true,
      };
    }
    const option = getOptionById(select.value);
    if (!option) return null;
    return {
      label: option.label,
      segMm: option.segMm,
      hardMm: option.hardMm,
      sourceValue: inputUnit === 'mm' ? option.segMm : mmToInches(option.segMm),
      isCustom: false,
    };
  });
  if (!items.length || items.some((item) => !item)) throw new Error(`${axisName} sections are required.`);
  if (items.some((item) => !Number.isFinite(item.segMm) || item.segMm <= 0 || !Number.isFinite(item.hardMm) || item.hardMm <= 0)) {
    throw new Error(`${axisName} sections must be valid sizes.`);
  }
  return items;
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
  const widthItems = input.widthSegments;
  const heightItems = input.heightSegments;
  const widthSegmentsBaseMm = widthItems.map((item) => item.segMm);
  const heightSegmentsBaseMm = heightItems.map((item) => item.segMm);
  const widthSegmentsSource = widthItems.map((item) => item.sourceValue);
  const heightSegmentsSource = heightItems.map((item) => item.sourceValue);
  const widthSegmentsMm = widthItems.map((item) => input.templateType === 'hard' ? item.hardMm : item.segMm);
  const heightSegmentsMm = heightItems.map((item) => input.templateType === 'hard' ? item.hardMm : item.segMm);

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
    widthItems,
    heightItems,
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

function formatSourceList(items, templateType, inputUnit, outputUnit) {
  return items.map((item) => {
    if (templateType === 'hard' && item.segMm !== item.hardMm) {
      return `${item.label}: ${formatOutput(mmToInches(item.hardMm), item.hardMm, outputUnit)}`;
    }
    return item.isCustom
      ? `${item.label}`
      : `${item.label}: ${inputUnit === 'mm' ? formatMm(item.segMm, 0) : formatInches(mmToInches(item.segMm), 2)}`;
  }).join(' • ');
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
    ['Width sections', `${plan.segmentColumns} sections`, `${formatSourceList(plan.widthItems, plan.templateType, plan.inputUnit, plan.outputUnit)} • total ${formatOutput(plan.finishedWidthIn, plan.finishedWidthMm, plan.outputUnit)}`],
    ['Height sections', `${plan.segmentRows} sections`, `${formatSourceList(plan.heightItems, plan.templateType, plan.inputUnit, plan.outputUnit)} • total ${formatOutput(plan.finishedHeightIn, plan.finishedHeightMm, plan.outputUnit)}`],
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
  const totalWidthLabel = `Overall width: ${formatOutput(plan.finishedWidthIn, plan.finishedWidthMm, plan.outputUnit)}`;
  const totalHeightLabel = `Overall height: ${formatOutput(plan.finishedHeightIn, plan.finishedHeightMm, plan.outputUnit)}`;
  const instructionLine = 'Keep all graphics inside the black line. Extend bleed to the red dotted line.';
  const title = plan.jobName ? `${escapeXml(plan.jobName)} • ` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${plan.artboardWidthIn}in" height="${plan.artboardHeightIn}in" viewBox="0 0 ${widthPx} ${heightPx}">
  <title>${title}beMatrix SEG Template</title>
  <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="#ffffff" />
  <rect x="0.5" y="0.5" width="${widthPx - 1}" height="${heightPx - 1}" fill="none" stroke="#f84209" stroke-width="2" stroke-dasharray="14 10" />
  <rect x="${trimXPx}" y="${trimYPx}" width="${finishedWidthPx}" height="${finishedHeightPx}" fill="none" stroke="#020c14" stroke-width="3" />
  <text x="${trimXPx + (finishedWidthPx / 2)}" y="${trimYPx - 14}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#475569">${totalWidthLabel}</text>
  <text x="${trimXPx - 10}" y="${trimYPx + (finishedHeightPx / 2)}" text-anchor="end" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="16" fill="#475569">${totalHeightLabel}</text>
  <text x="36" y="44" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#020c14">${title}beMatrix SEG Template</text>
  <text x="36" y="66" font-family="Arial, sans-serif" font-size="14" fill="#63666a">${instructionLine}</text>
  <text x="36" y="88" font-family="Arial, sans-serif" font-size="18" fill="#63666a">Finished size: ${formatOutput(plan.finishedWidthIn, plan.finishedWidthMm, plan.outputUnit)} × ${formatOutput(plan.finishedHeightIn, plan.finishedHeightMm, plan.outputUnit)} • Artboard: ${formatOutput(plan.artboardWidthIn, inchesToMm(plan.artboardWidthIn), plan.outputUnit)} × ${formatOutput(plan.artboardHeightIn, inchesToMm(plan.artboardHeightIn), plan.outputUnit)} • Bleed: ${plan.outputUnit === 'mm' ? formatMm(inchesToMm(plan.bleed), 1) : formatInches(plan.bleed, 2)}</text>
  <text x="36" y="112" font-family="Arial, sans-serif" font-size="16" fill="#63666a">Input ${plan.inputUnit.toUpperCase()} • output ${plan.outputUnit.toUpperCase()} • CMYK target</text>
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
  const instructionLine = 'Keep all graphics inside the black line. Extend bleed to the red dotted line.';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${(totalWidthPx / INCH_TO_PX).toFixed(3)}in" height="${(totalHeightPx / INCH_TO_PX).toFixed(3)}in" viewBox="0 0 ${totalWidthPx} ${totalHeightPx}">
  <title>${title}beMatrix Hard Panel Template</title>
  <rect x="0" y="0" width="${totalWidthPx}" height="${totalHeightPx}" fill="#f8fafc" />
  <text x="${marginPx}" y="${marginPx + 12}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#020c14">${title}beMatrix Hard Panel Pieces</text>
  <text x="${marginPx}" y="${marginPx + 32}" font-family="Arial, sans-serif" font-size="13" fill="#63666a">${instructionLine}</text>
  <text x="${marginPx}" y="${marginPx + 52}" font-family="Arial, sans-serif" font-size="16" fill="#63666a">Input ${plan.inputUnit.toUpperCase()} • output ${plan.outputUnit.toUpperCase()} • Bleed ${plan.outputUnit === 'mm' ? formatMm(inchesToMm(plan.bleed), 1) : formatInches(plan.bleed, 2)} • ${plan.totalPieces} total pieces</text>
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
      topIn: plan.artboardHeightIn,
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

  const requiredCanvasWidthIn = pieces.reduce((max, piece) => Math.max(max, piece.leftIn + piece.artboardWidthIn), 0);
  const requiredCanvasHeightIn = pieces.reduce((max, piece) => Math.max(max, piece.topIn), 0);
  const canvasPaddingIn = 2;
  const canvasWidthIn = Math.max(MIN_WORKING_AREA_WIDTH_IN, requiredCanvasWidthIn + canvasPaddingIn);
  const canvasHeightIn = Math.max(MIN_WORKING_AREA_HEIGHT_IN, requiredCanvasHeightIn + canvasPaddingIn);

  const payload = {
    title,
    instructionLine: 'Keep all graphics inside the black line. Extend bleed to the red dotted line.',
    suggestedFileName: `${plan.jobName ? slugify(plan.jobName) : `bematrix-${plan.templateType}-template`}.ai`,
    bleedIn: plan.bleed,
    gapIn,
    canvasWidthIn,
    canvasHeightIn,
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
  function fitFontSize(textValue, maxWidthPt, desiredPt, minPt) {
    var estimated = textValue.length ? (maxWidthPt / (textValue.length * 0.55)) : desiredPt;
    return Math.max(minPt, Math.min(desiredPt, estimated));
  }
  var first = payload.pieces[0];
  var doc = app.documents.add(DocumentColorSpace.CMYK, toPt(payload.canvasWidthIn), toPt(payload.canvasHeightIn));
  try { app.preferences.setIntegerPreference('rulerType', 0); } catch (e) {}
  try { app.preferences.setIntegerPreference('strokeUnits', 0); } catch (e) {}
  try { app.preferences.setIntegerPreference('text/units', 0); } catch (e) {}
  doc.rulerUnits = RulerUnits.Inches;
  var layer = doc.layers[0];
  layer.name = payload.title;
  var artboards = doc.artboards;
  var bleedPt = toPt(payload.bleedIn);
  var maxTopIn = payload.pieces.reduce(function (max, piece) { return Math.max(max, piece.topIn || 0); }, 0);
  var strokeTrim = makeCmyk(75, 68, 67, 90);
  var strokeBleed = makeCmyk(0, 82, 93, 0);
  var textColor = makeCmyk(73, 55, 48, 18);

  for (var i = 0; i < payload.pieces.length; i++) {
    var piece = payload.pieces[i];
    var artW = toPt(piece.artboardWidthIn);
    var artH = toPt(piece.artboardHeightIn);
    var left = toPt(piece.leftIn || 0);
    var topOrigin = -toPt(maxTopIn - (piece.topIn || 0));
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

    var headerLeft = left + 12;
    var headerTop = topOrigin - toPt(1.35);
    var headerMaxWidth = Math.max(90, artW - 24);
    var titleText = payload.title + (payload.pieces.length > 1 ? ' • ' + piece.label : '');
    var instructionText = payload.instructionLine;
    var finishedText = 'Finished size: ' + (${trimFormatExpr});
    var titleSize = fitFontSize(titleText, headerMaxWidth, 144, 18);
    var instructionSize = fitFontSize(instructionText, headerMaxWidth, 72, 10);
    var finishedSize = fitFontSize(finishedText, headerMaxWidth, 84, 12);

    addLabel(layer, titleText, headerLeft, headerTop, titleSize, textColor);
    addLabel(layer, instructionText, headerLeft, headerTop - titleSize - 8, instructionSize, textColor);
    addLabel(layer, finishedText, headerLeft, headerTop - titleSize - instructionSize - 18, finishedSize, textColor);
  }

  app.activeDocument = doc;
  alert('Illustrator template created with ' + payload.pieces.length + ' artboard(s). Use File > Save As to save your .ai file.');
})();
`;
}

function fitPreview() {
  const svg = previewWrapEl.querySelector('svg.template-preview');
  if (!svg) return;
  const viewBox = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n))) {
    svg.style.width = '100%';
    return;
  }
  const [, , vbWidth, vbHeight] = viewBox;
  const wrapWidth = Math.max(320, previewWrapEl.clientWidth - 36);
  const maxHeight = currentPreviewPlan?.templateType === 'hard' ? 520 : 620;
  const scale = Math.min(wrapWidth / vbWidth, maxHeight / vbHeight, 1);
  svg.style.width = `${Math.max(280, vbWidth * scale)}px`;
}

function renderPreview(svgMarkup, plan) {
  currentPreviewPlan = plan;
  previewSubtitleEl.textContent = plan.templateType === 'hard'
    ? 'Hard panel mode shows individual pieces. Use the Illustrator script for real adjacent artboards in Adobe.'
    : 'SEG mode shows one continuous artboard with segment guides and labels.';
  previewWrapEl.innerHTML = `<div class="preview-stage">${svgMarkup.replace('<svg ', '<svg class="template-preview" ')}</div>`;
  fitPreview();
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
  const baseName = plan.jobName ? slugify(plan.jobName) : `bematrix-${plan.templateType}-template`;
  currentFilename = `${baseName}.svg`;
  currentIllustratorFilename = `${baseName}.jsx`;
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
window.addEventListener('resize', fitPreview);

ensureStarterRows();
buildCurrentPlan();
