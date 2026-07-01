import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";

const canvas = document.querySelector("#previewCanvas");
const app = document.querySelector("#app");
const panelToggle = document.querySelector("#panelToggle");
const headAdjustToggle = document.querySelector("#headAdjustToggle");
const cameraOverlay = document.querySelector("#cameraOverlay");
const lightToggle = document.querySelector("#lightToggle");
const lightOverlay = document.querySelector("#lightOverlay");
const viewer = document.querySelector(".viewer");
const headAdjustUi = document.querySelector("#headAdjustUi");
const headAdjustEllipse = document.querySelector("#headAdjustEllipse");
const headAdjustLineX = document.querySelector("#headAdjustLineX");
const headAdjustLineY = document.querySelector("#headAdjustLineY");
const headAdjustCenter = document.querySelector("#headAdjustCenter");
const headAdjustHandles = [...document.querySelectorAll("[data-head-handle]")];
const headDeltaDown = document.querySelector("#headDeltaDown");
const headDeltaUp = document.querySelector("#headDeltaUp");
const headDeltaValue = document.querySelector("#headDeltaValue");
const viewerAnimationActions = document.querySelector("#viewerAnimationActions");
const controlPanel = document.querySelector("#controlPanel");
const dropZone = document.querySelector("#dropZone");
const vrmInput = document.querySelector("#vrmInput");
const vrmaInput = document.querySelector("#vrmaInput");
const saveSettingsFile = document.querySelector("#saveSettingsFile");
const loadSettingsFile = document.querySelector("#loadSettingsFile");
const settingsFileInput = document.querySelector("#settingsFileInput");
const modelName = document.querySelector("#modelName");
const motionName = document.querySelector("#motionName");
const statusText = document.querySelector("#statusText");
const playPause = document.querySelector("#playPause");
const fitCamera = document.querySelector("#fitCamera");
const resetPose = document.querySelector("#resetPose");
const speed = document.querySelector("#speed");
const speedValue = document.querySelector("#speedValue");
const loop = document.querySelector("#loop");
const animationRefresh = document.querySelector("#animationRefresh");
const animationFolderButton = document.querySelector("#animationFolderButton");
const animationSlotList = document.querySelector("#animationSlotList");
const animationFileInput = document.querySelector("#animationFileInput");
const viewportHint = document.querySelector("#viewportHint");
const expressionBar = document.querySelector("#expressionBar");
const gazeRangeOutputs = {
  left: document.querySelector("#gazeLeftValue"),
  right: document.querySelector("#gazeRightValue"),
  up: document.querySelector("#gazeUpValue"),
  down: document.querySelector("#gazeDownValue"),
};
const gazeRangeButtons = [...document.querySelectorAll("[data-gaze-range]")];

const randomGazeUnitScale = 0.12;
const clickGazeScale = 2.4;
const randomHeadScale = 0.18;
const maxClickHeadYaw = THREE.MathUtils.degToRad(30);
const maxClickHeadPitch = THREE.MathUtils.degToRad(20);
const animationSlotCount = 8;
const animationFolderHandleKey = "animationFolderHandle";
const animationDbName = "vrm-vrma-sidepanel-files";
const animationDbStore = "handles";
const animationFolderMissingText = "애니 폴더를 지정하세요";
const animationFileMissingText = "파일을 애니폴더에 넣고 새로고침 하시오";
const settingsFileVersion = 1;
const animationFadeSeconds = 0.3;
const returnToIdleDelaySeconds = 3;

const sliders = {
  lightIntensity: bindSlider("lightIntensity", 1),
  lightX: bindSlider("lightX", 1),
  lightY: bindSlider("lightY", 1),
  lightZ: bindSlider("lightZ", 1),
  cameraY: bindSlider("cameraY", 2),
  cameraZoom: bindSlider("cameraZoom", 2),
  cameraPitch: bindSlider("cameraPitch", 0),
};

const defaultSettings = {
  light: { intensity: 1.6, x: 2.5, y: 4.5, z: 3 },
  camera: { y: 1.25, zoom: 3.2, pitch: 0 },
  gazeRange: { left: -5, right: 5, up: 3, down: -3 },
  headAdjust: { radiusX: 0.36, radiusY: 0.38, delta: 18 },
  expressionBlink: {},
  animationFolderName: "",
  animationSlots: Array.from({ length: animationSlotCount }, (_, index) => ({
    name: `Animation ${index + 1}`,
    fileName: "",
    actionEnabled: true,
    loop: true,
    expression: "neutral",
  })),
  controlsOpen: true,
};

const preferredExpressionNames = [
  "neutral",
  "neutral2",
  "angry",
  "happy",
  "relaxed",
  "sad",
  "surprise",
  "focus",
  "tension",
  "disappointed",
  "warmSmile",
  "relief",
];

const expressionAliases = {
  surprise: ["surprise", "surprised"],
};

let settings = structuredClone(defaultSettings);
let currentVrm = null;
let currentVrmRoot = null;
let mixer = null;
let action = null;
let isPlaying = false;
let animationHasEyeKeyframes = false;
let pendingIdleTimeout = null;
let activeFinishedHandler = null;
let currentPlaybackSlotIndex = null;
let activeExpression = "neutral";
let expressionNames = ["neutral"];
let expressionTransition = null;
let lastVrmUrl = null;
let lastVrmaUrl = null;
let animationDirectoryHandle = null;
let activeAnimationSlotIndex = null;
let animationSlotStates = [];
let blinkExpressionNames = [];
let blinkElapsed = 0;
let blinkInterval = getNextBlinkInterval();
let blinkProgress = null;
let interactionBlinkCooldown = 0;
let gazeAnchorWorld = new THREE.Vector3(0, 1.35, 0);
let gazeTargetWorld = new THREE.Vector3(0, 1.35, 2);
let gazeCurrentWorld = gazeTargetWorld.clone();
let gazeTargetScreen = new THREE.Vector2(0, 0);
let gazeRandomElapsed = 0;
let gazeRandomInterval = getNextGazeInterval();
let gazeClickHold = 0;
let headReturnHold = 0;
let buttonHoverGazeActive = false;
let viewerPointerDown = false;
let viewerPointerDragged = false;
let activeHeadAdjustHandle = null;
let currentHeadTurn = new THREE.Vector2(0, 0);
let targetHeadTurn = new THREE.Vector2(0, 0);
let headTurnTransitionFrom = new THREE.Vector2(0, 0);
let headTurnTransitionTo = new THREE.Vector2(0, 0);
let headTurnTransitionElapsed = 0;
let headTurnTransitionDuration = 0.3;
let appliedHeadOffset = new THREE.Quaternion();
let appliedNeckOffset = new THREE.Quaternion();
let hasAppliedHeadOffset = false;
const restPose = new Map();
const clock = new THREE.Clock();
const gazeCameraDirection = new THREE.Vector3();
const gazeCameraRight = new THREE.Vector3();
const gazeCameraUp = new THREE.Vector3();
const gazeAnchorScreen = new THREE.Vector3();
const leftEyeScreen = new THREE.Vector3();
const rightEyeScreen = new THREE.Vector3();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11181d);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xb7cabc, 0.9);
const keyLight = new THREE.DirectionalLight(0xffffff, settings.light.intensity);
scene.add(hemiLight, keyLight);

const floorGrid = new THREE.GridHelper(4, 20, 0x556873, 0x26323a);
scene.add(floorGrid);

const vrmLoader = new GLTFLoader();
vrmLoader.register((parser) => new VRMLoaderPlugin(parser));

const vrmaLoader = new GLTFLoader();
vrmaLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));

function bindSlider(id, digits) {
  return {
    input: document.querySelector(`#${id}`),
    output: document.querySelector(`#${id}Value`),
    digits,
  };
}

function storageArea() {
  return globalThis.chrome?.storage?.local;
}

async function loadSettings() {
  const area = storageArea();

  if (area) {
    const stored = await area.get("vrmVrmaSidePanelSettings");
    return stored.vrmVrmaSidePanelSettings ?? defaultSettings;
  }

  try {
    return JSON.parse(localStorage.getItem("vrmVrmaSidePanelSettings")) ?? defaultSettings;
  } catch {
    return defaultSettings;
  }
}

