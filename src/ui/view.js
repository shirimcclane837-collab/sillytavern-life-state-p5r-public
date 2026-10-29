// Shared presentation behavior. Chat operations remain owned by the runtime.
import { portraitMarkup, portraitChoicesMarkup, partyStripMarkup, pageHeroMarkup, cutoutTitle } from './art.js';
import { mountPartyReels } from './party-reels.js';
const views = new WeakMap();
const overlays = new WeakMap();
const markup = new WeakMap();
export const MOTION_KEY = 'life-state-p5r-motion-v1';

export function updateMarkup(element, html) {
    if (!element || markup.get(element) === html) return;
    element.innerHTML = html;
    markup.set(element, html);
}

export function loadMotion(storage) {
    try { return storage?.getItem(MOTION_KEY) !== 'reduced'; }
    catch { return true; }
}

function canAnimate(panel) {
    const win = panel.ownerDocument.defaultView;
    return panel.dataset.motion !== 'reduced'
        && !win.matchMedia('(prefers-reduced-motion: reduce)').matches
        && typeof panel.animate === 'function';
}

function animate(view, key, element, frames, options) {
    view.animations.get(key)?.cancel();
    view.animations.delete(key);
    if (!canAnimate(view.panel) || !element) return Promise.resolve();
    const animation = element.animate(frames, { easing: 'cubic-bezier(.22,1,.36,1)', ...options });
    view.animations.set(key, animation);
    return animation.finished.catch(() => {}).finally(() => {
        if (view.animations.get(key) === animation) view.animations.delete(key);
    });
}

const fullMask = 'polygon(0 0,100% 0,100% 100%,0 100%)';
const closedMask = 'polygon(0 0,0 0,0 100%,0 100%)';
const pages = ['status', 'people', 'play', 'settings'];
function isP5r(panel) { return panel.classList.contains('ls-modern') && panel.dataset.uiTheme === 'p5r'; }

function cancelScene(view) {
    for (const [key, animation] of view.animations) {
        if (!key.startsWith('scene-')) continue;
        animation.cancel();
        view.animations.delete(key);
    }
}

function visibleElement(view, root, selector) {
    const viewport = view.panel.querySelector('.ls-body').getBoundingClientRect();
    return [...root.querySelectorAll(selector)].find(element => {
        const rect = element.getBoundingClientRect();
        return rect.width && rect.height && rect.bottom > viewport.top && rect.top < viewport.bottom;
    });
}

// A scene is the existing page artwork, never a separate screen-sized wipe.
// Title and illustration resolve in that order. Forms and reading
// surfaces stay fully opaque and keep their hit targets throughout the sequence.
function enterScene(view, kind = 'page', direction = 1) {
    cancelScene(view);
    if (!canAnimate(view.panel)) return;
    const body = view.panel.querySelector('.ls-body');
    const detail = kind === 'detail' && visibleElement(view, body, '.ls-profile-editor,.ls-play-draft');
    const scope = detail || body;
    const hero = visibleElement(view, scope, '.p5r-page-hero');
    const title = visibleElement(view, hero || scope, '.p5r-hero-copy,.p5r-heading,.p5r-editor-title > .p5r-cutout-title,.ls-play-draft > h4');
    const illustration = visibleElement(view, hero || scope, '.p5r-hero-art,.p5r-welcome-mark img,.p5r-editor-title > img');
    const major = kind === 'page' || kind === 'open';
    const distance = major ? 24 : 12;

    animate(view, 'scene-title', title, [
        { translate: `${direction * distance}px 0`, opacity: .35 },
        { translate: '0 0', opacity: 1 },
    ], { duration: major ? 210 : 150, delay: major ? 25 : 0, fill: 'backwards' });
    if (illustration && major) {
        // Individual transform properties preserve the illustration's printed tilt.
        animate(view, 'scene-portrait', illustration, [
            { translate: `${-direction * 24}px 5px`, rotate: `${-direction * 5}deg` },
            { translate: '0 0', rotate: '0deg' },
        ], { duration: 240, delay: 45, fill: 'backwards' });
    }
    const rule = hero?.querySelector('.p5r-hero-rule');
    if (rule) {
        rule.style.transformOrigin = direction > 0 ? 'left center' : 'right center';
        animate(view, 'scene-rule', rule, [{ scale: '.35 1' }, { scale: '1 1' }],
            { duration: 160, delay: major ? 85 : 35, fill: 'backwards' });
    }
    if (kind === 'open') {
        view.panel.querySelectorAll('.ls-modern-nav-items button > span').forEach((label, index) => {
            animate(view, `scene-nav-${index}`, label,
                [{ translate: '-10px 0', opacity: .4 }, { translate: '0 0', opacity: 1 }],
                { duration: 140, delay: 25 + index * 25, fill: 'backwards' });
        });
    } else if (kind === 'page') {
        animate(view, 'scene-nav-selected', view.panel.querySelector('.ls-modern-nav-items [aria-current=page] > span'),
            [{ translate: `${-direction * 6}px 0` }, { translate: '0 0' }], { duration: 130 });
    }
}

