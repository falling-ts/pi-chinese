# pi-chinese

强制 [pi](https://github.com/earendil-works/pi) **全程使用简体中文**：模型的思考/推理过程(thinking)、
工具调用分析、以及面向用户的所有输出一律用中文。只有代码块、命令行、标识符、文件路径与报错原文
可保留英文。

同时约束**文件编辑方式**：对文件的编辑与修改**只能使用 `edit` 工具**（新建用 `write`），
严禁用 js/mjs/py 等命令行脚本改文件；但允许用这些命令对已完成的修改做**只读校验**，
且校验脚本应经 stdin/heredoc 就地执行，不落地临时文件。

通过 pi 的扩展钩子注入：`before_agent_start` 在每次提交时写入铁律锚点与三段细则，
`context_with_system` 在每次 LLM 请求末尾补一句提醒以抵消轮内衰减。无需任何构建步骤
（pi 通过 jiti 直接加载 `.ts`）。

三类要求（**语言 / 编辑 / 校验脚本**）用同一套强化手段，不分主次：

1. 每条要点**独立成行**，整条用 `**` 包住，措辞统一为「必须 / 严禁」。此前各条挤在一行
   （790 字符只有 4 个换行，`**` 连成一串），模型读不出「逐条约束」的形状。
2. **锚点前置**。`replace` 模式下，一段 88 字符的铁律摘要被放到系统提示词**最开头**，
   细则放末尾，pi 原始提示词夹在中间。原因是 pi 自带提示词中英文占约 80%
   （preamble/tools/rules/docs 全英文），中文约束若只挂在末尾会被英文语境稀释；
   开头与结尾正是注意力最强的两个位置。
3. **每轮末尾轻提醒**。`before_agent_start` 只在用户提交时触发一次，一轮内后续的工具调用
   轮次不再重新注入，约束会随轮次衰减（实测同一会话英文思考占比可从前段 5% 反弹回 90%+）。
   因此扩展另注册 `context_with_system` 钩子，在**每次 LLM 请求**的最后一条消息里就地补一句
   三类铁律的提醒。

锚点只做**一条**（把三类核心动作压在一起），不按类各做一条：锚点会被重复注入，越长越抵消
前置带来的注意力增益。同理，细则只写「做什么 / 禁止什么」，不写理由与边缘情形——细则越长，
真正关键的那条越被稀释。

## 安装

三种方式任选其一。

### 1. 软链接（推荐，随本仓库更新而更新）

本仓库以 git submodule 形式位于 pi-space 根目录的 `pi-chinese/`：

```powershell
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\.pi\agent\extensions\pi-chinese" `
  -Target "D:\AI\pi-space\pi-chinese"
```

软链后，pi 启动器会在全局扩展目录 `~/.pi/agent/extensions/` 下发现它并自动加载。

> 若只想在单个工程生效，改为软链到 `<你的工程>/.pi/extensions/pi-chinese`。

### 2. 从 npm 安装

```bash
pi install npm:@falling-ts/pi-chinese
```

### 3. 从 git 安装

```bash
pi install git:github.com/falling-ts/pi-chinese
```

单次试用（不写入配置）：

```bash
pi -e npm:@falling-ts/pi-chinese
```

## 模式

环境变量 `PI_CHINESE_MODE`：

| 值 | 行为 |
| --- | --- |
| `replace`（默认） | 以"锚点 + 原系统提示词 + 细则"整体覆盖本轮回送模型的内容 |
| `append` | 仅向 pi 的 `appendSystemPrompt` 段追加（锚点在注入块首尾各一次，因该模式无法真正前置） |

两种模式都会注入下面**三类细则**。

> 每轮末尾的提醒是**请求期投影**，不写回会话记录，因此不会在历史里累积。它必须**就地并入
> 最后一条消息**，不能新增一条 `user` 消息：pi 的 provider 转换会把 `toolResult` 与文本 `user`
> 都映射为 `role: "user"` 且不做相邻合并，末尾再补一条 user 会形成连续两条 user 消息，
> 被 Anthropic 一类强校验的接口拒绝。结尾若恰好是 `assistant`（异常态），则跳过注入，
> 以免破坏 `tool_use` / `tool_result` 的配对。

### 1. 语言要求

- thinking（思考）与一切输出必须是简体中文，禁止英文推理，禁止中英混排；
- 除代码块、命令行、标识符、文件路径、报错原文外一律用中文；不得以「这是技术内容」为由改用英文。

第二条的边界是特意收窄的：早期措辞是「代码与标识符可保留英文」，模型会据此推论
「思考内容全是函数名/路径/类型 → 属技术内容 → 可继续用英文」，从而绕过约束。

### 2. 编辑约束

- 改文件只能用 `edit` 工具，新建只能用 `write`；严禁用命令行或脚本写入、替换、重写文件内容
  （node/deno/bun 跑 js/mjs/cjs/ts、python 跑 py，以及 perl/ruby/awk/sed/powershell 等一切脚本改文件）；
- 命令与脚本只能对**已完成的修改**做只读校验（语法检查、类型检查、lint、测试、查看 diff），
  不得回写；校验发现问题仍须用 `edit` 修正。

### 3. 校验脚本

- 校验代码经 stdin 就地执行（如 `node - <<'JS'` / `python - <<'PY'`），不要先建临时文件；
  代码较长或需要多文件时写入 `.agents/tmp/`（已 gitignore）。

这里刻意**不写**具体解释器名或路径（如「本机是 `python`，`python3` 不存在」）：那是单机环境事实，
写进通用扩展会把某台机器的假设强加给所有设备，换机即成为错误信息。要约束的是「就地执行、
不落地临时文件」这个动作，与用哪个解释器无关。

就地执行的写法：

```bash
# Node
node - <<'JS'
console.log(process.version);
JS

# Node（需 ESM 时）
node --input-type=module - <<'JS'
import { readFileSync } from "node:fs";
JS

# Python（按本机实际存在的解释器名调用）
python - <<'PY'
import sys
print(sys.version)
PY
```

单行可用 `node -e '...'` / `python -c '...'`。若代码较长或需要多文件，仍优先写到
`.agents/tmp/`（已被 gitignore）而非项目目录。

## 实现要点

两个钩子，都注册在 `extension.ts`：

| 钩子 | 触发时机 | 作用 |
| --- | --- | --- |
| `before_agent_start` | 用户每次提交 | 前置铁律锚点 + 注入三段细则 |
| `context_with_system` | 每次 LLM 请求（含轮内工具调用） | 在最后一条消息就地补一句三类铁律提醒 |

- `event.systemPrompt` 是**只读 getter**，直接赋值在严格模式下抛 `TypeError`，且会被 pi 的扩展
  runner 静默吞掉。要覆盖本轮系统提示词必须从 handler **返回** `{ systemPrompt }`。
- `context` 与 `context_with_system` 的区别：前者只看到**非 system** 消息，且仅在其返回值与可见
  快照**不同**时才由 pi 重建系统消息头；后者的返回值**原样采用**。要「末尾补一句」用后者更直白。
  两者都要求系统消息留在 index 0（`context_with_system` 移除首条 system 会报错但仍采纳输出）。

改完扩展后，在会话内 `/reload` 即可生效；对新启动的会话自动生效。

## 卸载

软链方式删除软链接即可（本仓库/submodule 不受影响）：

```powershell
Remove-Item "$env:USERPROFILE\.pi\agent\extensions\pi-chinese"
```

npm / git 方式用 `pi remove npm:@falling-ts/pi-chinese`（或对应的 git 源）。

## 规范与发布

本包遵循 pi 的 [package 规范](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)：

- `package.json` 用 `pi.extensions` 显式声明扩展入口；
- 宿主包 `@earendil-works/pi-coding-agent` 只出现在 `peerDependencies`（范围 `"*"`），**不得**放进 `dependencies`，
  否则会绕过 pi 的扩展模块映射、产生重复的运行时模块（pi 会就此报警告）；
- `keywords` 含 `pi-package`，满足 [Pi 包画廊](https://pi.dev/packages) 的收录条件。

发布为 **scoped 包** `@falling-ts/pi-chinese`，因为公开包需有 scope 且必须带 `publishConfig.access: "public"`，
否则 `npm publish` 会被拒绝（scoped 包默认 restricted）。发布命令（本机默认 registry 是淘宝镜像，
必须显式指定 npmjs）：

```bash
npm publish --registry=https://registry.npmjs.org/
```

## License

[MIT](LICENSE)
