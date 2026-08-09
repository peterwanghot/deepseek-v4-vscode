import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { localize } from './localize';

let curUUID = '';
let stopRequest = false;
let activeAbortController: AbortController | undefined;

const createUUID = () => {
	if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
		return (crypto as any).randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createNonce = () => {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let i = 0; i < 32; i++) {
		nonce += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return nonce;
};

// 获取当前 API 配置
function getApiConfig() {
	const config = vscode.workspace.getConfiguration('deepseek');
	const apiKey = config.get<string>('apiKey') || '';
	const baseUrl = (config.get<string>('baseUrl') || 'https://api.deepseek.com').replace(/\/+$/, '');
	const deepseekModel = config.get<string>('model') || 'deepseek-v4-flash';
	const configuredMaxTokens = config.get<number>('maxTokens') || 4096;
	const maxTokens = Math.max(256, Math.min(8192, Math.floor(configuredMaxTokens)));
	return { apiKey, baseUrl, deepseekModel, maxTokens };
}

function getDeepSeekRequestURL() {
	const { baseUrl } = getApiConfig();
	return `${baseUrl}/chat/completions`;
}

function getResponseLanguageName() {
	const language = vscode.env.language.toLowerCase();
	if (language.startsWith('zh')) {
		return 'Simplified Chinese';
	}
	if (language.startsWith('ja')) {
		return 'Japanese';
	}
	if (language.startsWith('ko')) {
		return 'Korean';
	}
	if (language.startsWith('fr')) {
		return 'French';
	}
	if (language.startsWith('de')) {
		return 'German';
	}
	if (language.startsWith('es')) {
		return 'Spanish';
	}
	if (language.startsWith('pt')) {
		return 'Portuguese';
	}
	if (language.startsWith('ru')) {
		return 'Russian';
	}
	return 'English';
}

function getSystemPrompt() {
	const responseLanguage = getResponseLanguageName();
	return `You are DeepSeek, an AI programming assistant embedded in VS Code.
Respond in ${responseLanguage}, matching the user's VS Code display language.
Keep code, identifiers, file paths, commands, API names, and error messages in their original form unless the user asks to translate them.
For code tasks, be concise, actionable, and prefer returning usable code first when the user asks for fixes, refactors, comments, or tests.`;
}

function getModelRequestConfig(prompt: string = '') {
	const { deepseekModel, maxTokens } = getApiConfig();
	return {
		model: deepseekModel,
		messages: [
			{ role: "system", content: getSystemPrompt() },
			{ role: "user", content: prompt }
		],
		max_tokens: maxTokens,
		temperature: 0,
		stream: true
	};
};

function getModelResponseContent(jsonData: any) {
	return jsonData.choices?.[0]?.delta?.content || jsonData.choices?.[0]?.message?.content || '';
}

function getModelFinishReason(jsonData: any) {
	return jsonData.choices?.[0]?.finish_reason || jsonData.choices?.[0]?.finishReason || '';
}

// 获取 deepseek 回复 非流式
// async function getDeepSeekResponseNoStream(prompt: string) {
// 	const apiKey = vscode.workspace.getConfiguration('deepseek').get<string>('apiKey');
// 	console.log('DeepSeek 请求开始');
// 	curUUID = crypto.randomUUID();
// 	try {
// 		const response = await fetch(getDeepSeekRequestURL(), {
// 			method: 'POST',
// 			headers: {
// 				'Authorization': `Bearer ${apiKey}`,
// 				'Content-Type': 'application/json'
// 			},
// 			body: JSON.stringify(getModelRequestConfig(prompt))
// 		});
// 		const data = await response.json();
// 		const fullResponse = (data as any).choices[0]?.text || '';
// 		return fullResponse;
// 	} catch (error) {
// 		console.error('DeepSeek 请求失败:', error);
// 	}
// 	return '';
// }

// 获取 DeepSeek 回复
async function getDeepSeekResponse(viewProvider: DeepSeekWebviewProvider, prompt: string, onProgress: (text: string) => void) {
	const { apiKey } = getApiConfig();

	if (!apiKey) {
		vscode.window.showErrorMessage(
			localize('error.apiKeyRequired', 'Please set the DeepSeek API key.')
		);
		return;
	}

	console.log('DeepSeek 请求开始');
	viewProvider.showLoading(true);
	curUUID = createUUID();
	let fullResponse = '';
	activeAbortController?.abort();
	const abortController = new AbortController();
	activeAbortController = abortController;

	try {
		const response = await fetch(getDeepSeekRequestURL(), {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(getModelRequestConfig(prompt)),
			signal: abortController.signal
		});
		if (!response.ok) {
			const errorText = await response.text();
			const errorMessage = errorText || `${response.status} ${response.statusText}`;
			fullResponse += `\n\n${localize('response.errorWithReason', 'Request error: {0}', errorMessage)}`;
			onProgress(fullResponse);
			vscode.window.showErrorMessage(
				localize('error.requestNotification', 'DeepSeek Code Generator: {0}', errorMessage)
			);
			viewProvider.showLoading(false);
			stopRequest = false;
			return;
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Response body is empty');
		}
		const decoder = new TextDecoder();
		let streamBuffer = '';
		let shouldStopReading = false;

		const processStreamLine = async (line: string): Promise<boolean> => {
			const trimmedLine = line.trim();
			if (!trimmedLine) {
				return true;
			}
			if (trimmedLine.includes('[DONE]')) {
				return false;
			}
			if (trimmedLine.startsWith(':') || trimmedLine.startsWith('event:')) {
				return true;
			}
			const payload = trimmedLine.startsWith('data:')
				? trimmedLine.slice(5).trim()
				: trimmedLine;
			if (!payload) {
				return true;
			}
			try {
				const jsonData = JSON.parse(payload);
				if (jsonData.error || jsonData.code === '50501') {
					const requestErrorMessage = jsonData.error?.message || jsonData.message || JSON.stringify(jsonData);
					fullResponse += `\n\n${localize('response.errorWithReason', 'Request error: {0}', requestErrorMessage)}`;
					console.error('Request error:', requestErrorMessage);
					vscode.window.showErrorMessage(
						localize('error.requestNotification', 'DeepSeek Code Generator: {0}', requestErrorMessage)
					);
					onProgress(fullResponse);
					await reader.cancel();
					return false;
				}
				const text = getModelResponseContent(jsonData);
				const finishReason = getModelFinishReason(jsonData);
				if (!text && !finishReason && !stopRequest) {
					return true;
				}
				fullResponse += text;

				if (finishReason === 'length') {
					fullResponse += `\n\n${localize('response.maxTokensReached', 'The response stopped because it reached the configured max token limit. Increase DeepSeek: Max Tokens in Settings and try again.')}`;
					onProgress(fullResponse);
					return false;
				}

				if (stopRequest) {
					fullResponse += `\n\n${localize('response.userStopped', 'User stopped the request')}`;
					onProgress(fullResponse);
					stopRequest = false;
					abortController.abort();
					await reader.cancel();
					return false;
				}
				onProgress(fullResponse);
			} catch (parseError) {
				console.error('解析响应时失败:', parseError);
			}
			return true;
		};

		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			streamBuffer += decoder.decode(value, { stream: true });
			const lines = streamBuffer.split(/\r?\n/);
			streamBuffer = lines.pop() || '';

			for (const line of lines) {
				if (!(await processStreamLine(line))) {
					shouldStopReading = true;
					break;
				}
			}
			if (shouldStopReading) {
				break;
			}
		}

		streamBuffer += decoder.decode();
		if (streamBuffer.trim() && !shouldStopReading) {
			const remainingLines = streamBuffer.split(/\r?\n/);
			for (const line of remainingLines) {
				if (!(await processStreamLine(line))) {
					break;
				}
			}
		}

		viewProvider.showLoading(false);
		stopRequest = false;


	} catch (error) {
		if (abortController.signal.aborted) {
			viewProvider.showLoading(false);
			stopRequest = false;
			return;
		}
		console.error('DeepSeek 请求失败:', error);
		viewProvider.showLoading(false);
		onProgress(localize('response.requestFailed', 'Request failed'));
		stopRequest = false;
	} finally {
		if (activeAbortController === abortController) {
			activeAbortController = undefined;
		}
	}
}

