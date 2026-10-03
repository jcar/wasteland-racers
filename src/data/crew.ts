import type { BodyKind } from './cars';
import type { DriverDef } from './characters';

/**
 * Your convoy: hire Wasteland drivers with guzzoline and up to two ride with
 * you in chases, escorts, boss fights and around the Wasteland. They fire at
 * your enemies and never at you.
 */
export interface CrewDef {
  id: string;
  name: string;
  portrait: string;
  emoji: string;
  body: BodyKind;
  color: string;
  head: DriverDef['head'];
  gadget: string;
  /** Guzzoline to hire. */
  cost: number;
  /** What they shout when they join a fight. */
  line: string;
}

export const CREW: CrewDef[] = [
  { id: 'warpup', name: 'War Pup', portrait: 'driver-warpup', emoji: '👦', body: 'buzzard', color: '#8a3a1a', head: { skin: '#f4f1ea', hat: '#5a3a1e', kind: 'warboy' }, gadget: 'thunder', cost: 30, line: 'card-warpup' },
  { id: 'nux', name: 'Nux', portrait: 'driver-nux', emoji: '💀', body: 'nuxcar', color: '#2b2b2b', head: { skin: '#f4f1ea', hat: '#1c1c1c', kind: 'warboy' }, gadget: 'thunder', cost: 50, line: 'witness' },
  { id: 'toast', name: 'Toast', portrait: 'driver-toast', emoji: '🧕', body: 'interceptor', color: '#6b6b3a', head: { skin: '#d9a77e', hat: '#2b1d14', kind: 'toast' }, gadget: 'harpoon', cost: 70, line: 'card-toast' },
  { id: 'doof', name: 'The Doof Warrior', portrait: 'driver-doof', emoji: '🎸', body: 'doof', color: '#1c1c1c', head: { skin: '#d22b2b', hat: '#1c1c1c', kind: 'doof' }, gadget: 'flameguitar', cost: 120, line: 'card-doof' },
];

/** Guzzoline to train a crew member to level 2 and 3. */
export const CREW_LEVEL_COST = [60, 100];
export const MAX_CREW_LEVEL = 3;
/** How many can ride along at once. */
export const MAX_RIDING = 2;

export const crewById = (id: string) => CREW.find((c) => c.id === id)!;
