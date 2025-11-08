"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localize = localize;
const vscode = require("vscode");
const enMessages = {
    'error.apiKeyRequired': 'Please set the API key for {0}.',
    'error.unknown': 'Unknown error',
    'response.errorWithReason': 'Request error: {0}',
    'error.requestNotification': 'DeepSeek Code Generator: {0}',
    'response.parseError': 'Request error: failed to parse response',
    'response.userStopped': 'User stopped the request',
    'response.requestFailed': 'Request failed',
    'info.apiKeyMissing': 'API keys are not set. Click here to configure them.',
    'action.openSettings': 'Open Settings',
    'input.prompt.question': 'Please enter your question',
    'tree.settingsLabel': 'DeepSeek Settings',
    'info.apiKeyUpdated': '{0} API key updated!',
    'webview.heading': 'DeepSeek',
    'webview.tip.label': 'AI Chat',
    'webview.history.userLabel': 'You:',
    'webview.history.assistantLabel': 'DeepSeek:',
    'webview.history.empty': 'No history yet',
    'webview.chat.userLabel': 'You',
    'webview.chat.assistantLabel': 'DeepSeek',
    'webview.chat.empty': 'Hello, I\'m DeepSeek, your AI programming assistant.',
    'webview.tooltip.chatHistory': 'Chat History',
    'webview.tooltip.settings': 'Settings',
    'webview.tooltip.newChat': 'New Chat',
    'webview.history.title': 'Latest 10 conversations',
    'webview.history.closeAria': 'Close history panel',
    'webview.history.clearTitle': 'Clear all history',
    'webview.history.clearLabel': 'Clear all history',
    'webview.progress.generating': 'Generating',
    'webview.progress.stop': 'Stop',
    'webview.input.placeholder': 'Input your question, e.g. Generate a countdown JavaScript code...',
    'webview.confirm.clearHistory': 'Are you sure you want to clear all chat history? This action cannot be undone.',
    'action.yes': 'Yes',
    'action.no': 'No'
};
const zhCNMessages = {
    'error.apiKeyRequired': '请先为 {0} 配置 API Key。',
    'error.unknown': '未知错误',
    'response.errorWithReason': '请求出错：{0}',
    'error.requestNotification': 'DeepSeek Code Generator：{0}',
    'response.parseError': '请求出错：解析响应失败',
    'response.userStopped': '用户已停止请求',
    'response.requestFailed': '请求失败',
    'info.apiKeyMissing': '尚未配置 API Key，点击此处前往设置。',
    'action.openSettings': '打开设置',
    'input.prompt.question': '请输入你的问题',
    'tree.settingsLabel': 'DeepSeek 设置',
    'info.apiKeyUpdated': '{0} 的 API Key 已更新！',
    'webview.heading': 'DeepSeek',
    'webview.tip.label': 'AI 对话',
    'webview.history.userLabel': '我：',
    'webview.history.assistantLabel': 'DeepSeek：',
    'webview.history.empty': '暂无历史记录',
    'webview.chat.userLabel': '我',
    'webview.chat.assistantLabel': 'DeepSeek',
    'webview.chat.empty': '你好，我是DeepSeek，您的AI编程助手。',
    'webview.tooltip.chatHistory': '聊天记录',
    'webview.tooltip.settings': '设置',
    'webview.tooltip.newChat': '新建聊天',
    'webview.history.title': '最近 10 条对话',
    'webview.history.closeAria': '关闭历史面板',
    'webview.history.clearTitle': '清除所有历史记录',
    'webview.history.clearLabel': '清除所有历史',
    'webview.progress.generating': '生成中',
    'webview.progress.stop': '停止',
    'webview.input.placeholder': '请输入你的问题，如：生成一个倒计时的 JavaScript 代码……',
    'webview.confirm.clearHistory': '确定要清除所有聊天历史吗？此操作不可恢复。',
    'action.yes': '是',
    'action.no': '否'
};
const languageTables = {
    en: enMessages,
    'zh-cn': zhCNMessages
};
const languageAliases = {
    en: 'en',
    'en-us': 'en',
    'en-gb': 'en',
    zh: 'zh-cn',
    'zh-cn': 'zh-cn',
    'zh-sg': 'zh-cn',
    'zh-hans': 'zh-cn'
};
function getMessages(language) {
    if (!language) {
        return enMessages;
    }
    const normalized = language.toLowerCase();
    const directMatch = languageTables[normalized];
    if (directMatch) {
        return directMatch;
    }
    const alias = languageAliases[normalized];
    if (alias) {
        return languageTables[alias];
    }
    const [base] = normalized.split('-');
    if (base) {
        if (languageTables[base]) {
            return languageTables[base];
        }
        if (languageAliases[base]) {
            return languageTables[languageAliases[base]];
        }
    }
    return enMessages;
}
function format(template, args) {
    return template.replace(/\{(\d+)\}/g, (match, index) => {
        const argIndex = Number(index);
        const value = args[argIndex];
        return value !== undefined ? String(value) : match;
    });
}
function localize(key, fallback, ...args) {
    var _a;
    const messages = getMessages(vscode.env.language);
    const template = (_a = messages[key]) !== null && _a !== void 0 ? _a : fallback;
    return args.length ? format(template, args) : template;
}
//# sourceMappingURL=localize.js.map