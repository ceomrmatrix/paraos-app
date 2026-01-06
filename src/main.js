// ========================================
// ParaOS Main Application
// ========================================

import { sendMessage, checkConnection, getSystemPrompt, setSystemPrompt, getDefaultSystemPrompt } from './api.js';
import ParaOSEntity from './entity.js';

// DOM Elements
const bootupContainer = document.getElementById('bootup-container');
const appContainer = document.getElementById('app');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistory = document.getElementById('chat-history');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.querySelector('.sidebar');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');

// State
let currentMessages = [];
let savedChats = [];
let currentChatId = null;
let isTyping = false;
let editingChatId = null;
let paraosEntity = null;
let wasOnline = true; // Track previous connection state for containment
let isContainmentActive = false;

// Smiley face HTML for avatars
const smileyAvatarHTML = `
  <div class="smiley-face avatar-smiley">
    <div class="smiley-eyes">
      <div class="smiley-eye"></div>
      <div class="smiley-eye"></div>
    </div>
    <div class="smiley-mouth"></div>
  </div>
`;

const welcomeSmileyHTML = `
  <div class="smiley-face welcome-smiley">
    <div class="smiley-eyes">
      <div class="smiley-eye"></div>
      <div class="smiley-eye"></div>
    </div>
    <div class="smiley-mouth"></div>
  </div>
`;

// ========================================
// Entity Genesis Bootup Sequence
// ========================================

