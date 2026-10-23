import { describe, expect, it } from 'vitest';
import { normalizePlanReview } from './useAgentRun';

type Wire = Parameters<typeof normalizePlanReview>[0];

const wire = {
  required: true,
  status: 'AWAITING',
  hitlVersion: 2,
  reason: '涉及经营指标',
  rejectionCount: 1,
  autoConfirm: false,
  plan: [],
} as unknown as Wire;

describe('normalizePlanReview', () => {
  it('把详情接口的等待态映射为可操作审核视图', () => {
    const view = normalizePlanReview(wire, 'WAITING_PLAN_REVIEW');
    expect(view).not.toBeNull();
    expect(view?.triggered).toBe(true);
    expect(view?.awaiting).toBe(true);
    expect(view?.hitlVersion).toBe(2);
    expect(view?.rejectionCount).toBe(1);
    expect(view?.remainingRejections).toBe(2);
    expect(view?.autoConfirm).toBe(false);
  });

  it('已批准的计划不再可操作', () => {
    const view = normalizePlanReview({ ...wire, status: 'APPROVED' } as unknown as Wire, 'WAITING_APPROVAL');
    expect(view?.triggered).toBe(true);
    expect(view?.awaiting).toBe(false);
  });

  it('已取消的 Run 即使残留 AWAITING 也不显示可批准按钮', () => {
    const view = normalizePlanReview(wire, 'CANCELED');
    expect(view?.awaiting).toBe(false);
  });

  it('未触发 Gate 的旧 Run 返回 null', () => {
    expect(normalizePlanReview(null, 'COMPLETED')).toBeNull();
  });
});
