import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DENOMINATIONS, COINS, BILLS, KEYPAD_ORDER,
  initialState, makeClass, blankCounts, sumCounts, aggregateClasses,
  tap, undo, correctCount, clearClass, validateState, createBackup, parseBackup, plainSummary
} from '../state.js';

test('cinco turmas inicialmente criadas e nomes certos', () => {
  const data = initialState();
  assert.deepEqual(data.classes.map(c => c.name), ['Turma 1','Turma 2','Turma 3','Turma 4','Turma 5']);
  assert.equal(data.classes[0].id, data.activeClassId);
});

test('nove denominações, moedas e notas corretas', () => {
  assert.deepEqual(KEYPAD_ORDER, [10,20,50,100,1000,2000,200,500,5000]);
  assert.deepEqual(COINS, [10,20,50,100,200]);
  assert.deepEqual(BILLS, [500,1000,2000,5000]);
  assert.equal(DENOMINATIONS.length, 9);
});

test('envelope de 15 € com duas notas de 5, moeda de 2, três moedas de 1', () => {
  const turma = makeClass('1.º A', 'a');
  for (const d of [500,500,200,100,100,100]) tap(turma,d);
  assert.equal(sumCounts(turma.counts), 1500);
  assert.equal(sumCounts(turma.counts, COINS), 500);
  assert.equal(sumCounts(turma.counts, BILLS), 1000);
  assert.equal(turma.counts['500'], 2);
  assert.equal(turma.counts['100'], 3);
  assert.equal(turma.lastTap, 100);
});

test('todos os botões incrementam uma unidade e não sofrem arredondamento', () => {
  const turma = makeClass('Turma', 'x');
  for (let n=0; n<101; n++) for (const d of DENOMINATIONS) tap(turma,d);
  for (const d of DENOMINATIONS) assert.equal(turma.counts[String(d)], 101);
  assert.equal(sumCounts(turma.counts), 101 * DENOMINATIONS.reduce((sum,x) => sum+x,0));
  assert.equal(turma.history.length, 300);
});

test('desfazer toque recupera contagens e última tecla', () => {
  const turma = makeClass('Turma', 'x');
  tap(turma,10); tap(turma,20); tap(turma,20);
  assert.equal(undo(turma), true);
  assert.equal(turma.counts['20'],1);
  assert.equal(turma.lastTap,20);
  assert.equal(undo(turma), true);
  assert.equal(turma.lastTap,10);
  assert.equal(undo(turma), true);
  assert.equal(turma.lastTap,null);
  assert.equal(undo(turma),false);
});

test('corrigir quantidade, limpar e desfazer limpeza', () => {
  const turma = makeClass('Turma','x');
  tap(turma,200);
  correctCount(turma,200,40);
  assert.equal(sumCounts(turma.counts),8000);
  assert.equal(clearClass(turma),true);
  assert.deepEqual(turma.counts,blankCounts());
  undo(turma);
  assert.equal(turma.counts['200'],40);
  undo(turma);
  assert.equal(turma.counts['200'],1);
});

test('quantidades negativas e denominações inválidas são recusadas', () => {
  const turma = makeClass('Turma','x');
  assert.throws(()=>tap(turma,123));
  assert.throws(()=>correctCount(turma,20,-1));
  assert.throws(()=>correctCount(turma,20,1.5));
  assert.throws(()=>correctCount(turma,20,NaN));
  assert.throws(()=>correctCount(turma,20,1000001));
});

test('agregação de quatro turmas: 40 + 34 + 10 + 5 = 89 moedas de 0,20 €', () => {
  const data = initialState();
  [40,34,10,5].forEach((quantity,index)=>correctCount(data.classes[index],20,quantity));
  const sum = aggregateClasses(data.classes);
  assert.equal(sum.counts['20'],89);
  assert.equal(sum.coins,1780);
  assert.equal(sum.bills,0);
  assert.equal(sum.total,1780);
  assert.match(plainSummary(data),/0,20 € — 89 un\./);
});

test('cenário de 4 turmas com 20 envelopes cada e 6 moedas/notas por envelope', () => {
  const data = initialState();
  const simulated = [10,20,50,100,200,500,1000,2000,5000];
  const expected = blankCounts();
  for (let c=0;c<4;c++) for (let envelope=0;envelope<20;envelope++) for (let item=0;item<6;item++) {
    const denomination = simulated[(c*7+envelope*3+item)%simulated.length];
    tap(data.classes[c],denomination);
    expected[String(denomination)]++;
  }
  const aggregate = aggregateClasses(data.classes);
  assert.deepEqual(aggregate.counts,expected);
  assert.equal(aggregate.total, sumCounts(expected));
  assert.equal(aggregate.coins + aggregate.bills, aggregate.total);
  assert.equal(data.classes[4].counts['10'],0);
});

test('backup exportado pode ser restaurado sem alterar as quantidades', () => {
  const data = initialState();
  data.classes[1].name = 'Jardim de Infância 1';
  tap(data.classes[1],10);
  tap(data.classes[1],500);
  const backup = createBackup(data);
  const received = parseBackup(JSON.stringify(backup));
  assert.deepEqual(received,data);
});

test('ficheiro malformado ou manipulado é recusado', () => {
  const s = initialState();
  s.classes[0].counts['20'] = -1;
  assert.throws(()=>validateState(s));
  const other = initialState();
  other.classes[1].id=other.classes[0].id;
  assert.throws(()=>validateState(other));
  assert.throws(()=>parseBackup('{"format":"outro"}'));
  const extra = initialState();
  extra.classes[0].counts['25']=1;
  assert.throws(()=>validateState(extra));
});
