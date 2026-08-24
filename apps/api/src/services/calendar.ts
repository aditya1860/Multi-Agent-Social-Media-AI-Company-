import { google } from 'googleapis';
import { prisma } from '../config/db';
import { env } from '../config/env';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(state: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function getAuthedClient(userId: string) {
  const tokenRow = await prisma.googleOAuthToken.findUnique({ where: { userId } });
  if (!tokenRow) return null;
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken,
    expiry_date: tokenRow.expiresAt.getTime(),
  });
  // Auto-refresh if expired
  client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.googleOAuthToken.update({
        where: { userId },
        data: {
          accessToken: tokens.access_token,
          expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
        },
      });
    }
  });
  return client;
}

export async function createCalendarEvent(userId: string, event: {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmail?: string;
}): Promise<string | null> {
  if (!env.GOOGLE_CLIENT_ID) return null;
  const client = await getAuthedClient(userId);
  if (!client) return null;
  try {
    const calendar = google.calendar({ version: 'v3', auth: client });
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
        attendees: event.attendeeEmail ? [{ email: event.attendeeEmail }] : [],
      },
    });
    return res.data.id || null;
  } catch (err) {
    console.error('[Calendar] Event creation failed:', err);
    return null;
  }
}

export async function updateCalendarEvent(userId: string, eventId: string, updates: {
  start?: Date;
  end?: Date;
  summary?: string;
}): Promise<boolean> {
  if (!env.GOOGLE_CLIENT_ID) return false;
  const client = await getAuthedClient(userId);
  if (!client) return false;
  try {
    const calendar = google.calendar({ version: 'v3', auth: client });
    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        ...(updates.summary && { summary: updates.summary }),
        ...(updates.start && { start: { dateTime: updates.start.toISOString() } }),
        ...(updates.end && { end: { dateTime: updates.end.toISOString() } }),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  if (!env.GOOGLE_CLIENT_ID) return false;
  const client = await getAuthedClient(userId);
  if (!client) return false;
  try {
    const calendar = google.calendar({ version: 'v3', auth: client });
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return true;
  } catch {
    return false;
  }
}
