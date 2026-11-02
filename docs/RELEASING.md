# 发布流程

当前发布目标为 0.2.1-alpha.1。代码和构建产物共用 package.json 版本；不要手工复制旧 EXE 或 DMG 冒充新版本。

1. 确认 LICENSE、支持矩阵、PRIVACY、更新记录和已知限制准确。运行 npm ci、npm test、npm run test:clean、npm run check:release、npm run audit:check。依赖限定例外不是漏洞修复，过期前必须复核。
2. 在 Windows 验证离屏渲染、真实详情切换、通知、唤醒和多屏/DPI。Mac 需要原生启动、Keychain、菜单栏、全屏空间及账户适配验收。将未测项目列为未验证，不能写“全部通过”。
3. Windows 运行 npm run installer；Mac 运行 npm run mac:dmg。npm run release:checksums 为匹配当前版本的安装包生成 SHA256。产物不提交到源码 Git。
4. 核对 app.asar 与版本、许可、无凭据；Mac 使用 codesign --verify --deep --strict 与 hdiutil verify，并确认主程序是 arm64。签名、公证另行验证；当前仅测试签名。
5. 远程仓库建立后，CI 在 push/PR/workflow_dispatch 时验证；只读构建作业不接收签名私钥。标签必须为 v 加 package.json 版本，标签与源码版本不匹配时失败。
6. 推送版本标签后，工作流创建 Draft prerelease 并附各平台产物及哈希。人工检查实际 CI 日志、下载及实机验收，再在 GitHub 手动公开草稿。不要自动把实验 Mac 包标成已验证稳定版。

## Git 初次推送

仓库根应是本项目 app 目录。初始化 main 后执行源码预检；检查 git status、git diff --cached --stat 和候选文件清单。不要在外层工作目录或整个 Documents 目录初始化。

确认 GitHub 账号/组织、仓库名和可见性后创建 origin。先推送源码验证流水线，再考虑公开。首次提交不应包含个人路径、诊断缓存、设置、令牌和安装包。当前未指定远程地址时，不填造 repository URL 或 Releases 下载链接。

Windows 与 Mac 工作流分别执行原生打包。Mac 当前实验性，CI 成功亦不能代替真实账户兼容测试。签名私钥、Developer ID 和公证凭据只可使用受保护的 release 环境；本仓库默认没有这些秘密。
