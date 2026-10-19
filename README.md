# QueryForge 前端（真实用户与多数据源 SQL 工作台）

React 18 + TypeScript + Vite 6 + Tailwind CSS 4。已完成 P2–P5：真实身份与连接、会话与查询历史、SQL Agent 多步时间线（确认/纠错/恢复）、Manager 路由与多角色展示、业务知识页（CRUD + 检索预览）。

## 已实现

| 区域 | 状态 |
| --- | --- |
| 注册/登录/退出/会话恢复 | 真实：服务端 Session + HttpOnly Cookie + CSRF |
| 数据库连接管理 | 真实：CRUD、连通性测试、密码加密保存、归属隔离 |
| Schema 浏览 | 真实：JDBC 元数据读取表/列/类型，可刷新 |
| Dashboard | 真实：会话切换、单次 SQL 与 Agent 多步模式、显式执行、真实结果表 |
| 切换数据源 | 取消旧 SSE、清空旧 SQL/结果，生成与执行共用 connectionId |
| 会话与历史 | 真实：会话恢复/删除，查询历史筛选、详情与删除 |
| Agent | 真实接口：规划时间线、逐步确认/拒绝、取消与运行恢复 |
| 业务知识 | 真实：术语/SQL 示例 CRUD、按连接关键词检索预览 |
| 设置 | 本地主题与 SQL 字号 |

## 环境要求

- Node.js 20+（验证使用 22.22.2）
- 后端默认 `http://127.0.0.1:8080`
- Vite 代理：`/api → http://127.0.0.1:8080`

## 启动

```bash
npm install
npm run dev
```

5173 被占用时：

```bash
npm run dev -- --port 5174 --strictPort
```

打开 `http://127.0.0.1:5174/`，先注册账号，再到「数据库连接」创建 MySQL 数据源。

## 质量检查

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run check   # 五项串联
```

当前基线：10 个测试文件、51 个用例，lint 0 error / 0 warning；生产构建通过。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录，建立 Session |
| GET | `/api/v1/auth/me` | 当前用户 |
| POST | `/api/v1/auth/logout` | 退出 |
| GET | `/api/v1/auth/csrf` | CSRF Token |
| GET/POST | `/api/v1/connections` | 列表/新增 |
| PATCH/DELETE | `/api/v1/connections/{id}` | 修改/删除 |
| POST | `/api/v1/connections/{id}/test` | 真实连接测试 |
| GET | `/api/v1/connections/{id}/schema` | 真实表结构 |
| GET/POST | `/api/v1/conversations` | 会话列表/新建 |
| GET/DELETE | `/api/v1/conversations/{id}` | 会话详情/删除 |
| GET/DELETE | `/api/v1/query-history[/{id}]` | 查询历史列表、详情与删除 |
| POST | `/api/v1/sql/generate/stream` | 按会话和数据源流式生成 SQL |
| POST | `/api/v1/sql/execute` | 按会话和数据源执行只读 SQL |
| POST/GET | `/api/v1/agent/runs/**` | Agent 运行、确认、拒绝、取消与恢复 |
| POST/GET/PUT/DELETE | `/api/v1/knowledge/**` | 业务知识维护与检索 |

错误体统一 `{code,message,requestId}`；前端按 `code` 展示文案。

## 目录

```text
src/
├── api/                      # 契约、认证、业务接口、HTTP/SSE 客户端
├── features/agent/           # Agent 运行状态与时间线
├── features/connections/     # 连接列表/表单/Schema
├── features/conversations/   # 会话列表与操作
├── features/sql-workspace/   # SQL 工作台状态机与展示
├── hooks/                    # useAuth、健康检查、偏好
├── pages/                    # 五个页面组合
└── mocks/                    # 设置页使用的静态 SQL 示例
```
