import { describe, expect, it } from 'vitest';

import { filterStops } from './stopSearch';

const stops = [
  { id: '1', name: 'Station 1 (Metro)' },
  { id: '2', name: 'Dream City' },
  { id: '3', name: 'Metro Gate 2' },
  { id: '4', name: 'City Hospital' },
];

describe('filterStops', () => {
  it('returns every stop for an empty or blank query', () => {
    expect(filterStops(stops, '')).toEqual(stops);
    expect(filterStops(stops, '   ')).toEqual(stops);
  });

  it('matches any part of the name, ignoring case', () => {
    expect(filterStops(stops, 'HOSP').map((s) => s.id)).toEqual(['4']);
  });

  it('lists names that start with the query first', () => {
    expect(filterStops(stops, 'metro').map((s) => s.id)).toEqual(['3', '1']);
    expect(filterStops(stops, 'city').map((s) => s.id)).toEqual(['4', '2']);
  });

  it('ignores extra spaces', () => {
    expect(filterStops(stops, '  dream   city ').map((s) => s.id)).toEqual(['2']);
  });

  it('returns nothing when no stop matches', () => {
    expect(filterStops(stops, 'airport')).toEqual([]);
  });
});
