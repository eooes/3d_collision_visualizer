import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'; // Import OBJLoader
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import GUI from 'lil-gui';
import { LAYER_DATA } from './layers.js';

import './style.css';

// BVH Setup
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Configuration
const PIXEL_SIZE = 0.05;

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(20, 20, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Group to hold all layers
const cylinderGroup = new THREE.Group();
scene.add(cylinderGroup);

// Helpers
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Boundary Helper (Visual Reference of Max Dimensions)
// Max height is 80 * 0.05 = 4.
// Max Width is 128 * 0.05 = 6.4 -> Radius ~ 1.01
const maxLayer = LAYER_DATA[0]; // Layer 1 is 128x80
const maxRadius = (maxLayer.width * PIXEL_SIZE) / (2 * Math.PI);
const maxHeight = maxLayer.height * PIXEL_SIZE;
const boundaryGeo = new THREE.CylinderGeometry(maxRadius, maxRadius, maxHeight, 32, 1, true);
const boundaryMat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true, opacity: 0.3, transparent: true });
const boundaryMesh = new THREE.Mesh(boundaryGeo, boundaryMat);
scene.add(boundaryMesh);


// Collision System
// We will merge the loaded model into a single BVH mesh for easier testing
let colliderMesh = null;
let colliderMeshGroup = new THREE.Group(); // Holds the visual representation
scene.add(colliderMeshGroup);


// UI Container
const uiContainer = document.createElement('div');
uiContainer.id = 'ui-container';
document.body.appendChild(uiContainer);

// GUI
const gui = new GUI();
const params = {
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    autoRotate: true,
    rotationSpeedX: 0.5,
    rotationSpeedY: 0.3,
    rotationSpeedZ: 0.0,
    scale: 1.0,
    objectOpacity: 0.5,
    objectVisible: true,
    layerOpacity: 0.9,
    layerVisible: true,
    showBoundary: true,
    loadFile: () => { document.getElementById('file-input').click(); }
};

gui.add(params, 'showBoundary').onChange(v => boundaryMesh.visible = v);

const folderObj = gui.addFolder('Target Object');
folderObj.add(params, 'loadFile').name('Upload .glb/.gltf/.obj');
folderObj.add(params, 'scale', 0.1, 5.0).onChange(v => {
    colliderMeshGroup.scale.set(v, v, v);
});
folderObj.add(params, 'offsetX', -10, 10).name('Position X');
folderObj.add(params, 'offsetY', -10, 10).name('Position Y');
folderObj.add(params, 'offsetZ', -10, 10).name('Position Z');

folderObj.add(params, 'rotateX', 0, 360).name('Rotate X (Deg)');
folderObj.add(params, 'rotateY', 0, 360).name('Rotate Y (Deg)');
folderObj.add(params, 'rotateZ', 0, 360).name('Rotate Z (Deg)');

folderObj.add(params, 'autoRotate').name('Auto Rotate');
folderObj.add(params, 'rotationSpeedX', 0, 5);
folderObj.add(params, 'rotationSpeedY', 0, 5);
folderObj.add(params, 'rotationSpeedZ', 0, 5);
folderObj.add(params, 'objectVisible').onChange(v => colliderMeshGroup.visible = v);
folderObj.add(params, 'objectOpacity', 0, 1).onChange(v => {
    colliderMeshGroup.traverse(c => {
        if (c.isMesh) { c.material.transparent = true; c.material.opacity = v; }
    });
});

const folderLayer = gui.addFolder('Layers');
folderLayer.add(params, 'layerVisible').onChange(v => cylinderGroup.visible = v);
folderLayer.add(params, 'layerOpacity', 0, 1).onChange(v => {
    layers.forEach(l => l.mesh.material.opacity = v);
});

