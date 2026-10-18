import { describe, expect, it, vi } from 'vitest';

describe('env probe', () => {
  it('navigator.clipboard override works', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    expect(typeof navigator.clipboard?.writeText).toBe('function');
    void navigator.clipboard.writeText('x');
    expect(writeText).toHaveBeenCalledWith('x');
  });
});
