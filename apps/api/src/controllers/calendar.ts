import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { getAuthUrl, exchangeCodeForTokens } from '../services/calendar';

export async function initiateOAuth(req: Request, res: Response) {
  const state = req.user!.id;
  const url = getAuthUrl(state);
  return res.json({ url });
}

export async function oauthCallback(req: Request, res: Response) {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });
  try {
    const tokens = await exchangeCodeForTokens(String(code));
    const userId = String(state);
    await prisma.googleOAuthToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
      },
    });
    return res.redirect(`${process.env.FRONTEND_URL}/settings?calendar=connected`);
  } catch (err: any) {
    return res.status(500).json({ error: 'OAuth token exchange failed', detail: err?.message });
  }
}

export async function getCalendarStatus(req: Request, res: Response) {
  const token = await prisma.googleOAuthToken.findUnique({ where: { userId: req.user!.id } });
  return res.json({ connected: !!token });
}
