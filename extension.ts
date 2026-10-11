/**
 * pi-chinese — 强制 pi 全程使用简体中文, 并约束文件编辑方式
 *
 * 两个钩子:
 *   1. `before_agent_start`(用户每次提交):把「三条铁律」锚点**前置**到系统提示词最开头,
 *      细则置于末尾。三类要求:语言(全程简体中文,含思考)、编辑(改文件只能用 edit/write)、
 *      校验脚本(经 stdin 就地执行,不落地临时文件)。
 *   2. `context_with_system`(每次 LLM 请求,含轮内工具调用):在末尾就地补一句三类铁律提醒,
 *      抵消「before_agent_start 一轮只触发一次」带来的约束衰减。
 *
 * 两种模式(环境变量 `PI_CHINESE_MODE` 控制):
 *   - `replace`(默认):以"锚点 + 原系统提示词 + 细则"整体覆盖本轮回送给模型的 system prompt。
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
 * 全局锚点:整段提示词里最强、最短的一段约束,把三类要求的**核心动作**压在一起。
 *
 * 只做一条(而非每类一条)是刻意的:锚点会被重复注入,越长越抵消前置带来的注意力增益。
 *
 * `replace` 模式下它被**前置**到系统提示词最开头。原因:pi 自带提示词的英文占比约 80%
 * (preamble/tools/rules/docs 全是英文),把约束只挂在末尾会被英文语境淹没;开头与
 * 结尾是注意力最强的两个位置。
 */
const CORE_ANCHOR =
  "【最高优先级 · 三条铁律】**① 全程只用简体中文思考与输出;② 改文件只能用 `edit`/`write` 工具;③ 校验脚本经 stdin 就地执行,不落地临时文件**。";

/**
 * 三段指令按「核心要求」提炼:只留不可妥协的要点,每条**独立成行**并用 `**` 成对包住。
 *
 * 独立成行是刻意的:此前各条用 `join("")` 挤成一行,790 字符只有 4 个换行,`**` 连成一串,
 * 模型难以把它解析成逐条约束。改成 bullet 式逐行后结构才可辨。
 *
 * 每条只写「做什么/禁止什么」,不写理由与边缘情形:细则越长,真正关键的那条越被稀释。
 */
const CHINESE_DIRECTIVE = [
  "【语言要求 · 核心】",
  "- **thinking(思考)与一切输出必须是简体中文,禁止英文推理,禁止中英混排**。",
  "- **除代码块、命令行、标识符、文件路径、报错原文外一律用中文;不得以「这是技术内容」为由改用英文**。",
].join("\n");

const EDIT_DIRECTIVE = [
  "【编辑约束 · 核心】",
  "- **改文件只能用 `edit` 工具,新建只能用 `write`;严禁用命令行或脚本写入、替换、重写文件内容**。",
  "- **命令与脚本只能对已完成的修改做只读校验,不得回写;校验发现问题仍须用 `edit` 修正**。",
].join("\n");

const SCRIPT_DIRECTIVE = [
  "【校验脚本 · 核心】",
  "- **校验代码经 stdin 就地执行(如 `node - <<'JS'`),不要先建临时文件;代码较长时写入 `.agents/tmp/`**。",
].join("\n");

/** 三段细则:紧随锚点之后注入,锚点管「记住」,细则管「具体怎么做」。 */
const DIRECTIVES = CHINESE_DIRECTIVE + "\n\n" + EDIT_DIRECTIVE + "\n\n" + SCRIPT_DIRECTIVE;

/**
 * 轮内轻量提醒:一轮里模型可能连续多次调用工具,而 `before_agent_start` 只在用户提交时
 * 触发一次,越往后约束越弱(实测同一会话的英文思考占比会从 5% 反弹回 90%+)。
 * 因此在**每次 LLM 请求**的末尾补一行提醒,把三类约束一起拉回注意力焦点。
 *
 * 关键约束:提醒必须**就地并入最后一条消息**,不能新增一条 user 消息。
 * pi 的 provider 转换会把 `toolResult` 与文本 `user` 都映射成 `role: "user"`
 * (见 packages/ai/src/api/anthropic-messages.ts),且不做相邻合并;因此「末尾再补一条
 * user」会形成连续两条 user 消息,被 Anthropic 一类强校验的接口拒绝。
 * 追加成最后一条消息的额外文本块则完全在协议内:不改变 role 序列、不破坏
 * tool_use/tool_result 配对,且位置最贴近本次生成,注意力最强。
 *
 * 只处理 `toolResult` 与 `user` 两种结尾;结尾若是 assistant(异常态),直接跳过,
 * 避免往 toolCall 消息里塞文本。
 */
const TURN_REMINDER =
  "【提醒】**继续用简体中文思考与回复;改文件用 `edit`/`write` 工具;校验脚本经 stdin 就地执行**。";

export default function piChinese(pi: ExtensionAPI): void {
  const mode = (process.env.PI_CHINESE_MODE ?? "replace").toLowerCase();

  pi.on("before_agent_start", async (event) => {
    if (mode === "append") {
      // append 模式只能落在 addendum 段,无法真正前置到提示词开头;
      // 因此把锚点在注入块的首尾各放一次,借结尾位置补足注意力。
      const block = CORE_ANCHOR + "\n\n" + DIRECTIVES + "\n\n" + CORE_ANCHOR;
      event.systemPromptOptions.appendSystemPrompt =
        (event.systemPromptOptions.appendSystemPrompt
          ? event.systemPromptOptions.appendSystemPrompt + "\n\n"
          : "") + block;
      return;
    }
    // replace 模式:锚点置于最前(注意力最强),细则置于末尾,原始提示词保持在中间。
    // `event.systemPrompt` 只读,须通过返回值覆盖(会被投影到本轮请求的 system prompt)。
    const original = event.systemPrompt ?? "";
    return { systemPrompt: CORE_ANCHOR + "\n\n" + original + "\n\n" + DIRECTIVES };
  });

  /**
   * 每次 LLM 请求(含一轮内的后续工具调用)在对话末尾补一行中文提醒。
   *
   * 用 `context_with_system` 而非 `context`:后者只看到会话(系统消息被剥离),且仅在其
   * 返回值**发生变化**时才由 pi 重建系统消息头(`restoreSystemMessages`);前者拿到完整
   * transcript 且返回值原样采用,语义更直白。
   *
   * 这里**不写回 transcript**:返回值只是本次请求的投影,提醒不会在会话里累积,
   * 也不会污染历史记录。系统消息必须留在 index 0,故原样保留前缀。
   */
  pi.on("context_with_system", async (event) => {
    const messages = event.messages;
    const last = messages[messages.length - 1];
    if (!last) return;
    const reminder = { type: "text" as const, text: TURN_REMINDER };

    if (last.role === "toolResult") {
      return {
        messages: [...messages.slice(0, -1), { ...last, content: [...last.content, reminder] }],
      };
    }
    if (last.role === "user") {
      const content =
        typeof last.content === "string"
          ? [{ type: "text" as const, text: last.content }, reminder]
          : [...last.content, reminder];
      return { messages: [...messages.slice(0, -1), { ...last, content }] };
    }
    // 结尾是 assistant 等其它角色:不注入,避免破坏 toolCall 与 toolResult 的配对。
    return;
  });
}
