# 本地事件与 Codex hook

## 本地事件

先启动组件。Node.js 示例（在工程根目录执行）：

~~~powershell
node scripts/emit-event.mjs --provider kimi --state waiting --task session-123 --title '等待确认文件修改'
~~~

支持 provider：deepseek、kimi、codex、glm、claude、cursor；状态：thinking、running、waiting、completed、idle、error、unknown。同一任务始终使用同一 task.id；并发任务分别建 ID。state 模型会按 observedAt 拒绝旧事件，重复状态不会重复唤醒。

如果组件使用自定义 AGENT_METER_DATA_DIR，发送端应设置同样的环境变量。正常桌面运行在 Windows 使用 %APPDATA%/Agent Meter，Mac 使用 ~/Library/Application Support/Agent Meter；设置页可复制接入命令。

POST http://127.0.0.1:<port>/v1/events，端口和 token 从本机 bridge.json 读取；Header 为 Content-Type: application/json 和 Authorization: Bearer <token>。令牌每次启动变化，不应写死到应用代码里。最大正文 32 KiB，返回 202 表示已接收。该接口是上报通道，不会自行获取其他应用账户信息。

任务事件：

~~~json
{
  "type": "task.state",
  "provider": "kimi",
  "source": "kimi-local-adapter",
  "observedAt": "2026-10-26T10:00:00.000Z",
  "task": {
    "id": "session-123",
    "sessionId": "session-123",
    "title": "等待确认文件修改",
    "state": "waiting"
  }
}
~~~

observedAt 应使用事件实际发生时间（新事件可省略，由接收器记录当前时间），不要照抄示例日期。不传入原始提示词、工具命令或密钥。

余额事件：

~~~json
{
  "type": "quota.snapshot",
  "provider": "deepseek",
  "source": "verified-account-api",
  "quota": {"kind":"balance","amount":26.8,"currency":"CNY","budget":null}
}
~~~

窗口额度事件：

~~~json
{
  "type": "quota.snapshot",
  "provider": "kimi",
  "source": "verified-quota-adapter",
  "quota": {"kind":"window","usedPercent":38,"windowMinutes":300,"resetsAt":null}
}
~~~

usedPercent 是**已消耗百分比**，UI 显示剩余值。窗口长度、重置时间、账户币种必须来自真实来源；无法确定时不要构造事件。余额仅支持 CNY / USD，可选 budget 必须正数。

## 整项任务完成通知

对话结束、工具步骤完成或完成范围未知的事件不会触发完成弹窗。适配器确认整个任务完成后，显式发送：

~~~json
{
  "type": "task.state",
  "provider": "kimi",
  "task": {
    "id": "unique-whole-task-id",
    "sessionId": "session-123",
    "title": "完成整个需求",
    "state": "completed",
    "completionScope": "task"
  }
}
~~~

completionScope 支持 task（整项任务）、turn（本轮）、unknown（默认）。相同 task.id 的整任务完成提醒在本次运行内只发送一次；重启读取到的历史完成事件保持静默。新的完整任务应使用新的 task.id，可保持相同 sessionId 用于会话定位。

命令行在真实任务结束时使用 --state completed --scope task；未指定 --scope task 时不会发送完成通知。请勿把每一轮对话结束映射为 task 范围。当前 Codex 日志和 Stop hook 不提供整个多轮需求完成的可靠判据，因此默认只回到空闲；整任务通知仍需明确的适配事件。

## 可选 Codex hook

文件位于 integrations/codex-agent-meter，包含 plugin.json、hooks/hooks.json 和 hooks/report.mjs。该插件尚未自动安装或写入本机 Codex 配置。

默认不安装也能读取 Codex 额度与部分日志状态。若需要授权等待等更精确的状态，可以在支持本地插件的 Codex 版本中导入此目录，审阅 command hook 并信任启用；具体安装入口和信任流程以 [官方插件文档](https://developers.openai.com/plugins/build/plugins) 与 [hook 文档](https://learn.chatgpt.com/docs/hooks) 为准。当前用户环境需能运行 node 命令。

| Hook | 组件状态 |
| --- | --- |
| UserPromptSubmit | 思考中 |
| PreToolUse | 执行中 |
| PostToolUse | 思考中 |
| PermissionRequest | 等待授权 |
| Stop | 本轮结束，回到空闲，不发送完成通知 |
| Interrupt / SessionEnd | 空闲 |

hook 只发会话 ID、工作目录末级名称与状态；返回空 JSON 对象，不作批准、拒绝或阻断决定。组件未运行或接口超时时静默退出，网络等待上限 650 ms。插件端到端导入与实际触发尚未验证；当前将它作为可审阅的接入模板交付。

## 下一阶段适配

Kimi 已通过本地 GET 接口 /api/v1/oauth/usage、/api/v2/sessions、/api/v1/sessions/{session_id}/goal 以及主 Agent 阶段事件完成接入。普通 turn.ended 不发完成提醒；原生 goal.updated 的 complete 才触发整任务提醒。额度和状态验证记录见 outputs/agent-meter-desktop/kimi-live-verification.json。Kimi 当前只唤醒应用，不承诺未验证的具体会话链接。

ZCode 继续确认官方或本地可观察的额度来源、会话状态事件和任务链接协议后实现 adapter。安装目录只是启动依据，无法凭它证明额度接入完成。DeepSeek Harness 也需要区分其自身额度与 DeepSeek API 账户余额。不得用进程是否运行来冒充思考 / 执行 / 完成。
