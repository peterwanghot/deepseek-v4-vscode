"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const path = require("path");
const os = require("os"); // 引入 os 模块
// import { v4 as uuidv4 } from './uuid';
let curUUID = '';
let stopRequest = false;
const apiDeepseekV3URL = 'https://api.deepseek.com/beta/completions';
const apiDeepseekV3SiliconflowURL = 'https://api.siliconflow.cn/v1/chat/completions';
const apiDeepseekV3VolcengineURL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
function getDeepSeekRequestURL() {
    const apiKeyType = vscode.workspace.getConfiguration('deepseek').get('provider');
    if (apiKeyType === 'deepseek') {
        return apiDeepseekV3URL;
    }
    else if (apiKeyType === 'siliconflow') {
        return apiDeepseekV3SiliconflowURL;
    }
    else if (apiKeyType === 'volcengine') {
        return apiDeepseekV3VolcengineURL;
    }
    else {
        return apiDeepseekV3URL;
    }
}
;
function getModelRequestConfig(prompt = '') {
    const provider = vscode.workspace.getConfiguration('deepseek').get('provider');
    if (provider === 'deepseek') {
        return {
            model: 'deepseek-chat',
            prompt: prompt,
            max_tokens: 1280,
            temperature: 0,
            stream: true
        };
    }
    else if (provider === 'siliconflow') {
        return { model: "deepseek-ai/DeepSeek-V3", messages: [{ role: "user", content: prompt }], stream: true, max_tokens: 1280, stop: ["null"], temperature: 0.7, top_p: 0.7, top_k: 50, frequency_penalty: 0.5, n: 1, response_format: { "type": "text" }, tools: [{ type: "function", function: { description: "<string>", name: "<string>", parameters: {}, strict: false } }] };
    }
    else if (provider === 'volcengine') {
        return {
            model: 'ep-20250218142437-9k5tv',
            messages: [{ role: "user", content: prompt }],
            max_tokens: 512,
            temperature: 0,
            stream: true
        };
    }
    else {
        return {
            model: 'deepseek-chat',
            prompt: prompt,
            max_tokens: 1280,
            temperature: 0,
            stream: true
        };
    }
}
;
function getModelResponseContent(jsonData) {
    var _a, _b, _c;
    const provider = vscode.workspace.getConfiguration('deepseek').get('provider');
    if (provider === 'deepseek') {
        return ((_a = jsonData.choices[0]) === null || _a === void 0 ? void 0 : _a.text) || '';
    }
    else if (provider === 'siliconflow') {
        return jsonData.choices[0].message.content || '';
    }
    else if (provider === 'volcengine') {
        return ((_c = (_b = jsonData.choices[0]) === null || _b === void 0 ? void 0 : _b.delta) === null || _c === void 0 ? void 0 : _c.content) || '';
    }
    else {
        return jsonData.choices[0].text;
    }
}
// 获取 deepseek 回复 非流式
function getDeepSeekResponseNoStream(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const apiKey = vscode.workspace.getConfiguration('deepseek').get('apiKey');
        console.log('DeepSeek 请求开始');
        curUUID = crypto.randomUUID();
        try {
            const response = yield fetch(getDeepSeekRequestURL(), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(getModelRequestConfig(prompt))
            });
            const data = yield response.json();
            const fullResponse = ((_a = data.choices[0]) === null || _a === void 0 ? void 0 : _a.text) || '';
            return fullResponse;
        }
        catch (error) {
            console.error('DeepSeek 请求失败:', error);
        }
        return '';
    });
}
// 获取 DeepSeek 回复
function getDeepSeekResponse(viewProvider, prompt, onProgress) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const apiKey = vscode.workspace.getConfiguration('deepseek').get('apiKey');
        console.log('DeepSeek 请求开始');
        viewProvider.showLoading(true);
        curUUID = crypto.randomUUID();
        let fullResponse = '';
        try {
            const response = yield fetch(getDeepSeekRequestURL(), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(getModelRequestConfig(prompt))
            });
            const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = yield reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    if (line.includes('error') || line.includes('50501')) {
                        const jsonData = JSON.parse(line);
                        if (jsonData.error) {
                            fullResponse += '\n\nRequest error:' + jsonData.error.message;
                            console.error('Request error:', jsonData.error.message);
                            vscode.window.showErrorMessage('DeepSeek Code Generator:' + jsonData.error.message);
                        }
                        else if (jsonData.message) {
                            fullResponse += '\n\nRequest error:' + jsonData.message;
                            console.error('Request error:', jsonData.message);
                            vscode.window.showErrorMessage('DeepSeek Code Generator:' + jsonData.message);
                        }
                        else {
                            fullResponse += '\n\nRequest error:' + JSON.stringify(jsonData);
                            console.error('Request error:', jsonData);
                            vscode.window.showErrorMessage('DeepSeek Code Generator:' + JSON.stringify(jsonData));
                        }
                        onProgress(fullResponse);
                        break;
                    }
                    if (line.includes('[DONE]')) {
                        break;
                    }
                    if (line.startsWith('data: ')) {
                        const jsonData = JSON.parse(line.slice(6));
                        const text = getModelResponseContent(jsonData);
                        fullResponse += text;
                        if (stopRequest) {
                            fullResponse += '\n\nUser stop request';
                            onProgress(fullResponse);
                            stopRequest = false;
                            reader === null || reader === void 0 ? void 0 : reader.cancel();
                            break;
                        }
                        onProgress(fullResponse);
                    }
                }
            }
            viewProvider.showLoading(false);
            stopRequest = false;
        }
        catch (error) {
            console.error('DeepSeek 请求失败:', error);
            viewProvider.showLoading(false);
            onProgress('Request failed');
            stopRequest = false;
        }
    });
}
// 激活插件
function activate(context) {
    // 注册 Webview View
    // 获取设置中的 API 密钥
    const apiKey = vscode.workspace.getConfiguration('deepseek').get('apiKey');
    if (!apiKey) {
        vscode.window.showInformationMessage('API keys are not set. Click here to set.', { modal: true }, 'Open Settings').then((selection) => {
            if (selection === 'Open Settings') {
                // 打开设置界面，让用户设置 API 密钥
                vscode.commands.executeCommand('workbench.action.openSettings', 'Deepseek');
            }
        });
    }
    // if (!apiKeyDeepseek) {
    // 	vscode.window.showInformationMessage(
    // 		'DeepSeek API 密钥未设置。点击这里设置。',
    // 		{ modal: true },
    // 		'打开设置'
    // 	).then((selection) => {
    // 		if (selection === '打开设置') {
    // 			// 打开设置界面，让用户设置 API 密钥
    // 			vscode.commands.executeCommand('workbench.action.openSettings', 'deepseek.apiKey');
    // 		}
    // 	});
    // }
    console.log('DeepSeek 插件注册Webview视图');
    const viewProvider = new DeepSeekWebviewProvider(context);
    vscode.window.registerWebviewViewProvider('deepseekView', viewProvider);
    console.log('DeepSeek 插件注册Command');
    // 注册命令，触发与 DeepSeek 的交互
    let disposable = vscode.commands.registerCommand('extension.deekseek', () => __awaiter(this, void 0, void 0, function* () {
        // 获取用户输入
        const input = yield vscode.window.showInputBox({ prompt: 'Please enter your question' });
        if (input) {
            // viewProvider.showLoading(true);  // 显示加载提示
            let currentResponse = '';
            vscode.commands.executeCommand('workbench.view.extension.deepseekContainer');
            getDeepSeekResponse(viewProvider, input, (text) => {
                currentResponse = text;
                viewProvider.addToHistory(input, currentResponse);
                viewProvider.updateWebView(true);
            });
            // const response = await getDeepSeekResponseNoStream(input);
            // viewProvider.showLoading(false); // 隐藏加载提示
            // viewProvider.addToHistory(input, response);
            // viewProvider.updateWebView();
        }
    }));
    // context.subscriptions.push(disposable);
    console.log('DeepSeek 插件注册切换到活动栏视图的命令');
    // 注册切换到活动栏视图的命令
    let toggleToDeepSeekViewDisposable = vscode.commands.registerCommand('extension.toggleToDeepseekView', () => {
        // 尝试激活 DeepSeek 活动栏视图
        vscode.commands.executeCommand('workbench.view.extension.deepseekContainer');
    });
    console.log('DeepSeek 插件注册打开 API 密钥设置的命令');
    let openApiKeySettings = vscode.commands.registerCommand('extension.openDeepseekApiKeySettings', () => {
        // 打开 VS Code 设置页面
        vscode.commands.executeCommand('workbench.action.openSettings', 'deepseek');
    });
    // 添加视图到活动栏
    const view = vscode.window.createTreeView('deepseekExplorer', {
        treeDataProvider: {
            getChildren: () => {
                return [];
            },
            getTreeItem: () => {
                return {
                    label: 'DeepSeek Settings',
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    contextValue: 'DeepSeekItem'
                };
            }
        }
    });
    context.subscriptions.push(disposable, toggleToDeepSeekViewDisposable, openApiKeySettings, view);
    // 监听 API 密钥设置变化
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('deepseek.apiKey')) {
            const apiKey = vscode.workspace.getConfiguration('deepseek').get('apiKey');
            if (apiKey) {
                const apiKeyType = vscode.workspace.getConfiguration('deepseek').get('provider');
                vscode.window.showInformationMessage(apiKeyType + ' API Key Update！');
            }
        }
    });
    console.log('DeepSeek 插件已激活');
}
// Webview 提供者类
class DeepSeekWebviewProvider {
    constructor(context) {
        this._panelContent = '';
        this._chatHistory = [];
        this._mediaDir = '';
        this._system = '';
        this._isDarkTheme = false;
        this._context = context;
    }
    resolveWebviewView(webviewView) {
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
        // 检查系统类型
        const systemPlatform = os.platform(); // 获取当前操作系统
        // 显示系统类型信息（可选）
        // vscode.window.showInformationMessage(`当前操作系统: ${systemPlatform}`);
        // 根据系统平台执行不同操作
        // if (systemPlatform === 'win32') {
        // 	console.log('在 Windows 系统上');
        // } else if (systemPlatform === 'darwin') {
        // 	console.log('在 macOS 系统上');
        // } else if (systemPlatform === 'linux') {
        // 	console.log('在 Linux 系统上');
        // }
        // 获取当前激活的主题
        const activeTheme = vscode.window.activeColorTheme;
        if (activeTheme.kind === vscode.ColorThemeKind.Dark) {
            this._isDarkTheme = true;
        }
        else {
            this._isDarkTheme = false;
        }
        this._system = systemPlatform;
        // 设置 Webview 的 HTML 内容
        this.updateWebView();
        // 监听来自 WebView 的消息
        this._view.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'askDeepSeek':
                    this.handleAskDeepSeek(message.text);
                    return;
                case 'stopGeneration':
                    stopRequest = true;
                    return;
            }
        }, undefined, this._context.subscriptions);
    }
    // 处理来自 WebView 的消息
    handleAskDeepSeek(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            let currentResponse = '';
            getDeepSeekResponse(this, prompt, (text) => {
                currentResponse = text;
                this.addToHistory(prompt, currentResponse);
                this.updateWebView(true);
            });
        });
    }
    updateWebView(showLoading = false) {
        if (this._view) {
            const chatHistoryHTML = this._chatHistory.map((entry) => {
                return `
			  <div><strong>You:</strong> <pre>${entry.user}</pre></div>
			  <div><strong>DeepSeek:</strong> <pre><code>${this.formatCode(entry.DeepSeek)}</code></pre></div>
			`;
            }).join('');
            // const mediaPath = vscode.Uri.joinPath(this._context.extensionUri, 'media');
            const sysType = this._system;
            const isDark = this._isDarkTheme;
            this._panelContent = `
			<html>
			  <head>
				<style>
				  body {
					font-family: Arial, sans-serif;
					margin: 0;
					padding: 0;
					display: flex;
					flex-direction: column;
					height: 100vh;
				  }
				  #chatContainer {
					flex-grow: 1;
					overflow-y: auto;
					padding: 20px;
					flex-basis: 0;
					flex: 1;
				  }
				  pre {
					background-color: #2e2e2e;
					color: #f1f1f1;
					padding: 15px;
					border-radius: 5px;
					white-space: pre-wrap;
					word-wrap: break-word;
					margin-top: 15px;
					font-size: 14px;
				  }
				  code {
					display: block;
					padding: 5px;
					background: transparent;
					font-family: 'Courier New', monospace;
					font-size: 14px;
				  }
				  textarea {
					padding: 10px;
					width: calc(100% - 20px);
					border-radius: 5px;
					outline: none;
					resize: none;  /* 禁止手动调整大小 */
					overflow: hidden; /* 隐藏滚动条 */
					font-size: 12px;
					border: none;
					background: var(--vscode-textCodeBlock-background);
					caret-color: ${isDark ? 'white' : 'black'}; /* 设置光标颜色为白色 */
					color: ${isDark ? 'white' : 'black'};
				  }
				  textarea:focus {
					outline: 1px solid var(--vscode-focusBorder);
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
					justify-content: space-between;
					padding: 10px;
					border-top: 1px solid var(--vscode-disabledForeground);
				  }
					/* 生成中提示布局 */
				#progressContainer {
					display: flex;
					justify-content: space-between;
					padding: 10px;
					align-items: center;
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
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${isDark ? 'dark' : 'default'}.min.css">
				<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
			  </head>
			  <body>
				<div id="chatContainer">
				  <div>
				 <div class="icon-back">
<svg fill="currentColor" fill-rule="evenodd" style="flex:none;line-height:1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"></path></svg>
				  
				  </div>
				  <h2 class="dark">DeepSeek</h2>
				  <div class="tip-wrap">
				  	<div class="tip">
						<span>AI Chat&nbsp;&nbsp;</span>
						<span class="menu-button ${isDark ? 'dark' : ''}">${sysType === 'darwin' ? '⌘' : 'Ctrl'}</span>
						<span class="menu-button ${isDark ? 'dark' : ''}">${sysType === 'darwin' ? '⇧' : 'Alt'}</span>
						<span class="menu-button ${isDark ? 'dark' : ''}">V</span></div></div> 
				  </div>
				  <div id="chatHistory">
					${chatHistoryHTML}
				  </div>
				</div>
				<!-- 新增的进度和停止按钮区域 -->
          <div id="progressContainer" style="display: ${showLoading ? 'flex' : 'none'};">
		    <div class="block-flex">
			<div class="circle-loader" id="progressCircle"></div>
			<div >生成中</div>
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
			<div>停止</div>
			</div>
            
            
          </div>
				<div id="inputContainer">
            <textarea id="inputField" placeholder="Input your question, eg: Generate a countdown JavaScript code..." rows="2"></textarea>
          </div>
				<script>
				  const vscode = acquireVsCodeApi();
	// 动态调整输入框高度
            const textarea = document.getElementById('inputField');
            textarea.addEventListener('input', () => {
              textarea.style.height = 'auto';  // 重置高度
              textarea.style.height = textarea.scrollHeight + 'px';  // 设置为实际内容高度
            });
				  // 向插件发送请求
				  function askDeepSeek() {
					const inputText = document.getElementById('inputField').value;
					if (inputText) {
					  document.getElementById('inputField').disabled = true;
					  document.getElementById('progressContainer').style.display = 'flex'; // 显示进度条
                document.getElementById('stopButton').style.display = 'block'; // 显示停止按钮
					//   document.getElementById('askBtn').disabled = true;
				      // 替换按钮为圆环加载进度
					//   const askBtn = document.getElementById('askBtn');
					//   askBtn.innerHTML = '<div class="circle-loader"></div>';  // 设置为圆环进度条
					  vscode.postMessage({ command: 'askDeepSeek', text: inputText });
					}
				  }

				  // 停止生成
            document.getElementById('stopButtonBlock').addEventListener('click', () => {
              // 可以在这里发送请求到插件端停止请求（需要后端插件支持停止请求的功能）
              document.getElementById('progressContainer').style.display = 'none'; // 隐藏进度条
              document.getElementById('inputField').disabled = false;
              textarea.value = ""; // 清空输入框
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
					  document.getElementById('progressContainer').style.display = 'none'; // 隐藏进度条
					//   document.getElementById('askBtn').disabled = false;
					  // 恢复按钮
                	//   document.getElementById('askBtn').innerHTML = '提问';
					}else if(message.command === 'showLoading'){
						document.getElementById('inputField').disabled = true;
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
    formatCode(input) {
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
    showLoading(isLoading) {
        if (this._view) {
            if (isLoading) {
                this._view.webview.postMessage({ command: 'showLoading' });
            }
            else {
                this._view.webview.postMessage({ command: 'hideLoading' });
            }
        }
    }
    // 添加到对话历史
    addToHistory(userText, DeepSeekResponse) {
        const chatHistory = this._chatHistory;
        let flag = false;
        chatHistory.map((item) => {
            if (item.uuid === curUUID) {
                flag = true;
                item.DeepSeek = DeepSeekResponse;
                return;
            }
        });
        if (!flag) {
            this._chatHistory.push({ user: userText, DeepSeek: DeepSeekResponse, uuid: curUUID });
        }
        // 保持历史记录数量不超过 50 条
        if (this._chatHistory.length > 50) {
            this._chatHistory.shift();
        }
    }
}
// 卸载插件时清理资源
function deactivate() { }
//# sourceMappingURL=extension.js.map