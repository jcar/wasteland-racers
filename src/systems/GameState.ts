import { SaveManager, type SaveData } from './SaveManager';
import { setMuted } from '../audio/sfx';
import { setVoiceOn } from '../audio/voice';

/** The one save everyone shares, plus helpers to keep it on disk. */
class GameState {
  private manager = new SaveManager();
  data: SaveData = this.manager.load();

  constructor() {
    this.applySettings();
  }

  persist() {
    this.manager.save(this.data);
    this.applySettings();
  }

  reset() {
    this.data = this.manager.reset();
    this.persist();
  }

  applySettings() {
    setMuted(this.data.settings.muted);
    setVoiceOn(this.data.settings.voice);
  }
}

export const state = new GameState();
