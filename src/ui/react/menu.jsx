import React, { createRef, forwardRef, useImperativeHandle, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { motion, MotionConfig, animateMini as motionAnimate } from 'framer-motion';
import { PORTRAITS, portraitUrl, partyStripMarkup, queenArtUrl } from '../art.js';

const roots = new Map();
const ease = [0.16, 1, 0.3, 1];
const headings = ['状态', '人物', '玩法', '设置'];
const destinations = ['status', 'people', 'play', 'settings'];
const captions = ['CONDITION', 'CONFIDANTS', 'PLAYBOOK', 'SYSTEM'];
// These anchors share the illustration's 1672 × 941 canvas. Values are
// percentages of its width, so artwork and controls scale together.
const commandAnchors = [[44.5, 14], [42, 21.5], [39.5, 29], [37, 36.5]];

export function RansomText({ text, className = '' }) {
    let seed = 2166136261;
    for (const char of text) seed = Math.imul(seed ^ char.codePointAt(0), 16777619) >>> 0;
    return <span className={`p5-ransom ${className}`} aria-label={text}>
        {Array.from(text).map((char, index) => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return <span key={index} aria-hidden="true"
                data-punctuation={/[\s。！？，.!?]/.test(char) || undefined}
                style={{ '--p5-turn': `${(seed % 5) - 2}deg`, '--p5-letter-size': `${1 + (seed % 8) / 100}em` }}>{char === ' ' ? '\u00a0' : char}</span>;
        })}
    </span>;
}

export function LayeredButton({ children, className = '', ...props }) {
    return <motion.button type="button" className={`p5-layered p5-button ${className}`} {...props}>
        <span className="p5-layer-white" aria-hidden="true" />
        <span className="p5-layer-black"><span className="p5-layer-content">{children}</span></span>
    </motion.button>;
}

function Star({ className = '', ...props }) {
    return <svg className={`p5-star ${className}`} viewBox="0 0 100 100" aria-hidden="true" {...props}>
        <path d="M48 0 61 32 98 23 73 52 98 81 62 71 45 100 36 66 0 63 29 43 11 13 41 27Z" fill="currentColor" />
    </svg>;
}

function Mask() {
    return <svg viewBox="0 0 100 70" aria-hidden="true" className="p5-mask"><path d="M3 8 31 18 50 7 68 18 97 8 83 55 58 66 50 54 42 66 17 55Z" fill="currentColor" /><path d="m17 24 24 4-8 14-11-3m61-15-24 4 8 14 11-3" fill="#000" /></svg>;
}

function Portrait({ name, className = '' }) {
    return <img className={`p5r-portrait ${className}`} src={portraitUrl(name)} alt="" aria-hidden="true" draggable="false" />;
}
function PartyStrip({ nav = false }) {
    return <div className="p5-reel-host" dangerouslySetInnerHTML={{ __html: partyStripMarkup(nav ? 'p5r-nav-party' : '') }} />;
}

function Navigation({ state }) {
    return <div className="p5-navigation phantom:relative phantom:flex phantom:h-full phantom:flex-col" data-p5r-owned="">
        <div className="ls-modern-brand"><Mask /><span>角色手册<small>LIFE STATE / PHANTOM FILE</small></span></div>
        <div className="p5r-nav-logo" aria-hidden="true"><strong>MENU / MAIN</strong><span>TAKE YOUR TIME</span></div>
        <div className="p5-command-stage">
        <img className="p5-mobile-queen" src={queenArtUrl} alt="" aria-hidden="true" draggable="false" />
        <div className="ls-modern-nav-items">
            {destinations.map((page, index) => <LayeredButton key={page} data-action="modern-page" data-ui-page={page}
                style={{ '--command-x': commandAnchors[index][0], '--command-y': commandAnchors[index][1], '--command-index': index }}
                aria-current={state.page === page ? 'page' : 'false'}>
                <span className="p5-nav-number" aria-hidden="true">0{index + 1}</span>
                <span className="p5-nav-label"><RansomText text={headings[index]} /><small><RansomText text={captions[index]} /></small></span>
                <span className="p5-nav-arrow" aria-hidden="true"><svg viewBox="0 0 34 40"><path d="M4 4 29 20 4 36 9 20Z" fill="#fff" stroke="#000" strokeWidth="5" /></svg></span>
            </LayeredButton>)}
        </div>
        </div>
        <PartyStrip nav />
        <small className="ls-modern-nav-foot">EVERY MOMENT COUNTS</small>
    </div>;
}

