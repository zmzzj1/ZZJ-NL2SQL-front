# QueryForge 前端（真实用户与多数据源 SQL 工作台）

React 18 + TypeScript + Vite 6 + Tailwind CSS 4。完成 P2 C5–C9：真实身份、MySQL 连接管理、Schema 浏览、按数据源生成与执行 SQL。

## 已实现

| 区域 | 状态 |
| --- | --- |
| 注册/登录/退出/会话恢复 | 真实：服务端 Session + HttpOnly Cookie + CSRF |
| 数据库连接管理 | 真实：CRUD、连通性测试、密码加密保存、归属隔离 |
| Schema 浏览 | 真实：JDBC 元数据读取表/列/类型，可刷新 |
| Dashboard | 真实：选择数据源、按连接生成 SQL、显式执行、真实结果表 |
| 切换数据源 | 取消旧 SSE、清空旧 SQL/结果，生成与执行共用 connectionId |
| 历史记录 | 演示数据（页面明确标注） |
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

当前基线：9 个测试文件、46 个用例，lint 0 error / 0 warning。

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
| POST | `/api/v1/sql/generate/stream` | SSE：`{userInput,connectionId,strategyName}` |
| POST | `/api/v1/sql/execute` | 只读执行：`{connectionId,sql}` |

错误体统一 `{code,message,requestId}`；前端按 `code` 展示文案。

## 目录

```text
src/
├── api/                      # 契约、CSRF/Session 客户端、SSE 解析
├── features/sql-workspace/   # 工作台状态机与展示
├── features/connections/     # 连接列表/表单/Schema
├── hooks/                    # useAuth、健康检查、偏好
├── pages/                    # 五个页面组合
└── mocks/                    # 仅 History 演示数据
```

## 已知限制

- 仅支持 MySQL 连接；PostgreSQL 明确标注暂不支持。
- 历史记录仍为演示数据。
- 真实模型未验证（无 Key）；无 Key 时生成接口返回 `MODEL_NOT_CONFIGURED`。
- Session 存服务端内存，后端重启需重新登录；连接配置已持久化。
