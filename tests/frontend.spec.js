import { test, expect } from '@playwright/test';

const panel = '#life-state-continuity-panel';
const nav = page => `${panel} [data-action=modern-page][data-ui-page=${page}]`;
const settle = page => page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
async function open(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.extension?.getStatus().running);
    await page.locator(`${panel} .ls-toggle`).click();
    await settle(page);
}

test('starts without a chat, saves global defaults, and applies them only to a new chat', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page);
    await expect(page.locator(panel)).toHaveAttribute('data-chat-state', 'empty');
    await expect(page.locator('.p5r-heading')).toContainText('手册已经就绪');
    expect(await page.evaluate(() => window.fixtureCalls)).toEqual([]);
    await page.locator(nav('settings')).click();
    await page.locator('.p5r-defaults input[value=drink]').check();
    await page.locator('[data-action=p5r-motion]').click();
    await expect(page.locator('.p5r-defaults input[value=drink]')).toBeChecked();
    await page.locator('[data-action=p5r-save-defaults]').click();
    await expect(page.locator('.p5r-feedback')).toContainText('已保存');
    await page.evaluate(() => window.fixture.chat('chat-a'));
    await expect(page.locator(panel)).toHaveAttribute('data-chat-state', 'ready');
    expect(await page.evaluate(() => window.fixture.ctx.chatMetadata.variables[window.LifeStateContinuity.CONFIG.variableKey].modules.daily_needs)).toContain('drink');
    await page.evaluate(() => window.fixture.chat('chat-b', { sample: true }));
    expect(await page.evaluate(() => window.fixture.ctx.chatMetadata.variables[window.LifeStateContinuity.CONFIG.variableKey].modules.daily_needs)).toHaveLength(5);
    await page.evaluate(() => window.fixture.chat(null));
    await expect(page.locator(panel)).toHaveAttribute('data-chat-state', 'empty');
    await expect(page.locator(panel)).toHaveCount(1);
    expect(errors).toEqual([]);
});

test('chat switching clears the previous character and activation stays idempotent', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.fixture.chat('chat-a', { sample: true }));
    await expect(page.locator(`${panel} .ls-profile-name`)).toContainText('雨宫莲');
    await page.evaluate(() => window.fixture.chat('chat-b', { sample: true }));
    await expect(page.locator(`${panel} .ls-profile-name`)).toContainText('明日香');
    await expect(page.locator(`${panel} .ls-content`)).not.toContainText('雨宫莲');
    await page.evaluate(async () => { window.extension.onActivate(); window.extension.onEnable(); });
    await expect(page.locator(panel)).toHaveCount(1);
    await page.evaluate(() => window.extension.onDisable());
    await expect(page.locator(panel)).toHaveCount(0);
    expect(await page.evaluate(() => [...window.fixture.listeners.values()].reduce((n, set) => n + set.size, 0))).toBe(0);
    await page.evaluate(() => { window.fixture.ctx.chatId = null; window.extension.onEnable(); });
    await expect(page.locator(panel)).toHaveCount(1);
    await expect(page.locator(panel)).toHaveAttribute('data-chat-state', 'empty');
});

test('rapid navigation settles on the latest page and preserves an API input draft and focus', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.fixture.chat('chat-a'));
    await page.evaluate(() => {
        for (const page of ['people', 'play', 'settings', 'people', 'settings']) document.querySelector(`[data-action=modern-page][data-ui-page=${page}]`).click();
    });
    await settle(page);
    await expect(page.locator(panel)).toHaveAttribute('data-ui-page', 'settings');
    await page.locator('.ls-settings-nav [data-action=settings-page][data-settings-page=api]').click();
    const input = page.locator('.ls-external-endpoint');
    await input.fill('https://draft.example/v1');
    await page.evaluate(() => window.LifeStateContinuity.refreshStatePanel());
    await expect(input).toHaveValue('https://draft.example/v1');
    await expect(input).toBeFocused();
    await page.locator(nav('status')).click();
    await page.locator(nav('settings')).click();
    await page.locator('.ls-settings-nav [data-action=settings-page][data-settings-page=api]').click();
    await expect(input).toHaveValue('https://draft.example/v1');
    await settle(page);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('opening during a closing animation and reduced motion both finish in a usable state', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
        const toggle = document.querySelector('#life-state-continuity-panel .ls-toggle');
        toggle.click(); toggle.click();
    });
    await settle(page);
    await expect(page.locator(`${panel} .ls-body`)).toBeVisible();
    await page.locator(nav('settings')).click();
    await page.locator('[data-action=p5r-motion]').click();
    await expect(page.locator(panel)).toHaveAttribute('data-motion', 'reduced');
    await page.locator(nav('people')).click();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.locator(panel)).not.toHaveClass(/ls-open/);
    await expect(page.locator(`${panel} .ls-toggle`)).toBeFocused();
    await page.reload();
    await expect(page.locator(panel)).toHaveAttribute('data-motion', 'reduced');
});

