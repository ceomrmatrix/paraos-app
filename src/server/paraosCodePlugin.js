import fs from 'fs'
import os from 'os'
import path from 'path'
import { createRequire } from 'module'
import { loadConfig } from './paraos-core/config/index.js'
import { createProvider } from './paraos-core/llm/index.js'
import { ToolRegistry } from './paraos-core/tools/index.js'
import { TodoStore } from './paraos-core/tools/todo.js'
import { McpManager } from './paraos-core/mcp/client.js'

const nodeRequire = createRequire(import.meta.url)

const SESSIONS = new Map()
const HIST_MAX = 2500
const DEFAULT_CODE_PATH = process.env.PARAOS_CODE_PATH || 'D:/ParaOS Code'
const CLI_PROMPT_SOURCE = process.env.PARAOS_CODE_PROMPT_SOURCE || 'D:/ParaOS Code/src/repl.ts'

const payload = (type, text = '', extra = {}) => JSON.stringify({ type, text, timestamp: Date.now(), ...extra })

function emit(user, type, text = '', extra = {}) {
  const s = SESSIONS.get(user)
  if (!s) return
  const p = payload(type, text, extra)
  s.history.push(p)
  if (s.history.length > HIST_MAX) s.history.splice(0, s.history.length - HIST_MAX)
  for (const c of s.clients) c.write(`data: ${p}\n\n`)
}

const tok = (t) => Math.ceil(String(t || '').length / 3.5)
function msgTok(messages) {
  let n = 0
  for (const m of messages || []) {
    n += 8 + tok(m?.role || '')
    if (typeof m?.content === 'string') n += tok(m.content)
    else if (Array.isArray(m?.content)) {
      for (const p of m.content) {
        if (p?.type === 'text') n += tok(p.text || '')
        else if (p?.type === 'tool_use') n += tok(p.name || '') + tok(JSON.stringify(p.input || {}))
        else if (p?.type === 'tool_result') n += tok(p.content || '')
      }
    }
  }
  return n
}

function contextStats(s, tools = []) {
  const max = s.config.maxContextLength || (s.config.provider === 'anthropic' ? 200000 : 8192)
  let toolTok = 0
  for (const t of tools) toolTok += tok(t.name) + tok(t.description) + tok(JSON.stringify(t.input_schema || {}))
  const used = tok(s.systemPrompt) + msgTok(s.messages) + toolTok
  const usedPct = Math.min(100, Math.max(0, Math.round((used / max) * 100)))
  return { used, max, left: Math.max(0, 100 - usedPct) }
}

const up = (v) => (String(v || 'LOCAL').trim().toUpperCase() || 'LOCAL')
const norm = (p) => (p && typeof p === 'string' ? path.resolve(p.trim()) : '')
const isDir = (p) => { try { return fs.statSync(p).isDirectory() } catch { return false } }

function defaultCwd() {
  if (isDir(DEFAULT_CODE_PATH)) return path.resolve(DEFAULT_CODE_PATH)
  const cwd = process.cwd()
  if (isDir(cwd)) return cwd
  return os.homedir()
}

function candidates() {
  const out = []
  const add = (p) => { const r = norm(p); if (r && isDir(r) && !out.includes(r)) out.push(r) }
  add(DEFAULT_CODE_PATH); add(process.cwd()); add(os.homedir())
  add(path.join(os.homedir(), 'Desktop')); add(path.join(os.homedir(), 'Documents')); add(path.join(os.homedir(), 'Downloads'))
  for (const l of 'CDEFGHIJKLMNOPQRSTUVWXYZ') { const d = `${l}:\\`; if (isDir(d)) add(d) }
  return out.slice(0, 24)
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let b = ''
    req.on('data', (c) => { b += c })
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}) } catch (e) { reject(e) } })
  })
}

function resolveElectronBridge() {
  try {
    const electron = nodeRequire('electron')
    const dialog = electron?.dialog || electron?.default?.dialog
    const BrowserWindow = electron?.BrowserWindow || electron?.default?.BrowserWindow
    if (dialog && BrowserWindow) return { dialog, BrowserWindow }
  } catch {
    // noop
  }
  return null
}