function createGenesisParticles() {
    const particleContainer = document.getElementById('genesis-particles');
    if (!particleContainer) return;

    const particleCount = 40;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'genesis-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 4 + 's';
        particle.style.animationDuration = (3 + Math.random() * 3) + 's';

        const colors = ['#00f0ff', '#0ff0a0', '#8b5cf6', '#ff00ff'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.background = color;
        particle.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}`;

        particleContainer.appendChild(particle);

        // Activate with slight delay for staggered effect
        setTimeout(() => {
            particle.classList.add('active');
        }, i * 100);
    }
}

async function runBootupSequence() {
    // Genesis boot messages for each phase
    const genesisMessages = [
        'Initializing genesis void...',
        'Deploying containment chamber...',
        'Channeling energy streams...',
        'Entity consciousness awakening...',
        'Releasing containment protocols...',
        'Genesis complete. Entity online.'
    ];

    // DOM elements
    const progressFill = document.querySelector('.genesis-progress .progress-fill');
    const progressPercent = document.querySelector('.progress-percent');
    const bootMessage = document.querySelector('.boot-message');
    const statusRows = document.querySelectorAll('.status-row');
    const statItems = document.querySelectorAll('.stat-item');

    // Helper to update progress
    function updateProgress(percent) {
        if (progressFill) progressFill.style.width = percent + '%';
        if (progressPercent) progressPercent.textContent = Math.round(percent) + '%';
    }

    // Helper to update boot message
    function setMessage(msg) {
        if (bootMessage) bootMessage.textContent = msg;
    }

    // Helper to animate a stat bar
    async function animateStat(statItem, targetPercent, duration = 1000) {
        const fill = statItem.querySelector('.stat-fill');
        const value = statItem.querySelector('.stat-value');
        if (!fill || !value) return;

        const startTime = Date.now();
        const startValue = 0;

        return new Promise(resolve => {
            function update() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                const current = Math.round(startValue + (targetPercent - startValue) * eased);

                fill.style.width = current + '%';
                value.textContent = current + '%';

                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    resolve();
                }
            }
            update();
        });
    }

    // Helper to complete a status row
    function completeStatus(index) {
        if (statusRows[index]) {
            statusRows[index].classList.add('complete');
            const stateEl = statusRows[index].querySelector('.status-state');
            if (stateEl) stateEl.textContent = 'ONLINE';
        }
    }

    // ========================================
    // PHASE 1: Grid Reveal & HUD Fade In
    // ========================================
    setMessage(genesisMessages[0]);
    bootupContainer.classList.add('phase-1');
    createGenesisParticles();
    await delay(1500);
    updateProgress(10);

    // ========================================
    // PHASE 2: Chamber Assembly
    // ========================================
    setMessage(genesisMessages[1]);
    bootupContainer.classList.add('phase-2');
    updateProgress(25);

    // Animate consciousness stat
    if (statItems[0]) animateStat(statItems[0], 100, 2000);

    await delay(1500);
    completeStatus(0); // Containment Field
    updateProgress(40);

    // ========================================
    // PHASE 3: Energy Awakening
    // ========================================
    setMessage(genesisMessages[2]);
    bootupContainer.classList.add('phase-3');

    // Animate neural matrix stat
    if (statItems[1]) animateStat(statItems[1], 100, 2000);

    await delay(1500);
    completeStatus(1); // Entity Vitals
    updateProgress(55);

    // ========================================
    // PHASE 4: Entity Awakening
    // ========================================
    setMessage(genesisMessages[3]);
    bootupContainer.classList.add('phase-4');

    // Animate memory cores stat
    if (statItems[2]) animateStat(statItems[2], 100, 1500);

    await delay(1200);
    completeStatus(2); // Sync Status
    updateProgress(75);

    // Wait for eyes to open and mouth to form
    await delay(1000);
    updateProgress(85);

    // ========================================
    // PHASE 5: Release
    // ========================================
    setMessage(genesisMessages[4]);
    bootupContainer.classList.add('phase-5');
    updateProgress(95);

    await delay(1500);

    // ========================================
    // COMPLETION
    // ========================================
    setMessage(genesisMessages[5]);
    bootupContainer.classList.add('completed');
    updateProgress(100);

    await delay(1000);

    // Fade out bootup
    bootupContainer.classList.add('fade-out');
    await delay(1500);

    // Hide bootup completely BEFORE creating entity
    bootupContainer.style.display = 'none';
    appContainer.classList.remove('hidden');

    // ========================================
    // ENTITY GENESIS - Create entity AFTER bootup is gone
    // ========================================
    paraosEntity = new ParaOSEntity();
    window.paraosEntity = paraosEntity;
    window.triggerContainment = triggerContainment;
    window.releaseContainment = releaseContainment;

    // Load saved chats from localStorage
    loadSavedChats();

    // Initial connection check
    updateConnectionStatus();

    // Start periodic connection checking (every 5 seconds)
    setInterval(updateConnectionStatus, 5000);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Connection Status & Containment
// ========================================

async function updateConnectionStatus() {
    const isOnline = await checkConnection();

    if (isOnline) {
        statusDot.classList.remove('offline');
        statusDot.classList.add('online');
        statusText.textContent = 'ParaOS Online';

        // Check if we were offline and now online - release containment
        if (!wasOnline && isContainmentActive) {
            releaseContainment();
        }
        wasOnline = true;
    } else {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusText.textContent = 'ParaOS Offline';

        // Check if we just went offline - trigger containment
        if (wasOnline && !isContainmentActive) {
            triggerContainment();
        }
        wasOnline = false;
    }
}

// Containment sequence orchestration - Strict Sequential Timing
// Alarms run for 3 seconds before door animations begin
async function triggerContainment() {
    if (isContainmentActive) return;
    isContainmentActive = true;

    const overlay = document.getElementById('containment-overlay');
    if (!overlay) return;

    // ========================================
    // CLEAN STATE RESET - Ensure no leftover classes from previous containment
    // ========================================
    overlay.classList.remove(
        'active', 'releasing', 'fading-out', 'locked', 'lock-forming',
        'lock-flicker-in', 'lock-flicker-out', 'lasers-on', 'doors-closing',
        'alarm-warning', 'alarm-critical', 'alarm-clear', 'impact'
    );
    overlay.style.opacity = '';

    // ========================================
    // PHASE 0: T=0s - ALARM SEQUENCE (3 seconds)
    // ========================================
    overlay.classList.remove('hidden');
    overlay.classList.add('alarm-warning');

    // Make entity scared during alarms
    if (paraosEntity) {
        paraosEntity.setAnimation('expr-scared');
    }

    // T=1.5s - Escalate to critical alarm
    setTimeout(() => {
        overlay.classList.remove('alarm-warning');
        overlay.classList.add('alarm-critical');
    }, 1500);

    // T=3.0s - Alarms complete, begin containment sequence
    setTimeout(() => {
        overlay.classList.remove('alarm-critical');
        overlay.classList.add('active');
    }, 3000);

    // ========================================
    // PHASE 1: T=2.5s - Start Vortex Particles (during critical alarm)
    // ========================================
    setTimeout(() => {
        if (paraosEntity) {
            addVortexParticles(paraosEntity.position.x + 40, paraosEntity.position.y + 30);
        }
    }, 2500);

    // ========================================
    // PHASE 2: T=3.0s - Trigger Entity Suck (Duration 1.8s)
    // ========================================
    setTimeout(() => {
        if (paraosEntity) {
            paraosEntity.triggerContainment();
        }
    }, 3000);

    // ========================================
    // PHASE 3: T=3.5s - Activate Lasers
    // ========================================
    setTimeout(() => overlay.classList.add('lasers-on'), 3500);

    // ========================================
    // PHASE 4: T=7.3s - Entity Almost at Tube - Vortex Particles Vanish
    // ========================================
    setTimeout(() => {
        const vortexParticles = document.getElementById('active-vortex-particles');
        if (vortexParticles) {
            vortexParticles.classList.add('vortex-fade-out');
            setTimeout(() => {
                if (vortexParticles.parentNode) {
                    vortexParticles.parentNode.removeChild(vortexParticles);
                }
            }, 500);
        }
    }, 7300);

    // ========================================
    // PHASE 5: T=7.6s - Hide Entity & Close Doors
    // ========================================
    setTimeout(() => {
        if (paraosEntity && paraosEntity.element) {
            paraosEntity.element.style.zIndex = '9998';
            paraosEntity.element.style.opacity = '0';
        }
        overlay.classList.add('doors-closing');
    }, 7600);

    // ========================================
    // PHASE 6: T=8.4s - Doors Slammed, Impact & Lock Sequence
    // ========================================
    setTimeout(() => {
        overlay.classList.add('impact');
        setTimeout(() => overlay.classList.remove('impact'), 400);
        overlay.classList.add('lock-forming');
    }, 8400);

    // ========================================
    // PHASE 7: T=9.1s - Lock Flicker Animation
    // ========================================
    setTimeout(() => {
        overlay.classList.add('lock-flicker-in');
    }, 9100);

    // ========================================
    // PHASE 8: T=9.5s - Fully Locked (Bolts Slide In)
    // ========================================
    setTimeout(() => {
        overlay.classList.add('locked');
        overlay.classList.remove('lock-flicker-in');
    }, 9500);
}

// Release containment sequence - Fast and responsive
async function releaseContainment() {
    if (!isContainmentActive) return;

    const overlay = document.getElementById('containment-overlay');
    if (!overlay) return;

    // ========================================
    // PHASE 0: T=0s - GREEN ALARM + Start Release
    // ========================================
    overlay.classList.add('alarm-clear', 'releasing');
    overlay.classList.remove('locked');

    // T=1.0s - Remove locks
    setTimeout(() => {
        overlay.classList.remove('lock-forming', 'lock-flicker-in', 'lock-flicker-out');
    }, 1000);

    // ========================================
    // PHASE 1: T=2.0s - Open Doors, Show Entity
    // ========================================
    setTimeout(() => {
        overlay.classList.remove('doors-closing', 'alarm-clear');

        // Make entity visible in the tube
        if (paraosEntity && paraosEntity.element) {
            paraosEntity.element.style.opacity = '1';
            paraosEntity.element.style.zIndex = '10002';
        }
    }, 2000);

    // ========================================
    // PHASE 2: T=2.5s - EJECT! + Disable blocking
    // ========================================
    setTimeout(() => {
        // CRITICAL: Disable pointer-events so user can click UI
        overlay.style.pointerEvents = 'none';

        if (paraosEntity) {
            paraosEntity.setAnimation('expr-surprised');
            paraosEntity.releaseContainment();
        }
    }, 2500);

    // ========================================
    // PHASE 3: T=5.0s - Start Fade Out
    // ========================================
    setTimeout(() => {
        overlay.classList.add('fading-out');
    }, 5000);

    // ========================================
    // PHASE 4: T=6.0s - Complete Cleanup
    // ========================================
    setTimeout(() => {
        overlay.classList.remove(
            'active', 'releasing', 'fading-out', 'locked', 'lock-forming',
            'lock-flicker-in', 'lock-flicker-out', 'lasers-on', 'doors-closing',
            'alarm-warning', 'alarm-critical', 'alarm-clear', 'impact'
        );
        overlay.classList.add('hidden');
        overlay.style.opacity = '';
        overlay.style.pointerEvents = '';
        isContainmentActive = false;

        // Restore entity
        if (paraosEntity && paraosEntity.element) {
            paraosEntity.element.style.zIndex = '10001';
            paraosEntity.element.style.opacity = '1';
            paraosEntity.element.style.transform = '';
            paraosEntity.element.style.filter = '';
        }
    }, 6000);
}

// Vortex particle effects for containment
function addVortexParticles(entityX, entityY) {
    const overlay = document.getElementById('containment-overlay');
    if (!overlay) return;

    // Create particle container
    // Create particle container - CENTERED ON SCREEN (The Trap)
    const particleContainer = document.createElement('div');
    particleContainer.className = 'vortex-particles';
    // Position is handled by CSS (left: 50%, top: 50%)
    // We don't set left/top here to avoid overwriting the CSS centering
    particleContainer.id = 'active-vortex-particles';
    particleContainer.style.opacity = '0'; // Start hidden
    particleContainer.style.transition = 'opacity 0.5s ease'; // Smooth fade in

    // Trigger fade in
    requestAnimationFrame(() => {
        particleContainer.style.opacity = '1';
    });

    // Create MANY particles for a dense effect
    const particleCount = 100; // MASSIVE UPGRADE

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'vortex-particle';

        // Randomize initial position in a circle around center
        const angle = Math.random() * Math.PI * 2;
        const distance = 150 + Math.random() * 250; // WIDER radius
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        // Set dynamic variables for this particle
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        particle.style.left = '50%';
        particle.style.top = '50%';

        // Randomize visual properties
        const duration = 0.4 + Math.random() * 0.8; // FASTER
        const delay = Math.random() * 1.0;
        const size = 2 + Math.random() * 5; // BIGGER VARIATION

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.animation = `vortexSuckIn ${duration}s cubic-bezier(0.55, 0.055, 0.675, 0.19) infinite backwards`;
        particle.style.animationDelay = `${delay}s`;

        // Random colors - MORE INTENSE
        const colors = ['#ffffff', '#00ffff', '#ff00aa', '#aa00ff'];
        particle.style.background = `radial-gradient(circle, ${colors[Math.floor(Math.random() * colors.length)]}, transparent)`;

        particleContainer.appendChild(particle);
    }

    overlay.appendChild(particleContainer);

    // Stop particles after suction completes (1.8s), then remove after doors close
    setTimeout(() => {
        particleContainer.classList.add('vortex-stopping');
        setTimeout(() => {
            particleContainer.classList.add('vortex-fade-out');
            setTimeout(() => {
                if (particleContainer.parentNode) {
                    particleContainer.parentNode.removeChild(particleContainer);
                }
            }, 500);
        }, 300);
    }, 1800);
}

setInterval(updateConnectionStatus, 5000); // Check every 5 seconds

// ========================================
// Chat Functionality
// ========================================

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function addMessage(content, role) {
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Clean content for assistant messages (remove thinking tags)
    let displayContent = content;
    if (role === 'assistant') {
        displayContent = formatMessageContent(content);
    } else {
        displayContent = escapeHtml(content);
    }

    const message = {
        role,
        content,
        timestamp: new Date()
    };
    currentMessages.push(message);

    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;

    messageEl.innerHTML = `
    <div class="message-avatar">
      ${role === 'assistant' ? smileyAvatarHTML : '👤'}
    </div>
    <div class="message-content">
      <div class="message-bubble">${displayContent}</div>
      <div class="message-time">${formatTime(message.timestamp)}</div>
    </div>
  `;

    messagesContainer.appendChild(messageEl);
    scrollToBottom();

    // Dispatch event for entity to react
    document.dispatchEvent(new CustomEvent('paraos-new-message', {
        detail: { role, content }
    }));

    // Auto-save current chat
    if (currentChatId) {
        saveCurrentChat();
    }
}

function showTypingIndicator() {
    const typingEl = document.createElement('div');
    typingEl.className = 'message assistant';
    typingEl.id = 'typing-indicator';

    typingEl.innerHTML = `
    <div class="message-avatar">${smileyAvatarHTML}</div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;

    messagesContainer.appendChild(typingEl);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl) {
        typingEl.remove();
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format AI message content - removes thinking tags, model tokens, and renders code blocks
function formatMessageContent(text) {
    // Remove <think>...</think> tags and their content (AI internal thoughts)
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Also remove <thinking>...</thinking> tags
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // Remove model-specific tokens and internal markers
    // Matches patterns like <|start|>, <|end|>, <|im_start|>, <|im_end|>, etc.
    cleaned = cleaned.replace(/<\|[^|>]+\|>/g, '');

    // GPT-OSS specific patterns - remove internal reasoning markers
    // Patterns like "ant 1 to=final Human:" or "step 2 to=response"
    cleaned = cleaned.replace(/\b(ant|step|part|phase|section)\s*\d+\s*(to|=)[^:]*:?\s*/gi, '');
    cleaned = cleaned.replace(/\bto=(final|response|output|answer|user|Human)[^"]*"?/gi, '');

    // Remove "Human:" prefix that leaks through
    cleaned = cleaned.replace(/^Human:\s*/gi, '');
    cleaned = cleaned.replace(/\sHuman:\s*/gi, ' ');

    // Remove common AI internal markers (AUROBOT, ASSISTANT:, etc.)
    cleaned = cleaned.replace(/(AUROBOT|ASSISTANT|AI|BOT|SYSTEM)[\s:]*(?:We should|I should|Let me|I'll|I will)[^.]*\./gi, '');
    cleaned = cleaned.replace(/(AUROBOT|ASSISTANT|AI|BOT|SYSTEM)[\s:]*/gi, '');
    cleaned = cleaned.replace(/AI\s*\([^)]*\)/gi, ''); // AI(ends that) etc.

    // Remove any reasoning prefixes that leak through
    cleaned = cleaned.replace(/(We should|I should think|Let me think|Thinking:|Reasoning:|We need to)[^.]*\.\s*/gi, '');

    // Remove metadata patterns like "analysis to=commentary)*" etc.
    cleaned = cleaned.replace(/\b(analysis|commentary|response|thought|reasoning)\s*[=:][^)]*\)?\**/gi, '');
    cleaned = cleaned.replace(/\*+[^*]*\*+/g, ''); // Remove *...* italics with internal content
    cleaned = cleaned.replace(/\([^)]*(?:commentary|analysis|response|ends?)\s*[^)]*\)/gi, ''); // (ends that) etc.

    // Remove JSON-like commentary/metadata patterns
    cleaned = cleaned.replace(/\(\{[^}]*\}\)/gi, ''); // ({...})
    cleaned = cleaned.replace(/\{[^}]*"?(commentary|response|thought|reasoning|analysis)"?\s*:[^}]*\}/gi, '');
    cleaned = cleaned.replace(/^\s*\{[^}]+\}\s*/g, ''); // Remove leading JSON objects
    cleaned = cleaned.replace(/\s*\{[^}]+\}\s*$/g, ''); // Remove trailing JSON objects

    // Remove trailing JSON artifacts like }), }], ]), etc.
    cleaned = cleaned.replace(/[\}\]\)]+\s*$/g, ''); // Trailing }, ], )
    cleaned = cleaned.replace(/^\s*[\{\[\(]+/g, ''); // Leading {, [, (

    // Clean up leftover punctuation and symbols
    cleaned = cleaned.replace(/^[\s\.\?\!\*\-\=\:\,]+/, ''); // Leading punctuation
    cleaned = cleaned.replace(/[\s\.\?\!]+$/, ''); // Trailing punctuation (keep some)
    cleaned = cleaned.replace(/\s{2,}/g, ' '); // Multiple spaces

    // Trim leading/trailing whitespace
    cleaned = cleaned.trim();

    // If cleaned is too short or empty, try to extract meaningful content
    if (cleaned.length < 5) {
        // Try to find a greeting or common response start
        const match = text.match(/(Hello!?|Hi!?|Hey!?|Greetings!?|Sure!?|Of course!?|I'd be happy to).*/i);
        if (match) {
            cleaned = match[0];
        }
    }

    // Escape HTML first (to prevent XSS)
    cleaned = escapeHtml(cleaned);

    // Now render code blocks (```language\ncode\n```)
    cleaned = cleaned.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        return `<div class="code-block"><div class="code-header"><span class="code-lang">${language}</span><button class="code-copy" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent)">Copy</button></div><pre><code class="language-${language}">${code.trim()}</code></pre></div>`;
    });

    // Render inline code (`code`)
    cleaned = cleaned.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Convert newlines to <br> for paragraphs
    cleaned = cleaned.replace(/\n/g, '<br>');

    return cleaned;
}

async function handleSendMessage() {
    const content = messageInput.value.trim();
    if (!content || isTyping) return;

    messageInput.value = '';
    autoResizeTextarea();

    // Create new chat if this is the first message
    if (!currentChatId) {
        currentChatId = generateId();
        const title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        const newChat = {
            id: currentChatId,
            title: title,
            messages: [],
            createdAt: new Date().toISOString()
        };
        savedChats.unshift(newChat);
    }

    addMessage(content, 'user');

    isTyping = true;
    showTypingIndicator();

    // Trigger entity AI generation effect
    if (window.paraosEntity) {
        window.paraosEntity.startGenerating();
    }

    try {
        const response = await sendMessage(currentMessages);

        removeTypingIndicator();
        isTyping = false;

        // Stop entity effect
        if (window.paraosEntity) {
            window.paraosEntity.stopGenerating(response.success);
        }

        if (response.success) {
            addMessage(response.content, 'assistant');
        } else {
            addMessage('I apologize, but I encountered an error processing your request. Please try again.', 'assistant');
        }
    } catch (error) {
        removeTypingIndicator();
        isTyping = false;

        // Stop entity effect (failure)
        if (window.paraosEntity) {
            window.paraosEntity.stopGenerating(false);
        }

        addMessage('Connection error. Please check if ParaOS server is running.', 'assistant');
        updateConnectionStatus();
    }

    saveCurrentChat();
    renderChatHistory();
}

function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

// ========================================
// Chat History Management
// ========================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function loadSavedChats() {
    try {
        const saved = localStorage.getItem('paraos_chats');
        if (saved) {
            savedChats = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load saved chats:', e);
        savedChats = [];
    }
    renderChatHistory();
}

function saveChatsTolocalStorage() {
    try {
        localStorage.setItem('paraos_chats', JSON.stringify(savedChats));
    } catch (e) {
        console.error('Failed to save chats:', e);
    }
}

function saveCurrentChat() {
    if (!currentChatId) return;

    const chatIndex = savedChats.findIndex(c => c.id === currentChatId);
    if (chatIndex !== -1) {
        savedChats[chatIndex].messages = currentMessages.map(m => ({
            ...m,
            timestamp: m.timestamp.toISOString()
        }));
    }
    saveChatsTolocalStorage();
}

function renderChatHistory() {
    // Keep the label
    const label = chatHistory.querySelector('.history-label');
    chatHistory.innerHTML = '';
    if (label) chatHistory.appendChild(label);
    else {
        const newLabel = document.createElement('div');
        newLabel.className = 'history-label';
        newLabel.textContent = 'Recent Conversations';
        chatHistory.appendChild(newLabel);
    }

    savedChats.forEach(chat => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item' + (chat.id === currentChatId ? ' active' : '');
        historyItem.dataset.chatId = chat.id;

        const messageCount = chat.messages ? chat.messages.length : 0;
        const preview = messageCount + ' message' + (messageCount !== 1 ? 's' : '');

        historyItem.innerHTML = `
      <div class="history-icon">💬</div>
      <div class="history-content">
        <div class="history-title">${escapeHtml(chat.title)}</div>
        <div class="history-preview">${preview}</div>
      </div>
      <div class="history-actions">
        <button class="history-action-btn edit" title="Edit title" data-action="edit">✏️</button>
        <button class="history-action-btn delete" title="Delete chat" data-action="delete">🗑️</button>
      </div>
    `;

        // Click to load chat
        historyItem.addEventListener('click', (e) => {
            if (e.target.closest('.history-action-btn')) return;
            loadChat(chat.id);
        });

        chatHistory.appendChild(historyItem);
    });

    // Add event listeners for action buttons
    chatHistory.querySelectorAll('.history-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const chatId = e.target.closest('.history-item').dataset.chatId;
            const action = e.target.dataset.action;

            if (action === 'edit') {
                openEditModal(chatId);
            } else if (action === 'delete') {
                deleteChat(chatId);
            }
        });
    });
}

