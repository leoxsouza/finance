type AuthEnv = {
  email: string;
  passwordHash: string;
  nextAuthSecret: string;
  nextAuthUrl: string;
};

function readEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

let cachedAuthEnv: AuthEnv | null = null;

function loadAuthEnv(): AuthEnv {
  if (cachedAuthEnv) {
    return cachedAuthEnv;
  }

  cachedAuthEnv = {
    email: readEnv("AUTH_USER_EMAIL").trim().toLowerCase(),
    passwordHash: readEnv("AUTH_USER_PASSWORD_HASH"),
    nextAuthSecret: readEnv("NEXTAUTH_SECRET"),
    nextAuthUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  };

  return cachedAuthEnv;
}

export function getAuthCredentials() {
  const { email, passwordHash } = loadAuthEnv();
  return { email, passwordHash } as const;
}

export function getNextAuthEnv() {
  const { nextAuthSecret, nextAuthUrl } = loadAuthEnv();
  return { secret: nextAuthSecret, url: nextAuthUrl } as const;
}

export default loadAuthEnv;