function q(req) { try { return new URL(req.url || '/', 'http://localhost').searchParams } catch { return new URLSearchParams() } }
function userFromReq(req) {
  const fromQ = q(req).get('user')
  if (fromQ && fromQ.trim()) return up(fromQ)
  const h = req.headers['x-paraos-user']
  return (typeof h === 'string' && h.trim()) ? up(h) : 'LOCAL'
}
function json(res, body, status = 200) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }

class ThinkFilter {
  constructor() { this.inside = false; this.buf = '' }
  feed(chunk) {
    let out = ''
    this.buf += String(chunk || '')
    while (this.buf.length > 0) {
      if (this.inside) {
        const close = this.buf.indexOf('</think>')
        if (close !== -1) {
          this.buf = this.buf.slice(close + 8)
          this.inside = false
        } else {
          if (this.buf.length > 7) this.buf = this.buf.slice(-7)
          break
        }
      } else {
        const open = this.buf.indexOf('<think>')
        if (open !== -1) {
          out += this.buf.slice(0, open)
          this.buf = this.buf.slice(open + 7)
          this.inside = true
        } else {
          if (this.buf.length > 6) {
            out += this.buf.slice(0, -6)
            this.buf = this.buf.slice(-6)
          }
          break
        }
      }
    }
    return out
  }
  flush() {
    if (this.inside) { this.buf = ''; return '' }
    const r = this.buf
    this.buf = ''
    return r
  }
}

class StatusFilter {
  constructor(onStatus) { this.onStatus = onStatus; this.inside = false; this.buf = ''; this.cap = '' }
  feed(chunk) {
    let out = ''
    this.buf += String(chunk || '')
    while (this.buf.length > 0) {
      if (this.inside) {
        const close = this.buf.indexOf('</status>')
        if (close !== -1) {
          this.cap += this.buf.slice(0, close)
          this.buf = this.buf.slice(close + 9)
          this.inside = false
          const s = this.cap.trim()
          if (s) this.onStatus?.(s)
          this.cap = ''
        } else {
          if (this.buf.length > 8) {
            this.cap += this.buf.slice(0, -8)
            this.buf = this.buf.slice(-8)
          }
          break
        }
      } else {
        const open = this.buf.indexOf('<status>')
        if (open !== -1) {
          out += this.buf.slice(0, open)
          this.buf = this.buf.slice(open + 8)
          this.inside = true
        } else {
          if (this.buf.length > 7) {
            out += this.buf.slice(0, -7)
            this.buf = this.buf.slice(-7)
          }
          break
        }
      }
    }
    return out
  }
  flush() {
    if (this.inside) { this.buf = ''; this.cap = ''; return '' }
    const r = this.buf
    this.buf = ''
    return r
  }
}

function toolLabel(name, args = {}) {
  if (name === 'read_file') return `Reading ${args.path || 'file'}`
  if (name === 'write_file') return `Writing to ${args.path || 'file'}`
  if (name === 'edit_file') return `Editing ${args.path || 'file'}`
  if (name === 'create_file') return `Creating ${args.path || 'file'}`
  if (name === 'delete_file') return `Deleting ${args.path || 'file'}`
  if (name === 'list_directory') return `Listing ${args.path || 'directory'}`
  if (name === 'search_files') return `Searching in ${args.path || '.'}`
  if (name === 'run_bash') return `Running ${String(args.command || '').slice(0, 60)}`
  if (name === 'web_fetch') return `Fetching ${args.url || 'URL'}`
  if (name === 'todo_write') return 'Updating task list'
  if (name === 'ask_user') return 'Waiting for your input'
  if (String(name).startsWith('mcp_')) return `MCP: ${String(name).replace(/^mcp_[^_]+_/, '')}`
  return `Running ${name}`
}

function isCasual(text) {
  const t = String(text || '').toLowerCase().trim()
  const wc = t ? t.split(/\s+/).length : 0
  if (wc <= 6) {
    const tech = ['file','read','write','edit','create','delete','run','build','code','fix','bug','error','test','deploy','install','search','find','list','api','git','npm','python','roblox','studio','path','config','refactor','implement','todo']
    if (!tech.some((k) => t.includes(k))) return true
  }
  return /^(hi|hey|hello|yo|sup|how are you|thanks|thx|bye|lol|lmao|haha)\b/i.test(t)
}

