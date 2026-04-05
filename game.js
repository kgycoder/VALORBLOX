// ===== 게임 상수 =====
const GAME_CONFIG = {
    ROUNDS_TO_WIN: 13,
    BUY_TIME: 10,
    ROUND_TIME: 100,
    TEAM_SIZE: 5,
    MOVEMENT_SPREAD_MULTIPLIER: 3,
    ADS_SPREAD_MULTIPLIER: 0.5
};

// 무기 데이터
const WEAPONS = {
    pistol: {
        name: '권총',
        damage: 30,
        fireRate: 300,
        magazineSize: 12,
        reserveAmmo: 36,
        spread: 0.02,
        hasADS: false,
        price: 0,
        reloadTime: 1.5
    },
    rifle: {
        name: '라이플',
        damage: 40,
        fireRate: 150,
        magazineSize: 30,
        reserveAmmo: 90,
        spread: 0.015,
        hasADS: true,
        price: 2900,
        reloadTime: 2.5
    },
    smg: {
        name: 'SMG',
        damage: 25,
        fireRate: 100,
        magazineSize: 25,
        reserveAmmo: 75,
        spread: 0.025,
        hasADS: true,
        price: 1600,
        reloadTime: 2.0
    },
    sniper: {
        name: '저격총',
        damage: 150,
        fireRate: 1000,
        magazineSize: 5,
        reserveAmmo: 15,
        spread: 0.001,
        hasADS: true,
        price: 4700,
        reloadTime: 3.0
    },
    knife: {
        name: '나이프',
        damage: 50,
        fireRate: 500,
        magazineSize: 999,
        reserveAmmo: 0,
        spread: 0,
        hasADS: false,
        price: 0,
        reloadTime: 0
    }
};

// ===== 게임 변수 =====
let scene, camera, renderer, clock;
let player, controls;
let enemies = [], allies = [];
let bullets = [];
let map;
let gameState = {
    phase: 'buy', // buy, combat, roundEnd
    round: 1,
    allyScore: 0,
    enemyScore: 0,
    money: 800,
    health: 100,
    isAlive: true,
    currentWeaponSlot: 0, // 0: primary, 1: secondary, 2: melee
    inventory: {
        primary: null,
        secondary: 'pistol',
        melee: 'knife'
    },
    currentWeapon: null,
    isReloading: false,
    isADS: false,
    canShoot: true
};

let keys = {};
let mouse = { x: 0, y: 0 };
let velocity = new THREE.Vector3();
let isPointerLocked = false;

// ===== 초기화 =====
function init() {
    // Scene 설정
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 0, 500);

    // Camera 설정
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.6, 0);

    // Renderer 설정
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 맵 생성
    createMap();

    // 플레이어 설정
    createPlayer();

    // AI 생성
    createAI();

    // 무기 모델 생성
    createWeaponModel();

    // 이벤트 리스너
    setupEventListeners();

    // UI 업데이트
    updateUI();

    // 구매 단계 시작
    startBuyPhase();

    // 로딩 화면 숨기기
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('click-to-play').classList.remove('hidden');

    // 게임 루프 시작
    animate();
}

// ===== 맵 생성 =====
function createMap() {
    // 바닥
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3a3a3a,
        roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 아군 베이스 (파란색)
    const allyBase = createBase(0x4CAF50, new THREE.Vector3(-80, 0, 0));
    scene.add(allyBase);

    // 적군 베이스 (빨간색)
    const enemyBase = createBase(0xf44336, new THREE.Vector3(80, 0, 0));
    scene.add(enemyBase);

    // 중앙 장애물들
    createObstacles();
}

