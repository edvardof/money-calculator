export const DENOMINATIONS = Object.freeze([10, 20, 50, 100, 200, 500, 1000, 2000, 5000]);
export const COINS = Object.freeze([10, 20, 50, 100, 200]);
export const BILLS = Object.freeze([500, 1000, 2000, 5000]);
export const KEYPAD_ORDER = Object.freeze([10, 20, 50, 100, 1000, 2000, 200, 500, 5000]);
export const STORAGE_KEY = 'money-calculator-pt-v1';
export const BACKUP_FORMAT = 'money-calculator-backup';
const MAX_COUNT = 1_000_000;
const MAX_CLASSES = 200;
const MAX_HISTORY = 300;

export const formatMoney = cents => new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR'
}).format(cents / 100);

export const formatDenomination = cents => cents < 100
  ? `${new Intl.NumberFormat('pt-PT', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(cents/100)} €`
  : `${cents/100} €`;

export function blankCounts() {
  return Object.fromEntries(DENOMINATIONS.map(value => [String(value), 0]));
}

export function makeClass(name, id) {
  return {id, name, counts: blankCounts(), lastTap: null, history: []};
}

export function initialState() {
  return {
    version: 1,
    activeClassId: 'turma-1',
    classes: Array.from({length: 5}, (_, i) => makeClass(`Turma ${i + 1}`, `turma-${i + 1}`))
  };
}

export function sumCounts(counts, denominations = DENOMINATIONS) {
  return denominations.reduce((total, denomination) => total + denomination * counts[String(denomination)], 0);
}

export function aggregateClasses(classes) {
  const counts = blankCounts();
  for (const classroom of classes) {
    for (const d of DENOMINATIONS) counts[String(d)] += classroom.counts[String(d)];
  }
  return { counts, coins: sumCounts(counts, COINS), bills: sumCounts(counts, BILLS), total: sumCounts(counts) };
}

export function pushHistory(classroom) {
  classroom.history.push({counts: {...classroom.counts}, lastTap: classroom.lastTap});
  if (classroom.history.length > MAX_HISTORY) classroom.history.shift();
}

export function tap(classroom, denomination) {
  if (!DENOMINATIONS.includes(denomination)) throw new Error('Denominação inválida.');
  if (classroom.counts[String(denomination)] >= MAX_COUNT) throw new Error('Limite de quantidade atingido.');
  pushHistory(classroom);
  classroom.counts[String(denomination)] += 1;
  classroom.lastTap = denomination;
}

export function correctCount(classroom, denomination, quantity) {
  if (!DENOMINATIONS.includes(denomination)) throw new Error('Denominação inválida.');
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > MAX_COUNT) throw new Error('Quantidade inválida.');
  if (classroom.counts[String(denomination)] === quantity) return false;
  pushHistory(classroom);
  classroom.counts[String(denomination)] = quantity;
  classroom.lastTap = null;
  return true;
}

export function undo(classroom) {
  const old = classroom.history.pop();
  if (!old) return false;
  classroom.counts = {...old.counts};
  classroom.lastTap = old.lastTap;
  return true;
}

export function clearClass(classroom) {
  if (DENOMINATIONS.every(d => classroom.counts[String(d)] === 0)) return false;
  pushHistory(classroom);
  classroom.counts = blankCounts();
  classroom.lastTap = null;
  return true;
}

function safeCounts(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Contagens inválidas no ficheiro.');
  const expected = DENOMINATIONS.map(String);
  if (Object.keys(input).length !== expected.length || !expected.every(k => Object.hasOwn(input,k))) {
    throw new Error('O ficheiro tem denominações em falta ou desconhecidas.');
  }
  const counts = blankCounts();
  for (const k of expected) {
    if (!Number.isSafeInteger(input[k]) || input[k] < 0 || input[k] > MAX_COUNT) {
      throw new Error(`Quantidade inválida na denominação ${k}.`);
    }
    counts[k] = input[k];
  }
  return counts;
}

export function validateState(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1 || !Array.isArray(raw.classes)) {
    throw new Error('Formato de dados não reconhecido.');
  }
  if (raw.classes.length < 1 || raw.classes.length > MAX_CLASSES) throw new Error('Número de turmas inválido.');
  const ids = new Set();
  const classes = raw.classes.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Dados inválidos na turma ${index + 1}.`);
    if (typeof entry.id !== 'string' || !entry.id || entry.id.length > 100 || ids.has(entry.id)) throw new Error('Identificador de turma inválido ou repetido.');
    ids.add(entry.id);
    if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.trim().length > 60) throw new Error('Nome de turma inválido.');
    const counts = safeCounts(entry.counts);
    const lastTap = entry.lastTap == null ? null : entry.lastTap;
    if (lastTap !== null && !DENOMINATIONS.includes(lastTap)) throw new Error('Último toque inválido.');
    const historyInput = entry.history ?? [];
    if (!Array.isArray(historyInput) || historyInput.length > MAX_HISTORY) throw new Error('Histórico de alterações inválido.');
    const history = historyInput.map(h => {
      const hLast = h?.lastTap == null ? null : h.lastTap;
      if (hLast !== null && !DENOMINATIONS.includes(hLast)) throw new Error('Histórico inválido.');
      return {counts: safeCounts(h?.counts), lastTap: hLast};
    });
    return {id:entry.id, name:entry.name.trim(), counts, lastTap, history};
  });
  if (!ids.has(raw.activeClassId)) throw new Error('Turma ativa inválida.');
  return {version:1, activeClassId:raw.activeClassId, classes};
}

export function createBackup(state) {
  const clean = validateState(state);
  return {format:BACKUP_FORMAT, exportedAt:new Date().toISOString(), data:clean};
}

export function parseBackup(json) {
  const backup = JSON.parse(json);
  if (backup?.format !== BACKUP_FORMAT) throw new Error('Este ficheiro não é uma cópia de segurança da Money Calculator.');
  return validateState(backup.data);
}

export function plainSummary(state) {
  const aggregate = aggregateClasses(state.classes);
  const lines = ['MONEY CALCULATOR — RESUMO GERAL',
    `Total: ${formatMoney(aggregate.total)}`,
    `Moedas: ${formatMoney(aggregate.coins)} | Notas: ${formatMoney(aggregate.bills)}`,
    '', 'MOEDAS'];
  for (const d of COINS) lines.push(`${formatDenomination(d)} — ${aggregate.counts[String(d)]} un.`);
  lines.push('', 'NOTAS');
  for (const d of BILLS) lines.push(`${formatDenomination(d)} — ${aggregate.counts[String(d)]} un.`);
  lines.push('', 'TURMAS');
  for (const classroom of state.classes) lines.push(`${classroom.name}: ${formatMoney(sumCounts(classroom.counts))}`);
  return lines.join('\n');
}

export const MAXIMUM_CLASSES = MAX_CLASSES;
export const MAXIMUM_COUNT = MAX_COUNT;