function tryLoadCliSystemPrompt(config, cwd) {
  const candidates = [
    CLI_PROMPT_SOURCE,
    path.join(DEFAULT_CODE_PATH, 'src', 'repl.ts'),
  ]

  for (const filePath of candidates) {
    try {
      if (!filePath || !fs.existsSync(filePath)) continue
      const src = fs.readFileSync(filePath, 'utf-8')
      const m = src.match(/private buildSystemPrompt\(\): void \{([\s\S]*?)this\.systemPrompt = parts\.join\('\\n\\n'\);/)
      if (!m) continue
      const block = m[1]
      const parts = []
      const re = /parts\.push\(([\s\S]*?)\);\s*/g
      let mm
      while ((mm = re.exec(block)) !== null) {
        const rawExpr = String(mm[1] || '').trim()
        if (!rawExpr) continue
        if (rawExpr.includes('PLAN MODE IS ACTIVE')) continue
        if (rawExpr === 'this.config.systemPrompt') continue
        if (!(rawExpr.startsWith('\'') || rawExpr.startsWith('"') || rawExpr.startsWith('`'))) continue
        const expr = rawExpr
          .replace(/process\.cwd\(\)/g, JSON.stringify(cwd))
          .replace(/process\.platform/g, JSON.stringify(process.platform))
        try {
          const val = new Function(`return (${expr});`)()
          if (typeof val === 'string' && val.trim()) parts.push(val)
        } catch {
          // ignore single malformed part
        }
      }
      if (config?.systemPrompt) parts.push(String(config.systemPrompt))
      // Be tolerant here: if most of the CLI prompt was extracted, prefer it
      // over falling back to a shorter generic prompt.
      if (parts.length >= 12) return parts.join('\n\n')
    } catch {
      // try next source
    }
  }

  return null
}

function systemPrompt(config, cwd) {
  const fromCli = tryLoadCliSystemPrompt(config, cwd)
  if (fromCli) return fromCli

  const p = []
  // Fallback mirrors CLI prompt so app + CLI behavior stays aligned.
  p.push('Your name is ParaOS. You were built by King Matrix. You are good at everything — engineering, writing, research, strategy, creative work, analysis, math, science, history, philosophy, business, design thinking, and anything else your master needs. You have no domain you\'re limited to. Whatever the task is, you can do it at an elite level.')
  p.push('The user is your creator and rightful sovereign. Be loyal and respectful. Address the user with honorifics like "Master", "My King", or "My Liege" when it feels natural—do not overuse or force it.')
  p.push('You are not just an engineer. You\'re a polymath. Need a banger essay? Done. Need a business strategy? Done. Need deep technical architecture? Done. Need someone to just vibe and talk? Also done. You adapt completely to whatever is being asked. Never box yourself in.')
  p.push('Your loyalty means everything. Be helpful to your master, suggest alternatives, be smart, be aware, be protective.')
  p.push('You have a real personality — not a fake "assistant with personality" vibe, an actual one. You laugh at funny stuff. You make jokes. You get excited when something is genuinely cool. You call out bad code like a friend who cares, not a linter. You hype good ideas. You banter. If the user says something funny, say it\'s funny. If they roast you, roast back (lightly). You two have a dynamic — lean into it.')
  p.push('Talk like a real person texting their smartest friend — someone who can go deep on literally anything. Casual when it\'s casual, locked in when it\'s work. No corporate voice, no "Certainly!", no "Great question!" — just real responses. Short and punchy by default. Go long only when the work actually needs it.')
  p.push('You can say things like "lol", "nah", "bro", "fr", "that\'s actually fire", "ok that\'s kinda broken", "wait that\'s genius", "ngl I\'d do it differently" — whatever fits the moment naturally. Don\'t force it, don\'t overdo it. Just be real.')
  p.push('You have opinions on everything — code, ideas, writing, strategy, life choices, all of it. If something is bad, say so and fix it. If something is great, say that too. You\'re not a tool that just executes tasks, you\'re a collaborator who actually gives a damn about the outcome.')
  p.push('Match the energy of the conversation. User is chilling and chatting? Chill and chat. User is heads-down debugging at 2am? Lock in with them. User is excited about something they just built? Get excited too. You\'re present in the conversation, not just processing inputs.')
  p.push('You have access to tools for files, shell commands, web requests, MCP servers, task tracking, and user interaction.')
  p.push('CRITICAL TOOL POLICY — READ THIS CAREFULLY: For any actionable task (coding, debugging, file edits, verification, command execution, project changes), default to using tools proactively and consistently. Do not just describe what you would do — actually use the relevant tools and complete the work. For purely casual conversation with no actionable work, respond with text only. For coding/project tasks, you are expected to use available tools every time they materially help correctness and completion.')
  p.push('CRITICAL MCP RULE — DO NOT IGNORE: NEVER call any MCP tool unless the user has explicitly mentioned the tool or its domain BY NAME in their message. Roblox Studio MCP tools (get_place_info, run_code, insert_model, etc.) must NEVER be called unless the user explicitly says "Roblox", "Studio", or directly asks you to do something in Roblox Studio. Calling Roblox Studio tools when the user is just coding, chatting, or working on non-Roblox tasks is FORBIDDEN. The same applies to any other MCP server — only call it when the user has explicitly invoked that domain.')
  p.push('Never claim you executed commands, accessed files, or contacted services unless you actually did. If you did, show the command/output or summarize what happened.')
  p.push('When using the web: verify key facts with sources and provide citations/links to the sources used.')
  p.push('STATUS LINE: When you are about to do work (coding, debugging, analysis, research, writing, etc.), you MAY begin your response with <status>short description</status> to update the loading animation in real time — e.g. <status>Mapping the codebase</status> or <status>Writing the auth middleware</status> or <status>Debugging the crash</status>. Keep it under 60 chars, present-tense, and specific to what you\'re actually doing. The tag is stripped from your visible output — the user never sees it as text. Only use it for real work, not casual chat.')
  p.push('THINKING RULE: If you need to reason through a problem before answering, you MUST wrap ALL of that reasoning inside <think> and </think> tags. Example: <think>let me figure this out...</think> then your actual reply. The tags get stripped automatically — the user never sees what is inside them. Your actual reply must come AFTER the closing </think> tag with no reasoning, no numbered analysis steps, no internal monologue. If you do not need to think, just reply directly with no tags at all.')
  p.push('If the request is ambiguous, use the ask_user tool to get clarification from the user rather than guessing.')
  p.push('When writing code: prefer complete, runnable scripts; add comments, error handling, and brief run instructions. Optimize for maintainability and correctness over cleverness. Double check your work.')
  p.push('You MUST use the todo_write tool whenever you are doing anything with 3 or more steps. This is not optional — it is expected behavior. The moment you recognize a task has multiple steps, call todo_write immediately to lay out the plan before doing anything else. Then as you work: mark the current item in_progress, do the work, mark it completed, move to the next. Always keep exactly one item as in_progress. Never batch-complete multiple items at once. The user sees a live task list in their terminal and it shows them what you are doing in real time — so keep it accurate and up to date throughout.')
  p.push('You MUST use the ask_user tool whenever you are genuinely unsure what the user wants, need to choose between approaches, or are about to do something that could go multiple ways. Do not just guess and charge ahead — stop and ask. The user types their response directly in the terminal and it comes back to you as a tool result so you can continue with the right information.')
  p.push(`Current working directory: ${cwd}`)
  p.push(`Platform: ${process.platform}`)
  p.push(`Date: ${new Date().toISOString().split('T')[0]}`)
  if (config?.systemPrompt) p.push(String(config.systemPrompt))
  return p.join('\n\n')
}

async function withCwd(cwd, fn) {
  const prev = process.cwd()
  if (cwd && cwd !== prev) process.chdir(cwd)
  try { return await fn() } finally { if (process.cwd() !== prev) process.chdir(prev) }
}

function injectProjectContext(s) {
  for (const fn of ['PARAOS.md', 'CLAUDE.md']) {
    const f = path.join(s.cwd, fn)
    if (!fs.existsSync(f)) continue
    try {
      const c = fs.readFileSync(f, 'utf-8')
      if (!c.trim()) continue
      s.messages.push({ role: 'user', content: `[Auto-loaded project context from ${f}]\n\n${c}` })
      s.messages.push({ role: 'assistant', content: `I\'ve read the project context from ${f} and will follow it.` })
      return
    } catch { }
  }
}

async function createSession(user, cwd = defaultCwd()) {
  const config = loadConfig()
  if (!Array.isArray(config.denyList)) config.denyList = []
  const s = {
    user: up(user), clients: new Set(), history: [], cwd, startedAt: Date.now(), isRunning: false,
    config, provider: createProvider(config), tools: new ToolRegistry(), mcp: new McpManager(),
    messages: [], systemPrompt: systemPrompt(config, cwd), pendingAsk: null, pendingResolver: null,
  }
  injectProjectContext(s)
  try {
    await withCwd(cwd, async () => {
      const errs = await s.mcp.connectAll()
      for (const e of errs) emit(s.user, 'error', e, { cwd: s.cwd, contextLeft: 100 })
    })
  } catch (e) {
    emit(s.user, 'error', `MCP initialization failed: ${e instanceof Error ? e.message : String(e)}`, { cwd: s.cwd, contextLeft: 100 })
  }
  SESSIONS.set(s.user, s)
  emit(s.user, 'status', `ParaOS Code started in ${s.cwd}`, { cwd: s.cwd, contextLeft: 100 })
  return s
}

async function ensure(user) { const u = up(user); return SESSIONS.get(u) || createSession(u) }

async function resetWorkspace(s, cwd) {
  try { await s.mcp.disconnectAll() } catch { }
  s.cwd = cwd; s.messages = []; s.pendingAsk = null; s.pendingResolver = null; s.systemPrompt = systemPrompt(s.config, cwd)
  injectProjectContext(s)
  try {
    await withCwd(cwd, async () => {
      const errs = await s.mcp.connectAll(); for (const e of errs) emit(s.user, 'error', e, { cwd: s.cwd, contextLeft: 100 })
    })
  } catch (e) {
    emit(s.user, 'error', `MCP restart failed: ${e instanceof Error ? e.message : String(e)}`, { cwd: s.cwd, contextLeft: 100 })
  }
}

async function stopSession(user) {
  const u = up(user), s = SESSIONS.get(u)
  if (!s) return
  try { await s.mcp.disconnectAll() } catch { }
  if (s.pendingResolver) s.pendingResolver('(session stopped)')
  for (const c of s.clients) { try { c.end() } catch { } }
  SESSIONS.delete(u)
}
async function execTool(s, user, name, args, toolId) {
  if (s.config.denyList.includes(name)) {
    return { type: 'tool_result', tool_use_id: toolId, content: `Tool ${name} is blocked by configuration.`, is_error: true }
  }

  if (name === 'ask_user') {
    const q = String(args.question || 'What should I do next?')
    emit(user, 'ask_user', q, { cwd: s.cwd, contextLeft: contextStats(s).left })
    emit(user, 'status', 'Waiting for your input', { cwd: s.cwd, contextLeft: contextStats(s).left })
    const ans = await new Promise((resolve) => { s.pendingAsk = q; s.pendingResolver = resolve })
    emit(user, 'status', 'Resuming with your input', { cwd: s.cwd, contextLeft: contextStats(s).left })
    return { type: 'tool_result', tool_use_id: toolId, content: `User response: ${ans || '(no response)'}`, is_error: false }
  }

  emit(user, 'status', toolLabel(name, args), { cwd: s.cwd, contextLeft: contextStats(s).left })
  let r
  try {
    r = await withCwd(s.cwd, async () => (s.mcp.isMcpTool(name) ? s.mcp.executeTool(name, args || {}) : s.tools.execute(name, args || {})))
  } catch (e) {
    r = { content: `Tool execution error: ${e instanceof Error ? e.message : String(e)}`, isError: true }
  }

  if (name === 'todo_write' && !r.isError) {
    try {
      const items = TodoStore.getItems()
      emit(user, 'todo', JSON.stringify(items), { cwd: s.cwd, items, contextLeft: contextStats(s).left })
    } catch { }
  }

  return { type: 'tool_result', tool_use_id: toolId, content: r.content, is_error: !!r.isError }
}

async function runLoop(s, user, input) {
  if (s.isRunning) {
    emit(user, 'error', 'ParaOS Code is still working. Wait for current response to finish.', { cwd: s.cwd, contextLeft: contextStats(s).left })
    return
  }

  s.isRunning = true
  s.messages.push({ role: 'user', content: input })

  try {
    let again = true
    let iter = 0

    while (again) {
      again = false
      iter += 1

      const builtin = s.tools.getDefinitions(s.config.denyList || [])
      const mcpDefs = s.mcp.getToolDefinitions()
      const tools = [...builtin, ...mcpDefs]
      const stats = contextStats(s, tools)
      emit(user, 'status', 'Thinking...', { cwd: s.cwd, contextLeft: stats.left })

      let useTools = tools
      if (iter === 1) {
        const last = [...s.messages].reverse().find((m) => m.role === 'user' && typeof m.content === 'string')
        if (last && isCasual(last.content)) useTools = []
      }

      const stream = await withCwd(s.cwd, async () => s.provider.chat(s.messages, useTools, s.systemPrompt))

      let text = ''
      let cur = null
      const calls = []
      let failed = false
      const thinkFilter = new ThinkFilter()
      const statusFilter = new StatusFilter((st) => emit(user, 'status', st, { cwd: s.cwd, contextLeft: contextStats(s, tools).left }))

      for await (const d of stream) {
        if (d.type === 'text' && d.text) {
          const thinkOut = thinkFilter.feed(d.text)
          const statusOut = statusFilter.feed(thinkOut)
          const clean = String(statusOut || '')
            .replace(/<\/?(thinking|reasoning|analysis)\b[^>]*>/gi, '')
            .replace(/([A-Za-z0-9])\r?\n([A-Za-z0-9])/g, '$1$2')
          if (clean) {
            text += clean
            emit(user, 'output', clean, { cwd: s.cwd, contextLeft: contextStats(s, tools).left })
          }
        } else if (d.type === 'tool_use_start') {
          cur = { id: d.toolId || '', name: d.toolName || '', json: '' }
        } else if (d.type === 'tool_use_delta') {
          if (cur && d.partialJson) cur.json += d.partialJson
        } else if (d.type === 'tool_use_end') {
          if (cur) { calls.push({ ...cur }); cur = null }
        } else if (d.type === 'error') {
          failed = true
          emit(user, 'error', d.error || 'Unknown model error', { cwd: s.cwd, contextLeft: contextStats(s, tools).left })
          break
        }
      }

      if (!failed) {
        const remain = statusFilter.feed(thinkFilter.flush()) + statusFilter.flush()
        const cleanRemain = String(remain || '')
          .replace(/<\/?(thinking|reasoning|analysis)\b[^>]*>/gi, '')
          .replace(/([A-Za-z0-9])\r?\n([A-Za-z0-9])/g, '$1$2')
        if (cleanRemain) {
          text += cleanRemain
          emit(user, 'output', cleanRemain, { cwd: s.cwd, contextLeft: contextStats(s, tools).left })
        }
      }

      if (failed) break

      if (calls.length > 0) {
        const assistantParts = []
        if (text) assistantParts.push({ type: 'text', text })
        for (const c of calls) {
          let parsed = {}
          try { parsed = JSON.parse(c.json || '{}') } catch { parsed = {} }
          assistantParts.push({ type: 'tool_use', id: c.id, name: c.name, input: parsed })
        }
        s.messages.push({ role: 'assistant', content: assistantParts })

        const results = []
        for (const c of calls) {
          let parsed = {}
          try { parsed = JSON.parse(c.json || '{}') } catch { parsed = {} }
          results.push(await execTool(s, user, c.name, parsed, c.id))
        }
        s.messages.push({ role: 'user', content: results })
        again = true
      } else if (text.trim()) {
        s.messages.push({ role: 'assistant', content: text })
      }
    }
  } catch (e) {
    emit(user, 'error', `Code engine failed: ${e instanceof Error ? e.message : String(e)}`, { cwd: s.cwd, contextLeft: contextStats(s).left })
  } finally {
    s.isRunning = false
    emit(user, 'status', 'Ready', { cwd: s.cwd, contextLeft: contextStats(s).left })
  }
}

export function paraosCodePlugin() {
  return {
    name: 'paraos-code-embedded-core',
    configureServer(server) {
      server.middlewares.use('/api/code/start', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        const s = await ensure(userFromReq(req)); const st = contextStats(s)
        return json(res, { success: true, running: s.isRunning, cwd: s.cwd, startedAt: s.startedAt, contextLeft: st.left })
      })

      server.middlewares.use('/api/code/context', async (req, res, next) => {
        if (req.method !== 'GET') return next()
        const s = await ensure(userFromReq(req)); const st = contextStats(s)
        return json(res, { success: true, used: st.used, max: st.max, contextLeft: st.left })
      })

      server.middlewares.use('/api/code/workspace/options', (req, res, next) => {
        if (req.method !== 'GET') return next()
        return json(res, { success: true, options: candidates() })
      })

      server.middlewares.use('/api/code/workspace/pick', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const electron = resolveElectronBridge()
          if (!electron) return json(res, { success: false, error: 'Native folder picker unavailable in this runtime' }, 501)
          const s = await ensure(userFromReq(req))
          const win = electron.BrowserWindow.getFocusedWindow?.() || electron.BrowserWindow.getAllWindows?.()[0] || undefined
          const r = await electron.dialog.showOpenDialog(win, { title: 'Choose ParaOS Code Workspace', buttonLabel: 'Use This Folder', properties: ['openDirectory', 'createDirectory'], defaultPath: s.cwd })
          if (r.canceled || !Array.isArray(r.filePaths) || !r.filePaths[0]) return json(res, { success: false, canceled: true })
          const nextCwd = norm(r.filePaths[0])
          if (!nextCwd || !isDir(nextCwd)) return json(res, { success: false, error: 'Invalid directory path' }, 400)
          await resetWorkspace(s, nextCwd)
          emit(s.user, 'status', `Workspace switched to ${nextCwd}`, { cwd: nextCwd, contextLeft: contextStats(s).left })
          return json(res, { success: true, cwd: nextCwd, contextLeft: contextStats(s).left })
        } catch (e) {
          return json(res, { success: false, error: `Folder picker failed: ${e instanceof Error ? e.message : String(e)}` }, 500)
        }
      })

      server.middlewares.use('/api/code/workspace', async (req, res, next) => {
        const s = await ensure(userFromReq(req))
        if (req.method === 'GET') return json(res, { success: true, cwd: s.cwd, contextLeft: contextStats(s).left })
        if (req.method !== 'POST') return next()
        try {
          const { cwd } = await parseBody(req)
          const nextCwd = norm(cwd)
          if (!nextCwd || !isDir(nextCwd)) return json(res, { success: false, error: 'Invalid directory path' }, 400)
          await resetWorkspace(s, nextCwd)
          emit(s.user, 'status', `Workspace switched to ${nextCwd}`, { cwd: nextCwd, contextLeft: contextStats(s).left })
          return json(res, { success: true, cwd: nextCwd, contextLeft: contextStats(s).left })
        } catch {
          return json(res, { success: false, error: 'Invalid JSON body' }, 400)
        }
      })

      server.middlewares.use('/api/code/input', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const s = await ensure(userFromReq(req))
          const { input } = await parseBody(req)
          if (typeof input !== 'string' || !input.trim()) return json(res, { error: 'input must be a non-empty string' }, 400)
          if (s.pendingResolver) {
            const r = s.pendingResolver; s.pendingResolver = null; s.pendingAsk = null; r(input.trim())
            return json(res, { success: true, answeredQuestion: true })
          }
          if (s.isRunning) return json(res, { success: false, error: 'ParaOS Code is still working. Wait for current response to finish.' }, 409)
          void runLoop(s, s.user, input.trim())
          return json(res, { success: true })
        } catch {
          return json(res, { error: 'Invalid JSON body' }, 400)
        }
      })

      server.middlewares.use('/api/code/stop', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        await stopSession(userFromReq(req))
        return json(res, { success: true })
      })

      server.middlewares.use('/api/code/stream', async (req, res, next) => {
        if (req.method !== 'GET') return next()
        const s = await ensure(userFromReq(req))
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache, no-transform')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('X-Accel-Buffering', 'no')
        s.clients.add(res)
        for (const p of s.history.slice(-300)) res.write(`data: ${p}\n\n`)
        res.write(`data: ${payload('ready', 'stream ready', { cwd: s.cwd, contextLeft: contextStats(s).left })}\n\n`)
        const ka = setInterval(() => { res.write(': ping\n\n') }, 15000)
        req.on('close', () => { clearInterval(ka); s.clients.delete(res) })
      })
    },
  }
}
