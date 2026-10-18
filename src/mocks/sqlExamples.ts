import type { DemoResultTable } from '../types';

/** 一条演示问答：命中关键词时展示的固定 SQL 与固定结果。 */
export interface DemoSqlExample {
  id: string;
  /** 用于匹配用户输入以及「试试这些问题」快捷入口的标题。 */
  title: string;
  keywords: string[];
  reply: string;
  sql: string;
  result: DemoResultTable;
}

const monthlyOrderAmount: DemoSqlExample = {
  id: 'demo-monthly-order-amount',
  title: '统计每个月的订单金额',
  keywords: ['每月', '每个月', '订单金额', '月度金额', 'monthly'],
  reply:
    '下面是本项目的固定演示 SQL。它只对前端内置的示例数据有意义，没有连接任何数据库，也没有经过 LLM 或后端服务处理。',
  sql: `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
       SUM(amount) AS total_amount
FROM demo_orders
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month;`,
  result: {
    columns: ['month', 'total_amount'],
    rows: [
      ['2026-05', '1284300.00'],
      ['2026-06', '1412750.50'],
      ['2026-07', '1198640.00'],
      ['2026-08', '1530920.75'],
    ],
    note: '演示结果：4 行示例数据，非真实查询返回。',
  },
};

const dailyNewCustomers: DemoSqlExample = {
  id: 'demo-daily-new-customers',
  title: '查询近 30 天新增客户数',
  keywords: ['新增客户', '客户数', '增长', 'customer'],
  reply: '这是另一条固定演示 SQL，用于展示不同问法下的 SQL 结构差异，同样不涉及真实数据源。',
  sql: `SELECT DATE(created_at) AS day,
       COUNT(*) AS new_customers
FROM demo_customers
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY day;`,
  result: {
    columns: ['day', 'new_customers'],
    rows: [
      ['2026-09-20', '128'],
      ['2026-09-21', '153'],
      ['2026-09-22', '97'],
    ],
    note: '演示结果：3 行示例数据，非真实查询返回。',
  },
};

const topCategories: DemoSqlExample = {
  id: 'demo-top-categories',
  title: '销量前十的商品分类',
  keywords: ['销量', '商品分类', '类目', 'category'],
  reply: '这条演示 SQL 展示了分组 + 排序 + LIMIT 的常见写法，输出同样来自前端写死的示例数据。',
  sql: `SELECT category_name,
       SUM(quantity) AS units_sold
FROM demo_order_items
GROUP BY category_name
ORDER BY units_sold DESC
LIMIT 10;`,
  result: {
    columns: ['category_name', 'units_sold'],
    rows: [
      ['数码配件', '8421'],
      ['家居日用', '7315'],
      ['户外运动', '6042'],
    ],
    note: '演示结果：3 行示例数据，非真实查询返回。',
  },
};

export const demoSqlExamples: DemoSqlExample[] = [monthlyOrderAmount, dailyNewCustomers, topCategories];

/** Dashboard 快捷入口使用的提问示例。 */
export const examplePrompts: string[] = demoSqlExamples.map((example) => example.title);

/** 未命中示例时的说明文案（明确表示当前不支持真实生成）。 */
export const demoOnlyReply =
  '当前仅支持演示提问：本项目 P0-F01 还没有接入后端与大模型，不会生成真实 SQL。可以试试上方「试试这些示例」中的问法查看固定演示结果。';

/** 按关键词匹配归档的演示样例；命中不了返回 undefined。 */
export function findDemoExample(question: string): DemoSqlExample | undefined {
  const normalized = question.trim().toLowerCase();
  return demoSqlExamples.find((example) =>
    example.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  );
}
