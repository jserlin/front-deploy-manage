# Frontend Deploy Manager

一款基于 Electron + Vue3 + TypeScript 的桌面应用，用于管理前端项目的构建和部署流程。

## 功能特点

### 项目管理
- 项目增删改查、分组管理
- 自动扫描 Git 仓库信息
- 配置 Node 版本要求
- 项目搜索和筛选

### 凭证管理
- **服务器凭证**: 支持 password 和 private key 两种认证方式
- **SVN 凭证**: SVN 地址和账号管理
- 密码 AES-256 加密存储
- 连接测试功能
- 按环境分类（dev/test/prod）

### 发布功能
- **SVN 发布**: 构建后上传到 SVN 服务器
- **服务器发布**: 通过 SFTP 上传到远程服务器
- **混合发布**: 单次构建，同时发布到多个目标
- **压缩上传**: 使用 tar 压缩后上传，大幅提升传输速度
- 发布进度实时显示
- 支持取消发布
- 发布日志记录和查看

### 发布模板
- 保存常用的发布配置
- 快速使用模板进行发布
- 按项目筛选模板

### 发布历史
- 查看所有发布记录
- 发布日志查看（带时间戳）
- 按项目筛选历史记录
- 日志复制功能

### Node 版本管理
- 检测 nvm-windows 环境
- 通过 PATH 注入方式切换 Node 版本
- 构建时自动使用指定版本

### 配置管理
- 配置导出为 JSON 文件
- 配置导入
- 可选是否包含密码
- 清空所有数据

## 技术栈

| 类别 | 技术 |
|------|------|
| 主框架 | Electron 28+ |
| 前端框架 | Vue 3.4+ (Composition API) |
| 开发语言 | TypeScript 5.0+ |
| 构建工具 | Vite 5.0+ |
| UI 组件库 | Element Plus 2.5+ |
| 状态管理 | Pinia 2.1+ |
| 路由 | Vue Router 4.2+ |
| 数据存储 | JSON 文件 |
| Git 操作 | simple-git |
| SSH/SFTP | ssh2 |
| 加密 | AES-256-CBC |

## 项目结构

```
frontend-deploy-manager/
├── electron/                  # Electron 主进程
│   ├── main.ts               # 主进程入口
│   ├── preload.ts            # 预加载脚本
│   ├── database/             # 数据库模块
│   │   └── index.ts          # JSON 文件数据库
│   ├── services/             # 核心服务
│   │   ├── git.service.ts    # Git 操作
│   │   ├── svn.service.ts    # SVN 操作
│   │   ├── ssh.service.ts    # SSH/SFTP 操作
│   │   ├── build.service.ts  # 构建服务
│   │   └── node-version.service.ts
│   ├── utils/                # 工具函数
│   │   ├── crypto.ts         # 加密工具
│   │   └── logger.ts         # 日志工具
│   └── ipc/                  # IPC 通信
│       └── index.ts          # IPC 处理器
├── src/                      # 渲染进程 (Vue3)
│   ├── views/                # 页面组件
│   │   ├── projects/         # 项目管理
│   │   ├── credentials/      # 凭证管理
│   │   ├── deploy/           # 发布管理
│   │   └── settings/         # 设置
│   ├── stores/               # Pinia Store
│   ├── router/               # 路由配置
│   └── types/                # TypeScript 类型
├── doc/                      # 文档
│   └── 系统设计文档.md
└── package.json
```

## 开发指南

### 环境要求
- Node.js 18+
- npm / yarn / pnpm
- Git
- SVN 客户端（如需 SVN 发布功能）
- nvm-windows（如需 Node 版本管理功能）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
npm run build
```

### 打包应用

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 使用说明

### 1. 创建项目
1. 进入「项目管理」页面
2. 点击「添加项目」
3. 填写项目名称和本地路径
4. 系统会自动扫描 Git 信息
5. 配置构建命令和产物目录

### 2. 配置凭证
1. 进入「服务器凭证」或「SVN 凭证」页面
2. 添加对应环境的凭证信息
3. 可测试连接是否正常

### 3. 执行发布
1. 进入「发布」页面
2. 选择项目和分支
3. 选择发布类型和凭证
4. 配置目标路径
5. 点击「开始发布」

### 4. 使用模板
1. 在发布页面配置好后，可保存为模板
2. 下次直接在「发布模板」页面使用模板快速发布

## 安全说明

- 所有密码使用 AES-256-CBC 加密存储
- 导出配置时可选是否包含密码
- 日志中不记录敏感信息

## 许可证

MIT License