function createBase(color, position) {
    const base = new THREE.Group();
    
    // 바닥 플랫폼
    const platformGeometry = new THREE.BoxGeometry(30, 0.5, 30);
    const platformMaterial = new THREE.MeshStandardMaterial({ color: color });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = 0.25;
    platform.receiveShadow = true;
    platform.castShadow = true;
    base.add(platform);

    // 벽들
    const wallMaterial = new THREE.MeshStandardMaterial({ color: color, opacity: 0.7, transparent: true });
    
    // 뒷벽
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 1), wallMaterial);
    backWall.position.set(0, 4, -15);
    backWall.castShadow = true;
    base.add(backWall);

    // 옆벽들
    const sideWall1 = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 30), wallMaterial);
    sideWall1.position.set(-15, 4, 0);
    sideWall1.castShadow = true;
    base.add(sideWall1);

    const sideWall2 = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 30), wallMaterial);
    sideWall2.position.set(15, 4, 0);
    sideWall2.castShadow = true;
    base.add(sideWall2);

    base.position.copy(position);
    return base;
}

function createObstacles() {
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    
    // 여러 장애물 생성
    const obstacles = [
        { pos: [0, 2, 0], size: [4, 4, 4] },
        { pos: [20, 1.5, 20], size: [3, 3, 8] },
        { pos: [20, 1.5, -20], size: [3, 3, 8] },
        { pos: [-20, 1.5, 20], size: [8, 3, 3] },
        { pos: [-20, 1.5, -20], size: [8, 3, 3] },
        { pos: [40, 2, 0], size: [5, 4, 5] },
        { pos: [-40, 2, 0], size: [5, 4, 5] },
    ];

    obstacles.forEach(obs => {
        const geometry = new THREE.BoxGeometry(...obs.size);
        const box = new THREE.Mesh(geometry, boxMaterial);
        box.position.set(...obs.pos);
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
    });
}

// ===== 플레이어 생성 =====
function createPlayer() {
    player = {
        position: new THREE.Vector3(-80, 1.6, 0),
        rotation: new THREE.Euler(0, 0, 0),
        velocity: new THREE.Vector3(),
        canJump: true,
        isMoving: false
    };
    
    camera.position.copy(player.position);
    
    // 현재 무기 설정
    gameState.currentWeapon = WEAPONS[gameState.inventory.secondary];
    updateWeaponInHand();
}

// ===== AI 생성 (R6 스타일) =====
function createAI() {
    // 아군 생성
    for (let i = 0; i < GAME_CONFIG.TEAM_SIZE - 1; i++) {
        const ally = createR6Character(0x4CAF50, new THREE.Vector3(
            -80 + Math.random() * 10,
            0,
            -10 + i * 5
        ), 'ally');
        allies.push(ally);
        scene.add(ally.model);
    }

    // 적군 생성
    for (let i = 0; i < GAME_CONFIG.TEAM_SIZE; i++) {
        const enemy = createR6Character(0xf44336, new THREE.Vector3(
            80 + Math.random() * 10,
            0,
            -10 + i * 5
        ), 'enemy');
        enemies.push(enemy);
        scene.add(enemy.model);
    }
}

function createR6Character(color, position, team) {
    const character = new THREE.Group();
    
    // R6 스타일: 블록 형태의 캐릭터
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: color });
    
    // 몸통 (2x2x1)
    const torso = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 0.5),
        bodyMaterial
    );
    torso.position.y = 1.5;
    torso.castShadow = true;
    character.add(torso);
    
    // 머리 (1x1x1)
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.75, 0.75),
        new THREE.MeshStandardMaterial({ color: 0xFFDBAC })
    );
    head.position.y = 2.75;
    head.castShadow = true;
    character.add(head);
    
    // 팔 (왼쪽)
    const leftArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 1.5, 0.3),
        bodyMaterial
    );
    leftArm.position.set(-0.65, 1.5, 0);
    leftArm.castShadow = true;
    character.add(leftArm);
    
    // 팔 (오른쪽)
    const rightArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 1.5, 0.3),
        bodyMaterial
    );
    rightArm.position.set(0.65, 1.5, 0);
    rightArm.castShadow = true;
    character.add(rightArm);
    
    // 다리 (왼쪽)
    const leftLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 1.5, 0.4),
        bodyMaterial
    );
    leftLeg.position.set(-0.3, 0.25, 0);
    leftLeg.castShadow = true;
    character.add(leftLeg);
    
    // 다리 (오른쪽)
    const rightLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 1.5, 0.4),
        bodyMaterial
    );
    rightLeg.position.set(0.3, 0.25, 0);
    rightLeg.castShadow = true;
    character.add(rightLeg);
    
    character.position.copy(position);
    
    return {
        model: character,
        health: 100,
        isAlive: true,
        team: team,
        position: position,
        targetPosition: position.clone(),
        weapon: 'rifle',
        lastShot: 0
    };
}

