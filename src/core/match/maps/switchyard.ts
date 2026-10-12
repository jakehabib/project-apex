import { SWITCHYARD_LAYOUT } from './switchyard.layout';
import { compileTileMap, type TileMapSource } from './tilemap';

const at = (c: number, r: number) => ({ x: c * 20 + 10, y: r * 20 + 10 });

/**
 * SWITCHYARD — original rail-yard map (layout authored in scripts/maps/switchyard.py).
 * A Platform: Tracks / Footbridge; B Coal Sheds: Coal Gate / Boiler House.
 */
export const SWITCHYARD_SOURCE: TileMapSource = {
  id: 'switchyard',
  name: 'Switchyard',
  version: 5,
  cell: 20,
  theme: {
    void: 0x0b0d10, floor: 0x37332d, floorAlt: 0x2f2c27, wall: 0x6d6457,
    obstacleHigh: 0x564e44, obstacleLow: 0x453f37, siteTint: 0xe8a33d, accent: 0x3ee6c4,
  },
  layout: SWITCHYARD_LAYOUT,
  callouts: [
    { name: 'Signal Tower', rect: [28, 2, 46, 9], zone: 'defender_spawn' },
    { name: 'Depot', rect: [52, 50, 74, 57], zone: 'attacker_spawn' },
    { name: 'Tower Bridge', rect: [47, 4, 53, 8] },
    { name: 'Water Tower', rect: [8, 4, 27, 8] },
    { name: 'Water Path', rect: [8, 9, 13, 17] },
    { name: 'Signal Cut', rect: [21, 9, 25, 17] },
    { name: 'A Platform', rect: [53, 9, 73, 21] },
    { name: 'Tracks', rect: [74, 9, 77, 50] },
    { name: 'Footbridge', rect: [46, 20, 54, 21] },
    { name: 'Footbridge Stairs', rect: [46, 22, 49, 30] },
    { name: 'Signal Alley', rect: [36, 10, 39, 18] },
    { name: 'Roundhouse', rect: [29, 18, 45, 22] },
    { name: 'Turntable', rect: [28, 23, 46, 37] },
    { name: 'Boiler House', rect: [23, 24, 30, 31] },
    { name: 'Coal Sheds', rect: [4, 18, 22, 33] },
    { name: 'Coal Gate', rect: [10, 34, 15, 35] },
    { name: 'Coal Road', rect: [10, 36, 15, 49] },
    { name: 'Loading Ramp', rect: [46, 36, 51, 49] },
    { name: 'Depot Apron', rect: [57, 44, 74, 49] },
    { name: 'Freight Road', rect: [16, 45, 56, 49] },
  ],
  spots: {
    c1: { at: [37, 8], tags: ['defender_spawn'] },
    c2: { at: [33, 7], tags: ['defender_spawn'] },
    c3: { at: [40, 7], tags: ['defender_spawn'] },
    c4: { at: [45, 5], tags: ['defender_spawn'] },
    c5: { at: [30, 4], tags: ['defender_spawn'] },
    t1: { at: [53, 51], tags: ['attacker_spawn'] },
    t2: { at: [61, 51], tags: ['attacker_spawn'] },
    t3: { at: [63, 55], tags: ['attacker_spawn'] },
    t4: { at: [72, 51], tags: ['attacker_spawn'] },
    t5: { at: [72, 56], tags: ['attacker_spawn'] },
    // A
    a_center: { at: [62, 15], tags: ['plant'] },
    a_east: { at: [69, 15], tags: ['plant'] },
    a_ticket: { at: [57, 12], tags: ['hold'] },
    a_kiosk: { at: [66, 18], tags: ['hold'] },
    a_gap: { at: [70, 13], tags: ['hold'] },
    train_gap: { at: [72, 16], tags: ['choke'] },
    bridge_top: { at: [52, 21], tags: ['choke'] },
    tower_landing: { at: [53, 8], tags: ['retake'] },
    tracks_s: { at: [76, 40], tags: ['lurk'] },
    ramp_top: { at: [50, 37] },
    // Mid
    alley: { at: [37, 15], tags: ['hold'] },
    roundhouse: { at: [42, 21], tags: ['hold'] },
    mid_n: { at: [33, 24] },
    roundhouse_w: { at: [30, 21] },
    ramp: { at: [49, 40] },
    mid_s: { at: [33, 36] },
    freight: { at: [30, 46] },
    // B
    b_center: { at: [14, 25], tags: ['plant'] },
    b_conveyor: { at: [14, 31], tags: ['plant'] },
    b_shed: { at: [19, 23], tags: ['hold'] },
    b_heap: { at: [7, 24], tags: ['hold'] },
    b_door_hold: { at: [20, 27], tags: ['hold'] },
    coal_gate: { at: [12, 34], tags: ['choke'] },
    boiler_door: { at: [22, 30], tags: ['choke'] },
    coal_road: { at: [12, 44], tags: ['lurk'] },
    boiler_e: { at: [37, 37] },
    water_s: { at: [10, 16], tags: ['retake'] },
    signal_cut: { at: [23, 15], tags: ['retake'] },
  },
  strategy: {
    sites: {
      A: {
        routes: [
          { id: 'tracks', name: 'Tracks', stage: 'tracks_s', entry: 'train_gap', clear: ['a_gap', 'a_east', 'a_kiosk'] },
          { id: 'bridge', name: 'Footbridge', stage: 'ramp_top', entry: 'bridge_top', clear: ['a_ticket', 'a_center', 'a_kiosk'] },
        ],
        postPlant: ['a_kiosk', 'train_gap', 'bridge_top', 'a_gap'],
        ctAnchors: ['a_ticket', 'a_gap', 'a_kiosk'],
        retakeStage: ['tower_landing'],
        execSmokes: [
          { route: 'tracks', target: at(53, 8) },
          { route: 'bridge', target: at(53, 8) },
          { route: 'bridge', target: at(58, 11) },
        ],
        execFlashes: [
          { route: 'tracks', target: at(71, 15) },
          { route: 'bridge', target: at(54, 19) },
        ],
        ctDelay: [
          { route: 'tracks', target: at(75, 30) },
          { route: 'bridge', target: at(47, 26) },
        ],
      },
      B: {
        routes: [
          { id: 'gate', name: 'Coal Gate', stage: 'coal_road', entry: 'coal_gate', clear: ['b_conveyor', 'b_center', 'b_heap'] },
          { id: 'boiler', name: 'Boiler House', stage: 'boiler_e', entry: 'boiler_door', clear: ['b_door_hold', 'b_center', 'b_shed'] },
        ],
        postPlant: ['b_conveyor', 'boiler_door', 'coal_gate', 'b_door_hold'],
        ctAnchors: ['b_shed', 'b_heap', 'b_door_hold'],
        retakeStage: ['signal_cut', 'water_s'],
        execSmokes: [
          { route: 'gate', target: at(10, 18) },
          { route: 'boiler', target: at(22, 18) },
          { route: 'gate', target: at(22, 18) },
        ],
        execFlashes: [
          { route: 'gate', target: at(12, 32) },
          { route: 'boiler', target: at(20, 30) },
        ],
        ctDelay: [
          { route: 'gate', target: at(12, 38) },
          { route: 'boiler', target: at(26, 25) },
        ],
      },
    },
    midHolds: ['alley', 'roundhouse'],
    tControl: ['ramp', 'mid_s', 'freight', 'tracks_s'],
    lurks: ['coal_road', 'tracks_s'],
    ctInfo: ['mid_n', 'roundhouse_w'],
  },
};

export const SWITCHYARD = compileTileMap(SWITCHYARD_SOURCE);
