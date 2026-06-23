# Changelog

## [1.6.0] - 2026-06-22

### 新增：多前端整合仓库支持 + 发布流程分支容错与结构化日志

**作者**: AI Assistant  
**日期**: 2026-06-22  
**描述**: 支持同一 Git 仓库内多个前端项目的整合部署场景；增强发布流程的分支容错能力和 commit 版本信息追溯能力。

#### 一、多前端整合仓库（Monorepo）支持

在保持原有独立仓库发布逻辑不变的前提下，新增对多前端项目整合仓库的兼容适配。

**新增 IPC 通道**
- `project:scanSubProjects` — 扫描整合仓库内的子前端项目（识别 package.json + 构建脚本）
- `project:detectRepoRoot` — 探测指定路径所在 Git 仓库根目录
- `deploy:batch` — 批量发布：同一仓库 git 操作只执行一次，各子项目独立构建与上传

**新增数据字段**
- `projects.repo_root_path` — 整合仓库根目录（独立仓库留空，自动回退到 localPath）

**修改文件**
- `electron/services/git.service.ts` — 新增 `getRepoRoot()` 仓库根目录探测
- `electron/services/build.service.ts` — Project 接口增加 `repoRootPath`
- `electron/ipc/index.ts` — 项目 CRUD 持久化 `repoRootPath`；三个发布处理器 git 操作改用 `repoRootPath || localPath`；新增 `deploy:batch` 批量发布处理器
- `electron/preload.ts` — 暴露 `scanSubProjects`、`detectRepoRoot`、`deploy.batch` API
- `src/types/project.ts` — Project 增加 `repoRootPath`；新增 `SubProjectCandidate` 类型
- `src/utils/ipc.ts` — 类型声明补充
- `src/views/projects/index.vue` — "扫描整合仓库"对话框 + 表单整合仓库字段 + 卡片/表格"整合"标识
- `src/views/deploy/index.vue` — 同仓库项目多选 + 批量发布

#### 二、发布流程分支容错机制

发布流程中分支切换/代码拉取失败不再中断，改为记录详细日志后继续执行。

**新增方法**
- `GitService.checkBranchStatus()` — 检查分支在本地/远程的存在状态、上游跟踪状态
- `prepareBranchAndCollectCommit()` — IPC 层统一容错函数（分支检查 → 安全切换 → 安全拉取 → 收集 commit）

**容错策略**
| 场景 | 处理方式 |
|------|----------|
| 本地存在、远程不存在 | 记录 `[分支提示]` 日志，切换到本地分支继续 |
| 本地和远程都不存在 | 记录 `[分支警告]` 日志，保持当前分支 |
| pull 失败 | 记录 `[拉取警告]` 日志，使用本地代码继续 |
| checkout 失败 | 记录 `[分支警告]` 日志，使用当前分支继续 |

#### 三、结构化 commit 日志记录

每次发布自动记录当前分支的完整 commit 信息。

**新增方法**
- `GitService.getCommitDetail()` — 获取 HEAD 的完整信息（哈希、提交信息、作者、时间、关联 tag）

**deploy_history 表新增字段**
| 字段 | 说明 |
|------|------|
| `commit_message` | 完整提交信息 |
| `commit_author` | 提交作者 |
| `commit_date` | 提交时间 |
| `git_tags` | 关联 tag（逗号分隔） |

**修改文件**
- `electron/ipc/index.ts` — 4 个发布处理器（svn/server/mixed/batch）均改用容错函数并记录完整 commit 信息；`deploy:getHistory` 返回新增字段
- `src/views/deploy/history.vue` — 表格新增"提交信息"和"Tags"列；日志详情对话框展示 commit 详情

---

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