// ===== 무기 모델 =====
let weaponModel;

function createWeaponModel() {
    if (weaponModel) {
        scene.remove(weaponModel);
    }
    
    weaponModel = new THREE.Group();
    
    // 간단한 총 모델
    const gunBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    gunBody.position.set(0.2, -0.2, -0.4);
    weaponModel.add(gunBody);
    
    const gunBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    );
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0.2, -0.15, -0.7);
    weaponModel.add(gunBarrel);
    
    const gunHandle = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.15, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
    );
    gunHandle.position.set(0.2, -0.3, -0.3);
    weaponModel.add(gunHandle);
    
    camera.add(weaponModel);
    scene.add(camera);
}

function updateWeaponInHand() {
    // 무기 모델 업데이트 로직
    if (weaponModel) {
        // 무기별로 위치/크기 조정 가능
        const weapon = getCurrentWeapon();
        if (weapon === WEAPONS.knife) {
            weaponModel.scale.set(0.5, 0.5, 0.5);
        } else if (weapon === WEAPONS.sniper) {
            weaponModel.scale.set(1.2, 1.2, 1.5);
        } else {
            weaponModel.scale.set(1, 1, 1);
        }
    }
    updateUI();
}

function getCurrentWeapon() {
    const slots = ['primary', 'secondary', 'melee'];
    const weaponKey = gameState.inventory[slots[gameState.currentWeaponSlot]];
    return weaponKey ? WEAPONS[weaponKey] : null;
}

// ===== 게임 페이즈 관리 =====
let buyTimer, roundTimer;

function startBuyPhase() {
    gameState.phase = 'buy';
    document.getElementById('buy-menu').classList.remove('hidden');
    
    let timeLeft = GAME_CONFIG.BUY_TIME;
    document.getElementById('buy-time').textContent = timeLeft;
    
    buyTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('buy-time').textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(buyTimer);
            startCombatPhase();
        }
    }, 1000);
}

function startCombatPhase() {
    gameState.phase = 'combat';
    document.getElementById('buy-menu').classList.add('hidden');
    
    let timeLeft = GAME_CONFIG.ROUND_TIME;
    updateRoundTime(timeLeft);
    
    roundTimer = setInterval(() => {
        timeLeft--;
        updateRoundTime(timeLeft);
        
        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            endRound('enemy'); // 시간 초과 시 적팀 승리
        }
    }, 1000);
}

function updateRoundTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById('round-time').textContent = 
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function endRound(winner) {
    clearInterval(roundTimer);
    gameState.phase = 'roundEnd';
    
    if (winner === 'ally') {
        gameState.allyScore++;
        gameState.money += 3000;
        showRoundResult('승리!', 'victory');
    } else {
        gameState.enemyScore++;
        gameState.money += 1900;
        showRoundResult('패배', 'defeat');
    }
    
    updateUI();
    
    // 승리 조건 확인
    if (gameState.allyScore >= GAME_CONFIG.ROUNDS_TO_WIN) {
        setTimeout(() => showGameOver('victory'), 3000);
    } else if (gameState.enemyScore >= GAME_CONFIG.ROUNDS_TO_WIN) {
        setTimeout(() => showGameOver('defeat'), 3000);
    } else {
        setTimeout(() => startNextRound(), 3000);
    }
}

