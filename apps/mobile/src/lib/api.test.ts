import { describe, expect, it } from 'vitest';

import { cancelBooking, fetchDriverHome, fetchMyActiveBooking } from './api';

function mockClient(rpcResult: { data: unknown; error: unknown }) {
  return { rpc: () => Promise.resolve(rpcResult) } as never;
}

describe('API wrappers (unwrap behavior via public surface)', () => {
  it('returns data when the RPC succeeds', async () => {
    const client = mockClient({ data: { id: '123' }, error: null });
    const result = await fetchMyActiveBooking(client);
    expect(result).toEqual({ id: '123' });
  });

  it('throws the error object when the RPC fails', async () => {
    const err = { message: 'NOT_AUTHORISED', code: 'P0001' };
    const client = mockClient({ data: null, error: err });
    await expect(fetchDriverHome(client)).rejects.toEqual(err);
  });

  it('throws on error for mutation wrappers too', async () => {
    const err = { message: 'BOOKING_NOT_FOUND' };
    const client = mockClient({ data: null, error: err });
    await expect(cancelBooking(client, 'some-id')).rejects.toEqual(err);
  });
});
