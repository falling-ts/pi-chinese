# pi-chinese

强制 [pi](https://github.com/earendil-works/pi) **全程使用简体中文**：模型的思考/推理过程(thinking)、
工具调用分析、以及面向用户的所有输出一律用中文。代码与标识符保持英文，但注释与说明用中文。

同时约束**文件编辑方式**：对文件的编辑与修改**只能使用 `edit` 工具**（新建用 `write`），
严禁用 js/mjs/py 等命令行脚本改文件；但允许用这些命令对已完成的修改做**只读校验**，
且校验脚本应经 stdin/heredoc 就地执行，不落地临时文件。

通过 pi 的扩展钩子 `before_agent_start` 在每次请求前注入这两类指令实现，无需任何构建步骤
（pi 通过 jiti 直接加载 `.ts`）。

注入的三段指令均按**「核心要求」**写法组织：每段只保留不可妥协的要点，并逐条用 `**` 包住，
措辞统一为「必须 / 严禁」，以便模型把其识别为硬性约束而非建议。

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
| `replace`（默认） | 以"原系统提示词 + 指令"整体覆盖本轮回送模型的内容 |
| `append` | 仅向 pi 的 `appendSystemPrompt` 段追加指令（保留结构化渲染顺序） |

两种模式都会注入下面**三类指令**。

### 1. 语言要求

全程简体中文，含思考/推理与一切中间输出；代码与标识符可保留英文，但注释、说明、状态汇报、
错误解释必须用中文。

### 2. 编辑约束

- 对文件的编辑与修改**只能使用 `edit` 工具**（新建文件用 `write`）；
- **严禁**用 `bash` 以脚本方式改文件：node/deno/bun 跑 js/mjs/cjs/ts、python 跑 py，
  以及 perl/ruby/awk/sed/powershell 等一切脚本写入/替换/重写文件内容的做法；
- 允许用这些命令对**已完成的修改**做**只读**校验（语法检查、类型检查、lint、测试、查看 diff）；
- 校验脚本**不得回写文件**；若校验发现问题，仍须用 `edit` 修正；
- 确属无法用 `edit` 完成时，先说明原因并征得同意，不得擅自用脚本绕过。

### 3. 校验脚本

执行校验脚本时**不要先创建临时文件再运行**（会遗留垃圾、污染项目），应直接把多行代码经
stdin 交给解释器就地执行：

```bash
# Node
node - <<'JS'
console.log(process.version);
JS

# Node（需 ESM 时）
node --input-type=module - <<'JS'
import { readFileSync } from "node:fs";
JS

# Python（注意：本机命令是 python（3.x），python3 不存在会报错）
python - <<'PY'
import sys
print(sys.version)
PY
```

单行可用 `node -e '...'` / `python -c '...'`。若代码较长或需要多文件，仍优先写到
`.agents/tmp/`（已被 gitignore）而非项目目录。

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