function showRoundResult(text, result) {
    const resultDiv = document.getElementById('round-result');
    const resultText = document.getElementById('result-text');
    
    resultText.textContent = text;
    resultText.className = result;
    
    resultDiv.classList.remove('hidden');
    
    setTimeout(() => {
        resultDiv.classList.add('hidden');
    }, 3000);
}

function showGameOver(result) {
    const gameOverDiv = document.getElementById('game-over');
    const gameResult = document.getElementById('game-result');
    const finalScore = document.getElementById('final-score');
    
    if (result === 'victory') {
        gameResult.textContent = '승리!';
        gameResult.className = 'victory';
    } else {
        gameResult.textContent = '패배';
        gameResult.className = 'defeat';
    }
    
    finalScore.textContent = `최종 스코어: ${gameState.allyScore} - ${gameState.enemyScore}`;
    gameOverDiv.classList.remove('hidden');
}

function startNextRound() {
    gameState.round++;
    gameState.health = 100;
    gameState.isAlive = true;
    
    // 캐릭터 리스폰
    respawnAllCharacters();
    
    updateUI();
    startBuyPhase();
}

function respawnAllCharacters() {
    // 플레이어 리스폰
    player.position.set(-80, 1.6, 0);
    camera.position.copy(player.position);
    
    // AI 리스폰
    allies.forEach((ally, i) => {
        ally.health = 100;
        ally.isAlive = true;
        ally.model.visible = true;
        ally.position.set(-80 + Math.random() * 10, 0, -10 + i * 5);
        ally.model.position.copy(ally.position);
    });
    
    enemies.forEach((enemy, i) => {
        enemy.health = 100;
        enemy.isAlive = true;
        enemy.model.visible = true;
        enemy.position.set(80 + Math.random() * 10, 0, -10 + i * 5);
        enemy.model.position.copy(enemy.position);
    });
}

// ===== 사격 시스템 =====
function shoot() {
    if (!gameState.canShoot || gameState.phase !== 'combat' || !gameState.isAlive || gameState.isReloading) {
        return;
    }
    
    const weapon = getCurrentWeapon();
    if (!weapon) return;
    
    if (weapon.magazineSize <= 0) {
        // 탄창 비었음
        return;
    }
    
    // 탄약 소모
    weapon.magazineSize--;
    
    // 발사 딜레이
    gameState.canShoot = false;
    setTimeout(() => {
        gameState.canShoot = true;
    }, weapon.fireRate);
    
    // 총구 섬광 효과
    createMuzzleFlash();
    
    // 레이캐스트로 적중 판정
    let spread = weapon.spread;
    
    // 이동 중이면 탄퍼짐 증가
    if (player.isMoving) {
        spread *= GAME_CONFIG.MOVEMENT_SPREAD_MULTIPLIER;
    }
    
    // 조준 중이면 탄퍼짐 감소
    if (gameState.isADS) {
        spread *= GAME_CONFIG.ADS_SPREAD_MULTIPLIER;
    }
    
    const direction = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        -1
    );
    direction.applyQuaternion(camera.quaternion);
    direction.normalize();
    
    const raycaster = new THREE.Raycaster(camera.position, direction);
    
    // 적 확인
    const enemyMeshes = enemies.filter(e => e.isAlive).map(e => e.model);
    const intersects = raycaster.intersectObjects(enemyMeshes, true);
    
    if (intersects.length > 0) {
        const hitEnemy = enemies.find(e => e.model === intersects[0].object.parent);
        if (hitEnemy && hitEnemy.isAlive) {
            // 헤드샷 판정 (높이 기준)
            const isHeadshot = intersects[0].point.y > hitEnemy.position.y + 2.5;
            const damage = isHeadshot ? weapon.damage * 4 : weapon.damage;
            
            hitEnemy.health -= damage;
            
            // 타격 표시
            createHitMarker(isHeadshot);
            
            if (hitEnemy.health <= 0) {
                hitEnemy.isAlive = false;
                hitEnemy.model.visible = false;
                addKillLog(`적 처치! ${isHeadshot ? '(헤드샷)' : ''}`);
                
                // 모든 적 처치 확인
                checkRoundEnd();
            }
        }
    }
    
    // 총알 궤적 (시각 효과)
    createBulletTracer(camera.position, direction);
    
    updateUI();
}

