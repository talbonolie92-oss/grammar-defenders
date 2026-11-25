const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export async function createThreeWorld(container) {
  const THREE = await import(THREE_URL);
  if (!container || !container.isConnected) throw new Error("Battlefield container is unavailable.");

  const scene = new THREE.Scene();
  // Transparent scene: the Phaser canvas remains the reliable gameplay layer.
  scene.background = null;
  scene.fog = new THREE.Fog(0x10283a, 16, 34);

  const camera = new THREE.OrthographicCamera(-9.6, 9.6, 3.4, -3.4, 0.1, 80);
  camera.position.set(0, 18, 7);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "low-power",
    depth: true,
    stencil: false
  });
  const isSmallScreen = window.matchMedia?.("(max-width: 900px)").matches || false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1 : 1.25));
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(960, 340, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.className = "three-world-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.background = "transparent";
  container.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xc9f4e5, 0x18352c, 2.1));
  const sun = new THREE.DirectionalLight(0xffedc1, 2.25);
  sun.position.set(-5, 12, -7);
  scene.add(sun);

  const material = (color, roughness = 0.86, metalness = 0.02) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const groundMat = material(0x1a3540);
  const laneMats = [material(0x477b5d), material(0x3b7058)];
  const tileEdge = material(0x9bcf9d);
  const stoneMat = material(0x6d887a);
  const mossMat = material(0x4b936b);
  const goldMat = material(0xe8ca78, 0.48, 0.22);
  const portalMat = new THREE.MeshStandardMaterial({
    color: 0xd978b5, emissive: 0x8f285f, emissiveIntensity: 1.25,
    roughness: 0.35, metalness: 0.28
  });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 6.8), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.34;
  scene.add(ground);

  const boardBase = new THREE.Mesh(new THREE.BoxGeometry(15.35, 0.28, 5.58), material(0x193e38));
  boardBase.position.set(-0.6, -0.17, 0.06);
  scene.add(boardBase);

  const tileGeometry = new THREE.BoxGeometry(2.105, 0.19, 1.015);
  const trimGeometry = new THREE.BoxGeometry(2.13, 0.055, 1.04);
  const tileMeshes = [];
  for (let lane = 0; lane < 5; lane++) {
    const z = (38 + lane * 54 + 24) / 50 - 3.4;
    for (let col = 0; col < 7; col++) {
      const x = (72 + col * 108 + 54 - 480) / 50;
      const trim = new THREE.Mesh(trimGeometry, tileEdge);
      trim.position.set(x, -0.005, z);
      scene.add(trim);
      const tile = new THREE.Mesh(tileGeometry, laneMats[(lane + col) % 2]);
      tile.position.set(x, 0.075, z);
      scene.add(tile);
      tileMeshes.push(tile);
      if ((lane + col) % 3 === 0) {
        const rune = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.035, 6), goldMat);
        rune.position.set(x + 0.68, 0.19, z - 0.25);
        scene.add(rune);
      }
    }
  }

  // Emerald Keep: layered stonework and a luminous crown.
  const keepX = (39 - 480) / 50;
  const keep = new THREE.Group();
  const keepWall = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.18, 5.1), stoneMat);
  keepWall.position.y = 0.38;
  keep.add(keepWall);
  const keepCore = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.86, 3.8), mossMat);
  keepCore.position.set(0.05, 0.85, 0);
  keep.add(keepCore);
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.8, 5), material(0x9bd39b, 0.55, 0.1));
  keepRoof.rotation.z = Math.PI / 2;
  keepRoof.position.set(0.04, 1.28, 0);
  keep.add(keepRoof);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.27, 0), goldMat);
  crystal.position.set(0.42, 1.72, 0);
  keep.add(crystal);
  keep.position.set(keepX, 0, 0.06);
  scene.add(keep);

  // Dark Gate: raised pillars and an animated portal ring.
  const gateX = (895 - 480) / 50;
  const gate = new THREE.Group();
  const gateBase = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.62, 5.35), material(0x332c43));
  gateBase.position.y = 0.23;
  gate.add(gateBase);
  for (const z of [-1.85, 1.85]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.8, 0.5), material(0x80617b));
    pillar.position.set(0, 0.88, z);
    gate.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.68), goldMat);
    cap.position.set(0, 1.82, z);
    gate.add(cap);
  }
  const portal = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.095, 8, 40), portalMat);
  portal.rotation.x = Math.PI / 2;
  portal.position.set(0, 0.75, 0);
  gate.add(portal);
  const portalCore = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 32),
    new THREE.MeshBasicMaterial({ color: 0x633d77, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
  );
  portalCore.rotation.x = -Math.PI / 2;
  portalCore.position.set(0, 0.48, 0);
  gate.add(portalCore);
  gate.position.set(gateX, 0, 0.06);
  scene.add(gate);

  // Low-poly forest silhouettes frame the battlefield without obstructing lanes.
  const treeTrunk = material(0x604c3a);
  const treeCanopies = [material(0x245844), material(0x2c674c), material(0x347454)];
  for (let i = 0; i < 27; i++) {
    const x = -9.15 + (i * 1.47) % 18.3;
    const z = i % 2 ? -3.12 - (i % 4) * 0.18 : 3.12 + (i % 3) * 0.18;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.28, 5), treeTrunk);
    trunk.position.y = 0.12;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.34 + (i % 3) * 0.045, 0.82, 5), treeCanopies[i % 3]);
    crown.position.y = 0.56;
    tree.add(crown);
    tree.position.set(x, 0, z);
    scene.add(tree);
  }

  // Mossy stones and tiny crystals give the board a tactile 3D surface.
  for (let i = 0; i < 22; i++) {
    const x = -8.7 + ((i * 1.93) % 17.4);
    const z = (i % 2 ? -1 : 1) * (2.95 + (i % 3) * 0.12);
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + (i % 3) * 0.025, 0), i % 2 ? mossMat : stoneMat);
    pebble.position.set(x, 0.02, z);
    pebble.rotation.set(i * 0.4, i * 0.7, i * 0.2);
    scene.add(pebble);
  }


  // Shared low-poly geometry keeps character rendering lightweight.
  const shared = {
    sphere: new THREE.SphereGeometry(1, 8, 6),
    body: new THREE.CapsuleGeometry(0.34, 0.55, 3, 6),
    cone: new THREE.ConeGeometry(0.34, 0.8, 6),
    limb: new THREE.CylinderGeometry(0.09, 0.12, 0.48, 5),
    blade: new THREE.BoxGeometry(0.09, 0.72, 0.13)
  };
  const actorMaterials = new Map();
  const actorMaterial = color => {
    if (!actorMaterials.has(color)) actorMaterials.set(color, material(color, 0.68, 0.08));
    return actorMaterials.get(color);
  };
  const actorMeshes = new Map();
  const projectileMeshes = new Map();
  const projectileGeometry = new THREE.SphereGeometry(0.15, 8, 6);
  const projectileHaloGeometry = new THREE.TorusGeometry(0.19, 0.025, 4, 12);
  const unitPalette = {
    archer: 0x5f9664, mage: 0x8b9ee8, guardian: 0x8ba9c4, knight: 0xa9b9cb,
    ember: 0xe8753e, volt: 0x55b8d2, thorn: 0x57975b, phoenix: 0xf1a04e,
    sunwell: 0xe6c66f, titan: 0x8b79b5, runeblade: 0xb9875d, stormcaller: 0x62b9d7
  };
  const makeActor = (actor, enemy = false) => {
    const root = new THREE.Group();
    const tint = enemy ? (actor.isBoss ? 0x8d426e : ({
      Runner: 0x9b6e51, Brute: 0x75665c, "Bone Warrior": 0xd2c6a7,
      "War Crusher": 0x827e91, "Venom Beast": 0x6d9b4d,
      "Shadow Stalker": 0x55506f, "Dread Beast": 0x76526f,
      "Dark Caster": 0x7955a3
    }[actor.enemyType] || 0x9a765d)) : (unitPalette[actor.unitType] || 0x70a879);
    const coat = actorMaterial(tint);
    const dark = actorMaterial(enemy ? 0x342a3c : 0x263d3b);
    const gold = actorMaterial(enemy ? 0xd8a0b5 : 0xe8d08a);
    const add = (geometry, mat, x, y, z, scale = [1,1,1]) => {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x,y,z); mesh.scale.set(...scale); root.add(mesh); return mesh;
    };
    add(shared.sphere, dark, 0, 0.15, 0, [0.42,0.13,0.34]);
    if (enemy && ["Venom Beast","Dread Beast","Grunt","Runner","Brute"].includes(actor.enemyType)) {
      add(shared.sphere, coat, 0, 0.68, 0, [0.48,0.48,0.62]);
      add(shared.sphere, gold, 0.27, 0.84, -0.12, [0.12,0.09,0.1]);
      add(shared.cone, dark, -0.25, 1.02, -0.08, [0.55,0.65,0.55]).rotation.z = Math.PI;
      add(shared.cone, dark, 0.25, 1.02, -0.08, [0.55,0.65,0.55]).rotation.z = Math.PI;
    } else {
      const tall = actor.unitType === "titan" || actor.isBoss || actor.enemyType === "War Crusher";
      const height = tall ? 1.08 : 0.78;
      add(shared.body, coat, 0, height, 0, [tall ? 1.25 : 1, tall ? 1.18 : 0.92, 1]);
      add(shared.sphere, coat, 0, height + 0.57, 0, [0.34,0.34,0.34]);
      add(shared.cone, gold, 0, height + 0.91, 0, [0.65,0.62,0.65]);
      add(shared.limb, dark, -0.24, 0.34, 0);
      add(shared.limb, dark, 0.24, 0.34, 0);
      if (!enemy && ["archer","knight","runeblade","guardian"].includes(actor.unitType)) {
        const weapon = add(shared.blade, gold, 0.48, height + 0.05, 0.03);
        weapon.rotation.z = -0.32;
      }
      if (!enemy && actor.unitType === "phoenix") add(shared.cone, gold, 0, height + 1.16, 0, [0.5,0.8,0.5]);
    }
    if (actor.isBoss) {
      add(new THREE.TorusGeometry(0.68,0.075,5,18), gold, 0, 1.55, 0).rotation.x = Math.PI/2;
      root.scale.setScalar(1.28);
    } else root.scale.setScalar(enemy ? 0.72 : 0.82);
    root.userData.baseScale = root.scale.x;
    root.userData.lastHp = Number.isFinite(actor.hp) ? actor.hp : null;
    root.userData.hitFlashUntil = 0;
    scene.add(root);
    return root;
  };
  let lastActorSync = 0;
  const syncActors = (defenders = [], enemies = [], projectiles = [], now = 0) => {
    if (now - lastActorSync < 40) return;
    lastActorSync = now;
    const seen = new Set();
    const syncList = (list, isEnemy) => list.forEach(actor => {
      if (!actor || !actor.group?.active) return;
      let mesh = actorMeshes.get(actor);
      if (!mesh) {
        mesh = makeActor(actor, isEnemy);
        actorMeshes.set(actor, mesh);
        // Keep Phaser actor sprites visible as a guaranteed fallback layer.
        // Three.js rigs render behind the Phaser canvas until device testing confirms parity.
      }
      const px = actor.group.x;
      const py = actor.group.y;
      const bob = Math.sin(now * 0.004 + (actor.bobOffset || 0)) * (isEnemy ? 0.035 : 0.025);
      mesh.position.set((px - 480) / 50, 0.02 + bob, (py - 170) / 50);
      mesh.rotation.y = isEnemy ? Math.PI : 0;
      mesh.rotation.z = Math.sin(now * 0.0025 + (actor.bobOffset || 0)) * 0.025;
      const hp = Number.isFinite(actor.hp) ? actor.hp : null;
      if (hp !== null && mesh.userData.lastHp !== null && hp < mesh.userData.lastHp) {
        mesh.userData.hitFlashUntil = now + 135;
      }
      if (hp !== null) mesh.userData.lastHp = hp;
      const hitPulse = now < mesh.userData.hitFlashUntil ? 1.13 : 1;
      const idlePulse = 1 + Math.sin(now * 0.003 + (actor.bobOffset || 0)) * 0.012;
      mesh.scale.setScalar(mesh.userData.baseScale * hitPulse * idlePulse);
      mesh.visible = true;
      seen.add(actor);
    });
    syncList(defenders, false);
    syncList(enemies, true);
    const activeProjectiles = new Set();
    projectiles.forEach(projectile => {
      if (!projectile?.active) return;
      let mesh = projectileMeshes.get(projectile);
      if (!mesh) {
        const color = unitPalette[projectile.unitType] || 0xe8d08a;
        const glow = actorMaterial(color);
        mesh = new THREE.Group();
        const core = new THREE.Mesh(projectileGeometry, glow);
        const halo = new THREE.Mesh(projectileHaloGeometry, glow);
        halo.rotation.x = Math.PI / 2;
        mesh.add(core, halo);
        mesh.scale.setScalar(projectile.unitType === "titan" ? 1.35 : 1);
        scene.add(mesh);
        projectileMeshes.set(projectile, mesh);
      }
      mesh.position.set((projectile.x - 480) / 50, 0.24, (projectile.y - 170) / 50);
      mesh.rotation.z += 0.12;
      mesh.visible = true;
      projectile.setVisible?.(false);
      activeProjectiles.add(projectile);
    });
    for (const [projectile, mesh] of projectileMeshes) {
      if (!activeProjectiles.has(projectile) || !projectile.active) {
        scene.remove(mesh);
        projectileMeshes.delete(projectile);
      }
    }
    for (const [actor, mesh] of actorMeshes) {
      if (!seen.has(actor) || !actor.group?.active) {
        scene.remove(mesh);
        actorMeshes.delete(actor);
      }
    }
  };

  const resize = () => {
    const bounds = container.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    renderer.setSize(960, 340, false);
  };
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  observer?.observe(container);

  let raf = 0;
  let lastFrame = 0;
  const render = now => {
    // Render once before reporting successful initialization; if WebGL fails,
  // BattleScene keeps its original Phaser battlefield instead of going blank.
  renderer.render(scene, camera);
  raf = requestAnimationFrame(render);
    if (now - lastFrame < (isSmallScreen ? 42 : 32)) return;
    lastFrame = now;
    portal.rotation.z = now * 0.00022;
    portalMat.emissiveIntensity = 1.05 + Math.sin(now * 0.0018) * 0.28;
    crystal.rotation.y = now * 0.00065;
    crystal.rotation.z = Math.sin(now * 0.0012) * 0.12;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(render);

  let disposed = false;
  return {
    syncActors,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      actorMeshes.clear();\n      actorMaterials.forEach(item => item.dispose());\n      scene.traverse(object => {
        if (object.geometry && object.geometry !== projectileGeometry && !Object.values(shared).includes(object.geometry)) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(item => item.dispose());
        }
      });
      Object.values(shared).forEach(geometry => geometry.dispose());
      projectileGeometry.dispose();
      projectileHaloGeometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
