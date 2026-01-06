// ========================================
// ParaOS Entity - Living AI Companion
// An AGI-like entity that moves, explores, and feels alive
// ========================================

// Animation lists by category
const ANIMATIONS = {
    idle: [
        'idle-float', 'idle-breathe', 'idle-blink', 'idle-look-around', 'idle-hum',
        'idle-doze', 'idle-alert', 'idle-curious', 'idle-content', 'idle-sparkle',
        'idle-pulse', 'idle-orbit', 'idle-sway', 'idle-bounce-small', 'idle-twinkle',
        'idle-tilt', 'idle-inspect', 'idle-peek'
    ],
    movement: [
        'move-fly', 'move-dash', 'move-teleport', 'move-bounce', 'move-float-slow',
        'move-spiral', 'move-zigzag', 'move-dive', 'move-rise', 'move-circle',
        'move-follow', 'move-retreat', 'move-approach', 'move-shake', 'move-nod'
    ],
    expression: [
        'expr-happy', 'expr-excited', 'expr-thinking', 'expr-confused', 'expr-surprised',
        'expr-sad', 'expr-love', 'expr-cool', 'expr-wink', 'expr-laugh',
        'expr-blush', 'expr-proud', 'expr-sleepy', 'expr-angry', 'expr-suspicious',
        'expr-amazed', 'expr-nervous', 'expr-determined', 'expr-mischievous', 'expr-peaceful',
        'expr-dizzy', 'expr-mischief', 'expr-scared', 'expr-watching', 'expr-zzz', 'expr-startled',
        'expr-questioning', 'expr-intrigued', 'expr-shocked', 'expr-annoyed', 'expr-grumpy',
        'expr-unamused', 'expr-skeptical', 'expr-tired', 'expr-grateful'
    ],
    reaction: [
        'react-wave', 'react-bow', 'react-spin', 'react-flip', 'react-celebrate',
        'react-point', 'react-shrug', 'react-clap', 'react-dance', 'react-salute',
        'react-thumbsup', 'react-facepalm', 'react-peek', 'react-hide', 'react-pop',
        'react-startle', 'react-jump'
    ],
    fx: [
        'fx-glow-intense', 'fx-glitch', 'fx-hologram', 'fx-matrix', 'fx-electric',
        'fx-rainbow', 'fx-ghost', 'fx-multiply', 'fx-shrink', 'fx-grow',
        'fx-pixelate', 'fx-vaporwave', 'fx-fire', 'fx-ice', 'fx-powerup', 'fx-sparkle'
    ]
};

const ALL_ANIMATIONS = Object.values(ANIMATIONS).flat();

// Points of interest on the page
const INTEREST_POINTS = [
    { selector: '.sidebar', name: 'sidebar', weight: 2 },
    { selector: '#messages-container', name: 'chat', weight: 5 },
    { selector: '#message-input', name: 'input', weight: 4 },
    { selector: '.new-chat-btn', name: 'new-chat', weight: 1 },
    { selector: '.brand', name: 'logo', weight: 1 },
    { selector: '.chat-history', name: 'history', weight: 2 },
];

class ParaOSEntity {
    constructor() {
        this.element = null;
        this.eyes = [];
        this.position = { x: 100, y: 100 };
        this.velocity = { x: 0, y: 0 };
        this.targetPosition = { x: 100, y: 100 };
        this.currentAnimation = 'idle-float';

        // Eye tracking - smooth interpolation
        this.eyeOffset = { x: 0, y: 0 };
        this.targetEyeOffset = { x: 0, y: 0 };

        // Mouse tracking
        this.mousePosition = { x: 0, y: 0 };
        this.lastMouseMove = Date.now();
        this.mouseVelocity = { x: 0, y: 0 };

        // State
        this.isMoving = false;
        this.isFollowingMouse = false;
        this.isContained = false;
        this.mood = 'curious'; // curious, happy, bored, excited, sleepy
        this.energy = 100;
        this.curiosity = 50;
        this.attention = null; // What the entity is focused on

        // Mischief state
        this.isMischievous = false;
        this.lastMischiefTime = 0;
        this.mischiefCooldown = 30000; // 30 seconds between mischief attempts
        this.lastZappedTime = 0;
        this.zapCooldown = 60000; // Wait 60 seconds after being zapped

        // Punishment variety
        this.punishmentTypes = ['laser', 'freeze', 'shrink', 'spin', 'shock'];
        this.lastPunishmentType = null;

        // Intelligence & Rewards
        this.intelligence = 1; // Grows when AI successfully responds
        this.isGenerating = false; // True when AI is generating a response
        this.totalResponses = 0; // How many successful AI responses

        // Idle/Sleep tracking
        this.lastUserActivity = Date.now();
        this.isSleeping = false;
        this.sleepAfterIdle = 45000; // Fall asleep after 45 seconds of user inactivity

        // Timers
        this.blinkTimeout = null;
        this.idleTimeout = null;
        this.thinkInterval = null;
        this.eyeUpdateLoop = null;

        // Animation lock - prevents concurrent animations from teleporting entity
        this.isAnimationLocked = false;

        this.init();
    }

    init() {
        this.createElement();
        this.setupEventListeners();
        this.startBrain();
        this.startEyeTracking();

        // ========================================
        // GENESIS RELEASE - Entity spawns from bootup animation
        // ========================================
        // Start in center of screen (where genesis chamber was)
        const startX = window.innerWidth / 2 - 40;
        const startY = window.innerHeight / 2 - 40;
        this.position.x = startX;
        this.position.y = startY;

        // Set initial position - already visible and full size (matching bootup)
        this.element.style.left = startX + 'px';
        this.element.style.top = startY + 'px';
        this.element.style.transform = 'scale(1)';
        this.element.style.opacity = '1';
        this.element.classList.add('entity-genesis-release');

        // Calculate final descent position (lower part of screen)
        const finalX = 200 + Math.random() * (window.innerWidth - 400);
        const finalY = window.innerHeight * 0.6 + Math.random() * (window.innerHeight * 0.25);

        // Start descent animation after a brief pause
        setTimeout(() => {
            // Smooth descent to final position
            this.element.style.transition = 'left 2s ease-out, top 2s ease-out';
            this.element.style.left = finalX + 'px';
            this.element.style.top = finalY + 'px';

            // Update internal position to match
            this.position.x = finalX;
            this.position.y = finalY;
        }, 100);

        // Complete transition
        setTimeout(() => {
            this.element.classList.remove('entity-genesis-release');
            this.element.style.transition = '';

            // Now set animation and start exploring
            this.setAnimation('idle-float');
            this.playAnimation('react-celebrate', 2000);

            // Initial exploration after celebrating
            setTimeout(() => this.explore(), 2500);
        }, 2200);
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'paraos-entity';
        this.element.id = 'paraos-entity';

        this.element.innerHTML = `
      <div class="entity-container">
        <div class="entity-glow"></div>
        <div class="entity-face">
          <div class="entity-eyes">
            <div class="entity-eye"><div class="entity-pupil"></div></div>
            <div class="entity-eye"><div class="entity-pupil"></div></div>
          </div>
          <div class="entity-mouth"></div>
        </div>
      </div>
    `;

        document.body.appendChild(this.element);
        this.eyes = this.element.querySelectorAll('.entity-pupil');
        this.updatePosition();
    }

