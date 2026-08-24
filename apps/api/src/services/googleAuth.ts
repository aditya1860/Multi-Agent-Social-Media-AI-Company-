import { getAuthUrl, exchangeCodeForTokens } from './calendar';
import { prisma } from '../config/db';

export function generateGoogleAuthUrl(userId: string): string {
  return getAuthUrl(userId);
}

export async function handleGoogleOAuthCallback(code: string, userId: string) {
  const tokens = await exchangeCodeForTokens(code);
  return prisma.googleOAuthToken.upsert({
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
}
