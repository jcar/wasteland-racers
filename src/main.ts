import './ui/style.css';
import { game } from './Game';
import { eventById } from './data/story';
import { setLeaveTarget } from './race/EventScene';
import { loadAssetIndex } from './systems/assets';
import { state } from './systems/GameState';
import { season2Open } from './systems/Story';
import { startEvent } from './scenes/events';
import { GarageScene } from './scenes/GarageScene';
import { RaceScene } from './scenes/RaceScene';
import { TitleScene } from './scenes/TitleScene';
import { WastelandScene, wastelandHub } from './scenes/WastelandScene';

await loadAssetIndex();
// "Leave" in a paused event goes back to the Wasteland once it's open, otherwise the garage.
setLeaveTarget(() => (season2Open(state.data) ? wastelandHub() : new GarageScene()));

// Dev shortcuts: ?race=dunes-2, ?event=c1-boss, ?scene=wasteland
const q = import.meta.env.DEV ? new URLSearchParams(location.search) : new URLSearchParams();
const race = q.get('race'), event = q.get('event'), scene = q.get('scene');
game.go(race ? new RaceScene(race) : event ? startEvent(eventById(event)) : scene === 'wasteland' ? new WastelandScene() : new TitleScene());
game.start();
