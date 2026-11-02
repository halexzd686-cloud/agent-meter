# 本地数据与隐私

首次启动会打开设置。确认应用并保存设置后，才启用所选应用的账户/会话只读检测。已有安装会保留原来的设置。可取消勾选某个应用停止其自动轮询。

- Codex：调用本机 CLI 的只读额度接口，并解析最近本地会话日志的阶段事件。只向界面传递状态、额度、会话标识等元数据，不保存或上传提示词、思考正文和工具参数。
- Kimi Code：读取本机服务实例记录及现有 server.token，仅向 127.0.0.1 的 Kimi 服务发送已认证 GET 请求。读取会话标题、状态及阶段事件，不复制登录凭据或刷新登录令牌。
- DeepSeek：配置的 API Key 只发送到 https://api.deepseek.com/user/balance，用于查询 API 余额。订阅额度不是已验证的数据源。
- 本地事件：随机端口仅绑定 127.0.0.1，要求每次启动变化的令牌，拒绝浏览器 Origin 请求。该接口不代用户批准权限。

Windows 数据目录为 %APPDATA%/Agent Meter；Mac 为 ~/Library/Application Support/Agent Meter；AGENT_METER_DATA_DIR 可覆盖。settings.json 保存偏好和启动路径；secrets.json 保存系统加密后的密钥；bridge.json 保存当前本地接口令牌。Mac 新建私密文件使用 0600 模式，目录使用 0700；Windows 由当前用户资料目录 ACL 和系统加密保护。不要把这些文件提交到 Git 或发到 Issue。

API Key 不传给渲染界面。系统密钥加密不可用时拒绝保存，不回退到明文。更换账户请在对应应用登录；移除 DeepSeek Key 可在设置中完成。

组件没有内置遥测或自动更新请求。GitHub Actions 与 npm 下载属于开发/构建过程，不是组件运行时的遥测。系统通知可能显示会话标题；敏感环境可关闭通知。

卸载程序不承诺清除账户数据。退出后可自行删除上述 Agent Meter 数据目录；不要删除 Codex 或 Kimi 的原生账户目录。报告故障时只提供版本、系统、脱敏错误，不附密钥、令牌、账户邮箱、会话正文或整个数据目录。