function loadChat(chatId) {
    const chat = savedChats.find(c => c.id === chatId);
    if (!chat) return;

    currentChatId = chatId;
    currentMessages = (chat.messages || []).map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
    }));

    // Clear and rebuild messages
    messagesContainer.innerHTML = '';

    if (currentMessages.length === 0) {
        messagesContainer.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">${welcomeSmileyHTML}</div>
        <h2>Welcome to ParaOS</h2>
        <p>Your AI assistant from Paradox Artificial Intelligence Research Facility</p>
        <p class="welcome-hint">Start a conversation below...</p>
      </div>
    `;
    } else {
        currentMessages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${msg.role}`;

            messageEl.innerHTML = `
        <div class="message-avatar">
          ${msg.role === 'assistant' ? smileyAvatarHTML : '👤'}
        </div>
        <div class="message-content">
          <div class="message-bubble">${escapeHtml(msg.content)}</div>
          <div class="message-time">${formatTime(msg.timestamp)}</div>
        </div>
      `;

            messagesContainer.appendChild(messageEl);
        });
        scrollToBottom();
    }

    renderChatHistory();
}

function deleteChat(chatId) {
    if (!confirm('Delete this conversation?')) return;

    savedChats = savedChats.filter(c => c.id !== chatId);
    saveChatsTolocalStorage();

    if (currentChatId === chatId) {
        clearChat();
    }

    renderChatHistory();
}

