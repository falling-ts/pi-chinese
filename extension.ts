/**
 * pi-chinese — 强制 pi 全程使用简体中文
 *
 * 通过 pi 的 `before_agent_start` 扩展钩子,在每次请求发送给模型前,
 * 把"全程使用简体中文(包括思考/推理与中间输出)"写入系统提示词。
 *
 * 两种模式(环境变量 `PI_CHINESE_MODE` 控制):
 *   - `replace`(默认):以"原系统提示词 + 中文指令"整体覆盖本轮回送给模型的 system prompt。
 *   - `append`        :仅向 pi 的 appendSystemPrompt 段追加中文指令(保留结构化渲染顺序)。
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

export default function piChinese(pi: ExtensionAPI): void {
  const mode = (process.env.PI_CHINESE_MODE ?? "replace").toLowerCase();

  pi.on("before_agent_start", async (event) => {
    if (mode === "append") {
      event.systemPromptOptions.appendSystemPrompt =
        (event.systemPromptOptions.appendSystemPrompt
          ? event.systemPromptOptions.appendSystemPrompt + "\n\n"
          : "") + CHINESE_DIRECTIVE;
      return;
    }
    // replace 模式:保留 pi 原有系统提示词,仅在其后追加中文强制指令。
    // `event.systemPrompt` 只读,须通过返回值覆盖(会被投影到本轮请求的 system prompt)。
    return { systemPrompt: (event.systemPrompt ?? "") + "\n\n" + CHINESE_DIRECTIVE };
  });
}
