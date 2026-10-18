import type { ConnectionEntry } from '../types';

/**
 * 演示用连接列表（虚构凭据，不代表任何真实环境）。
 * 修改只存在于内存，刷新页面后回到初始值。
 */
export const mockConnections: ConnectionEntry[] = [
  {
    id: 'conn-sample-shop',
    name: '示例商店业务库',
    engine: 'mysql',
    host: 'demo-db.internal',
    port: 3306,
    demoStatus: 'sample-active',
    draft: {
      name: '示例商店业务库',
      engine: 'mysql',
      host: 'demo-db.internal',
      port: 3306,
      username: 'demo_reader',
      database: 'demo_shop',
    },
  },
  {
    id: 'conn-sample-warehouse',
    name: '示例数据仓库',
    engine: 'postgresql',
    host: 'demo-warehouse.internal',
    port: 5432,
    demoStatus: 'sample-idle',
    draft: {
      name: '示例数据仓库',
      engine: 'postgresql',
      host: 'demo-warehouse.internal',
      port: 5432,
      username: 'demo_analyst',
      database: 'demo_warehouse',
    },
  },
  {
    id: 'conn-sample-report',
    name: '示例只读报表库',
    engine: 'mysql',
    host: 'demo-report.internal',
    port: 3307,
    demoStatus: 'sample-idle',
    draft: {
      name: '示例只读报表库',
      engine: 'mysql',
      host: 'demo-report.internal',
      port: 3307,
      username: 'demo_viewer',
      database: 'demo_reporting',
    },
  },
];

/** 新建连接时的空模板。 */
export function createEmptyConnectionDraft(id: string): ConnectionEntry {
  return {
    id,
    name: '新演示连接',
    engine: 'mysql',
    host: 'new-demo-host',
    port: 3306,
    demoStatus: 'sample-idle',
    draft: {
      name: '新演示连接',
      engine: 'mysql',
      host: 'new-demo-host',
      port: 3306,
      username: 'demo_user',
      database: 'demo',
    },
  };
}
