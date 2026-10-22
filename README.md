# QueryForge 前端（真实用户与多数据源 SQL 工作台）

React 18 + TypeScript + Vite 6 + Tailwind CSS 4。已完成 P2–P5：真实身份与连接、会话与查询历史、SQL Agent 多步时间线（确认/纠错/恢复）、Manager 路由与多角色展示、业务知识页（CRUD + 检索预览）；P6–P8 新增分析报告、工作流、Agent Studio、Skills、工作空间、长期记忆和混合检索；P9 新增模型治理管理后台；P10 新增定时工作流调度与多标签 SQL Console；P11 新增 Agent 统一状态图轨迹、专业角色徽标与 L1–L4 上下文压缩元数据展示；P13 新增独立 Admin 服务提供的用户分页、平台统计、账号启停和用户 Token 配额维护；P14-A 新增 Agent 工具选择、参数表单、显式工具运行和安全结果时间线；P14-B/P14-C 新增 SQL 候选评分、分析与报告步骤状态和产物入口展示。

## 已实现

| 区域 | 状态 |
| --- | --- |
| 注册/登录/退出/会话恢复 | 真实：服务端 Session + HttpOnly Cookie + CSRF |
| 数据库连接管理 | 真实：CRUD、连通性测试、密码加密保存、归属隔离 |
| Schema 浏览 | 真实：JDBC 元数据读取表/列/类型，可刷新 |
| Dashboard | 真实：会话切换、单次 SQL 与 Agent 多步模式、显式执行、真实结果表 |
| 切换数据源 | 取消旧 SSE、清空旧 SQL/结果，生成与执行共用 connectionId |
| 会话与历史 | 真实：会话恢复/删除，查询历史筛选、详情与删除 |
| SQL Console | 真实：多标签 SQL、独立数据源与结果、Schema 浏览、CSV 安全导出 |
| Agent | 真实接口：自适应路由、规划时间线、SQL 多候选评分与唯一审批、逐步确认/拒绝、取消与运行恢复；闲聊、澄清与分类降级显示真实状态 |
| Agent 显式工具 | 真实：从服务端工具目录选择工具、按输入 Schema 填参、发送一次受控调用，并在时间线展示非 SQL 工具步骤与脱敏摘要 |
| Agent 状态图轨迹 | 真实：按 SSE `node.*` 事件展示统一状态图节点流，可展开状态图快照（历史恢复） |
| Agent 专业角色 | 真实：步骤显示后端 RoleAssigner 选定的专业角色徽标（与后端持久化角色一致） |
| 上下文压缩 | 真实：展示 L1–L4 分层压缩的脱敏元数据（输入 Token 估算、保留/丢弃、上下文指纹） |
| 业务知识 | 真实：术语/SQL 示例 CRUD，按连接与工作空间执行关键词、向量或混合检索 |
| 分析报告 | 真实：可从历史发起，也可由 Agent 在 SQL 审批执行后按依赖链进入隔离分析与报告；时间线展示分析/报告状态并可打开对应产物 |
| 可视化工作流 | 真实：DAG 编辑器、保存/更新、运行/审批续跑、节点状态、定时计划管理 |
| Agent Studio | 真实：创建/编辑/归档、工具白名单、RAG/Memory、Skill 绑定、发布/版本/回滚、草稿测试运行（SSE） |
| Skills | 真实：CRUD、发布不可变版本、模板白名单变量校验、版本历史 |
| 工作空间 | 真实：创建空间、成员角色管理、资源授权与撤销 |
| 长期记忆 | 真实：个人/空间记忆 CRUD、核验状态、禁用与检索 |
| 平台管理 | 真实：供应商与模型档案、授权、连接测试、调用监控、配额治理、用户分页、账号启停及平台统计概览；仅平台管理员可访问 |
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

P13-M2 全量基线：14 个测试文件、72 个用例，lint 0 error / 0 warning；生产构建通过。

P13-M3A 已定向验证 `npm run test -- AdminPage.test.tsx`（5/5）和 `npm run typecheck`。

P14-A 全量验证：`npm run check` 通过；15 个测试文件、77 个用例全部通过，Prettier、ESLint、TypeScript 与生产构建均通过（2026-10-23 实跑）。

