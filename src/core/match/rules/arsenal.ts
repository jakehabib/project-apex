/**
 * Arsenal — original weapon identities with CS-faithful gameplay roles.
 *
 * Names and descriptions are original to Project Apex. Prices, kill rewards and
 * damage characteristics follow the familiar structure of modern 5v5 tactical
 * shooters (default pistols, eco upgrades, SMG anti-eco, rifle tiers, a premium
 * one-shot sniper) so the economy reads correctly to genre fans. All values are
 * data and can be rebalanced without code changes.
 *
 * `equivalentClass` documents the gameplay role only; it is never shown as a
 * brand or product name in the UI.
 */

export type WeaponCategory = 'pistol' | 'smg' | 'heavy' | 'rifle' | 'sniper';
export type SideRestriction = 'attacker' | 'defender' | 'both';

export interface WeaponDef {
  readonly id: string;
  readonly name: string;
  readonly category: WeaponCategory;
  readonly side: SideRestriction;
  readonly price: number;
  readonly killReward: number;
  /** Base body damage per hit before armor. */
  readonly damage: number;
  readonly headshotMultiplier: number;
  /** Fraction of damage that penetrates kevlar (0..1). */
  readonly armorPenetration: number;
  /** Rounds per minute (affects time-to-kill). */
  readonly fireRate: number;
  /** Effective accurate range in map units (0.1 m). */
  readonly effectiveRange: number;
  /** 0..1 movement speed multiplier while carrying. */
  readonly mobility: number;
  /** Relative first-shot/spray accuracy (1 = category baseline). */
  readonly accuracy: number;
  /** Roughly what a genre player would call this slot; documentation only. */
  readonly equivalentClass: string;
  readonly isDefault?: boolean;
}

export const ARSENAL: readonly WeaponDef[] = [
  // Pistols
  { id: 'vanta9', name: 'Vanta 9', category: 'pistol', side: 'attacker', price: 200, killReward: 300, damage: 30, headshotMultiplier: 4, armorPenetration: 0.47, fireRate: 400, effectiveRange: 180, mobility: 1, accuracy: 1.0, equivalentClass: 'attacker default pistol', isDefault: true },
  { id: 'kestrel', name: 'Kestrel P', category: 'pistol', side: 'defender', price: 200, killReward: 300, damage: 35, headshotMultiplier: 4, armorPenetration: 0.5, fireRate: 352, effectiveRange: 220, mobility: 1, accuracy: 1.04, equivalentClass: 'defender default pistol', isDefault: true },
  { id: 'talon', name: 'Talon 250', category: 'pistol', side: 'both', price: 300, killReward: 300, damage: 38, headshotMultiplier: 4, armorPenetration: 0.64, fireRate: 400, effectiveRange: 220, mobility: 1, accuracy: 1.0, equivalentClass: 'armor-piercing eco pistol' },
  { id: 'ruin50', name: 'Ruin .50', category: 'pistol', side: 'both', price: 700, killReward: 300, damage: 53, headshotMultiplier: 4, armorPenetration: 0.93, fireRate: 267, effectiveRange: 300, mobility: 0.95, accuracy: 0.92, equivalentClass: 'heavy one-tap pistol' },
  // SMGs
  { id: 'mako', name: 'Mako', category: 'smg', side: 'attacker', price: 1050, killReward: 600, damage: 29, headshotMultiplier: 4, armorPenetration: 0.57, fireRate: 800, effectiveRange: 140, mobility: 0.98, accuracy: 0.95, equivalentClass: 'attacker anti-eco SMG' },
  { id: 'wasp', name: 'Wasp', category: 'smg', side: 'defender', price: 1250, killReward: 600, damage: 26, headshotMultiplier: 4, armorPenetration: 0.6, fireRate: 857, effectiveRange: 150, mobility: 0.98, accuracy: 1.02, equivalentClass: 'defender anti-eco SMG' },
  { id: 'bastion', name: 'Bastion', category: 'smg', side: 'both', price: 1200, killReward: 600, damage: 35, headshotMultiplier: 4, armorPenetration: 0.65, fireRate: 666, effectiveRange: 170, mobility: 0.96, accuracy: 1.0, equivalentClass: 'heavy SMG' },
  // Heavy
  { id: 'breaker', name: 'Breaker 12', category: 'heavy', side: 'both', price: 1100, killReward: 900, damage: 26 * 9, headshotMultiplier: 1.6, armorPenetration: 0.5, fireRate: 68, effectiveRange: 70, mobility: 0.9, accuracy: 1.0, equivalentClass: 'pump shotgun' },
  // Rifles
  { id: 'galeforce', name: 'Galeforce', category: 'rifle', side: 'attacker', price: 1800, killReward: 300, damage: 30, headshotMultiplier: 4, armorPenetration: 0.77, fireRate: 666, effectiveRange: 320, mobility: 0.86, accuracy: 0.94, equivalentClass: 'attacker budget rifle' },
  { id: 'ferrum', name: 'Ferrum', category: 'rifle', side: 'defender', price: 1950, killReward: 300, damage: 30, headshotMultiplier: 4, armorPenetration: 0.7, fireRate: 666, effectiveRange: 330, mobility: 0.88, accuracy: 1.0, equivalentClass: 'defender budget rifle' },
  { id: 'kraken', name: 'Kraken AR', category: 'rifle', side: 'attacker', price: 2700, killReward: 300, damage: 36, headshotMultiplier: 4, armorPenetration: 0.775, fireRate: 600, effectiveRange: 420, mobility: 0.86, accuracy: 0.94, equivalentClass: 'attacker primary rifle (armored one-tap)' },
  { id: 'sentinel', name: 'Sentinel M', category: 'rifle', side: 'defender', price: 2900, killReward: 300, damage: 33, headshotMultiplier: 4, armorPenetration: 0.7, fireRate: 666, effectiveRange: 400, mobility: 0.9, accuracy: 1.08, equivalentClass: 'defender primary rifle' },
  // Snipers
  { id: 'pike', name: 'Pike', category: 'sniper', side: 'both', price: 1700, killReward: 300, damage: 88, headshotMultiplier: 2.5, armorPenetration: 0.85, fireRate: 48, effectiveRange: 700, mobility: 0.96, accuracy: 1.0, equivalentClass: 'light bolt-action scout' },
  { id: 'lance', name: 'Lance', category: 'sniper', side: 'both', price: 4750, killReward: 100, damage: 115, headshotMultiplier: 4, armorPenetration: 0.975, fireRate: 41, effectiveRange: 900, mobility: 0.8, accuracy: 1.0, equivalentClass: 'premium one-shot sniper' },
];

