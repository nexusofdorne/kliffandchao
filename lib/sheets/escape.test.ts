import { describe, expect, it } from 'vitest';
import { safeCell } from './escape';

describe('safeCell', () => {
  it.each(['=1+1', '+1', '-1', '@mention'])(
    'quote-prefixes a value starting with %s so Excel never reads it as a formula',
    (value) => {
      expect(safeCell(value)).toBe(`'${value}`);
    },
  );

  it('quote-prefixes a value starting with a tab or carriage return, which is then itself stripped as a control character', () => {
    expect(safeCell('\tTabbed')).toBe("'Tabbed");
    expect(safeCell('\rCarriageReturn')).toBe("'CarriageReturn");
  });

  it('leaves ordinary text untouched', () => {
    expect(safeCell('See you there!')).toBe('See you there!');
  });

  it('strips control characters', () => {
    expect(safeCell('Hello\u0007World\u0000')).toBe('HelloWorld');
  });

  it('caps length at 500 characters', () => {
    const long = 'a'.repeat(600);
    expect(safeCell(long)).toHaveLength(500);
  });

  it('caps length after the quote-prefix is added', () => {
    const long = '='.concat('a'.repeat(600));
    const result = safeCell(long);
    expect(result).toHaveLength(500);
    expect(result.startsWith("'=")).toBe(true);
  });
});
