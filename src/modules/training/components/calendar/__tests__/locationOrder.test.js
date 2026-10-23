import { buildDisplayOrderMap, compareLocations } from '../locationOrder';

describe('location order', () => {
  test('0 is a real order, only a missing order goes last', () => {
    const orders = buildDisplayOrderMap([{ name: 'A', display_order: 0 }, { name: 'B', display_order: 2 }, { name: 'C', display_order: null }]);
    expect(orders).toEqual({ A: 0, B: 2, C: 999 });
    expect(['C', 'B', 'A'].sort((x, y) => compareLocations(orders, x, y))).toEqual(['A', 'B', 'C']);
  });

  test('same order falls back to the name, and unknown locations go last', () => {
    const orders = { Leeds: 1, Dubai: 1 };
    expect(['Leeds', 'Zed', 'Dubai'].sort((x, y) => compareLocations(orders, x, y))).toEqual(['Dubai', 'Leeds', 'Zed']);
  });

  test('no rows gives an empty map', () => {
    expect(buildDisplayOrderMap(undefined)).toEqual({});
  });
});