export type UtilityKind = 'smoke' | 'flash' | 'frag' | 'fire';

export interface UtilityDef {
  readonly id: string;
  readonly name: string;
  readonly kind: UtilityKind;
  readonly side: SideRestriction;
  readonly price: number;
  readonly maxCarried: number;
  /** Effect duration in ms. */
  readonly durationMs: number;
  /** Effect radius in map units. */
  readonly radius: number;
}

export const UTILITY: readonly UtilityDef[] = [
  { id: 'smoke', name: 'Smoke', kind: 'smoke', side: 'both', price: 300, maxCarried: 1, durationMs: 18000, radius: 72 },
  { id: 'flash', name: 'Flash', kind: 'flash', side: 'both', price: 200, maxCarried: 2, durationMs: 2000, radius: 160 },
  { id: 'frag', name: 'Frag', kind: 'frag', side: 'both', price: 300, maxCarried: 1, durationMs: 0, radius: 70 },
  { id: 'cinder', name: 'Cinder', kind: 'fire', side: 'attacker', price: 400, maxCarried: 1, durationMs: 7000, radius: 60 },
  { id: 'ember', name: 'Ember', kind: 'fire', side: 'defender', price: 500, maxCarried: 1, durationMs: 7000, radius: 60 },
];

/** Grenade carry limit across all kinds (genre convention). */
export const MAX_GRENADES = 4;

export const GEAR = {
  vest: { id: 'vest', name: 'Vest', price: 650, armor: 100 },
  vestHelmet: { id: 'vest_helmet', name: 'Vest + Helmet', price: 1000, armor: 100 },
  helmetUpgrade: { id: 'helmet', name: 'Helmet', price: 350 },
  kit: { id: 'kit', name: 'Defuse Kit', price: 400, side: 'defender' as const },
} as const;

export function weaponById(id: string): WeaponDef {
  const w = ARSENAL.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown weapon ${id}`);
  return w;
}