// File Input
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.id = 'file-input';
fileInput.accept = '.glb,.gltf,.obj';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const extension = file.name.split('.').pop().toLowerCase();

    const onLoad = (object) => {
        // Clear old
        while (colliderMeshGroup.children.length > 0) {
            colliderMeshGroup.remove(colliderMeshGroup.children[0]);
        }
        if (colliderMesh) {
            colliderMesh.geometry.disposeBoundsTree();
            colliderMesh = null;
        }

        // GLTFLoader returns object.scene, OBJLoader returns object (Group)
        const model = (object.scene) ? object.scene : object;

        // Center model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        colliderMeshGroup.add(model);

        // Build BVH for collision check
        // We will collect all geometries and merge them into one for the raycaster
        const geometries = [];
        model.updateMatrixWorld(true);
        model.traverse(c => {
            if (c.isMesh && c.geometry) {
                const clones = c.geometry.clone();
                clones.applyMatrix4(c.matrixWorld);
                geometries.push(clones);
            }
        });

        if (geometries.length > 0) {
            const mergedGeo = BufferGeometryUtils.mergeGeometries(geometries);
            mergedGeo.computeBoundsTree();
            colliderMesh = new THREE.Mesh(mergedGeo, new THREE.MeshBasicMaterial());
            // colliderMesh is NOT added to scene, just used for raycasting
        }

        // Reset Scale
        colliderMeshGroup.scale.set(params.scale, params.scale, params.scale);

        // Apply rendering props
        model.traverse(c => {
            if (c.isMesh) {
                c.material.transparent = true;
                c.material.opacity = params.objectOpacity;
                // Ensure double side for "inside" view if mesh is open?
                c.material.side = THREE.DoubleSide;
            }
        });

    };

    const onError = (err) => {
        console.error(err);
        alert('Error loading file');
    };

    if (extension === 'obj') {
        objLoader.load(url, onLoad, undefined, onError);
    } else {
        gltfLoader.load(url, onLoad, undefined, onError);
    }
});

// Load default cube
{
    const geo = new THREE.BoxGeometry(4, 8, 4);
    geo.computeBoundsTree();
    colliderMesh = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());

    const visualMesh = new THREE.Mesh(geo, new THREE.MeshNormalMaterial({ wireframe: true, opacity: 0.5, transparent: true }));
    colliderMeshGroup.add(visualMesh);
}


const layers = [];
LAYER_DATA.forEach(data => {
    const radius = (data.width * PIXEL_SIZE) / (2 * Math.PI);
    const height = data.height * PIXEL_SIZE;
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);
    const canvas = document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geometry, material);
    cylinderGroup.add(mesh);

    const row = document.createElement('div');
    row.className = 'layer-row';
    const label = document.createElement('span');
    label.className = 'layer-label';
    label.textContent = data.id;
    row.appendChild(label);
    canvas.className = 'layer-canvas';
    row.appendChild(canvas);
    uiContainer.appendChild(row);

    layers.push({ mesh, canvas, ctx, texture, data, radius, worldHeight: height });
});

// Export / Composite System
const totalWidth = LAYER_DATA.reduce((sum, layer) => sum + layer.width + (layer.gap || 0), 0);
const exportMaxHeight = Math.max(...LAYER_DATA.map(d => d.height)); // Should be 80

const masterCanvas = document.createElement('canvas');
masterCanvas.width = totalWidth;
masterCanvas.height = exportMaxHeight;
const masterCtx = masterCanvas.getContext('2d');

function updateMasterCanvas() {
    masterCtx.fillStyle = 'black';
    masterCtx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);

    let xOffset = 0;
    layers.forEach(layer => {
        // Draw each layer horizontally
        // Align vertically center? All are 80px so it matches.

        masterCtx.drawImage(layer.canvas, xOffset, 0);
        xOffset += layer.data.width + (layer.data.gap || 0);
    });
}

// Recording State
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

