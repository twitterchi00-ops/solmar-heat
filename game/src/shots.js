// Screenshot staging: ?shot=start|play|chase|safehouse (with &seed=N) puts the game in a
// fixed, deterministic scene instead of running the loop, paints it twice and sets
// window.__shotReady for the screenshot driver.
export function stageShot(name, G) {
  const { player, traffic, police, missions } = G;
  if (name === 'start') {
    // Title screen: player on foot at the plaza, traffic rolling, dusk orbit camera.
    player.x = 25; player.z = 10;
    player.mesh.position.set(25, 0, 10);
    player.mesh.visible = true;
    missions.start();
    return { screen: 'title', orbit: true };
  }
  if (name === 'play') {
    // Mid-gameplay: the player driving up the main avenue, traffic around.
    const car = traffic.cars[0];
    car.x = 0; car.z = -20; car.heading = 0; car.speed = 16;
    car.driven = true; car.waypoints = null;
    car.mesh.position.set(0, 0, -20);
    player.inCar = car;
    player.mesh.visible = false;
    player.x = 0; player.z = -20;
    missions.start();
    missions.debugJumpTo(0, 1); // already in a car: show the drive objective
    return { screen: 'play', orbit: false };
  }
  if (name === 'chase') {
    // Wanted 3: the player's car fleeing south down the avenue, two cop cars in
    // pursuit right behind it — the classic chase frame.
    const car = traffic.cars[1];
    car.x = 0; car.z = -20; car.heading = 0; car.speed = 22;
    car.driven = true; car.waypoints = null;
    car.mesh.position.set(0, 0, -20);
    player.inCar = car;
    player.mesh.visible = false;
    player.x = 0; player.z = -20;
    police.setWanted(3, 0, -20);
    // Put the pursuing cop cars in frame, flanking the player's car.
    const spots = [[-7, -12, 0], [7, -10, 0]];
    police.copCars.forEach((cop, i) => {
      const s = spots[i % spots.length];
      cop.x = s[0]; cop.z = s[1]; cop.heading = s[2];
      cop.mesh.position.set(s[0], 0, s[1]);
      cop.mesh.rotation.y = s[2];
    });
    missions.start();
    missions.debugJumpTo(0, 1); // already in a car: show the drive objective
    return { screen: 'play', orbit: false };
  }
  if (name === 'safehouse') {
    // Mission 2: the player on foot inside the heal ring, foot cops closing in.
    player.inCar = null;
    player.mesh.visible = true;
    player.x = -125; player.z = 125;
    player.mesh.position.set(-125, 0, 125);
    player.hp = 78;
    police.setWanted(3, -125, 125);
    missions.start();
    // Jump straight to mission 2's survive stage for the shot.
    missions.debugJumpTo(2, 1);
    // Put the closing foot cops in frame, south of the player (the camera looks south).
    const spots = [[-118, 138], [-132, 138]];
    police.footCops.forEach((cop, i) => {
      const s = spots[i % spots.length];
      cop.x = s[0]; cop.z = s[1];
      cop.mesh.position.set(s[0], 1.0, s[1]);
    });
    return { screen: 'play', orbit: false };
  }
  return { screen: 'title', orbit: true };
}