function PortraitPicker({ selected }) {
    return <fieldset className="p5r-portrait-picker"><legend>Q 版怪盗图标</legend>
        <p className="p5r-hint">选择悬浮入口和准备页使用的黑白图标。</p>
        <div className="p5r-portrait-options">{Object.entries(PORTRAITS).map(([id, name]) =>
            <LayeredButton key={id} data-action="p5r-portrait" data-portrait={id} aria-pressed={selected === id} aria-label={name}>
                <Portrait name={id} /><span>{name}</span>
            </LayeredButton>)}</div></fieldset>;
}

function Preferences({ state }) {
    const needs = [['drink', '饮水'], ['meal', '进食'], ['urination', '排尿'], ['bowel_movement', '排便'], ['sleep', '睡眠']];
    return <>
        <div className="p5r-eyebrow">YOUR RULES / GLOBAL SETTINGS</div>
        <h1 className="p5r-heading"><RansomText text="作战准备" /></h1>
        <p className="p5r-lead">先把手册调成你的样子。</p>
        <div className="p5r-preferences">
            <section><h2><RansomText text="界面与交互" /></h2>
                <div className="p5r-choice-row">{[['p5r', 'P5R · 怪盗红'], ['plum', '暮紫']].map(([theme, name]) =>
                    <LayeredButton key={theme} data-action="p5r-theme" data-theme={theme} aria-pressed={state.theme === theme}>{name}</LayeredButton>)}</div>
                <LayeredButton className="p5r-motion" data-action="p5r-motion" aria-pressed={state.motion}>界面动效 <strong>{state.motion ? 'ON' : 'OFF'}</strong></LayeredButton>
                <p className="p5r-hint">控制转场与头像自动滚动，遵循系统的“减少动态效果”设置；关闭后仍可手动浏览头像。</p>
                <PortraitPicker selected={state.portrait} />
            </section>
            <form className="p5r-defaults"><h2><RansomText text="默认追踪" /></h2><p className="p5r-hint">只应用于尚未保存过设置的新聊天。</p>
                <div className="p5r-checks">{needs.map(([key, title]) => <label key={key}><input type="checkbox" name="daily" value={key} defaultChecked={state.defaults.modules.daily_needs.includes(key)} /><span>{title}</span></label>)}</div>
                <div className="p5r-checks">{[['stamina', '体力'], ['reproductive', '周期与孕期'], ['sexual_desire', '性欲']].map(([key, title]) => <label key={key}><input type="checkbox" name={key} defaultChecked={state.defaults.modules[key]} /><span>{title}</span></label>)}</div>
                <LayeredButton className="p5r-primary" data-action="p5r-save-defaults">保存默认设置 <span aria-hidden="true">↗</span></LayeredButton>
                <p className="p5r-feedback" role="status" />
            </form>
        </div>
    </>;
}

function Lobby({ state }) {
    const locked = state.page === 'people' || state.page === 'play';
    const title = state.page === 'people' ? '人物档案' : state.page === 'play' ? '下一场故事' : '故事还未开始。';
    const subtitle = state.page === 'people' ? '每个人，都有故事。' : state.page === 'play' ? '从这里做好准备。' : '手册已经就绪。';
    let content;
    if (state.chatState === 'loading' || state.chatState === 'error') {
        content = <><div className="p5r-eyebrow">LIFE STATE / RECONNECT</div>
            <h1 className="p5r-heading"><RansomText text={state.chatState === 'error' ? '暂时无法读取聊天' : '正在读取角色档案'} /></h1>
            <p className="p5r-lead" role="status">{state.chatState === 'error' ? state.error : '正在载入当前对话，马上就好。'}</p>
            {state.chatState === 'error' && <LayeredButton className="p5r-primary" data-action="p5r-retry">重新读取</LayeredButton>}</>;
    } else if (state.page === 'settings') content = <Preferences state={state} />;
    else content = <>
        <div className="p5r-welcome-collage">
            <div className="p5r-eyebrow"><span className="p5-live-mark" /> LIFE STATE / STANDBY</div>
            <h1 className="p5r-heading"><RansomText text={title} /><br /><em><RansomText text={subtitle} /></em></h1>
            <p className="p5r-lead">{locked ? '进入聊天后，即可管理当前对话的人物与玩法。' : <>打开任意聊天，让每一次变化都有迹可循。<br />你的角色手册，已经准备好了。</>}</p>
            <LayeredButton className="p5r-primary" data-action="p5r-settings">打开设置 <span aria-hidden="true">↗</span></LayeredButton>
            <div className="p5r-welcome-footer"><div className="p5r-welcome-mark" aria-hidden="true"><Portrait name={state.portrait} /></div><span className="p5r-online-dot" />已就绪 <span>选择聊天后自动连接</span></div>
        </div>
        <div className="p5r-calling-card"><span className="p5r-calling-label">THE PHANTOM THIEVES</span><PartyStrip /><span className="p5r-calling-caption">每一个故事，都值得认真对待。<b>LET'S GET STARTED ↗</b></span></div>
    </>;
    return <div data-p5r-owned="" className="p5-lobby-content">{content}</div>;
}