// 激活插件
export function activate(context: vscode.ExtensionContext) {
	// 注册 Webview View	
	// 获取设置中的 API 密钥

	const { apiKey } = getApiConfig();

	if (!apiKey) {
		const configureApiKeyMessage = localize('info.apiKeyMissing', 'API keys are not set. Click here to configure them.');
		const openSettingsLabel = localize('action.openSettings', 'Open Settings');
		vscode.window.showInformationMessage(
			configureApiKeyMessage,
			{ modal: true },
			openSettingsLabel
		).then((selection) => {
			if (selection === openSettingsLabel) {
				// 打开设置界面，让用户设置 API 密钥
				vscode.commands.executeCommand('workbench.action.openSettings', 'Deepseek');
			}
		});
	}

	console.log('DeepSeek 插件注册Webview视图');
	const viewProvider = new DeepSeekWebviewProvider(context);
	vscode.window.registerWebviewViewProvider('deepseekView', viewProvider);

	console.log('DeepSeek 插件注册Command');
	// 注册命令，触发与 DeepSeek 的交互
	let disposable = vscode.commands.registerCommand('extension.deekseek', async () => {
		// 获取用户输入
		const input = await vscode.window.showInputBox({ prompt: localize('input.prompt.question', 'Please enter your question') });

		if (input) {
			// viewProvider.showLoading(true);  // 显示加载提示
			vscode.commands.executeCommand('workbench.view.extension.deepseekContainer');
			viewProvider.askDeepSeek(input);

			// const response = await getDeepSeekResponseNoStream(input);
			// viewProvider.showLoading(false); // 隐藏加载提示
			// viewProvider.addToHistory(input, response);
			// viewProvider.updateWebView();

		}
	});

	const selectionCommandDisposables = ([
		['extension.deepseek.explainSelection', 'explain'],
		['extension.deepseek.refactorSelection', 'refactor'],
		['extension.deepseek.fixSelection', 'fix'],
		['extension.deepseek.generateComments', 'comments'],
		['extension.deepseek.generateTests', 'tests'],
		['extension.deepseek.reviewSelection', 'review']
	] as Array<[string, SelectionPromptAction]>).map(([command, action]) => {
		return vscode.commands.registerCommand(command, async () => {
			const prompt = buildSelectionPrompt(action);
			if (!prompt) {
				return;
			}
			await vscode.commands.executeCommand('workbench.view.extension.deepseekContainer');
			viewProvider.askDeepSeek(prompt);
		});
	});

	// context.subscriptions.push(disposable);
	console.log('DeepSeek 插件注册切换到活动栏视图的命令');
	// 注册切换到活动栏视图的命令
	let toggleToDeepSeekViewDisposable = vscode.commands.registerCommand('extension.toggleToDeepseekView', () => {
		// 尝试激活 DeepSeek 活动栏视图
		vscode.commands.executeCommand('workbench.view.extension.deepseekContainer');
	});

	console.log('DeepSeek 插件注册打开 API 密钥设置的命令');
	// let openApiKeySettings = vscode.commands.registerCommand('extension.openDeepseekApiKeySettings', () => {
	// 	// 打开 VS Code 设置页面
	// 	vscode.commands.executeCommand('workbench.action.openSettings', 'deepseek');
	// });

	// 添加视图到活动栏
	const view = vscode.window.createTreeView('deepseekExplorer', {
		treeDataProvider: {
			getChildren: () => {
				return [];
			},
			getTreeItem: () => {
				return {
					label: localize('tree.settingsLabel', 'DeepSeek Settings'),
					collapsibleState: vscode.TreeItemCollapsibleState.None,
					contextValue: 'DeepSeekItem'
				};
			}
		}
	});

	context.subscriptions.push(disposable, toggleToDeepSeekViewDisposable, view, ...selectionCommandDisposables);

	// 监听 API 密钥设置变化
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('deepseek.apiKey')) {
			const apiKey = vscode.workspace.getConfiguration('deepseek').get<string>('apiKey');
			if (apiKey) {
				vscode.window.showInformationMessage(
					localize('info.apiKeyUpdated', 'DeepSeek API key updated!')
				);
			}
		}
	});
	console.log('DeepSeek 插件已激活');
}

interface IChatEntry {
	user: string,
	DeepSeek: string,
	uuid: string,
	userTimestamp: number,
	deepSeekTimestamp: number
}

interface IChatSession {
	sessionId: string,
	chatList: {
		entry: IChatEntry
	}[],
	timestamp: number
}

type SelectionPromptAction = 'explain' | 'refactor' | 'fix' | 'comments' | 'tests' | 'review';

const selectionPromptLabels: Record<SelectionPromptAction, string> = {
	explain: 'Explain selected code',
	refactor: 'Refactor selected code',
	fix: 'Fix selected code',
	comments: 'Generate comments for selected code',
	tests: 'Generate tests for selected code',
	review: 'Review selected code'
};

const selectionPromptInstructions: Record<SelectionPromptAction, string> = {
	explain: 'Explain what the selected code does. Focus on behavior, important control flow, and any non-obvious details.',
	refactor: 'Refactor the selected code. Keep behavior unchanged unless you explicitly call out a necessary change. Return the improved code and briefly explain the changes.',
	fix: 'Find and fix bugs in the selected code. Return the corrected code first, then briefly explain the issue.',
	comments: 'Add clear, useful comments to the selected code. Avoid noisy comments for obvious lines. Return the commented code.',
	tests: 'Generate focused tests for the selected code. Use the most likely test framework for the language or surrounding code, and mention any assumptions.',
	review: 'Review the selected code for correctness, edge cases, maintainability, performance, and security. Prioritize actionable findings.'
};

function buildSelectionPrompt(action: SelectionPromptAction): string | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage(localize('warning.noActiveEditor', 'No active editor.'));
		return undefined;
	}

	const selection = editor.selection;
	const selectedCode = editor.document.getText(selection);
	if (!selectedCode.trim()) {
		vscode.window.showWarningMessage(localize('warning.noSelectedCode', 'Please select code first.'));
		return undefined;
	}

	const diagnostics = vscode.languages
		.getDiagnostics(editor.document.uri)
		.filter(diagnostic => selection.intersection(diagnostic.range))
		.map(diagnostic => `${vscode.DiagnosticSeverity[diagnostic.severity]}: ${diagnostic.message}`)
		.slice(0, 8);

	const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
	const languageId = editor.document.languageId;
	const diagnosticBlock = diagnostics.length
		? `\nDiagnostics in selection:\n${diagnostics.map(item => `- ${item}`).join('\n')}\n`
		: '';

	return `${selectionPromptInstructions[action]}

File: ${relativePath}
Language: ${languageId}${diagnosticBlock}
Selected code:
\`\`\`${languageId}
${selectedCode}
\`\`\``;
}

function getResponseTextForEditor(response: string): string {
	const codeBlockMatch = response.match(/```[^\n\r]*[\n\r]+([\s\S]*?)```/);
	return (codeBlockMatch?.[1] || response).trim();
}

// Webview 提供者类
const MAX_HISTORY_ROUNDS = 10;

class DeepSeekWebviewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private _context: vscode.ExtensionContext;
	private _panelContent: string = '';
	private _chatHistory: IChatSession[] = [];
	private _mediaDir: string = '';
	private _system: string = '';
	private _isDarkTheme: boolean = false;
	private _currentSessionId: string = createUUID();

	constructor(context: vscode.ExtensionContext) {
		this._context = context;
		// 加载保存的历史记录
		this.loadHistory();
		if (this._chatHistory.length > 0) {
			this._currentSessionId = this._chatHistory[this._chatHistory.length - 1].sessionId;
		}
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this._view = webviewView;

		// 设置 Webview 配置
		this._view.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this._context.extensionUri, 'media')
			]
		};

		// 获取扩展的根目录路径
		const extensionPath = this._context.extensionPath;
		const dirMedia = this._view.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'media', '')));

		this._mediaDir = dirMedia.toString();

		const systemPlatform = os.platform();

		const activeTheme = vscode.window.activeColorTheme;
		if (activeTheme.kind === vscode.ColorThemeKind.Dark) {
			this._isDarkTheme = true;
		} else {
			this._isDarkTheme = false;
		}

		this._system = systemPlatform;
		this.updateWebView();

		this._view.webview.onDidReceiveMessage(
			(message) => {
				switch (message.command) {
					case 'askDeepSeek':
						this.handleAskDeepSeek(message.text);
						return;
					case 'copyResponse':
						this.copyResponse(message.uuid);
						return;
					case 'insertResponse':
						this.insertResponse(message.uuid);
						return;
					case 'replaceSelection':
						this.replaceSelection(message.uuid);
						return;
					case 'newFileFromResponse':
						this.newFileFromResponse(message.uuid);
						return;
					case 'stopGeneration':
						stopRequest = true;
						return;
					case 'clearHistory':
						this.handleClearHistory();
						return;
					case 'switchSession':
						this.switchSession(message.sessionId);
						this.updateWebView();
						return;
					case 'startNewSession':
						this.startNewSession();
						this.updateWebView();
						return;
					case 'refreshView':
						this.updateWebView();
						return;
					case 'openSettings':
						vscode.commands.executeCommand('workbench.action.openSettings', 'Deepseek');
						return;
				}
			},
			undefined,
			this._context.subscriptions
		);
	}

	// 处理来自 WebView 的消息
	private async handleAskDeepSeek(prompt: string) {
		this.askDeepSeek(prompt);
	}

	public async askDeepSeek(prompt: string) {
		let currentResponse = '';
		let lastRenderedResponse = '';
		let updateTimer: ReturnType<typeof setTimeout> | undefined;

		const renderCurrentResponse = (showLoading: boolean) => {
			if (!currentResponse || currentResponse === lastRenderedResponse) {
				return;
			}
			lastRenderedResponse = currentResponse;
			this.addToHistory(prompt, currentResponse);
			this.updateWebView(showLoading);
		};

		const scheduleUpdate = () => {
			if (updateTimer) {
				return;
			}
			updateTimer = setTimeout(() => {
				updateTimer = undefined;
				renderCurrentResponse(true);
			}, 150);
		};

		await getDeepSeekResponse(this, prompt, (text) => {
			if (text === currentResponse) {
				return;
			}
			currentResponse = text;
			scheduleUpdate();
		});

		if (updateTimer) {
			clearTimeout(updateTimer);
			updateTimer = undefined;
		}
		renderCurrentResponse(false);
	}

	updateWebView(showLoading: boolean = false) {
		if (this._view) {
			// const mediaPath = vscode.Uri.joinPath(this._context.extensionUri, 'media');
			const sysType = this._system;
			const isDark = this._isDarkTheme;
			const { deepseekModel } = getApiConfig();
			const activeModel = deepseekModel;
			const codiconUri = this._view.webview.asWebviewUri(
				vscode.Uri.joinPath(this._context.extensionUri, 'media', 'codicon.css')
			);
			const cspSource = this._view.webview.cspSource;
			const nonce = createNonce();

			const styleUri = this._view.webview.asWebviewUri(
				vscode.Uri.joinPath(this._context.extensionUri, 'media', 'style.css')
			);

			const escapeHtml = (value: string) => {
				if (!value) {
					return '';
				}
				return value
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;');
			};

			const localizedStrings = {
				chatHeading: localize('webview.heading', 'DeepSeek'),
				tipLabel: localize('webview.tip.label', 'AI Chat'),
				historyUserLabel: localize('webview.history.userLabel', 'You:'),
				historyAssistantLabel: localize('webview.history.assistantLabel', 'DeepSeek:'),
				historyEmpty: localize('webview.history.empty', 'No history yet'),
				chatUserLabel: localize('webview.chat.userLabel', 'You'),
				chatAssistantLabel: localize('webview.chat.assistantLabel', 'DeepSeek'),
				chatEmpty: localize('webview.chat.empty', 'No messages yet. Start a new conversation.'),
				chatHistoryTooltip: localize('webview.tooltip.chatHistory', 'Chat History'),
				settingsTooltip: localize('webview.tooltip.settings', 'Settings'),
				newChatTooltip: localize('webview.tooltip.newChat', 'New Chat'),
				historyPanelTitle: localize('webview.history.title', 'Latest 10 conversations'),
				historyPanelCloseAria: localize('webview.history.closeAria', 'Close history panel'),
				historyClearAllTitle: localize('webview.history.clearTitle', 'Clear all history'),
				historyClearAllLabel: localize('webview.history.clearLabel', 'Clear all history'),
				generatingLabel: localize('webview.progress.generating', 'Generating'),
				stopLabel: localize('webview.progress.stop', 'Stop'),
				modelLabel: localize('webview.model.label', 'Model'),
				copyResponseLabel: localize('webview.action.copyResponse', 'Copy'),
				insertResponseLabel: localize('webview.action.insertResponse', 'Insert'),
				replaceSelectionLabel: localize('webview.action.replaceSelection', 'Replace'),
				newFileLabel: localize('webview.action.newFile', 'New File'),
				sendLabel: localize('webview.action.send', 'Send'),
				textareaPlaceholder: localize('webview.input.placeholder', 'Input your question, e.g. Generate a countdown JavaScript code...'),
				confirmClearHistory: localize('webview.confirm.clearHistory', 'Are you sure you want to clear all chat history? This action cannot be undone.')
			};

			const scriptStrings = JSON.stringify({
				confirmClearHistory: localizedStrings.confirmClearHistory
			}).replace(/</g, '\\u003c');

			if (!this._currentSessionId && this._chatHistory.length > 0) {
				this._currentSessionId = this._chatHistory[this._chatHistory.length - 1].sessionId;
			}

			// 获取每个会话的最后一次对话
			const recentSessions = this._chatHistory
				.map(session => {
					const lastEntry = session.chatList[session.chatList.length - 1];
					if (!lastEntry) {
						return null;
					}
					return {
						sessionId: session.sessionId,
						uuid: lastEntry.entry.uuid,
						user: lastEntry.entry.user,
						DeepSeek: lastEntry.entry.DeepSeek,
						timestamp: session.timestamp
					};
				})
				.filter(Boolean)
				.sort((a, b) => {
					// 按会话时间戳排序
					const aTime = (a as any).timestamp || 0;
					const bTime = (b as any).timestamp || 0;
					return bTime - aTime;
				})
				.slice(0, MAX_HISTORY_ROUNDS);

			// 格式化时间戳，超过一天显示日期
			const formatTime = (timestamp: number) => {
				const date = new Date(timestamp);
				const now = new Date();
				const diffInMs = now.getTime() - date.getTime();
				const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

				const hours = String(date.getHours()).padStart(2, '0');
				const minutes = String(date.getMinutes()).padStart(2, '0');
				const timeStr = `${hours}:${minutes}`;

				// 如果是今天，只显示时间
				if (diffInDays === 0) {
					return timeStr;
				}

				// 超过一天，根据语言格式化日期
				const language = vscode.env.language.toLowerCase();
				const isChinese = language.startsWith('zh');

				const year = date.getFullYear();
				const month = String(date.getMonth() + 1).padStart(2, '0');
				const day = String(date.getDate()).padStart(2, '0');

				if (isChinese) {
					// 中文格式: YYYY-MM-DD HH:mm
					return `${year}-${month}-${day} ${timeStr}`;
				} else {
					// 英文格式: MM/DD/YYYY HH:mm
					return `${month}/${day}/${year} ${timeStr}`;
				}
			};

			const recentHistoryHTML = recentSessions.length
				? recentSessions.map((entry, index) => {
					if (!entry) {
						return '';
					}
					return `
						<div class="history-item" data-history-uuid="${(entry as any).uuid}" data-session-id="${entry.sessionId}" tabindex="0" role="button">
							<div class="history-item__time">${formatTime((entry as any).timestamp)}</div>
							<div class="history-item__label">${escapeHtml(localizedStrings.historyUserLabel)}</div>
							<div class="history-item__text">${escapeHtml((entry as any).user)}</div>
							<div class="history-item__label">${escapeHtml(localizedStrings.historyAssistantLabel)}</div>
							<div class="history-item__text">${escapeHtml((entry as any).DeepSeek)}</div>
						</div>
					`;
				}).join('')
				: `<div class="history-empty">${escapeHtml(localizedStrings.historyEmpty)}</div>`;

			// 获取当前会话的对话历史
			const currentSession = this._chatHistory.find(session => session.sessionId === this._currentSessionId);
			const currentChatList = currentSession ? currentSession.chatList : [];

			const chatHistoryHTML = currentChatList.length
				? currentChatList.map((chatItem) => {
					const userTime = chatItem.entry.userTimestamp ? formatTime(chatItem.entry.userTimestamp) : '';
					const deepSeekTime = chatItem.entry.deepSeekTimestamp ? formatTime(chatItem.entry.deepSeekTimestamp) : '';
					return `
				  <div class="chat-entry" data-history-uuid="${chatItem.entry.uuid}">
					  <div class="chat-entry__block">
					  <div class="chat-entry__label">${escapeHtml(localizedStrings.chatUserLabel)}</div>
					  <pre>${escapeHtml(chatItem.entry.user)}</pre>
					</div>
					<div class="chat-entry__time">${userTime}</div>
					  <div class="chat-entry__block">
					  <div class="chat-entry__toolbar">
						<div class="chat-entry__label">${escapeHtml(localizedStrings.chatAssistantLabel)}</div>
						<div class="response-actions" data-response-uuid="${chatItem.entry.uuid}">
							<button class="response-action" data-action="copyResponse" title="${escapeHtml(localizedStrings.copyResponseLabel)}" aria-label="${escapeHtml(localizedStrings.copyResponseLabel)}" data-tooltip="${escapeHtml(localizedStrings.copyResponseLabel)}">
								<i class="codicon codicon-copy"></i>
							</button>
							<button class="response-action" data-action="insertResponse" title="${escapeHtml(localizedStrings.insertResponseLabel)}" aria-label="${escapeHtml(localizedStrings.insertResponseLabel)}" data-tooltip="${escapeHtml(localizedStrings.insertResponseLabel)}">
								<i class="codicon codicon-insert"></i>
							</button>
							<button class="response-action" data-action="replaceSelection" title="${escapeHtml(localizedStrings.replaceSelectionLabel)}" aria-label="${escapeHtml(localizedStrings.replaceSelectionLabel)}" data-tooltip="${escapeHtml(localizedStrings.replaceSelectionLabel)}">
								<i class="codicon codicon-replace"></i>
							</button>
							<button class="response-action" data-action="newFileFromResponse" title="${escapeHtml(localizedStrings.newFileLabel)}" aria-label="${escapeHtml(localizedStrings.newFileLabel)}" data-tooltip="${escapeHtml(localizedStrings.newFileLabel)}">
								<i class="codicon codicon-new-file"></i>
							</button>
						</div>
					  </div>
					  <pre style="padding:0"><code>${this.formatCode(chatItem.entry.DeepSeek)}</code></pre>
					</div>
					<div class="chat-entry__time">${deepSeekTime}</div>
				  </div>
				`;
				}).join('')
				: `<div class="empty-state">
					<div class="empty-state__logo">
						<svg fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"></path></svg>
					</div>
					<div class="empty-state__title">${escapeHtml(localizedStrings.chatHeading)}</div>
					<div class="empty-state__text">${escapeHtml(localizedStrings.chatEmpty)}</div>
					<div class="empty-state__shortcut">
						<span class="keycap">${sysType === 'darwin' ? '⌘' : 'Ctrl'}</span>
						<span class="keycap">${sysType === 'darwin' ? '⇧' : 'Alt'}</span>
						<span class="keycap">V</span>
					</div>
				</div>`;

			this._panelContent = `
			<html>
			  <head>
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; font-src ${cspSource}; style-src ${cspSource} https://cdnjs.cloudflare.com 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com;">
				<style>
				  body {
					font-family: Arial, sans-serif;
					margin: 0;
					padding: 0;
					display: flex;
					flex-direction: column;
					height: 100vh;
					overflow: hidden;
					color: var(--vscode-foreground);
					background: var(--vscode-sideBar-background);
				  }
				  .top-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					width: 100%;
					position: relative;
					box-sizing: border-box;
					padding: 10px 12px;
					border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(127,127,127,0.18));
					background: var(--vscode-sideBar-background);
					gap: 8px;
				  }
				  .brand {
					min-width: 0;
					display: flex;
					align-items: center;
					gap: 8px;
				  }
				  .brand__mark {
					width: 28px;
					height: 28px;
					border-radius: 6px;
					display: flex;
					align-items: center;
					justify-content: center;
					color: var(--vscode-button-background);
					background: color-mix(in srgb, var(--vscode-button-background) 14%, transparent);
					flex: none;
				  }
				  .brand__mark svg {
					width: 18px;
					height: 18px;
				  }
				  .brand__copy {
					min-width: 0;
				  }
				  .brand__title {
					font-size: 13px;
					font-weight: 600;
					line-height: 1.2;
				  }
				  .brand__meta {
					margin-top: 1px;
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					max-width: 170px;
				  }
				  #icons {
					display: flex;
					gap: 4px;
					flex: none;
				  }
				  #icons .icon {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					width: 24px;
					height: 24px;
					border-radius: 4px;
					color: var(--vscode-button-secondaryForeground);
					background: transparent;
					text-decoration: none;
					position: relative;
					cursor: pointer;
				  }
				  #icons .icon::after {
					content: attr(data-tooltip);
					position: absolute;
					top: calc(100% + 12px);
					left: 50%;
					transform: translateX(-50%);
					background: var(--vscode-widget-background);
					color: var(--vscode-foreground);
					padding: 4px 8px;
					border-radius: 4px;
					font-size: 11px;
					white-space: nowrap;
					opacity: 0;
					pointer-events: none;
					transition: opacity 0.15s ease;
					box-shadow: 0 2px 6px rgba(0,0,0,0.2);
					z-index: 1000;
				  }
				  #icons .icon::before {
					content: '';
					position: absolute;
					top: 100%;
					left: 50%;
					transform: translateX(-50%);
					border: 4px solid transparent;
					border-bottom-color: var(--vscode-widget-background);
					opacity: 0;
					transition: opacity 0.15s ease;
					z-index: 1000;
				  }
				  #icons .icon:hover::after,
				  #icons .icon:hover::before,
				  #icons .icon:focus-visible::after,
				  #icons .icon:focus-visible::before {
					opacity: 1;
				  }
				  #icons .icon .codicon {
					font-size: 16px;
				  }
				  .history-panel {
					position: absolute;
					top: 48px;
					right: 20px;
					width: 280px;
					max-height: 360px;
					background: var(--vscode-editorWidget-background);
					border: 1px solid var(--vscode-editorWidget-border);
					border-radius: 8px;
					box-shadow: 0 8px 20px rgba(0,0,0,0.2);
					display: none;
					flex-direction: column;
					z-index: 1000;
				  }
				  .history-panel.show {
					display: flex;
				  }
				  .history-panel__header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 10px 12px;
					border-bottom: 1px solid var(--vscode-editorWidget-border);
					font-weight: bold;
				  }
				  .history-close {
					background: none;
					border: none;
					cursor: pointer;
					color: var(--vscode-foreground);
					display: flex;
					align-items: center;
					justify-content: center;
				  }
				  .history-panel__body {
					padding: 10px 12px;
					overflow-y: auto;
					max-height: 300px;
				  }
				  .history-panel__footer {
					padding: 8px 12px;
					border-top: 1px solid var(--vscode-editorWidget-border);
					background: var(--vscode-editorWidget-background);
				  }
				  .clear-all-btn {
					width: 100%;
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 6px;
					padding: 6px 12px;
					background: transparent;
					border: 1px solid var(--vscode-button-dangerBackground);
					border-radius: 4px;
					color: var(--vscode-button-dangerForeground);
					cursor: pointer;
					font-size: 12px;
					transition: background-color 0.15s ease;
				  }
				  .clear-all-btn:hover {
					background: var(--vscode-button-dangerBackground);
					color: var(--vscode-button-dangerForeground);
				  }
				  .clear-all-btn:active {
					opacity: 0.8;
				  }
				  .clear-all-btn .codicon {
					font-size: 14px;
				  }
				  .history-item {
					margin-bottom: 12px;
					padding: 8px 12px 12px 12px;
					border-bottom: 1px solid rgba(255,255,255,0.08);
					cursor: pointer;
					outline: none;
				  }
				  .history-item:last-child {
					border-bottom: none;
					margin-bottom: 0;
					padding-bottom: 0;
				  }
				  .history-item:hover {
					background: rgba(255,255,255,0.04);
				  }
				  .history-item:focus-visible {
					outline: 1px solid var(--vscode-focusBorder);
					border-radius: 4px;
				  }
				  .history-item__time {
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
					margin-bottom: 4px;
					text-align: left;
				  }
				  .history-item__index {
					font-size: 12px;
					color: var(--vscode-descriptionForeground);
					margin-bottom: 4px;
				  }
				  .history-item__label {
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
					margin-top: 6px;
				  }
				  .history-item__text {
					font-size: 12px;
					color: var(--vscode-foreground);
					overflow: hidden;
					display: -webkit-box;
					-webkit-line-clamp: 2;
					-webkit-box-orient: vertical;
					word-break: break-word;
				  }
				  .history-empty {
					font-size: 12px;
					color: var(--vscode-descriptionForeground);
					text-align: center;
					padding: 20px 0;
				  }
				  #chatContainer {
					overflow-y: auto;
					padding: 14px 12px 16px;
					flex-basis: 0;
					flex: 1;
				  }
				  .chat-empty {
					color: var(--vscode-descriptionForeground);
					font-size: 13px;
					padding: 40px 0;
					text-align: center;
				  }
				  .empty-state {
					min-height: 55vh;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					text-align: center;
					color: var(--vscode-descriptionForeground);
					padding: 16px;
					box-sizing: border-box;
				  }
				  .empty-state__logo {
					width: 52px;
					height: 52px;
					border-radius: 8px;
					display: flex;
					align-items: center;
					justify-content: center;
					color: var(--vscode-button-background);
					background: color-mix(in srgb, var(--vscode-button-background) 12%, transparent);
					margin-bottom: 12px;
				  }
				  .empty-state__logo svg {
					width: 32px;
					height: 32px;
				  }
				  .empty-state__title {
					color: var(--vscode-foreground);
					font-size: 16px;
					font-weight: 600;
					margin-bottom: 6px;
				  }
				  .empty-state__text {
					font-size: 12px;
					line-height: 1.45;
					max-width: 260px;
				  }
				  .empty-state__shortcut {
					display: flex;
					align-items: center;
					gap: 4px;
					margin-top: 14px;
				  }
				  .chat-entry {
					border: 1px solid var(--vscode-editorWidget-border, rgba(127,127,127,0.18));
					border-radius: 8px;
					padding: 10px;
					margin-bottom: 12px;
					background: var(--vscode-editorWidget-background);
					transition: border-color 0.2s ease, box-shadow 0.2s ease;
				  }
				  .chat-entry.highlight {
					border-color: var(--vscode-focusBorder);
					box-shadow: 0 0 0 2px rgba(14,99,156,0.3);
				  }
				  .chat-entry__time {
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
					margin: 6px 0;
					text-align: right;
				  }
				  .chat-entry__block + .chat-entry__block {
					margin-top: 12px;
				  }
				  .chat-entry__label {
					font-size: 12px;
					font-weight: bold;
					margin-bottom: 6px;
					color: var(--vscode-descriptionForeground);
				  }
				  .chat-entry__toolbar {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 8px;
				  }
				  .response-actions {
					display: flex;
					align-items: center;
					gap: 4px;
				  }
				  .response-action {
					width: 24px;
					height: 24px;
					border: none;
					border-radius: 4px;
					background: transparent;
					color: var(--vscode-button-secondaryForeground);
					cursor: pointer;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					padding: 0;
					position: relative;
				  }
				  .response-action:hover {
					background: var(--vscode-toolbar-hoverBackground);
				  }
				  .response-action::after {
					content: attr(data-tooltip);
					position: absolute;
					bottom: calc(100% + 8px);
					left: 50%;
					transform: translateX(-50%);
					background: var(--vscode-widget-background);
					color: var(--vscode-foreground);
					padding: 4px 8px;
					border-radius: 4px;
					font-size: 11px;
					white-space: nowrap;
					opacity: 0;
					pointer-events: none;
					transition: opacity 0.15s ease;
					box-shadow: 0 2px 6px rgba(0,0,0,0.2);
					z-index: 1000;
				  }
				  .response-action::before {
					content: '';
					position: absolute;
					bottom: calc(100% + 2px);
					left: 50%;
					transform: translateX(-50%);
					border: 4px solid transparent;
					border-top-color: var(--vscode-widget-background);
					opacity: 0;
					transition: opacity 0.15s ease;
					z-index: 1000;
				  }
				  .response-action:hover::after,
				  .response-action:hover::before,
				  .response-action:focus-visible::after,
				  .response-action:focus-visible::before {
					opacity: 1;
				  }
				  .response-action .codicon {
					font-size: 14px;
				  }
				  
				  pre {
					background-color: var(--vscode-textCodeBlock-background);
					color: var(--vscode-editor-foreground);
					padding: 10px;
					border-radius: 5px;
					white-space: pre-wrap;
					word-wrap: break-word;
					margin: 6px 0 0;
					font-size: 12px;
					line-height: 1.5;
				  }
				  code {
					display: block;
					background: transparent;
					font-family: var(--vscode-editor-font-family, 'Courier New', monospace);
					font-size: 12px;
				  }
				  textarea {
					box-sizing: border-box;
					padding: 9px 10px;
					width: 100%;
					border-radius: 5px;
					outline: none;
					resize: none;  /* 禁止手动调整大小 */
					overflow: hidden; /* 隐藏滚动条 */
					font-size: 12px;
					border: none;
					background: transparent;
					caret-color: ${isDark ? 'white' : 'black'}; /* 设置光标颜色为白色 */
					color: ${isDark ? 'white' : 'black'};
					min-height: 38px;
					max-height: 150px;
				  }
				  textarea:focus {
					outline: none;
				  }		
				  #loading {
					display: none;
					font-size: 18px;
					color: #333;
					margin-top: 20px;
				  }
				  #loading.show {
					display: block;
				  }
				  
				  #inputContainer {
					display: flex;
					align-items: flex-end;
					gap: 8px;
					padding: 10px 12px 12px;
					border-top: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(127,127,127,0.18));
					background: var(--vscode-sideBar-background);
				  }
				  .input-shell {
					display: flex;
					align-items: flex-end;
					width: 100%;
					gap: 8px;
					background: var(--vscode-input-background);
					border: 1px solid var(--vscode-input-border, transparent);
					border-radius: 8px;
					padding: 4px;
					box-sizing: border-box;
				  }
				  .input-shell:focus-within {
					border-color: var(--vscode-focusBorder);
				  }
				  .send-button {
					width: 30px;
					height: 30px;
					border: none;
					border-radius: 6px;
					background: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					cursor: pointer;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					flex: none;
					margin-bottom: 1px;
				  }
				  .send-button:hover {
					background: var(--vscode-button-hoverBackground);
				  }
				  .send-button:disabled {
					cursor: not-allowed;
					opacity: 0.55;
				  }
					/* 生成中提示布局 */
				#progressContainer {
					display: flex;
					justify-content: space-between;
					padding: 8px 12px;
					align-items: center;
					border-top: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(127,127,127,0.18));
					background: var(--vscode-sideBar-background);
					//   border-bottom: 1px solid #ddd;
				}
				.circle-loader {
					border: 2px solid #f3f3f3;
					border-top: 2px solid #4CAF50;
					border-radius: 50%;
					width: 12px;
					height: 12px;
					animation: spin 1s linear infinite;
				}

				/* 停止按钮 */
				.stop-button {
					width: 16px;
					height: 16px;
					line-height: 16px;
					margin-right: -6px;
					//   color: #f44336;
					cursor: pointer;
				}

				#stopButtonBlock{
					cursor:pointer;
				}

				#stopButtonBlock:hover{
					opacity: 0.8;
				}

				/* 定义旋转动画 */
				@keyframes spin {
					0% {
						transform: rotate(0deg);
					}
					100% {
						transform: rotate(360deg);
					}
				}
				.block-flex{
					display: flex;
					gap: 6px;
					align-items: center;
				}
				h2{
				  width: 100%;
				  text-align: center;
				}

				h2.dark {
					color: var(--vscode-disabledForeground);
				}    
				
				.tip-wrap {
					display: flex;
					align-items: center;
					width: 100%;
					font-size: 14px;
					// color: var(--vscode-button-secondaryBackground);
					margin: 0 auto;
					margin-bottom: 12px;
					justify-content: space-around;					
				}
				.tip-wrap .tip {
					display: flex;
					align-items: center;
					color: var(--vscode-disabledForeground);
				}
				.menu-button {
					box-sizing: border-box;
					min-width: 24px;
					height: 24px;
					padding: 0 4px;
					font-size: 16px;
					border-radius: 4px;
					display: flex;
					align-items: center;
					justify-items: center;
					justify-content: space-around;
					margin-right: 4px;
					background-color: rgba(0, 0, 0, 0.04);
				}
				.keycap {
					box-sizing: border-box;
					min-width: 24px;
					height: 24px;
					padding: 0 6px;
					font-size: 11px;
					border-radius: 4px;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					color: var(--vscode-descriptionForeground);
					background-color: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'};
					border: 1px solid var(--vscode-editorWidget-border, rgba(127,127,127,0.18));
				}
				.menu-button.dark {
					background-color: rgba(255, 255, 255, 0.06);
				}    
				.icon-back{
					width: 80px; 
					height: 80px; 
					margin: 0 auto; 
					display: block;
					color: var(--vscode-disabledForeground);
				}
				</style>
				<link rel="stylesheet" href="${styleUri}">
				<link rel="stylesheet" href="${codiconUri}">
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${isDark ? 'dark' : 'default'}.min.css">
				<script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
			  </head>
			  <body>
			  <div class="top-header">
					<div class="brand">
						<div class="brand__mark">
							<svg fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588z"></path></svg>
						</div>
						<div class="brand__copy">
							<div class="brand__title">${escapeHtml(localizedStrings.chatHeading)}</div>
							<div class="brand__meta">${escapeHtml(localizedStrings.modelLabel)} · ${escapeHtml(activeModel)}</div>
						</div>
					</div>
					<div id="icons">
							<a id="historyButton" class="icon" title="${escapeHtml(localizedStrings.chatHistoryTooltip)}" aria-label="${escapeHtml(localizedStrings.chatHistoryTooltip)}" data-tooltip="${escapeHtml(localizedStrings.chatHistoryTooltip)}" role="button" tabindex="0">
								<i class="codicon codicon-history"></i>
							</a>
							<a id="settingsButton" class="icon" title="${escapeHtml(localizedStrings.settingsTooltip)}" aria-label="${escapeHtml(localizedStrings.settingsTooltip)}" data-tooltip="${escapeHtml(localizedStrings.settingsTooltip)}" role="button" tabindex="0">
								<i class="codicon codicon-gear"></i>
							</a>
							<a id="newChatButton" class="icon" title="${escapeHtml(localizedStrings.newChatTooltip)}" aria-label="${escapeHtml(localizedStrings.newChatTooltip)}" data-tooltip="${escapeHtml(localizedStrings.newChatTooltip)}" role="button" tabindex="0">
								<i class="codicon codicon-chat-sparkle"></i>
							</a>
						</div>
						<div id="recentHistoryPanel" class="history-panel" aria-live="polite">
							<div class="history-panel__header">
								<span>${escapeHtml(localizedStrings.historyPanelTitle)}</span>
								<button id="closeHistoryPanel" class="history-close" aria-label="${escapeHtml(localizedStrings.historyPanelCloseAria)}">
									<i class="codicon codicon-close"></i>
								</button>
							</div>
							<div class="history-panel__body">
								${recentHistoryHTML}
							</div>
							<div class="history-panel__footer">
								<button id="clearAllHistoryBtn" class="clear-all-btn" title="${escapeHtml(localizedStrings.historyClearAllTitle)}">
									<i class="codicon codicon-trash"></i>
									<span>${escapeHtml(localizedStrings.historyClearAllLabel)}</span>
								</button>
							</div>
						</div>
					  </div>
				<div id="chatContainer">
				  <div id="chatHistory">
					${chatHistoryHTML}
				  </div>
				</div>
				<!-- 新增的进度和停止按钮区域 -->
          <div id="progressContainer" style="display: ${showLoading ? 'flex' : 'none'};">
		    <div class="block-flex">
			<div class="circle-loader" id="progressCircle"></div>
			<div >${escapeHtml(localizedStrings.generatingLabel)}</div>
			</div>
			<div class="block-flex" id="stopButtonBlock">
			<div class="stop-button" id="stopButton">
			<svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
				<g fill="none" stroke="#D32F2F" stroke-width="2">
					<path d="M6 18L18 6" />
					<path d="M6 6L18 18" />
				</g>
			</svg>
			</div>
			<div>${escapeHtml(localizedStrings.stopLabel)}</div>
			</div>
            
            
          </div>
				<div id="inputContainer">
            <div class="input-shell">
              <textarea id="inputField" placeholder="${escapeHtml(localizedStrings.textareaPlaceholder)}" rows="2"></textarea>
              <button id="sendButton" class="send-button" title="${escapeHtml(localizedStrings.sendLabel)}" aria-label="${escapeHtml(localizedStrings.sendLabel)}">
                <i class="codicon codicon-send"></i>
              </button>
            </div>
          </div>
				<script nonce="${nonce}">
				  const vscode = acquireVsCodeApi();
				  const i18n = ${scriptStrings};
				  const historyButton = document.getElementById('historyButton');
				  const settingsButton = document.getElementById('settingsButton');
				  const newChatButton = document.getElementById('newChatButton');
				  const historyPanel = document.getElementById('recentHistoryPanel');
				  const closeHistoryPanel = document.getElementById('closeHistoryPanel');
				  const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');

				  const toggleHistoryPanel = () => {
					if (!historyPanel) return;
					historyPanel.classList.toggle('show');
				  };

				  const hideHistoryPanel = () => {
					if (!historyPanel) return;
					historyPanel.classList.remove('show');
				  };

				  historyButton?.addEventListener('click', (event) => {
					event.stopPropagation();
					toggleHistoryPanel();
				  });

				  historyButton?.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						event.stopPropagation();
						toggleHistoryPanel();
					}
				  });

				  // 设置按钮点击事件
				  settingsButton?.addEventListener('click', (event) => {
					event.preventDefault();
					event.stopPropagation();
					vscode.postMessage({ command: 'openSettings' });
				  });

				  settingsButton?.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						event.stopPropagation();
						vscode.postMessage({ command: 'openSettings' });
					}
				  });

				  closeHistoryPanel?.addEventListener('click', (event) => {
					event.stopPropagation();
					hideHistoryPanel();
				  });

				  if (clearAllHistoryBtn) {
					clearAllHistoryBtn.addEventListener('click', (event) => {
						event.stopPropagation();
						vscode.postMessage({ command: 'clearHistory' });
						hideHistoryPanel();
					});
				  }

				  historyPanel?.addEventListener('click', (event) => {
					event.stopPropagation();
				  });

				  const startNewSession = () => {
					vscode.postMessage({ command: 'startNewSession' });
					hideHistoryPanel();
				  };

				  newChatButton?.addEventListener('click', (event) => {
					event.preventDefault();
					event.stopPropagation();
					startNewSession();
				  });

				  newChatButton?.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						event.stopPropagation();
						startNewSession();
					}
				  });

				  document.addEventListener('click', (event) => {
					if (!historyPanel || !historyButton) {
						return;
					}
					const target = event.target instanceof Node ? event.target : null;
					if (target && (historyPanel.contains(target) || historyButton.contains(target))) {
						return;
					}
					hideHistoryPanel();
				  });

				  const historyItems = document.querySelectorAll('.history-item');
				  historyItems.forEach((item) => {
					item.addEventListener('click', (event) => {
						event.preventDefault();
						const sessionId = item.dataset.sessionId;
						hideHistoryPanel();
						vscode.postMessage({ command: 'switchSession', sessionId: sessionId });
						// 切换会话后更新视图
						setTimeout(() => {
							vscode.postMessage({ command: 'refreshView' });
						}, 100);
					});
					item.addEventListener('keydown', (event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							const sessionId = item.dataset.sessionId;
							hideHistoryPanel();
							vscode.postMessage({ command: 'switchSession', sessionId: sessionId });
							setTimeout(() => {
								vscode.postMessage({ command: 'refreshView' });
							}, 100);
						}
					});
				  });

				  const responseActionButtons = document.querySelectorAll('.response-action');
				  responseActionButtons.forEach((button) => {
					button.addEventListener('click', (event) => {
						event.preventDefault();
						event.stopPropagation();
						const action = button.dataset.action;
						const uuid = button.closest('.response-actions')?.dataset.responseUuid;
						if (!action || !uuid) {
							return;
						}
						vscode.postMessage({ command: action, uuid: uuid });
					});
				  });
	// 动态调整输入框高度
            const textarea = document.getElementById('inputField');
            const sendButton = document.getElementById('sendButton');
            textarea.addEventListener('input', () => {
              textarea.style.height = 'auto';  // 重置高度
              textarea.style.height = textarea.scrollHeight + 'px';  // 设置为实际内容高度
              if (sendButton) {
                sendButton.disabled = textarea.value.trim().length === 0;
              }
            });
            if (sendButton) {
              sendButton.disabled = true;
            }
				  // 向插件发送请求
				  function askDeepSeek() {
					const inputText = document.getElementById('inputField').value;
					if (inputText) {
					  document.getElementById('inputField').disabled = true;
					  if (sendButton) {
						sendButton.disabled = true;
					  }
					  document.getElementById('progressContainer').style.display = 'flex'; // 显示进度条
                document.getElementById('stopButton').style.display = 'block'; // 显示停止按钮
					//   document.getElementById('askBtn').disabled = true;
				      // 替换按钮为圆环加载进度
					//   const askBtn = document.getElementById('askBtn');
					//   askBtn.innerHTML = '<div class="circle-loader"></div>';  // 设置为圆环进度条
					  vscode.postMessage({ command: 'askDeepSeek', text: inputText });
					}
				  }

				  sendButton?.addEventListener('click', (event) => {
					event.preventDefault();
					askDeepSeek();
				  });

				  // 停止生成
            document.getElementById('stopButtonBlock').addEventListener('click', () => {
              // 可以在这里发送请求到插件端停止请求（需要后端插件支持停止请求的功能）
              document.getElementById('progressContainer').style.display = 'none'; // 隐藏进度条
              document.getElementById('inputField').disabled = false;
              textarea.value = ""; // 清空输入框
              if (sendButton) {
                sendButton.disabled = true;
              }
              console.log('生成请求已停止');
			  vscode.postMessage({ command: 'stopGeneration' });
            });

				  // 监听回车触发提问
            textarea.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // 防止换行
                askDeepSeek();  // 触发提问
              }
            });
	
				  // 高亮显示代码
				  document.addEventListener('DOMContentLoaded', () => {
					const codeBlocks = document.querySelectorAll('pre code');
					codeBlocks.forEach(block => hljs.highlightElement(block));
					// 滚动到底部
					const chatContainer = document.getElementById('chatContainer');
					chatContainer.scrollTop = chatContainer.scrollHeight;
				  });
	
				  // 接收来自插件的消息
				  window.addEventListener('message', (event) => {
					const message = event.data;
					if (message.command === 'hideLoading') {
					  document.getElementById('inputField').disabled = false;
					  if (sendButton) {
						sendButton.disabled = textarea.value.trim().length === 0;
					  }
					  document.getElementById('progressContainer').style.display = 'none'; // 隐藏进度条
					//   document.getElementById('askBtn').disabled = false;
					  // 恢复按钮
                	//   document.getElementById('askBtn').innerHTML = '提问';
					}else if(message.command === 'showLoading'){
						document.getElementById('inputField').disabled = true;
					  if (sendButton) {
						sendButton.disabled = true;
					  }
					  document.getElementById('progressContainer').style.display = 'flex'; // 显示进度条
                document.getElementById('stopButton').style.display = 'block'; // 显示停止按钮
					}
				  });
				</script>
			  </body>
			</html>
		  `;
			this._view.webview.html = this._panelContent;
		}
	}

	// 格式化输出文本（带换行和高亮）
	private formatCode(input: string): string {
		// 防止 HTML 注入，进行字符转义
		let formattedCode = input.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\n/g, "\n");

		// 如果是代码块，添加适当的代码语法标记（例如 'javascript'）
		// 你可以通过语言检测来自动选择代码块类型
		// if (input.length > 0) {
		// 	formattedCode = '```javascript\n' + formattedCode + '\n```';
		// }


		return formattedCode;
	}

	// 显示或隐藏加载状态
	showLoading(isLoading: boolean) {
		if (this._view) {
			if (isLoading) {
				this._view.webview.postMessage({ command: 'showLoading' });
			} else {
				this._view.webview.postMessage({ command: 'hideLoading' });
			}
		}
	}



	// 添加到对话历史
	addToHistory(userText: string, deepSeekResponse: string) {
		// 查找当前会话
		let currentSession = this._chatHistory.find(session => session.sessionId === this._currentSessionId);
		const now = Date.now();

		// 如果当前会话不存在，创建新会话
		if (!currentSession) {
			currentSession = {
				sessionId: this._currentSessionId,
				chatList: [],
				timestamp: now
			};
			this._chatHistory.push(currentSession);
		}

		// 检查是否已存在当前UUID的条目（流式响应中）
		let existingEntry = currentSession.chatList.find(entry => entry.entry.uuid === curUUID);

		if (existingEntry) {
			// 更新现有条目
			existingEntry.entry.DeepSeek = deepSeekResponse;
			existingEntry.entry.deepSeekTimestamp = now;
		} else {
			// 创建新条目
			const newEntry: { entry: IChatEntry } = {
				entry: {
					user: userText,
					DeepSeek: deepSeekResponse,
					uuid: curUUID,
					userTimestamp: now,
					deepSeekTimestamp: now
				}
			};
			currentSession.chatList.push(newEntry);
		}

		// 更新会话的时间戳为最后一次对话的时间
		currentSession.timestamp = now;

		// 保持历史记录最多 10 轮会话
		while (this._chatHistory.length > MAX_HISTORY_ROUNDS) {
			this._chatHistory.shift();
		}

		// 保存历史记录到持久化存储
		this.saveHistory();
	}

	private startNewSession() {
		this._currentSessionId = createUUID();
		// 为新会话创建初始条目，timestamp设置为当前时间
		const newSession = {
			sessionId: this._currentSessionId,
			chatList: [],
			timestamp: Date.now()
		};
		this._chatHistory.push(newSession);
	}

	private switchSession(sessionId: string) {
		if (sessionId && sessionId !== this._currentSessionId) {
			this._currentSessionId = sessionId;
		}
	}

	private findChatEntry(uuid: string): IChatEntry | undefined {
		for (const session of this._chatHistory) {
			const chatItem = session.chatList.find(item => item.entry.uuid === uuid);
			if (chatItem) {
				return chatItem.entry;
			}
		}
		return undefined;
	}

	private getEditorReadyResponse(uuid: string): string | undefined {
		const entry = this.findChatEntry(uuid);
		if (!entry?.DeepSeek?.trim()) {
			vscode.window.showWarningMessage(localize('warning.noResponseContent', 'No response content available.'));
			return undefined;
		}
		return getResponseTextForEditor(entry.DeepSeek);
	}

	private async copyResponse(uuid: string) {
		const entry = this.findChatEntry(uuid);
		const text = entry?.DeepSeek?.trim();
		if (!text) {
			vscode.window.showWarningMessage(localize('warning.noResponseContent', 'No response content available.'));
			return;
		}
		try {
			await vscode.env.clipboard.writeText(text);
			vscode.window.showInformationMessage(localize('info.responseCopied', 'Response copied.'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showWarningMessage(`${localize('warning.copyResponseFailed', 'Failed to copy response.')} ${message}`);
		}
	}

	private async insertResponse(uuid: string) {
		const text = this.getEditorReadyResponse(uuid);
		const editor = vscode.window.activeTextEditor;
		if (!text) {
			return;
		}
		if (!editor) {
			vscode.window.showWarningMessage(localize('warning.noActiveEditor', 'No active editor.'));
			return;
		}
		await editor.edit(editBuilder => {
			editBuilder.insert(editor.selection.active, text);
		});
	}

	private async replaceSelection(uuid: string) {
		const text = this.getEditorReadyResponse(uuid);
		const editor = vscode.window.activeTextEditor;
		if (!text) {
			return;
		}
		if (!editor) {
			vscode.window.showWarningMessage(localize('warning.noActiveEditor', 'No active editor.'));
			return;
		}
		if (editor.selection.isEmpty) {
			vscode.window.showWarningMessage(localize('warning.noSelectedCode', 'Please select code first.'));
			return;
		}
		await editor.edit(editBuilder => {
			editBuilder.replace(editor.selection, text);
		});
	}

	private async newFileFromResponse(uuid: string) {
		const text = this.getEditorReadyResponse(uuid);
		if (!text) {
			return;
		}
		const document = await vscode.workspace.openTextDocument({ content: text });
		await vscode.window.showTextDocument(document, { preview: false });
	}

	// 保存历史记录到全局状态
	private saveHistory() {
		try {
			this._context.globalState.update('deepseek.chatHistory', this._chatHistory);
		} catch (error) {
			console.error('保存历史记录失败:', error);
		}
	}

	// 从全局状态加载历史记录
	private loadHistory() {
		try {
			const savedHistory = this._context.globalState.get('deepseek.chatHistory', []);
			if (Array.isArray(savedHistory)) {
				// 检查是否是旧版本数据结构（扁平结构）
				const firstItem = savedHistory[0] as any;
				const isOldStructure = savedHistory.length > 0 && firstItem && firstItem.user !== undefined && firstItem.DeepSeek !== undefined;

				if (isOldStructure) {
					// 旧版本：扁平结构 [{user, DeepSeek, uuid, sessionId}]
					// 转换为新版本：嵌套结构 [{sessionId, chatList: [{entry: {user, DeepSeek, uuid}}]}]
					const sessionMap = new Map<string, { entry: IChatEntry }[]>();

					savedHistory.forEach((item: any) => {
						const sessionId = item.sessionId || 'default';
						if (!sessionMap.has(sessionId)) {
							sessionMap.set(sessionId, []);
						}
						const itemTimestamp = item.uuid ? parseInt(item.uuid.split('-')[0] || '0') : Date.now();
						sessionMap.get(sessionId)!.push({
							entry: {
								user: item.user || '',
								DeepSeek: item.DeepSeek || '',
								uuid: item.uuid || createUUID(),
								userTimestamp: itemTimestamp,
								deepSeekTimestamp: itemTimestamp
							}
						});
					});

					// 转换为新结构数组
					this._chatHistory = Array.from(sessionMap.entries()).map(([sessionId, chatList]) => {
						const lastEntry = chatList[chatList.length - 1];
						return {
							sessionId,
							chatList,
							timestamp: lastEntry ? lastEntry.entry.deepSeekTimestamp : Date.now()
						};
					}).slice(-MAX_HISTORY_ROUNDS);

					console.log(`数据迁移完成：${savedHistory.length} 条记录迁移到 ${this._chatHistory.length} 个会话`);
				} else {
					// 新版本：嵌套结构
					this._chatHistory = savedHistory.slice(-MAX_HISTORY_ROUNDS).map((session: any) => ({
						sessionId: session.sessionId || createUUID(),
						chatList: Array.isArray(session.chatList) ? session.chatList : [],
						timestamp: session.timestamp || Date.now()
					}));
				}

				if (this._chatHistory.length > 0) {
					this._currentSessionId = this._chatHistory[this._chatHistory.length - 1].sessionId;
				} else {
					this._currentSessionId = createUUID();
				}

				// 保存转换后的数据
				this.saveHistory();
			} else {
				this._currentSessionId = createUUID();
			}
		} catch (error) {
			console.error('加载历史记录失败:', error);
			this._chatHistory = [];
			this._currentSessionId = createUUID();
		}
	}

	// 处理清除历史记录的请求（带确认对话框）
	private async handleClearHistory() {
		const confirmMessage = localize('webview.confirm.clearHistory', 'Are you sure you want to clear all chat history? This action cannot be undone.');
		const yesLabel = localize('action.yes', 'Yes');
		const noLabel = localize('action.no', 'No');

		const selection = await vscode.window.showWarningMessage(
			confirmMessage,
			{ modal: true },
			yesLabel,
			noLabel
		);

		if (selection === yesLabel) {
			this.clearHistory();
		}
	}

	// 清除历史记录
	clearHistory() {
		this._chatHistory = [];
		this.startNewSession();
		this.saveHistory();
		// 立即更新 WebView 以清空显示内容
		this.updateWebView();
	}
}

// 卸载插件时清理资源
export function deactivate() { }