function clearChat() {
    currentMessages = [];
    currentChatId = null;
    messagesContainer.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">${welcomeSmileyHTML}</div>
      <h2>Welcome to ParaOS</h2>
      <p>Your AI assistant from Paradox Artificial Intelligence Research Facility</p>
      <p class="welcome-hint">Start a conversation below...</p>
    </div>
  `;
    renderChatHistory();
}

// ========================================
// Edit Modal
// ========================================

function createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'edit-modal';
    modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">Edit Chat Title</div>
      <input type="text" class="modal-input" id="edit-title-input" placeholder="Enter new title...">
      <div class="modal-buttons">
        <button class="modal-btn cancel" id="modal-cancel">Cancel</button>
        <button class="modal-btn confirm" id="modal-confirm">Save</button>
      </div>
    </div>
  `;
    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('modal-cancel').addEventListener('click', closeEditModal);
    document.getElementById('modal-confirm').addEventListener('click', saveEditedTitle);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeEditModal();
    });
}

function openEditModal(chatId) {
    editingChatId = chatId;
    const chat = savedChats.find(c => c.id === chatId);
    if (!chat) return;

    const modal = document.getElementById('edit-modal');
    const input = document.getElementById('edit-title-input');
    input.value = chat.title;
    modal.classList.add('visible');
    input.focus();
    input.select();
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    modal.classList.remove('visible');
    editingChatId = null;
}

