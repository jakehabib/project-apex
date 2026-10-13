import { HARBOR_LAYOUT } from './harbor.layout';
import { compileTileMap, type TileMapSource } from './tilemap';

/** Tile centre in map units (tile = 20 units = 2 m). */
const at = (c: number, r: number) => ({ x: c * 20 + 10, y: r * 20 + 10 });

/**
 * HARBOR — original dockside map (layout authored in scripts/maps/harbor.py).
 * A Docks: Long Pier / Market Stairs / Ice House; B Warehouse: Rail Doors / Cold Storage.
 */
export const HARBOR_SOURCE: TileMapSource = {
  id: 'harbor',
  name: 'Harbor',
  version: 6,
  cell: 20,
  theme: {
    void: 0x0a0f14, floor: 0x2a3540, floorAlt: 0x24303a, wall: 0x5d6f7e,
    obstacleHigh: 0x4a5a68, obstacleLow: 0x3a4854, siteTint: 0xe8a33d, accent: 0x3ee6c4,
  },
  layout: HARBOR_LAYOUT,
  callouts: [
    { name: 'Freight Gate', rect: [26, 47, 54, 57], zone: 'attacker_spawn' },
    { name: 'Harbormaster', rect: [31, 1, 46, 9], zone: 'defender_spawn' },
    { name: 'Net Shed', rect: [5, 7, 9, 10] },
    { name: 'A Docks', rect: [5, 7, 28, 21] },
    { name: 'Jetty', rect: [5, 1, 29, 6] },
    { name: 'Customs Lane', rect: [5, 46, 27, 51] },
    { name: 'Long Pier', rect: [5, 22, 9, 45] },
    { name: 'Market Alley', rect: [15, 36, 19, 45] },
    { name: 'Ice Room', rect: [14, 23, 17, 26] },
    { name: 'Market Stairs', rect: [20, 22, 23, 26] },
    { name: 'Fish Market', rect: [14, 27, 30, 35] },
    { name: 'Ice House', rect: [26, 20, 33, 25] },
    { name: 'Harbormaster Walk', rect: [24, 9, 31, 12] },
    { name: 'Sheds', rect: [46, 2, 76, 8] },
    { name: 'Upper Walkway', rect: [46, 9, 55, 10] },
    { name: 'Crane Lane', rect: [38, 10, 41, 25] },
    { name: 'Crane Yard', rect: [30, 26, 49, 37] },
    { name: 'Container Stacks', rect: [35, 38, 45, 46] },
    { name: 'Rail Doors', rect: [66, 25, 69, 26] },
    { name: 'B Warehouse', rect: [56, 9, 75, 24] },
    { name: 'Rail Cut', rect: [64, 27, 72, 49] },
    { name: 'Rail Cut South', rect: [50, 47, 72, 51] },
    { name: 'Cold Room', rect: [50, 18, 56, 27] },
    { name: 'Cold Storage', rect: [50, 28, 57, 31] },
  ],
  spots: {
    t1: { at: [30, 51], tags: ['attacker_spawn'] },
    t2: { at: [36, 52], tags: ['attacker_spawn'] },
    t3: { at: [42, 51], tags: ['attacker_spawn'] },
    t4: { at: [50, 51], tags: ['attacker_spawn'] },
    t5: { at: [40, 54], tags: ['attacker_spawn'] },
    c1: { at: [32, 6], tags: ['defender_spawn'] },
    c2: { at: [38, 6], tags: ['defender_spawn'] },
    c3: { at: [40, 3], tags: ['defender_spawn'] },
    c4: { at: [44, 6], tags: ['defender_spawn'] },
    c5: { at: [37, 8], tags: ['defender_spawn'] },
    // A
    a_center: { at: [16, 17], tags: ['plant'] },
    a_default: { at: [21, 12], tags: ['plant'] },
    a_corner: { at: [9, 13], tags: ['hold'] },
    a_back: { at: [25, 14], tags: ['hold'] },
    a_stairs: { at: [22, 20], tags: ['hold'] },
    a_box: { at: [11, 18] },
    a_pier_mouth: { at: [7, 21], tags: ['choke'] },
    stairs_top: { at: [21, 22], tags: ['choke'] },
    ice_house: { at: [28, 24], tags: ['choke'] },
    walk: { at: [28, 10], tags: ['retake'] },
    pier_foot: { at: [12, 48], tags: ['lurk'] },
    market_w: { at: [16, 31] },
    market_e: { at: [28, 31] },
    // Mid
    mid_w: { at: [34, 30] },
    mid_n: { at: [36, 27] },
    lane_top: { at: [39, 12], tags: ['hold'] },
    lane_mid: { at: [40, 20], tags: ['hold'] },
    stacks: { at: [38, 43] },
    // B
    b_aisle: { at: [64, 14], tags: ['plant'] },
    b_dock: { at: [61, 21], tags: ['plant'] },
    b_cold: { at: [57, 14], tags: ['hold'] },
    b_loft: { at: [74, 12], tags: ['hold'] },
    b_rack: { at: [67, 18], tags: ['hold'] },
    b_office: { at: [70, 21], tags: ['hold'] },
    b_doors: { at: [67, 25], tags: ['choke'] },
    cold_door: { at: [55, 21], tags: ['choke'] },
    cold_corr: { at: [57, 30] },
    rail_corner: { at: [60, 49], tags: ['lurk'] },
    rail_mid: { at: [65, 38] },
    sheds_back: { at: [59, 6], tags: ['retake'] },
    loft_top: { at: [74, 6], tags: ['retake'] },
  },
  strategy: {
    sites: {
      A: {
        routes: [
          { id: 'pier', name: 'Long Pier', stage: 'pier_foot', entry: 'a_pier_mouth', clear: ['a_box', 'a_corner', 'a_center'] },
          { id: 'stairs', name: 'Market Stairs', stage: 'market_w', entry: 'stairs_top', clear: ['a_stairs', 'a_center', 'a_default'] },
          { id: 'ice', name: 'Ice House', stage: 'mid_w', entry: 'ice_house', clear: ['a_back', 'a_default', 'a_stairs'] },
        ],
        postPlant: ['a_box', 'stairs_top', 'ice_house', 'a_pier_mouth'],
        ctAnchors: ['a_back', 'a_corner', 'a_stairs'],
        retakeStage: ['walk'],
        execSmokes: [
          { route: 'pier', target: at(27, 10) },
          { route: 'stairs', target: at(27, 10) },
          { route: 'ice', target: at(25, 12) },
          { route: 'stairs', target: at(10, 13) },
        ],
        execFlashes: [
          { route: 'pier', target: at(7, 19) },
          { route: 'stairs', target: at(21, 19) },
          { route: 'ice', target: at(27, 20) },
        ],
        ctDelay: [
          { route: 'pier', target: at(7, 30) },
          { route: 'stairs', target: at(21, 24) },
          { route: 'ice', target: at(29, 24) },
        ],
      },
      B: {
        routes: [
          { id: 'doors', name: 'Rail Doors', stage: 'rail_corner', entry: 'b_doors', clear: ['b_rack', 'b_dock', 'b_office'] },
          { id: 'cold', name: 'Cold Storage', stage: 'cold_corr', entry: 'cold_door', clear: ['b_cold', 'b_dock', 'b_aisle'] },
        ],
        postPlant: ['b_doors', 'cold_door', 'b_rack', 'b_cold'],
        ctAnchors: ['b_cold', 'b_aisle', 'b_loft', 'b_office'],
        retakeStage: ['sheds_back', 'loft_top'],
        execSmokes: [
          { route: 'doors', target: at(59, 9) },
          { route: 'cold', target: at(59, 9) },
          { route: 'doors', target: at(74, 9) },
        ],
        execFlashes: [
          { route: 'doors', target: at(67, 22) },
          { route: 'cold', target: at(57, 21) },
        ],
        ctDelay: [
          { route: 'doors', target: at(67, 30) },
          { route: 'cold', target: at(52, 29) },
        ],
      },
    },
    midHolds: ['lane_top', 'lane_mid'],
    tControl: ['stacks', 'mid_w', 'market_e', 'rail_mid'],
    lurks: ['pier_foot', 'rail_corner'],
    ctInfo: ['mid_n', 'cold_corr'],
    controls: [
      // Crane Yard: the defenders watch it from Crane Lane; a smoke at the lane mouth lets attackers cross.
      { id: 'yard', name: 'Crane Yard', spots: ['mid_w', 'stacks'], contest: ['lane_mid', 'mid_n'], smoke: at(40, 25), unlocks: ['ice', 'cold'] },
      { id: 'market', name: 'Fish Market', spots: ['market_w', 'market_e'], contest: ['stairs_top', 'ice_house'], unlocks: ['stairs', 'ice'] },
      { id: 'rail', name: 'Rail Cut', spots: ['rail_mid', 'rail_corner'], contest: ['b_doors'], smoke: at(67, 27), unlocks: ['doors'] },
      { id: 'pier', name: 'Long Pier', spots: ['pier_foot'], contest: ['a_pier_mouth'], unlocks: ['pier'] },
    ],
  },
};

export const HARBOR = compileTileMap(HARBOR_SOURCE);