async function saveSettings() {
  const payload = { vrmVrmaSidePanelSettings: settings };
  const area = storageArea();

  if (area) {
    await area.set(payload);
    return;
  }

  localStorage.setItem("vrmVrmaSidePanelSettings", JSON.stringify(settings));
}

function getPortableSettings() {
  return {
    light: settings.light,
    camera: settings.camera,
    gazeRange: settings.gazeRange,
    headAdjust: settings.headAdjust,
    expressionBlink: settings.expressionBlink,
    animationFolderName: settings.animationFolderName,
    animationSlots: settings.animationSlots,
    controlsOpen: settings.controlsOpen,
  };
}

function downloadSettingsFile() {
  const payload = {
    version: settingsFileVersion,
    savedAt: new Date().toISOString(),
    settings: getPortableSettings(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "vrm-vrma-sidepanel-settings.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("Settings file saved");
}

function openSettingsFilePicker() {
  settingsFileInput.value = "";
  settingsFileInput.click();
}

async function loadSettingsFilePayload(file) {
  if (!file) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    const importedSettings = payload.settings ?? payload;

    settings = mergeSettings(settings, importedSettings);
    await saveSettings();
    syncControlsFromSettings();
    renderExpressionButtons(Boolean(currentVrm));
    setExpressionButtonsEnabled(Boolean(currentVrm));
    await refreshAnimationSlots();
    setStatus("Settings file loaded");
  } catch (error) {
    setStatus(error.message || "Failed to load settings file", true);
  }
}

function openAnimationDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(animationDbName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(animationDbStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredHandle(key) {
  const db = await openAnimationDb();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(animationDbStore, "readonly")
      .objectStore(animationDbStore)
      .get(key);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function setStoredHandle(key, handle) {
  const db = await openAnimationDb();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(animationDbStore, "readwrite")
      .objectStore(animationDbStore)
      .put(handle, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function ensureHandlePermission(handle, mode = "read") {
  if (!handle?.queryPermission || !handle?.requestPermission) {
    return false;
  }

  const options = { mode };

  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }

  return (await handle.requestPermission(options)) === "granted";
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "var(--danger)" : "";
}

function setSliderValue(slider, value, suffix = "") {
  slider.input.value = String(value);
  slider.output.textContent = `${Number(value).toFixed(slider.digits)}${suffix}`;
}

function syncControlsFromSettings() {
  setSliderValue(sliders.lightIntensity, settings.light.intensity);
  setSliderValue(sliders.lightX, settings.light.x);
  setSliderValue(sliders.lightY, settings.light.y);
  setSliderValue(sliders.lightZ, settings.light.z);
  setSliderValue(sliders.cameraY, settings.camera.y);
  setSliderValue(sliders.cameraZoom, settings.camera.zoom);
  setSliderValue(sliders.cameraPitch, settings.camera.pitch, "deg");
  updateGazeRangeOutputs();
  updateHeadDeltaOutput();
  applyControlPanelState();
  applyLightSettings();
  applyCameraSettings();
}

function updateGazeRangeOutputs() {
  Object.entries(gazeRangeOutputs).forEach(([key, output]) => {
    output.textContent = settings.gazeRange[key].toFixed(0);
  });
}

function clampGazeRangeValue(key, value) {
  const clamped = THREE.MathUtils.clamp(value, -20, 20);

  if (key === "left" || key === "down") {
    return Math.min(0, clamped);
  }

  return Math.max(0, clamped);
}

function stepGazeRange(key, delta) {
  settings.gazeRange[key] = clampGazeRangeValue(key, settings.gazeRange[key] + delta);
  updateGazeRangeOutputs();
  void saveSettings();
}

function applyControlPanelState() {
  const isOpen = settings.controlsOpen !== false;

  app.classList.toggle("controls-closed", !isOpen);
  controlPanel.hidden = !isOpen;
  panelToggle.textContent = isOpen ? "Hide Controls" : "Show Controls";
  panelToggle.setAttribute("aria-expanded", String(isOpen));
}

function toggleControlPanel() {
  settings.controlsOpen = settings.controlsOpen === false;
  applyControlPanelState();
  resizeRenderer();
  void saveSettings();
}

function toggleHeadAdjustUi() {
  const nextOpen = headAdjustUi.hidden;

  headAdjustUi.hidden = !nextOpen;
  headAdjustToggle.setAttribute("aria-expanded", String(nextOpen));
  updateHeadDeltaOutput();

  if (!nextOpen) {
    void saveSettings();
  }
}

function toggleSettingsOverlay() {
  const nextOpen = cameraOverlay.hidden && lightOverlay.hidden;

  cameraOverlay.hidden = !nextOpen;
  lightOverlay.hidden = !nextOpen;
  lightToggle.setAttribute("aria-expanded", String(nextOpen));

  if (!nextOpen) {
    void saveSettings();
  }
}

function updateHeadDeltaOutput() {
  headDeltaValue.textContent = settings.headAdjust.delta.toFixed(0);
}

function stepHeadDelta(delta) {
  settings.headAdjust.delta = THREE.MathUtils.clamp(settings.headAdjust.delta + delta, 1, 120);
  updateHeadDeltaOutput();
}

function normalizeAnimationSlots(slots = []) {
  return Array.from({ length: animationSlotCount }, (_, index) => {
    const slot = slots[index] ?? {};

    return {
      name: String(slot.name || `Animation ${index + 1}`),
      fileName: String(slot.fileName || ""),
      actionEnabled: slot.actionEnabled !== false,
      loop: slot.loop !== false,
      expression: String(slot.expression || "neutral"),
    };
  });
}

function renderAnimationSlots() {
  animationFolderButton.textContent = settings.animationFolderName || "Select animation folder";
  animationSlotList.replaceChildren();

  settings.animationSlots.forEach((slot, index) => {
    const state = animationSlotStates[index] ?? {};
    const row = document.createElement("div");
    const actionToggleLabel = document.createElement("label");
    const actionToggle = document.createElement("input");
    const nameGroup = document.createElement("label");
    const loopToggle = document.createElement("input");
    const nameInput = document.createElement("input");
    const expressionSelect = document.createElement("select");
    const fileButton = document.createElement("button");
    const chooseButton = document.createElement("button");

    row.className = "animation-slot-row";

    actionToggle.type = "checkbox";
    actionToggle.checked = slot.actionEnabled !== false;
    actionToggle.title = "Show viewer action button";
    actionToggle.addEventListener("change", () => {
      settings.animationSlots[index].actionEnabled = actionToggle.checked;
      renderViewerAnimationActions();
      void saveSettings();
    });

    actionToggleLabel.className = "animation-slot-action-toggle";
    actionToggleLabel.append(actionToggle);

    loopToggle.type = "checkbox";
    loopToggle.checked = slot.loop !== false;
    loopToggle.title = "Loop this animation";
    loopToggle.addEventListener("change", () => {
      settings.animationSlots[index].loop = loopToggle.checked;
      void saveSettings();
    });

    nameInput.className = "animation-slot-name";
    nameInput.value = slot.name;
    nameInput.placeholder = `Animation ${index + 1}`;
    nameInput.addEventListener("change", () => {
      settings.animationSlots[index].name = nameInput.value.trim() || `Animation ${index + 1}`;
      renderViewerAnimationActions();
      void saveSettings();
    });

    nameGroup.className = "animation-slot-name-group";
    nameGroup.append(nameInput, loopToggle);

    expressionSelect.className = "animation-slot-expression";
    getExpressionSelectNames().forEach((expressionName) => {
      const option = document.createElement("option");

      option.value = expressionName;
      option.textContent = formatExpressionLabel(expressionName);
      expressionSelect.append(option);
    });
    expressionSelect.value = getExpressionSelectNames().includes(slot.expression) ? slot.expression : "neutral";
    expressionSelect.addEventListener("change", () => {
      settings.animationSlots[index].expression = expressionSelect.value;
      void saveSettings();
    });

    fileButton.className = "animation-slot-file";
    fileButton.type = "button";
    fileButton.dataset.slotIndex = String(index);
    fileButton.textContent = getAnimationSlotFileText(slot, state);
    fileButton.title = slot.fileName || fileButton.textContent;
    fileButton.addEventListener("click", () => void handleAnimationSlotClick(index));

    chooseButton.className = "animation-slot-choose";
    chooseButton.type = "button";
    chooseButton.textContent = "...";
    chooseButton.title = "Choose animation file";
    chooseButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openAnimationFilePicker(index);
    });

    row.append(actionToggleLabel, nameGroup, expressionSelect, fileButton, chooseButton);
    animationSlotList.append(row);
  });

  renderViewerAnimationActions();
}

function getExpressionSelectNames() {
  return expressionNames.length ? expressionNames : ["neutral"];
}

function getAnimationSlotFileText(slot, state) {
  if ((!animationDirectoryHandle || state.needsFolder) && slot.fileName) {
    return animationFolderMissingText;
  }

  if (animationDirectoryHandle && slot.fileName && state.available === false) {
    return animationFileMissingText;
  }

  return slot.fileName || "Select animation file";
}

async function refreshAnimationSlots({ requestPermission = false } = {}) {
  const hasDirectory = animationDirectoryHandle
    ? await ensureHandlePermission(animationDirectoryHandle, requestPermission ? "readwrite" : "read")
    : false;

  animationSlotStates = await Promise.all(settings.animationSlots.map(async (slot) => {
    if (!slot.fileName) {
      return { available: false };
    }

    if (!hasDirectory) {
      return { available: false, needsFolder: true };
    }

    try {
      const fileHandle = await animationDirectoryHandle.getFileHandle(slot.fileName);
      return { available: true, fileHandle };
    } catch {
      return { available: false };
    }
  }));

  renderAnimationSlots();
}

function renderViewerAnimationActions() {
  viewerAnimationActions.replaceChildren();

  settings.animationSlots.forEach((slot, index) => {
    const state = animationSlotStates[index] ?? {};

    if (slot.actionEnabled === false || !slot.fileName || state.available !== true) {
      return;
    }

    const button = document.createElement("button");

    button.className = "viewer-animation-action-button";
    button.type = "button";
    button.textContent = truncateKoreanButtonText(slot.name || `Animation ${index + 1}`);
    button.title = slot.name || slot.fileName;
    button.addEventListener("click", () => void handleAnimationSlotClick(index));
    viewerAnimationActions.append(button);
  });
}

function truncateKoreanButtonText(text) {
  return [...String(text)].slice(0, 6).join("");
}

async function chooseAnimationFolder() {
  if (!globalThis.showDirectoryPicker) {
    setStatus("This browser cannot choose folders from an extension side panel.", true);
    return;
  }

  try {
    const handle = await showDirectoryPicker({ mode: "readwrite" });
    animationDirectoryHandle = handle;
    settings.animationFolderName = handle.name;
    await setStoredHandle(animationFolderHandleKey, handle);
    await saveSettings();
    await refreshAnimationSlots({ requestPermission: true });
    setStatus("Animation folder selected");
  } catch (error) {
    if (error?.name !== "AbortError") {
      setStatus(error.message || "Failed to select animation folder", true);
    }
  }
}

function openAnimationFilePicker(index) {
  activeAnimationSlotIndex = index;
  animationFileInput.value = "";
  animationFileInput.click();
}

async function handleAnimationSlotClick(index) {
  const slot = settings.animationSlots[index];

  if (!slot.fileName || !animationDirectoryHandle) {
    openAnimationFilePicker(index);
    return;
  }

  if (!(await ensureHandlePermission(animationDirectoryHandle, "read"))) {
    renderAnimationSlots();
    setStatus(animationFolderMissingText, true);
    return;
  }

  try {
    const fileHandle = await animationDirectoryHandle.getFileHandle(slot.fileName);
    const file = await fileHandle.getFile();
    await loadVrma(file, slot.name || file.name, getAnimationSlotPlaybackOptions(slot, index));
    animationSlotStates[index] = { available: true, fileHandle };
    renderAnimationSlots();
  } catch {
    animationSlotStates[index] = { available: false };
    renderAnimationSlots();
    openAnimationFilePicker(index);
  }
}

async function handleAnimationFileSelected(file) {
  const index = activeAnimationSlotIndex;
  activeAnimationSlotIndex = null;

  if (index === null || !file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith(".vrma")) {
    setStatus("Choose a VRMA animation file.", true);
    return;
  }

  let savedFile = file;

  if (animationDirectoryHandle) {
    try {
      if (await ensureHandlePermission(animationDirectoryHandle, "readwrite")) {
        const writableHandle = await animationDirectoryHandle.getFileHandle(file.name, { create: true });
        const writable = await writableHandle.createWritable();
        await writable.write(file);
        await writable.close();
        savedFile = await writableHandle.getFile();
        animationSlotStates[index] = { available: true, fileHandle: writableHandle };
      }
    } catch (error) {
      setStatus(error.message || "Failed to copy animation into the folder", true);
    }
  }

  settings.animationSlots[index].fileName = file.name;
  settings.animationSlots[index].name ||= file.name.replace(/\.vrma$/i, "");
  await saveSettings();
  renderAnimationSlots();
  await loadVrma(
    savedFile,
    settings.animationSlots[index].name || savedFile.name,
    getAnimationSlotPlaybackOptions(settings.animationSlots[index], index),
  );
}

function getAnimationSlotPlaybackOptions(slot, index) {
  return {
    loop: slot.loop !== false,
    expression: slot.expression || "neutral",
    returnToIdle: slot.loop === false,
    slotIndex: index,
  };
}

function getAnchorPixelPosition() {
  const rect = canvas.getBoundingClientRect();

  gazeAnchorScreen.copy(gazeAnchorWorld).project(camera);

  return {
    x: ((THREE.MathUtils.clamp(gazeAnchorScreen.x, -1, 1) + 1) * 0.5) * rect.width,
    y: ((1 - THREE.MathUtils.clamp(gazeAnchorScreen.y, -1, 1)) * 0.5) * rect.height,
    width: rect.width,
    height: rect.height,
  };
}

function updateHeadAdjustUi() {
  if (headAdjustUi.hidden || !currentVrm) {
    return;
  }

  updateGazeAnchorFromVrm();

  const anchor = getAnchorPixelPosition();
  const radiusX = settings.headAdjust.radiusX * anchor.width * 0.5;
  const radiusY = settings.headAdjust.radiusY * anchor.height * 0.5;
  const linePadding = 34;

  headAdjustEllipse.style.left = `${anchor.x}px`;
  headAdjustEllipse.style.top = `${anchor.y}px`;
  headAdjustEllipse.style.width = `${radiusX * 2}px`;
  headAdjustEllipse.style.height = `${radiusY * 2}px`;

  headAdjustLineX.style.left = `${anchor.x}px`;
  headAdjustLineX.style.top = `${anchor.y}px`;
  headAdjustLineX.style.width = `${radiusX * 2 + linePadding}px`;

  headAdjustLineY.style.left = `${anchor.x}px`;
  headAdjustLineY.style.top = `${anchor.y}px`;
  headAdjustLineY.style.height = `${radiusY * 2 + linePadding}px`;

  headAdjustCenter.style.left = `${anchor.x}px`;
  headAdjustCenter.style.top = `${anchor.y}px`;

  headAdjustHandles.forEach((handle) => {
    const kind = handle.dataset.headHandle;
    const x = kind === "left" ? anchor.x - radiusX : kind === "right" ? anchor.x + radiusX : anchor.x;
    const y = kind === "top" ? anchor.y - radiusY : kind === "bottom" ? anchor.y + radiusY : anchor.y;

    handle.style.left = `${x}px`;
    handle.style.top = `${y}px`;
  });

  headAdjustDeltaPosition(anchor);
  updateHeadDeltaOutput();
}

function headAdjustDeltaPosition(anchor) {
  const top = Math.max(96, anchor.y - settings.headAdjust.radiusY * anchor.height * 0.5 - 18);

  headAdjustUi.querySelector(".head-adjust-delta").style.left = `${anchor.x}px`;
  headAdjustUi.querySelector(".head-adjust-delta").style.top = `${top}px`;
}

function applyLightSettings() {
  keyLight.intensity = Number(settings.light.intensity);
  keyLight.position.set(settings.light.x, settings.light.y, settings.light.z);
}

function applyCameraSettings() {
  const pitch = THREE.MathUtils.degToRad(settings.camera.pitch);
  const distance = settings.camera.zoom;
  const targetY = settings.camera.y;

  camera.position.set(0, targetY + Math.sin(pitch) * distance, Math.cos(pitch) * distance);
  camera.lookAt(0, targetY, 0);
  camera.updateProjectionMatrix();
}

function resizeRenderer() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);

  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose();

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => value?.isTexture && value.dispose());
      material.dispose();
    });
  });
}

