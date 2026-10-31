import { test, expect } from '@playwright/test';

const profile = { name: '样例人物', sex: 'female', summary: '图书管理员', wake_start: '06:00', wake_end: '07:00' };
async function open(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.fixtureReady);
    await page.evaluate(() => window.fixture.chat('scan-regression'));
}

test('Vertex Gemini scans use bounded plain JSON and save validated profiles', async ({ page }) => {
    await open(page);
    const result = await page.evaluate(async profile => {
        const ctx = window.fixture.ctx;
        ctx.mainApi = 'openai';
        ctx.chatCompletionSettings = { chat_completion_source: 'vertexai', vertexai_model: 'gemini-4-argon', openai_max_tokens: 60000 };
        let request;
        ctx.generateRaw = async params => { request = params; return JSON.stringify({ characters: [profile] }); };
        await window.LifeStateContinuity.scanCharacterProfiles();
        const store = ctx.chatMetadata.variables[window.LifeStateContinuity.CONFIG.variableKey];
        return { request, profiles: store.character_profiles, settings: ctx.chatCompletionSettings };
    }, profile);
    expect(result.request.responseLength).toBe(8192);
    expect(result.request.jsonSchema).toBeUndefined();
    expect(result.profiles[profile.name].sex).toBe('female');
    expect(result.settings.openai_max_tokens).toBe(60000);
});

test('502 invalid argument retries once with scoped compatibility parameters', async ({ page }) => {
    await open(page);
    const result = await page.evaluate(async profile => {
        const { ctx, bus, listeners } = window.fixture;
        const core = window.LifeStateContinuity, event = ctx.eventTypes.CHAT_COMPLETION_SETTINGS_READY;
        ctx.mainApi = 'openai';
        ctx.chatCompletionSettings = { chat_completion_source: 'vertexai', vertexai_model: 'gemini-4-argon', openai_max_tokens: 60000 };
        const countBefore = listeners.get(event)?.size || 0, calls = [], unrelated = [];
        ctx.generateRaw = async params => {
            const payload = { type: 'quiet', model: 'gemini-4-argon', chat_completion_source: 'vertexai',
                vertexai_region: 'global', vertexai_auth_mode: 'full', secret_id: 'fixture-only',
                messages: [{ role: 'user', content: params.prompt }], max_tokens: params.responseLength,
                json_schema: { value: {} }, tools: [{ name: 'fixture' }], tool_choice: 'auto',
                temperature: 2, top_p: .9, stop: ['stop'], reasoning_effort: 'maximum',
                enable_web_search: true, request_images: true, include_reasoning: true };
            const other = { type: 'quiet', messages: [{ role: 'user', content: 'A different extension request' }],
                max_tokens: 40000, temperature: .7, request_images: true, reasoning_effort: 'high' };
            const before = JSON.stringify(other);
            await bus.emit(event, other);
            unrelated.push(before === JSON.stringify(other));
            await bus.emit(event, payload);
            calls.push(payload);
            if (params.systemPrompt) throw new Error('HTTP 502: Request contains an invalid argument.');
            return JSON.stringify({ characters: [profile] });
        };
        await core.scanCharacterProfiles();
        return { calls, unrelated, countBefore, countAfter: listeners.get(event)?.size || 0,
            settings: ctx.chatCompletionSettings };
    }, profile);
    expect(result.calls).toHaveLength(2);
    const compatible = result.calls[1];
    for (const name of ['json_schema', 'tools', 'tool_choice', 'temperature', 'top_p', 'stop', 'reasoning_effort']) expect(compatible[name]).toBeUndefined();
    expect(compatible).toMatchObject({ model: 'gemini-4-argon', vertexai_region: 'global', secret_id: 'fixture-only',
        max_tokens: 8192, request_images: false, enable_web_search: false, include_reasoning: false });
    expect(compatible.messages[0].content).not.toContain('[life-state-scan:');
    expect(result.unrelated).toEqual([true, true]);
    expect(result.countAfter).toBe(result.countBefore);
    expect(result.settings.openai_max_tokens).toBe(60000);
});

test('explicit compatibility uses one request and releases its hook on authentication failure', async ({ page }) => {
    await open(page);
    const result = await page.evaluate(async () => {
        const { ctx, listeners } = window.fixture, core = window.LifeStateContinuity;
        const event = ctx.eventTypes.CHAT_COMPLETION_SETTINGS_READY, before = listeners.get(event)?.size || 0;
        let count = 0, params;
        ctx.generateRaw = async value => { params = value; count++; throw new Error('HTTP 401: unauthorized'); };
        let message;
        try { await core.scanCharacterProfiles(undefined, { compatibility: true }); } catch (error) { message = error.message; }
        return { count, params, message, before, after: listeners.get(event)?.size || 0,
            retry: core.shouldRetryCharacterProfileScan(new Error('HTTP 429: quota exceeded')) };
    });
    expect(result.count).toBe(1);
    expect(result.params.systemPrompt).toBe('');
    expect(result.params.jsonSchema).toBeUndefined();
    expect(result.message).toContain('401');
    expect(result.after).toBe(result.before);
    expect(result.retry).toBe(false);
});
