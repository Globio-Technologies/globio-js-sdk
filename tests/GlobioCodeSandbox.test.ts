import { describe, expect, it } from 'vitest';
import { executeFunction } from '../../../workers/globio-code/src/sandbox';

describe('GlobalCode sandbox', () => {
  it('pure function returns correct result', async () => {
    const result = await executeFunction(
      'async function handler(input) { return { doubled: input.value * 2 }; }',
      { value: 2 },
      {}
    );

    expect(result.error).toBeNull();
    expect(result.result).toEqual({ doubled: 4 });
  });

  it('function with timeout returns timeout error', async () => {
    const result = await executeFunction(
      'async function handler() { await new Promise(() => {}); }',
      {},
      {},
      10
    );

    expect(result.error).toContain('Execution timeout');
  });

  it('function attempting to use fetch returns undefined not error', async () => {
    const result = await executeFunction(
      'async function handler() { return fetch; }',
      {},
      {}
    );

    expect(result.error).toBeNull();
    expect(result.result).toBeUndefined();
  });

  it('function using console.log captures logs without throwing', async () => {
    const result = await executeFunction(
      'async function handler() { console.log("hello", "world"); return { ok: true }; }',
      {},
      {}
    );

    expect(result.error).toBeNull();
    expect(result.result).toEqual({ ok: true });
  });

  it('function with syntax error returns error in result', async () => {
    const result = await executeFunction(
      'async function handler() {',
      {},
      {}
    );

    expect(result.result).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
