# pi-chinese

强制 [pi](https://github.com/earendil-works/pi) **全程使用简体中文**：模型的思考/推理过程(thinking)、
工具调用分析、以及面向用户的所有输出一律用中文。代码与标识符保持英文，但注释与说明用中文。

通过 pi 的扩展钩子 `before_agent_start` 在每次请求前注入中文语言指令实现，无需任何构建步骤
（pi 通过 jiti 直接加载 `.ts`）。

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
pi install npm:pi-chinese
```

### 3. 从 git 安装

```bash
pi install git:github.com/falling-ts/pi-chinese
```

单次试用（不写入配置）：

```bash
pi -e npm:pi-chinese
```

## 模式

环境变量 `PI_CHINESE_MODE`：

| 值 | 行为 |
| --- | --- |
| `replace`（默认） | 以"原系统提示词 + 中文指令"整体覆盖本轮回送模型的内容 |
| `append` | 仅向 pi 的 `appendSystemPrompt` 段追加中文指令（保留结构化渲染顺序） |

改完扩展后，在会话内 `/reload` 即可生效；对新启动的会话自动生效。

## 卸载

软链方式删除软链接即可（本仓库/submodule 不受影响）：

```powershell
Remove-Item "$env:USERPROFILE\.pi\agent\extensions\pi-chinese"
```

npm / git 方式用 `pi remove npm:pi-chinese`（或对应的 git 源）。

## 规范与发布

本包遵循 pi 的 [package 规范](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)：

- `package.json` 用 `pi.extensions` 显式声明扩展入口；
- 宿主包 `@earendil-works/pi-coding-agent` 只出现在 `peerDependencies`（范围 `"*"`），**不得**放进 `dependencies`，
  否则会绕过 pi 的扩展模块映射、产生重复的运行时模块（pi 会就此报警告）；
- `keywords` 含 `pi-package`，满足 [Pi 包画廊](https://pi.dev/packages) 的收录条件。

关于 `private`：`package.json` **未**设 `"private": true`，即本包处于「可发布」状态。
若只想在本机/私有范围使用、避免 `npm publish` 误发，请自行加回 `"private": true` 并移除 `files` 字段。

## License

[MIT](LICENSE)