function getVrmBoneNode(boneName) {
  const humanoid = currentVrm?.humanoid;

  return (
    humanoid?.getNormalizedBoneNode?.(boneName) ??
    humanoid?.getRawBoneNode?.(boneName) ??
    humanoid?.getBoneNode?.(boneName) ??
    humanoid?.humanBones?.[boneName]?.node ??
    null
  );
}

function getVrmRawBoneNode(boneName) {
  const humanoid = currentVrm?.humanoid;

  return (
    humanoid?.getRawBoneNode?.(boneName) ??
    humanoid?.getBoneNode?.(boneName) ??
    humanoid?.humanBones?.[boneName]?.node ??
    humanoid?.getNormalizedBoneNode?.(boneName) ??
    null
  );
}

function getObjectWorldY(object) {
  return object.getWorldPosition(new THREE.Vector3()).y;
}

function getObjectWorldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function findVrmObjectByName(names) {
  let found = null;
  const nameSet = new Set(names);

  currentVrm?.scene.traverse((object) => {
    if (!found && nameSet.has(object.name)) {
      found = object;
    }
  });

  return found;
}

function getLeftEyeNodeForGazeAnchor() {
  return getVrmBoneNode("leftEye") ?? findVrmObjectByName(["J_Adj_L_FaceEye"]);
}