export function mountView(panel, onAction) {
    if (views.has(panel)) return;
    const view = { panel, animations: new Map(), scroll: new Map(), key: null, expanded: false, token: 0 };
    view.reels = mountPartyReels(panel);
    views.set(panel, view);
    const document = panel.ownerDocument;
    const lobby = document.createElement('section');
    lobby.className = 'p5r-lobby';
    panel.querySelector('.ls-body').prepend(lobby);
    const banner = document.createElement('div');
    banner.className = 'p5r-page-banner';
    banner.hidden = true;
    lobby.after(banner);
    const entryArt = document.createElement('span');
    entryArt.className = 'p5r-entry-art';
    panel.querySelector('.ls-mobile-icon').append(entryArt);
    const close = document.createElement('button');
    close.className = 'p5r-close';
    close.type = 'button';
    close.dataset.action = 'toggle';
    close.setAttribute('aria-label', '收起角色手册');
    close.innerHTML = '<span aria-hidden="true">×</span>';
    panel.querySelector('.ls-bar').append(close);
    const click = event => {
        const target = event.target.closest('[data-action^="p5r-"]');
        if (!target) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        onAction(target.dataset.action, target);
    };
    const keydown = event => {
        if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing) {
            onAction('p5r-escape', event.target);
            event.preventDefault();
        }
    };
    const body = panel.querySelector('.ls-body');
    const scroll = () => { if (view.key) view.scroll.set(view.key, body.scrollTop); };
    panel.addEventListener('click', click, true);
    panel.addEventListener('keydown', keydown);
    body.addEventListener('scroll', scroll, { passive: true });
    const media = document.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
    const mediaChange = () => {
        for (const animation of view.animations.values()) animation.cancel();
    };
    media.addEventListener?.('change', mediaChange);
    view.dispose = () => {
        view.token++;
        view.reels.dispose();
        mediaChange();
        panel.removeEventListener('click', click, true);
        panel.removeEventListener('keydown', keydown);
        body.removeEventListener('scroll', scroll);
        media.removeEventListener?.('change', mediaChange);
    };
}

export function disposeView(panel) {
    views.get(panel)?.dispose();
    views.delete(panel);
}

export function disposeOverlay(overlay) {
    const state = overlays.get(overlay);
    if (state) {
        state.token++;
        state.animation?.cancel();
        state.media.removeEventListener?.('change', state.mediaChange);
    }
    overlays.delete(overlay);
}

