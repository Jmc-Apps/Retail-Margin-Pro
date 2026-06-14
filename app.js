'use strict';

const KEY = 'retailMarginPro.v1.settings';
const defaults = {
  vatRate: 15,
  departments: [
    { name: 'Bakery', gp: 35 },
    { name: 'Butchery', gp: 28 },
    { name: 'Deli', gp: 40 },
    { name: 'Fruit & Veg', gp: 32 }
  ]
};

let settings = loadSettings();
let lastManual = [];
let selectedDept = null;
let editingDeptIndex = null;
let suppress = false;

const $ = (id) => document.getElementById(id);
const fields = {
  cost: $('costInput'),
  gp: $('gpInput'),
  rands: $('gpRandInput'),
  sell: $('sellInput')
};
const costVatBtn = $('costVatBtn');
const sellVatBtn = $('sellVatBtn');
const deptBtn = $('deptBtn');

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      vatRate: typeof saved.vatRate === 'number' ? saved.vatRate : defaults.vatRate,
      departments: Array.isArray(saved.departments) ? saved.departments : defaults.departments
    };
  } catch {
    return { ...defaults };
  }
}

function saveSettings() {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value || '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function fmt(num) {
  return Number.isFinite(num) ? (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2) : '';
}

function setField(name, value) {
  suppress = true;
  fields[name].value = fmt(value);
  suppress = false;
}

function readManual(name) {
  let value = toNumber(fields[name].value);
  if (value === null) return null;
  const vatFactor = 1 + settings.vatRate / 100;
  if (name === 'cost' && costVatBtn.classList.contains('active')) value /= vatFactor;
  if (name === 'sell' && sellVatBtn.classList.contains('active')) value /= vatFactor;
  return value;
}

function displayValue(name, exclValue) {
  const vatFactor = 1 + settings.vatRate / 100;
  if (name === 'cost' && costVatBtn.classList.contains('active')) return exclValue * vatFactor;
  if (name === 'sell' && sellVatBtn.classList.contains('active')) return exclValue * vatFactor;
  return exclValue;
}

function touch(name) {
  lastManual = lastManual.filter((item) => item !== name);
  lastManual.push(name);
  if (lastManual.length > 2) lastManual.shift();
}

function label(name) {
  return { cost: 'Cost Price', gp: 'GP %', rands: 'GP Rands', sell: 'Sell Price' }[name];
}

function compute() {
  const pair = lastManual.filter((name) => toNumber(fields[name].value) !== null).slice(-2);
  if (pair.length < 2) {
    $('statusText').textContent = 'Enter any two values.';
    $('markupText').textContent = 'Markup: N/C';
    return;
  }

  const values = {};
  pair.forEach((name) => values[name] = readManual(name));
  const has = (name) => pair.includes(name);

  let cost;
  let sell;
  let gp;
  let gpRands;

  if (has('cost') && has('gp')) {
    cost = values.cost;
    gp = values.gp;
    if (gp >= 100) return showProblem('GP% must be below 100.');
    sell = cost / (1 - gp / 100);
    gpRands = sell - cost;
  } else if (has('cost') && has('rands')) {
    cost = values.cost;
    gpRands = values.rands;
    sell = cost + gpRands;
    gp = sell ? gpRands / sell * 100 : null;
  } else if (has('cost') && has('sell')) {
    cost = values.cost;
    sell = values.sell;
    gpRands = sell - cost;
    gp = sell ? gpRands / sell * 100 : null;
  } else if (has('sell') && has('gp')) {
    sell = values.sell;
    gp = values.gp;
    if (gp >= 100) return showProblem('GP% must be below 100.');
    cost = sell * (1 - gp / 100);
    gpRands = sell - cost;
  } else if (has('sell') && has('rands')) {
    sell = values.sell;
    gpRands = values.rands;
    cost = sell - gpRands;
    gp = sell ? gpRands / sell * 100 : null;
  } else if (has('gp') && has('rands')) {
    gp = values.gp;
    gpRands = values.rands;
    if (gp <= 0) return showProblem('GP% must be above 0 for this calculation.');
    sell = gpRands / (gp / 100);
    cost = sell - gpRands;
  }

  if (![cost, sell, gp, gpRands].every(Number.isFinite)) return showProblem('Check the entered values.');
  if (cost < 0 || sell < 0) return showProblem('Calculation creates a negative value.');

  if (!has('cost')) setField('cost', displayValue('cost', cost));
  if (!has('sell')) setField('sell', displayValue('sell', sell));
  if (!has('gp')) setField('gp', gp);
  if (!has('rands')) setField('rands', gpRands);

  const markup = cost ? gpRands / cost * 100 : null;
  $('markupText').textContent = Number.isFinite(markup) ? `Markup: ${fmt(markup)}%` : 'Markup: N/C';
  $('statusText').textContent = `Using ${label(pair[0])} + ${label(pair[1])}`;
}