function getRightEyeNodeForGazeAnchor() {
  return getVrmBoneNode("rightEye") ?? findVrmObjectByName(["J_Adj_R_FaceEye"]);
}

function getEyeNodesForAnimationPriority() {
  return [
    getVrmBoneNode("leftEye"),
    getVrmBoneNode("rightEye"),
    findVrmObjectByName(["J_Adj_L_FaceEye"]),
    findVrmObjectByName(["J_Adj_R_FaceEye"]),
  ].filter(Boolean);
}

function resetHeadTurnTransition() {
  currentHeadTurn.set(0, 0);
  targetHeadTurn.set(0, 0);
  headTurnTransitionFrom.set(0, 0);
  headTurnTransitionTo.set(0, 0);
  headTurnTransitionElapsed = 0;
  headTurnTransitionDuration = 0.3;
}

function clipHasEyeBoneKeyframes(clip) {
  const eyeNodes = getEyeNodesForAnimationPriority();

  if (!clip || !eyeNodes.length) {
    return false;
  }

  const eyeIds = new Set(["leftEye", "rightEye", "J_Adj_L_FaceEye", "J_Adj_R_FaceEye"]);

  eyeNodes.forEach((node) => {
    eyeIds.add(node.uuid);
    eyeIds.add(node.name);
  });

  return clip.tracks.some((track) => {
    const trackName = track.name;
    const animatesRotation =
      trackName.endsWith(".quaternion") ||
      trackName.endsWith(".rotation") ||
      trackName.includes(".quaternion[") ||
      trackName.includes(".rotation[");

    return animatesRotation && [...eyeIds].some((id) => id && trackName.includes(id));
  });
}

function updateGazeAnchorFromVrm() {
  currentVrmRoot?.updateMatrixWorld(true);
  currentVrm?.scene.updateMatrixWorld(true);

  const eyeBones = [getLeftEyeNodeForGazeAnchor(), getRightEyeNodeForGazeAnchor()].filter(Boolean);

  if (eyeBones.length) {
    gazeAnchorWorld.set(0, 0, 0);
    eyeBones.forEach((bone) => gazeAnchorWorld.add(getObjectWorldPosition(bone)));
    gazeAnchorWorld.divideScalar(eyeBones.length);
    return;
  }

  const head = getVrmBoneNode("head");

  if (head) {
    gazeAnchorWorld.copy(getObjectWorldPosition(head));
    return;
  }

  const box = new THREE.Box3().setFromObject(currentVrmRoot ?? currentVrm.scene);
  const height = box.max.y - box.min.y;

  gazeAnchorWorld.set(
    (box.min.x + box.max.x) * 0.5,
    Number.isFinite(height) && height > 0 ? box.min.y + height * 0.88 : defaultSettings.camera.y,
    (box.min.z + box.max.z) * 0.5,
  );
}

function captureRestPose() {
  restPose.clear();

  currentVrm?.scene.traverse((object) => {
    if (object.isBone) {
      restPose.set(object.uuid, {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      });
    }
  });
}

function resetVrmToRestPose() {
  currentVrm?.humanoid?.resetNormalizedPose?.();

  restPose.forEach((transform, uuid) => {
    const object = currentVrm?.scene.getObjectByProperty("uuid", uuid);

    if (object) {
      object.position.copy(transform.position);
      object.quaternion.copy(transform.quaternion);
      object.scale.copy(transform.scale);
    }
  });

  currentVrm?.scene.updateMatrixWorld(true);
}

function clearAnimation() {
  clearPendingIdleReturn();
  if (mixer && activeFinishedHandler) {
    mixer.removeEventListener("finished", activeFinishedHandler);
  }
  activeFinishedHandler = null;
  action?.stop();
  mixer?.stopAllAction();
  mixer?.uncacheRoot(currentVrm?.scene ?? scene);
  mixer = null;
  action = null;
  isPlaying = false;
  animationHasEyeKeyframes = false;
  currentPlaybackSlotIndex = null;
  playPause.textContent = "Play";
  playPause.disabled = true;
}

function clearPendingIdleReturn() {
  if (pendingIdleTimeout !== null) {
    clearTimeout(pendingIdleTimeout);
    pendingIdleTimeout = null;
  }
}

function clearVrm() {
  clearAnimation();
  removeAppliedHeadOffset();

  if (currentVrm) {
    scene.remove(currentVrmRoot ?? currentVrm.scene);
    disposeObject(currentVrm.scene);
  }

  currentVrm = null;
  currentVrmRoot = null;
  expressionNames = ["neutral"];
  expressionTransition = null;
  blinkExpressionNames = [];
  resetAutoBlink();
  gazeAnchorWorld.set(0, defaultSettings.camera.y, 0);
  resetGaze();
  activeExpression = "neutral";
  renderExpressionButtons(false);
  restPose.clear();
  modelName.textContent = "None";
  motionName.textContent = "None";
  fitCamera.disabled = true;
  resetPose.disabled = true;
  viewportHint.classList.remove("is-hidden");
  setExpressionButtonsEnabled(false);
}

function setPlayback(nextPlaying) {
  if (!action) {
    return;
  }

  isPlaying = nextPlaying;
  action.paused = !isPlaying;

  if (isPlaying) {
    action.play();
  }

  playPause.textContent = isPlaying ? "Pause" : "Play";
}

