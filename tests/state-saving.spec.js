import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readChatMetadata } from '../src/chat-persistence.js';

const payload = JSON.parse(await readFile(new URL('./fixtures/state-update.json', import.meta.url)));
async function prepare(page, legacy = false) {
    await page.goto('/');
    await page.waitForFunction(() => window.fixtureReady);
    await page.evaluate(async ({ payload, legacy }) => {
        const core = window.LifeStateContinuity, { ctx, bus } = window.fixture;
        await window.fixture.chat('state-regression');
        const key = core.CONFIG.variableKey;
        ctx.chatMetadata.variables[key] = { ...ctx.chatMetadata.variables[key], state_workflow_mode: 'inline', effect_mode: 'open',
            modules: { daily_needs: ['drink', 'meal', 'urination', 'bowel_movement', 'sleep'], stamina: true, reproductive: true, sexual_desire: false } };
        if (legacy) {
            window.originalLegacy = structuredClone(ctx.chatMetadata.variables[key]);
            ctx.chatMetadata.variables = { [core.CONFIG.legacyVariableKeyV456]: structuredClone(window.originalLegacy), other_extension: { keep: true } };
        }
        await bus.emit('CHAT_CHANGED', ctx.chatId);
        for (let id = 0; id < 24; id++) ctx.chat.push({ mes: '日常对话 ' + id, is_user: id % 2 === 1, name: '样例人物' });
        ctx.chat.push({ mes: '继续对话。\n<life_state>\n' + JSON.stringify(payload) + '\n</life_state>', is_user: false, name: '样例人物' });
        window.originalReply = ctx.chat[24].mes;
    }, { payload, legacy });
}

test('an existing conversation migrates legacy variables and preserves other extension data', async ({ page }) => {
    await prepare(page, true);
    const result = await page.evaluate(async () => {
        const core = window.LifeStateContinuity, { ctx } = window.fixture;
        const outcome = await core.processMessage(24), variables = ctx.chatMetadata.variables;
        return { ok: outcome.ok, source: variables[core.CONFIG.variableKey].source_message_id,
            preserved: JSON.stringify(variables[core.CONFIG.legacyVariableKeyV456]) === JSON.stringify(window.originalLegacy), other: variables.other_extension };
    });
    expect(result).toEqual({ ok: true, source: 24, preserved: true, other: { keep: true } });
});

test('stage-only first profile with stamina and reproductive data saves without rewriting the reply', async ({ page }) => {
    await prepare(page);
    const result = await page.evaluate(async () => {
        const core = window.LifeStateContinuity, { ctx } = window.fixture;
        const outcome = await core.processMessage(24);
        return { ok: outcome.ok, store: ctx.chatMetadata.variables[core.CONFIG.variableKey], unchanged: ctx.chat[24].mes === window.originalReply };
    });
    expect(result.ok).toBe(true);
    expect(result.unchanged).toBe(true);
    expect(result.store.source_message_id).toBe(24);
    expect(result.store.snapshot.characters['样例人物'].needs.drink.last_at).toMatch(/^D\d+ \d{2}:\d{2}$/);
    expect(result.store.snapshot.characters['样例人物'].reproductive.menstrual_cycle.cycle_day).toBe(14);
    expect(result.store.stamina_receipts['24:0'].updates['样例人物'].segments).toHaveLength(1);
});

test('save errors are visible next to a passing format check, and retry saves without a model request', async ({ page }) => {
    await prepare(page);
    await page.locator('.ls-toggle').click();
    const failed = await page.evaluate(async () => {
        const { ctx } = window.fixture;
        window.originalSave = ctx.saveMetadata;
        ctx.saveMetadata = async () => { throw new Error('测试：磁盘暂时不可写'); };
        ctx.generateRaw = async () => { throw new Error('Retry must not invoke a model'); };
        return window.LifeStateContinuity.processMessage(24);
    });
    expect(failed.code).toBe('snapshot_save_failed');
    await expect(page.locator('.ls-state-update[data-level]')).toContainText('磁盘暂时不可写');
    await page.locator('[data-action=state-return]').click();
    await expect(page.locator('#life-state-external-response-panel')).toContainText('格式检查通过');
    await expect(page.locator('#life-state-external-response-panel')).toContainText('保存失败原因：测试：磁盘暂时不可写');
    await page.locator('[data-action=external-response-close]').click();
    await page.evaluate(() => { window.fixture.ctx.saveMetadata = window.originalSave; });
    await page.locator('[data-action=state-save-retry]').click();
    await expect(page.locator('.ls-state-update[data-level]')).toContainText('最近更新：第 24 楼');
    await expect(page.locator('[data-action=state-save-retry]')).toHaveCount(0);
    expect(await page.evaluate(() => window.fixture.ctx.chat[24].mes === window.originalReply)).toBe(true);
});

