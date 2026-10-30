import 'server-only';
import { cache } from 'react';
import type { PrismaClient } from '../../generated/prisma/client';
import { env } from '../env';
import { prisma } from '../prisma';

// The settings the couple change from /admin (the SiteSettings row, id 1): the site password,
// "skip the password" (portfolio), "close RSVP submissions", and the session generation that
// "Sign everyone out" bumps. Read once per request (React cache).

export type SiteSettings = {
  /** The hash the gate checks: the one set in /admin, else SITE_PASSWORD_HASH. */
  passwordHash: string;
  /** True once a password has been set in /admin (SITE_PASSWORD_HASH no longer applies). */
  passwordFromAdmin: boolean;
  passwordOpen: boolean;
  rsvpClosed: boolean;
  sessionGeneration: number;
  updatedAt: Date | null;
  updatedBy: string | null;
};

const SETTINGS_ID = 1;

type SettingsRow = {
  sitePasswordHash: string | null;
  passwordOpen: boolean;
  rsvpClosed: boolean;
  sessionGeneration: number;
  updatedAt: Date;
  updatedBy: string | null;
} | null;

/** Pure: a missing row means the defaults, with the password from the environment. */
export function settingsFromRow(row: SettingsRow, envPasswordHash: string): SiteSettings {
  return {
    passwordHash: row?.sitePasswordHash ?? envPasswordHash,
    passwordFromAdmin: row?.sitePasswordHash != null,
    passwordOpen: row?.passwordOpen ?? false,
    rsvpClosed: row?.rsvpClosed ?? false,
    sessionGeneration: row?.sessionGeneration ?? 0,
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

/** This request's settings. Throws if the database can't be reached. */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const row = await prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
  return settingsFromRow(row, env.SITE_PASSWORD_HASH);
});

export type SettingsChange = {
  sitePasswordHash?: string;
  passwordOpen?: boolean;
  rsvpClosed?: boolean;
  bumpSessionGeneration?: boolean;
};

export async function updateSiteSettings(prisma: PrismaClient, change: SettingsChange, by: string): Promise<void> {
  const data = {
    ...(change.sitePasswordHash !== undefined && { sitePasswordHash: change.sitePasswordHash }),
    ...(change.passwordOpen !== undefined && { passwordOpen: change.passwordOpen }),
    ...(change.rsvpClosed !== undefined && { rsvpClosed: change.rsvpClosed }),
    updatedBy: by,
  };
  await prisma.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data, sessionGeneration: change.bumpSessionGeneration ? 1 : 0 },
    update: { ...data, ...(change.bumpSessionGeneration && { sessionGeneration: { increment: 1 } }) },
  });
}
