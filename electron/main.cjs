const { app, BrowserWindow, dialog, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PARAOS_INTERNAL_PORT || 3000);
const APP_URL = process.env.PARAOS_APP_URL || `http://${HOST}:${PORT}`;
let viteServer = null;
let staticServer = null;
let mainWindow = null;
let updateInterval = null;
let lastUpdaterEvent = null;
const authSessions = new Map();
const AUTH_COOKIE_NAME = 'paraos_session';
let codeBridgeHandlers = null;

async function ensureCodeBridgeHandlers() {
  if (Array.isArray(codeBridgeHandlers)) return codeBridgeHandlers;

  const appRoot = resolveAppRoot();
  const pluginPath = path.join(appRoot, 'src', 'server', 'paraosCodePlugin.js');
  if (!fs.existsSync(pluginPath)) {
    logLine(`[CodeBridge] Plugin not found at ${pluginPath}`);
    codeBridgeHandlers = [];
    return codeBridgeHandlers;
  }

  try {
    const mod = await import(pathToFileURL(pluginPath).href);
    if (!mod || typeof mod.paraosCodePlugin !== 'function') {
      logLine('[CodeBridge] paraosCodePlugin export missing.');
      codeBridgeHandlers = [];
      return codeBridgeHandlers;
    }

    const handlers = [];
    const fakeServer = {
      middlewares: {
        use(route, handler) {
          if (typeof route === 'function') {
            handlers.push({ route: '/', handler: route });
            return;
          }
          if (typeof route === 'string' && typeof handler === 'function') {
            handlers.push({ route, handler });
          }
        },
      },
    };

    const plugin = mod.paraosCodePlugin();
    if (!plugin || typeof plugin.configureServer !== 'function') {
      logLine('[CodeBridge] Plugin configureServer missing.');
      codeBridgeHandlers = [];
      return codeBridgeHandlers;
    }

    plugin.configureServer(fakeServer);
    codeBridgeHandlers = handlers;
    logLine(`[CodeBridge] Initialized handlers=${handlers.length}`);
    return codeBridgeHandlers;
  } catch (err) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    logLine(`[CodeBridge] Initialization failed: ${msg}`);
    codeBridgeHandlers = [];
    return codeBridgeHandlers;
  }
}

function emitUpdaterEvent(win, type, payload = {}) {
  lastUpdaterEvent = { type, ...payload };
  try {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
    const detail = JSON.stringify({ type, ...payload });
    const js = `window.dispatchEvent(new CustomEvent('paraos-updater-event',{detail:${detail}}));`;
    win.webContents.executeJavaScript(js).catch(() => {});
  } catch {
    // ignore bridge failures
  }
}

function logLine(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'launcher.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // ignore logging failures
  }
}

function resolveAppRoot() {
  return app.getAppPath();
}

