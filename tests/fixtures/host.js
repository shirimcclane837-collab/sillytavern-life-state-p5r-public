const listeners = new Map();
let ready = false;
const bus = {
    on(name, callback) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(callback);
        if (name === 'APP_READY' && ready) callback();
    },
    removeListener(name, callback) { listeners.get(name)?.delete(callback); },
    async emit(name, ...args) {
        if (name === 'APP_READY') ready = true;
        for (const callback of [...(listeners.get(name) || [])]) await callback(...args);
    },
};
const eventTypes = new Proxy({}, { get: (_, name) => name });
const ctx = {
    eventSource: bus, eventTypes, chatId: null, characterId: null, groupId: null,
    chat: [], chatMetadata: {}, characters: [], groups: [], name1: '旅行者', name2: '',
    extensionSettings: { regex: [] }, extensionPrompts: {},
    saveMetadata: async () => {}, saveSettingsDebounced() {}, saveSettings: async () => {},
    getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    setExtensionPrompt(id, value, position, depth, scan, role) { ctx.extensionPrompts[id] = { value, position, depth, scan, role }; },
    updateMessageBlock() {},
};
window.SillyTavern = { getContext: () => ctx };
window.toastr = { warning: message => console.warn(message), error: message => console.error(message), success() {}, info() {} };
window.fixtureCalls = [];
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
    const url = String(input);
    if (url.startsWith('/api/')) {
        window.fixtureCalls.push({ url, body: options?.body });
        if (url === '/api/chats/get') return Response.json([{ chat_metadata: structuredClone(ctx.chatMetadata) }, ...ctx.chat]);
        if (url === '/api/settings/get') return Response.json({});
        throw new Error(`Unexpected API call in preview: ${url}`);
    }
    return nativeFetch(input, options);
};
window.fixture = {
    ctx, bus, listeners,
    async chat(id, { sample = false } = {}) {
        ctx.chatId = id;
        ctx.characterId = id ? 0 : null;
        ctx.name2 = id === 'chat-b' ? '明日香' : '雨宫莲';
        ctx.characters = id ? [{ name: ctx.name2, avatar: `${id}.png`, chat: id, data: { name: ctx.name2 } }] : [];
        ctx.chatMetadata = {};
        ctx.chat = [];
        if (id && sample) {
            const core = window.LifeStateContinuity;
            const modules = { daily_needs: ['drink', 'meal', 'urination', 'bowel_movement', 'sleep'], reproductive: false, sexual_desire: false };
            const character = core.createManualProfileCharacter(modules, { name: ctx.name2, sex: 'male' });
            for (const [name, need] of Object.entries(character.needs)) need[name === 'sleep' ? 'wake_at' : 'last_at'] = 'D1 09:00';
            const snapshot = { version: 5, timeline: { day: 1, time: '10:00' }, scene: null, characters: { [ctx.name2]: character } };
            const validation = core.validateLifeState(snapshot, modules);
            if (!validation.valid) throw new Error(validation.errors.join('; '));
            ctx.chatMetadata.variables = { [core.CONFIG.variableKey]: { modules, snapshot, external_defaults_version: '5.67' } };
            ctx.chat = [{ mes: `清晨，${ctx.name2}走进了咖啡店。\n${core.formatCanonicalBlock(snapshot)}`, is_user: false, is_system: false, name: ctx.name2 }];
        }
        await bus.emit('CHAT_CHANGED', id);
    },
};
document.querySelector('#demo-a').onclick = () => window.fixture.chat('chat-a', { sample: true });
document.querySelector('#demo-b').onclick = () => window.fixture.chat('chat-b', { sample: true });
document.querySelector('#home').onclick = () => window.fixture.chat(null);
window.extension = await import('/index.js');
await window.extension.onActivate();
await bus.emit('APP_READY');
window.fixtureReady = true;
