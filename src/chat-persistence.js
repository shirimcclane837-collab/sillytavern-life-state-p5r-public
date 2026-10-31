// /api/chats/get returns a JSON array whose first record is the chat header.
// Read just that record: confirming a small state update must not download
// every message, swipe and attachment in a long conversation.
export async function readChatMetadata(response) {
    if (!response.body?.getReader) {
        const payload = await response.json();
        return Array.isArray(payload) ? payload[0]?.chat_metadata : undefined;
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    const parts = [];
    let array = false, object = false, depth = 0, quoted = false, escaped = false;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) throw new Error('聊天存档缺少完整元数据头');
            const chunk = decoder.decode(value, { stream: true });
            let start = object ? 0 : -1;
            for (let index = 0; index < chunk.length; index++) {
                const char = chunk[index];
                if (!object) {
                    if (/\s|\uFEFF/.test(char)) continue;
                    if (!array && char === '[') { array = true; continue; }
                    if (array && char === '{') { object = true; depth = 1; start = index; continue; }
                    throw new Error('聊天存档头格式异常');
                }
                if (quoted) {
                    if (escaped) escaped = false;
                    else if (char === '\\') escaped = true;
                    else if (char === '"') quoted = false;
                } else if (char === '"') quoted = true;
                else if (char === '{' || char === '[') depth++;
                else if (char === '}' || char === ']') {
                    depth--;
                    if (depth === 0) {
                        parts.push(chunk.slice(start, index + 1));
                        return JSON.parse(parts.join('')).chat_metadata;
                    }
                }
            }
            if (start >= 0) parts.push(chunk.slice(start));
        }
    } finally {
        try { await reader.cancel(); } catch (_) { /* the fetch may already have been aborted */ }
        reader.releaseLock();
    }
}
