import { LapMode } from '../modes/lap';
import { EventScene } from '../race/EventScene';

/** A Season 1 / Fury Road lap race, from the track select screen. */
export class RaceScene extends EventScene {
  constructor(trackId: string) {
    super(new LapMode(trackId));
  }
}
