import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 显式清理，避免同一文件内多个用例的 DOM 互相污染。
afterEach(() => {
  cleanup();
});