function createMuzzleFlash() {
    const flash = new THREE.PointLight(0xffaa00, 2, 10);
    flash.position.copy(camera.position);
    flash.position.add(new THREE.Vector3(0.2, -0.2, -0.5).applyQuaternion(camera.quaternion));
    scene.add(flash);
    
    setTimeout(() => {
        scene.remove(flash);
    }, 50);
}

function createHitMarker(isHeadshot) {
    const marker = document.createElement('div');
    marker.style.position = 'fixed';
    marker.style.top = '50%';
    marker.style.left = '50%';
    marker.style.transform = 'translate(-50%, -50%)';
    marker.style.color = isHeadshot ? '#ff0000' : '#ffffff';
    marker.style.fontSize = isHeadshot ? '3rem' : '2rem';
    marker.style.fontWeight = 'bold';
    marker.style.pointerEvents = 'none';
    marker.style.zIndex = '9999';
    marker.textContent = 'X';
    marker.style.textShadow = '0 0 10px currentColor';
    
    document.body.appendChild(marker);
    
    setTimeout(() => {
        marker.remove();
    }, 200);
}

function createBulletTracer(start, direction) {
    const end = start.clone().add(direction.multiplyScalar(100));
    
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: 0xffff00, opacity: 0.5, transparent: true });
    const line = new THREE.Line(geometry, material);
    
    scene.add(line);
    
    setTimeout(() => {
        scene.remove(line);
    }, 50);
}

function reload() {
    if (gameState.isReloading) return;
    
    const weapon = getCurrentWeapon();
    if (!weapon || weapon.reserveAmmo <= 0 || weapon.magazineSize === weapon.magazineSize) return;
    
    gameState.isReloading = true;
    
    setTimeout(() => {
        const needed = weapon.magazineSize - weapon.magazineSize;
        const toReload = Math.min(needed, weapon.reserveAmmo);
        
        weapon.magazineSize += toReload;
        weapon.reserveAmmo -= toReload;
        
        gameState.isReloading = false;
        updateUI();
    }, weapon.reloadTime * 1000);
}

// ===== AI 행동 =====
function updateAI(delta) {
    if (gameState.phase !== 'combat') return;
    
    // 아군 AI
    allies.forEach(ally => {
        if (!ally.isAlive) return;
        
        // 간단한 AI: 전진 및 사격
        ally.targetPosition.x += delta * 5;
        ally.position.lerp(ally.targetPosition, delta * 2);
        ally.model.position.copy(ally.position);
        
        // 적 찾아서 사격
        const nearestEnemy = findNearestEnemy(ally.position, 'enemy');
        if (nearestEnemy && Date.now() - ally.lastShot > 500) {
            ally.lastShot = Date.now();
            
            const distance = ally.position.distanceTo(nearestEnemy.position);
            if (distance < 50 && Math.random() < 0.1) {
                // 적 공격
                nearestEnemy.health -= 20;
                if (nearestEnemy.health <= 0 && nearestEnemy.isAlive) {
                    nearestEnemy.isAlive = false;
                    nearestEnemy.model.visible = false;
                    checkRoundEnd();
                }
            }
        }
    });
    
    // 적군 AI
    enemies.forEach(enemy => {
        if (!enemy.isAlive) return;
        
        // 플레이어 향해 이동
        const directionToPlayer = new THREE.Vector3()
            .subVectors(player.position, enemy.position)
            .normalize();
        
        enemy.targetPosition.add(directionToPlayer.multiplyScalar(delta * 3));
        enemy.position.lerp(enemy.targetPosition, delta * 2);
        enemy.model.position.copy(enemy.position);
        enemy.model.lookAt(player.position);
        
        // 플레이어 사격
        const distanceToPlayer = enemy.position.distanceTo(player.position);
        if (distanceToPlayer < 50 && Date.now() - enemy.lastShot > 800 && Math.random() < 0.05) {
            enemy.lastShot = Date.now();
            
            if (Math.random() < 0.3) { // 30% 명중률
                gameState.health -= 15;
                
                // 피격 효과
                flashScreen(0xff0000);
                
                if (gameState.health <= 0 && gameState.isAlive) {
                    gameState.isAlive = false;
                    gameState.health = 0;
                    addKillLog('사망했습니다');
                    checkRoundEnd();
                }
                updateUI();
            }
        }
    });
}

