# pi-chinese

强制 [pi](https://github.com/earendil-works/pi) **全程使用简体中文**:模型的思考/推理过程(thinking)、
工具调用分析、以及面向用户的所有输出一律用中文。代码与标识符保持英文,但注释与说明用中文。

通过 pi 的扩展钩子 `before_agent_start` 在每次请求前注入中文语言指令实现,无需任何构建步骤
(pi 通过 jiti 直接加载 `.ts`)。

## 安装(软链接,随本仓库更新而更新)

```powershell
# 本仓库以 git submodule 形式位于 pi-space 根目录的 pi-chinese/
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\.pi\agent\extensions\pi-chinese" `
  -Target "D:\AI\pi-space\pi-chinese"
```

软链后,pi 启动器会在全局扩展目录 `~/.pi/agent/extensions/` 下发现它并自动加载。

> 若想用项目级(仅当前工程)生效,改为软链到 `<你的工程>/.pi/extensions/pi-chinese`。

## 模式

环境变量 `PI_CHINESE_MODE`:

| 值 | 行为 |
| --- | --- |
| `replace`(默认) | 以"原系统提示词 + 中文指令"整体覆盖本轮回送模型的内容 |
| `append` | 仅向 pi 的 `appendSystemPrompt` 段追加中文指令(保留结构化渲染顺序) |

## 卸载

删除软链接即可,本仓库(submodule)不受影响:

```powershell
Remove-Item "$env:USERPROFILE\.pi\agent\extensions\pi-chinese"
```
