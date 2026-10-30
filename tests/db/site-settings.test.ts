import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { updateSiteSettings } from '../../lib/settings/site-settings';
import { testPrisma } from './client';

// The SiteSettings row against the real table: created on first change, then updated in place.
// Starts and ends with no row (the defaults).
describe('updateSiteSettings', () => {
  const clear = () => testPrisma.siteSettings.deleteMany({});
  beforeAll(clear);
  afterAll(clear);

  it('creates the row on the first change and keeps other fields on later ones', async () => {
    await updateSiteSettings(testPrisma, { passwordOpen: true }, 'a@test');
    let row = await testPrisma.siteSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row).toMatchObject({ passwordOpen: true, rsvpClosed: false, sessionGeneration: 0, sitePasswordHash: null, updatedBy: 'a@test' });

    await updateSiteSettings(testPrisma, { rsvpClosed: true, sitePasswordHash: 'scrypt$x' }, 'b@test');
    row = await testPrisma.siteSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row).toMatchObject({ passwordOpen: true, rsvpClosed: true, sitePasswordHash: 'scrypt$x', updatedBy: 'b@test' });
  });

  it('bumps the session generation by one each time', async () => {
    await updateSiteSettings(testPrisma, { bumpSessionGeneration: true }, 'a@test');
    await updateSiteSettings(testPrisma, { bumpSessionGeneration: true }, 'a@test');
    const row = await testPrisma.siteSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.sessionGeneration).toBe(2);
    expect(await testPrisma.siteSettings.count()).toBe(1);
  });
});