function playClip(clip, label, options = {}) {
  clearPendingIdleReturn();
  if (mixer && activeFinishedHandler) {
    mixer.removeEventListener("finished", activeFinishedHandler);
    activeFinishedHandler = null;
  }

  animationHasEyeKeyframes = clipHasEyeBoneKeyframes(clip);
  if (animationHasEyeKeyframes) {
    removeAppliedHeadOffset();
    resetHeadTurnTransition();
  }

  const previousAction = action;
  const shouldLoop = options.loop ?? loop.checked;
  currentPlaybackSlotIndex = Number.isInteger(options.slotIndex) ? options.slotIndex : null;

  mixer ??= new THREE.AnimationMixer(currentVrm.scene);
  action = mixer.clipAction(clip);
  action.reset();
  action.enabled = true;
  action.setEffectiveWeight(1);
  action.setEffectiveTimeScale(Number(speed.value));
  action.setLoop(shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce, shouldLoop ? Infinity : 1);
  action.clampWhenFinished = true;
  action.timeScale = Number(speed.value);

  if (options.expression && expressionNames.includes(options.expression)) {
    applyExpression(options.expression);
  }

  motionName.textContent = label;
  playPause.disabled = false;
  isPlaying = true;
  action.paused = false;
  playPause.textContent = "Pause";

  if (previousAction && previousAction !== action) {
    previousAction.fadeOut(animationFadeSeconds);
    action.fadeIn(animationFadeSeconds);
    setTimeout(() => previousAction.stop(), animationFadeSeconds * 1000 + 80);
  }

  action.play();

  if (!shouldLoop && options.returnToIdle) {
    const finishedAction = action;

    activeFinishedHandler = (event) => {
      if (event.action !== finishedAction) {
        return;
      }

      mixer.removeEventListener("finished", activeFinishedHandler);
      activeFinishedHandler = null;
      pendingIdleTimeout = setTimeout(() => {
        pendingIdleTimeout = null;
        void playIdleAnimation(options.slotIndex);
      }, returnToIdleDelaySeconds * 1000);
    };
    mixer.addEventListener("finished", activeFinishedHandler);
  }
}

async function playIdleAnimation(currentSlotIndex = null) {
  if (animationDirectoryHandle && !animationSlotStates.some((state) => state.available)) {
    await refreshAnimationSlots();
  }

  const idleIndex = findIdleAnimationSlotIndex(currentSlotIndex);

  if (idleIndex >= 0) {
    await handleAnimationSlotClick(idleIndex);
  }
}

function findIdleAnimationSlotIndex(excludeIndex = null) {
  return settings.animationSlots.findIndex((slot, index) => {
    if (index === excludeIndex || !slot.fileName || animationSlotStates[index]?.available !== true) {
      return false;
    }

    const name = slot.name.toLowerCase();
    const fileName = slot.fileName.toLowerCase().replace(/\.vrma$/i, "");

    return name === "idle" || fileName === "idle";
  });
}

function isIdleAnimationSlotIndex(index) {
  if (!Number.isInteger(index)) {
    return true;
  }

  const slot = settings.animationSlots[index];

  if (!slot) {
    return true;
  }

  const name = slot.name.toLowerCase();
  const fileName = slot.fileName.toLowerCase().replace(/\.vrma$/i, "");

  return name === "idle" || fileName === "idle";
}

function canUsePointerGaze() {
  return !action || isIdleAnimationSlotIndex(currentPlaybackSlotIndex);
}

function fitCameraToVrm({ persist = true } = {}) {
  if (!currentVrm) {
    return;
  }

  const box = new THREE.Box3().setFromObject(currentVrmRoot ?? currentVrm.scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));

  settings.camera = {
    y: Number(Math.max(center.y, size.y * 0.55).toFixed(2)),
    zoom: Number(THREE.MathUtils.clamp(distance * 1.45, 0.8, 6).toFixed(2)),
    pitch: 0,
  };
  syncControlsFromSettings();

  if (persist) {
    void saveSettings();
  }
}

function formatExpressionLabel(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getAvailableExpressionNames() {
  const manager = currentVrm?.expressionManager;
  const names = new Set();

  manager?.expressions?.forEach((expression) => {
    if (expression.expressionName) {
      names.add(expression.expressionName);
    }
  });

  Object.keys(manager?.presetExpressionMap ?? {}).forEach((name) => names.add(name));
  Object.keys(manager?.customExpressionMap ?? {}).forEach((name) => names.add(name));

  return preferredExpressionNames.filter((name) => {
    if (name === "neutral") {
      return true;
    }

    return (expressionAliases[name] ?? [name]).some((actualName) => (
      names.has(actualName) ||
      Boolean(manager?.getExpression?.(actualName))
    ));
  });
}

function getActualExpressionName(displayName) {
  const manager = currentVrm?.expressionManager;

  if (displayName === "neutral" || !manager) {
    return displayName;
  }

  return (expressionAliases[displayName] ?? [displayName])
    .find((actualName) => Boolean(manager.getExpression(actualName))) ?? displayName;
}

function renderExpressionButtons(enabled = Boolean(currentVrm)) {
  expressionBar.replaceChildren();

  expressionNames.forEach((expressionName) => {
    const item = document.createElement("div");
    const button = document.createElement("button");
    const blinkLabel = document.createElement("label");
    const blinkToggle = document.createElement("input");

    item.className = "expression-item";
    button.className = "expression-button";
    button.dataset.expression = expressionName;
    button.type = "button";
    button.textContent = formatExpressionLabel(expressionName);
    button.disabled = !enabled;
    button.classList.toggle("is-active", enabled && expressionName === activeExpression);
    button.addEventListener("click", () => applyExpression(expressionName));

    blinkToggle.type = "checkbox";
    blinkToggle.checked = isBlinkEnabledForExpression(expressionName);
    blinkToggle.disabled = !enabled;
    blinkToggle.addEventListener("click", (event) => event.stopPropagation());
    blinkToggle.addEventListener("change", () => {
      settings.expressionBlink[expressionName] = blinkToggle.checked;
      void saveSettings();
    });

    blinkLabel.className = "expression-blink-toggle";
    blinkLabel.title = "Blink on this expression";
    blinkLabel.append(blinkToggle);

    item.append(button, blinkLabel);
    expressionBar.append(item);
  });
}

function setExpressionButtonsEnabled(enabled) {
  [...expressionBar.querySelectorAll(".expression-button")].forEach((button) => {
    button.disabled = !enabled;
    button.classList.toggle("is-active", enabled && button.dataset.expression === activeExpression);
  });

  [...expressionBar.querySelectorAll(".expression-blink-toggle input")].forEach((input) => {
    input.disabled = !enabled;
  });
}

function isBlinkEnabledForExpression(expressionName) {
  return settings.expressionBlink?.[expressionName] !== false;
}

function isBlinkEnabledForActiveExpression() {
  return isBlinkEnabledForExpression(activeExpression);
}

function getNextBlinkInterval() {
  return 3 + Math.random() * 6.5;
}

function getNextGazeInterval() {
  return 0.5 + Math.random() * 2.5;
}

function resetAutoBlink() {
  blinkElapsed = 0;
  blinkInterval = getNextBlinkInterval();
  blinkProgress = null;
  interactionBlinkCooldown = 0;
  blinkExpressionNames.forEach((name) => currentVrm?.expressionManager?.setValue(name, 0));
}

function configureAutoBlink() {
  const manager = currentVrm?.expressionManager;

  if (!manager) {
    blinkExpressionNames = [];
    return;
  }

  if (manager.getExpression("blink")) {
    blinkExpressionNames = ["blink"];
  } else {
    blinkExpressionNames = ["blinkLeft", "blinkRight"].filter((name) => manager.getExpression(name));
  }

  resetAutoBlink();
}

function setBlinkWeight(weight) {
  blinkExpressionNames.forEach((name) => {
    currentVrm?.expressionManager?.setValue(name, weight);
  });
}

function triggerInteractionBlink() {
  if (!blinkExpressionNames.length || interactionBlinkCooldown > 0 || !isBlinkEnabledForActiveExpression()) {
    return;
  }

  blinkElapsed = 0;
  blinkProgress = 0;
  interactionBlinkCooldown = 3;
}

function updateAutoBlink(delta) {
  if (!currentVrm?.expressionManager || !blinkExpressionNames.length) {
    return;
  }

  interactionBlinkCooldown = Math.max(0, interactionBlinkCooldown - delta);

  if (!isBlinkEnabledForActiveExpression()) {
    blinkElapsed = 0;
    blinkProgress = null;
    setBlinkWeight(0);
    return;
  }

  if (blinkProgress === null) {
    blinkElapsed += delta;

    if (blinkElapsed < blinkInterval) {
      return;
    }

    blinkElapsed = 0;
    blinkProgress = 0;
  }

  blinkProgress += delta;

  const duration = 0.18;
  const normalized = Math.min(blinkProgress / duration, 1);
  const weight = Math.sin(normalized * Math.PI);

  setBlinkWeight(weight);

  if (normalized >= 1) {
    setBlinkWeight(0);
    blinkProgress = null;
    blinkInterval = getNextBlinkInterval();
  }
}

function getGazeTargetPoint(screenPoint, scale = 1) {
  const distance = Math.max(1.6, settings.camera.zoom * 0.65);
  const verticalHalfSize = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
  const horizontalHalfSize = verticalHalfSize * camera.aspect;
  const scaledX = screenPoint.x * scale;
  const scaledY = screenPoint.y * scale;

  camera.getWorldDirection(gazeCameraDirection);
  gazeCameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  gazeCameraUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

  return gazeAnchorWorld
    .clone()
    .addScaledVector(gazeCameraDirection, -distance)
    .addScaledVector(gazeCameraRight, scaledX * horizontalHalfSize)
    .addScaledVector(gazeCameraUp, scaledY * verticalHalfSize);
}

function getFaceScreenRadius() {
  const leftEye = getLeftEyeNodeForGazeAnchor();
  const rightEye = getRightEyeNodeForGazeAnchor();

  if (leftEye && rightEye) {
    leftEyeScreen.copy(getObjectWorldPosition(leftEye)).project(camera);
    rightEyeScreen.copy(getObjectWorldPosition(rightEye)).project(camera);

    const eyeDistance = Math.abs(leftEyeScreen.x - rightEyeScreen.x);

    if (Number.isFinite(eyeDistance) && eyeDistance > 0.01) {
      const faceHalfWidth = THREE.MathUtils.clamp(eyeDistance * 1.75, 0.2, 0.48);

      return {
        x: faceHalfWidth,
        y: THREE.MathUtils.clamp(faceHalfWidth * 1.25, 0.22, 0.58),
      };
    }
  }

  const head = getVrmBoneNode("head");
  const box = new THREE.Box3();

  if (head) {
    box.setFromObject(head);
  }

  if (!head || box.isEmpty()) {
    box.setFromObject(currentVrmRoot ?? currentVrm.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const fallbackWidth = Math.max(size.x * 0.34, 0.18);
    const fallbackHeight = Math.max(size.y * 0.24, 0.18);

    box.min.set(center.x - fallbackWidth, center.y - fallbackHeight, center.z - fallbackWidth);
    box.max.set(center.x + fallbackWidth, center.y + fallbackHeight, center.z + fallbackWidth);
  }

  const points = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ].map((point) => point.project(camera));

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: THREE.MathUtils.clamp((maxX - minX) * 0.42, 0.2, 0.5),
    y: THREE.MathUtils.clamp((maxY - minY) * 0.38, 0.22, 0.6),
  };
}

