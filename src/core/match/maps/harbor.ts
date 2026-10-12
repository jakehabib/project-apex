import { rect, type MapDefinition } from './types';

/**
 * HARBOR — original map for Project Apex.
 *
 * Attackers enter from the Freight Gate (south). Defenders start at the
 * Harbormaster's office (north). A is an open container dock in the west reached
 * by the Long Pier or the Fish Market ramp; B is an enclosed warehouse in the east
 * reached through Rail Cut and the B Doors chokepoint. Crane Lane splits the map.
 *
 * Units: 1 map unit = 0.1 m. Layout is original and not derived from any
 * existing commercial map.
 */
export const HARBOR: MapDefinition = {
  id: 'harbor',
  name: 'Harbor',
  version: 1,
  width: 1600,
  height: 1200,
  cellSize: 8,
  theme: {
    void: 0x0a0f14,
    floor: 0x2a3540,
    floorAlt: 0x24303a,
    wall: 0x5d6f7e,
    obstacleHigh: 0x4a5a68,
    obstacleLow: 0x3a4854,
    siteTint: 0xe8a33d,
    accent: 0x3ee6c4,
  },
  areas: [
    { id: 't_spawn', callout: 'Freight Gate', zone: 'attacker_spawn', polygon: rect(620, 1020, 360, 140) },
    { id: 't_west', callout: 'Customs Lane', zone: 'route', polygon: rect(180, 1040, 450, 90) },
    { id: 'pier', callout: 'Long Pier', zone: 'route', polygon: rect(180, 430, 110, 620) },
    { id: 'a_site', callout: 'A Dock', zone: 'site', site: 'A', polygon: rect(150, 150, 340, 290) },
    { id: 'ct_spawn', callout: 'Harbormaster', zone: 'defender_spawn', polygon: rect(690, 50, 280, 130) },
    { id: 'office', callout: 'Office Walk', zone: 'route', polygon: rect(480, 100, 220, 100) },
    { id: 'ct_mid', callout: 'Crane Stairs', zone: 'connector', polygon: rect(760, 170, 90, 230) },
    { id: 'mid', callout: 'Crane Lane', zone: 'mid', polygon: rect(740, 390, 130, 180) },
    { id: 'mid_yard', callout: 'Mid Yard', zone: 'mid', polygon: rect(620, 560, 380, 170) },
    { id: 't_mid', callout: 'Container Row', zone: 'route', polygon: rect(760, 720, 110, 310) },
    { id: 'market', callout: 'Fish Market', zone: 'connector', polygon: rect(380, 600, 250, 90) },
    { id: 'ramp', callout: 'A Ramp', zone: 'route', polygon: rect(380, 430, 100, 180) },
    { id: 'b_conn', callout: 'Rail Connector', zone: 'connector', polygon: rect(990, 600, 170, 80) },
    { id: 't_east', callout: 'Rail Cut South', zone: 'route', polygon: rect(970, 1040, 330, 90) },
    { id: 'railcut', callout: 'Rail Cut', zone: 'route', polygon: rect(1220, 650, 100, 400) },
    { id: 'b_yard', callout: 'B Yard', zone: 'route', polygon: rect(1130, 560, 340, 110) },
    { id: 'b_door', callout: 'B Doors', zone: 'connector', polygon: rect(1260, 500, 80, 70) },
    { id: 'b_site', callout: 'B Warehouse', zone: 'site', site: 'B', polygon: rect(1130, 200, 340, 310) },
    { id: 'sheds', callout: 'Sheds', zone: 'route', polygon: rect(960, 90, 290, 90) },
    { id: 'b_back', callout: 'Back Door', zone: 'connector', polygon: rect(1180, 170, 70, 40) },
  ],
  obstacles: [
    { id: 'a_stack', kind: 'high', polygon: rect(220, 220, 70, 110) },
    { id: 'a_corner_box', kind: 'high', polygon: rect(160, 380, 50, 50) },
    { id: 'a_crates', kind: 'low', polygon: rect(300, 360, 50, 40) },
    { id: 'pier_crate', kind: 'low', polygon: rect(250, 720, 35, 40) },
    { id: 'crane_base', kind: 'high', polygon: rect(700, 600, 60, 60) },
    { id: 'mid_container', kind: 'high', polygon: rect(790, 585, 50, 40) },
    { id: 'yard_crates', kind: 'low', polygon: rect(900, 580, 40, 40) },
    { id: 'truck', kind: 'high', polygon: rect(700, 1080, 80, 40) },
    { id: 'b_pillar', kind: 'high', polygon: rect(1250, 300, 60, 60) },
    { id: 'b_stack', kind: 'high', polygon: rect(1380, 250, 40, 90) },
    { id: 'b_crates', kind: 'low', polygon: rect(1180, 420, 60, 40) },
  ],
  nodes: [
    // Attacker spawn
    { id: 'tsA', pos: { x: 660, y: 1050 }, callout: 'Freight Gate', tags: ['attacker_spawn'] },
    { id: 'tsB', pos: { x: 640, y: 1120 }, callout: 'Freight Gate', tags: ['attacker_spawn'] },
    { id: 'tsC', pos: { x: 830, y: 1100 }, callout: 'Freight Gate', tags: ['attacker_spawn'] },
    { id: 'tsD', pos: { x: 920, y: 1060 }, callout: 'Freight Gate', tags: ['attacker_spawn'] },
    { id: 'tsE', pos: { x: 950, y: 1130 }, callout: 'Freight Gate', tags: ['attacker_spawn'] },
    { id: 'tsN', pos: { x: 815, y: 1060 }, callout: 'Gate Hub', tags: [] },
    // West route to A
    { id: 'cw1', pos: { x: 400, y: 1085 }, callout: 'Customs Lane', tags: [] },
    { id: 'cw0', pos: { x: 230, y: 1085 }, callout: 'Pier Corner', tags: [] },
    { id: 'p1', pos: { x: 235, y: 850 }, callout: 'Long Pier', tags: ['lurk'] },
    { id: 'p2', pos: { x: 235, y: 600 }, callout: 'Upper Pier', tags: [] },
    { id: 'p3', pos: { x: 235, y: 460 }, callout: 'Pier Mouth', tags: ['choke'] },
    // A site
    { id: 'a1', pos: { x: 250, y: 380 }, callout: 'A Front', tags: ['plant'], site: 'A' },
    { id: 'a2', pos: { x: 350, y: 290 }, callout: 'A Center', tags: ['plant'], site: 'A' },
    { id: 'a3', pos: { x: 450, y: 190 }, callout: 'A Default', tags: ['hold'], site: 'A' },
    { id: 'a4', pos: { x: 180, y: 180 }, callout: 'A Corner', tags: ['hold'], site: 'A' },
    { id: 'a5', pos: { x: 430, y: 400 }, callout: 'Ramp Top', tags: ['hold'], site: 'A' },
    // Ramp / Market
    { id: 'r1', pos: { x: 430, y: 520 }, callout: 'A Ramp', tags: ['choke'] },
    { id: 'mk1', pos: { x: 480, y: 645 }, callout: 'Fish Market', tags: [] },
    { id: 'mk0', pos: { x: 600, y: 645 }, callout: 'Market Mouth', tags: [] },
    // Defender spawn and north routes
    { id: 'cs1', pos: { x: 740, y: 100 }, callout: 'Harbormaster', tags: ['defender_spawn'] },
    { id: 'cs2', pos: { x: 820, y: 140 }, callout: 'Harbormaster', tags: ['defender_spawn'] },
    { id: 'cs3', pos: { x: 900, y: 90 }, callout: 'Harbormaster', tags: ['defender_spawn'] },
    { id: 'cs4', pos: { x: 950, y: 150 }, callout: 'Harbormaster', tags: ['defender_spawn'] },
    { id: 'cs5', pos: { x: 760, y: 160 }, callout: 'Harbormaster', tags: ['defender_spawn'] },
    { id: 'o1', pos: { x: 590, y: 150 }, callout: 'Office Walk', tags: ['retake'] },
    { id: 'sh1', pos: { x: 1050, y: 135 }, callout: 'Sheds', tags: [] },
    { id: 'sh2', pos: { x: 1215, y: 135 }, callout: 'Upper Sheds', tags: ['retake'] },
    { id: 'bk', pos: { x: 1215, y: 190 }, callout: 'Back Door', tags: ['choke'] },
    // Mid
    { id: 'ml0', pos: { x: 805, y: 300 }, callout: 'Crane Stairs', tags: [] },
    { id: 'ml1', pos: { x: 805, y: 470 }, callout: 'Crane Lane', tags: ['hold', 'mid'] },
    { id: 'my1', pos: { x: 680, y: 690 }, callout: 'Mid Yard West', tags: ['mid'] },
    { id: 'my2', pos: { x: 880, y: 660 }, callout: 'Mid Yard', tags: ['mid', 'hold'] },
    { id: 'my3', pos: { x: 960, y: 690 }, callout: 'Mid Yard East', tags: ['mid'] },
    { id: 'mt2', pos: { x: 815, y: 780 }, callout: 'Container Row North', tags: ['choke'] },
    { id: 'mt1', pos: { x: 815, y: 980 }, callout: 'Container Row', tags: [] },
    // East route to B
    { id: 'te1', pos: { x: 1100, y: 1085 }, callout: 'Rail Cut South', tags: [] },
    { id: 'rc1', pos: { x: 1270, y: 1085 }, callout: 'Rail Corner', tags: [] },
    { id: 'rc2', pos: { x: 1270, y: 850 }, callout: 'Rail Cut', tags: ['lurk'] },
    { id: 'rc3', pos: { x: 1270, y: 700 }, callout: 'Rail Cut Top', tags: ['choke'] },
    { id: 'bc1', pos: { x: 1075, y: 640 }, callout: 'Rail Connector', tags: [] },
    { id: 'by1', pos: { x: 1180, y: 615 }, callout: 'B Yard West', tags: [] },
    { id: 'bym', pos: { x: 1300, y: 615 }, callout: 'B Yard', tags: [] },
    { id: 'by2', pos: { x: 1400, y: 615 }, callout: 'B Yard East', tags: [] },
    { id: 'bd', pos: { x: 1300, y: 535 }, callout: 'B Doors', tags: ['choke'] },
    // B site
    { id: 'b1', pos: { x: 1300, y: 430 }, callout: 'B Entrance', tags: ['plant'], site: 'B' },
    { id: 'b2', pos: { x: 1200, y: 330 }, callout: 'B Crates', tags: ['plant', 'hold'], site: 'B' },
    { id: 'b3', pos: { x: 1440, y: 410 }, callout: 'B Back Corner', tags: ['hold'], site: 'B' },
    { id: 'b4', pos: { x: 1220, y: 240 }, callout: 'B Back Door', tags: ['hold'], site: 'B' },
    { id: 'b5', pos: { x: 1450, y: 220 }, callout: 'B Stack', tags: ['hold'], site: 'B' },
  ],
  edges: [
    { a: 'tsA', b: 'tsB' }, { a: 'tsA', b: 'tsN' }, { a: 'tsC', b: 'tsN' }, { a: 'tsD', b: 'tsN' },
    { a: 'tsC', b: 'tsE' }, { a: 'tsD', b: 'tsE' }, { a: 'tsN', b: 'mt1' },
    { a: 'tsA', b: 'cw1' }, { a: 'tsB', b: 'cw1' }, { a: 'tsD', b: 'te1' }, { a: 'tsE', b: 'te1' },
    { a: 'cw1', b: 'cw0' }, { a: 'cw0', b: 'p1' }, { a: 'p1', b: 'p2' }, { a: 'p2', b: 'p3' }, { a: 'p3', b: 'a1' },
    { a: 'a1', b: 'a2' }, { a: 'a2', b: 'a3' }, { a: 'a3', b: 'a4' }, { a: 'a2', b: 'a5' }, { a: 'a3', b: 'a5' },
    { a: 'a5', b: 'r1' }, { a: 'r1', b: 'mk1' }, { a: 'mk1', b: 'mk0' }, { a: 'mk0', b: 'my1' },
    { a: 'a3', b: 'o1' }, { a: 'o1', b: 'cs1' },
    { a: 'cs1', b: 'cs5' }, { a: 'cs5', b: 'cs2' }, { a: 'cs2', b: 'cs3' }, { a: 'cs3', b: 'cs4' }, { a: 'cs1', b: 'cs3' },
    { a: 'cs2', b: 'ml0' }, { a: 'ml0', b: 'ml1' }, { a: 'ml1', b: 'my2' },
    { a: 'my1', b: 'my2' }, { a: 'my2', b: 'my3' }, { a: 'my2', b: 'mt2' }, { a: 'mt2', b: 'mt1' },
    { a: 'my3', b: 'bc1' }, { a: 'bc1', b: 'by1' }, { a: 'by1', b: 'bym' }, { a: 'bym', b: 'by2' }, { a: 'bym', b: 'bd' },
    { a: 'bd', b: 'b1' }, { a: 'b1', b: 'b2' }, { a: 'b1', b: 'b3' }, { a: 'b2', b: 'b4' }, { a: 'b4', b: 'bk' },
    { a: 'b3', b: 'b5' }, { a: 'b5', b: 'b4' },
    { a: 'bk', b: 'sh2' }, { a: 'sh2', b: 'sh1' }, { a: 'sh1', b: 'cs4' },
    { a: 'te1', b: 'rc1' }, { a: 'rc1', b: 'rc2' }, { a: 'rc2', b: 'rc3' },
    { a: 'rc3', b: 'bym' }, { a: 'rc3', b: 'by1' }, { a: 'rc3', b: 'by2' },
  ],
  sites: {
    A: { label: { x: 320, y: 175 } },
    B: { label: { x: 1330, y: 260 } },
  },
};