export function renderOverlay(overlay, { open, className, html, motion }) {
    let state = overlays.get(overlay);
    if (!state) {
        state = { open: false, token: 0, animation: null };
        state.media = overlay.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
        state.mediaChange = () => state.animation?.cancel();
        state.media.addEventListener?.('change', state.mediaChange);
        overlays.set(overlay, state);
    }
    overlay.dataset.motion = motion ? 'full' : 'reduced';
    if (!canAnimate(overlay)) state.animation?.cancel();
    overlay.setAttribute('aria-hidden', String(!open));
    overlay.inert = !open;
    if (state.open === open) { if (open) updateMarkup(overlay, html); return; }
    state.open = open;
    const token = ++state.token;
    state.animation?.cancel();
    if (open) {
        overlay.classList.add(className);
        updateMarkup(overlay, html);
    }
    const dialog = overlay.querySelector('[role=dialog]');
    const finish = () => {
        if (token !== state.token) return;
        state.animation = null;
        if (!open) { overlay.classList.remove(className); updateMarkup(overlay, ''); }
    };
    if (!dialog || !canAnimate(overlay)) { finish(); return; }
    const frames = isP5r(overlay) ? (open ? [
        { opacity: .7, boxShadow: '3px 3px 0 #ed0028,5px 5px 0 #000' },
        { opacity: 1, boxShadow: '9px 9px 0 #ed0028,12px 12px 0 #000' },
    ] : [{ opacity: 1 }, { opacity: 0 }]) : open ? [
        { opacity: 0, transform: 'translateY(18px) scale(.98)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
    ] : [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(10px) scale(.98)' },
    ];
    state.animation = dialog.animate(frames, { duration: open ? 170 : 110, easing: 'cubic-bezier(.22,1,.36,1)' });
    state.animation.finished.catch(() => {}).then(finish);
}

export function setPanelExpanded(panel, expanded, afterLayout) {
    const view = views.get(panel);
    if (!view) { panel.classList.toggle('ls-open', expanded); return; }
    if (view.expanded === expanded) return;
    view.expanded = expanded;
    cancelScene(view);
    const token = ++view.token;
    const shell = panel.querySelector('.ls-shell');
    const body = panel.querySelector('.ls-body');
    const nav = panel.querySelector('.ls-modern-nav');
    body.inert = !expanded;
    nav.inert = !expanded;
    panel.dataset.expanded = String(expanded);
    if (expanded) {
        panel.classList.add('ls-open');
        panel.classList.remove('p5r-closing');
        afterLayout?.();
        animate(view, 'window', shell, isP5r(panel) ? [
            { clipPath: closedMask },
            { clipPath: fullMask },
        ] : [
            { opacity: 0, transform: 'translateY(18px) scale(.96)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: 220 });
        enterScene(view, 'open');
    } else {
        panel.classList.add('p5r-closing');
        animate(view, 'window', shell, isP5r(panel) ? [
            { clipPath: fullMask },
            { clipPath: closedMask },
        ] : [
            { opacity: 1, transform: 'translateY(0) scale(1)' },
            { opacity: 0, transform: 'translateY(12px) scale(.97)' },
        ], { duration: 140 }).then(() => {
            if (token !== view.token || !panel.isConnected) return;
            panel.classList.remove('ls-open', 'p5r-closing');
            afterLayout?.();
            panel.querySelector('.ls-toggle')?.focus({ preventScroll: true });
        });
    }
    view.reels.sync();
}

export function updateView(panel, state) {
    const view = views.get(panel);
    if (!view) return;
    panel.dataset.motion = state.motion ? 'full' : 'reduced';
    view.portrait = state.portrait;
    updateMarkup(panel.querySelector('.p5r-entry-art'), portraitMarkup(state.portrait));
    const chatState = state.loading ? 'loading' : state.error ? 'error' : state.available ? 'ready' : 'empty';
    panel.dataset.chatState = chatState;
    for (const columns of panel.querySelectorAll('.ls-modern-columns')) {
        const secondary = columns.querySelector('.ls-modern-secondary');
        columns.classList.toggle('p5r-single-column', !secondary?.textContent.trim());
    }
    const lobby = panel.querySelector('.p5r-lobby');
    const banner = panel.querySelector('.p5r-page-banner');
    banner.hidden = !isP5r(panel) || chatState !== 'ready' || !['status', 'settings'].includes(state.page);
    if (!banner.hidden) updateMarkup(banner, pageHeroMarkup(state.page === 'status'
        ? { title: '状态手册', kicker: 'CONDITION / EVERY MOMENT COUNTS', subtitle: '跟随故事，读懂每一个变化。', portrait: 'ann', number: '01' }
        : { title: '作战准备', kicker: 'SYSTEM / MAKE IT YOURS', subtitle: '让每一次行动，都按你的节奏。', portrait: 'futaba', number: '04' }));
    const defaultsForm = lobby.querySelector('.p5r-defaults');
    if (defaultsForm) view.defaultsDraft = [...defaultsForm.querySelectorAll('input')].map(input => ({ name: input.name, value: input.value, checked: input.checked }));
    lobby.hidden = chatState === 'ready';
    if (chatState !== 'ready') updateMarkup(lobby, lobbyMarkup({ ...state, chatState }));
    if (view.defaultsDraft) {
        for (const input of lobby.querySelectorAll('.p5r-defaults input')) {
            const draft = view.defaultsDraft.find(item => item.name === input.name && item.value === input.value);
            if (draft) input.checked = draft.checked;
        }
    }
    for (const child of panel.querySelector('.ls-body').children) {
        if (child !== lobby) child.inert = chatState !== 'ready';
    }
    const context = `${state.chatIdentity}/${chatState}`;
    const subpage = state.page === 'settings' ? state.settingsPage : state.subpage;
    const key = `${context}/${state.page}/${subpage}/${state.character || ''}`;
    const body = panel.querySelector('.ls-body');
    if (view.key !== key) {
        // Each page owns its scroll position; async data refreshes do not reset it.
        body.scrollTop = view.scroll.get(key) || 0;
        cancelScene(view);
        if (view.context === context && view.expanded) {
            if (view.page !== state.page) {
                enterScene(view, 'page', pages.indexOf(state.page) < pages.indexOf(view.page) ? -1 : 1);
            } else if (view.subpage !== subpage) {
                enterScene(view, 'section', !subpage || subpage === 'home' ? -1 : 1);
            }
        }
        view.key = key;
    } else if (view.detail !== state.detail && view.expanded && view.context === context) {
        enterScene(view, 'detail');
    }
    view.context = context;
    view.page = state.page;
    view.subpage = subpage;
    view.detail = state.detail;
    if (!state.motion) for (const animation of view.animations.values()) animation.cancel();
    view.reels.sync();
}

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function lobbyMarkup(state) {
    const { page, chatState, defaults, motion } = state;
    if (chatState === 'loading' || chatState === 'error') return `
      <div class="p5r-eyebrow">LIFE STATE / ${chatState === 'error' ? 'RECONNECT' : 'CONNECTING'}</div>
      <h1 class="p5r-heading">${chatState === 'error' ? '暂时无法读取聊天' : '正在读取角色档案'}</h1>
      <p class="p5r-lead" role="status">${chatState === 'error' ? escape(state.error) : '正在载入当前对话，马上就好。'}</p>
      ${chatState === 'error' ? '<button type="button" class="p5r-primary" data-action="p5r-retry">重新读取</button>' : '<div class="p5r-loading" aria-hidden="true"></div>'}`;
    if (page === 'settings') {
        const needs = [['drink', '饮水'], ['meal', '进食'], ['urination', '排尿'], ['bowel_movement', '排便'], ['sleep', '睡眠']];
        return `<div class="p5r-eyebrow">YOUR RULES / GLOBAL SETTINGS</div>
          <h1 class="p5r-heading">先把手册调成你的样子。</h1>
          <p class="p5r-lead">这些设置可以在开始聊天前完成。</p>
          <div class="p5r-preferences"><section><h2>界面与交互</h2>
          <div class="p5r-choice-row"><button type="button" data-action="p5r-theme" data-theme="p5r" aria-pressed="${state.theme === 'p5r'}">P5R · 怪盗红</button><button type="button" data-action="p5r-theme" data-theme="plum" aria-pressed="${state.theme === 'plum'}">暮紫</button></div>
          <button type="button" class="p5r-motion" data-action="p5r-motion" aria-pressed="${motion}">界面动效 <strong>${motion ? 'ON' : 'OFF'}</strong></button><p class="p5r-hint">控制转场与头像自动滚动，并遵循系统的“减少动态效果”设置；关闭后仍可手动浏览头像。</p>${portraitChoicesMarkup(state.portrait)}</section>
          <form class="p5r-defaults"><h2>新聊天的默认追踪</h2><p class="p5r-hint">只应用于尚未保存过设置的新聊天。</p>
          <div class="p5r-checks">${needs.map(([key, title]) => `<label><input type="checkbox" name="daily" value="${key}" ${defaults.modules.daily_needs.includes(key) ? 'checked' : ''}><span>${title}</span></label>`).join('')}</div>
          <div class="p5r-checks">${[['stamina', '体力'], ['reproductive', '周期与孕期'], ['sexual_desire', '性欲']].map(([key, title]) => `<label><input type="checkbox" name="${key}" ${defaults.modules[key] ? 'checked' : ''}><span>${title}</span></label>`).join('')}</div>
          <button type="button" class="p5r-primary" data-action="p5r-save-defaults">保存默认设置 <span aria-hidden="true">↗</span></button><p class="p5r-feedback" role="status"></p></form></div>`;
    }
    const locked = page === 'people' || page === 'play';
    return `<div class="p5r-welcome-collage"><div class="p5r-eyebrow">LIFE STATE / STANDBY</div>
      <div class="p5r-welcome-mark" aria-hidden="true">${portraitMarkup(state.portrait)}</div>
      <h1 class="p5r-heading">${locked ? (page === 'people' ? `${cutoutTitle('人物档案')}<br><em>每个人，都有故事。</em>` : `${cutoutTitle('下一场故事')}<br><em>从这里做好准备。</em>`) : `${cutoutTitle('故事还未开始。')}<br><em>${cutoutTitle('手册已经就绪。')}</em>`}</h1>
      <p class="p5r-lead">${locked ? '进入聊天后，即可管理当前对话的人物与玩法。' : '打开任意聊天，人物档案与身体状态会自动出现在这里。<br>现在就可以调整界面和新聊天的默认设置。'}</p>
      <button type="button" class="p5r-primary" data-action="p5r-settings">打开设置 <span aria-hidden="true">↗</span></button>
      <div class="p5r-welcome-footer"><span class="p5r-online-dot"></span> 已就绪 <span>选择聊天后自动连接</span></div></div>
      <div class="p5r-calling-card"><span class="p5r-calling-label">THE PHANTOM THIEVES</span>${partyStripMarkup()}<span class="p5r-calling-caption">每一个故事，都值得认真对待。<b>LET'S GET STARTED ↗</b></span></div>`;
}
