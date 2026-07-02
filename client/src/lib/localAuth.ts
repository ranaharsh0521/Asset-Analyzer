import { OTP } from "otplib";

export type StoredUser = {
  name: string;
  email: string;
  password: string;
  otpSecret: string;
  otpConfiguredAt: string | null;
  createdAt: string;
};

const USERS_STORAGE_KEY = "gnn-ids-users";
const CURRENT_USER_STORAGE_KEY = "gnn-ids-user";
const OTP_ISSUER = "GNN-IDS";

const otp = new OTP({ strategy: "totp" });

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateOtpSecret() {
  return otp.generateSecret();
}

function createUserRecord({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}): StoredUser {
  return {
    name: name.trim(),
    email: normalizeEmail(email),
    password,
    otpSecret: generateOtpSecret(),
    otpConfiguredAt: null,
    createdAt: new Date().toISOString(),
  };
}

function createSeedUser() {
  return createUserRecord({
    name: "Security Analyst",
    email: "analyst@security.local",
    password: "password123",
  });
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function migrateUsers(users: StoredUser[]) {
  let changed = false;

  const migratedUsers = users
    .filter((user) => user && typeof user.email === "string" && typeof user.password === "string")
    .map((user) => {
      const normalized = normalizeEmail(user.email);
      const previousConfiguredAt =
        typeof user.otpConfiguredAt === "string" && user.otpConfiguredAt.trim()
          ? user.otpConfiguredAt
          : null;

      const nextUser: StoredUser = {
        name: typeof user.name === "string" && user.name.trim() ? user.name.trim() : "Security Analyst",
        email: normalized,
        password: user.password,
        otpSecret:
          typeof user.otpSecret === "string" && user.otpSecret.trim()
            ? user.otpSecret
            : generateOtpSecret(),
        otpConfiguredAt: previousConfiguredAt,
        createdAt:
          typeof user.createdAt === "string" && user.createdAt.trim()
            ? user.createdAt
            : new Date().toISOString(),
      };

      if (
        nextUser.name !== user.name ||
        nextUser.email !== user.email ||
        nextUser.otpSecret !== user.otpSecret ||
        nextUser.otpConfiguredAt !== previousConfiguredAt ||
        nextUser.createdAt !== user.createdAt
      ) {
        changed = true;
      }

      return nextUser;
    });

  if (!migratedUsers.length) {
    const seededUsers = [createSeedUser()];
    saveUsers(seededUsers);
    return seededUsers;
  }

  if (changed || migratedUsers.length !== users.length) {
    saveUsers(migratedUsers);
  }

  return migratedUsers;
}

function updateStoredUser(
  email: string,
  updater: (user: StoredUser) => StoredUser,
) {
  const normalizedEmail = normalizeEmail(email);
  const users = getStoredUsers();
  let updatedUser: StoredUser | null = null;

  const nextUsers = users.map((user) => {
    if (user.email !== normalizedEmail) {
      return user;
    }

    updatedUser = updater(user);
    return updatedUser;
  });

  if (!updatedUser) {
    return null;
  }

  saveUsers(nextUsers);
  return updatedUser;
}

export function getStoredUsers() {
  const raw = localStorage.getItem(USERS_STORAGE_KEY);

  if (!raw) {
    const seededUsers = [createSeedUser()];
    saveUsers(seededUsers);
    return seededUsers;
  }

  try {
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) ? migrateUsers(parsed) : migrateUsers([]);
  } catch {
    return migrateUsers([]);
  }
}

export function getStoredUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  return getStoredUsers().find((user) => user.email === normalizedEmail) ?? null;
}

export function registerUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const users = getStoredUsers();
  const normalizedEmail = normalizeEmail(email);
  const existingUser = users.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    return { error: "An account with this email already exists" as const };
  }

  const nextUser = createUserRecord({
    name,
    email: normalizedEmail,
    password,
  });

  saveUsers([...users, nextUser]);

  return { user: nextUser };
}

export function validateCredentials(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  return (
    getStoredUsers().find(
      (user) => user.email === normalizedEmail && user.password === password,
    ) ?? null
  );
}

export function resetUserTotpSecret(email: string) {
  return updateStoredUser(email, (user) => ({
    ...user,
    otpSecret: generateOtpSecret(),
    otpConfiguredAt: null,
  }));
}

export function markUserTotpConfigured(email: string) {
  return updateStoredUser(email, (user) => ({
    ...user,
    otpConfiguredAt: user.otpConfiguredAt ?? new Date().toISOString(),
  }));
}

export function buildOtpAuthUrl(user: Pick<StoredUser, "email" | "otpSecret">) {
  return otp.generateURI({
    issuer: OTP_ISSUER,
    label: user.email,
    secret: user.otpSecret,
    digits: 6,
    period: 30,
    algorithm: "sha1",
  });
}

export function verifyTotpCode(user: Pick<StoredUser, "otpSecret">, token: string) {
  const cleanedToken = token.replace(/\s+/g, "");

  if (!/^\d{6}$/.test(cleanedToken)) {
    return false;
  }

  const result = otp.verifySync({
    secret: user.otpSecret,
    token: cleanedToken,
    digits: 6,
    period: 30,
    epochTolerance: 30,
  });

  return result.valid;
}

export function rememberLoggedInUser(email: string) {
  localStorage.setItem(CURRENT_USER_STORAGE_KEY, normalizeEmail(email));
}

export function clearRememberedUser() {
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}
