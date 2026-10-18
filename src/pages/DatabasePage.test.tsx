import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatabasePage } from './DatabasePage';

/** AC-12 / AC-13 / AC-14：列表与详情同步、保存有真实结果、不伪造连接成功。 */
describe('DatabasePage 演示连接', () => {
  it('TC-08 选择其它连接时表单内容同步变化', async () => {
    const user = userEvent.setup();
    render(<DatabasePage />);

    expect(screen.getByLabelText('连接名称')).toHaveValue('示例商店业务库');
    expect(screen.getByLabelText('主机')).toHaveValue('demo-db.internal');

    await user.click(screen.getByRole('button', { name: /示例数据仓库/ }));

    expect(screen.getByLabelText('连接名称')).toHaveValue('示例数据仓库');
    expect(screen.getByLabelText('主机')).toHaveValue('demo-warehouse.internal');
    expect(screen.getByLabelText('端口')).toHaveValue(5432);
    expect(screen.getByLabelText('引擎类型')).toHaveValue('postgresql');
  });

  it('TC-13 保存修改会真实更新演示列表并给出反馈', async () => {
    const user = userEvent.setup();
    render(<DatabasePage />);

    const nameInput = screen.getByLabelText('连接名称');
    await user.clear(nameInput);
    await user.type(nameInput, '重命名后的演示库');
    await user.click(screen.getByRole('button', { name: /保存演示数据/ }));

    expect(screen.getByRole('button', { name: /重命名后的演示库/ })).toBeInTheDocument();
    expect(screen.getByText(/已更新「重命名后的演示库」的演示数据/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保存演示数据/ })).toBeDisabled();
  });

  it('TC-09 测试连接不伪装成真实数据库成功', async () => {
    const user = userEvent.setup();
    render(<DatabasePage />);

    await user.click(screen.getByRole('button', { name: '测试连接' }));

    expect(screen.getByText(/尚未接入数据库，未执行任何真实连接检测/)).toBeInTheDocument();
    expect(screen.queryByText(/连接成功|连通|握手成功|12ms/i)).toBeNull();
  });

  it('新增与移除只影响内存中的演示列表', async () => {
    const user = userEvent.setup();
    render(<DatabasePage />);
    const list = screen.getByRole('region', { name: '演示连接列表' });

    await user.click(screen.getByRole('button', { name: /新增演示连接/ }));
    expect(within(list).getByRole('button', { name: /新演示连接/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /移除该演示连接/ }));
    expect(within(list).queryByRole('button', { name: /新演示连接/ })).toBeNull();
    expect(screen.getByText(/已从演示列表移除/)).toBeInTheDocument();
  });
});
