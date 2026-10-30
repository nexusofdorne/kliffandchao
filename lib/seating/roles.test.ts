import { describe, expect, it } from 'vitest';
import { isVipRole, vipRoleOf } from './roles';

describe('vipRoleOf', () => {
  it('recognises the two VIP roles in any case and spacing', () => {
    expect(vipRoleOf('Parents')).toBe('PARENTS');
    expect(vipRoleOf(' parent ')).toBe('PARENTS');
    expect(vipRoleOf('PRINCIPAL SPONSOR')).toBe('PRINCIPAL_SPONSOR');
    expect(vipRoleOf('Principal Sponsors')).toBe('PRINCIPAL_SPONSOR');
    expect(vipRoleOf('Groomsman')).toBeNull();
    expect(vipRoleOf('')).toBeNull();
    expect(vipRoleOf(null)).toBeNull();
    expect(isVipRole('Parents')).toBe(true);
  });
});
