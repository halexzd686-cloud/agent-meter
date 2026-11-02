# 修复前发布就绪审查（历史记录）

> 本文记录修复前状态，不代表当前结果。修复后验证见 [VALIDATION.md](VALIDATION.md)。

审查日期：2026-11-02（Asia/Shanghai）。对象：app 目录当前源码、测试、依赖锁文件与现有分发产物。

结论：有可共享的功能基础，建议先整理为开源 Alpha。当前不建议直接把工作目录整体推送并当作面向普通用户的稳定版。审查没有初始化 Git、提交代码、创建远程仓库、变更项目实现或上传账户数据；新增的是本报告与 .cache 下的隔离审查资料。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 当前目录 Git | app 及其父目录均未发现 Git 仓库；rev-parse/status/log/remote 均返回 not a git repository。无当前分支、提交历史或 origin 可报告。 |
| 当前工作目录单元/集成测试 | 48/48 通过，Node 24.18.0、npm 11.16.0。首轮沙箱下的回环访问 EACCES 已通过放开测试回环后的复跑排除。 |
| 不带本机缓存的源码副本 | 38/48 通过，10 项因 .cache 父目录不存在导致 mkdtemp ENOENT。仅在副本创建 .cache 后 48/48 通过。没有改动原工程测试。 |
| 当前离屏渲染验收 | npm run test:renderer 连续两次失败，electron/smoke.mjs:23 未收到期望的 panel-ready 回执；报告同时出现 no offscreen paint available，无渲染控制台错误。这不是已证实的原生界面故障，也不能作为发布验收通过。 |
| npm 官方审计 | 15 个中危依赖节点、0 高危、0 严重。传播根因是 minimatch 公告，主要位于 electron-builder 构建工具链，不能称为 15 个独立漏洞或已证实的运行时攻击。 |
| 定向敏感模式检查 | 检查 63 个源码/文档等文件，未命中常见 sk-/GitHub token/私钥/长字面 Bearer 模式；lock 中未发现带用户名密码的下载 URL。此检查不覆盖全部可能的密钥格式或个人对话资料。 |
| 依赖来源 | package-lock 内 283 个 resolved URL 均指向 registry.npmmirror.com，未进行干净机器完整 npm ci 验证。 |
| 现有版本化构建目录 | dist-0.1.1、dist-0.1.2、dist-0.2.0 共 174 个文件，约 1063.19 MiB，目前未被 .gitignore 排除。5 个文件超过 100 MiB。 |

## 发布前必须处理

### 1. 阻止构建产物进入源码仓库

位置：.gitignore:2。目前只有 dist/，不匹配 dist-0.1.1/ 等。若在 app 初始化后直接 git add .，默认可能将约 1 GiB 构建产物纳入提交；当前 EXE 和 DMG 超过普通 Git 文件限额。源码放 Git，安装包和 SHA256 放 GitHub Releases。应使用 app 作为仓库根，不要把外层 wo-x 的 work/、outputs/ 和本机诊断资料一起导入。

忽略规则至少覆盖 node_modules/、.cache/、dist/、dist-*/、输出目录、.env 及其私密变体、bridge.json、secrets.json、签名私钥容器；可保留不含秘密的 .env.example。提交前检查暂存文件清单并做密钥扫描。

### 2. 去除个人安装路径，建立通用发现与首次配置

位置：src/core/catalog.mjs:2-5；src/core/platform.mjs:11。Kimi 使用个人用户名路径，DeepSeek/ZCode 使用固定 E 盘地址。其他用户默认的应用唤醒会失败，源码同时包含个人环境信息。默认值应基于当前用户环境发现实际程序；发现失败用空值与明确的选择入口。首次运行说明需要读取哪些本地元数据，区分安装应用、登录账户和额度来源。不要把开发者自己的可用路径当成所有用户的接入成功。

### 3. 修复首次获取源码后的测试失败

位置：test/kimi.test.mjs:5、test/notifications.test.mjs:14、test/platform.test.mjs:6。mkdtemp 的父目录 .cache 被 Git 忽略且测试未创建。测试应自行 mkdir({recursive:true}) 或使用系统临时目录并安全清理，不能依赖本机残留缓存。验收标准是新 checkout 的测试直接通过。

### 4. 明确项目源码许可证

根目录没有项目 LICENSE，package.json 没有 license 字段。目前只有 assets/icons/LICENSE.txt，它对应第三方图标，不能代替整份项目源码的授权。由维护者选择项目许可证，补根 LICENSE 与 package 元数据，保留第三方声明，并补充第三方依赖/资源说明。可考虑 MIT，但本轮未替维护者确定许可或版权主体。

## 对外分发前需要解决或明确标注

