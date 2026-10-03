import { describe, expect, it } from 'vitest';
import { TRACKS } from '../src/data/tracks';
import { AIDriver } from '../src/race/AIDriver';
import { CarBody } from '../src/race/CarBody';
import { TrackGeometry } from '../src/race/trackGeometry';
import { aiSpeed, carStats } from '../src/systems/Economy';
import { freshSave } from '../src/systems/SaveManager';

const DT = 1 / 60;

function newCar(track: TrackGeometry) {
  const car = new CarBody(carStats(freshSave()), 'test');
  car.place(track, track.length - 6, 0);
  return car;
}

describe.each(TRACKS.filter((t) => !t.open).map((t) => [t.id, t] as const))('driving %s', (_id, def) => {
  const track = new TrackGeometry(def);

  it('an AI car laps without needing the tow drone', () => {
    const car = newCar(track);
    car.stats.maxSpeed = aiSpeed('dome-1', 'tough') + 1.5;
    const ai = new AIDriver(car, car.stats.maxSpeed, 0);
    let tows = 0;
    let time = 0;
    while (car.lap < 2 && time < 240) {
      car.step(DT, ai.think(DT, track, undefined), track, 0, 99);
      tows += car.events.filter((e) => e === 'tow').length;
      car.events.length = 0;
      time += DT;
    }
    expect(car.lap).toBe(2);
    expect(tows).toBe(0);
  });

  it('holding only the gas with Strong steer help still gets around', () => {
    const car = newCar(track);
    let time = 0;
    while (car.lap < 1 && time < 180) {
      car.step(DT, { steer: 0, gas: 1, brake: false }, track, 2.2, 99);
      car.events.length = 0;
      time += DT;
    }
    expect(car.lap).toBe(1);
    // A fresh buggy should manage a lap in reasonable time.
    expect(time).toBeLessThan(track.length / 20 * 2.2);
  });
});

describe.each(TRACKS.filter((t) => t.open).map((t) => [t.id, t] as const))('driving road %s', (_id, def) => {
  const road = new TrackGeometry(def);
  const start = () => {
    const car = new CarBody(carStats(freshSave()), 'test');
    car.place(road, 8, 0);
    return car;
  };

  it('an AI car reaches the end of the road without the tow drone', () => {
    const car = start();
    const ai = new AIDriver(car, aiSpeed('dome-1', 'tough') + 1.5, 0);
    let tows = 0, time = 0;
    while (car.pos.s < road.length - 12 && time < 240) {
      car.step(DT, ai.think(DT, road, undefined), road, 0, 99);
      tows += car.events.filter((e) => e === 'tow').length;
      car.events.length = 0;
      time += DT;
    }
    expect(car.pos.s).toBeGreaterThan(road.length - 12);
    expect(tows).toBe(0);
  });

  it('holding only the gas with Strong steer help gets to the end', () => {
    const car = start();
    let time = 0;
    while (car.pos.s < road.length - 12 && time < 240) {
      car.step(DT, { steer: 0, gas: 1, brake: false }, road, 2.2, 99);
      car.events.length = 0;
      time += DT;
    }
    expect(car.pos.s).toBeGreaterThan(road.length - 12);
  });

  it('the end of the road is a wall', () => {
    const car = start();
    car.place(road, road.length - 3, 0);
    car.vx = road.pointAt(road.length).tx * 30;
    car.vz = road.pointAt(road.length).tz * 30;
    for (let t = 0; t < 1; t += DT) car.step(DT, { steer: 0, gas: 1, brake: false }, road, 0, 99);
    expect(car.pos.s).toBeLessThanOrEqual(road.length);
  });
});
