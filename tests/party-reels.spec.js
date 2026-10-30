import { test, expect } from '@playwright/test';

const panel = '#life-state-continuity-panel';
const sidebar = `${panel} .p5r-nav-party`;
const welcome = `${panel} .p5r-calling-card .p5r-party-strip`;
const windowOf = strip => `${strip} .p5r-party-window`;
const settle = page => page.evaluate(async () => {
    await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});
async function open(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.extension?.getStatus().running);
    await page.locator(`${panel} .ls-toggle`).click();
    await settle(page);
    await page.mouse.move(1, 1);
}
const position = (page, selector) => page.locator(windowOf(selector)).evaluate(el => el.scrollLeft);
async function stationary(page, selector) {
    const before = await position(page, selector);
    await page.waitForTimeout(250);
    expect(await position(page, selector)).toBe(before);
}

test.describe('female portrait reels', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('both rows advance, expose all eleven female icons and wrap without an empty seam', async ({ page }) => {
        await open(page);
        for (const selector of [sidebar, welcome]) {
            const names = await page.locator(`${selector} .p5r-party-group:not([aria-hidden]) img`).evaluateAll(images => images.map(img => img.src.split('/').pop()));
            expect(names).toEqual(['ann.png', 'makoto.png', 'futaba.png', 'haru.png', 'hifumi.png', 'tae.png', 'sadayo.png', 'chihaya.png', 'ichiko.png', 'justine.png', 'caroline.png']);
            const start = await position(page, selector);
            await expect.poll(() => position(page, selector)).toBeGreaterThan(start + 2);
        }
        await page.locator(windowOf(welcome)).hover();
        const boundary = await page.locator(windowOf(welcome)).evaluate(el => {
            const length = el.querySelector('.p5r-party-group').getBoundingClientRect().width;
            el.scrollLeft = length * 2 - 2;
            return length;
        });
        await settle(page);
        const firstVisibleAnn = () => page.locator(windowOf(welcome)).evaluate(el => {
            const viewport = el.getBoundingClientRect();
            return [...el.querySelectorAll('.p5r-party-group img')]
                .filter(img => img.src.endsWith('/ann.png'))
                .map(img => img.getBoundingClientRect())
                .find(rect => rect.right > viewport.left && rect.left < viewport.right).left;
        });
        const before = await firstVisibleAnn();
        await page.mouse.move(1, 1);
        await expect.poll(() => position(page, welcome)).toBeLessThan(boundary * 1.5);
        const after = await firstVisibleAnn();
        expect(after).toBeLessThanOrEqual(before);
        expect(before - after).toBeLessThan(25);
        expect(await page.locator(`${panel} .ls-body`).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    });

    test('hover, drag, keyboard navigation and a persistent pause operate independently of the window', async ({ page }) => {
        await open(page);
        const viewport = page.locator(windowOf(sidebar));
        await viewport.hover();
        await stationary(page, sidebar);
        const panelBefore = await page.locator(panel).boundingBox();
        const before = await position(page, sidebar);
        const box = await viewport.boundingBox();
        await page.mouse.move(box.x + 100, box.y + 12);
        await page.mouse.down();
        await page.mouse.move(box.x + 30, box.y + 12, { steps: 8 });
        await page.mouse.up();
        expect(await position(page, sidebar)).toBeCloseTo(before + 70, 0);
        expect(await page.locator(panel).boundingBox()).toEqual(panelBefore);
        await page.mouse.wheel(60, 0);
        await expect.poll(() => position(page, sidebar)).toBeGreaterThan(before + 120);
        await viewport.focus();
        await page.keyboard.press('End');
        const end = await position(page, sidebar);
        await page.keyboard.press('ArrowRight');
        expect(await position(page, sidebar)).toBeLessThan(end);
        await stationary(page, sidebar);
        await page.locator(`${sidebar} .p5r-party-pause`).click();
        await expect(page.locator(`${sidebar} .p5r-party-pause`)).toHaveAttribute('aria-pressed', 'true');
        await page.mouse.click(1, 1);
        await stationary(page, sidebar);
        await page.locator(`${sidebar} .p5r-party-pause`).click();
        await page.mouse.click(1, 1);
        const resumed = await position(page, sidebar);
        await expect.poll(() => position(page, sidebar)).toBeGreaterThan(resumed + 2);
    });

    test('OS and saved motion preferences stop autoplay while manual navigation remains available', async ({ page }) => {
        await open(page);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(page.locator(`${sidebar} .p5r-party-pause`)).toBeHidden();
        await stationary(page, sidebar);
        await stationary(page, welcome);
        await page.locator(windowOf(welcome)).focus();
        const before = await position(page, welcome);
        await page.keyboard.press('ArrowRight');
        expect(await position(page, welcome)).toBeGreaterThan(before + 50);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const resumed = await position(page, sidebar);
        await expect.poll(() => position(page, sidebar)).toBeGreaterThan(resumed + 2);
        await page.locator('[data-action=modern-page][data-ui-page=settings]').click();
        await page.locator('[data-action=p5r-motion]').click();
        await page.locator('[data-action=modern-page][data-ui-page=status]').click();
        await settle(page);
        await expect(page.locator(panel)).toHaveAttribute('data-motion', 'reduced');
        await stationary(page, sidebar);
        await page.reload();
        await page.locator(`${panel} .ls-toggle`).click();
        await settle(page);
        await stationary(page, welcome);
        await expect(page.locator(`${welcome} .p5r-party-pause`)).toBeHidden();
    });

    test('refresh preserves the position and hidden, closed or disposed rows stop advancing', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await open(page);
        await page.locator(windowOf(sidebar)).hover();
        const before = await position(page, sidebar);
        await page.evaluate(() => window.LifeStateContinuity.refreshStatePanel());
        await settle(page);
        expect(await position(page, sidebar)).toBe(before);
        await page.mouse.move(1, 1);
        await page.setViewportSize({ width: 1280, height: 420 });
        await settle(page);
        await expect(page.locator(sidebar)).toBeHidden();
        await expect(page.locator(welcome)).not.toBeInViewport();
        await stationary(page, welcome);
        await page.locator(`${panel} .p5r-close`).click();
        await settle(page);
        await stationary(page, welcome);
        await page.evaluate(() => window.extension.onDisable());
        await expect(page.locator('.p5r-party-strip')).toHaveCount(0);
        await page.evaluate(() => window.extension.onEnable());
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator(`${panel} .ls-toggle`).click();
        await settle(page);
        await expect(page.locator('.p5r-party-strip')).toHaveCount(2);
        const enabled = await position(page, welcome);
        await expect.poll(() => position(page, welcome)).toBeGreaterThan(enabled + 2);
        expect(errors).toEqual([]);
    });
});

