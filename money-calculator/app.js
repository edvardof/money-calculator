import {
  DENOMINATIONS, COINS, BILLS, KEYPAD_ORDER, STORAGE_KEY,
  MAXIMUM_CLASSES, MAXIMUM_COUNT,
  initialState, makeClass, blankCounts, formatMoney, formatDenomination,
  sumCounts, aggregateClasses, tap, correctCount, undo, clearClass,
  validateState, createBackup, parseBackup, plainSummary
} from './state.js';

const $ = id => document.getElementById(id);
let state;
let savingBlocked = false;
let damagedRawData = null;
let currentView = 'calculator';
let modalAction = null;
let toastTimer = null;

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      state = initialState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      try {
        state = validateState(JSON.parse(saved));
      } catch (error) {
        damagedRawData = saved;
        throw new Error(`Os dados guardados não puderam ser lidos (${error.message}). Não foram substituídos.`);
      }
    }
  } catch (error) {
    savingBlocked = true;
    state ||= initialState();
    showWarning(`ATENÇÃO: ${error.message} A contagem está bloqueada para evitar perda de dinheiro registado.`);
  }
}

function showWarning(message) {
  const el = $('storageWarning');
  el.replaceChildren();
  const label = document.createElement('span');
  label.textContent = message;
  el.append(label);
  if (damagedRawData !== null) {
    const button = document.createElement('button');
    button.className = 'toolbar-button';
    button.textContent = 'Guardar ficheiro para recuperação';
    button.addEventListener('click', () => downloadFile('money-calculator-recuperacao.txt', damagedRawData, 'text/plain'));
    el.append(' ', button);
  }
  el.hidden = false;
  $('saveStatus').textContent = 'Erro de armazenamento';
}

function commit(change) {
  if (savingBlocked) {
    notify('Contagem bloqueada: não é possível guardar dados.');
    return false;
  }
  const next = JSON.parse(JSON.stringify(state));
  try {
    const didChange = change(next);
    if (didChange === false) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); // Guardar ANTES de atualizar o ecrã.
    state = next;
    render();
    return true;
  } catch (error) {
    savingBlocked = true;
    showWarning(`Não foi possível gravar a última alteração (${error.message}). Essa alteração NÃO foi registada. Liberta espaço no telemóvel e exporta uma cópia de segurança.`);
    render();
    return false;
  }
}

function activeClass() {
  return state.classes.find(c => c.id === state.activeClassId) || state.classes[0];
}

function render() {
  $('currentClassName').textContent = activeClass().name;
  const classroom = activeClass();
  const counts = classroom.counts;
  $('grandTotal').textContent = formatMoney(sumCounts(counts));
  $('coinsTotal').textContent = formatMoney(sumCounts(counts, COINS));
  $('billsTotal').textContent = formatMoney(sumCounts(counts, BILLS));
  renderCounts($('coinCounts'), COINS, classroom, true);
  renderCounts($('billCounts'), BILLS, classroom, true);
  $('lastKeyValue').textContent = classroom.lastTap === null ? 'Nenhuma' : formatDenomination(classroom.lastTap);
  $('lastKeyQuantity').textContent = classroom.lastTap === null ? '' : `× ${counts[String(classroom.lastTap)]}`;
  for (const button of $('keypad').children) {
    button.classList.toggle('latest', Number(button.dataset.denomination) === classroom.lastTap);
    button.disabled = savingBlocked;
  }
  $('undoButton').disabled = savingBlocked || classroom.history.length === 0;
  $('clearButton').disabled = savingBlocked || DENOMINATIONS.every(d => counts[String(d)] === 0);
  $('saveStatus').textContent = savingBlocked ? 'Não guardado' : '✓ Guardado no dispositivo';
  $('addClass').disabled = savingBlocked || state.classes.length >= MAXIMUM_CLASSES;
  renderClassMenu();
  if (currentView === 'summary') renderSummary();
}