function Hero({ title, kicker, subtitle, portrait, number }) {
    return <><div className="p5r-hero-copy"><span className="p5r-eyebrow">{kicker}</span><h2><RansomText text={title} /></h2><p>{subtitle}</p></div>
        <span className="p5r-hero-number" aria-hidden="true">{number}</span><div className="p5r-hero-art" aria-hidden="true"><Portrait name={portrait} /></div><span className="p5r-hero-rule" aria-hidden="true" /></>;
}

const Scene = forwardRef(function Scene({ enabled }, ref) {
    const [pulse, setPulse] = useState(null), [target, setTarget] = useState(null);
    useImperativeHandle(ref, () => ({
        pulse(direction = 1) { setPulse(value => ({ id: (value?.id || 0) + 1, direction })); },
        target(value) { setTarget(value); },
        clear() { setPulse(null); setTarget(null); },
    }));
    return <MotionConfig transition={{ duration: .16, ease }} reducedMotion={enabled ? 'user' : 'always'}>
        <svg className="phantom:sr-only" style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true"><defs>
            <filter id="p5-rough-edge"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" /></filter>
        </defs></svg>
        <img className="p5-scene-queen" src={queenArtUrl} alt="" draggable="false" />
        <div className="p5-scene-halftone" /><div className="p5-scene-stripes" />
        <Star className="p5-scene-star" />
        {enabled && pulse && <motion.i key={pulse.id} className="p5-razor" initial={{ x: `${-120 * pulse.direction}%`, opacity: 1 }} animate={{ x: `${120 * pulse.direction}%`, opacity: [1, 1, 0] }} transition={{ duration: .2, ease, times: [0, .8, 1] }} />}
        {target && <motion.span className="p5-target" key={target.id} style={{ top: target.y, left: target.x }} initial={enabled ? { x: -38, opacity: 0 } : false} animate={{ x: 0, opacity: 1 }}><i className="p5-target-tip" /></motion.span>}
    </MotionConfig>;
});

function render(element, component) {
    if (!element) return;
    let root = roots.get(element);
    if (!root) { root = createRoot(element); roots.set(element, root); }
    flushSync(() => root.render(component));
}

export function disposeReactWithin(container) {
    for (const [element, root] of roots) {
        if (!element.isConnected || container === element || container?.contains(element)) {
            flushSync(() => root.unmount()); roots.delete(element);
        }
    }
}

