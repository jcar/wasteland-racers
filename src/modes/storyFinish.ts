import type { Scene } from '../Game';
import type { StoryEvent } from '../data/story';
import type { EventScene } from '../race/EventScene';
import { StoryResultScene, type StoryOutcome } from '../scenes/StoryResultScene';

/** Every story mode ends here: pay out and show the results. */
export function storyFinish(core: EventScene, event: StoryEvent, outcome: Omit<StoryOutcome, 'wrecks'>): Scene {
  return new StoryResultScene(event, { ...outcome, wrecks: core.wrecks });
}