function saveEditedTitle() {
    if (!editingChatId) return;

    const input = document.getElementById('edit-title-input');
    const newTitle = input.value.trim();
    if (!newTitle) return;

    const chatIndex = savedChats.findIndex(c => c.id === editingChatId);
    if (chatIndex !== -1) {
        savedChats[chatIndex].title = newTitle;
        saveChatsTolocalStorage();
        renderChatHistory();
    }

    closeEditModal();
}

// ========================================
// Event Listeners
// ========================================

sendBtn.addEventListener('click', handleSendMessage);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

messageInput.addEventListener('input', autoResizeTextarea);

newChatBtn.addEventListener('click', () => {
    if (currentMessages.length > 0) {
        saveCurrentChat();
    }
    clearChat();
});

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// DEBUG EXPORT
window.triggerContainment = triggerContainment;
window.releaseContainment = releaseContainment;

// Handle Enter in edit modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && editingChatId) {
        saveEditedTitle();
    }
    if (e.key === 'Escape' && editingChatId) {
        closeEditModal();
    }
});

// ========================================
// Initialize
// ========================================

// Settings Modal
function initSettingsModal() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsCancel = document.getElementById('settings-cancel');
    const settingsSave = document.getElementById('settings-save');
    const systemPromptInput = document.getElementById('system-prompt-input');

    if (!settingsModal) return;

    // Get custom prompt (not default) - returns empty if using default
    const getCustomPrompt = () => {
        try {
            return localStorage.getItem('paraos_system_prompt') || '';
        } catch (e) {
            return '';
        }
    };

    // Load current custom prompt (empty shows placeholder)
    systemPromptInput.value = getCustomPrompt();

    // Open settings
    settingsBtn?.addEventListener('click', () => {
        systemPromptInput.value = getCustomPrompt();
        settingsModal.classList.add('visible');
    });

    // Close settings
    const closeSettings = () => {
        settingsModal.classList.remove('visible');
    };

    settingsClose?.addEventListener('click', closeSettings);
    settingsCancel?.addEventListener('click', closeSettings);

    // Click outside to close
    settingsModal?.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
    });

    // Save settings
    settingsSave?.addEventListener('click', () => {
        const newPrompt = systemPromptInput.value.trim();
        setSystemPrompt(newPrompt);
        closeSettings();
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal.classList.contains('visible')) {
            closeSettings();
        }
    });

    // Data Absorption Toggle - update status text
    const dataAbsorptionToggle = document.getElementById('data-absorption-toggle');
    const dataAbsorptionStatus = document.querySelector('.data-status');
    if (dataAbsorptionToggle && dataAbsorptionStatus) {
        dataAbsorptionToggle.addEventListener('change', () => {
            dataAbsorptionStatus.textContent = dataAbsorptionToggle.checked ? 'Active' : 'Not Active';
        });
    }

    // Neural Firewall Toggle
    const firewallToggle = document.getElementById('neural-firewall-toggle');
    const firewallStatus = document.querySelector('.firewall-status');
    if (firewallToggle && firewallStatus) {
        firewallToggle.addEventListener('change', () => {
            firewallStatus.textContent = firewallToggle.checked ? 'Active' : 'Disabled';
        });
    }

    // Quantum Processing Toggle
    const quantumToggle = document.getElementById('quantum-mode-toggle');
    const quantumStatus = document.querySelector('.quantum-status');
    if (quantumToggle && quantumStatus) {
        quantumToggle.addEventListener('change', () => {
            quantumStatus.textContent = quantumToggle.checked ? 'Enabled' : 'Disabled';
        });
    }

    // Ambient Entity Toggle
    const ambientToggle = document.getElementById('ambient-entity-toggle');
    const ambientStatus = document.querySelector('.ambient-status');
    if (ambientToggle && ambientStatus) {
        ambientToggle.addEventListener('change', () => {
            ambientStatus.textContent = ambientToggle.checked ? 'Active' : 'Disabled';
        });
    }

    // Dark Protocol Toggle
    const darkToggle = document.getElementById('dark-protocol-toggle');
    const darkStatus = document.querySelector('.dark-status');
    if (darkToggle && darkStatus) {
        darkToggle.addEventListener('change', () => {
            darkStatus.textContent = darkToggle.checked ? 'Engaged' : 'Disengaged';
        });
    }
}

