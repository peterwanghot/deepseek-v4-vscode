# DeepSeek Code Generator / DeepSeek 代码生成器

DeepSeek Code Generator 是一个 VS Code 编程助手插件，支持在侧边栏中与 DeepSeek 对话，并围绕选中代码进行解释、修复、重构、生成注释、生成测试和代码审查。

**重磅更新：全面支持 DeepSeek V4 接入。**

DeepSeek Code Generator is a VS Code assistant extension for chatting with DeepSeek in the sidebar and working with selected code: explain, fix, refactor, comment, test, and review.

**Major update: full support for DeepSeek V4 integration.**

- [中文说明](#中文说明)
- [English](#english)

---

## 中文说明

### 核心功能

- **侧边栏对话**：点击 VS Code 左侧边栏的 DeepSeek 图标即可打开插件。
- **代码解析**：选中代码后让 DeepSeek 解释代码行为、关键控制流和潜在问题。
- **代码审查**：针对选中代码输出按严重程度排序的审查结果。
- **代码修复**：对选中代码进行 bug 修复，并优先返回修复后的代码。
- **回复操作**：AI 回复支持一键复制、插入到光标位置、替换当前选区、新建文件。
- **聊天历史**：支持查看最近 10 条对话，并可清除历史。
- **可配置模型**：支持配置 API Key、Base URL、模型和最大输出 token 数。
- **语言跟随**：默认根据 VS Code 当前显示语言回复，代码、标识符、命令和路径保持原样。

### 界面截图

#### 01. 主界面（新对话界面）

点击左侧边栏的 DeepSeek 图标开启插件。插件界面右上角提供最近 10 条对话、设置、新对话按钮。

![主界面（新对话界面）](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/01.png)

#### 02. 代码解析

选中代码后，让 DeepSeek 解释代码用途、主要行为、关键控制流和潜在 bug。

![代码解析](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/02.png)

#### 03. 代码审查

对选中代码进行代码审查，按严重程度输出问题、原因和修复建议。

![代码审查](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/03.png)

#### 04. 复制/插入/替换/新建文件按钮

每条 AI 回复右上角提供复制、插入、替换、新建文件按钮。鼠标悬浮时会显示功能提示。

![复制/插入/替换/新建文件按钮](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/04.png)

#### 05. 聊天历史

打开历史面板后，可查看最近 10 条对话，并支持清除全部历史。

![聊天历史](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/05.png)

#### 06. 设置项

在 VS Code 设置中配置 DeepSeek API Key、Base URL、Max Tokens 和模型。

![设置项](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/06.png)

### 安装

1. 打开 VS Code。
2. 进入 **扩展** 视图，或使用快捷键 `Ctrl+Shift+X`。
3. 搜索 **DeepSeek Code Generator**。
4. 点击 **安装**。

### 基本用法

1. 点击左侧边栏的 DeepSeek 图标打开聊天界面。
2. 在输入框中输入问题，点击发送按钮开始对话。
3. 在编辑器中选中代码，右键选择 DeepSeek 相关命令：
   - 解释选中代码
   - 重构选中代码
   - 修复选中代码
   - 为选中代码生成注释
   - 为选中代码生成测试
   - 评审选中代码
4. 在 AI 回复右上角点击操作按钮：
   - **复制**：复制完整 AI 回复到剪贴板。
   - **插入**：把回复内容插入到当前光标位置。
   - **替换**：用回复内容替换当前选区。
   - **新建文件**：将回复内容打开为一个新的未保存文件。

### 快捷键

- `Cmd+Shift+V` / `Ctrl+Alt+V`：打开 DeepSeek 侧边栏。
- `Cmd+Shift+T` / `Ctrl+Alt+T`：触发与 DeepSeek 对话命令。

### 配置

```json
{
  "deepseek.apiKey": "your-api-key-here",
  "deepseek.baseUrl": "https://api.deepseek.com",
  "deepseek.model": "deepseek-v4-flash",
  "deepseek.maxTokens": 4096
}
```

可选模型：

- `deepseek-v4-flash`
- `deepseek-v4-pro`

如果没有使用自定义兼容网关，`deepseek.baseUrl` 保持默认值即可。

### API Key 申请

[https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys "申请 API")

---

## English

### Features

- **Sidebar chat**: Open the extension from the DeepSeek icon in the VS Code Activity Bar.
- **Code explanation**: Explain selected code, important behavior, control flow, and possible issues.
- **Code review**: Review selected code and list findings by severity.
- **Code fixing**: Fix bugs in selected code and return corrected code first.
- **Response actions**: Copy, insert at cursor, replace selection, or create a new file from an AI response.
- **Chat history**: View the latest 10 conversations and clear history when needed.
- **Configurable model**: Configure API Key, Base URL, model, and max tokens.
- **Language matching**: Replies follow the current VS Code display language while preserving code, identifiers, commands, and paths.

### Screenshots

#### 01. New Chat

Open the extension from the DeepSeek icon in the left Activity Bar. The top-right buttons provide recent conversations, settings, and new chat.

![New Chat](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/01.png)

#### 02. Code Explanation

Ask DeepSeek to explain selected code, including behavior, control flow, and possible bugs.

![Code Explanation](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/02.png)

#### 03. Code Review

Review selected code with severity-based findings and suggested fixes.

![Code Review](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/03.png)

#### 04. Response Actions

Each AI response includes action buttons for copy, insert, replace, and new file. Hovering a button shows its tooltip.

![Response Actions](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/04.png)

#### 05. Chat History

Open the history panel to view the latest 10 conversations and clear all history.

![Chat History](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/05.png)

#### 06. Settings

Configure DeepSeek API Key, Base URL, Max Tokens, and model in VS Code Settings.

![Settings](https://raw.githubusercontent.com/peterwanghot/deepseek-v4-vscode/master/media/screenshot/06.png)

### Installation

1. Open VS Code.
2. Go to **Extensions**, or use `Ctrl+Shift+X`.
3. Search for **DeepSeek Code Generator**.
4. Click **Install**.

### Basic Usage

1. Click the DeepSeek icon in the left Activity Bar to open the chat view.
2. Type a prompt and click the send button.
3. Select code in the editor and use the DeepSeek context menu commands:
   - Explain Selected Code
   - Refactor Selected Code
   - Fix Selected Code
   - Generate Comments for Selected Code
   - Generate Tests for Selected Code
   - Review Selected Code
4. Use the action buttons on each AI response:
   - **Copy**: copy the full AI response to the clipboard.
   - **Insert**: insert the response at the current cursor position.
   - **Replace**: replace the current selection with the response.
   - **New File**: open the response as a new unsaved file.

### Keyboard Shortcuts

- `Cmd+Shift+V` / `Ctrl+Alt+V`: open the DeepSeek sidebar.
- `Cmd+Shift+T` / `Ctrl+Alt+T`: trigger the DeepSeek chat command.

### Configuration

```json
{
  "deepseek.apiKey": "your-api-key-here",
  "deepseek.baseUrl": "https://api.deepseek.com",
  "deepseek.model": "deepseek-v4-flash",
  "deepseek.maxTokens": 4096
}
```

Available models:

- `deepseek-v4-flash`
- `deepseek-v4-pro`

Keep `deepseek.baseUrl` unchanged unless you use a compatible custom gateway.

### API Key

Apply for an API key at [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys "Apply API").

---

## 支持与推广

#### **Email**： [dai.david2005@gmail.com](mailto://dai.david2005@gmail.com)

#### 微信

![image](https://i.111666.best/image/4emw83S75jILsJtuybd2ov.png)

#### 打赏通道

![image](https://i.111666.best/image/RCob7GIR7viigc785RHgKh.png)

#### 惊喜预告

##### 本月有一个智能体开发训练营,包含最近最火爆的N8N,保姆级教学

**开营周期**：2025.11.11 - 2025.12.31

##### 训练营介绍

技术更新迭代，怕被行业抛下？智能体特训营带你 50 天掌握核心能力，薪资涨幅 30% 不是梦！从‘技术焦虑’到‘职场竞争力爆棚’，就看你要不要抓住这次机会～

从智能体入门开始教，涵盖智能体入门、n8n、智能体流量、考证等核心模块，从零开始， 没接触过的小伙伴也不用担心！

一天2元钱就能学到当前最前沿的智能体教程，以及实战、考证、变现

![image](https://i.111666.best/image/u6sp7cePcU2SxTpjwVyLfz.png)

![image](https://i.111666.best/image/QVN5UoyKnkx3hRQhGbZSNs.png)
![image](https://i.111666.best/image/JOjN2NxRpz4osEqFQ83k5O.png)
![image](https://i.111666.best/image/9z3tofYeXt7CrzlrQv1XQZ.png)
![image](https://i.111666.best/image/5c7DDE7jXg42m8XYA6XYWo.jpg)

## Support & Promotion

#### **Email**： [dai.david2005@gmail.com](mailto://dai.david2005@gmail.com)

<!-- #### Telegram

![image](https://i.111666.best/image/YNFNyIqBP6OXSjAriY3Mk1.png) -->

<!-- #### Tg Group

![image](https://i.111666.best/image/y1HINyrJjcUyJodDJ1tFxY.png) -->

#### Buy me a coffee

![image](https://i.111666.best/image/50L1eDAhyiWuLUB58j50oq.png)

**My USDT(TRON) Address:TWPocwazdrucz53DDHSTYk8ZZK9aTViw3P**

![image](https://i.111666.best/image/ozGOA21J830HBnPardWTTa.png)

**My Paypal: <dai.david2005@gmail.com>**