function showProblem(message) {
  $('statusText').textContent = message;
}

function renderDeptButton() {
  deptBtn.textContent = selectedDept ? selectedDept.name : 'Dept';
  deptBtn.classList.toggle('dept-active', Boolean(selectedDept));
}

Object.entries(fields).forEach(([name, input]) => {
  input.addEventListener('input', () => {
    if (suppress) return;
    if (name === 'gp' && selectedDept) {
      selectedDept = null;
      renderDeptButton();
    }
    touch(name);
    compute();
  });
});

[costVatBtn, sellVatBtn].forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    btn.textContent = btn.classList.contains('active') ? 'VAT ✓' : 'VAT';
    compute();
  });
});

$('calculateBtn').addEventListener('click', compute);
$('clearBtn').addEventListener('click', () => {
  Object.values(fields).forEach((field) => field.value = '');
  lastManual = [];
  selectedDept = null;
  renderDeptButton();
  $('markupText').textContent = 'Markup: N/C';
  $('statusText').textContent = 'Enter any two values.';
});

deptBtn.addEventListener('click', () => {
  renderDeptChoices();
  $('deptDialog').showModal();
});

function renderDeptChoices() {
  const box = $('deptChoices');
  box.innerHTML = '';
  if (!settings.departments.length) {
    box.innerHTML = '<div class="empty">No departments saved.</div>';
    return;
  }
  settings.departments.forEach((department) => {
    const row = document.createElement('button');
    row.className = 'choice-row';
    row.innerHTML = `<strong>${escapeHtml(department.name)}</strong><span>${fmt(department.gp)}%</span>`;
    row.addEventListener('click', () => {
      selectedDept = { ...department };
      renderDeptButton();
      setField('gp', department.gp);
      touch('gp');
      $('deptDialog').close();
      compute();
    });
    box.appendChild(row);
  });
}

$('settingsBtn').addEventListener('click', () => {
  renderSettings();
  $('settingsDialog').showModal();
});

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => $(button.dataset.close).close());
});

function renderSettings() {
  $('vatRateInput').value = fmt(settings.vatRate);
  $('deptNameInput').value = '';
  $('deptGpInput').value = '';
  $('addDeptBtn').textContent = 'Add Department';
  editingDeptIndex = null;
  renderDepartmentList();
}

function renderDepartmentList() {
  const box = $('departmentList');
  box.innerHTML = '';
  if (!settings.departments.length) {
    box.innerHTML = '<div class="empty">No departments saved.</div>';
    return;
  }
  settings.departments.forEach((department, index) => {
    const row = document.createElement('div');
    row.className = 'dept-row';
    row.innerHTML = `
      <div><strong>${escapeHtml(department.name)}</strong><br><span>${fmt(department.gp)}%</span></div>
      <div class="small-actions">
        <button data-edit="${index}">Edit</button>
        <button class="danger" data-del="${index}">Delete</button>
      </div>`;
    box.appendChild(row);
  });
  box.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.edit);
      editingDeptIndex = index;
      $('deptNameInput').value = settings.departments[index].name;
      $('deptGpInput').value = fmt(settings.departments[index].gp);
      $('addDeptBtn').textContent = 'Save Department';
    });
  });
  box.querySelectorAll('[data-del]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.del);
      if (confirm(`Delete ${settings.departments[index].name}?`)) {
        settings.departments.splice(index, 1);
        saveSettings();
        renderDepartmentList();
      }
    });
  });
}

$('addDeptBtn').addEventListener('click', () => {
  const name = $('deptNameInput').value.trim();
  const gp = toNumber($('deptGpInput').value);
  if (!name || gp === null) {
    alert('Enter a department name and GP %.');
    return;
  }
  const department = { name, gp };
  if (editingDeptIndex === null) settings.departments.push(department);
  else settings.departments[editingDeptIndex] = department;
  saveSettings();
  renderSettings();
});