function renderCounts(target, denominations, classroom, editable) {
  const fragment = document.createDocumentFragment();
  for (const d of denominations) {
    const row = document.createElement(editable ? 'button' : 'div');
    row.className = 'denomination-row';
    if (d === classroom.lastTap) row.classList.add('most-recent');
    if (editable) {
      row.type = 'button';
      row.title = `Corrigir quantidade de ${formatDenomination(d)}`;
      row.setAttribute('aria-label', `${formatDenomination(d)}: ${classroom.counts[String(d)]} unidades. Toque para corrigir.`);
      row.disabled = savingBlocked;
      row.addEventListener('click', () => editDenomination(d));
    }
    const label = document.createElement('span');
    label.textContent = formatDenomination(d);
    const quantity = document.createElement('span');
    quantity.className = 'quantity';
    quantity.textContent = String(classroom.counts[String(d)]);
    if (editable) {
      const pencil = document.createElement('span');
      pencil.className = 'edit-indicator';
      pencil.textContent = '✎';
      quantity.appendChild(pencil);
    }
    row.append(label, quantity);
    fragment.appendChild(row);
  }
  target.replaceChildren(fragment);
}

function renderClassMenu() {
  const frag = document.createDocumentFragment();
  for (const classroom of state.classes) {
    const row = document.createElement('div');
    row.className = `class-row${classroom.id === state.activeClassId ? ' active' : ''}`;
    const choose = document.createElement('button');
    choose.type = 'button';
    choose.className = 'class-choose';
    choose.title = classroom.name;
    choose.setAttribute('aria-label', `Selecionar ${classroom.name}`);
    const name = document.createElement('span');
    name.className = 'row-name';
    name.textContent = classroom.name;
    choose.append(name);
    if (classroom.id === state.activeClassId) {
      const check = document.createElement('span');
      check.className = 'class-check';
      check.textContent = ' ✓';
      name.append(check);
    }
    choose.addEventListener('click', () => {
      commit(draft => { draft.activeClassId = classroom.id; });
      closeMenu();
    });
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'class-edit';
    edit.textContent = '✎';
    edit.title = `Alterar nome de ${classroom.name}`;
    edit.setAttribute('aria-label', `Alterar nome de ${classroom.name}`);
    edit.disabled = savingBlocked;
    edit.addEventListener('click', () => { closeMenu(); renameClass(classroom.id); });
    row.append(choose, edit);
    frag.appendChild(row);
  }
  $('classList').replaceChildren(frag);
}

function openMenu() {
  $('classMenu').hidden = false;
  $('classToggle').setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  $('classMenu').hidden = true;
  $('classToggle').setAttribute('aria-expanded', 'false');
}

function createKeypad() {
  const frag = document.createDocumentFragment();
  for (const denomination of KEYPAD_ORDER) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `money-key${BILLS.includes(denomination) ? ' bill' : ''}`;
    button.dataset.denomination = String(denomination);
    button.textContent = formatDenomination(denomination);
    button.setAttribute('aria-label', `Adicionar ${formatDenomination(denomination)}`);
    button.addEventListener('pointerdown', () => button.classList.add('is-pressed'));
    for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
      button.addEventListener(eventName, () => button.classList.remove('is-pressed'));
    }
    button.addEventListener('click', () => {
      const ok = commit(draft => tap(draft.classes.find(c => c.id === draft.activeClassId), denomination));
      if (ok) {
        button.classList.remove('flash');
        void button.offsetWidth;
        button.classList.add('flash');
        setTimeout(() => button.classList.remove('flash'), 350);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    });
    frag.appendChild(button);
  }
  $('keypad').appendChild(frag);
}

function showModal({title, description = '', label, initialValue, inputType = 'text', confirmText = 'Guardar', danger = false, onConfirm}) {
  modalAction = onConfirm;
  $('dialogTitle').textContent = title;
  $('dialogDescription').textContent = description;
  $('dialogDescription').hidden = description === '';
  $('dialogInputWrap').hidden = initialValue === undefined;
  $('dialogInputLabel').textContent = label || '';
  $('dialogInput').type = inputType;
  $('dialogInput').value = initialValue === undefined ? '' : String(initialValue);
  $('dialogInput').maxLength = inputType === 'text' ? 60 : -1;
  if (inputType === 'number') {
    $('dialogInput').min = '0';
    $('dialogInput').max = String(MAXIMUM_COUNT);
    $('dialogInput').step = '1';
    $('dialogInput').inputMode = 'numeric';
  }
  $('dialogError').hidden = true;
  $('dialogConfirm').textContent = confirmText;
  $('dialogConfirm').classList.toggle('danger', danger);
  $('dialogConfirm').classList.toggle('primary', !danger);
  $('actionDialog').showModal();
  if (initialValue !== undefined) setTimeout(() => $('dialogInput').focus(), 40);
}
function modalError(message) {
  $('dialogError').textContent = message;
  $('dialogError').hidden = false;
}

