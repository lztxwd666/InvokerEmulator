# Invoker Emulator

[English](README_us.md)

一个用于练习 Dota 2 中 **Invoker / Carl** 的离线桌面训练工具

本项目面向希望在不进入实际对局的情况下，练习球元素管理、技能 Invoke 顺序、技能组合、连招执行以及键盘和鼠标肌肉记忆的玩家

## 功能特性

- 三球元素系统，模拟 Dota 2 的球元素队列行为
- Invoke 机制与双技能槽位（D/F）
- 支持全部 10 个 Invoke 技能
- 支持考虑元素球继承状态的全局最优连招规划
- 连招预载模式：预先准备两个 Invoke 技能，并按照指定顺序释放
- 支持标准 QWER/DF 键位以及传统 Dota 1 键位
- 支持 Quickcast 快速施法和普通鼠标确认施法模式
- 阿哈利姆神杖开关：开启后可将天火强化为毁天灭地，并使用独立图标与冷却
- 四个物品栏位：
  - Refresher Orb
  - Scythe of Vyse
  - Meteor Hammer
  - Boots of Travel
- 支持自定义物品快捷键（字母、数字、符号键及鼠标侧键）
- 无限魔法值开关
- 静音开关
- 内置连招库
- 支持用户自定义连招，并自动生成对应的最优按键序列
- 支持设置英雄等级、元素球等级以及训练假人的生命值/魔法值
- 技能数值基于官方 Dota 2 数据
- 双语 UI：中文（默认）和英文
- 配置持久化保存
- 随机技能模式：多个随机位置气泡，支持普通施法与快速施法
- 快速施法功能键：可配置 Alt / Ctrl / Shift

## 界面预览

### 主界面

![主界面](screenshots/Main_Interface.png)

### 随机技能模式

![随机技能模式](screenshots/Random_skills.png)

### 设置

![设置](screenshots/Setting.png)

## 技术栈

| 层级         | 技术方案                         |
| ------------ | -------------------------------- |
| 桌面应用框架 | Tauri 2 + Rust                   |
| 前端         | React + TypeScript + Vite        |
| 核心引擎     | 纯 TypeScript 状态机             |
| UI 框架      | React                            |
| 状态管理     | React Hooks                      |
| 测试         | Vitest                           |
| 音频         | HTML Audio API + Dota 2 游戏资源 |
| 打包方式     | 单个 Windows 可执行文件          |

## 环境要求

- Node.js 18+
- npm
- Rust toolchain（仅在从源码构建时需要）
- Windows 10/11（通常已预装 WebView2 Runtime）

## 开发

安装依赖并启动开发环境：

```bash
npm install
npm run tauri -- dev
```

运行测试：

```bash
npm test
```

## 构建

执行以下命令：

```bash
npm run tauri -- build --no-bundle
```

生成的可执行文件位于：

```text
src-tauri/target/release/invoker-emulator.exe
```

所有前端资源、图片和音频文件都会被嵌入到可执行文件中，无需额外安装或部署其他资源

## 目录结构

```text
src/
  engine/          纯 TypeScript 实现的 Invoker 核心逻辑
  components/      React 组件
  i18n.tsx         UI 国际化翻译
  App.tsx          应用程序入口
  assets/          图片和音频资源
  data/            官方 Dota 2 数据源 JSON
src-tauri/         Tauri / Rust 桌面应用层
scripts/           开发脚本
research/          开发过程中使用的参考资料
```

## 资源许可

所有与游戏相关的图片、音效和物品图标均来源于 Valve 所拥有的 Dota 2 游戏资源

本项目是一个非商业性质的开源练习工具，相关资源来源声明位于：

```text
ATTRIBUTION.md
```

在未查阅并确认 Valve 相关内容政策的情况下，不得将项目中打包的游戏资源用于商业用途或进行商业性再分发

## 许可证

MIT

项目中包含的 Dota 2 游戏资源仍归 Valve 所有