const exportParams = {
    saveImage: () => {
        updateMasterCanvas();
        const link = document.createElement('a');
        link.download = `cylinder_layers_${Date.now()}.png`;
        link.href = masterCanvas.toDataURL('image/png');
        link.click();
    },
    toggleRecord: () => {
        if (isRecording) {
            // Stop
            mediaRecorder.stop();
            isRecording = false;
            exportFolder.controllers.find(c => c.property === 'toggleRecord').name('Start Recording');
        } else {
            // Start
            updateMasterCanvas(); // Ensure init
            const stream = masterCanvas.captureStream(30); // 30 FPS
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
            recordedChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `cylinder_recording_${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
            };

            mediaRecorder.start();
            isRecording = true;
            exportFolder.controllers.find(c => c.property === 'toggleRecord').name('Stop Recording');
        }
    }
};

const exportFolder = gui.addFolder('Export');
exportFolder.add(exportParams, 'saveImage').name('Save Image (PNG)');
exportFolder.add(exportParams, 'toggleRecord').name('Start Recording');


const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const inverseMatrix = new THREE.Matrix4();
const dir = new THREE.Vector3(0, 0, -1); // Ray direction

// Reusable objects for collision loop to avoid GC
const tempVec = new THREE.Vector3();
const tempCyl = new THREE.Cylindrical();
const tempBox = new THREE.Box3();

function checkCollisions() {
    if (!colliderMesh) return;

    // Update the invisible collider mesh transform to match the visual group
    colliderMesh.rotation.copy(colliderMeshGroup.rotation);
    colliderMesh.position.copy(colliderMeshGroup.position);
    colliderMesh.scale.copy(colliderMeshGroup.scale);
    colliderMesh.updateMatrixWorld();

    // Compute World AABB for fast rejection
    tempBox.makeEmpty();
    tempBox.setFromObject(colliderMeshGroup);
    tempBox.expandByScalar(0.1);

    layers.forEach(layer => {
        const { width, height } = layer.data;
        const radius = layer.radius;
        const ctx = layer.ctx;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Loop through pixels
        for (let x = 0; x < width; x++) {
            const theta = (x / width) * 2 * Math.PI;

            for (let y = 0; y < height; y++) {
                const yPos = (height / 2 - y) * PIXEL_SIZE;

                // Set Cylindrical coordinates
                tempCyl.set(radius, theta, yPos);
                tempVec.setFromCylindrical(tempCyl);
                tempVec.applyMatrix4(cylinderGroup.matrixWorld);

                // 1. AABB Reject
                if (!tempBox.containsPoint(tempVec)) {
                    // Outside box -> Black
                    const index = (y * width + x) * 4;
                    data[index] = 0;
                    data[index + 1] = 0;
                    data[index + 2] = 0;
                    data[index + 3] = 255;
                    continue;
                }

                // 2. Raycast
                raycaster.set(tempVec, dir); // dir is (0,0,-1)
                const intersections = raycaster.intersectObject(colliderMesh, true);

                let isInside = false;
                if (intersections.length % 2 === 1) {
                    isInside = true;
                }

                const index = (y * width + x) * 4;
                if (isInside) {
                    data[index] = 255;
                    data[index + 1] = 255;
                    data[index + 2] = 255;
                    data[index + 3] = 255;
                } else {
                    data[index] = 0;
                    data[index + 1] = 0;
                    data[index + 2] = 0;
                    data[index + 3] = 255;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        layer.texture.needsUpdate = true;
    });
}

function animate() {
    requestAnimationFrame(animate);

    // Apply Position Offset
    colliderMeshGroup.position.set(params.offsetX, params.offsetY, params.offsetZ);

    // Rotate Visual Group if AutoRotate is true
    if (params.autoRotate) {
        colliderMeshGroup.rotation.x += params.rotationSpeedX * 0.01;
        colliderMeshGroup.rotation.y += params.rotationSpeedY * 0.01;
        colliderMeshGroup.rotation.z += params.rotationSpeedZ * 0.01;
    }

    colliderMeshGroup.updateMatrixWorld();

    checkCollisions();

    if (isRecording) {
        updateMasterCanvas();
    }

    controls.update();
    renderer.render(scene, camera);
}

const direction = new THREE.Vector3(0, 0, -1);
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