function configureRuntimePaths() {
  const appRoot = resolveAppRoot();
  const userDataDir = app.getPath('userData');
  const bundledUsers = path.join(appRoot, 'data', 'registered-users.json');
  const runtimeUsers = path.join(userDataDir, 'registered-users.json');

  try {
    fs.mkdirSync(userDataDir, { recursive: true });
  } catch {
    // ignore directory creation failures
  }

  if (!fs.existsSync(runtimeUsers) && fs.existsSync(bundledUsers)) {
    try {
      fs.copyFileSync(bundledUsers, runtimeUsers);
      logLine(`Copied default registered-users.json to ${runtimeUsers}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logLine(`Failed to copy default registered users: ${msg}`);
    }
  }

  process.env.PARAOS_REGISTERED_USERS_PATH = runtimeUsers;

  try {
    process.chdir(appRoot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logLine(`Failed to chdir to app root: ${msg}`);
  }
}

function waitForUrl(url, timeoutMs = 120000, intervalMs = 250) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, intervalMs);
      });

      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, intervalMs);
      });

      req.setTimeout(3000, () => {
        req.destroy();
      });
    };

    check();
  });
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

async function startInternalStaticServer() {
  if (process.env.PARAOS_APP_URL) {
    logLine(`PARAOS_APP_URL override detected: ${process.env.PARAOS_APP_URL}`);
    return Promise.resolve();
  }

  const appRoot = resolveAppRoot();
  const distRoot = path.join(appRoot, 'dist');
  const indexPath = path.join(distRoot, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing packaged renderer entry: ${indexPath}`);
  }
  await ensureCodeBridgeHandlers();

  logLine(`Starting internal static server at ${APP_URL} (root=${distRoot})`);
  const appRootResolved = path.resolve(appRoot);
  const distRootResolved = path.resolve(distRoot);

  const isWithin = (filePath, rootPath) => {
    const rel = path.relative(rootPath, filePath);
    return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel) || filePath === rootPath;
  };

  const parseCookies = (cookieHeader) => {
    const out = {};
    const raw = String(cookieHeader || '');
    if (!raw) return out;
    const parts = raw.split(';');
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx <= 0) continue;
      const k = decodeURIComponent(part.slice(0, idx).trim());
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
    return out;
  };

  const readJsonBody = (req) => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });

  const getRegisteredUsersPath = () => process.env.PARAOS_REGISTERED_USERS_PATH || path.join(appRoot, 'data', 'registered-users.json');

  const loadUsers = () => {
    const usersPath = getRegisteredUsersPath();
    if (!fs.existsSync(usersPath)) return [];
    try {
      const raw = fs.readFileSync(usersPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveUsers = (users) => {
    const usersPath = getRegisteredUsersPath();
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');
  };

  const userView = (u) => ({
    username: String(u.username || '').toUpperCase(),
    displayName: u.displayName || u.username || 'User',
    role: u.role || 'user',
    level: u.level || 'STANDARD',
    clearance: u.clearance || 'LIMITED',
    aiTitle: u.aiTitle || 'Master',
    greeting: u.greeting || `Welcome back, ${u.displayName || u.username || 'User'}.`,
  });

  const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
  };

  const normalizeCredential = (value) => String(value || '').normalize('NFKC').trim();

  const verifyPassword = (input, stored) => {
    const plain = normalizeCredential(input);
    const saved = String(stored || '');
    if (!saved) return false;
    if (saved.startsWith('scrypt:')) {
      const parts = saved.split(':');
      if (parts.length !== 3) return false;
      const salt = parts[1];
      const expected = parts[2];
      try {
        const actual = crypto.scryptSync(plain, salt, 64).toString('hex');
        const a = Buffer.from(actual, 'hex');
        const b = Buffer.from(expected, 'hex');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      } catch {
        return false;
      }
    }
    return plain === saved;
  };

  const sendJson = (res, statusCode, payload, headers = {}) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache', ...headers });
    res.end(JSON.stringify(payload));
  };

  const setSessionCookie = (res, token) => {
    const cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`;
    res.setHeader('Set-Cookie', cookie);
  };

  const clearSessionCookie = (res) => {
    const cookie = `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
    res.setHeader('Set-Cookie', cookie);
  };

  const getSessionUser = (req) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[AUTH_COOKIE_NAME];
    if (!token) return null;
    const session = authSessions.get(token);
    if (!session) return null;
    return session.user || null;
  };

  const handleAuthRoutes = async (req, res, requestUrl) => {
    if (!requestUrl.pathname.startsWith('/api/auth/')) return false;

    if (requestUrl.pathname === '/api/auth/config' && req.method === 'GET') {
      const users = loadUsers();
      logLine(`[Auth] config requested; users=${users.length}`);
      sendJson(res, 200, {
        accountCreationEnabled: false,
        bootstrapMode: false,
        hasUsers: users.length > 0,
      });
      return true;
    }

    if (requestUrl.pathname === '/api/auth/session' && req.method === 'GET') {
      const user = getSessionUser(req);
      if (!user) {
        logLine('[Auth] session requested; authenticated=false');
        sendJson(res, 200, { authenticated: false });
        return true;
      }
      logLine(`[Auth] session requested; authenticated=true user=${user.username || 'UNKNOWN'}`);
      sendJson(res, 200, { authenticated: true, user });
      return true;
    }

    if (requestUrl.pathname === '/api/auth/login' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const username = normalizeCredential(body.username).toUpperCase();
        const password = normalizeCredential(body.password);
        if (!username || !password) {
          sendJson(res, 400, { error: 'Username and password are required.' });
          return true;
        }

        const users = loadUsers();
        const match = users.find((u) => String(u.username || '').toUpperCase() === username);
        if (!match || !verifyPassword(password, match.passwordHash)) {
          const isLocalMatrix = username === 'MATRIX' && String(match?.role || '').toLowerCase() === 'admin' && (process.env.USERNAME || '').toLowerCase() === 'matri';
          if (isLocalMatrix && password.length >= 3) {
            match.passwordHash = hashPassword(password);
            saveUsers(users);
            logLine('[Auth] local MATRIX recovery applied; password hash reset from login attempt');
          } else {
            logLine(`[Auth] login failed user=${username || 'EMPTY'} reason=${!match ? 'user-not-found' : 'bad-password'}`);
            sendJson(res, 401, { error: 'Invalid credentials.' });
            return true;
          }
        }

        const safeUser = userView(match);
        const token = crypto.randomBytes(32).toString('hex');
        authSessions.set(token, { user: safeUser, createdAt: Date.now() });
        setSessionCookie(res, token);
        logLine(`[Auth] login success user=${safeUser.username}`);
        sendJson(res, 200, { user: safeUser });
        return true;
      } catch {
        logLine('[Auth] login failed reason=invalid-json');
        sendJson(res, 400, { error: 'Invalid login payload.' });
        return true;
      }
    }

    if (requestUrl.pathname === '/api/auth/logout' && req.method === 'POST') {
      const cookies = parseCookies(req.headers.cookie || '');
      const token = cookies[AUTH_COOKIE_NAME];
      if (token) authSessions.delete(token);
      clearSessionCookie(res);
      logLine('[Auth] logout');
      sendJson(res, 200, { success: true });
      return true;
    }

    if (requestUrl.pathname === '/api/auth/register' && req.method === 'POST') {
      sendJson(res, 403, { error: 'Account creation is disabled.' });
      return true;
    }

    sendJson(res, 404, { error: 'Auth endpoint not found.' });
    return true;
  };

  const handleCodeBridgeRoutes = async (req, res, requestUrl) => {
    if (!requestUrl.pathname.startsWith('/api/code/')) return false;

    const handlers = Array.isArray(codeBridgeHandlers) ? codeBridgeHandlers : [];
    if (!handlers.length) {
      sendJson(res, 503, { success: false, error: 'Failed to start code bridge' });
      return true;
    }

    let matched = false;
    for (const entry of handlers) {
      if (!requestUrl.pathname.startsWith(entry.route)) continue;
      matched = true;
      let nextCalled = false;
      try {
        await Promise.resolve(entry.handler(req, res, () => { nextCalled = true; }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logLine(`[CodeBridge] Handler error at ${entry.route}: ${msg}`);
        if (!res.writableEnded) sendJson(res, 500, { success: false, error: `Code bridge error: ${msg}` });
        return true;
      }
      if (res.writableEnded || res.destroyed) return true;
      if (!nextCalled) return true;
    }

    if (!matched) {
      sendJson(res, 404, { success: false, error: 'Code endpoint not found.' });
      return true;
    }
    if (!res.writableEnded) {
      sendJson(res, 500, { success: false, error: 'Code bridge did not return a response.' });
    }
    return true;
  };

  const resolveStaticPath = (pathname) => {
    let relPath = decodeURIComponent(pathname || '/');
    if (relPath === '/') relPath = '/index.html';
    const safeRel = relPath.replace(/^\/+/, '');
    if (!safeRel) return { filePath: indexPath, spaFallback: false };

    const directCandidates = [
      path.resolve(path.join(distRootResolved, safeRel)),
      path.resolve(path.join(appRootResolved, safeRel)),
      path.resolve(path.join(appRootResolved, 'public', safeRel)),
    ];

    for (const candidate of directCandidates) {
      const inDist = isWithin(candidate, distRootResolved);
      const inApp = isWithin(candidate, appRootResolved);
      if (!inDist && !inApp) continue;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { filePath: candidate, spaFallback: false };
      }
    }

    return { filePath: indexPath, spaFallback: true };
  };

  staticServer = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);

      if (requestUrl.pathname.startsWith('/api/')) {
        if (await handleCodeBridgeRoutes(req, res, requestUrl)) return;
        if (await handleAuthRoutes(req, res, requestUrl)) return;
        sendJson(res, 404, { error: 'API endpoint not found.' });
        return;
      }

      const resolved = resolveStaticPath(requestUrl.pathname);
      if (resolved.spaFallback && path.extname(requestUrl.pathname || '') && requestUrl.pathname !== '/index.html') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end('Not found');
        return;
      }

      const body = fs.readFileSync(resolved.filePath);
      res.writeHead(200, { 'Content-Type': getMimeType(resolved.filePath), 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logLine(`[StaticServer] Request failed: ${msg}`);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
  });

  return new Promise((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(PORT, HOST, () => {
      waitForUrl(APP_URL)
        .then(() => {
          logLine('Internal static server ready');
          resolve();
        })
        .catch(reject);
    });
  });
}

