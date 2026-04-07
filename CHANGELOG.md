# Changelog

## [1.5.0] - 2026-04-07

### 新增：Node.js 版本治理方案

**作者**: AI Assistant  
**日期**: 2026-04-07  
**描述**: 支持同一系统内多项目依赖不同 Node 版本的场景，通过 nvm 实现版本自动管理与切换。

#### 新增文件
- `electron/services/node-version.service.ts` — Node 版本检测、切换、安装服务

#### 修改文件
- `electron/ipc/index.ts` — 新增 `node:checkVersion`、`node:switchVersion`、`node:installVersion` IPC 处理器；项目字段映射增加 `nodeVersion`
- `electron/preload.ts` — 新增 `node` 命名空间
- `src/utils/ipc.ts` — 新增 `node` 类型声明
- `src/types/project.ts` — Project 类型增加 `nodeVersion` 字段
- `src/views/projects/index.vue` — 项目表单增加 Node 版本输入框，卡片展示 Node 版本标签
- `src/views/deploy/index.vue` — 发布前增加 Node 版本校验流程（构建前置钩子）

#### 测试文件
- `tests/unit/projects/index.spec.js` — NodeVersionService 单元测试

#### 文档
- `doc/node-version-guide.md` — Node 版本治理操作文档