export function mountReactScene(panel) {
    const document = panel.ownerDocument, win = document.defaultView;
    const scene = document.createElement('div'); scene.className = 'p5-scene'; scene.setAttribute('aria-hidden', 'true');
    panel.querySelector('.ls-shell').prepend(scene);
    const ref = createRef(); let state, targetId = 0, activeTarget = null;
    const media = win.matchMedia('(prefers-reduced-motion: reduce)');
    const enabled = () => panel.dataset.motion !== 'reduced' && !media.matches;
    function draw() { render(scene, <Scene ref={ref} enabled={enabled()} />); }
    draw();
    function clearTarget() {
        activeTarget = null;
        flushSync(() => ref.current?.target(null));
    }
    function target(event) {
        const item = event.target.closest?.('button:not(:disabled),a[href],summary,input,select,textarea,.ls-pe-choice');
        if (!item || item.classList.contains('ls-toggle') || item.getAttribute('aria-current') === 'page' || !panel.contains(item) || panel.dataset.expanded !== 'true') {
            if (activeTarget) clearTarget();
            return;
        }
        if (item === activeTarget) return;
        activeTarget = item;
        const outer = panel.querySelector('.ls-shell').getBoundingClientRect(), box = item.getBoundingClientRect();
        flushSync(() => ref.current?.target({ id: ++targetId, x: box.left - outer.left - 14, y: box.top - outer.top + box.height / 2 - 9 }));
    }
    const change = () => { activeTarget = null; flushSync(() => ref.current?.clear()); draw(); };
    panel.addEventListener('pointerover', target); panel.addEventListener('focusin', target);
    panel.addEventListener('pointerleave', clearTarget); panel.addEventListener('focusout', clearTarget);
    panel.querySelector('.ls-body').addEventListener('scroll', change, { passive: true });
    media.addEventListener('change', change);
    return {
        sync(next) {
            state = next; draw();
            render(panel.querySelector('.ls-modern-nav'), <Navigation state={state} />);
            if (!activeTarget?.isConnected || activeTarget.getAttribute('aria-current') === 'page') clearTarget();
            if (state.chatState !== 'ready') render(panel.querySelector('.p5r-lobby'), <Lobby state={state} />);
            hydrateReactParts(panel);
        },
        pulse(direction) { if (enabled()) flushSync(() => ref.current?.pulse(direction)); },
        clear: change,
        dispose() {
            panel.removeEventListener('pointerover', target); panel.removeEventListener('focusin', target);
            panel.removeEventListener('pointerleave', clearTarget); panel.removeEventListener('focusout', clearTarget);
            panel.querySelector('.ls-body').removeEventListener('scroll', change);
            media.removeEventListener('change', change);
            disposeReactWithin(panel); scene.remove();
        },
    };
}

export function hydrateReactParts(container) {
    for (const [element, root] of roots) if (!element.isConnected) { root.unmount(); roots.delete(element); }
    for (const element of container.querySelectorAll('[data-p5r-component]')) {
        const data = element.dataset;
        if (data.p5rComponent === 'hero') render(element, <Hero {...JSON.parse(data.props)} />);
        if (data.p5rComponent === 'ransom') render(element, <RansomText text={data.text} />);
    }
    for (const heading of container.querySelectorAll('h1,h2')) {
        if (heading.closest('[data-p5r-owned]') || heading.querySelector('.p5-ransom') || heading.querySelector('button,input,select')) continue;
        const text = heading.textContent;
        if (text.trim()) {
            const slot = heading.ownerDocument.createElement('span');
            slot.dataset.p5rComponent = 'ransom'; slot.dataset.text = text;
            heading.replaceChildren(slot);
            render(slot, <RansomText text={text} />);
        }
    }
}

// Keep the runtime's cancellation/finished contract while using Motion's DOM
// renderer. Static forms never scale; the accent artwork carries the impact.
export function animateElement(element, frames, options) {
    const transformKeys = ['x', 'y', 'scale', 'scaleX', 'rotate'];
    if (frames.some(frame => transformKeys.some(key => key in frame))) {
        const original = element.ownerDocument.defaultView.getComputedStyle(element).transform;
        frames = frames.map(frame => {
            const { x = 0, y = 0, scale = 1, scaleX = 1, rotate = 0, ...rest } = frame;
            return { ...rest, transform: `translate(${x}px,${y}px) scale(${scale}) scaleX(${scaleX}) rotate(${rotate}deg) ${original === 'none' ? '' : original}` };
        });
    }
    const keyframes = {};
    for (const frame of frames) for (const key of Object.keys(frame)) keyframes[key] = frames.map(item => item[key]);
    const previous = Object.fromEntries(Object.keys(keyframes).map(key => [key, element.style[key]]));
    const playback = motionAnimate(element, keyframes, { duration: options.duration / 1000, delay: (options.delay || 0) / 1000, ease });
    let resolve, ended = false;
    const finish = () => {
        if (ended) return;
        ended = true;
        for (const [key, value] of Object.entries(previous)) element.style[key] = value;
        resolve();
    };
    const finished = new Promise(done => { resolve = done; playback.then(finish); });
    return { finished, cancel() { playback.cancel(); finish(); } };
}