$('saveSettingsBtn').addEventListener('click', () => {
  const vat = toNumber($('vatRateInput').value);
  if (vat === null || vat < 0) {
    alert('Enter a valid VAT rate.');
    return;
  }
  settings.vatRate = vat;
  saveSettings();
  $('settingsDialog').close();
  compute();
});

$('exportBtn').addEventListener('click', () => {
  saveSettings();
  const data = {
    app: 'Retail Margin Pro',
    version: '1.02',
    exportedAt: new Date().toISOString(),
    settings
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob);
  link.download = `RetailMarginPro_Settings_${date}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const imported = data.settings || data;
    if (typeof imported.vatRate !== 'number' || !Array.isArray(imported.departments)) throw new Error('Invalid file');
    if (!confirm('Import settings? This will replace VAT rate and all departments.')) return;
    settings = {
      vatRate: imported.vatRate,
      departments: imported.departments
        .map((department) => ({ name: String(department.name || '').trim(), gp: Number(department.gp) }))
        .filter((department) => department.name && Number.isFinite(department.gp))
    };
    saveSettings();
    renderSettings();
    alert('Settings restored successfully.');
  } catch {
    alert('Could not import that settings file.');
  } finally {
    event.target.value = '';
  }
});

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

renderDeptButton();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* v1.08-cost-lock */
(function(){
  function n(v){v=parseFloat(String(v||'').replace(',','.'));return isFinite(v)?v:null}
  function sv(el,v){if(el&&isFinite(v))el.value=(Math.round(v*100)/100).toFixed(2)}
  function find(words){words=words.map(w=>w.toLowerCase());for(const i of document.querySelectorAll('input')){let h=((i.id||'')+' '+(i.name||'')+' '+(i.placeholder||'')+' '+(i.getAttribute('aria-label')||'')+' '+((i.closest('label,.field,.input-group,div')||{}).textContent||'')).toLowerCase();if(words.some(w=>h.includes(w)))return i}return null}
  function setup(){
    const btn=document.getElementById('costLockBtn'); if(!btn)return;
    const cost=find(['cost']), gp=find(['gp']), gpRand=find(['gp rands','gp rand','rands']), sell=find(['sell','selling']);
    let locked=localStorage.getItem('rmpCostLocked')==='true', fixed=n(cost&&cost.value);
    function draw(){btn.classList.toggle('locked',locked);btn.innerHTML=locked?'<svg viewBox="0 0 24 24"><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="5" y="10" width="14" height="10" rx="2.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="15" r="1.3" fill="currentColor"/></svg>':'<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 9.5-2.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="5" y="10" width="14" height="10" rx="2.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="15" r="1.3" fill="currentColor"/></svg>';btn.title=locked?'Cost price locked':'Lock cost price'}
    function calc(changed){if(!locked||!cost)return;let c=n(cost.value);if(c!==null)fixed=c;if(fixed===null)return;let g=n(gp&&gp.value), gr=n(gpRand&&gpRand.value), s=n(sell&&sell.value);if(changed===sell&&s!==null){sv(cost,fixed);sv(gpRand,s-fixed);if(s)sv(gp,(s-fixed)/s*100)}else if(changed===gp&&g!==null&&g<100){let ns=fixed/(1-g/100);sv(cost,fixed);sv(sell,ns);sv(gpRand,ns-fixed)}else if(changed===gpRand&&gr!==null){let ns=fixed+gr;sv(cost,fixed);sv(sell,ns);if(ns)sv(gp,gr/ns*100)}else sv(cost,fixed)}
    btn.addEventListener('click',()=>{locked=!locked;let c=n(cost&&cost.value);if(c!==null)fixed=c;localStorage.setItem('rmpCostLocked',locked);draw()});
    [gp,gpRand,sell].forEach(el=>{if(el){el.addEventListener('input',()=>setTimeout(()=>calc(el),0));el.addEventListener('change',()=>setTimeout(()=>calc(el),0))}});
    if(cost)cost.addEventListener('input',()=>{let c=n(cost.value);if(c!==null)fixed=c});
    draw();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',setup):setup();
})();