function findNearestEnemy(position, team) {
    const targets = team === 'enemy' ? enemies : allies;
    let nearest = null;
    let minDist = Infinity;
    
    targets.forEach(target => {
        if (!target.isAlive) return;
        const dist = position.distanceTo(target.position);
        if (dist < minDist) {
            minDist = dist;
            nearest = target;
        }
    });
    
    return nearest;
}

function checkRoundEnd() {
    const aliveAllies = allies.filter(a => a.isAlive).length + (gameState.isAlive ? 1 : 0);
    const aliveEnemies = enemies.filter(e => e.isAlive).length;
    
    if (aliveEnemies === 0) {
        endRound('ally');
    } else if (aliveAllies === 0) {
        endRound('enemy');
    }
}

function flashScreen(color) {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = `#${color.toString(16)}`;
    flash.style.opacity = '0.3';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '9998';
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.remove();
    }, 100);
}

// ===== 상점 시스템 =====
function setupShop() {
    document.querySelectorAll('.shop-item').forEach(item => {
        item.addEventListener('click', () => {
            const weaponKey = item.getAttribute('data-weapon');
            const price = parseInt(item.getAttribute('data-price'));
            
            if (gameState.money >= price) {
                gameState.money -= price;
                
                // 주무기 슬롯에 추가
                gameState.inventory.primary = weaponKey;
                gameState.currentWeaponSlot = 0;
                
                // 무기 데이터 복사 (탄약 초기화)
                const weaponTemplate = WEAPONS[weaponKey];
                gameState.currentWeapon = { ...weaponTemplate };
                
                updateWeaponInHand();
                updateUI();
                
                addKillLog(`${weaponTemplate.name} 구매!`);
            } else {
                addKillLog('돈이 부족합니다');
            }
        });
    });
}

// ===== UI 업데이트 =====
function updateUI() {
    document.getElementById('ally-score').textContent = gameState.allyScore;
    document.getElementById('enemy-score').textContent = gameState.enemyScore;
    document.getElementById('current-round').textContent = gameState.round;
    document.getElementById('money').textContent = gameState.money;
    document.getElementById('health-value').textContent = Math.max(0, Math.floor(gameState.health));
    document.getElementById('health-fill').style.width = `${Math.max(0, gameState.health)}%`;
    
    const weapon = getCurrentWeapon();
    if (weapon) {
        document.getElementById('weapon-name').textContent = weapon.name;
        document.getElementById('current-ammo').textContent = weapon.magazineSize;
        document.getElementById('reserve-ammo').textContent = weapon.reserveAmmo;
    }
}

function addKillLog(message) {
    const killLog = document.getElementById('kill-log');
    const msg = document.createElement('div');
    msg.className = 'kill-message';
    msg.textContent = message;
    
    killLog.insertBefore(msg, killLog.firstChild);
    
    setTimeout(() => {
        msg.remove();
    }, 5000);
    
    // 최대 5개만 표시
    while (killLog.children.length > 5) {
        killLog.removeChild(killLog.lastChild);
    }
}

