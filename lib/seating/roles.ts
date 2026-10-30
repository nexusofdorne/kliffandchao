export type VipRole = 'PARENTS' | 'PRINCIPAL_SPONSOR';

// The Guests sheet's free-text Role column is the only source of VIP status,
// so match it loosely: any case, stray spaces, singular or plural.
export function vipRoleOf(role: string | null): VipRole | null {
  const normalised = role?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
  if (normalised === 'parent' || normalised === 'parents') return 'PARENTS';
  if (normalised === 'principal sponsor' || normalised === 'principal sponsors') return 'PRINCIPAL_SPONSOR';
  return null;
}

export function isVipRole(role: string | null): boolean {
  return vipRoleOf(role) !== null;
}
