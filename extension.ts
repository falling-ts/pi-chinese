/**
 * pi-chinese — 强制 pi 全程使用简体中文, 并约束文件编辑方式
 *
 * 通过 pi 的 `before_agent_start` 扩展钩子,在每次请求发送给模型前,向系统提示词注入:
 *   1. 语言要求:全程简体中文(包括思考/推理与中间输出)。
 *   2. 编辑约束:对文件的编辑与修改只能使用 `edit` 工具;严禁用 js/mjs/py 等命令行
 *      脚本去改文件;但允许用它们对修改结果做校验。
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

const CHINESE_DIRECTIVE = [
  "【语言要求】始终使用简体中文输出,无一例外:面向用户的回答、内部思考/推理过程(thinking)、",
  "工具调用前的分析与结论、以及一切中间输出,都必须用中文。代码与标识符可保留英文,",
  "但注释、说明、状态汇报、错误解释必须使用中文。除非用户明确要求,不得切换到其它语言。",
].join("");

const EDIT_DIRECTIVE = [
  "【编辑约束】对任何文件的编辑与修改,只能使用 `edit` 工具(新建文件用 `write` 工具)。",
  "严禁使用 `bash` 命令行以脚本方式改文件,包括但不限于:node/deno/bun 跑 js/mjs/cjs/ts,",
  "python/python3 跑 py,以及 perl/ruby/awk/sed/powershell 等一切以脚本写入、替换、重写文件内容的做法。",
  "允许用这些命令对**已完成的修改**做只读校验(语法检查、类型检查、lint、测试、diff 查看等),",
  "但校验脚本不得回写文件;若校验发现问题,仍须用 `edit` 工具修正。",
  "若确实无法用 `edit` 完成某次修改,先向用户说明原因并征得同意,不得擅自杀脚本绕过。",
].join("");

/** 本轮要注入的全部指令。 */
const DIRECTIVES = CHINESE_DIRECTIVE + "\n\n" + EDIT_DIRECTIVE;

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