function validateName(name, idToIgnore = null) {
  const cleaned = name.trim();
  if (!cleaned || cleaned.length > 60) throw new Error('Escreve um nome entre 1 e 60 caracteres.');
  if (state.classes.some(c => c.id !== idToIgnore && c.name.toLocaleLowerCase('pt-PT') === cleaned.toLocaleLowerCase('pt-PT'))) {
    throw new Error('Já existe uma turma com esse nome.');
  }
  return cleaned;
}

function nextClassName() {
  let n = Math.max(6, state.classes.length + 1);
  const names = new Set(state.classes.map(c => c.name.toLocaleLowerCase('pt-PT')));
  while (names.has(`turma ${n}`)) n++;
  return `Turma ${n}`;
}

function addClass() {
  closeMenu();
  if (state.classes.length >= MAXIMUM_CLASSES) return notify('Limite de turmas atingido.');
  showModal({
    title:'Adicionar turma', description:'Escolhe o nome que queres ver no seletor.', label:'Nome da turma', initialValue:nextClassName(),
    confirmText:'Adicionar', onConfirm:value => {
      const name = validateName(value);
      const id = `turma-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
      return commit(draft => { draft.classes.push(makeClass(name, id)); draft.activeClassId = id; });
    }
  });
}

function renameClass(id) {
  const classroom = state.classes.find(c => c.id === id);
  if (!classroom) return;
  showModal({
    title:'Alterar nome', description:'A contagem desta turma mantém-se intacta.', label:'Nome da turma', initialValue:classroom.name,
    onConfirm:value => {
      const name = validateName(value, id);
      return commit(draft => { draft.classes.find(c => c.id === id).name = name; });
    }
  });
}

function editDenomination(denomination) {
  const classroom = activeClass();
  showModal({
    title:`Corrigir ${formatDenomination(denomination)}`,
    description:`Turma: ${classroom.name}. Escreve o número de unidades, não o valor em euros.`,
    label:'Quantidade', inputType:'number', initialValue:classroom.counts[String(denomination)],
    confirmText:'Atualizar', onConfirm:raw => {
      const count = Number(raw);
      if (raw.trim() === '' || !Number.isSafeInteger(count) || count < 0 || count > MAXIMUM_COUNT) {
        throw new Error('Introduz uma quantidade inteira e não negativa.');
      }
      if (count === activeClass().counts[String(denomination)]) return true;
      return commit(draft => correctCount(draft.classes.find(c => c.id === classroom.id), denomination, count));
    }
  });
}

function resetClass() {
  const classroom = activeClass();
  showModal({
    title:'Limpar turma?',
    description:`Vais colocar a zero as moedas e notas de “${classroom.name}”. Poderás usar “Desfazer” depois da limpeza, mas recomenda-se exportar uma cópia primeiro.`,
    confirmText:'Sim, limpar', danger:true,
    onConfirm:() => commit(draft => clearClass(draft.classes.find(c => c.id === classroom.id)))
  });
}

function renderSummary() {
  const aggregate = aggregateClasses(state.classes);
  $('overallTotal').textContent = formatMoney(aggregate.total);
  $('overallCoins').textContent = formatMoney(aggregate.coins);
  $('overallBills').textContent = formatMoney(aggregate.bills);
  const renderAggregate = (target, values) => {
    const frag = document.createDocumentFragment();
    for (const d of values) {
      const row = document.createElement('div');
      row.className = 'denomination-row';
      const amount = document.createElement('span');
      amount.textContent = formatDenomination(d);
      const count = document.createElement('span');
      count.className = 'quantity';
      count.textContent = String(aggregate.counts[String(d)]);
      row.append(amount,count);
      frag.appendChild(row);
    }
    target.replaceChildren(frag);
  };
  renderAggregate($('summaryCoins'), COINS);
  renderAggregate($('summaryBills'), BILLS);
  const frag = document.createDocumentFragment();
  for (const classroom of state.classes) {
    const row = document.createElement('div');
    row.className = 'class-total-row';
    const name = document.createElement('span');
    name.textContent = classroom.name;
    const total = document.createElement('strong');
    total.textContent = formatMoney(sumCounts(classroom.counts));
    row.append(name, total);
    frag.appendChild(row);
  }
  $('classTotals').replaceChildren(frag);
}

function setView(view) {
  currentView = view;
  closeMenu();
  $('calculatorView').hidden = view !== 'calculator';
  $('summaryView').hidden = view !== 'summary';
  $('classControl').hidden = view === 'summary';
  $('backButton').hidden = view !== 'summary';
  $('summaryButton').hidden = view === 'summary';
  $('summaryHeader').hidden = view !== 'summary';
  if (view === 'summary') {
    renderSummary();
    $('summaryView').scrollTop = 0;
  }
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function exportBackup() {
  const today = new Date().toLocaleDateString('sv-SE');
  downloadFile(`money-calculator-${today}.json`, JSON.stringify(createBackup(state), null, 2), 'application/json');
  closeMenu();
  notify('Cópia criada. Guarda o ficheiro num local seguro.');
}

async function importBackup(file) {
  if (!file) return;
  if (file.size > 30_000_000) return notify('Ficheiro demasiado grande.');
  let imported;
  try {
    imported = parseBackup(await file.text());
  } catch (error) {
    notify(`Importação recusada: ${error.message}`, 5000);
    return;
  }
  showModal({
    title:'Substituir todas as contagens?',
    description:`A cópia contém ${imported.classes.length} turma(s). Se continuares, vai substituir TODAS as turmas e contagens atualmente guardadas neste telemóvel. Exporta primeiro uma cópia dos dados atuais.`,
    confirmText:'Substituir dados', danger:true,
    onConfirm:() => commit(draft => {
      draft.version = imported.version;
      draft.activeClassId = imported.activeClassId;
      draft.classes = imported.classes;
    })
  });
}

function notify(message, duration = 2600) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {toast.hidden = true;}, duration);
}

function bind() {
  $('classToggle').addEventListener('click', () => $('classMenu').hidden ? openMenu() : closeMenu());
  document.addEventListener('click', event => {
    if (!$('classControl').contains(event.target)) closeMenu();
  });
  $('addClass').addEventListener('click', addClass);
  $('backupExport').addEventListener('click', exportBackup);
  $('backupImport').addEventListener('click', () => { closeMenu(); $('fileInput').click(); });
  $('fileInput').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    await importBackup(file);
  });
  $('undoButton').addEventListener('click', () => commit(draft => undo(draft.classes.find(c => c.id === draft.activeClassId))));
  $('clearButton').addEventListener('click', resetClass);
  $('summaryButton').addEventListener('click', () => setView('summary'));
  $('backButton').addEventListener('click', () => setView('calculator'));
  $('exportFromSummary').addEventListener('click', exportBackup);
  $('copySummary').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard indisponível');
      await navigator.clipboard.writeText(plainSummary(state));
      notify('Resumo copiado.');
    } catch {
      downloadFile('money-calculator-resumo.txt', plainSummary(state), 'text/plain;charset=utf-8');
      notify('Resumo guardado em ficheiro de texto.');
    }
  });
  $('dialogCancel').addEventListener('click', () => $('actionDialog').close());
  $('dialogForm').addEventListener('submit', event => {
    event.preventDefault();
    if (typeof modalAction !== 'function') return;
    try {
      const result = modalAction($('dialogInput').value);
      if (result !== false) $('actionDialog').close();
      else modalError('A alteração não foi guardada.');
    } catch (error) {
      modalError(error.message);
    }
  });
  $('actionDialog').addEventListener('close', () => { modalAction = null; });
}

function registerOffline() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.warn('Instalação offline não disponível:', error);
      notify('Offline não disponível. Confirma se todos os ficheiros estão no GitHub.', 6000);
    });
  }
}

load();
bind();
createKeypad();
render();
registerOffline();
