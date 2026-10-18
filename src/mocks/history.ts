import type { QueryHistoryItem } from '../types';

/** 固定的演示历史记录，不涉及任何数据库读取。 */
export const mockHistory: QueryHistoryItem[] = [
  {
    id: 'qry-20240511-01',
    title: '统计每个月的订单金额',
    prompt: '统计每个月的订单金额',
    sql: `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
       SUM(amount) AS total_amount
FROM demo_orders
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month;`,
    createdAt: '2026-10-16 09:24',
    demoStatus: 'example-success',
  },
  {
    id: 'qry-20240511-02',
    title: '查询近 30 天新增客户数',
    prompt: '近 30 天每天新增了多少客户？',
    sql: `SELECT DATE(created_at) AS day,
       COUNT(*) AS new_customers
FROM demo_customers
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY day;`,
    createdAt: '2026-10-15 14:02',
    demoStatus: 'example-success',
  },
  {
    id: 'qry-20240510-01',
    title: '销量前十的商品分类',
    prompt: '哪十个商品分类的销量最高？',
    sql: `SELECT category_name,
       SUM(quantity) AS units_sold
FROM demo_order_items
GROUP BY category_name
ORDER BY units_sold DESC
LIMIT 10;`,
    createdAt: '2026-10-14 17:41',
    demoStatus: 'example-success',
  },
  {
    id: 'qry-20240510-02',
    title: '未支付订单占比（演示失败样例）',
    prompt: '统计未支付订单的比例',
    sql: `SELECT SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) / COUNT(*)
FROM demo_orders
WHERE deleted_at IS NOT NULL;`,
    createdAt: '2026-10-13 11:08',
    demoStatus: 'example-failed',
  },
  {
    id: 'qry-20240509-01',
    title: '各渠道退款金额汇总',
    prompt: '按渠道汇总退款金额',
    sql: `SELECT channel,
       SUM(refund_amount) AS refund_total
FROM demo_refunds
GROUP BY channel
ORDER BY refund_total DESC;`,
    createdAt: '2026-10-12 20:35',
    demoStatus: 'example-success',
  },
];
