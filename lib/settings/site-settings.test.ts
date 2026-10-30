import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../env', () => ({ env: { SITE_PASSWORD_HASH: 'env-hash' } }));
vi.mock('../prisma', () => ({ prisma: {} }));

const { settingsFromRow } = await import('./site-settings');

describe('settingsFromRow', () => {
  it('uses the defaults and the environment password when nothing is saved', () => {
    expect(settingsFromRow(null, 'env-hash')).toEqual({
      passwordHash: 'env-hash',
      passwordFromAdmin: false,
      passwordOpen: false,
      rsvpClosed: false,
      sessionGeneration: 0,
      updatedAt: null,
      updatedBy: null,
    });
  });

  it('keeps the environment password until one is set in admin', () => {
    const row = { sitePasswordHash: null, passwordOpen: true, rsvpClosed: true, sessionGeneration: 2, updatedAt: new Date(0), updatedBy: 'a@b.c' };
    expect(settingsFromRow(row, 'env-hash')).toMatchObject({ passwordHash: 'env-hash', passwordFromAdmin: false, passwordOpen: true, rsvpClosed: true, sessionGeneration: 2 });
  });

  it('uses the admin password once set', () => {
    const row = { sitePasswordHash: 'admin-hash', passwordOpen: false, rsvpClosed: false, sessionGeneration: 0, updatedAt: new Date(0), updatedBy: null };
    expect(settingsFromRow(row, 'env-hash')).toMatchObject({ passwordHash: 'admin-hash', passwordFromAdmin: true });
  });
});
