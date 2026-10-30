// One clock for the visible portrait strips. Native scroll offsets also support
// touchpads; the identical surrounding groups make either direction continuous.
export function mountPartyReels(panel) {
    const document = panel.ownerDocument;
    const win = document.defaultView;
    const media = win.matchMedia('(prefers-reduced-motion: reduce)');
    const reels = new Map();
    let frame = 0, lastTime = 0, disposed = false;
    const modulo = (value, length) => ((value % length) + length) % length;
    const motionEnabled = () => panel.dataset.motion !== 'reduced' && !media.matches;

    function place(reel, offset) {
        if (!reel.length) return;
        reel.offset = modulo(offset, reel.length);
        reel.viewport.scrollLeft = reel.length + reel.offset;
        reel.written = reel.viewport.scrollLeft;
    }
    function measure(reel) {
        const length = reel.group.getBoundingClientRect().width;
        reel.width = reel.viewport.clientWidth;
        if (!length || !reel.width) return;
        const fraction = reel.length ? reel.offset / reel.length : 0;
        reel.length = length;
        // A compact row can be wider than all eleven icons combined. Keep
        // enough repeated groups beyond the wrap point so native scrollLeft
        // never clamps before the next seamless cycle begins.
        const track = reel.group.parentElement;
        const copies = Math.max(3, Math.ceil(reel.width / length) + 2);
        while (track.children.length < copies) {
            const duplicate = reel.group.cloneNode(true);
            duplicate.setAttribute('aria-hidden', 'true');
            track.append(duplicate);
        }
        while (track.children.length > copies) track.lastElementChild.remove();
        reel.speed = Number.parseFloat(win.getComputedStyle(reel.element).getPropertyValue('--p5r-party-speed')) || 14;
        place(reel, fraction * length);
    }
    function moving(reel) {
        return motionEnabled() && !document.hidden && panel.dataset.expanded === 'true'
            && reel.visible && reel.width > 0 && reel.length > 0
            && !reel.paused && !reel.hovered && !reel.focused && !reel.drag;
    }
    function tick(time) {
        frame = 0;
        if (disposed) return;
        // Returning from a hidden tab must never fast-forward the portraits.
        const seconds = lastTime ? Math.min(time - lastTime, 64) / 1000 : 0;
        lastTime = time;
        for (const reel of reels.values()) if (moving(reel)) place(reel, reel.offset + seconds * reel.speed);
        if ([...reels.values()].some(moving)) frame = win.requestAnimationFrame(tick);
        else lastTime = 0;
    }
    function refresh() {
        if (disposed) return;
        for (const reel of reels.values()) reel.button.hidden = !motionEnabled();
        if ([...reels.values()].some(moving)) {
            if (!frame) { lastTime = 0; frame = win.requestAnimationFrame(tick); }
        } else {
            win.cancelAnimationFrame(frame);
            frame = 0;
            lastTime = 0;
        }
    }
    function finish(reel, event) {
        if (!reel.drag || (event?.pointerId !== undefined && event.pointerId !== reel.drag.id)) return;
        const { id } = reel.drag;
        reel.drag = null;
        delete reel.element.dataset.dragging;
        try { reel.viewport.releasePointerCapture(id); } catch { /* The browser may already have released it. */ }
        refresh();
    }

    const intersection = new win.IntersectionObserver(entries => {
        for (const entry of entries) {
            const reel = reels.get(entry.target.closest('.p5r-party-strip'));
            if (reel) reel.visible = entry.isIntersecting;
        }
        refresh();
    });
    const resize = new win.ResizeObserver(entries => {
        const changed = new Set(entries.map(entry => reels.get(entry.target.closest('.p5r-party-strip'))));
        for (const reel of changed) if (reel) measure(reel);
        refresh();
    });

    function attach(element) {
        const viewport = element.querySelector('.p5r-party-window');
        const group = element.querySelector('.p5r-party-group');
        const button = element.querySelector('.p5r-party-pause');
        const reel = { element, viewport, group, button, length: 0, width: 0, offset: 0, written: 0,
            visible: false, hovered: win.matchMedia('(hover: hover)').matches && element.matches(':hover'),
            focused: false, paused: false, drag: null };
        const listeners = [];
        const on = (target, type, handler, options) => {
            target.addEventListener(type, handler, options);
            listeners.push(() => target.removeEventListener(type, handler, options));
        };
        on(element, 'pointerenter', event => { if (event.pointerType !== 'touch') { reel.hovered = true; refresh(); } });
        on(element, 'pointerleave', event => { if (event.pointerType !== 'touch') { reel.hovered = false; refresh(); } });
        on(element, 'focusin', () => { reel.focused = true; refresh(); });
        on(element, 'focusout', event => { reel.focused = element.contains(event.relatedTarget); refresh(); });
        on(button, 'click', event => {
            event.preventDefault();
            reel.paused = !reel.paused;
            button.setAttribute('aria-pressed', String(reel.paused));
            button.setAttribute('aria-label', reel.paused ? '继续头像自动滚动' : '暂停头像自动滚动');
            button.title = reel.paused ? '继续自动滚动' : '暂停自动滚动';
            button.firstElementChild.textContent = reel.paused ? '▷' : 'Ⅱ';
            refresh();
        });
        on(viewport, 'pointerdown', event => {
            if (reel.drag || event.isPrimary === false || event.button !== 0) return;
            if (event.pointerType === 'mouse') event.preventDefault();
            reel.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: reel.offset, moved: false };
            try { viewport.setPointerCapture(event.pointerId); } catch { /* Window blur can cancel a pointer. */ }
            refresh();
        });
        on(viewport, 'pointermove', event => {
            const drag = reel.drag;
            if (!drag || event.pointerId !== drag.id) return;
            const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
            if (!drag.moved && (Math.abs(dx) < 4 || Math.abs(dy) > Math.abs(dx))) return;
            drag.moved = true;
            element.dataset.dragging = 'true';
            event.preventDefault();
            place(reel, drag.offset - dx);
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(viewport, type, event => finish(reel, event));
        on(viewport, 'scroll', () => {
            if (viewport.clientWidth && Math.abs(viewport.scrollLeft - reel.written) > .5) place(reel, viewport.scrollLeft - reel.length);
        }, { passive: true });
        on(viewport, 'keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            const step = reel.length / group.children.length;
            const offsets = { ArrowLeft: reel.offset - step, ArrowRight: reel.offset + step, Home: 0, End: reel.length - step };
            if (!Object.hasOwn(offsets, event.key)) return;
            event.preventDefault();
            place(reel, offsets[event.key]);
        });
        reel.dispose = () => {
            finish(reel);
            listeners.forEach(remove => remove());
            intersection.unobserve(viewport);
            resize.unobserve(viewport);
            resize.unobserve(group);
        };
        reels.set(element, reel);
        measure(reel);
        intersection.observe(viewport);
        resize.observe(viewport);
        resize.observe(group);
    }
    function sync() {
        if (disposed) return;
        for (const [element, reel] of reels) {
            if (!panel.contains(element)) { reels.delete(element); reel.dispose(); }
        }
        for (const element of panel.querySelectorAll('.p5r-party-strip')) {
            if (!reels.has(element)) attach(element);
            else measure(reels.get(element));
        }
        refresh();
    }
    const blur = () => { for (const reel of reels.values()) finish(reel); };
    media.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', refresh);
    win.addEventListener('blur', blur);
    return {
        sync,
        refresh,
        dispose() {
            disposed = true;
            win.cancelAnimationFrame(frame);
            for (const reel of reels.values()) reel.dispose();
            reels.clear();
            intersection.disconnect();
            resize.disconnect();
            media.removeEventListener('change', refresh);
            document.removeEventListener('visibilitychange', refresh);
            win.removeEventListener('blur', blur);
        },
    };
}