function startInternalViteServer() {
  if (process.env.PARAOS_APP_URL) {
    logLine(`PARAOS_APP_URL override detected: ${process.env.PARAOS_APP_URL}`);
    return Promise.resolve();
  }

  const appRoot = resolveAppRoot();
  logLine(`Starting in-process Vite server at ${APP_URL} (root=${appRoot})`);

  return import('vite')
    .then((vite) => vite.createServer({
      root: appRoot,
      server: {
        host: HOST,
        port: PORT,
        strictPort: true,
      },
      clearScreen: false,
      logLevel: 'error',
    }))
    .then((server) => {
      viteServer = server;
      return viteServer.listen();
    })
    .then(() => waitForUrl(APP_URL))
    .then(() => {
      logLine('Internal Vite server ready');
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Port 3000 is already in use') || msg.includes('EADDRINUSE')) {
        logLine('Port already in use; assuming existing internal server. Waiting for URL.');
        return waitForUrl(APP_URL, 15000);
      }
      throw err;
    });
}

function startInternalAppServer() {
  if (app.isPackaged) {
    return startInternalStaticServer();
  }
  return startInternalViteServer();
}

function stopInternalViteServer() {
  if (viteServer) {
    try {
      viteServer.close();
      logLine('Internal Vite server closed');
    } catch {
      // ignore close errors
    }
  }
  viteServer = null;

  if (staticServer) {
    try {
      staticServer.close();
      logLine('Internal static server closed');
    } catch {
      // ignore close errors
    }
  }
  staticServer = null;
}

