import './ui/style.css';
import { game } from './Game';
import { loadAssetIndex } from './systems/assets';
import { RaceScene } from './scenes/RaceScene';
import { TitleScene } from './scenes/TitleScene';

await loadAssetIndex();
// Dev shortcut: ?race=dunes-2 jumps straight into a race.
const race = import.meta.env.DEV ? new URLSearchParams(location.search).get('race') : null;
game.go(race ? new RaceScene(race) : new TitleScene());
game.start();