function getClickHeadTurn(screenPoint, faceRadius) {
  const radiusX = faceRadius?.x ?? settings.headAdjust.radiusX;
  const radiusY = faceRadius?.y ?? settings.headAdjust.radiusY;
  const normalizedDistance = Math.hypot(screenPoint.x / radiusX, screenPoint.y / radiusY);

  if (normalizedDistance <= 1) {
    return new THREE.Vector2(0, 0);
  }

  const outside = normalizedDistance - 1;
  const angle = THREE.MathUtils.clamp(outside * THREE.MathUtils.degToRad(settings.headAdjust.delta), 0, maxClickHeadYaw);
  const direction = screenPoint.clone().normalize();

  return new THREE.Vector2(
    direction.x * angle,
    -direction.y * Math.min(angle, maxClickHeadPitch),
  );
}

function setGazeFromScreen(screenPoint, holdSeconds = 0, options = {}) {
  const gazeScale = options.gazeScale ?? 1;
  const headScale = options.headScale ?? 1;
  const headTurnDuration = options.immediate ? 0 : 0.2;
  gazeTargetScreen.copy(screenPoint);
  gazeTargetWorld.copy(getGazeTargetPoint(screenPoint, gazeScale));
  gazeClickHold = Math.max(gazeClickHold, holdSeconds);

  if (options.faceRadius) {
    setHeadTurnTarget(getClickHeadTurn(screenPoint, options.faceRadius), headTurnDuration);
    return;
  }

  setHeadTurnTarget(
    new THREE.Vector2(
      screenPoint.x * headScale * maxClickHeadYaw,
      -screenPoint.y * headScale * maxClickHeadPitch,
    ),
    headTurnDuration,
  );
}

function setGazeFromClientPoint(clientX, clientY, holdSeconds = 0, options = {}) {
  if (!currentVrm) {
    return;
  }

  removeAppliedHeadOffset();
  updateGazeAnchorFromVrm();

  const rect = canvas.getBoundingClientRect();
  const clickX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const clickY = -(((clientY - rect.top) / rect.height) * 2 - 1);

  gazeAnchorScreen.copy(gazeAnchorWorld).project(camera);
  const anchorX = THREE.MathUtils.clamp(gazeAnchorScreen.x, -1, 1);
  const anchorY = THREE.MathUtils.clamp(gazeAnchorScreen.y, -1, 1);
  const x = THREE.MathUtils.clamp(clickX - anchorX, -1, 1);
  const y = THREE.MathUtils.clamp(clickY - anchorY, -1, 1);

  setGazeFromScreen(new THREE.Vector2(x, y), holdSeconds, {
    gazeScale: clickGazeScale,
    faceRadius: settings.headAdjust,
    ...options,
  });
}

function setRandomGazeTarget() {
  const { left, right, up, down } = settings.gazeRange;
  const screenPoint = new THREE.Vector2(
    THREE.MathUtils.randFloat(left, right) * randomGazeUnitScale,
    THREE.MathUtils.randFloat(down, up) * randomGazeUnitScale,
  );

  setGazeFromScreen(screenPoint, 0, { headScale: randomHeadScale });
}

function removeAppliedHeadOffset() {
  if (!hasAppliedHeadOffset) {
    return;
  }

  const headInverse = appliedHeadOffset.clone().invert();
  const neckInverse = appliedNeckOffset.clone().invert();
  const head = getVrmRawBoneNode("head");
  const neck = getVrmRawBoneNode("neck");

  head?.quaternion.multiply(headInverse);
  neck?.quaternion.multiply(neckInverse);
  appliedHeadOffset.identity();
  appliedNeckOffset.identity();
  hasAppliedHeadOffset = false;
}

function applyHeadGazeOffset() {
  const head = getVrmRawBoneNode("head");
  const neck = getVrmRawBoneNode("neck");

  if (!head && !neck) {
    return;
  }

  const headOffset = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(currentHeadTurn.y, currentHeadTurn.x, 0, "YXZ"),
  );
  const neckOffset = new THREE.Quaternion().slerp(headOffset, 0.45);

  head?.quaternion.multiply(headOffset);
  neck?.quaternion.multiply(neckOffset);
  appliedHeadOffset.copy(headOffset);
  appliedNeckOffset.copy(neckOffset);
  hasAppliedHeadOffset = true;
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function setHeadTurnTarget(nextTarget, duration) {
  if (duration <= 0) {
    targetHeadTurn.copy(nextTarget);
    currentHeadTurn.copy(nextTarget);
    headTurnTransitionFrom.copy(nextTarget);
    headTurnTransitionTo.copy(nextTarget);
    headTurnTransitionElapsed = 0;
    headTurnTransitionDuration = 0;
    return;
  }

  if (targetHeadTurn.distanceToSquared(nextTarget) < 0.000001) {
    return;
  }

  targetHeadTurn.copy(nextTarget);
  headTurnTransitionFrom.copy(currentHeadTurn);
  headTurnTransitionTo.copy(nextTarget);
  headTurnTransitionElapsed = 0;
  headTurnTransitionDuration = Math.max(0.01, duration);
}

function returnHeadToCenter() {
  setHeadTurnTarget(new THREE.Vector2(0, 0), 0.5);
}

