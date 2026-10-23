// Order of training locations on the calendars: by the display order set in Reference Data,
// then by name. A location with no order set goes last; 0 is a real order (it used to count as "none").

export const NO_ORDER = 999;

export function buildDisplayOrderMap(locations) {
  const map = {};
  (locations || []).forEach((location) => {
    map[location.name] = location.display_order ?? NO_ORDER;
  });
  return map;
}

export function compareLocations(orders, a, b) {
  const orderA = orders[a] ?? NO_ORDER;
  const orderB = orders[b] ?? NO_ORDER;
  return orderA !== orderB ? orderA - orderB : a.localeCompare(b);
}
