# QueryForge 前端（SQL 工作台）

React 18 + TypeScript + Vite 6 + Tailwind CSS 4。当前阶段完成 C0–C4 的最小 SQL 工作台闭环。

## 已实现

| 区域 | 状态 |
| --- | --- |
| 工作台 Dashboard | 真实：SSE 流式生成 SQL、显式执行、真实结果表、取消/重试/错误态 |
| 后端连接状态 | 真实：周期探测 `GET /api/health`，停服显示“后端未连接” |
| 登录 | 演示会话：仅前端状态，不具备鉴权含义 |
| 数据库连接 | 演示数据：本地内存编辑，不连接真实数据源 |
| 历史记录 | 演示数据：搜索/详情/删除均为前端状态 |
| 设置 | 真实本地偏好：主题、SQL 字号、恢复默认，写入 `localStorage` |

## 环境要求

- Node.js 20+（验证使用 22.22.2）
- 后端默认运行在 `http://127.0.0.1:8080`
- 开发代理：`/api → http://127.0.0.1:8080`

## 启动

```bash
npm install
npm run dev
```

默认端口 5173。本机 5173 被其他项目占用时：

```bash
npm run dev -- --port 5174 --strictPort
```

打开 `http://127.0.0.1:5174/`，使用任意合法邮箱 + 任意非空密码进入演示工作台（例如 `demo@queryforge.local` / `demo-password`）。

## 质量检查

```bash
npm run format:check   # Prettier
npm run lint           # ESLint 9
npm run typecheck      # tsc -b (strict)
npm test               # Vitest + Testing Library
npm run build          # 生产构建
npm run check          # 以上五项串联
```

当前基线：9 个测试文件、40 个用例通过，Lint 0 error / 0 warning。

## 接口契约

- `GET /api/health`
- `POST /api/v1/sql/generate/stream`（`start` / `delta` / `complete` / `error`）
- `POST /api/v1/sql/execute`（`columns` / `rows` / `rowCount` / `truncated`）

前端不直接连接数据库，不接收/保存数据库凭据或模型密钥。

## 目录

```text
src/
├── api/                  # 契约类型、fetch 客户端、SSE 解析
├── components/           # 布局与通用 UI
├── features/sql-workspace/  # 工作台状态机与三个展示区块
├── hooks/                # 后端健康、会话、偏好、复制
├── mocks/                # 明确标注的演示数据
├── pages/                # 页面组合
└── types/
```

## 已知限制

- 无真实模型凭据时，生成接口返回 `MODEL_NOT_CONFIGURED`；界面会提示但不会伪造 SQL。
- 登录、数据库连接、历史记录尚未接入后端。
- 未引入 React Router / 全局状态库 / UI 组件库；当前规模不需要。
