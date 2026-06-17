"use strict";

const APP_VERSION = "v2.17";
const KEY = "retailMarginPro.v2.settings";
const defaults = {
  vatRate: 15,
  departments: [
    { name: "BUTCHERY MEAT", gp: 32 },
    { name: "CHICKEN", gp: 20 },
    { name: "FRESH PRODUCE", gp: 36 },
    { name: "HMR", gp: 45 },
    { name: "BREAD BOUGHT IN", gp: 15 },
    { name: "BREAD", gp: 30 },
    { name: "CONFECTIONARY BOUGHT IN", gp: 36 },
    { name: "CONFECTIONARY", gp: 55 },
    { name: "GROCERIES", gp: 24 },
    { name: "HEALTH & BEAUTY", gp: 22 },
    { name: "NON FOODS", gp: 24 },
    { name: "PERISHABLES", gp: 22 },
    { name: "EGGS", gp: 24 },
    { name: "FROZENS", gp: 22 },
    { name: "GIFTS", gp: 24 }
  ]
};

const $ = id => document.getElementById(id);
const displays = {
  cost: $("costDisplay"),
  gp: $("gpDisplay"),
  sell: $("sellDisplay"),
  rands: $("randsDisplay")
};

let settings = loadSettings();
let values = { cost: "", gp: "", sell: "", rands: "" };
let lastManual = [];
let activeField = "cost";
let replaceOnNextKey = true;
let arithmeticLeft = null;
let arithmeticOp = null;
let costVat = false;
let sellVat = false;
let costLocked = false;
let lockedCostExcl = null;
let selectedDept = null;
let editingDeptIndex = null;