test('native mobile gestures move the portrait row horizontally and the page vertically', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 620 }, isMobile: true, hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('life-state-p5r-motion-v1', 'reduced'));
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173');
    await page.waitForFunction(() => window.extension?.getStatus().running);
    await page.locator(`${panel} .ls-toggle`).tap();
    const viewport = page.locator(windowOf(welcome));
    await viewport.scrollIntoViewIfNeeded();
    await settle(page);
    const session = await context.newCDPSession(page);
    async function swipe(dx, dy) {
        const box = await viewport.boundingBox();
        const x = box.x + box.width * .7, y = box.y + box.height / 2;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 8, y: y + dy * i / 8 }] });
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    const before = await position(page, welcome);
    const panelBefore = await page.locator(panel).boundingBox();
    await swipe(-110, 0);
    expect(await position(page, welcome)).toBeCloseTo(before + 110, 0);
    expect(await page.locator(panel).boundingBox()).toEqual(panelBefore);
    const scrollBefore = await page.locator(`${panel} .ls-body`).evaluate(el => el.scrollTop);
    expect(scrollBefore).toBeGreaterThan(0);
    await swipe(0, 100);
    await expect.poll(() => page.locator(`${panel} .ls-body`).evaluate(el => el.scrollTop)).toBeLessThan(scrollBefore);
    await expect(page.locator(welcome)).not.toHaveAttribute('data-dragging', 'true');
    await context.close();
});