test('existing light/ink themes migrate to P5R and OS reduced motion disables animation', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('role-body-continuity-ui-theme-v2', 'sunny'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.locator(panel)).toHaveAttribute('data-ui-theme', 'p5r');
    await page.locator(nav('settings')).click();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('a pending old chat cannot repopulate the panel after returning home', async ({ page }) => {
    await open(page);
    await page.evaluate(async () => {
        let release;
        let started;
        const entered = new Promise(resolve => { started = resolve; });
        const blocked = new Promise(resolve => { release = resolve; });
        window.fixture.ctx.saveMetadata = () => { started(); return blocked; };
        const first = window.fixture.chat('chat-a');
        await entered;
        const home = window.fixture.chat(null);
        release();
        await Promise.all([first, home]);
    });
    await expect(page.locator(panel)).toHaveAttribute('data-chat-state', 'empty');
    await expect(page.locator('.p5r-heading')).toContainText('手册已经就绪');
    expect(await page.evaluate(() => window.fixture.ctx.chatMetadata)).toEqual({});
});

test('a failed chat load reports an error and can be retried without duplicating the window', async ({ page }) => {
    await open(page);
    await page.evaluate(async () => {
        window.fixture.ctx.saveMetadata = async () => { throw new Error('模拟保存失败'); };
        await window.fixture.chat('chat-a');
    });
    await expect(page.locator(panel)).toHaveAttribute('data-chat-state', 'error');
    await expect(page.locator('.p5r-lead')).toContainText('模拟保存失败');
    await page.evaluate(() => { window.fixture.ctx.saveMetadata = async () => {}; });
    await page.locator('[data-action=p5r-retry]').click();
    await expect(page.locator(panel)).toHaveAttribute('data-chat-state', 'ready');
    await expect(page.locator(panel)).toHaveCount(1);
});

test('daily picker animates, saves changes, and returns keyboard focus when dismissed', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.fixture.chat('chat-a'));
    await page.locator(nav('settings')).click();
    await page.locator('.ls-settings-nav [data-settings-page=content]').click();
    await page.locator('[data-action=daily]').click();
    const overlay = page.locator('#life-state-daily-picker-panel');
    await expect(overlay).toHaveAttribute('data-ui-theme', 'p5r');
    await expect(overlay.locator('[role=dialog]')).toBeVisible();
    await overlay.locator('[data-need-key=drink]').click();
    await expect(overlay.locator('[data-need-key=drink]')).toHaveAttribute('aria-pressed', 'true');
    await overlay.locator('[data-action=daily-close]').click();
    await settle(page);
    await expect(overlay).toBeHidden();
    await expect(page.locator('[data-action=daily]')).toBeFocused();
});

test('female party icon selection persists in the entry and transition art', async ({ page }) => {
    await open(page);
    await page.locator(nav('settings')).click();
    await page.locator('[data-action=p5r-portrait][data-portrait=haru]').click();
    await expect(page.locator('.p5r-entry-art img')).toHaveAttribute('src', /party\/haru\.png$/);
    await page.reload();
    await expect(page.locator('.p5r-entry-art img')).toHaveAttribute('src', /party\/haru\.png$/);
    await page.locator(`${panel} .ls-toggle`).click();
    await page.locator(nav('people')).click();
    await expect(page.locator('.p5r-cut-copy img')).toHaveAttribute('src', /party\/haru\.png$/);
    const female = ['ann', 'makoto', 'futaba', 'haru', 'hifumi', 'tae', 'sadayo', 'chihaya', 'ichiko', 'justine', 'caroline'];
    const used = await page.locator(`${panel} .p5r-portrait`).evaluateAll(images => images.map(img => img.src.split('/').pop().replace('.png', '')));
    expect(used.every(name => female.includes(name))).toBe(true);
});

test('character editing remains operable through the cutout transition and saves a changed stage', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.fixture.chat('chat-a', { sample: true }));
    await page.locator(nav('people')).click();
    await page.locator('[data-action=prepare-character-profile]').click();
    const editor = page.locator('.ls-profile-editor');
    await editor.locator('.ls-pe-stage-field').filter({ has: page.locator('select[data-need-key=drink]') }).locator('[data-profile-stage-choice][value="关注期"]').check();
    await editor.locator('[data-action=confirm-character-profile]').click();
    await expect(editor).toHaveCount(0);
    await page.locator(nav('status')).click();
    await expect(page.locator(`${panel} .ls-modern-need`).filter({ hasText: '饮水' })).toContainText('关注期');
});

for (const width of [1440, 390]) {
    test(`library categories and character application are reachable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await open(page);
        await page.evaluate(() => window.fixture.chat('chat-a', { sample: true }));
        await page.locator(nav('play')).click();
        for (const category of ['tools', 'drugs', 'marking', 'body_modification', 'clamp_pressure', 'restraint']) {
            await page.locator(`[data-action=play-library-page][data-play-page=${category}]`).click();
            await settle(page);
            expect(await page.locator(`${panel} .ls-body`).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
            await expect(page.locator('.ls-play-page-body')).not.toBeEmpty();
            await page.locator('[data-action=play-library-page][data-play-page=home]').click();
        }
        await page.locator('[data-action=play-library-page][data-play-page=restraint]').click();
        await page.locator('[data-action=select-restraint-entry][data-entry-id=custom]').click();
        const draft = page.locator('[data-role=restraint-detail]');
        await draft.fill('用于界面回归验证的测试设置');
        await page.locator('[data-action=select-play-character]').click();
        await expect(draft).toHaveValue('用于界面回归验证的测试设置');
        await expect(page.locator('[data-action=select-play-character]')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('[data-action=apply-play-combination]').scrollIntoViewIfNeeded();
        await expect(page.locator('[data-action=apply-play-combination]')).toBeInViewport();
        expect(await page.locator(`${panel} .ls-body`).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    });
}

for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
    test(`mobile panel stays within ${size.width}×${size.height} and settings remain reachable`, async ({ page }) => {
        await page.setViewportSize(size);
        await open(page);
        await page.locator(nav('settings')).click();
        await settle(page);
        const box = await page.locator(`${panel} .ls-shell`).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
        await page.locator('[data-action=p5r-save-defaults]').click();
        await expect(page.locator('.p5r-feedback')).toContainText('已保存');
        expect(await page.locator(`${panel} .ls-body`).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    });
}