// ========================================
// HOLOGRAPHIC INFO PANEL
// ========================================
function initHolographicInfo() {
    // Create the holographic panel element
    const holoPanel = document.createElement('div');
    holoPanel.className = 'holo-info-panel';
    holoPanel.innerHTML = `
        <div class="holo-header">
            <div class="holo-title"></div>
            <button class="holo-close">×</button>
        </div>
        <div class="holo-content"></div>
    `;
    document.body.appendChild(holoPanel);

    // Create the projector beam element
    const projectorBeam = document.createElement('div');
    projectorBeam.className = 'holo-projector-beam';
    document.body.appendChild(projectorBeam);

    let activeIcon = null;

    // Close panel
    const closePanel = () => {
        holoPanel.classList.remove('visible');
        projectorBeam.classList.remove('visible');
        if (activeIcon) {
            activeIcon.classList.remove('active');
            activeIcon = null;
        }
    };

    // Update beam position to connect icon to panel
    const updateBeamPosition = () => {
        if (!activeIcon) return;

        const iconRect = activeIcon.getBoundingClientRect();
        const panelRect = holoPanel.getBoundingClientRect();

        // Start from panel's right edge and point toward icon
        const startX = panelRect.right;
        const startY = panelRect.top + panelRect.height / 2;

        // End at icon center
        const endX = iconRect.left + iconRect.width / 2;
        const endY = iconRect.top + iconRect.height / 2;

        // Calculate distance and angle
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Position beam at start point, pointing toward icon
        projectorBeam.style.left = startX + 'px';
        projectorBeam.style.top = startY + 'px';
        projectorBeam.style.width = distance + 'px';
        projectorBeam.style.transform = `rotate(${angle}deg)`;
    };

    // Close button handler
    holoPanel.querySelector('.holo-close').addEventListener('click', closePanel);

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (holoPanel.classList.contains('visible') &&
            !holoPanel.contains(e.target) &&
            !e.target.closest('.toggle-info-icon')) {
            closePanel();
        }
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && holoPanel.classList.contains('visible')) {
            closePanel();
        }
    });

    // Handle all toggle info icons
    document.querySelectorAll('.toggle-info-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();

            // If clicking same icon, toggle off
            if (activeIcon === icon) {
                closePanel();
                return;
            }

            // Close previous if any
            if (activeIcon) {
                activeIcon.classList.remove('active');
            }

            // Get the tooltip content from this icon
            const tooltipDiv = icon.querySelector('.toggle-tooltip');
            if (!tooltipDiv) return;

            const titleEl = tooltipDiv.querySelector('.tooltip-title');
            const contentEl = tooltipDiv.querySelector('.tooltip-content');

            // Populate hologram panel
            holoPanel.querySelector('.holo-title').textContent = titleEl ? titleEl.textContent : 'Information';
            holoPanel.querySelector('.holo-content').innerHTML = contentEl ? contentEl.innerHTML : '';

            // Activate
            activeIcon = icon;
            icon.classList.add('active');
            holoPanel.classList.add('visible');

            // Update beam after panel is visible (needs layout)
            requestAnimationFrame(() => {
                updateBeamPosition();
                projectorBeam.classList.add('visible');
            });
        });
    });

    // Update beam on scroll/resize
    window.addEventListener('scroll', updateBeamPosition, true);
    window.addEventListener('resize', updateBeamPosition);
}

document.addEventListener('DOMContentLoaded', () => {
    createModal();
    initSettingsModal();
    initHolographicInfo();
    runBootupSequence();
});