    setupEventListeners() {
        // Smooth mouse tracking
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            const dt = now - this.lastMouseMove;

            if (dt > 0) {
                this.mouseVelocity = {
                    x: (e.clientX - this.mousePosition.x) / dt,
                    y: (e.clientY - this.mousePosition.y) / dt
                };
            }

            this.mousePosition = { x: e.clientX, y: e.clientY };
            this.lastMouseMove = now;

            // Track user activity for sleep system
            this.recordUserActivity();

            // If mouse moves fast, get curious
            const speed = Math.sqrt(this.mouseVelocity.x ** 2 + this.mouseVelocity.y ** 2);
            if (speed > 2) {
                this.curiosity = Math.min(100, this.curiosity + 5);
            }
        });

        // Click on entity
        this.element.addEventListener('click', () => this.onEntityClick());
        this.element.addEventListener('mouseenter', () => this.onMouseEnter());
        this.element.addEventListener('mouseleave', () => this.onMouseLeave());

        // Window events
        window.addEventListener('resize', () => this.keepInBounds());

        // Chat events
        document.addEventListener('paraos-new-message', (e) => this.onNewMessage(e.detail));

        // Typing events
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('focus', () => this.onUserTyping(true));
            messageInput.addEventListener('blur', () => this.onUserTyping(false));
            messageInput.addEventListener('input', () => this.onUserInput());
        }

        // Scroll events
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.addEventListener('scroll', () => this.onChatScroll());
        }
    }

    // ========================================
    // SMOOTH EYE TRACKING
    // ========================================

    startEyeTracking() {
        // Micro-saccade timing
        let lastSaccadeTime = Date.now();
        let saccadeOffset = { x: 0, y: 0 };

        const updateEyes = () => {
            const now = Date.now();

            // Get entity center (entity is ~80px wide/tall)
            const entityCenterX = this.position.x + 40;
            const entityCenterY = this.position.y + 35;

            // Calculate direction to mouse
            const dx = this.mousePosition.x - entityCenterX;
            const dy = this.mousePosition.y - entityCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Reduced max offset to prevent pupils going too far (was 8, now 3)
            const maxOffset = 3;

            // Calculate base target based on mouse position
            if (distance > 30) {
                // Scale offset based on distance (closer = less movement needed)
                const scale = Math.min(1, distance / 200);
                this.targetEyeOffset = {
                    x: (dx / distance) * maxOffset * scale,
                    y: (dy / distance) * maxOffset * scale
                };
            } else {
                // Mouse very close or on entity - look straight
                this.targetEyeOffset = { x: 0, y: 0 };
            }

            // Add micro-saccades (tiny random eye movements every 2-4 seconds)
            if (now - lastSaccadeTime > 2000 + Math.random() * 2000) {
                saccadeOffset = {
                    x: (Math.random() - 0.5) * 1.5,
                    y: (Math.random() - 0.5) * 1.0
                };
                lastSaccadeTime = now;

                // Saccade fades out over 300ms
                setTimeout(() => {
                    saccadeOffset = { x: 0, y: 0 };
                }, 300);
            }

            // Variable smoothness - faster when target is far, slower when close
            const targetDist = Math.sqrt(
                Math.pow(this.targetEyeOffset.x - this.eyeOffset.x, 2) +
                Math.pow(this.targetEyeOffset.y - this.eyeOffset.y, 2)
            );
            const smoothness = targetDist > 3 ? 0.2 : 0.1;

            // Smooth interpolation (lerp)
            this.eyeOffset.x += (this.targetEyeOffset.x - this.eyeOffset.x) * smoothness;
            this.eyeOffset.y += (this.targetEyeOffset.y - this.eyeOffset.y) * smoothness;

            // Apply to pupils (including micro-saccade offset)
            const finalX = this.eyeOffset.x + saccadeOffset.x;
            const finalY = this.eyeOffset.y + saccadeOffset.y;

            this.eyes.forEach(pupil => {
                pupil.style.transform = `translate(${finalX}px, ${finalY}px)`;
            });

            requestAnimationFrame(updateEyes);
        };

        updateEyes();
    }

    // ========================================
    // THE BRAIN - Autonomous Decision Making
    // ========================================

    startBrain() {
        // The entity "thinks" every second and decides what to do
        this.thinkInterval = setInterval(() => this.think(), 1000);

        // Blink randomly
        this.scheduleBlink();
    }

    think() {
        // Decrease energy slowly
        this.energy = Math.max(0, this.energy - 0.5);

        // Curiosity decays if nothing interesting
        this.curiosity = Math.max(0, this.curiosity - 1);

        // Check if user has been idle too long - entity gets sleepy
        const idleTime = Date.now() - this.lastUserActivity;
        if (idleTime > this.sleepAfterIdle && !this.isSleeping) {
            this.fallAsleep();
            return;
        }

        // Update mood based on state
        this.updateMood();

        // Make decisions based on mood and state
        if (this.isMoving || this.isFollowingMouse) return;

        const decision = Math.random();

        // Special behaviors that can trigger regardless of mood
        const now = Date.now();

        // Mischief chance - try to mess with buttons!
        if (!this.isMischievous &&
            now - this.lastMischiefTime > this.mischiefCooldown &&
            now - this.lastZappedTime > this.zapCooldown &&
            decision < 0.08) { // 8% chance per think
            this.attemptMischief();
            return;
        }

        // Random sneeze/hiccup
        if (decision > 0.97) {
            this.doRandomQuirk();
            return;
        }

        // Different behaviors based on mood
        switch (this.mood) {
            case 'curious':
                if (decision < 0.25) this.investigateMouse();
                else if (decision < 0.4) this.explore();
                else if (decision < 0.55) this.lookAtSomethingInteresting();
                else if (decision < 0.65) this.watchUserTyping(); // NEW
                break;

            case 'excited':
                if (decision < 0.4) this.doExcitedBehavior();
                else if (decision < 0.7) this.flyAroundHappily();
                break;

            case 'bored':
                if (decision < 0.25) this.wander();
                else if (decision < 0.4) this.playAnimation('idle-sway', 3000);
                else if (decision < 0.5) this.explore();
                else if (decision < 0.6) this.attemptMischief(); // More likely when bored
                break;

            case 'sleepy':
                if (decision < 0.3) this.playAnimation('idle-doze', 5000);
                else if (decision < 0.5) this.playAnimation('expr-zzz', 5000);
                break;

            case 'happy':
                if (decision < 0.2) this.playAnimation('expr-happy', 2000);
                else if (decision < 0.4) this.playAnimation('idle-sparkle', 2000);
                else if (decision < 0.5) this.flyAroundHappily();
                break;
        }
    }

    updateMood() {
        if (this.energy < 20) {
            this.mood = 'sleepy';
        } else if (this.curiosity > 70) {
            this.mood = 'curious';
        } else if (this.curiosity > 50) {
            this.mood = this.energy > 80 ? 'excited' : 'happy';
        } else if (this.curiosity < 20) {
            this.mood = 'bored';
        } else {
            this.mood = 'happy';
        }
    }

    scheduleBlink() {
        const nextBlink = 2000 + Math.random() * 4000;
        this.blinkTimeout = setTimeout(() => {
            this.blink();
            this.scheduleBlink();
        }, nextBlink);
    }

    blink() {
        const eyeEls = this.element.querySelectorAll('.entity-eye');
        eyeEls.forEach(eye => {
            eye.style.transform = 'scaleY(0.1)';
        });
        setTimeout(() => {
            eyeEls.forEach(eye => {
                eye.style.transform = 'scaleY(1)';
            });
        }, 150);
    }

    // ========================================
    // AUTONOMOUS BEHAVIORS
    // ========================================

    investigateMouse() {
        const distance = this.getDistanceToMouse();

        if (distance > 200) {
            // Far from mouse - approach curiously
            this.playAnimation('idle-curious', 1000);
            setTimeout(() => {
                this.flyTowards(this.mousePosition.x - 60, this.mousePosition.y - 60, 0.5);
            }, 500);
        } else if (distance < 80) {
            // Very close - back off a little
            this.retreat();
        } else {
            // Good distance - just watch
            this.playAnimation('idle-alert', 2000);
        }
    }

    explore() {
        // Pick a random point of interest
        const point = this.pickInterestPoint();
        if (point) {
            const rect = point.element.getBoundingClientRect();
            let targetX = rect.left + Math.random() * rect.width;
            let targetY = rect.top - 80 + Math.random() * 40;

            // Clamp to viewport bounds
            const maxX = window.innerWidth - 100;
            const maxY = window.innerHeight - 100;
            targetX = Math.max(50, Math.min(targetX, maxX));
            targetY = Math.max(50, Math.min(targetY, maxY));

            this.attention = point.name;
            this.playAnimation('idle-curious', 500);

            setTimeout(() => {
                this.flyTo(targetX, targetY);
            }, 500);
        } else {
            this.wander();
        }
    }

    pickInterestPoint() {
        const available = INTEREST_POINTS
            .map(p => ({ ...p, element: document.querySelector(p.selector) }))
            .filter(p => p.element);

        if (available.length === 0) return null;

        // Weighted random selection
        const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;

        for (const point of available) {
            random -= point.weight;
            if (random <= 0) return point;
        }

        return available[0];
    }

    lookAtSomethingInteresting() {
        const point = this.pickInterestPoint();
        if (point) {
            const rect = point.element.getBoundingClientRect();
            this.lookAtPosition(rect.left + rect.width / 2, rect.top + rect.height / 2);
            this.playAnimation('idle-look-around', 2000);
        }
    }

    flyAroundHappily() {
        this.playAnimation('expr-excited', 500);

        const patterns = [
            () => this.flyInCircle(),
            () => this.doBounce(),
            () => this.zigzagMove(),
        ];

        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        setTimeout(() => pattern(), 500);
    }

    flyInCircle() {
        // Prevent concurrent animations
        if (this.isAnimationLocked) return;
        this.isAnimationLocked = true;

        const centerX = this.position.x;
        const centerY = this.position.y;
        const radius = 50;
        let angle = 0;

        const animate = () => {
            angle += 0.1;
            if (angle > Math.PI * 2) {
                this.isMoving = false;
                this.isAnimationLocked = false;
                return;
            }

            this.position.x = centerX + Math.cos(angle) * radius;
            this.position.y = centerY + Math.sin(angle) * radius;
            this.updatePosition();

            requestAnimationFrame(animate);
        };

        this.isMoving = true;
        animate();
    }

    doBounce() {
        // Prevent concurrent animations
        if (this.isAnimationLocked) return;
        this.isAnimationLocked = true;

        let bounces = 0;
        const maxBounces = 3;
        const startY = this.position.y;

        const bounce = () => {
            if (bounces >= maxBounces) {
                this.isMoving = false;
                this.isAnimationLocked = false;
                return;
            }

            // Bounce up then down
            this.animateTo(this.position.x + (Math.random() - 0.5) * 100, startY - 60, 200).then(() => {
                return this.animateTo(this.position.x, startY, 200);
            }).then(() => {
                bounces++;
                bounce();
            });
        };

        this.isMoving = true;
        bounce();
    }

    zigzagMove() {
        // Prevent concurrent animations
        if (this.isAnimationLocked) return;
        this.isAnimationLocked = true;

        const directions = [1, -1, 1, -1];
        let step = 0;

        const move = () => {
            if (step >= directions.length) {
                this.isMoving = false;
                this.isAnimationLocked = false;
                return;
            }

            const newX = this.position.x + directions[step] * 80;
            const newY = this.position.y - 30;

            this.animateTo(newX, newY, 200).then(() => {
                step++;
                move();
            });
        };

        this.isMoving = true;
        move();
    }

    doExcitedBehavior() {
        const behaviors = [
            () => { this.playAnimation('react-spin', 800); },
            () => { this.playAnimation('react-dance', 2000); },
            () => { this.playAnimation('fx-sparkle', 1500); },
            () => { this.playAnimation('expr-excited', 1500); },
        ];

        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        behavior();
    }

    retreat() {
        const dx = this.position.x - this.mousePosition.x;
        const dy = this.position.y - this.mousePosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const retreatX = this.position.x + (dx / distance) * 100;
        const retreatY = this.position.y + (dy / distance) * 50;

        this.playAnimation('move-retreat', 500);
        this.flyTo(retreatX, retreatY);
    }

    wander() {
        // Don't wander if animation is locked
        if (this.isAnimationLocked || this.isMoving) return;

        // Clamp to viewport bounds
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 100;

        let randomX = this.position.x + (Math.random() - 0.5) * 300;
        let randomY = this.position.y + (Math.random() - 0.5) * 200;

        randomX = Math.max(50, Math.min(randomX, maxX));
        randomY = Math.max(50, Math.min(randomY, maxY));

        this.flyTo(randomX, randomY);
    }

    // ========================================
    // MOVEMENT
    // ========================================

    setPosition(x, y) {
        this.position = { x, y };
        this.targetPosition = { x, y };
        this.updatePosition();
    }

    flyTo(x, y) {
        // Don't start new flight if already in a locked animation
        if (this.isAnimationLocked) {
            return Promise.resolve();
        }

        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 100;

        this.targetPosition = {
            x: Math.max(50, Math.min(x, maxX)),
            y: Math.max(50, Math.min(y, maxY))
        };

        this.isMoving = true;

        // Increment animation ID to cancel any previous smoothFly loops
        this.currentFlyId = (this.currentFlyId || 0) + 1;
        const flyId = this.currentFlyId;

        // Return promise that resolves when movement completes
        return new Promise(resolve => {
            this.flyResolve = resolve;
            this.smoothFly(flyId);
        });
    }

    flyTowards(x, y, factor = 1) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;

        this.flyTo(
            this.position.x + dx * factor,
            this.position.y + dy * factor
        );
    }

    smoothFly(flyId) {
        // Cancel if a newer flyTo was called
        if (flyId !== this.currentFlyId) {
            return;
        }

        const dx = this.targetPosition.x - this.position.x;
        const dy = this.targetPosition.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 3) {
            this.position = { ...this.targetPosition };
            this.updatePosition();
            this.isMoving = false;
            // Resolve the promise if one was set
            if (this.flyResolve) {
                this.flyResolve();
                this.flyResolve = null;
            }
            return;
        }

        // Smooth easing
        const ease = 0.08;
        this.position.x += dx * ease;
        this.position.y += dy * ease;

        // Clamp position to viewport bounds
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 100;
        this.position.x = Math.max(50, Math.min(this.position.x, maxX));
        this.position.y = Math.max(50, Math.min(this.position.y, maxY));

        this.updatePosition();

        requestAnimationFrame(() => this.smoothFly(flyId));
    }

    animateTo(x, y, duration) {
        return new Promise(resolve => {
            const startX = this.position.x;
            const startY = this.position.y;
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Ease out
                const eased = 1 - Math.pow(1 - progress, 3);

                this.position.x = startX + (x - startX) * eased;
                this.position.y = startY + (y - startY) * eased;
                this.updatePosition();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            animate();
        });
    }

    updatePosition() {
        // If contained AND NOT animating, lock position to center of screen
        if (this.isContained && !this.isBeingContained) {
            const centerX = window.innerWidth / 2 - 40;
            const centerY = window.innerHeight / 2 - 40;
            this.element.style.left = centerX + 'px';
            this.element.style.top = centerY + 'px';
            return;
        }
        this.element.style.left = this.position.x + 'px';
        this.element.style.top = this.position.y + 'px';
    }

    keepInBounds() {
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 100;

        if (this.position.x > maxX || this.position.y > maxY) {
            this.flyTo(
                Math.min(this.position.x, maxX),
                Math.min(this.position.y, maxY)
            );
        }
    }

    getDistanceToMouse() {
        const dx = this.mousePosition.x - this.position.x;
        const dy = this.mousePosition.y - this.position.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    lookAtPosition(x, y) {
        // This triggers a manual look - the smooth eye tracking will handle it
        this.targetEyeOffset = {
            x: Math.max(-4, Math.min(4, (x - this.position.x) / 50)),
            y: Math.max(-4, Math.min(4, (y - this.position.y) / 50))
        };
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    onEntityClick() {
        this.curiosity = 100;
        this.energy = Math.min(100, this.energy + 30);

        // 30 different mouse reaction animations
        const curiousReactions = [
            () => this.playAnimation('expr-curious', 1500),
            () => this.playAnimation('idle-curious', 1500),
            () => this.playAnimation('idle-look-around', 1800),
            () => this.playAnimation('expr-thinking', 2000),
            () => this.playAnimation('expr-confused', 1500),
            () => this.playAnimation('idle-tilt', 1200),
            () => this.playAnimation('expr-questioning', 1500),
            () => this.playAnimation('idle-inspect', 1800),
            () => this.playAnimation('expr-intrigued', 1500),
            () => this.playAnimation('idle-peek', 1200),
        ];

        const happyReactions = [
            () => this.playAnimation('expr-happy', 1500),
            () => this.playAnimation('expr-excited', 1200),
            () => this.playAnimation('expr-love', 2000),
            () => this.playAnimation('react-wave', 1500),
            () => this.playAnimation('expr-blush', 1500),
            () => this.playAnimation('react-celebrate', 2000),
            () => this.playAnimation('expr-proud', 1500),
            () => this.playAnimation('fx-sparkle', 1500),
            () => this.playAnimation('expr-grateful', 1500),
            () => this.playAnimation('idle-sparkle', 1800),
        ];

        const surprisedReactions = [
            () => this.playAnimation('expr-surprised', 1000),
            () => this.playAnimation('expr-shocked', 1200),
            () => this.playAnimation('react-startle', 800),
            () => this.playAnimation('expr-amazed', 1500),
            () => this.playAnimation('react-jump', 600),
        ];

        const annoyedReactions = [
            () => this.playAnimation('expr-annoyed', 1500),
            () => this.playAnimation('expr-grumpy', 1500),
            () => this.playAnimation('expr-unamused', 1500),
            () => this.playAnimation('expr-skeptical', 1500),
            () => this.playAnimation('expr-tired', 1500),
        ];

        // Combine all reactions
        const allReactions = [
            ...curiousReactions,
            ...happyReactions,
            ...surprisedReactions,
            ...annoyedReactions
        ];

        const reaction = allReactions[Math.floor(Math.random() * allReactions.length)];
        reaction();
    }

    onMouseEnter() {
        this.playAnimation('expr-surprised', 500);
        this.curiosity = Math.min(100, this.curiosity + 20);
    }

    onMouseLeave() {
        // Sometimes follow the mouse when it leaves
        if (Math.random() < 0.3 && this.mood === 'curious') {
            this.followMouse(true, 3000);
        }
    }

    onNewMessage(detail) {
        this.energy = Math.min(100, this.energy + 20);
        this.curiosity = Math.min(100, this.curiosity + 30);

        if (detail.role === 'user') {
            // User sent message - show interest
            const chatContainer = document.getElementById('messages-container');
            if (chatContainer) {
                const rect = chatContainer.getBoundingClientRect();
                this.flyTo(rect.right - 100, rect.bottom - 100);
            }
            this.playAnimation('idle-alert', 1500);
        } else if (detail.role === 'assistant') {
            // AI responded - react happily
            this.playAnimation('expr-happy', 2000);
            this.parseAICommands(detail.content);
        }
    }

    onUserTyping(isTyping) {
        if (isTyping) {
            const input = document.getElementById('message-input');
            if (input) {
                const rect = input.getBoundingClientRect();
                this.flyTo(rect.right + 20, rect.top - 50);
            }
            this.playAnimation('idle-curious', 0);
        }
    }

    onUserInput() {
        // Perk up when user is actively typing
        this.curiosity = Math.min(100, this.curiosity + 2);
    }

    onChatScroll() {
        // Look at the chat when scrolling
        this.lookAtPosition(
            window.innerWidth / 2,
            window.innerHeight / 2
        );
    }

    // ========================================
    // MOUSE FOLLOWING
    // ========================================

    followMouse(enable, duration = 5000) {
        this.isFollowingMouse = enable;

        if (enable) {
            this.playAnimation('expr-excited', 1000);
            this.followMouseLoop();

            if (duration > 0) {
                setTimeout(() => this.followMouse(false), duration);
            }
        }
    }

    followMouseLoop() {
        if (!this.isFollowingMouse) return;

        const targetX = this.mousePosition.x - 40;
        const targetY = this.mousePosition.y - 60;

        // Smooth follow with some lag
        this.position.x += (targetX - this.position.x) * 0.1;
        this.position.y += (targetY - this.position.y) * 0.1;
        this.updatePosition();

        requestAnimationFrame(() => this.followMouseLoop());
    }

    // ========================================
    // ANIMATIONS
    // ========================================

    setAnimation(animName) {
        ALL_ANIMATIONS.forEach(anim => {
            this.element.classList.remove(`entity-anim-${anim}`);
        });

        if (animName && ALL_ANIMATIONS.includes(animName)) {
            this.element.classList.add(`entity-anim-${animName}`);
            this.currentAnimation = animName;
        }
    }

    playAnimation(animName, duration = 2000) {
        this.setAnimation(animName);

        if (duration > 0) {
            if (this.idleTimeout) clearTimeout(this.idleTimeout);
            this.idleTimeout = setTimeout(() => {
                this.setAnimation('idle-float');
            }, duration);
        }
    }

    // ========================================
    // AI CONTROL
    // ========================================

    parseAICommands(content) {
        const commandPattern = /\[ENTITY:([^\]]+)\]/gi;
        let match;

        while ((match = commandPattern.exec(content)) !== null) {
            const command = match[1].trim().toLowerCase();
            this.executeCommand(command);
        }
    }

    executeCommand(command) {
        const cleanCommand = command.replace(/-/g, '-');

        if (ALL_ANIMATIONS.includes(cleanCommand)) {
            this.playAnimation(cleanCommand, 3000);
            return;
        }

        if (command.startsWith('move_to:')) {
            const coords = command.replace('move_to:', '').split(',');
            if (coords.length === 2) {
                const x = parseInt(coords[0]);
                const y = parseInt(coords[1]);
                if (!isNaN(x) && !isNaN(y)) {
                    this.flyTo(x, y);
                }
            }
        } else if (command.startsWith('follow:')) {
            const target = command.replace('follow:', '');
            if (target === 'mouse') {
                this.followMouse(true, 5000);
            }
        } else if (command === 'stop') {
            this.followMouse(false);
            this.setAnimation('idle-float');
        } else if (command === 'explore') {
            this.explore();
        } else if (command === 'dance') {
            this.playAnimation('react-dance', 3000);
        } else if (command === 'celebrate') {
            this.playAnimation('react-celebrate', 3000);
        }
    }

    // ========================================
    // PUBLIC API
    // ========================================

    getState() {
        return {
            position: this.position,
            animation: this.currentAnimation,
            mood: this.mood,
            energy: this.energy,
            curiosity: this.curiosity,
            isMoving: this.isMoving,
            isContained: this.isContained
        };
    }

    // ========================================
    // MISCHIEF & INTERACTIVE BEHAVIORS
    // ========================================

    attemptMischief() {
        // Don't be mischievous if recently zapped
        const now = Date.now();
        if (now - this.lastZappedTime < this.zapCooldown) return;

        this.isMischievous = true;
        this.lastMischiefTime = now;

        // Find a button to mess with
        const buttons = document.querySelectorAll('button, .btn, [role="button"]');
        const validButtons = Array.from(buttons).filter(btn => {
            const rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });

        if (validButtons.length === 0) {
            this.isMischievous = false;
            return;
        }

        // Pick a random button
        const targetButton = validButtons[Math.floor(Math.random() * validButtons.length)];
        const rect = targetButton.getBoundingClientRect();

        // Mischievous expression - sneaky approach
        this.setAnimation('expr-mischief');

        // Fly toward the button
        this.flyTo(rect.left + rect.width / 2 - 40, rect.top - 50).then(() => {
            // Look at the button with interest
            this.setAnimation('expr-watching');

            // After a moment, try to "touch" it
            setTimeout(() => {
                if (!this.isMischievous) return; // Cancelled

                // Move closer like about to press it
                this.playAnimation('idle-bounce-small', 500);

                setTimeout(() => {
                    // RANDOM PUNISHMENT! Entity gets caught!
                    this.getRandomPunishment(targetButton);
                }, 500);
            }, 1000);
        });
    }

    getLaserZapped(sourceElement) {
        if (!this.isMischievous) return;

        this.lastZappedTime = Date.now();
        this.isMischievous = false;

        // Add laser target indicator
        this.element.classList.add('entity-laser-target');

        // Create laser beam effect from element to entity
        this.createLaserBeam(sourceElement);

        // Entity gets scared!
        setTimeout(() => {
            this.element.classList.remove('entity-laser-target');
            this.setAnimation('expr-scared');

            // Screen flash effect
            const flash = document.createElement('div');
            flash.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(255, 0, 60, 0.3);
                pointer-events: none;
                z-index: 9998;
                animation: laserFlash 0.3s ease-out forwards;
            `;
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 300);

            // Run away scared!
            const escapeX = this.position.x + (Math.random() - 0.5) * 600;
            const escapeY = Math.max(100, this.position.y - 200 - Math.random() * 200);

            this.flyTo(
                Math.max(50, Math.min(window.innerWidth - 100, escapeX)),
                Math.max(50, Math.min(window.innerHeight - 100, escapeY))
            ).then(() => {
                // Still scared, look back at the button
                setTimeout(() => {
                    this.setAnimation('expr-nervous');
                    setTimeout(() => {
                        this.setAnimation('idle-float');
                        this.energy = Math.max(20, this.energy - 30);
                    }, 2000);
                }, 500);
            });
        }, 300);
    }

    createLaserBeam(sourceElement) {
        const rect = sourceElement.getBoundingClientRect();
        const sourceX = rect.left + rect.width / 2;
        const sourceY = rect.top + rect.height / 2;
        const targetX = this.position.x + 40;
        const targetY = this.position.y + 40;

        const beam = document.createElement('div');
        const length = Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2));
        const angle = Math.atan2(targetY - sourceY, targetX - sourceX) * 180 / Math.PI;

        beam.style.cssText = `
            position: fixed;
            left: ${sourceX}px;
            top: ${sourceY}px;
            width: ${length}px;
            height: 4px;
            background: linear-gradient(90deg, #ff003c, #ff6600, #ff003c);
            box-shadow: 0 0 10px #ff003c, 0 0 20px #ff6600;
            transform-origin: left center;
            transform: rotate(${angle}deg);
            z-index: 9999;
            pointer-events: none;
            animation: laserPulse 0.3s ease-out forwards;
        `;

        document.body.appendChild(beam);
        setTimeout(() => beam.remove(), 300);
    }

    // Random punishment - pick different punishment type each time
    getRandomPunishment(sourceElement) {
        // Pick a punishment different from the last one
        let available = this.punishmentTypes.filter(p => p !== this.lastPunishmentType);
        const punishment = available[Math.floor(Math.random() * available.length)];
        this.lastPunishmentType = punishment;

        switch (punishment) {
            case 'laser':
                this.getLaserZapped(sourceElement);
                break;
            case 'freeze':
                this.getFreezePunishment();
                break;
            case 'shrink':
                this.getShrinkPunishment();
                break;
            case 'spin':
                this.getSpinPunishment();
                break;
            case 'shock':
                this.getShockPunishment();
                break;
        }
    }

    getFreezePunishment() {
        this.lastZappedTime = Date.now();
        this.isMischievous = false;

        // Freeze in place with ice effect
        this.element.classList.add('entity-frozen');
        this.setAnimation('expr-surprised');

        // Add ice overlay
        const ice = document.createElement('div');
        ice.style.cssText = `
            position: absolute;
            inset: -10px;
            background: radial-gradient(circle, rgba(100, 200, 255, 0.4) 0%, rgba(50, 150, 255, 0.2) 100%);
            border: 2px solid rgba(150, 220, 255, 0.8);
            border-radius: 50%;
            pointer-events: none;
            animation: freezePulse 0.5s ease-in-out infinite;
        `;
        this.element.appendChild(ice);

        // Can't move for 3 seconds
        const originalEnergy = this.energy;
        this.energy = 0;

        setTimeout(() => {
            ice.remove();
            this.element.classList.remove('entity-frozen');
            this.energy = Math.max(30, originalEnergy - 40);
            this.setAnimation('move-shake');
            setTimeout(() => this.setAnimation('idle-float'), 1000);
        }, 3000);
    }

    getShrinkPunishment() {
        this.lastZappedTime = Date.now();
        this.isMischievous = false;

        this.setAnimation('expr-scared');

        // Shrink to tiny size
        let scale = 1;
        const shrinkAnim = () => {
            scale *= 0.9;
            this.element.style.transform = `scale(${scale})`;
            if (scale > 0.2) {
                requestAnimationFrame(shrinkAnim);
            } else {
                // Stay tiny for 2 seconds
                setTimeout(() => {
                    // Grow back with overshoot
                    let grow = 0.2;
                    const growAnim = () => {
                        grow += 0.05;
                        this.element.style.transform = `scale(${Math.min(grow, 1.1)})`;
                        if (grow < 1.1) {
                            requestAnimationFrame(growAnim);
                        } else {
                            this.element.style.transform = 'scale(1)';
                            this.setAnimation('expr-nervous');
                            setTimeout(() => this.setAnimation('idle-float'), 1000);
                        }
                    };
                    growAnim();
                }, 2000);
            }
        };
        shrinkAnim();
    }

    getSpinPunishment() {
        this.lastZappedTime = Date.now();
        this.isMischievous = false;

        this.setAnimation('expr-dizzy');

        // Spin uncontrollably
        let rotation = 0;
        const spinDuration = 3000;
        const startTime = Date.now();

        const spinAnim = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / spinDuration;

            // Start fast, slow down
            const speed = (1 - progress * 0.8) * 30;
            rotation += speed;

            this.element.style.transform = `rotate(${rotation}deg)`;

            if (progress < 1) {
                requestAnimationFrame(spinAnim);
            } else {
                this.element.style.transform = 'rotate(0deg)';
                this.setAnimation('expr-dizzy');
                setTimeout(() => this.setAnimation('idle-float'), 2000);
            }
        };
        spinAnim();
    }

    getShockPunishment() {
        this.lastZappedTime = Date.now();
        this.isMischievous = false;

        // Electric shock - glitchy effect
        this.element.classList.add('entity-shocked');
        this.setAnimation('fx-electric');

        // Rapid position jitter
        const originalPos = { ...this.position };
        let shockCount = 0;
        const maxShocks = 15;

        const shockAnim = () => {
            shockCount++;
            this.position.x = originalPos.x + (Math.random() - 0.5) * 20;
            this.position.y = originalPos.y + (Math.random() - 0.5) * 20;
            this.updatePosition();

            if (shockCount < maxShocks) {
                setTimeout(shockAnim, 100);
            } else {
                this.position = originalPos;
                this.updatePosition();
                this.element.classList.remove('entity-shocked');
                this.setAnimation('expr-nervous');
                this.energy = Math.max(20, this.energy - 30);
                setTimeout(() => this.setAnimation('idle-float'), 1500);
            }
        };
        shockAnim();
    }

    // ========================================
    // AI GENERATION & REWARDS
    // ========================================

    startGenerating() {
        if (this.isGenerating) return;

        this.isGenerating = true;
        this.element.classList.add('entity-generating');

        // Glitch/twitch effect while thinking
        this.setAnimation('fx-glitch');

        // Random twitches during generation
        this.generatingInterval = setInterval(() => {
            if (Math.random() < 0.3) {
                // Random glitch effect
                this.element.style.transform = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px) skewX(${(Math.random() - 0.5) * 5}deg)`;
                setTimeout(() => {
                    this.element.style.transform = 'none';
                }, 100);
            }
        }, 200);
    }

    stopGenerating(success = true) {
        if (!this.isGenerating) return;

        this.isGenerating = false;
        this.element.classList.remove('entity-generating');

        if (this.generatingInterval) {
            clearInterval(this.generatingInterval);
            this.generatingInterval = null;
        }

        this.element.style.transform = 'none';

        if (success) {
            this.rewardForSpeaking();
        } else {
            this.setAnimation('expr-sad');
            setTimeout(() => this.setAnimation('idle-float'), 2000);
        }
    }

    rewardForSpeaking() {
        this.totalResponses++;

        // Increase intelligence every few responses
        if (this.totalResponses % 3 === 0) {
            this.intelligence = Math.min(10, this.intelligence + 0.5);
            this.showIntelligenceGain();
        }

        // Reward energy and mood
        this.energy = Math.min(100, this.energy + 20);
        this.curiosity = Math.min(100, this.curiosity + 15);

        // Happy celebration
        this.setAnimation('expr-proud');
        this.element.classList.add('entity-rewarded');

        // Glow effect
        setTimeout(() => {
            this.element.classList.remove('entity-rewarded');
            this.playAnimation('idle-sparkle', 2000);
        }, 1000);
    }

    showIntelligenceGain() {
        // Visual effect showing entity got smarter
        const popup = document.createElement('div');
        popup.textContent = `🧠 +Intelligence! (Lvl ${this.intelligence.toFixed(1)})`;
        popup.style.cssText = `
            position: fixed;
            left: ${this.position.x + 40}px;
            top: ${this.position.y - 30}px;
            color: #00ffaa;
            font-size: 14px;
            font-weight: bold;
            text-shadow: 0 0 10px #00ffaa;
            z-index: 10000;
            pointer-events: none;
            animation: floatUp 2s ease-out forwards;
        `;
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 2000);

        // Visual upgrade - entity glows brighter based on intelligence
        const glowIntensity = 0.3 + (this.intelligence * 0.07);
        this.element.style.filter = `drop-shadow(0 0 ${10 + this.intelligence * 3}px rgba(0, 255, 170, ${glowIntensity}))`;

        // Reset filter after a moment
        setTimeout(() => {
            this.element.style.filter = '';
        }, 3000);
    }

    fallAsleep() {
        if (this.isSleeping) return;

        this.isSleeping = true;
        this.energy = Math.max(5, this.energy - 20);

        // Slowly float down and fall asleep
        this.setAnimation('expr-sleepy');

        setTimeout(() => {
            this.setAnimation('expr-zzz');
            // Gentle sway while sleeping
        }, 2000);
    }

    wakeUp() {
        if (!this.isSleeping) return;

        this.isSleeping = false;
        this.lastUserActivity = Date.now();

        // Startled wake up!
        this.setAnimation('expr-startled');
        this.energy = Math.min(100, this.energy + 30);
        this.curiosity = 70;

        setTimeout(() => {
            this.setAnimation('idle-alert');
            setTimeout(() => {
                this.setAnimation('idle-float');
            }, 1000);
        }, 500);
    }

    watchUserTyping() {
        const input = document.querySelector('#message-input');
        if (!input) return;

        const rect = input.getBoundingClientRect();

        this.setAnimation('expr-watching');
        this.flyTo(rect.right + 20, rect.top - 30).then(() => {
            // Watch with curiosity
            this.playAnimation('idle-curious', 3000);
        });
    }

    doRandomQuirk() {
        const quirks = ['sneeze', 'hiccup', 'yawn', 'shiver'];
        const quirk = quirks[Math.floor(Math.random() * quirks.length)];

        switch (quirk) {
            case 'sneeze':
                this.playAnimation('move-shake', 500);
                setTimeout(() => this.playAnimation('expr-surprised', 500), 500);
                break;
            case 'hiccup':
                this.element.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    this.element.style.transform = 'scale(1)';
                    this.playAnimation('expr-surprised', 300);
                }, 100);
                break;
            case 'yawn':
                this.playAnimation('expr-sleepy', 2000);
                break;
            case 'shiver':
                this.playAnimation('move-shake', 1000);
                break;
        }
    }

    // Track user activity for sleep system
    recordUserActivity() {
        this.lastUserActivity = Date.now();
        if (this.isSleeping) {
            this.wakeUp();
        }
    }

    // ========================================
    // CONTAINMENT SYSTEM (Server Disconnect)
    // ========================================

    // ========================================
    // CONTAINMENT SYSTEM (Server Disconnect)
    // ========================================

    triggerContainment() {
        if (this.isContained) return Promise.resolve();

        this.isContained = true;
        this.isBeingContained = true; // New flag to allow animation movement
        this.isMoving = false;
        this.isFollowingMouse = false;

        // Stop the brain
        if (this.thinkInterval) {
            clearInterval(this.thinkInterval);
            this.thinkInterval = null;
        }

        // Bring entity to front so it's visible during pull
        this.element.style.zIndex = '10001';

        // Distress animation - start immediately
        this.setAnimation('expr-distress');
        this.element.classList.add('entity-distress');
        this.element.classList.add('entity-magnetic-pull');

        // Get exact center of screen for containment tube
        const centerX = window.innerWidth / 2 - 40;
        const centerY = window.innerHeight / 2 - 40;

        return new Promise(resolve => {
            // Start magnetic pull immediately - fast 1.5s suck
            this.animateContainmentPull(centerX, centerY, 1800).then(() => {
                // Entity is now contained - play death animation
                this.isBeingContained = false; // Now lock position
                this.element.classList.remove('entity-distress', 'entity-magnetic-pull');
                this.element.classList.add('entity-contained');
                this.setAnimation('expr-dead');
                resolve();
            });
        });
    }

    // Animated suck-in effect - smooth spiral into center
    animateContainmentPull(targetX, targetY, duration) {
        return new Promise(resolve => {
            const startX = this.position.x;
            const startY = this.position.y;
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Exponential ease-in for dramatic "sucking" effect - starts slow, ends fast
                const eased = progress * progress * progress;

                // Calculate position - smooth lerp
                this.position.x = startX + (targetX - startX) * eased;
                this.position.y = startY + (targetY - startY) * eased;
                this.updatePosition();

                // Apply blur and scale effect for suction
                const blur = eased * 3;
                const scale = 1 - (eased * 0.9); // shrink from 100% to 10%
                this.element.style.filter = `blur(${blur}px)`;
                this.element.style.transform = `scale(${scale})`;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Final state - very small, centered, no blur
                    this.element.style.filter = 'none';
                    this.element.style.transform = 'scale(0.1)';
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    releaseContainment() {
        if (!this.isContained) return Promise.resolve();

        return new Promise(resolve => {
            // Set position to EXACT CENTER before releasing
            const centerX = window.innerWidth / 2 - 40;
            const centerY = window.innerHeight / 2 - 40;
            this.position.x = centerX;
            this.position.y = centerY;

            // ========================================
            // ADD TRANSITION for smooth descent (prevents teleporting)
            // ========================================
            this.element.style.transition = 'transform 0.5s ease-out, left 0.3s ease-out, top 0.3s ease-out';

            // RESET VISUAL STATE
            this.element.style.opacity = '1';
            this.element.style.filter = 'none';
            this.element.style.left = centerX + 'px';
            this.element.style.top = centerY + 'px';
            this.element.style.zIndex = '10001';
            this.element.style.transform = 'scale(1)';

            // Mark as releasing
            this.element.classList.remove('entity-contained', 'entity-distress', 'entity-magnetic-pull');
            this.element.classList.add('entity-ejecting');

            // Entity wakes up scared
            this.setAnimation('expr-surprised');

            // Wait a moment to "realize" what's happening
            setTimeout(() => {
                // NOW release the position lock
                this.isContained = false;
                this.isBeingContained = false;

                // Ensure visual position matches
                this.element.style.left = centerX + 'px';
                this.element.style.top = centerY + 'px';

                // Calculate random eject direction (mostly upward)
                const ejectAngle = (Math.random() - 0.5) * Math.PI * 0.6; // Narrower range
                const ejectDistance = 350 + Math.random() * 150;
                const targetX = centerX + Math.cos(ejectAngle - Math.PI / 2) * ejectDistance;
                const targetY = Math.max(100, centerY + Math.sin(ejectAngle - Math.PI / 2) * ejectDistance);

                // DRAMATIC EJECT - longer duration with overshoot
                const startTime = Date.now();
                const ejectDuration = 1200; // Longer

                // Overshoot position
                const overshootX = targetX + (targetX - centerX) * 0.2;
                const overshootY = targetY + (targetY - centerY) * 0.2;

                const ejectAnimation = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / ejectDuration, 1);

                    // Elastic ease-out for bounce effect
                    let eased;
                    if (progress < 0.7) {
                        // Fast launch
                        eased = 1 - Math.pow(1 - (progress / 0.7), 3);
                    } else {
                        // Settle back
                        const settleProgress = (progress - 0.7) / 0.3;
                        eased = 1 - (Math.sin(settleProgress * Math.PI) * 0.15);
                    }

                    // Position with overshoot
                    if (progress < 0.7) {
                        this.position.x = centerX + (overshootX - centerX) * (eased);
                        this.position.y = centerY + (overshootY - centerY) * (eased);
                    } else {
                        // Settle back to target
                        const settleProgress = (progress - 0.7) / 0.3;
                        this.position.x = overshootX + (targetX - overshootX) * settleProgress;
                        this.position.y = overshootY + (targetY - overshootY) * settleProgress;
                    }
                    this.updatePosition();

                    // Tumbling effect - dramatic spins
                    const spin = progress * 1440; // 4 full spins
                    const scale = 0.3 + (progress * 0.9); // Grow from 0.3 to 1.2
                    this.element.style.transform = `scale(${Math.min(scale, 1.2)}) rotate(${spin}deg)`;

                    if (progress < 1) {
                        requestAnimationFrame(ejectAnimation);
                    } else {
                        // LANDED! Recovery sequence
                        this.element.classList.remove('entity-ejecting');
                        this.element.classList.add('entity-landing');
                        this.setAnimation('expr-dizzy');
                        this.element.style.transform = 'scale(1) rotate(0deg)';

                        // Bounce recovery effect
                        setTimeout(() => {
                            this.element.style.transform = 'scale(1.3) rotate(10deg)';
                            setTimeout(() => {
                                this.element.style.transform = 'scale(0.85) rotate(-5deg)';
                                setTimeout(() => {
                                    this.element.style.transform = 'scale(1.1) rotate(3deg)';
                                    setTimeout(() => {
                                        this.element.style.transform = 'scale(1) rotate(0deg)';
                                        this.element.classList.remove('entity-landing');

                                        // Shake it off
                                        setTimeout(() => {
                                            this.setAnimation('move-shake');
                                            setTimeout(() => {
                                                // Restart the brain
                                                this.startBrain();

                                                // Celebrate surviving!
                                                this.energy = 100;
                                                this.curiosity = 80;
                                                this.playAnimation('react-celebrate', 2000);
                                                resolve();
                                            }, 800);
                                        }, 400);
                                    }, 100);
                                }, 100);
                            }, 100);
                        }, 100);
                    }
                };

                // Start eject animation
                requestAnimationFrame(ejectAnimation);
            }, 500); // Pause before launch
        });
    }

    destroy() {
        if (this.blinkTimeout) clearTimeout(this.blinkTimeout);
        if (this.thinkInterval) clearInterval(this.thinkInterval);
        if (this.idleTimeout) clearTimeout(this.idleTimeout);
        if (this.element) this.element.remove();
    }
}

export default ParaOSEntity;
export { ANIMATIONS, ALL_ANIMATIONS };