function updateHeadTurn(delta) {
  if (headTurnTransitionElapsed >= headTurnTransitionDuration) {
    currentHeadTurn.copy(targetHeadTurn);
    return;
  }

  headTurnTransitionElapsed = Math.min(headTurnTransitionElapsed + delta, headTurnTransitionDuration);
  currentHeadTurn.lerpVectors(
    headTurnTransitionFrom,
    headTurnTransitionTo,
    easeInOut(headTurnTransitionElapsed / headTurnTransitionDuration),
  );
}

function updateGaze(delta) {
  if (!currentVrm) {
    return;
  }

  if (animationHasEyeKeyframes) {
    if (!buttonHoverGazeActive && gazeClickHold <= 0) {
      if (headReturnHold > 0) {
        headReturnHold = Math.max(0, headReturnHold - delta);
      } else {
        returnHeadToCenter();
      }

      updateHeadTurn(delta);
      return;
    }
  }

  if (buttonHoverGazeActive || gazeClickHold > 0) {
    if (!buttonHoverGazeActive) {
      gazeClickHold = Math.max(0, gazeClickHold - delta);
      headReturnHold = Math.max(0, headReturnHold - delta);
    }
  } else if (!animationHasEyeKeyframes) {
    gazeRandomElapsed += delta;

    if (headReturnHold > 0) {
      headReturnHold = Math.max(0, headReturnHold - delta);
    } else {
      returnHeadToCenter();
    }

    if (gazeRandomElapsed >= gazeRandomInterval) {
      gazeRandomElapsed = 0;
      gazeRandomInterval = getNextGazeInterval();
      setRandomGazeTarget();
    }
  }

  gazeCurrentWorld.lerp(gazeTargetWorld, 1 - Math.exp(-delta * 60));
  updateHeadTurn(delta);

  if (currentVrm.lookAt) {
    currentVrm.lookAt.lookAt(gazeCurrentWorld);
  }
}

function handleViewerClick(event) {
  handleViewerGazeInput(event);
}

function handleViewerGazeInput(event, options = {}) {
  if (!currentVrm || !canUsePointerGaze()) {
    return;
  }

  setGazeFromClientPoint(event.clientX, event.clientY, 2, options);
  triggerInteractionBlink();
  headReturnHold = 2;
}

function handleViewerButtonPointerOver(event) {
  const button = event.target.closest("button");

  if (
    !button ||
    !viewer.contains(button) ||
    button.disabled ||
    isViewerHoverGazeExcludedButton(button) ||
    !currentVrm
  ) {
    return;
  }

  const rect = button.getBoundingClientRect();
  buttonHoverGazeActive = true;
  setGazeFromClientPoint(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5, 0);
}

function handleViewerButtonPointerOut(event) {
  const button = event.target.closest("button");

  if (!button || !viewer.contains(button) || isViewerHoverGazeExcludedButton(button)) {
    return;
  }

  if (event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) {
    return;
  }

  buttonHoverGazeActive = false;
  gazeClickHold = 0.5;
  headReturnHold = 0.5;
}

function isViewerHoverGazeExcludedButton(button) {
  return (
    button.classList.contains("expression-button") ||
    button.classList.contains("viewer-animation-action-button")
  );
}

function handleViewerPointerDown(event) {
  if (event.target !== canvas || !currentVrm || !canUsePointerGaze()) {
    return;
  }

  viewerPointerDown = true;
  viewerPointerDragged = false;
  canvas.setPointerCapture(event.pointerId);
}

function handleViewerPointerMove(event) {
  if (!viewerPointerDown || !currentVrm) {
    return;
  }

  viewerPointerDragged = true;
  handleViewerGazeInput(event, { immediate: true });
  headReturnHold = 2;
}

function handleViewerPointerUp(event) {
  if (!viewerPointerDown) {
    return;
  }

  if (!viewerPointerDragged) {
    handleViewerClick(event);
  }

  viewerPointerDown = false;
  viewerPointerDragged = false;
  headReturnHold = 2;
  canvas.releasePointerCapture(event.pointerId);
}

function handleHeadAdjustPointerDown(event) {
  activeHeadAdjustHandle = event.currentTarget.dataset.headHandle;
  event.currentTarget.setPointerCapture(event.pointerId);
  event.stopPropagation();
}

function handleHeadAdjustPointerMove(event) {
  if (!activeHeadAdjustHandle) {
    return;
  }

  const anchor = getAnchorPixelPosition();
  const dx = Math.abs(event.clientX - canvas.getBoundingClientRect().left - anchor.x);
  const dy = Math.abs(event.clientY - canvas.getBoundingClientRect().top - anchor.y);

  if (activeHeadAdjustHandle === "left" || activeHeadAdjustHandle === "right") {
    settings.headAdjust.radiusX = THREE.MathUtils.clamp((dx / anchor.width) * 2, 0.08, 1.2);
  } else {
    settings.headAdjust.radiusY = THREE.MathUtils.clamp((dy / anchor.height) * 2, 0.08, 1.2);
  }

  updateHeadAdjustUi();
  event.stopPropagation();
}

function handleHeadAdjustPointerUp(event) {
  activeHeadAdjustHandle = null;
  event.stopPropagation();
}

function resetGaze() {
  removeAppliedHeadOffset();
  gazeTargetScreen.set(0, 0);
  gazeTargetWorld.copy(getGazeTargetPoint(gazeTargetScreen));
  gazeCurrentWorld.copy(gazeTargetWorld);
  gazeRandomElapsed = 0;
  gazeRandomInterval = getNextGazeInterval();
  gazeClickHold = 0;
  headReturnHold = 0;
  buttonHoverGazeActive = false;
  resetHeadTurnTransition();
}

function applyExpression(expressionName) {
  if (!currentVrm?.expressionManager) {
    return;
  }

  const manager = currentVrm.expressionManager;
  const from = new Map();
  const to = new Map();

  expressionNames.forEach((name) => {
    if (name !== "neutral") {
      const actualName = getActualExpressionName(name);
      from.set(actualName, manager.getValue?.(actualName) ?? 0);
      to.set(actualName, expressionName === name ? 1 : 0);
    }
  });

  expressionTransition = {
    from,
    to,
    elapsed: 0,
    duration: 0.2,
  };
  activeExpression = expressionName;
  setExpressionButtonsEnabled(true);
}

function updateExpressionTransition(delta) {
  if (!expressionTransition || !currentVrm?.expressionManager) {
    return;
  }

  const manager = currentVrm.expressionManager;

  expressionTransition.elapsed = Math.min(
    expressionTransition.elapsed + delta,
    expressionTransition.duration,
  );

  const t = easeInOut(expressionTransition.elapsed / expressionTransition.duration);

  expressionTransition.to.forEach((target, actualName) => {
    const start = expressionTransition.from.get(actualName) ?? 0;
    manager.setValue(actualName, THREE.MathUtils.lerp(start, target, t));
  });

  if (expressionTransition.elapsed >= expressionTransition.duration) {
    expressionTransition.to.forEach((target, actualName) => manager.setValue(actualName, target));
    expressionTransition = null;
  }
}

function refreshMToonMaterials() {
  currentVrm?.scene.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];

    materials.filter(Boolean).forEach((material) => {
      if (material.isMToonMaterial) {
        material.needsUpdate = true;
      }
    });
  });
}

function optimizeVrmScene(root) {
  VRMUtils.removeUnnecessaryVertices(root);

  try {
    VRMUtils.combineSkeletons(root);
  } catch (error) {
    console.warn("VRM skeleton optimization skipped.", error);
  }
}