### 5. 重新建立渲染与实机发布验收

位置：electron/smoke.mjs:23、README.md:98。今天两次离屏命令未通过；需要区分本机图形环境与回执时序问题，采用条件等待与明确超时诊断，并在目标系统完成原生点击详情、快速切换、系统通知、应用唤醒、关闭和多屏/DPI测试。历史通过记录不能当作今天的发布结果。Mac 仍缺实机启动和适配验证；不能将 arm64 文件结构正确等同于用户可正常使用。

### 6. 处理依赖告警与构建复现

package-lock 的审计报告见 .cache/release-audit-npm.json。应升级兼容的构建链并回归，或核实并记录当前受影响条件和临时风险接受。npm 建议中含把 electron-builder 回退到 20.23.1 的方案，不能直接运行 audit fix --force。

建议声明 Node 最低版本（当前 Electron 包要求 >=22.12.0），固定 CI 的 Node 版本；评估将锁文件下载源规范为官方 registry，保留 integrity。补 Windows 与 macOS 原生 Actions：干净安装、测试、对应平台打包、产物哈希。Windows 跨平台制包所用部分签名/下载辅助流程仍在被忽略的 .cache 中，不是完整可复现的发布流水线，宜采用 macOS runner 完成 Mac 分发。

### 7. 精确定义支持范围

位置：README.md:20-29、src/adapters/。Codex 是本地 CLI 额度加最近会话日志；Kimi 是本地服务额度/状态；DeepSeek 是官方 API 余额，并非已验证的 Harness 订阅额度，状态需要外部上报。ZCode、Claude、Cursor 没有原生额度适配。可把未实现项标为规划或 Bridge 实验能力，不能宣传为全主流工具已原生支持。

等待操作与整项任务完成也是分开能力：Kimi 有明确 goal 时可报告任务完成；Codex 未推测整个多轮需求结束。默认不伪造完成、额度或授权是现有实现的优点。

### 8. 统一版本、文档和二进制分发

package.json 为 0.2.0，Windows 分发仍是 0.1.2，Start-Agent-Meter.cmd 指向旧版；README 带本机专用配置说明，缺面向外部使用者的 Releases 下载链接和首次配置流程。每个正式发布应从同一 tag 构建，统一源码/应用内/安装包版本，附兼容矩阵、更新说明、SHA256 和已知限制。

Windows 当前禁用可执行文件签名，Mac 当前为 ad-hoc 测试构建且未公证。源码公开不以购买证书为前提；若先发 Alpha，必须清楚标注安装信任与未验证边界。面向普通用户稳定分发时再完善签名、公证与更新机制。

## 已具备的基础

- Electron 沙箱、contextIsolation、nodeIntegration=false、受限 IPC 与 CSP。
- 本地 Bridge 绑定 127.0.0.1、随机令牌、Origin 拒绝、正文上限与事件校验。
- DeepSeek 密钥使用系统加密；渲染页不接收凭据。
- 本地日志只向 UI 投射状态/额度元数据；未知额度不捏造，普通回复结束不触发整项任务完成通知。
- 测试覆盖额度、去重、并发状态、完成范围、Kimi 契约与详情窗口生命周期。

这些是有价值的基础，不等于全面安全审计、第三方兼容性保证或已完成跨平台实机验收。

## 建议执行顺序与 GitHub 方案

1. 先处理忽略规则、个人路径、干净源码测试和许可证；整理面对外部使用者的 README、支持矩阵与隐私说明。
2. 修复或明确解释渲染验收失败，处理构建依赖告警，补原生 CI；以 Windows Alpha 为首个验证目标，Mac 标为实验构建直到实机通过。
3. 在 app 目录初始化独立 Git 仓库，建立 main；先检查暂存清单、秘密扫描和文件体积，再做首次提交。不要在外层 Documents/Codex 或 wo-x 初始化。
4. 确定 GitHub 账号/组织、仓库名与可见性；可先私有推送验证流水线，通过后公开。
5. 创建远程并设置 origin，推送 main；打统一 Alpha tag，用 GitHub Releases 发布对应 EXE/DMG、SHA256 与已知限制。二进制不进源码提交。
6. 发布后通过 Issues 收集目标工具版本、系统/DPI和脱敏错误；增加 CONTRIBUTING、SECURITY 与报告模板，后续再做自动更新和更多原生适配。

本轮仅提供审查与方案，未初始化/提交/推送 Git，也未替换正在运行的 Windows 组件。

## 参考

- GitHub 文件限制与 Release 分发：https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- GitHub 项目许可说明：https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
- minimatch 公告：https://github.com/advisories/GHSA-g3hv-75wg-m249
