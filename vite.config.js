import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { paraosCodePlugin } from './src/server/paraosCodePlugin.js'

// ========================================
// SERVER-SIDE DATA STORES
// In-memory storage for cross-device sync
// ========================================

// Presence tracking
const presenceStore = new Map();
const PRESENCE_TIMEOUT = 30000;

// Chat storage: username -> [{ id, title, messages, createdAt, updatedAt }]
const chatStore = new Map();

// Memory storage: username -> [{ id, content, createdAt }]
const memoryStore = new Map();

// Group chats: groupId -> { id, name, members, messages, createdAt }
const groupStore = new Map();

// Admin settings (global, affects all clients)
const adminSettings = {
  theme: 'default',           // 'default', 'lockdown', 'party', 'stealth'
  weather: 'none',            // 'none', 'rain', 'snow', 'matrix'
  entityMood: 'normal',       // 'normal', 'happy', 'scared', 'angry', 'sleeping'
  lockdown: false,
  containment: false,         // Trigger containment on all clients
  marqueeBanner: '',
  maintenanceMode: false
};

// Kicked users (can't login until unkicked)
const kickedUsers = new Set();

// Auth/session storage
const sessionStore = new Map();
const SESSION_COOKIE_NAME = 'paraos_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const serverEnv = loadServerEnvFiles();
const REGISTERED_USERS_FILE_PATH = getServerEnvValue('PARAOS_REGISTERED_USERS_PATH') || './data/registered-users.json';
const ACCOUNT_CREATION_ENABLED = getServerEnvValue('PARAOS_ACCOUNT_CREATION_ENABLED') === 'true';
const AUTH_PEPPER = getServerEnvValue('PARAOS_AUTH_PEPPER') || '';
const SCRYPT_N = Number.parseInt(getServerEnvValue('PARAOS_SCRYPT_N') || '131072', 10);
const SCRYPT_R = Number.parseInt(getServerEnvValue('PARAOS_SCRYPT_R') || '8', 10);
const SCRYPT_P = Number.parseInt(getServerEnvValue('PARAOS_SCRYPT_P') || '1', 10);
const SCRYPT_KEYLEN = Number.parseInt(getServerEnvValue('PARAOS_SCRYPT_KEYLEN') || '64', 10);

const authUsers = loadAuthUsers();
const envManagedUsernames = new Set(authUsers.keys());
loadRegisteredUsers(authUsers);

if (!AUTH_PEPPER) {
  console.warn('[ParaOS Auth] PARAOS_AUTH_PEPPER is not set. Password hashes are still salted, but set a pepper for stronger at-rest protection.');
}


// Broadcast queue: [{ id, message, sender, timestamp, type }]
const broadcastQueue = [];

// Typing indicators for groups: groupId -> { username, text, timestamp }
const typingStore = new Map();

// Pending group invites: username -> [{ inviteId, groupId, groupName, fromUser, timestamp }]
const pendingInvites = new Map();

// Group animation broadcasts: [{ type, groupId, groupName, members, timestamp }]
const groupAnimationQueue = [];

// ========================================
// HELPER FUNCTIONS
// ========================================

function cleanStalePresence() {
  const now = Date.now();
  for (const [username, data] of presenceStore.entries()) {
    if (now - data.lastSeen > PRESENCE_TIMEOUT) {
      presenceStore.delete(username);
    }
  }
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(sessionId);
    }
  }
}

function loadServerEnvFiles() {
  const env = {};
  const envFiles = ['.env', '.env.local'];

  for (const envFile of envFiles) {
    const filePath = path.resolve(envFile);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) continue;

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in env)) {
        env[key] = value;
      }
    }
  }

  return env;
}

