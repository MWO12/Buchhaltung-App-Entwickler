import { describe, expect, it } from 'vitest';
import { eurToCents, microToEurCents, parseDecimalMicro, toFullEuros } from './money';

describe('money', () => {
  it('parst beide Dezimalschreibweisen', () => {
    expect(parseDecimalMicro('1,234.56')).toBe(12_345_600);
    expect(parseDecimalMicro('1.234,56')).toBe(12_345_600);
    expect(parseDecimalMicro('-3.49')).toBe(-34_900);
    expect(parseDecimalMicro('0.00005')).toBe(1);
    expect(parseDecimalMicro('')).toBe(0);
  });
  it('rechnet Fremdwährung kaufmännisch gerundet um', () => {
    // 108,50 USD bei 1,0850 USD/EUR = 100,00 EUR
    expect(microToEurCents(1_085_000, 1.085)).toBe(10_000);
    expect(microToEurCents(-1_085_000, 1.085)).toBe(-10_000);
    expect(() => microToEurCents(1, 0)).toThrow();
  });
  it('schneidet Bemessungsgrundlagen auf volle Euro ab', () => {
    expect(eurToCents('12,345')).toBe(1235);
    expect(toFullEuros(12_399)).toBe(123);
    expect(toFullEuros(-12_399)).toBe(-123);
  });
});
