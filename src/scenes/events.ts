import type { Scene } from '../Game';
import type { StoryEvent } from '../data/story';
import { ArenaMode } from '../modes/arena';
import { BulletFarmerBoss, DementusBoss, JoeBoss, PeopleEaterBoss, RictusBoss } from '../modes/bosses';
import { ChaseMode } from '../modes/chase';
import { EscortMode } from '../modes/escort';
import { LapMode } from '../modes/lap';
import { EventScene, type Mode } from '../race/EventScene';

/** The right game for a story event. */
export function modeFor(ev: StoryEvent): Mode {
  switch (ev.mode) {
    case 'race': return new LapMode(ev.track!, ev);
    case 'chase': return new ChaseMode(ev);
    case 'escort': return new EscortMode(ev);
    case 'arena': return new ArenaMode(ev);
    case 'boss':
      switch (ev.boss) {
        case 'rictus': return new RictusBoss(ev);
        case 'peopleeater': return new PeopleEaterBoss(ev);
        case 'bulletfarmer': return new BulletFarmerBoss(ev);
        case 'joe': return new JoeBoss(ev);
        default: return new DementusBoss(ev);
      }
  }
}

export const startEvent = (ev: StoryEvent): Scene => new EventScene(modeFor(ev));
