# Agent Meter

砂白侘寂风的桌面 Agent 额度与任务状态小组件。Windows 优先；macOS Apple Silicon 为实验支持。当前源码版本 **0.2.1-alpha.1**，MIT 许可。

当前尚未关联公开 GitHub 远程仓库，暂无公共安装下载地址。发布后从本仓库 Releases 下载与版本标签一致的安装包和 SHA256；旧的本机 0.1.x Windows / 0.2.0 Mac 测试包不是当前源码的发布产物。

## 当前支持范围

| 应用 | 账户额度 | 任务状态与限制 |
| --- | --- | --- |
| Codex | 本地 CLI app-server 返回的账户额度窗口 | 最近本地会话阶段；可选 hook 补充事件。回复结束不会推断整项任务完成 |
| Kimi Code | 原生本地服务提供的 5 小时、周度、月度窗口，以账户实际返回项为准 | 本地状态/阶段事件；有明确 goal 完成信号时才提醒整项任务完成 |
| DeepSeek Harness | DeepSeek 官方 API 余额；需自行配置 API Key | Harness 订阅额度未验证；任务状态需要外部事件上报 |
| ZCode / GLM、Claude、Cursor | **尚无原生额度适配** | 默认关闭；仅预留实验性本地事件接口，不代表已接通原生账户 |

不承诺全工具原生支持。未知额度显示“—”，不伪造百分比。API 余额与订阅额度分开。适配协议可能随原应用更新变化，兼容记录见 [测试与发布验证](docs/VALIDATION.md)。

## 安装与首次配置

Windows 支持 x64。Mac 测试目标为 Apple Silicon、macOS 13+，尚需真实 Mac 启动和账户接入验收。Alpha 安装包暂未作 Windows 开发者签名；Mac 为 ad-hoc 签名，未经 Apple 公证。系统可能阻止启动，请保留具体提示用于排查。

1. 安装匹配系统的 Release；Mac 将 .app 拖入 Applications。
2. 首次启动会打开设置。确认启用的应用、启动路径及提醒方式，点击“保存设置”后开始只读检测。应用路径按当前用户环境发现，发现失败时手动选择 .exe 或 .app；不会使用开发者个人路径。
3. Codex / Kimi 应在对应应用中登录。Codex CLI 未发现时手动选择；Kimi Code 需保持运行，无需复制登录令牌。自定义原生目录可用 CODEX_HOME / KIMI_CODE_HOME 指定。
4. DeepSeek 只在组件内输入你自己的 API Key。它查询官方 API 余额，不等同于 Harness 订阅。
5. 点击轨道中的 Agent 查看详情，任务入口默认唤醒应用，不保证定位到具体会话。高级链接模板仅在已确认可用时配置。

顶部拖动可调高度，松开后贴右；底部可收起或进入设置。Windows 托盘、Mac 菜单栏可退出。默认不开机启动。原生额度约 60 秒刷新；状态轮询约 2–3 秒，均受原应用数据源限制。

通知只对明确的整项任务完成、等待操作或异常触发；每轮回复结束保持安静。普通 Codex 多轮需求的最终完成不作推测。可选择系统通知、展开详情或唤醒应用。

## 隐私

新安装保存设置前不读取原应用账户/会话。已安装用户保留原配置。密钥使用系统加密，不传给渲染页；组件不内置遥测，不保存或上传提示词、思考正文或工具参数。通知可能显示会话标题。数据目录、网络接口和退出/删除说明见 [PRIVACY.md](PRIVACY.md)。不要把密钥、bridge.json、server.token 或真实聊天截图发到 Issue。

## 从源码运行

固定构建环境为 Node.js **24.18.0**、npm；根目录提供 .node-version / .nvmrc。依赖从官方 npm registry 下载。首次安装 Electron 还需要访问其官方运行时下载地址。

~~~sh
npm ci
npm start
~~~

Windows PowerShell 若限制 npm.ps1，可将命令中的 npm 换成 npm.cmd。演示模式运行 npm run demo；演示值明确标注，不会触发真实应用唤醒。

~~~sh
npm test
npm run test:clean
npm run test:renderer
npm run check:release
npm run audit:check
~~~

- test：核心、适配器、通知、详情生命周期、配置与审计策略测试。
- test:clean：复制无 .cache / node_modules 的源码到临时目录，验证测试不依赖本机残留。
- test:renderer：隔离资料目录的 Electron 离屏验收；报告与图片在 .cache/render-verification。它不能代替原生鼠标操作或 Mac 实机验证。
- audit:check：仍如实报告当前构建链中危公告，限定例外及到期日见 [依赖安全说明](docs/DEPENDENCY_SECURITY.md)。新风险或过期例外会失败，不使用强制降级掩盖告警。

## 构建

~~~sh
# 在 Windows 上
npm run installer
# 可选目录版 / 便携版
npm run pack
npm run dist

# 在 Mac 上构建 arm64 DMG
npm run mac:dmg

npm run release:checksums
~~~

输出统一到 dist/，源码和安装包共用 package.json 的版本。Start-Agent-Meter.cmd 只打开当前 dist/win-unpacked 目录版，不回退启动旧版本。Windows 上不承诺原生跨编译 Mac DMG；使用 Mac runner。详细发布流程见 [RELEASING](docs/RELEASING.md)。

CI 已配置 Windows 与 macOS 原生构建、干净测试、依赖门禁和产物哈希；只有实际运行记录才能证明对应平台通过。带版本标签的工作流仅创建待人工审核的 Draft prerelease，不直接公开正式版。

## 文档与贡献

[本地事件 / 可选 hook](docs/INTEGRATIONS.md) · [Mac 边界](docs/MACOS.md) · [视觉与架构基准](docs/DECISIONS.md) · [更新记录](docs/CHANGELOG.md) · [贡献](CONTRIBUTING.md) · [安全报告](SECURITY.md) · [第三方声明](THIRD_PARTY_NOTICES.md)

Codenotch 仅作为产品参考，本工程没有将其源码作为依赖。品牌图标来自 Lobe Icons，保留原 MIT 声明；品牌权利归各品牌所有。