test('chat metadata decoding handles split UTF-8 and escaped braces without reading the conversation tail', async () => {
    const metadata = { variables: { note: '汉字 } \\" [', nested: [{ preserved: true }] } };
    const bytes = new TextEncoder().encode(' [ ' + JSON.stringify({ chat_metadata: metadata }) + ',');
    let cancelled = false, offset = 0;
    const stream = new ReadableStream({
        pull(controller) { if (offset < bytes.length) controller.enqueue(bytes.slice(offset, ++offset)); },
        cancel() { cancelled = true; },
    });
    expect(await readChatMetadata(new Response(stream))).toEqual(metadata);
    expect(cancelled).toBe(true);
});

for (const mode of ['long-chat', 'delayed-read', 'permanent-mismatch', 'chat-switch']) {
    test(`native save confirmation: ${mode}`, async ({ page }) => {
        await page.goto('/'); await page.waitForFunction(() => window.fixtureReady);
        const result = await page.evaluate(async mode => {
            const config = window.LifeStateContinuity.CONFIG, key = config.variableKey;
            const old = { store_version: 5, value: 'before' }, next = { store_version: 5, value: 'after' };
            const metadata = { variables: { [key]: old, other_extension: { keep: true } } };
            let reads = 0, saves = 0, cancelled = false;
            const ctx = { chatId: 'one', characterId: 0, characters: [{ avatar: 'fixture.png', chat: 'one' }], chat: [], chatMetadata: metadata,
                eventTypes: { CHAT_CHANGED: 'CHAT_CHANGED' }, eventSource: { on() {}, removeListener() {} },
                getRequestHeaders: () => ({ 'Content-Type': 'application/json' }), saveMetadata: async () => { saves++; } };
            const root = { fetch: async () => {
                reads++;
                const snapshot = mode === 'permanent-mismatch' || mode === 'chat-switch' || (mode === 'delayed-read' && reads === 1) ? old : next;
                if (mode === 'chat-switch') setTimeout(() => { ctx.chatId = 'two'; ctx.characters[0].chat = 'two'; ctx.chatMetadata = { variables: { unrelated: true } }; }, 20);
                const header = { chat_metadata: { variables: { [key]: snapshot, other_extension: { keep: true } } } };
                if (mode !== 'long-chat') return Response.json([header]);
                return new Response(new ReadableStream({
                    start(controller) { controller.enqueue(new TextEncoder().encode('[' + JSON.stringify(header) + ',')); },
                    cancel() { cancelled = true; },
                }));
            } };
            const { createNativeRuntime } = await import('/src/runtime.js');
            const adapter = createNativeRuntime(root).createDataAdapter({ config, getContext: () => ctx, verifyTimeoutMs: 2500 });
            let failure;
            try { await adapter.setStore(next); } catch (error) { failure = { code: error.code, message: error.message }; }
            finally { adapter.dispose(); }
            return { reads, saves, cancelled, failure, value: metadata.variables[key], other: metadata.variables.other_extension, active: ctx.chatMetadata };
        }, mode);
        expect(result.saves).toBe(1);
        expect(result.other).toEqual({ keep: true });
        if (mode === 'long-chat' || mode === 'delayed-read') {
            expect(result.failure).toBeUndefined();
            expect(result.value.value).toBe('after');
            expect(result.reads).toBe(mode === 'long-chat' ? 1 : 2);
            if (mode === 'long-chat') expect(result.cancelled).toBe(true);
        } else {
            expect(result.failure.code).toBe(mode === 'chat-switch' ? 'chat_identity_changed' : 'native_save_unconfirmed');
            expect(result.value.value).toBe('before');
            if (mode === 'chat-switch') expect(result.active.variables).toEqual({ unrelated: true });
        }
    });
}
