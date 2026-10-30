import { test, expect } from '@playwright/test';

const legacy = {
    id: '4e99ef29-63db-4c5f-8e1c-3d64ac9d7b3e', scriptName: '隐藏引擎状态交接块（仅界面）',
    findRegex: '/<(life_state|state_handoff|story_time)\\b[^>]*>[\\s\\S]*?<\\/\\1>/gi', replaceString: '',
    placement: [2], disabled: false, markdownOnly: true, promptOnly: false,
};
const rule = (id, findRegex, replaceString, extra = {}) => ({ id, findRegex, replaceString, placement: [2], markdownOnly: true, promptOnly: false, disabled: false, ...extra });
async function start(page, rules = [], legacyHost = false) {
    await page.addInitScript(rules => { window.fixtureRegex = rules; }, rules);
    await page.goto(legacyHost ? '/?legacy-host' : '/');
    await page.waitForFunction(() => window.extension?.getStatus().running);
    await page.evaluate(() => window.fixture.chat('chat-b', { sample: true }));
}

test('migrates only its legacy rule and lets a full-message regex see the untouched protocol output', async ({ page }) => {
    const userRules = [rule('narrative', '/清晨/g', '傍晚'), rule('wrapper', '/^([\\s\\S]*)$/', '<article data-user-widget="">$1</article>'), rule('prompt', '/life_state/g', 'prompt-state', { markdownOnly: false, promptOnly: true })];
    await start(page, [userRules[0], legacy, ...userRules.slice(1)]);
    await expect(page.locator('#chat article')).toContainText('傍晚');
    await expect(page.locator('#chat .mes_text')).not.toContainText('"version"');
    const result = await page.evaluate(() => ({ rules: window.fixture.ctx.extensionSettings.regex, raw: window.fixture.ctx.chat[0].mes, saves: window.fixtureSettingsSaves }));
    expect(result.rules).toEqual(userRules);
    expect(result.raw).toContain('清晨'); expect(result.raw).toContain('<life_state>');
    expect(result.saves).toBe(1);
});

test('a user regex can consume the state block and render its own widget', async ({ page }) => {
    const widget = rule('own-status', '/<life_state>([\\s\\S]*?)<\\/life_state>/g', '<details data-user-widget=""><summary>我的面板</summary><pre>$1</pre></details>');
    await start(page, [legacy, widget]);
    const details = page.locator('#chat details');
    await details.locator('summary').click();
    await expect(details.locator('pre')).toBeVisible();
    await expect(details).toContainText('"version"');
    expect(await page.evaluate(() => window.fixture.ctx.extensionSettings.regex)).toEqual([widget]);
});

test('display hooks are idempotent, leave user/system/preview messages intact, and stop on disable', async ({ page }) => {
    await start(page);
    const result = await page.evaluate(async () => {
        const { ctx, formatter } = window.fixture, raw = ctx.chat[0].mes;
        const format = overrides => formatter.format(raw, { isUser: false, isSystem: false, isReasoning: false, messageId: 0, ...overrides }, []);
        const protectedContexts = [{ isUser: true }, { isSystem: true }, { isReasoning: true }, { messageId: -1 }].map(format);
        await window.extension.onDisable();
        const disabled = format({});
        window.extension.onEnable();
        return { protectedContexts, disabled };
    });
    for (const output of [...result.protectedContexts, result.disabled]) expect(output).toContain('"version"');
    await page.waitForFunction(() => window.extension?.getStatus().running);
    await page.evaluate(() => window.fixture.chat('chat-b', { sample: true }));
    await expect(page.locator('#chat .mes_text')).not.toContainText('"version"');
    expect(await page.evaluate(() => window.fixture.formatter.hooks.length)).toBe(1);
});

test('edits, swipes and rerenders hide new output without touching the saved message', async ({ page }) => {
    await start(page);
    const raw = await page.evaluate(() => {
        const { ctx } = window.fixture;
        const message = ctx.chat[0]; message.mes = message.mes.replace('清晨', '雨夜');
        ctx.updateMessageBlock(0, message); ctx.updateMessageBlock(0, message);
        return message.mes;
    });
    await expect(page.locator('#chat .mes_text')).toContainText('雨夜');
    await expect(page.locator('#chat .mes_text')).not.toContainText('"version"');
    expect(await page.evaluate(() => window.fixture.ctx.chat[0].mes)).toBe(raw);
});

test('older hosts hide an exact rendered footer and preserve preceding HTML, listeners and editor data', async ({ page }) => {
    await start(page, [legacy], true);
    await expect(page.locator('#chat [data-life-state-output-hidden]')).toHaveCount(1);
    await expect(page.locator('#chat .mes_text')).not.toBeEmpty();
    const result = await page.evaluate(async () => {
        const { ctx } = window.fixture, root = document.querySelector('#chat .mes_text');
        const button = document.createElement('button'); button.textContent = '用户交互';
        let clicks = 0; button.onclick = () => clicks++; root.prepend(button);
        await new Promise(resolve => setTimeout(resolve, 0)); button.click();
        const raw = ctx.chat[0].mes;
        await window.extension.onDisable();
        return { clicks, sameButton: root.firstChild === button, raw: ctx.chat[0].mes, original: raw, restored: root.textContent };
    });
    expect(result.clicks).toBe(1); expect(result.sameButton).toBe(true);
    expect(result.raw).toBe(result.original); expect(result.restored).toContain('"version"');
});

test('does not delete edited rules, similarly named rules, or protocol-like HTML attributes', async ({ page }) => {
    const custom = { ...legacy, replaceString: '<b>已接收</b>' };
    const sameName = { ...rule('user-owned', '/清晨/g', '正午'), scriptName: legacy.scriptName };
    await start(page, [custom, sameName]);
    expect(await page.evaluate(() => window.fixture.ctx.extensionSettings.regex)).toEqual([custom, sameName]);
    await expect(page.locator('#chat .mes_text')).toContainText('已接收');
    const output = await page.evaluate(async () => {
        const { stripDisplayStateBlocks } = await import('/src/output-visibility.js');
        const prefix = `<div data-template='<life_state>x</life_state>'>正文</div><script>const s='<life_state>literal</life_state>';</script>`;
        return { prefix, filtered: stripDisplayStateBlocks(`${prefix}<life_state>{"x":1}</life_state><story_time>{"day":1}</story_time>`) };
    });
    expect(output.filtered).toBe(output.prefix);
});

test('legacy hosts leave a regex widget intact even when it contains the unchanged JSON footer', async ({ page }) => {
    const widget = rule('legacy-widget', '/<life_state>([\\s\\S]*?)<\\/life_state>/g', '<details data-user-widget=""><summary>我的面板</summary><pre>$1</pre></details>');
    await start(page, [legacy, widget], true);
    await page.locator('#chat details summary').click();
    await expect(page.locator('#chat details pre')).toBeVisible();
    await expect(page.locator('#chat details pre')).toContainText('"version"');
    await expect(page.locator('#chat [data-life-state-output-hidden]')).toHaveCount(0);
    expect(await page.evaluate(() => window.fixture.ctx.extensionSettings.regex)).toEqual([widget]);
});
