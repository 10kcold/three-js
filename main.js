// main.js

import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';

const DEFAULT_MASS = 10;

class RigidBody {
  constructor() {}

  setRestitution(val) {
    this.body_.setRestitution(val);
  }

  setFriction(val) {
    this.body_.setFriction(val);
  }

  setRollingFriction(val) {
    this.body_.setRollingFriction(val);
  }

  createBox(mass, pos, quat, size) {
    this.transform_ = new Ammo.btTransform();
    this.transform_.setIdentity();
    this.transform_.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    this.transform_.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    this.motionState_ = new Ammo.btDefaultMotionState(this.transform_);

    const btSize = new Ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);
    this.shape_ = new Ammo.btBoxShape(btSize);
    this.shape_.setMargin(0.05);

    this.inertia_ = new Ammo.btVector3(0, 0, 0);
    if (mass > 0) {
      this.shape_.calculateLocalInertia(mass, this.inertia_);
    }

    this.info_ = new Ammo.btRigidBodyConstructionInfo(mass, this.motionState_, this.shape_, this.inertia_);
    this.body_ = new Ammo.btRigidBody(this.info_);

    Ammo.destroy(btSize);
  }

  createSphere(mass, pos, size) {
    this.transform_ = new Ammo.btTransform();
    this.transform_.setIdentity();
    this.transform_.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    this.transform_.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
    this.motionState_ = new Ammo.btDefaultMotionState(this.transform_);

    this.shape_ = new Ammo.btSphereShape(size);
    this.shape_.setMargin(0.05);

    this.inertia_ = new Ammo.btVector3(0, 0, 0);
    if (mass > 0) {
      this.shape_.calculateLocalInertia(mass, this.inertia_);
    }

    this.info_ = new Ammo.btRigidBodyConstructionInfo(mass, this.motionState_, this.shape_, this.inertia_);
    this.body_ = new Ammo.btRigidBody(this.info_);
  }
}

class BasicWorldDemo {
  constructor() {}

  initialize() {
    this.collisionConfiguration_ = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher_ = new Ammo.btCollisionDispatcher(this.collisionConfiguration_);
    this.broadphase_ = new Ammo.btDbvtBroadphase();
    this.solver_ = new Ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld_ = new Ammo.btDiscreteDynamicsWorld(
      this.dispatcher_,
      this.broadphase_,
      this.solver_,
      this.collisionConfiguration_
    );
    this.physicsWorld_.setGravity(new Ammo.btVector3(0, -100, 0));

    const canvas = document.querySelector('.webgl');
    this.threejs_ = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas,
    });
    this.threejs_.shadowMap.enabled = true;
    this.threejs_.shadowMap.type = THREE.PCFSoftShadowMap;
    this.threejs_.setPixelRatio(window.devicePixelRatio);
    this.threejs_.setSize(window.innerWidth, window.innerHeight);

    window.addEventListener(
      'resize',
      () => {
        this.onWindowResize_();
      },
      false
    );

    const fov = 60;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 1.0;
    const far = 1000.0;
    this.camera_ = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera_.position.set(75, 20, 0);

    this.scene_ = new THREE.Scene();

    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(20, 100, 10);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    this.scene_.add(light);

    const ambientLight = new THREE.AmbientLight(0x101010);
    this.scene_.add(ambientLight);

    const controls = new OrbitControls(this.camera_, this.threejs_.domElement);
    controls.target.set(0, 20, 0);
    controls.update();

    const gui = new GUI();
    const obj = {
      Spawn_Box: () => {
        for (let i = 0; i < 10; i++) {
          this.Box_();
        }
      },
      Spawn_Sphere: () => {
        for (let i = 0; i < 10; i++) {
          this.Sphere_();
        }
      },
    };

    gui.add(obj, 'Spawn_Box');
    gui.add(obj, 'Spawn_Sphere');

    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
      './resources/px.png',
      './resources/nx.png',
      './resources/py.png',
      './resources/ny.png',
      './resources/pz.png',
      './resources/nz.png',
    ]);
    this.scene_.background = texture;

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(100, 1, 100),
      new THREE.MeshStandardMaterial({ color: 0x404040 })
    );
    ground.castShadow = false;
    ground.receiveShadow = true;
    this.scene_.add(ground);

    const rbGround = new RigidBody();
    rbGround.createBox(0, ground.position, ground.quaternion, new THREE.Vector3(100, 1, 100));
    rbGround.setRestitution(0.99);
    this.physicsWorld_.addRigidBody(rbGround.body_);

    this.rigidBodies_ = [];
    this.tmpTransform_ = new Ammo.btTransform();

    this.previousRAF_ = null;
    this.raf_();
  }

  onWindowResize_() {
    this.camera_.aspect = window.innerWidth / window.innerHeight;
    this.camera_.updateProjectionMatrix();
    this.threejs_.setSize(window.innerWidth, window.innerHeight);
  }

  raf_() {
    requestAnimationFrame((t) => {
      if (this.previousRAF_ === null) {
        this.previousRAF_ = t;
      }
      this.step_(t - this.previousRAF_);
      this.threejs_.render(this.scene_, this.camera_);
      this.raf_();
      this.previousRAF_ = t;
    });
  }

  Box_() {
    const boxscale = Math.random() * 5 + 5;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(boxscale, boxscale, boxscale),
      new THREE.MeshStandardMaterial({ color: 0x808080 })
    );
    box.position.set(Math.random() * 2 - 1, 200.0, Math.random() * 2 - 1);
    box.castShadow = true;
    box.receiveShadow = true;

    const rb = new RigidBody();
    rb.createBox(DEFAULT_MASS, box.position, box.quaternion, new THREE.Vector3(boxscale, boxscale, boxscale));
    rb.setRestitution(0.125);
    rb.setFriction(1);
    rb.setRollingFriction(5);

    this.physicsWorld_.addRigidBody(rb.body_);

    this.rigidBodies_.push({ mesh: box, rigidBody: rb });
    this.scene_.add(box);
  }

  Sphere_() {
    const radius = Math.random() * 5 + 5;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x808080 })
    );
    sphere.position.set(Math.random() * 2 - 1, 200.0, Math.random() * 2 - 1);
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    const rb = new RigidBody();
    rb.createSphere(DEFAULT_MASS, sphere.position, radius);
    rb.setRestitution(0.125);
    rb.setFriction(1);
    rb.setRollingFriction(5);

    this.physicsWorld_.addRigidBody(rb.body_);

    this.rigidBodies_.push({ mesh: sphere, rigidBody: rb });
    this.scene_.add(sphere);
  }

  step_(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    this.physicsWorld_.stepSimulation(timeElapsedS, 10);

    for (const obj of this.rigidBodies_) {
      obj.rigidBody.motionState_.getWorldTransform(this.tmpTransform_);
      const pos = this.tmpTransform_.getOrigin();
      const quat = this.tmpTransform_.getRotation();
      obj.mesh.position.set(pos.x(), pos.y(), pos.z());
      obj.mesh.quaternion.set(quat.x(), quat.y(), quat.z(), quat.w());
    }
  }
}

let APP_ = null;

window.addEventListener('DOMContentLoaded', () => {
  Ammo().then((lib) => {
    Ammo = lib;
    APP_ = new BasicWorldDemo();
    APP_.initialize();
  });
});