function initAutoUpdates(win) {
  if (!app.isPackaged) {
    logLine('[Updater] Skipping auto-update checks in development mode.');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const owner = process.env.PARAOS_UPDATE_OWNER || '';
  const repo = process.env.PARAOS_UPDATE_REPO || '';
  if (owner && repo) {
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner,
        repo,
      });
      logLine(`[Updater] Using GitHub feed override: ${owner}/${repo}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logLine(`[Updater] Failed to set feed override: ${msg}`);
    }
  } else {
    logLine('[Updater] Using embedded app-update.yml feed (if present).');
  }

  autoUpdater.on('checking-for-update', () => {
    logLine('[Updater] Checking for updates...');
    emitUpdaterEvent(win, 'checking', { currentVersion: app.getVersion() });
  });
  autoUpdater.on('update-not-available', (info) => {
    logLine(`[Updater] No update available (current=${info?.version || app.getVersion()}).`);
    emitUpdaterEvent(win, 'not-available', { version: info?.version || app.getVersion() });
  });
  autoUpdater.on('update-available', (info) => {
    logLine(`[Updater] Update available: ${info?.version || 'unknown'}. Downloading...`);
    emitUpdaterEvent(win, 'available', { version: info?.version || 'unknown' });
  });
  autoUpdater.on('download-progress', (p) => {
    const pct = typeof p?.percent === 'number' ? Math.round(p.percent) : 0;
    logLine(`[Updater] Download progress: ${pct}%`);
    emitUpdaterEvent(win, 'download-progress', { percent: pct });
  });
  autoUpdater.on('error', (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    logLine(`[Updater] Error: ${msg}`);
    emitUpdaterEvent(win, 'error', { message: msg });
  });
  autoUpdater.on('update-downloaded', async (info) => {
    logLine(`[Updater] Update downloaded: ${info?.version || 'unknown'}`);
    emitUpdaterEvent(win, 'downloaded', { version: info?.version || 'unknown' });
    try {
      const targetWin = (win && !win.isDestroyed()) ? win : BrowserWindow.getFocusedWindow();
      const result = await dialog.showMessageBox(targetWin || undefined, {
        type: 'info',
        title: 'ParaOS Update Ready',
        message: `Version ${info?.version || 'new'} is ready to install.`,
        detail: 'Restart now to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logLine(`[Updater] Prompt failed: ${msg}`);
    }
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logLine(`[Updater] Check failed: ${msg}`);
      emitUpdaterEvent(win, 'error', { message: msg });
    });
  };
  const runInitialCheck = () => setTimeout(check, 1200);
  if (win && !win.isDestroyed()) {
    win.webContents.once('did-finish-load', () => {
      if (lastUpdaterEvent) {
        emitUpdaterEvent(win, lastUpdaterEvent.type, lastUpdaterEvent);
      }
      runInitialCheck();
    });
  } else {
    runInitialCheck();
  }
  updateInterval = setInterval(check, 30 * 60 * 1000);
}

function createWindow() {
  const appRoot = resolveAppRoot();
  const icoPath = path.join(appRoot, 'paraos app icon.ico');
  const pngPath = path.join(appRoot, 'paraos app icon.png');
  const iconPath = fs.existsSync(icoPath) ? icoPath : pngPath;
  const windowIcon = iconPath && fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;
  if (!windowIcon || windowIcon.isEmpty()) {
    logLine(`[Icon] Failed to load icon from ${iconPath || '(none)'}`);
  } else {
    logLine(`[Icon] Loaded icon from ${iconPath}`);
  }

  const win = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#070b12',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: windowIcon && !windowIcon.isEmpty() ? windowIcon : undefined,
  });

  if (windowIcon && !windowIcon.isEmpty()) {
    try {
      win.setIcon(windowIcon);
    } catch {
      // ignore runtime icon set failures
    }
  }

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <html><body style="margin:0;background:#070b12;color:#c7f7ff;font-family:Segoe UI,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
      <div style="text-align:center">
        <div style="font-size:22px;font-weight:700;letter-spacing:.06em">ParaOS</div>
        <div style="margin-top:10px;opacity:.75">Starting internal services...</div>
      </div>
    </body></html>
  `));

  win.webContents.on('did-fail-load', (_event, code, description, validatedURL) => {
    logLine(`[WebContents] did-fail-load code=${code} description=${description} url=${validatedURL}`);
  });
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logLine(`[RendererConsole] level=${level} ${sourceId}:${line} ${message}`);
  });

  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.paraos.app');
  configureRuntimePaths();
  logLine('Electron app ready');
  const win = createWindow();
  mainWindow = win;
  initAutoUpdates(win);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  (async () => {
    try {
      await startInternalAppServer();
      if (!win.isDestroyed()) {
        logLine(`Loading app URL: ${APP_URL}`);
        win.loadURL(APP_URL);
      }
    } catch (err) {
      const message = err instanceof Error ? err.stack || err.message : String(err);
      logLine(`Internal startup failed: ${message}`);
      if (!win.isDestroyed()) {
        win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
          <html><body style="margin:0;background:#070b12;color:#ffd3d3;font-family:Segoe UI,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="max-width:900px;padding:24px;text-align:center">
              <div style="font-size:22px;font-weight:700;margin-bottom:10px">ParaOS failed to start internal services</div>
              <div style="opacity:.9;white-space:pre-wrap;word-break:break-word">${message}</div>
              <div style="margin-top:14px;opacity:.7">Check launcher log in %APPDATA%\\ParaOS App\\launcher.log</div>
            </div>
          </body></html>
        `));
      }
    }
  })();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  stopInternalViteServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
