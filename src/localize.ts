import * as vscode from 'vscode';

type MessageKey = keyof typeof enMessages;

type MessageTable = Record<MessageKey, string>;

const enMessages = {
	'error.apiKeyRequired': 'Please set the DeepSeek API key.',
	'error.unknown': 'Unknown error',
	'response.errorWithReason': 'Request error: {0}',
	'error.requestNotification': 'DeepSeek Code Generator: {0}',
	'response.parseError': 'Request error: failed to parse response',
	'response.userStopped': 'User stopped the request',
	'response.requestFailed': 'Request failed',
	'response.maxTokensReached': 'The response stopped because it reached the configured max token limit. Increase DeepSeek: Max Tokens in Settings and try again.',
	'warning.noActiveEditor': 'No active editor.',
	'warning.noSelectedCode': 'Please select code first.',
	'warning.noResponseContent': 'No response content available.',
	'warning.copyResponseFailed': 'Failed to copy response.',
	'info.apiKeyMissing': 'API keys are not set. Click here to configure them.',
	'action.openSettings': 'Open Settings',
	'input.prompt.question': 'Please enter your question',
	'tree.settingsLabel': 'DeepSeek Settings',
	'info.apiKeyUpdated': 'DeepSeek API key updated!',
	'info.responseCopied': 'Response copied.',
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
	'webview.model.label': 'Model',
	'webview.action.copyResponse': 'Copy',
	'webview.action.insertResponse': 'Insert',
	'webview.action.replaceSelection': 'Replace',
	'webview.action.newFile': 'New File',
	'webview.action.send': 'Send',
	'webview.input.placeholder': 'Input your question, e.g. Generate a countdown JavaScript code...',
	'webview.confirm.clearHistory': 'Are you sure you want to clear all chat history? This action cannot be undone.',
	'action.yes': 'Yes',
	'action.no': 'No'
} as const;

const zhCNMessages: MessageTable = {
	'error.apiKeyRequired': '请先配置 DeepSeek API Key。',
	'error.unknown': '未知错误',
	'response.errorWithReason': '请求出错：{0}',
	'error.requestNotification': 'DeepSeek Code Generator：{0}',
	'response.parseError': '请求出错：解析响应失败',
	'response.userStopped': '用户已停止请求',
	'response.requestFailed': '请求失败',
	'response.maxTokensReached': '回复已达到当前最大输出长度限制。请在设置中调高 DeepSeek: Max Tokens 后重试。',
	'warning.noActiveEditor': '没有活动的编辑器。',
	'warning.noSelectedCode': '请先选中代码。',
	'warning.noResponseContent': '暂无可用回复内容。',
	'warning.copyResponseFailed': '复制回复失败。',
	'info.apiKeyMissing': '尚未配置 API Key，点击此处前往设置。',
	'action.openSettings': '打开设置',
	'input.prompt.question': '请输入你的问题',
	'tree.settingsLabel': 'DeepSeek 设置',
	'info.apiKeyUpdated': 'DeepSeek API Key 已更新！',
	'info.responseCopied': '回复已复制。',
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
	'webview.model.label': '模型',
	'webview.action.copyResponse': '复制',
	'webview.action.insertResponse': '插入',
	'webview.action.replaceSelection': '替换',
	'webview.action.newFile': '新建文件',
	'webview.action.send': '发送',
	'webview.input.placeholder': '请输入你的问题，如：生成一个倒计时的 JavaScript 代码……',
	'webview.confirm.clearHistory': '确定要清除所有聊天历史吗？此操作不可恢复。',
	'action.yes': '是',
	'action.no': '否'
};

const languageTables: Record<string, MessageTable> = {
	en: enMessages,
	'zh-cn': zhCNMessages
};

const languageAliases: Record<string, string> = {
	en: 'en',
	'en-us': 'en',
	'en-gb': 'en',
	zh: 'zh-cn',
	'zh-cn': 'zh-cn',
	'zh-sg': 'zh-cn',
	'zh-hans': 'zh-cn'
};

function getMessages(language: string | undefined): MessageTable {
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

function format(template: string, args: Array<string | number>): string {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		const argIndex = Number(index);
		const value = args[argIndex];
		return value !== undefined ? String(value) : match;
	});
}

export function localize(key: MessageKey, fallback: string, ...args: Array<string | number>): string {
	const messages = getMessages(vscode.env.language);
	const template = messages[key] ?? fallback;
	return args.length ? format(template, args) : template;
}