function loadSettings(){
  try{
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      vatRate: typeof saved.vatRate === "number" ? saved.vatRate : defaults.vatRate,
      departments: Array.isArray(saved.departments) ? saved.departments : defaults.departments
    };
  }catch{
    return structuredClone(defaults);
  }
}
function saveSettings(){
  localStorage.setItem(KEY, JSON.stringify(settings));
}
function num(str){
  if (typeof str === "number") return Number.isFinite(str) ? str : null;
  const cleaned = String(str ?? "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
function fmt(n){
  return Number.isFinite(n) ? (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2) : "0.00";
}
function vatFactor(){ return 1 + settings.vatRate / 100; }
function displayToExcl(field){
  let n = num(values[field]);
  if (n === null) return null;
  if (field === "cost" && costVat) n /= vatFactor();
  if (field === "sell" && sellVat) n /= vatFactor();
  return n;
}
function exclToDisplay(field, n){
  if (field === "cost" && costVat) return n * vatFactor();
  if (field === "sell" && sellVat) return n * vatFactor();
  return n;
}
function setValue(field, n){
  values[field] = fmt(n);
  displays[field].textContent = values[field];
}
function setRaw(field, raw){
  values[field] = raw;
  displays[field].textContent = raw || "0.00";
}
function touch(field){
  lastManual = lastManual.filter(x => x !== field);
  lastManual.push(field);
  if (lastManual.length > 2) lastManual.shift();
}
function setActive(field){
  const changed = activeField !== field;
  activeField = field;
  if (changed) {
    replaceOnNextKey = true;
    arithmeticLeft = null;
    arithmeticOp = null;
  }
  document.querySelectorAll(".calc-row").forEach(row => {
    row.classList.toggle("active", row.dataset.field === field);
  });
  $("statusText").textContent = "Active Field: " + label(field);
}
function label(field){
  return { cost:"Cost", gp:"GP %", sell:"Sell", rands:"GP Rands" }[field];
}
function shortDeptName(name){
  if (!name) return "Dept";
  const clean = String(name).trim().toUpperCase();
  const map = {
    "CONFECTIONARY BOUGHT IN": "CONF B/I",
    "CONFECTIONARY": "CONF",
    "BREAD BOUGHT IN": "BREAD B/I",
    "BREAD": "BREAD",
    "HEALTH & BEAUTY": "H&B",
    "FRESH PRODUCE": "FRESH",
    "BUTCHERY MEAT": "MEAT",
    "CHICKEN": "CHICKEN",
    "GROCERIES": "GROC",
    "NON FOODS": "NON FOOD",
    "PERISHABLES": "PERISH",
    "FROZENS": "FROZEN",
    "GIFTS": "GIFTS",
    "EGGS": "EGGS",
    "HMR": "HMR"
  };
  if (map[clean]) return map[clean];
  if (clean.length <= 8) return clean;
  return clean.slice(0, 7).trim() + "…";
}

function updateGpDeptName(){
  const label = document.getElementById("gpDeptName");
  if (!label) return;
  label.textContent = selectedDept ? selectedDept.name : "";
  label.title = selectedDept ? selectedDept.name : "";
}

function renderToggles(){
  $("costVatBtn").classList.toggle("active", costVat);
  $("costVatBtn").textContent = costVat ? "VAT ✓" : "VAT";
  $("sellVatBtn").classList.toggle("active", sellVat);
  $("sellVatBtn").textContent = sellVat ? "VAT ✓" : "VAT";
  $("costLockBtn").classList.toggle("active", costLocked);
  $("costLockBtn").textContent = costLocked ? "🔒" : "🔓";
  $("deptBtn").textContent = "Dept";
  $("deptBtn").title = selectedDept ? selectedDept.name : "Select Department";
  updateGpDeptName();
  $("deptBtn").classList.toggle("active", Boolean(selectedDept));
}
function showProblem(message){
  $("statusText").textContent = message;
}

function compute(){
  let pair = lastManual.filter(f => num(values[f]) !== null).slice(-2);

  if (costLocked){
    const c = displayToExcl("cost");
    if (Number.isFinite(c)) lockedCostExcl = c;
    const driver = [...lastManual].reverse().find(f => f !== "cost" && num(values[f]) !== null);
    if (!Number.isFinite(lockedCostExcl)){
      $("markupText").textContent = "Markup: N/C";
      return showProblem("Enter Cost before locking.");
    }
    if (!driver){
      $("markupText").textContent = "Markup: N/C";
      return showProblem("Cost locked. Enter GP %, Sell or GP Rands.");
    }
    pair = ["cost", driver];
  }

  if (pair.length < 2){
    $("markupText").textContent = "Markup: N/C";
    return;
  }

  const has = f => pair.includes(f);
  const v = {};
  pair.forEach(f => v[f] = (costLocked && f === "cost") ? lockedCostExcl : displayToExcl(f));

  let cost, sell, gp, rands;

  if (has("cost") && has("gp")){
    cost = v.cost; gp = v.gp;
    if (gp >= 100) return showProblem("GP% must be below 100.");
    sell = cost / (1 - gp / 100);
    rands = sell - cost;
  } else if (has("cost") && has("rands")){
    cost = v.cost; rands = v.rands;
    sell = cost + rands;
    gp = sell ? rands / sell * 100 : null;
  } else if (has("cost") && has("sell")){
    cost = v.cost; sell = v.sell;
    rands = sell - cost;
    gp = sell ? rands / sell * 100 : null;
  } else if (has("sell") && has("gp")){
    sell = v.sell; gp = v.gp;
    if (gp >= 100) return showProblem("GP% must be below 100.");
    cost = sell * (1 - gp / 100);
    rands = sell - cost;
  } else if (has("sell") && has("rands")){
    sell = v.sell; rands = v.rands;
    cost = sell - rands;
    gp = sell ? rands / sell * 100 : null;
  } else if (has("gp") && has("rands")){
    gp = v.gp; rands = v.rands;
    if (gp <= 0) return showProblem("GP% must be above 0.");
    sell = rands / (gp / 100);
    cost = sell - rands;
  }

  if (![cost, sell, gp, rands].every(Number.isFinite)) return showProblem("Check values.");
  if (cost < 0 || sell < 0) return showProblem("Negative value created.");

  if (!costLocked && !has("cost")) setValue("cost", exclToDisplay("cost", cost));
  if (!has("sell")) setValue("sell", exclToDisplay("sell", sell));
  if (!has("gp")) setValue("gp", gp);
  if (!has("rands")) setValue("rands", rands);

  const markup = cost ? rands / cost * 100 : null;
  $("markupText").textContent = Number.isFinite(markup) ? "Markup: " + fmt(markup) + "%" : "Markup: N/C";
  $("statusText").textContent = costLocked ? "Cost locked. Using Cost + " + label(pair[1]) : "Active Field: " + label(activeField);
}

function appendKey(k){
  let cur = values[activeField] || "";
  if (replaceOnNextKey) {
    cur = "";
    replaceOnNextKey = false;
  }
  if (cur === "0.00" || cur === "0") cur = "";
  if (k === "." && cur.includes(".")) return;
  if (cur.length > 12) return;
  setRaw(activeField, cur + k);
  if (activeField === "gp" && selectedDept){
    selectedDept = null;
    renderToggles();
  }
  if (costLocked && activeField === "cost"){
    const c = displayToExcl("cost");
    if (Number.isFinite(c)) lockedCostExcl = c;
    $("statusText").textContent = "Cost locked. Cost updated.";
    return;
  }
  touch(activeField);
  compute();
}
function backspace(){
  replaceOnNextKey = false;
  const cur = values[activeField] || "";
  setRaw(activeField, cur.slice(0, -1));
  if (costLocked && activeField === "cost"){
    const c = displayToExcl("cost");
    if (Number.isFinite(c)) lockedCostExcl = c;
    return;
  }
  touch(activeField);
  compute();
}
function clearField(){
  Object.keys(values).forEach(field => {
    if (costLocked && field === "cost") return;
    setRaw(field, "");
  });
  if (!costLocked) lockedCostExcl = null;
  selectedDept = null;
  arithmeticLeft = null;
  arithmeticOp = null;
  lastManual = [];
  replaceOnNextKey = true;
  renderToggles();
  $("markupText").textContent = "Markup: N/C";
  $("statusText").textContent = costLocked ? "Cost locked. Other fields cleared." : "All fields cleared.";
}
function signToggle(){
  const cur = values[activeField] || "";
  setRaw(activeField, cur.startsWith("-") ? cur.slice(1) : "-" + cur);
  touch(activeField);
  compute();
}
function enter(){
  replaceOnNextKey = true;
  const n = num(values[activeField]);
  if (n !== null) setRaw(activeField, fmt(n));
  touch(activeField);
  compute();
}

document.querySelectorAll(".calc-row").forEach(row => {
  row.addEventListener("click", e => {
    const target = e.target;
    const field = row.dataset.field;
    if (target.id === "costVatBtn"){
      costVat = !costVat;
      if (costLocked && Number.isFinite(lockedCostExcl)) setValue("cost", exclToDisplay("cost", lockedCostExcl));
      renderToggles(); compute(); return;
    }
    if (target.id === "sellVatBtn"){
      sellVat = !sellVat; renderToggles(); compute(); return;
    }
    if (target.id === "costLockBtn"){
      if (!costLocked){
        const c = displayToExcl("cost");
        if (!Number.isFinite(c)) return showProblem("Enter Cost before locking.");
        lockedCostExcl = c;
        costLocked = true;
      } else {
        costLocked = false;
        lockedCostExcl = null;
      }
      renderToggles(); compute(); return;
    }
    if (target.id === "deptBtn"){
      renderDeptChoices();
      $("deptDialog").showModal();
      return;
    }
    setActive(field);
    replaceOnNextKey = true;
  });
});


function applyOperator(op){
  const current = num(values[activeField]);
  if (!Number.isFinite(current)) return;
  arithmeticLeft = current;
  arithmeticOp = op;
  replaceOnNextKey = true;
  $("statusText").textContent = `${label(activeField)}: ${fmt(arithmeticLeft)} ${opSymbol(op)}`;
}

function opSymbol(op){
  return { "+": "+", "-": "−", "*": "×", "/": "÷" }[op] || op;
}

function equals(){
  if (!arithmeticOp || !Number.isFinite(arithmeticLeft)) return;
  const right = num(values[activeField]);
  if (!Number.isFinite(right)) return;
  let result = null;
  if (arithmeticOp === "+") result = arithmeticLeft + right;
  if (arithmeticOp === "-") result = arithmeticLeft - right;
  if (arithmeticOp === "*") result = arithmeticLeft * right;
  if (arithmeticOp === "/") {
    if (right === 0) {
      showProblem("Cannot divide by zero.");
      arithmeticLeft = null;
      arithmeticOp = null;
      return;
    }
    result = arithmeticLeft / right;
  }
  if (!Number.isFinite(result)) return;
  setRaw(activeField, fmt(result));
  arithmeticLeft = null;
  arithmeticOp = null;
  replaceOnNextKey = true;
  if (activeField === "gp" && selectedDept){
    selectedDept = null;
    renderToggles();
  }
  if (costLocked && activeField === "cost"){
    const c = displayToExcl("cost");
    if (Number.isFinite(c)) lockedCostExcl = c;
    $("statusText").textContent = "Cost locked. Arithmetic result saved.";
    return;
  }
  touch(activeField);
  compute();
}


document.querySelector(".keypad").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.key) appendKey(btn.dataset.key);
  if (btn.dataset.op) applyOperator(btn.dataset.op);
  if (btn.dataset.action === "back") backspace();
  if (btn.dataset.action === "clear-field") clearField();
  if (btn.dataset.action === "sign") signToggle();
  if (btn.dataset.action === "equals") equals();
  if (btn.dataset.action === "enter") enter();
});

