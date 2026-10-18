import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryPage } from './HistoryPage';

function setupClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

/** AC-15 / AC-16 / AC-17：搜索过滤、详情切换、空状态与复制。 */
describe('HistoryPage 演示记录', () => {
  let writeText: ReturnType<typeof setupClipboard>;

  beforeEach(() => {
    writeText = setupClipboard();
  });

  it('TC-10 关键词搜索能过滤演示记录，无匹配显示空状态', async () => {
    const user = userEvent.setup();
    render(<HistoryPage fontSize={14} />);

    await user.type(screen.getByLabelText('搜索演示记录'), '客户');

    expect(screen.getByRole('button', { name: /查询近 30 天新增客户数/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /销量前十的商品分类/ })).toBeNull();

    await user.clear(screen.getByLabelText('搜索演示记录'));
    await user.type(screen.getByLabelText('搜索演示记录'), 'zzz-not-exist');

    expect(screen.getByText('没有匹配的演示记录')).toBeInTheDocument();
    expect(screen.getByText(/没有包含「zzz-not-exist」的记录/)).toBeInTheDocument();
  });

  it('TC-11 点击记录切换详情内容', async () => {
    const user = userEvent.setup();
    render(<HistoryPage fontSize={14} />);

    expect(screen.getAllByText(/qry-20240511-01/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /销量前十的商品分类/ }));

    expect(screen.getAllByText(/qry-20240510-01/).length).toBeGreaterThan(0);
    expect(screen.getByText(/哪十个商品分类的销量最高？/)).toBeInTheDocument();
    expect(screen.getAllByText(/category_name/).length).toBeGreaterThan(0);
  });

  it('TC-17 详情页复制 SQL 写入剪贴板', async () => {
    const user = userEvent.setup();
    writeText = setupClipboard();
    render(<HistoryPage fontSize={14} />);

    await user.click(screen.getByRole('button', { name: /复制 SQL/ }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('SUM(amount) AS total_amount');
    expect(screen.getByText('已复制')).toBeInTheDocument();
  });

  it('重新执行按钮禁用，删除演示记录后有空状态', async () => {
    const user = userEvent.setup();
    render(<HistoryPage fontSize={14} />);

    expect(screen.getByRole('button', { name: /重新执行（待后端接入）/ })).toBeDisabled();

    for (const name of [
      /统计每个月的订单金额/,
      /查询近 30 天新增客户数/,
      /销量前十的商品分类/,
      /未支付订单占比/,
      /各渠道退款金额汇总/,
    ]) {
      await user.click(screen.getByRole('button', { name }));
      await user.click(screen.getByRole('button', { name: /移除该演示记录/ }));
    }

    expect(screen.getByText('演示记录为空')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /恢复演示数据/ }));
    expect(screen.getByRole('button', { name: /统计每个月的订单金额/ })).toBeInTheDocument();
  });
});
