# 变更记录

## [2.0.0] - 2026-08-09

### 新增

* 支持选中代码后从编辑器右键菜单解释、重构、修复、生成注释、生成测试和代码评审。
* AI 回复支持复制、插入到光标位置、替换当前选区和新建文件。
* 选中代码请求会自动携带文件路径、语言和选区诊断信息。
* 优化侧边栏界面，增加模型状态展示、发送按钮、空状态和更紧凑的消息操作区。
* 新版仅保留官方 DeepSeek API，并新增 `deepseek.baseUrl` 用于兼容自定义网关。
* 增加系统提示词，默认根据 VS Code 当前显示语言回复。

## [1.4.0] - 2026-08-09

### 新增

* 支持官方 DeepSeek V4 模型配置，默认使用 `deepseek-v4-flash`。

### 变更

* 官方 DeepSeek 调用升级为 Chat Completions 接口。

## [1.3.0] - 2025-11-08

### 新增

* 界面支持多语言
* 支持保存会话历史
* UI细节优化

## [1.2.3] - 2025-07-19

### 新增

* 重磅推荐! 斑码云代码平台! claude code免费体验!

## [1.2.1] - 2025-03-25

### 新增

* 增加Ollama和斑码算力云的api调用方式，目前斑码算力云可以免费使用deepseek满血版一个月,重磅推荐

## [1.2.0] - 2025-02-18

### 新增

* 增加硅基流动和火山引擎的api调用方式，目前火山引擎是最稳定的

## [1.1.9] - 2025-02-08

### 新增

* 增加deepseek网络请求错误提示反馈

## [1.1.8] - 2025-02-08

### 修复

* bug fix

## [1.1.3] - 2025-01-28

### 紧急修复

* 修改deepseek调用方式为http方式

## [1.1.0] - 2025-01-28

### 新增

* 对话输出方式更新为流式输出, 更加丝滑

### 修复

* 停止输出按钮不响应的bug

## [1.0.2] - 2025-01-09

### 新增

* README 新增使用截图。

### 修复

* 功能优化。

## [1.0.0] - 2025-01-09

### 新增

* 插件首次发布，支持与 DeepSeek 进行对话。
* 支持JavaScript/Python/C++/C#/Java/Go/Rust/PHP/Ruby/Swift/Objective-C/TypeScript/SQL/HTML/CSS/JSON/YAML/Markdown/LaTeX/Bash/Shell等代码生成。

# Changelog

## [2.0.0] - 2026-08-09

### Added

* Add editor context-menu actions for explaining, refactoring, fixing, commenting, testing, and reviewing selected code.
* Add response actions for copy, insert at cursor, replace current selection, and new file.
* Include file path, language, and selection diagnostics in selected-code prompts.
* Polish the sidebar UI with model status, a send button, empty state, and tighter response actions.
* Keep only the official DeepSeek API in v2 and add `deepseek.baseUrl` for compatible custom gateways.
* Add a system prompt so replies follow the current VS Code display language by default.

## [1.4.0] - 2026-08-09

### Added

* Add official DeepSeek V4 model configuration, defaulting to `deepseek-v4-flash`.

### Changed

* Upgrade the official DeepSeek provider to the Chat Completions API.

## [1.3.0] - 2025-11-08

### Add

* multi-language support
* support save history chats
* UI Details Enhancement

## [1.2.1] - 2025-03-25

### Add

* Add Ollama api provider

## [1.2.0] - 2025-02-18

### Add

* Add siliconflow and volceengine api provider

## [1.1.9] - 2025-02-08

### Add

* Add deepseek network error feedback

## [1.1.8] - 2025-02-08

### Fix

* bug fix

## [1.1.3] - 2025-01-28

### Emergency Fix

* Modify the deepseek calling method to use HTTP approach

## [1.1.0] - 2025-01-28

### Added

* Updated chat output to streaming mode for smoother experience

### Fixed

* Fixed unresponsive stop generation button

## [1.0.2] - 2025-01-09

### Added

* Add usage screenshots to README

### Fixed

* Feature optimization

## [1.0.0] - 2024-12-15

### Added

* The plugin's initial release, supporting conversation with DeepSeek.
* Supports code generation in JavaScript/Python/C++/C#/Java/Go/Rust/PHP/Ruby/Swift/Objective-C/TypeScript/SQL/HTML/CSS/JSON/YAML/Markdown/LaTeX/Bash/Shell, etc.