$("settingsBtn").addEventListener("click", () => {
  $("vatRateInput").value = fmt(settings.vatRate);
  renderDepartmentList();
  $("settingsDialog").showModal();
});
document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => $(btn.dataset.close).close());
});

function renderDeptChoices(){
  const box = $("deptChoices");
  box.innerHTML = "";
  settings.departments.forEach(dept => {
    const row = document.createElement("button");
    row.type = "button";
    row.innerHTML = `<strong>${dept.name}</strong><span>${fmt(dept.gp)}%</span>`;
    row.addEventListener("click", () => {
      selectedDept = dept;
      setActive("gp");
      setRaw("gp", fmt(dept.gp));
      touch("gp");
      renderToggles();
      $("deptDialog").close();
      replaceOnNextKey = true;
      compute();
    });
    box.appendChild(row);
  });
}
function renderDepartmentList(){
  const list = $("departmentList");
  list.innerHTML = "";
  settings.departments.forEach((dept, index) => {
    const row = document.createElement("div");
    row.className = "dept-row";
    row.innerHTML = `<span><strong>${dept.name}</strong><br>${fmt(dept.gp)}%</span>
      <span><button type="button" data-edit="${index}">Edit</button> <button type="button" data-del="${index}">Delete</button></span>`;
    list.appendChild(row);
  });
}
$("departmentList").addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-del]");
  if (edit){
    editingDeptIndex = Number(edit.dataset.edit);
    const dept = settings.departments[editingDeptIndex];
    $("deptNameInput").value = dept.name;
    $("deptGpInput").value = fmt(dept.gp);
    $("addDeptBtn").textContent = "Update Department";
  }
  if (del){
    settings.departments.splice(Number(del.dataset.del), 1);
    renderDepartmentList();
  }
});
$("addDeptBtn").addEventListener("click", () => {
  const name = $("deptNameInput").value.trim().toUpperCase();
  const gp = num($("deptGpInput").value);
  if (!name || !Number.isFinite(gp)) return;
  if (editingDeptIndex !== null){
    settings.departments[editingDeptIndex] = { name, gp };
    editingDeptIndex = null;
    $("addDeptBtn").textContent = "Add Department";
  } else {
    settings.departments.push({ name, gp });
  }
  $("deptNameInput").value = "";
  $("deptGpInput").value = "";
  renderDepartmentList();
});
$("saveSettingsBtn").addEventListener("click", () => {
  const vat = num($("vatRateInput").value);
  if (Number.isFinite(vat)) settings.vatRate = vat;
  saveSettings();
  $("settingsDialog").close();
  compute();
});
$("exportBtn").addEventListener("click", () => {
  const payload = { app:"Retail Margin Pro", version:APP_VERSION, vatRate:settings.vatRate, departments:settings.departments };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `RetailMarginPro_Backup_${APP_VERSION}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try{
    const data = JSON.parse(await file.text());
    if (typeof data.vatRate === "number") settings.vatRate = data.vatRate;
    if (Array.isArray(data.departments)) settings.departments = data.departments;
    saveSettings();
    renderDepartmentList();
  }catch{
    alert("Could not import settings.");
  }
});

setActive("cost");
renderToggles();






// v2.17 force reload from server
const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");
const updateStatus = document.getElementById("updateStatus");

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  if (!window.isSecureContext && location.hostname !== "localhost") return null;

  try {
    return await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
  } catch (error) {
    return null;
  }
}

const swReady = registerServiceWorker();

async function forceReloadFromServer() {
  if (!updateStatus) return;

  if (!navigator.onLine) {
    updateStatus.textContent = "You appear to be offline. Connect to the internet and try again.";
    return;
  }

  updateStatus.textContent = "Clearing cache and reloading from server...";

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    const stamp = Date.now();
    const cleanPath = window.location.pathname.replace(/\/$/, "/index.html");
    const target = window.location.origin + cleanPath + "?serverReload=" + stamp;
    window.location.replace(target);
  } catch (error) {
    updateStatus.textContent = "Could not force reload. Try closing and reopening the app.";
  }
}

if (checkUpdatesBtn) {
  checkUpdatesBtn.textContent = "Force Reload from Server";
  if (updateStatus) updateStatus.textContent = "Reloads the latest hosted files from the server.";
  checkUpdatesBtn.addEventListener("click", forceReloadFromServer);
}



// v2.17 landscape layout fallback for iOS PWA rotation behavior
function updateLandscapeLayoutClass() {
  const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth >= 640;
  document.body.classList.toggle("is-landscape-layout", isLandscape);
}
window.addEventListener("resize", updateLandscapeLayoutClass);
window.addEventListener("orientationchange", () => setTimeout(updateLandscapeLayoutClass, 120));
updateLandscapeLayoutClass();

