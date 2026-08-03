import { describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../src/shared/types';

describe('ipc channels', () => {
  it('keeps the documented 15 IPC channels', () => {
    expect(Object.values(IPC_CHANNELS)).toHaveLength(15);
  });
});
