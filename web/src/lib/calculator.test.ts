import { describe, it, expect } from 'vitest';
import { calculateSplit, calculateNetSettlement } from './calculator';
import { Expense } from './types';

describe('calculateSplit', () => {
  it('5:5折半で端数が四捨五入され合計が一致すること', () => {
    const res = calculateSplit(1001, '5:5');
    expect(res.tomoakiAmount).toBe(501);
    expect(res.yasukoAmount).toBe(500);
    expect(res.tomoakiAmount + res.yasukoAmount).toBe(1001);
  });

  it('6:4で正しく計算されること', () => {
    const res = calculateSplit(1000, '6:4');
    expect(res.tomoakiAmount).toBe(600);
    expect(res.yasukoAmount).toBe(400);
  });

  it('1:2で正しく計算されること (前撮り 159000)', () => {
    const res = calculateSplit(159000, '1:2');
    expect(res.tomoakiAmount).toBe(53000);
    expect(res.yasukoAmount).toBe(106000);
  });

  it('智明全額・康子全額が正しく計算されること', () => {
    const t = calculateSplit(16000, '智明全額');
    expect(t.tomoakiAmount).toBe(16000);
    expect(t.yasukoAmount).toBe(0);

    const y = calculateSplit(16000, '康子全額');
    expect(y.tomoakiAmount).toBe(0);
    expect(y.yasukoAmount).toBe(16000);
  });

  it('マイナス金額（お祝い金・出産一時金の公平分配）でも合計が一致すること', () => {
    const res = calculateSplit(-100000, '6:4');
    expect(res.tomoakiAmount).toBe(-60000);
    expect(res.yasukoAmount).toBe(-40000);
    expect(res.tomoakiAmount + res.yasukoAmount).toBe(-100000);
  });
});

describe('calculateNetSettlement', () => {
  it('智明立替と康子立替が相殺され、差額が正しく計算されること', () => {
    const dummyExpenses: Partial<Expense>[] = [
      {
        payer: '智明',
        amount: 10000,
        tomoaki_amount: 6000,
        yasuko_amount: 4000,
      },
      {
        payer: '康子',
        amount: 5000,
        tomoaki_amount: 3000,
        yasuko_amount: 2000,
      }
    ];

    // 智明立替: 康子から智明へ 4000円
    // 康子立替: 智明から康子へ 3000円
    // ネット: 康子から智明へ 1000円
    const net = calculateNetSettlement(dummyExpenses as Expense[]);
    expect(net.direction).toBe('康子 ➔ 智明');
    expect(net.amount).toBe(1000);
  });

  it('家族カード決済（6:4）は既に6:4共有資金のため精算なしになること', () => {
    const dummyExpenses: Partial<Expense>[] = [
      {
        payer: '家族カード',
        amount: 3960,
        tomoaki_amount: 2376,
        yasuko_amount: 1584,
      }
    ];

    const net = calculateNetSettlement(dummyExpenses as Expense[]);
    expect(net.direction).toBe('精算なし');
    expect(net.amount).toBe(0);
  });

  it('家族カード決済で康子全額の場合、康子が智明共有資金分（60%）を精算すること', () => {
    const dummyExpenses: Partial<Expense>[] = [
      {
        payer: '家族カード',
        amount: 10000,
        tomoaki_amount: 0,
        yasuko_amount: 10000,
      }
    ];

    const net = calculateNetSettlement(dummyExpenses as Expense[]);
    expect(net.direction).toBe('康子 ➔ 智明');
    expect(net.amount).toBe(6000);
  });

  it('出産一時金受領（マイナス支出）によって相殺還元されること', () => {
    const dummyExpenses: Partial<Expense>[] = [
      {
        payer: '康子',
        amount: -100000,
        tomoaki_amount: -60000,
        yasuko_amount: -40000,
      }
    ];

    // 康子が10万円受け取った（分配比率6:4）
    // 康子立替（受領）: 智明から康子へ -60000円 ＝ 康子から智明へ +60000円
    const net = calculateNetSettlement(dummyExpenses as Expense[]);
    expect(net.direction).toBe('康子 ➔ 智明');
    expect(net.amount).toBe(60000);
  });
});
