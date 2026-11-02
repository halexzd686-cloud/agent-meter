# macOS arm64 · experimental

目标为 Apple Silicon（M 系列），macOS 13+。当前源码版本 0.2.1-alpha.1。使用 Mac 原生构建 npm run mac:dmg，或配置好的 macOS GitHub runner。不要将旧 0.2.0 本机 DMG 当作当前版本产物。

当前签名配置为 ad-hoc（identity 为 -），未使用 Apple Developer ID、未公证。CI 包含 codesign 严格校验和 DMG 校验，但尚未在此会话中运行远程 CI，亦未完成真实 Mac 上的启动、通知、唤醒与账户接入验收。签名结构正确不等于 Gatekeeper 信任或实机运行正常。

DMG 挂载后将 Agent Meter.app 拖入 Applications，再从应用程序目录打开。应用使用菜单栏图标和右侧轨道。首次打开确认设置并保存后开始检测。

数据目录为 ~/Library/Application Support/Agent Meter。Mac 需要重新配置自己的 DeepSeek API Key；不要复制其他机器的 secrets.json。应用发现检查 /Applications 和 ~/Applications，唤醒使用 open -a。Codex CLI 自动查找失败时手动选择。

Kimi 适配期待 ~/.kimi-code 的原生本地服务，需应用运行并登录；macOS 版接口兼容性仍待实机验证。DeepSeek 查询官方 API 余额。ZCode、Claude、Cursor 尚无原生额度适配。

scripts/stage-mac.mjs、scripts/assemble-mac.py、build/dmg-tool 是早期交叉制包实验辅助，不属于当前标准发布路径；它们需要显式准备的构建缓存，不能替代 Mac 原生 runner。正式分发应在原生流程上配置 Developer ID 与公证，并保留第三方运行时许可。