P14-B/P14-C 全量验证：`npm run check` 通过；16 个测试文件、88 个用例全部通过，Prettier、ESLint、TypeScript 与生产构建均通过（2026-10-23 实跑）。

## P12 集成说明（2026-10-21）

- 后端身份体系迁移到 Sa-Token + Redis（会话 Cookie 名由 `JSESSIONID` 改为 `satoken`）；前端 `src/api/http.ts` 不解析会话 Cookie 名（仅 `credentials: 'include'` + CSRF 头 `X-XSRF-TOKEN`），**前端零改动**通过全部检查。
- 登录/登出/找回当前用户、知识检索（关键词/向量/混合）、长期记忆维护与检索、Agent/审批/Workflow/定时任务的 REST 与 SSE 契约保持不变。

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
| GET | `/api/v1/query-history/{id}/export` | 重新鉴权并执行查询后导出 CSV |
| POST | `/api/v1/sql/generate/stream` | 按会话和数据源流式生成 SQL |
| POST | `/api/v1/sql/execute` | 按会话和数据源执行只读 SQL |
| POST/GET | `/api/v1/agent/runs/**` | Agent 运行、确认、拒绝、取消与恢复 |
| POST/GET/PUT/DELETE | `/api/v1/knowledge/**` | 业务知识维护与检索 |
| GET/POST | `/api/v1/tools`、`/api/v1/tools/invoke` | 只读工具目录与调用 |
| POST/GET | `/api/v1/analysis/runs/**` | Python 隔离分析（SSE）与详情 |
| POST/GET/DELETE | `/api/v1/reports`、`/{id}`、`/{id}/preview` | 报告生成、读取与净化预览 |
| GET/POST | `/api/v1/mcp/servers`、`.../{name}/test`、`.../{tool}/call` | MCP 服务发现与只读调用 |
| POST/GET/PUT/DELETE | `/api/v1/workflows`、`/api/v1/workflows/{id}` | 工作流 DAG 定义与版本化 |
| POST | `/api/v1/workflows/{id}/runs/stream`、`.../approve/stream` | 工作流运行与审批续跑 |
| GET/POST/PATCH/DELETE | `/api/v1/schedules/**` | 定时计划、Cron 预览、启停、手动触发与运行历史 |
| GET/POST/PATCH/DELETE | `/api/v1/studio/agents/**` | Agent Studio：草稿、发布、版本、回滚、测试运行 |
| GET/POST/PATCH/DELETE | `/api/v1/skills/**` | Skill Registry：CRUD、发布、版本 |
| GET/POST/PATCH/DELETE | `/api/v1/workspaces/**` | 工作空间、成员角色与资源授权 |
| GET/POST/PATCH/DELETE | `/api/v1/memories/**` | 长期记忆维护与检索 |
| GET/POST/PATCH | `/api/v1/model/**` | 模型供应商、能力档案、授权与路由策略 |
| GET/POST | `/api/v1/admin/**` | 管理概览、模型用量、配额与审计 |
| GET | `/api/v1/admin/users` | 用户分页、关键词搜索，仅平台管理员 |
| GET | `/api/v1/admin/dashboard` | 用户与 SQL/Agent 运行统计概览，仅平台管理员 |
| GET | `/api/v1/admin/check` | 平台管理员权限自检 |
| PUT | `/api/v1/admin/users/{userId}/status` | 启用或停用用户，带确认与失败反馈 |
| PUT | `/api/v1/admin/users/{userId}/quota` | 修改用户级 Token 配额 |

错误体统一 `{code,message,requestId}`；前端按 `code` 展示文案。

## 目录

```text
src/
├── app/                      # 应用启动、登录态引导、工作区外壳与路由配置
├── api/                      # 契约、认证、业务接口、HTTP/SSE 客户端
├── features/agent/           # Agent 运行状态与时间线
├── features/connections/     # 连接列表/表单/Schema
├── features/conversations/   # 会话列表与操作
├── features/schedule/        # 工作流定时计划管理
├── features/sql-console/     # 多标签状态与 CSV 安全导出
├── features/sql-workspace/   # SQL 工作台状态机与展示
├── hooks/                    # useAuth、健康检查、偏好
├── pages/                    # 页面组合（Dashboard/SQL Console/知识/报告/工作流/Studio/Skills/空间/记忆/管理/设置）
└── mocks/                    # 设置页使用的静态 SQL 示例
```