async function loadVrm(file) {
  if (!file) {
    return;
  }

  clearVrm();
  setStatus("Loading VRM...");

  if (lastVrmUrl) {
    URL.revokeObjectURL(lastVrmUrl);
  }

  lastVrmUrl = URL.createObjectURL(file);

  try {
    const gltf = await vrmLoader.loadAsync(lastVrmUrl);
    const vrm = gltf.userData.vrm;

    if (!vrm) {
      throw new Error("VRM avatar was not found in this file.");
    }

    optimizeVrmScene(gltf.scene);
    VRMUtils.rotateVRM0(vrm);

    currentVrm = vrm;
    currentVrmRoot = new THREE.Group();
    currentVrmRoot.name = "VRM Preview Root";
    currentVrmRoot.add(vrm.scene);
    scene.add(currentVrmRoot);
    currentVrm.scene.updateMatrixWorld(true);
    captureRestPose();
    refreshMToonMaterials();
    configureAutoBlink();
    expressionNames = getAvailableExpressionNames();
    activeExpression = "neutral";
    renderExpressionButtons(true);
    renderAnimationSlots();
    applyExpression("neutral");
    modelName.textContent = file.name;
    viewportHint.classList.add("is-hidden");
    fitCamera.disabled = false;
    resetPose.disabled = false;
    applyCameraSettings();
    updateGazeAnchorFromVrm();
    resetGaze();
    setStatus("VRM loaded with MToon");
    await playIdleAnimation();
  } catch (error) {
    clearVrm();
    setStatus(error.message || "Failed to load VRM", true);
  }
}

async function loadVrma(file, label = file?.name, playbackOptions = {}) {
  if (!file) {
    return;
  }

  if (!currentVrm) {
    setStatus("Load a VRM before loading VRMA.", true);
    return;
  }

  setStatus("Loading VRMA...");

  if (lastVrmaUrl) {
    URL.revokeObjectURL(lastVrmaUrl);
  }

  lastVrmaUrl = URL.createObjectURL(file);

  try {
    const gltf = await vrmaLoader.loadAsync(lastVrmaUrl);
    const vrmAnimations = gltf.userData.vrmAnimations;

    if (!vrmAnimations?.length) {
      throw new Error("VRMA animation was not found in this file.");
    }

    playClip(createVRMAnimationClip(vrmAnimations[0], currentVrm), label || file.name, playbackOptions);
    setStatus("VRMA playing");
  } catch (error) {
    setStatus(error.message || "Failed to load VRMA", true);
  }
}

function handleFiles(files) {
  [...files].forEach((file) => {
    const name = file.name.toLowerCase();

    if (name.endsWith(".vrm")) {
      void loadVrm(file);
    } else if (name.endsWith(".vrma")) {
      void loadVrma(file);
    }
  });
}

function wireSlider(id, section, property, suffix = "") {
  const slider = sliders[id];

  slider.input.addEventListener("input", () => {
    settings[section][property] = Number(slider.input.value);
    setSliderValue(slider, settings[section][property], suffix);

    if (section === "light") {
      applyLightSettings();
    } else {
      applyCameraSettings();
    }
  });

  slider.input.addEventListener("change", () => void saveSettings());
}

vrmInput.addEventListener("change", () => loadVrm(vrmInput.files[0]));
vrmaInput.addEventListener("change", () => loadVrma(vrmaInput.files[0]));
saveSettingsFile.addEventListener("click", downloadSettingsFile);
loadSettingsFile.addEventListener("click", openSettingsFilePicker);
settingsFileInput.addEventListener("change", () => {
  void loadSettingsFilePayload(settingsFileInput.files[0]);
});
animationFolderButton.addEventListener("click", () => void chooseAnimationFolder());
animationRefresh.addEventListener("click", () => void refreshAnimationSlots({ requestPermission: true }));
animationFileInput.addEventListener("change", () => {
  void handleAnimationFileSelected(animationFileInput.files[0]);
});
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  handleFiles(event.dataTransfer.files);
});
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => {
  event.preventDefault();
  handleFiles(event.dataTransfer.files);
});

playPause.addEventListener("click", () => setPlayback(!isPlaying));
fitCamera.addEventListener("click", fitCameraToVrm);
resetPose.addEventListener("click", () => {
  removeAppliedHeadOffset();
  clearAnimation();
  resetVrmToRestPose();
  resetGaze();
  applyExpression(activeExpression);
  setStatus("Pose reset");
});
speed.addEventListener("input", () => {
  const value = Number(speed.value);
  speedValue.textContent = `${value.toFixed(1)}x`;

  if (action) {
    action.timeScale = value;
  }
});
loop.addEventListener("change", () => {
  action?.setLoop(loop.checked ? THREE.LoopRepeat : THREE.LoopOnce);
});
panelToggle.addEventListener("click", toggleControlPanel);
headAdjustToggle.addEventListener("click", toggleHeadAdjustUi);
lightToggle.addEventListener("click", toggleSettingsOverlay);
canvas.addEventListener("pointerdown", handleViewerPointerDown);
canvas.addEventListener("pointermove", handleViewerPointerMove);
canvas.addEventListener("pointerup", handleViewerPointerUp);
viewer.addEventListener("pointerover", handleViewerButtonPointerOver);
viewer.addEventListener("pointerout", handleViewerButtonPointerOut);
headAdjustHandles.forEach((handle) => {
  handle.addEventListener("pointerdown", handleHeadAdjustPointerDown);
  handle.addEventListener("pointermove", handleHeadAdjustPointerMove);
  handle.addEventListener("pointerup", handleHeadAdjustPointerUp);
});
headDeltaDown.addEventListener("click", (event) => {
  event.stopPropagation();
  stepHeadDelta(-1);
});
headDeltaUp.addEventListener("click", (event) => {
  event.stopPropagation();
  stepHeadDelta(1);
});
gazeRangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    stepGazeRange(button.dataset.gazeRange, Number(button.dataset.gazeDelta));
  });
});

wireSlider("lightIntensity", "light", "intensity");
wireSlider("lightX", "light", "x");
wireSlider("lightY", "light", "y");
wireSlider("lightZ", "light", "z");
wireSlider("cameraY", "camera", "y");
wireSlider("cameraZoom", "camera", "zoom");
wireSlider("cameraPitch", "camera", "pitch", "deg");

function render() {
  requestAnimationFrame(render);
  const delta = clock.getDelta();

  resizeRenderer();
  applyCameraSettings();
  removeAppliedHeadOffset();

  if (mixer && isPlaying) {
    mixer.update(delta);
  }

  updateExpressionTransition(delta);
  updateAutoBlink(delta);
  updateGaze(delta);
  currentVrm?.update(delta);

  applyHeadGazeOffset();
  updateHeadAdjustUi();

  renderer.render(scene, camera);
}

function mergeSettings(base, override) {
  const storedGazeRange = { ...base.gazeRange, ...override?.gazeRange };
  const shouldMigrateGazeRange = Object.values(storedGazeRange).every((value) => Math.abs(value) <= 1);
  const gazeRangeScale = shouldMigrateGazeRange ? 10 : 1;

  return {
    light: { ...base.light, ...override?.light },
    camera: { ...base.camera, ...override?.camera },
    gazeRange: {
      left: clampGazeRangeValue("left", storedGazeRange.left * gazeRangeScale),
      right: clampGazeRangeValue("right", storedGazeRange.right * gazeRangeScale),
      up: clampGazeRangeValue("up", storedGazeRange.up * gazeRangeScale),
      down: clampGazeRangeValue("down", storedGazeRange.down * gazeRangeScale),
    },
    headAdjust: {
      radiusX: THREE.MathUtils.clamp(override?.headAdjust?.radiusX ?? base.headAdjust.radiusX, 0.08, 1.2),
      radiusY: THREE.MathUtils.clamp(override?.headAdjust?.radiusY ?? base.headAdjust.radiusY, 0.08, 1.2),
      delta: THREE.MathUtils.clamp(override?.headAdjust?.delta ?? base.headAdjust.delta, 1, 120),
    },
    expressionBlink: { ...base.expressionBlink, ...override?.expressionBlink },
    animationFolderName: String(override?.animationFolderName ?? base.animationFolderName),
    animationSlots: normalizeAnimationSlots(override?.animationSlots ?? base.animationSlots),
    controlsOpen: override?.controlsOpen ?? base.controlsOpen,
  };
}

async function init() {
  settings = mergeSettings(defaultSettings, await loadSettings());
  try {
    animationDirectoryHandle = await getStoredHandle(animationFolderHandleKey);
  } catch {
    animationDirectoryHandle = null;
  }
  syncControlsFromSettings();
  renderExpressionButtons(false);
  setExpressionButtonsEnabled(false);
  await refreshAnimationSlots();
  render();
}

void init();
