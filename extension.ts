/**
 * pi-chinese — 强制 pi 全程使用简体中文, 并约束文件编辑方式
 *
 * 通过 pi 的 `before_agent_start` 扩展钩子,在每次请求发送给模型前,向系统提示词注入:
 *   1. 语言要求:全程简体中文(包括思考/推理与中间输出)。
 *   2. 编辑约束:对文件的编辑与修改只能使用 `edit` 工具;严禁用 js/mjs/py 等命令行
 *      脚本去改文件;但允许用它们对修改结果做校验。
 *   3. 校验脚本:执行校验脚本请用 heredoc/stdin 就地执行, 不要先落地临时文件污染项目。
 *
 * 两种模式(环境变量 `PI_CHINESE_MODE` 控制):
 *   - `replace`(默认):以"原系统提示词 + 指令"整体覆盖本轮回送给模型的 system prompt。
 *   - `append`        :仅向 pi 的 appendSystemPrompt 段追加指令(保留结构化渲染顺序)。
 *
 * 注意:`event.systemPrompt` 是只读 getter,不能直接赋值(严格模式下会抛 TypeError,且被
 * pi 的扩展 runner 静默吞掉)。要覆盖本轮系统提示词,必须从 handler **返回**
 * `{ systemPrompt }`,对应 pi 的 `BeforeAgentStartEventResult.systemPrompt`。
 *
 * 安装:把本仓库软链到 ~/.pi/agent/extensions/pi-chinese 即可(pi 启动器自动发现)。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * 三段指令已按「核心要求」重新提炼:每段只留不可妥协的要点,并用 `**` 成对包住,
 * 让模型一眼识别出这是硬性约束而非建议。措辞从"应当如何"改为"必须/严禁"。
 */
const CHINESE_DIRECTIVE = [
  "【语言要求 · 核心】",
  "**始终只使用简体中文输出,无一例外**。",
  "**面向用户的回答、内部思考/推理(thinking)、工具调用前的分析与结论、以及一切中间输出,都必须是中文**。",
  "**代码与标识符可保留英文,但注释、说明、状态汇报、错误解释必须使用中文**。",
  "**除非用户明确要求,不得切换到其它语言**。",
].join("");

const EDIT_DIRECTIVE = [
  "【编辑约束 · 核心】",
  "**改任何文件只能用 `edit` 工具;新建文件只能用 `write` 工具**。",
  "**严禁用命令行/脚本写入、替换、重写文件内容**,包括但不限于 node/deno/bun 跑 js/mjs/cjs/ts、",
  "python 跑 py、以及 perl/ruby/awk/sed/powershell 等一切脚本改文件的做法。",
  "**这些命令只允许对已完成的修改做只读校验**(语法检查、类型检查、lint、测试、diff 查看等),**校验脚本不得回写文件**。",
  "**校验发现问题,仍须用 `edit` 修正,不得改用命令或脚本绕过**。",
  "**确实无法用 `edit` 完成某次修改时,先说明原因并征得用户同意,不得擅自杀脚本绕过**。",
].join("");

const SCRIPT_DIRECTIVE = [
  "【校验脚本 · 核心】",
  "**不要先创建临时文件再运行**,那会遗留垃圾文件、污染项目。",
  "**改用「多行代码经 stdin 交给解释器」就地执行**:",
  "Node `node - <<'JS' ... JS`(需 ESM 时加 `--input-type=module`);Python `python - <<'PY' ... PY`。",
  "**本机命令是 `python`(3.x),`python3` 不存在会报错**。",
  "**一次性单行脚本可用 `node -e '...'` / `python -c '...'`**。",
  "**代码较长或需多文件时,写到 `.agents/tmp/`(已被 gitignore),不要写进项目里**。",
].join("");

/** 本轮要注入的全部指令。 */
const DIRECTIVES = CHINESE_DIRECTIVE + "\n\n" + EDIT_DIRECTIVE + "\n\n" + SCRIPT_DIRECTIVE;

export default function piChinese(pi: ExtensionAPI): void {
  const mode = (process.env.PI_CHINESE_MODE ?? "replace").toLowerCase();

  pi.on("before_agent_start", async (event) => {
    if (mode === "append") {
      event.systemPromptOptions.appendSystemPrompt =
        (event.systemPromptOptions.appendSystemPrompt
          ? event.systemPromptOptions.appendSystemPrompt + "\n\n"
          : "") + DIRECTIVES;
      return;
    }
    // replace 模式:保留 pi 原有系统提示词,仅在其后追加指令。
    // `event.systemPrompt` 只读,须通过返回值覆盖(会被投影到本轮请求的 system prompt)。
    return { systemPrompt: (event.systemPrompt ?? "") + "\n\n" + DIRECTIVES };
  });
}