// ===== 이벤트 리스너 =====
function setupEventListeners() {
    // 키보드
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        
        // 무기 변경
        if (e.code === 'Digit1') {
            gameState.currentWeaponSlot = 0;
            updateWeaponInHand();
        } else if (e.code === 'Digit2') {
            gameState.currentWeaponSlot = 1;
            updateWeaponInHand();
        } else if (e.code === 'Digit3') {
            gameState.currentWeaponSlot = 2;
            updateWeaponInHand();
        }
        
        // 재장전
        if (e.code === 'KeyR') {
            reload();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });
    
    // 마우스
    document.addEventListener('mousedown', (e) => {
        if (!isPointerLocked) return;
        
        if (e.button === 0) { // 좌클릭
            shoot();
        } else if (e.button === 2) { // 우클릭
            const weapon = getCurrentWeapon();
            if (weapon && weapon.hasADS) {
                gameState.isADS = true;
                camera.fov = 40; // 줌인
                camera.updateProjectionMatrix();
            }
        }
    });
    
    document.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
            gameState.isADS = false;
            camera.fov = 75; // 원래대로
            camera.updateProjectionMatrix();
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isPointerLocked) return;
        
        const sensitivity = 0.002;
        
        camera.rotation.y -= e.movementX * sensitivity;
        camera.rotation.x -= e.movementY * sensitivity;
        
        // 카메라 각도 제한
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    });
    
    // Pointer Lock
    document.getElementById('click-to-play').addEventListener('click', () => {
        document.body.requestPointerLock();
    });
    
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === document.body;
        
        if (isPointerLocked) {
            document.getElementById('click-to-play').classList.add('hidden');
        } else {
            if (gameState.phase === 'combat') {
                document.getElementById('click-to-play').classList.remove('hidden');
            }
        }
    });
    
    // 우클릭 메뉴 비활성화
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // 리사이즈
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // 재시작 버튼
    document.getElementById('restart-btn').addEventListener('click', () => {
        location.reload();
    });
    
    // 상점 설정
    setupShop();
}

// ===== 플레이어 움직임 =====
function updatePlayer(delta) {
    if (!gameState.isAlive || gameState.phase !== 'combat') return;
    
    const moveSpeed = 5;
    const jumpForce = 7;
    const gravity = 20;
    
    // 이동 방향
    const direction = new THREE.Vector3();
    
    if (keys['KeyW']) direction.z -= 1;
    if (keys['KeyS']) direction.z += 1;
    if (keys['KeyA']) direction.x -= 1;
    if (keys['KeyD']) direction.x += 1;
    
    // 이동 중인지 확인
    player.isMoving = direction.length() > 0;
    
    if (direction.length() > 0) {
        direction.normalize();
        
        // 카메라 방향으로 회전
        direction.applyQuaternion(camera.quaternion);
        direction.y = 0;
        direction.normalize();
        
        player.velocity.x = direction.x * moveSpeed;
        player.velocity.z = direction.z * moveSpeed;
    } else {
        player.velocity.x *= 0.9;
        player.velocity.z *= 0.9;
    }
    
    // 점프
    if (keys['Space'] && player.canJump) {
        player.velocity.y = jumpForce;
        player.canJump = false;
    }
    
    // 중력
    player.velocity.y -= gravity * delta;
    
    // 위치 업데이트
    player.position.x += player.velocity.x * delta;
    player.position.y += player.velocity.y * delta;
    player.position.z += player.velocity.z * delta;
    
    // 바닥 충돌
    if (player.position.y < 1.6) {
        player.position.y = 1.6;
        player.velocity.y = 0;
        player.canJump = true;
    }
    
    // 맵 경계
    player.position.x = Math.max(-95, Math.min(95, player.position.x));
    player.position.z = Math.max(-95, Math.min(95, player.position.z));
    
    // 카메라 위치 업데이트
    camera.position.copy(player.position);
}

// ===== 애니메이션 루프 =====
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    updatePlayer(delta);
    updateAI(delta);
    
    // 무기 흔들림 효과 (이동 시)
    if (weaponModel && player.isMoving) {
        const time = Date.now() * 0.003;
        weaponModel.position.y = -0.2 + Math.sin(time * 2) * 0.02;
        weaponModel.position.x = 0.2 + Math.cos(time) * 0.01;
    }
    
    renderer.render(scene, camera);
}

// ===== 게임 시작 =====
window.addEventListener('load', init);