function getServerEnvValue(key) {
  if (typeof process.env[key] === 'string' && process.env[key].length > 0) {
    return process.env[key];
  }

  if (typeof serverEnv[key] === 'string' && serverEnv[key].length > 0) {
    return serverEnv[key];
  }

  return '';
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function parseBody(req) {
  if (req.__paraosParsedBody) {
    return Promise.resolve(req.__paraosParsedBody);
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsedBody = body ? JSON.parse(body) : {};
        req.__paraosParsedBody = parsedBody;
        resolve(parsedBody);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) return {};

  return rawCookie.split(';').reduce((acc, pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return acc;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function appendSetCookie(res, cookieValue) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }

  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
    return;
  }

  res.setHeader('Set-Cookie', [existing, cookieValue]);
}

function setSessionCookie(res, sessionId) {
  appendSetCookie(
    res,
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

function clearSessionCookie(res) {
  appendSetCookie(
    res,
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function createSession(user) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessionStore.set(sessionId, {
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'user',
    level: user.level || 'STANDARD',
    clearance: user.clearance || 'LIMITED',
    aiTitle: user.aiTitle || 'Operator',
    greeting: user.greeting || `Welcome, ${user.displayName || user.username}.`,
    createdAt: now,
    lastSeen: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return sessionId;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return null;

  const session = sessionStore.get(sessionId);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(sessionId);
    return null;
  }

  session.lastSeen = Date.now();
  session.expiresAt = session.lastSeen + SESSION_TTL_MS;
  return { id: sessionId, ...session };
}

function getAuthUserPublicProfile(user) {
  return {
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'user',
    level: user.level || 'STANDARD',
    clearance: user.clearance || 'LIMITED',
    aiTitle: user.aiTitle || 'Operator',
    greeting: user.greeting || `Welcome, ${user.displayName || user.username}.`,
  };
}

function getSessionPublicProfile(session) {
  return {
    username: session.username,
    displayName: session.displayName,
    role: session.role,
    level: session.level,
    clearance: session.clearance,
    aiTitle: session.aiTitle,
    greeting: session.greeting,
  };
}

function getScryptParams() {
  const n = Number.isFinite(SCRYPT_N) && SCRYPT_N >= 16384 ? SCRYPT_N : 131072;
  const r = Number.isFinite(SCRYPT_R) && SCRYPT_R >= 8 ? SCRYPT_R : 8;
  const p = Number.isFinite(SCRYPT_P) && SCRYPT_P >= 1 ? SCRYPT_P : 1;
  const keylen = Number.isFinite(SCRYPT_KEYLEN) && SCRYPT_KEYLEN >= 32 ? SCRYPT_KEYLEN : 64;
  return { n, r, p, keylen };
}

function hashPassword(password, saltHex, params = getScryptParams(), usePepper = true) {
  const material = usePepper ? `${password}${AUTH_PEPPER}` : password;
  return crypto.scryptSync(material, Buffer.from(saltHex, 'hex'), params.keylen, {
    N: params.n,
    r: params.r,
    p: params.p,
  }).toString('hex');
}

function createPasswordHash(password) {
  const params = getScryptParams();
  const saltHex = crypto.randomBytes(16).toString('hex');
  const hashHex = hashPassword(password, saltHex, params, true);
  return `scrypt2:${params.n}:${params.r}:${params.p}:${params.keylen}:${saltHex}:${hashHex}`;
}

function verifyPassword(password, encodedHash) {
  if (!encodedHash || typeof encodedHash !== 'string') return { valid: false, needsRehash: false };

  const parts = encodedHash.split(':');
  let saltHex = '';
  let storedHashHex = '';
  let computedHashHex = '';
  let needsRehash = false;

  // New format: scrypt2:N:r:p:keylen:salt:hash (peppered)
  if (parts.length === 7 && parts[0] === 'scrypt2') {
    const n = Number.parseInt(parts[1], 10);
    const r = Number.parseInt(parts[2], 10);
    const p = Number.parseInt(parts[3], 10);
    const keylen = Number.parseInt(parts[4], 10);
    saltHex = parts[5];
    storedHashHex = parts[6];

    if (!saltHex || !storedHashHex || !Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !Number.isFinite(keylen)) {
      return { valid: false, needsRehash: false };
    }

    computedHashHex = hashPassword(password, saltHex, { n, r, p, keylen }, true);
    const current = getScryptParams();
    needsRehash = n < current.n || r !== current.r || p !== current.p || keylen < current.keylen;
  } else if (parts.length === 3 && parts[0] === 'scrypt') {
    // Legacy format: scrypt:salt:hash (no pepper)
    saltHex = parts[1];
    storedHashHex = parts[2];
    if (!saltHex || !storedHashHex) return { valid: false, needsRehash: false };
    computedHashHex = hashPassword(password, saltHex, { n: 16384, r: 8, p: 1, keylen: 64 }, false);
    needsRehash = true;
  } else {
    return { valid: false, needsRehash: false };
  }

  const computedBuffer = Buffer.from(computedHashHex, 'hex');
  const storedBuffer = Buffer.from(storedHashHex, 'hex');

  if (computedBuffer.length !== storedBuffer.length) return { valid: false, needsRehash: false };
  return { valid: crypto.timingSafeEqual(computedBuffer, storedBuffer), needsRehash };
}

function normalizeAuthUser(username, userConfig) {
  if (!username || !userConfig || typeof userConfig !== 'object') return null;
  if (!userConfig.passwordHash || typeof userConfig.passwordHash !== 'string') return null;

  const normalizedUsername = username.toUpperCase().trim();
  if (!normalizedUsername) return null;

  return {
    username: normalizedUsername,
    displayName: userConfig.displayName || normalizedUsername,
    passwordHash: userConfig.passwordHash.trim(),
    role: userConfig.role === 'admin' ? 'admin' : 'user',
    level: userConfig.level || (userConfig.role === 'admin' ? 'OMNI' : 'STANDARD'),
    clearance: userConfig.clearance || (userConfig.role === 'admin' ? 'UNLIMITED' : 'LIMITED'),
    aiTitle: userConfig.aiTitle || (userConfig.role === 'admin' ? 'Operator' : 'User'),
    greeting: userConfig.greeting || `Welcome, ${userConfig.displayName || normalizedUsername}.`,
  };
}

function loadAuthUsers() {
  const users = new Map();
  const usersRaw = getServerEnvValue('PARAOS_AUTH_USERS');

  if (!usersRaw) {
    console.warn('[ParaOS Auth] PARAOS_AUTH_USERS is not set. Login is disabled until users are configured.');
    return users;
  }

  try {
    const parsed = JSON.parse(usersRaw);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const normalized = normalizeAuthUser(item?.username, item);
        if (normalized) users.set(normalized.username, normalized);
      }
    } else {
      for (const [username, config] of Object.entries(parsed)) {
        const normalized = normalizeAuthUser(username, config);
        if (normalized) users.set(normalized.username, normalized);
      }
    }
  } catch (error) {
    console.error('[ParaOS Auth] Failed to parse PARAOS_AUTH_USERS JSON:', error.message);
  }

  if (users.size === 0) {
    console.warn('[ParaOS Auth] No valid auth users loaded. Login is disabled.');
  } else {
    console.log(`[ParaOS Auth] Loaded ${users.size} auth user(s).`);
  }

  return users;
}

function loadRegisteredUsers(usersMap) {
  try {
    const absolutePath = path.resolve(REGISTERED_USERS_FILE_PATH);
    const directory = path.dirname(absolutePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    let entries = [];
    if (!fs.existsSync(absolutePath)) {
      fs.writeFileSync(absolutePath, '[]', 'utf8');
    } else {
      const raw = fs.readFileSync(absolutePath, 'utf8').trim();
      if (raw) {
        const parsed = JSON.parse(raw);
        entries = Array.isArray(parsed) ? parsed : Object.values(parsed);
      }
    }

    // If runtime file is empty, seed from bundled data file.
    if (entries.length === 0 && usersMap.size === 0) {
      const bundledPath = path.resolve('./data/registered-users.json');
      if (bundledPath !== absolutePath && fs.existsSync(bundledPath)) {
        try {
          const bundledRaw = fs.readFileSync(bundledPath, 'utf8').trim();
          if (bundledRaw) {
            const bundledParsed = JSON.parse(bundledRaw);
            const bundledEntries = Array.isArray(bundledParsed) ? bundledParsed : Object.values(bundledParsed);
            if (bundledEntries.length > 0) {
              entries = bundledEntries;
            }
          }
        } catch (seedErr) {
          console.error('[ParaOS Auth] Failed to parse bundled user seed:', seedErr.message);
        }
      }
    }

    let loadedCount = 0;
    for (const entry of entries) {
      const normalized = normalizeAuthUser(entry?.username, entry);
      if (!normalized) continue;
      if (usersMap.has(normalized.username)) continue;

      usersMap.set(normalized.username, normalized);
      loadedCount += 1;
    }

    if (loadedCount > 0) {
      console.log(`[ParaOS Auth] Loaded ${loadedCount} registered user(s) from disk.`);
      // Persist seeded users into runtime auth file when it was empty.
      if (entries.length > 0) {
        saveRegisteredUsers(usersMap);
      }
    }
  } catch (error) {
    console.error('[ParaOS Auth] Failed to load registered users:', error.message);
  }
}

function saveRegisteredUsers(usersMap) {
  try {
    const absolutePath = path.resolve(REGISTERED_USERS_FILE_PATH);
    const directory = path.dirname(absolutePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const serialized = Array.from(usersMap.values())
      .filter(user => !envManagedUsernames.has(user.username))
      .map(user => ({
        username: user.username,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        role: user.role === 'admin' ? 'admin' : 'user',
        level: user.level || (user.role === 'admin' ? 'OMNI' : 'STANDARD'),
        clearance: user.clearance || (user.role === 'admin' ? 'UNLIMITED' : 'LIMITED'),
        aiTitle: user.aiTitle || (user.role === 'admin' ? 'Operator' : 'User'),
        greeting: user.greeting || `Welcome, ${user.displayName || user.username}.`,
      }));

    fs.writeFileSync(absolutePath, JSON.stringify(serialized, null, 2), 'utf8');
  } catch (error) {
    console.error('[ParaOS Auth] Failed to persist registered users:', error.message);
  }
}

function requireSession(req, res, options = {}) {
  const session = getSession(req);
  if (!session) {
    sendJson(res, { error: 'Authentication required' }, 401);
    return null;
  }

  if (options.adminOnly && session.role !== 'admin') {
    sendJson(res, { error: 'Admin access required' }, 403);
    return null;
  }

  req.__paraosSession = session;
  return session;
}

function resolveUsername(session, requestedUsername, res) {
  if (!requestedUsername) {
    sendJson(res, { error: 'Username required' }, 400);
    return null;
  }

  const normalizedRequested = requestedUsername.toUpperCase().trim();
  if (!normalizedRequested) {
    sendJson(res, { error: 'Username required' }, 400);
    return null;
  }

  if (session.role === 'admin' || normalizedRequested === session.username) {
    return normalizedRequested;
  }

  sendJson(res, { error: 'Forbidden for this user' }, 403);
  return null;
}

// ========================================
// VITE PLUGIN: API ENDPOINTS
// ========================================

function apiPlugin() {
  return {
    name: 'paraos-api',
    configureServer(server) {
      // Clean stale presence every 10 seconds
      setInterval(cleanStalePresence, 10000);
      // Clean expired sessions every minute
      setInterval(cleanExpiredSessions, 60000);

      // ========================================
      // AUTH API
      // ========================================

      server.middlewares.use('/api/auth/login', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        try {
          const { username, password } = await parseBody(req);
          const normalizedUsername = username?.toUpperCase?.().trim?.();

          if (authUsers.size === 0) {
            return sendJson(res, { error: 'No accounts configured yet. Create the first account to continue.' }, 503);
          }

          if (!normalizedUsername || !password) {
            return sendJson(res, { error: 'Username and password required' }, 400);
          }

          if (kickedUsers.has(normalizedUsername)) {
            return sendJson(res, { error: 'Account is temporarily disabled by administrator' }, 403);
          }

          const user = authUsers.get(normalizedUsername);
          const check = user ? verifyPassword(password, user.passwordHash) : { valid: false, needsRehash: false };
          if (!user || !check.valid) {
            return sendJson(res, { error: 'Invalid credentials' }, 401);
          }

          if (check.needsRehash) {
            user.passwordHash = createPasswordHash(password);
            if (!envManagedUsernames.has(user.username)) {
              saveRegisteredUsers(authUsers);
            }
          }

          const sessionId = createSession(user);
          setSessionCookie(res, sessionId);
          return sendJson(res, { success: true, user: getAuthUserPublicProfile(user) });
        } catch (e) {
          return sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/auth/register', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        // Account creation is admin-controlled and disabled by default.
        const accountCreationAllowed = ACCOUNT_CREATION_ENABLED;
        if (!accountCreationAllowed) {
          return sendJson(res, { error: 'Account creation is disabled by administrator' }, 403);
        }

        try {
          const { username, password } = await parseBody(req);
          const normalizedUsername = username?.toUpperCase?.().trim?.();
          const usernamePattern = /^[A-Z0-9_]{3,24}$/;

          if (!normalizedUsername || !password) {
            return sendJson(res, { error: 'Username and password required' }, 400);
          }

          if (!usernamePattern.test(normalizedUsername)) {
            return sendJson(res, { error: 'Username must be 3-24 characters (A-Z, 0-9, _)' }, 400);
          }

          if (typeof password !== 'string' || password.length < 8) {
            return sendJson(res, { error: 'Password must be at least 8 characters' }, 400);
          }

          if (authUsers.has(normalizedUsername)) {
            return sendJson(res, { error: 'Username already exists' }, 409);
          }

          const user = normalizeAuthUser(normalizedUsername, {
            displayName: normalizedUsername,
            passwordHash: createPasswordHash(password),
            role: 'user',
            level: 'STANDARD',
            clearance: 'LIMITED',
            aiTitle: 'Operator',
            greeting: `Welcome, ${normalizedUsername}.`,
          });

          if (!user) {
            return sendJson(res, { error: 'Failed to create account' }, 500);
          }

          authUsers.set(user.username, user);
          saveRegisteredUsers(authUsers);

          return sendJson(res, { success: true, user: getAuthUserPublicProfile(user) });
        } catch (e) {
          return sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/auth/config', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const hasUsers = authUsers.size > 0;
        const bootstrapMode = false;
        const accountCreationAllowed = ACCOUNT_CREATION_ENABLED;
        return sendJson(res, {
          accountCreationEnabled: accountCreationAllowed,
          bootstrapMode,
          hasUsers,
        });
      });

      server.middlewares.use('/api/auth/logout', (req, res, next) => {
        if (req.method !== 'POST') return next();

        const session = getSession(req);
        if (session) {
          sessionStore.delete(session.id);
        }

        clearSessionCookie(res);
        return sendJson(res, { success: true });
      });

      server.middlewares.use('/api/auth/session', (req, res, next) => {
        if (req.method !== 'GET') return next();

        const session = getSession(req);
        if (!session) {
          return sendJson(res, { authenticated: false });
        }

        return sendJson(res, {
          authenticated: true,
          user: getSessionPublicProfile(session),
        });
      });

      // Route-level auth guards
      server.middlewares.use('/api/admin', (req, res, next) => {
        const isAdminSettingsRead = req.method === 'GET' && req.url?.startsWith('/settings');
        const session = requireSession(req, res, { adminOnly: !isAdminSettingsRead });
        if (!session) return;
        return next();
      });

      server.middlewares.use('/api/groups', (req, res, next) => {
        const session = requireSession(req, res);
        if (!session) return;
        return next();
      });

      server.middlewares.use('/api/presence', (req, res, next) => {
        const session = requireSession(req, res);
        if (!session) return;
        return next();
      });

      server.middlewares.use('/api/chats', (req, res, next) => {
        const session = requireSession(req, res);
        if (!session) return;
        return next();
      });

      server.middlewares.use('/api/memories', (req, res, next) => {
        const session = requireSession(req, res);
        if (!session) return;
        return next();
      });

      // ========================================
      // PRESENCE API
      // ========================================

      server.middlewares.use('/api/presence/register', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username, isAdmin } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;

          const existingData = presenceStore.get(resolvedUsername);
          presenceStore.set(resolvedUsername, {
            username: resolvedUsername,
            isAdmin: session.role === 'admin' || isAdmin === true,
            loginTime: existingData?.loginTime || Date.now(),
            lastSeen: Date.now()
          });
          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/presence/unregister', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;
          presenceStore.delete(resolvedUsername);
          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/presence/list', (req, res, next) => {
        if (req.method !== 'GET') return next();
        cleanStalePresence();
        sendJson(res, { accounts: Array.from(presenceStore.values()) });
      });

      // ========================================
      // CHAT SYNC API
      // ========================================

      server.middlewares.use('/api/chats/save', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username, chat } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;
          if (!chat) return sendJson(res, { error: 'Chat required' }, 400);

          let userChats = chatStore.get(resolvedUsername) || [];
          const existingIndex = userChats.findIndex(c => c.id === chat.id);

          if (existingIndex >= 0) {
            userChats[existingIndex] = { ...chat, updatedAt: Date.now() };
          } else {
            userChats.push({ ...chat, id: chat.id || generateId(), createdAt: Date.now(), updatedAt: Date.now() });
          }

          chatStore.set(resolvedUsername, userChats);
          console.log(`[Chat API] Saved chat for ${resolvedUsername}, total: ${userChats.length}`);
          sendJson(res, { success: true, chatId: chat.id });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/chats/load', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;

          const chats = chatStore.get(resolvedUsername) || [];
          sendJson(res, { chats });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/chats/delete', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username, chatId } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;
          if (!chatId) return sendJson(res, { error: 'chatId required' }, 400);

          let userChats = chatStore.get(resolvedUsername) || [];
          userChats = userChats.filter(c => c.id !== chatId);
          chatStore.set(resolvedUsername, userChats);
          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // ========================================
      // MEMORY SYNC API
      // ========================================

      server.middlewares.use('/api/memories/save', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username, memory } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;
          if (!memory) return sendJson(res, { error: 'Memory required' }, 400);

          let userMemories = memoryStore.get(resolvedUsername) || [];
          userMemories.push({ ...memory, id: memory.id || generateId(), createdAt: Date.now() });
          memoryStore.set(resolvedUsername, userMemories);

          console.log(`[Memory API] Saved memory for ${resolvedUsername}, total: ${userMemories.length}`);
          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/memories/load', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;

          const memories = memoryStore.get(resolvedUsername) || [];
          sendJson(res, { memories });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/memories/delete', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username, memoryId } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;
          if (!memoryId) return sendJson(res, { error: 'memoryId required' }, 400);

          let userMemories = memoryStore.get(resolvedUsername) || [];
          userMemories = userMemories.filter(m => m.id !== memoryId);
          memoryStore.set(resolvedUsername, userMemories);
          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/memories/clear', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;

          memoryStore.set(resolvedUsername, []);
          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // ========================================
      // ADMIN SETTINGS API
      // ========================================

      server.middlewares.use('/api/admin/settings', async (req, res, next) => {
        if (req.method === 'GET') {
          sendJson(res, { settings: adminSettings, broadcasts: broadcastQueue });
        } else if (req.method === 'POST') {
          try {
            const updates = await parseBody(req);
            Object.assign(adminSettings, updates);
            console.log(`[Admin API] Settings updated:`, adminSettings);
            sendJson(res, { success: true, settings: adminSettings });
          } catch (e) {
            sendJson(res, { error: 'Invalid JSON' }, 400);
          }
        } else {
          next();
        }
      });

      server.middlewares.use('/api/admin/broadcast', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { message, type } = await parseBody(req);
          if (!message) return sendJson(res, { error: 'Message required' }, 400);

          const broadcast = {
            id: generateId(),
            message,
            sender: session.displayName || session.username,
            type: type || 'alert',
            timestamp: Date.now()
          };

          broadcastQueue.push(broadcast);
          console.log(`[Admin API] Broadcast sent: "${message}"`);

          // Keep only last 50 broadcasts
          while (broadcastQueue.length > 50) broadcastQueue.shift();

          sendJson(res, { success: true, broadcast });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/admin/lockdown', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { active } = await parseBody(req);
          adminSettings.lockdown = active !== false;
          console.log(`[Admin API] Lockdown ${adminSettings.lockdown ? 'ACTIVATED' : 'DEACTIVATED'}`);
          sendJson(res, { success: true, lockdown: adminSettings.lockdown });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/admin/kick', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username } = await parseBody(req);
          const normalizedUsername = username?.toUpperCase?.().trim?.();
          if (normalizedUsername) {
            if (normalizedUsername === session.username) {
              return sendJson(res, { error: 'Cannot kick the active admin session' }, 400);
            }

            presenceStore.delete(normalizedUsername);
            kickedUsers.add(normalizedUsername); // Persist kick
            // Add kick notification to broadcasts
            broadcastQueue.push({
              id: generateId(),
              message: `${normalizedUsername} has been disconnected by admin`,
              sender: 'SYSTEM',
              type: 'kick',
              targetUser: normalizedUsername,
              timestamp: Date.now()
            });
            console.log(`[Admin API] Kicked user: ${normalizedUsername}`);
          }
          sendJson(res, { success: true, kickedUsers: Array.from(kickedUsers) });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Unkick user (allow them to login again)
      server.middlewares.use('/api/admin/unkick', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { username } = await parseBody(req);
          const normalizedUsername = username?.toUpperCase?.().trim?.();
          if (normalizedUsername) {
            kickedUsers.delete(normalizedUsername);
            console.log(`[Admin API] Unkicked user: ${normalizedUsername}`);
          }
          sendJson(res, { success: true, kickedUsers: Array.from(kickedUsers) });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Get kicked users list
      server.middlewares.use('/api/admin/kicked', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        sendJson(res, { kickedUsers: Array.from(kickedUsers) });
      });

      // Containment toggle (triggers containment on all clients)
      server.middlewares.use('/api/admin/containment', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { active } = await parseBody(req);
          adminSettings.containment = active !== false;
          console.log(`[Admin API] Containment ${adminSettings.containment ? 'ACTIVATED' : 'RELEASED'}`);

          // Broadcast containment action
          broadcastQueue.push({
            id: generateId(),
            message: adminSettings.containment ? 'CONTAINMENT PROTOCOL INITIATED' : 'CONTAINMENT RELEASED',
            sender: 'SYSTEM',
            type: adminSettings.containment ? 'containment' : 'containment_release',
            timestamp: Date.now()
          });

          sendJson(res, { success: true, containment: adminSettings.containment });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Weather setting (syncs to all clients)
      server.middlewares.use('/api/admin/weather', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { weather } = await parseBody(req);
          if (weather && ['none', 'rain', 'snow', 'matrix'].includes(weather)) {
            adminSettings.weather = weather;
            console.log(`[Admin API] Weather set to: ${weather}`);
          }
          sendJson(res, { success: true, weather: adminSettings.weather });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // ========================================
      // GROUP CHAT API
      // ========================================


      server.middlewares.use('/api/groups/create', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { name, members } = await parseBody(req);
          if (!name || !members) return sendJson(res, { error: 'Name and members required' }, 400);
          if (!Array.isArray(members)) return sendJson(res, { error: 'Members must be an array' }, 400);

          const creator = session.username;
          const normalizedMembers = members
            .map(m => (typeof m === 'string' ? m.toUpperCase().trim() : ''))
            .filter(Boolean);

          const group = {
            id: generateId(),
            name,
            members: [...new Set([creator, ...normalizedMembers])],
            messages: [],
            createdAt: Date.now(),
            createdBy: creator
          };

          groupStore.set(group.id, group);
          console.log(`[Group API] Created group "${name}" with members: ${group.members.join(', ')}`);
          sendJson(res, { success: true, group });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/groups/list', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;

          const groups = Array.from(groupStore.values())
            .filter(g => g.members.includes(resolvedUsername))
            .map(g => ({ id: g.id, name: g.name, members: g.members, messageCount: g.messages.length }));

          sendJson(res, { groups });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/groups/message', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { groupId, sender, content, isAI } = await parseBody(req);
          if (!groupId || !content) return sendJson(res, { error: 'groupId and content required' }, 400);

          const group = groupStore.get(groupId);
          if (!group) return sendJson(res, { error: 'Group not found' }, 404);
          if (!group.members.includes(session.username)) {
            return sendJson(res, { error: 'Not a member of this group' }, 403);
          }

          const message = {
            id: generateId(),
            sender: isAI ? (sender || 'ParaOS') : session.username,
            content,
            isAI: isAI || false,
            timestamp: Date.now()
          };

          group.messages.push(message);

          // Keep only last 500 messages per group
          while (group.messages.length > 500) group.messages.shift();

          sendJson(res, { success: true, message });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/groups/messages', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { groupId, since } = await parseBody(req);
          if (!groupId) return sendJson(res, { error: 'groupId required' }, 400);

          const group = groupStore.get(groupId);
          if (!group) return sendJson(res, { error: 'Group not found' }, 404);
          if (!group.members.includes(session.username)) {
            return sendJson(res, { error: 'Not a member of this group' }, 403);
          }

          // Return messages since timestamp, or last 100 if no timestamp
          let messages = group.messages;
          if (since) {
            messages = messages.filter(m => m.timestamp > since);
          } else {
            messages = messages.slice(-100);
          }

          sendJson(res, { messages, groupName: group.name, members: group.members });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      server.middlewares.use('/api/groups/typing', async (req, res, next) => {
        if (req.method === 'POST') {
          try {
            const session = req.__paraosSession;
            const { groupId, text } = await parseBody(req);
            if (!groupId) return sendJson(res, { error: 'groupId required' }, 400);

            const group = groupStore.get(groupId);
            if (!group) return sendJson(res, { error: 'Group not found' }, 404);
            if (!group.members.includes(session.username)) {
              return sendJson(res, { error: 'Not a member of this group' }, 403);
            }

            typingStore.set(`${groupId}:${session.username}`, {
              username: session.username,
              text: text || '',
              timestamp: Date.now()
            });

            sendJson(res, { success: true });
          } catch (e) {
            sendJson(res, { error: 'Invalid JSON' }, 400);
          }
        } else if (req.method === 'GET') {
          const session = req.__paraosSession;
          // Get typing indicators for a group
          const url = new URL(req.url, 'http://localhost');
          const groupId = url.searchParams.get('groupId');

          if (!groupId) return sendJson(res, { error: 'groupId required' }, 400);
          const group = groupStore.get(groupId);
          if (!group) return sendJson(res, { error: 'Group not found' }, 404);
          if (!group.members.includes(session.username)) {
            return sendJson(res, { error: 'Not a member of this group' }, 403);
          }

          const now = Date.now();
          const typing = [];

          for (const [key, data] of typingStore.entries()) {
            if (key.startsWith(`${groupId}:`) && now - data.timestamp < 5000) {
              typing.push(data);
            }
          }

          sendJson(res, { typing });
        } else {
          next();
        }
      });

      // ========================================
      // GROUP INVITE SYSTEM
      // ========================================

      // Send invite to user
      server.middlewares.use('/api/groups/invite/send', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { groupId, toUser } = await parseBody(req);
          if (!groupId || !toUser || typeof toUser !== 'string') return sendJson(res, { error: 'groupId and toUser required' }, 400);
          const normalizedToUser = toUser.toUpperCase().trim();

          const group = groupStore.get(groupId);
          if (!group) return sendJson(res, { error: 'Group not found' }, 404);
          if (!group.members.includes(session.username)) {
            return sendJson(res, { error: 'Not a member of this group' }, 403);
          }

          // Don't invite if already a member
          if (group.members.includes(normalizedToUser)) {
            return sendJson(res, { error: 'User already in group' }, 400);
          }

          // Create invite
          const invite = {
            inviteId: generateId(),
            groupId,
            groupName: group.name,
            fromUser: session.username,
            timestamp: Date.now()
          };

          // Add to pending invites for user
          const userInvites = pendingInvites.get(normalizedToUser) || [];
          // Don't duplicate
          if (!userInvites.some(i => i.groupId === groupId)) {
            userInvites.push(invite);
            pendingInvites.set(normalizedToUser, userInvites);
          }

          sendJson(res, { success: true, invite });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Get pending invites for user
      server.middlewares.use('/api/groups/invite/pending', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;

          const invites = pendingInvites.get(resolvedUsername) || [];
          sendJson(res, { invites });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Accept invite
      server.middlewares.use('/api/groups/invite/accept', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { inviteId, username } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;
          if (!inviteId) return sendJson(res, { error: 'inviteId required' }, 400);

          const userInvites = pendingInvites.get(resolvedUsername) || [];
          const inviteIndex = userInvites.findIndex(i => i.inviteId === inviteId);

          if (inviteIndex === -1) return sendJson(res, { error: 'Invite not found' }, 404);

          const invite = userInvites[inviteIndex];
          const group = groupStore.get(invite.groupId);

          if (!group) return sendJson(res, { error: 'Group no longer exists' }, 404);

          // Add user to group
          if (!group.members.includes(resolvedUsername)) {
            group.members.push(resolvedUsername);
          }

          // Remove invite
          userInvites.splice(inviteIndex, 1);
          pendingInvites.set(resolvedUsername, userInvites);

          // Queue animation broadcast for all group members
          groupAnimationQueue.push({
            type: 'join',
            groupId: invite.groupId,
            groupName: group.name,
            newMember: resolvedUsername,
            members: [...group.members],
            timestamp: Date.now()
          });

          sendJson(res, { success: true, groupId: invite.groupId, groupName: group.name });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Decline invite
      server.middlewares.use('/api/groups/invite/decline', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { inviteId, username } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;
          if (!inviteId) return sendJson(res, { error: 'inviteId required' }, 400);

          const userInvites = pendingInvites.get(resolvedUsername) || [];
          const filtered = userInvites.filter(i => i.inviteId !== inviteId);
          pendingInvites.set(resolvedUsername, filtered);

          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Poll for group animation events
      server.middlewares.use('/api/groups/animation/poll', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { username, since } = await parseBody(req);
          const resolvedUsername = resolveUsername(session, username, res);
          if (!resolvedUsername) return;

          const sinceTime = since || 0;
          const now = Date.now();

          // Get animations for groups user is in, within last 30 seconds
          const animations = groupAnimationQueue.filter(a => {
            const group = groupStore.get(a.groupId);
            return group &&
              group.members.includes(resolvedUsername) &&
              a.timestamp > sinceTime &&
              now - a.timestamp < 30000;
          });

          sendJson(res, { animations });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // ========================================
      // GROUP MANAGEMENT
      // ========================================

      // Rename group
      server.middlewares.use('/api/groups/rename', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { groupId, newName } = await parseBody(req);
          if (!groupId || !newName) return sendJson(res, { error: 'groupId and newName required' }, 400);

          const group = groupStore.get(groupId);
          if (!group) return sendJson(res, { error: 'Group not found' }, 404);

          // Only members can rename
          if (!group.members.includes(session.username)) {
            return sendJson(res, { error: 'Not a member of this group' }, 403);
          }

          group.name = newName;
          sendJson(res, { success: true, group: { id: group.id, name: group.name } });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Delete group
      server.middlewares.use('/api/groups/delete', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { groupId } = await parseBody(req);
          if (!groupId) return sendJson(res, { error: 'groupId required' }, 400);

          const group = groupStore.get(groupId);
          if (!group) return sendJson(res, { error: 'Group not found' }, 404);

          // Only creator or admin can delete
          if (group.createdBy !== session.username && session.role !== 'admin') {
            return sendJson(res, { error: 'Only creator can delete group' }, 403);
          }

          groupStore.delete(groupId);
          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Leave group
      server.middlewares.use('/api/groups/leave', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { groupId } = await parseBody(req);
          if (!groupId) return sendJson(res, { error: 'groupId required' }, 400);

          const group = groupStore.get(groupId);
          if (!group) return sendJson(res, { error: 'Group not found' }, 404);

          group.members = group.members.filter(m => m !== session.username);

          // Delete group if no members left
          if (group.members.length === 0) {
            groupStore.delete(groupId);
          }

          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Add member to group
      server.middlewares.use('/api/groups/member/add', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { groupId, addUser } = await parseBody(req);
          if (!groupId || !addUser || typeof addUser !== 'string') return sendJson(res, { error: 'groupId and addUser required' }, 400);
          const normalizedAddUser = addUser.toUpperCase().trim();

          const group = groupStore.get(groupId);
          if (!group) return sendJson(res, { error: 'Group not found' }, 404);

          // Only members can add
          if (!group.members.includes(session.username)) {
            return sendJson(res, { error: 'Not a member of this group' }, 403);
          }

          // Send invite instead of direct add
          const invite = {
            inviteId: generateId(),
            groupId,
            groupName: group.name,
            fromUser: session.username,
            timestamp: Date.now()
          };

          const userInvites = pendingInvites.get(normalizedAddUser) || [];
          if (!userInvites.some(i => i.groupId === groupId)) {
            userInvites.push(invite);
            pendingInvites.set(normalizedAddUser, userInvites);
          }

          sendJson(res, { success: true, invited: normalizedAddUser });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });

      // Remove member from group
      server.middlewares.use('/api/groups/member/remove', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const session = req.__paraosSession;
          const { groupId, removeUser } = await parseBody(req);
          if (!groupId || !removeUser || typeof removeUser !== 'string') return sendJson(res, { error: 'groupId and removeUser required' }, 400);
          const normalizedRemoveUser = removeUser.toUpperCase().trim();

          const group = groupStore.get(groupId);
          if (!group) return sendJson(res, { error: 'Group not found' }, 404);

          // Only creator or admin can remove others
          if (group.createdBy !== session.username && session.role !== 'admin') {
            return sendJson(res, { error: 'Only creator can remove members' }, 403);
          }

          group.members = group.members.filter(m => m !== normalizedRemoveUser);
          sendJson(res, { success: true });
        } catch (e) {
          sendJson(res, { error: 'Invalid JSON' }, 400);
        }
      });
    }
  };
}


// https://vitejs.dev/config/
const tlsKeyPath = getServerEnvValue('PARAOS_TLS_KEY_PATH') || './certs/key.pem';
const tlsCertPath = getServerEnvValue('PARAOS_TLS_CERT_PATH') || './certs/cert.pem';
const hasTlsCertificates = fs.existsSync(tlsKeyPath) && fs.existsSync(tlsCertPath);

if (!hasTlsCertificates) {
  console.warn('[ParaOS TLS] TLS certificates not found. Starting dev server over HTTP. Set PARAOS_TLS_KEY_PATH and PARAOS_TLS_CERT_PATH to enable HTTPS.');
}

export default defineConfig({
  plugins: [react(), apiPlugin(), paraosCodePlugin()],
  server: {
    port: 3000,
    host: true,
    https: hasTlsCertificates
      ? {
        key: fs.readFileSync(tlsKeyPath),
        cert: fs.readFileSync(tlsCertPath),
      }
      : false,
    proxy: {
      '/v1': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

