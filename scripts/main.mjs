const MODULE_ID = "bm-ui-joueur";
const SETTING_ENABLE_BEST_UI_JOUEUR = "bestUiJoueurEnabled";
const SETTING_BEST_UI_JOUEUR_DRAWING_PERMISSION_STATE = "bestUiJoueurDrawingPermissionState";
const SETTING_BEST_UI_JOUEUR_HOTBAR_COLLAPSED = "bestUiJoueurHotbarCollapsed";

const BEST_UI_JOUEUR_HIDDEN_ELEMENTS_ORDER = Object.freeze([
  "gabarits_circulaires",
  "gabarits_coniques",
  "gabarits_rectangulaires",
  "gabarits_lineaires",
  "icone_notes"
]);
const BEST_UI_JOUEUR_SHOWN_ELEMENTS_ORDER = Object.freeze([
  "outil_dessin"
]);
const BEST_UI_JOUEUR_DRAWING_PERMISSION_ID = "DRAWING_CREATE";
const BEST_UI_JOUEUR_PERMISSION_STATE_VERSION = 2;
const BEST_UI_JOUEUR_HOTBAR_TOGGLE_ACTION = "bjdBestUiHotbarToggle";
const BEST_UI_JOUEUR_HOTBAR_TOGGLE_BUTTON_ID = "bjd-best-ui-hotbar-toggle";
const BEST_UI_JOUEUR_HOTBAR_COLLAPSED_CLASS = "bjd-best-ui-hotbar-collapsed";
const BEST_UI_JOUEUR_STYLE_ELEMENT_ID = "bjd-best-ui-joueur-style";
const BEST_UI_JOUEUR_SIDEBAR_TABS_ALWAYS_HIDDEN = Object.freeze(["cards", "tables"]);
const BEST_UI_JOUEUR_SIDEBAR_SEARCH_TAB_ALIASES = Object.freeze([
  "search",
  "search-highlight",
  "searchandhighlight"
]);
const BEST_UI_JOUEUR_CONTROL_ALIASES = Object.freeze({
  templates: Object.freeze(["templates", "template"]),
  notes: Object.freeze(["notes", "note"]),
  drawings: Object.freeze(["drawings", "drawing"]),
  measure: Object.freeze(["measure", "ruler"])
});
const BEST_UI_JOUEUR_TEMPLATE_TOOL_ALIASES = Object.freeze({
  gabarits_circulaires: Object.freeze(["circle", "cercle"]),
  gabarits_coniques: Object.freeze(["cone", "conic"]),
  gabarits_rectangulaires: Object.freeze(["rect", "rectangle"]),
  gabarits_lineaires: Object.freeze(["ray", "line"])
});
const BEST_UI_JOUEUR_DRAWING_REQUIRED_TOOLS = Object.freeze({
  select: Object.freeze(["select"]),
  rect: Object.freeze(["rect", "rectangle"]),
  ellipse: Object.freeze(["ellipse"]),
  polygon: Object.freeze(["polygon", "poly"]),
  freehand: Object.freeze(["freehand", "free-hand", "brush", "pencil"]),
  text: Object.freeze(["text", "texte"]),
  configure: Object.freeze(["configure", "config"]),
  clear: Object.freeze(["clear", "clear-all", "trash"])
});
let BEST_UI_JOUEUR_LAST_STATUS = null;
let BEST_UI_JOUEUR_AUX_REFRESH_PROMISE = null;
let BEST_UI_JOUEUR_AUX_REFRESH_QUEUED = false;
let BEST_UI_JOUEUR_AUX_REFRESH_REPORT_REASON = "";

function t(key, fallback, data = null) {
  const localized = data
    ? game?.i18n?.format?.(key, data)
    : game?.i18n?.localize?.(key);
  if (localized && localized !== key) return localized;
  return fallback;
}

function isBestUiJoueurEnabled() {
  return Boolean(game.settings?.get?.(MODULE_ID, SETTING_ENABLE_BEST_UI_JOUEUR));
}

function normalizeBestUiJoueurErrorMessages(errors = []) {
  const messages = [];
  const seen = new Set();
  for (const value of (Array.isArray(errors) ? errors : [errors])) {
    const message = String(value || "").trim();
    if (!message || seen.has(message)) continue;
    seen.add(message);
    messages.push(message);
  }
  return messages;
}

function orderBestUiJoueurElements(values = [], allowedOrder = []) {
  const valueSet = new Set(
    (Array.isArray(values) ? values : [values])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  );
  return allowedOrder.filter(value => valueSet.has(value));
}

function buildBestUiJoueurStatusPayload({
  enabled = isBestUiJoueurEnabled(),
  hiddenElements,
  shownElements,
  errors = []
} = {}) {
  const featureEnabled = Boolean(enabled);
  return {
    feature_status: featureEnabled ? "activated" : "deactivated",
    hidden_elements: hiddenElements === undefined
      ? (featureEnabled ? [...BEST_UI_JOUEUR_HIDDEN_ELEMENTS_ORDER] : [])
      : orderBestUiJoueurElements(hiddenElements, BEST_UI_JOUEUR_HIDDEN_ELEMENTS_ORDER),
    shown_elements: shownElements === undefined
      ? (featureEnabled ? [...BEST_UI_JOUEUR_SHOWN_ELEMENTS_ORDER] : [])
      : orderBestUiJoueurElements(shownElements, BEST_UI_JOUEUR_SHOWN_ELEMENTS_ORDER),
    errors: normalizeBestUiJoueurErrorMessages(errors)
  };
}

function cacheBestUiJoueurStatus(payload) {
  const normalized = buildBestUiJoueurStatusPayload(payload);
  BEST_UI_JOUEUR_LAST_STATUS = {
    feature_status: normalized.feature_status,
    hidden_elements: [...normalized.hidden_elements],
    shown_elements: [...normalized.shown_elements],
    errors: [...normalized.errors]
  };
  return {
    feature_status: BEST_UI_JOUEUR_LAST_STATUS.feature_status,
    hidden_elements: [...BEST_UI_JOUEUR_LAST_STATUS.hidden_elements],
    shown_elements: [...BEST_UI_JOUEUR_LAST_STATUS.shown_elements],
    errors: [...BEST_UI_JOUEUR_LAST_STATUS.errors]
  };
}

function getCachedBestUiJoueurStatus() {
  if (!BEST_UI_JOUEUR_LAST_STATUS) {
    return cacheBestUiJoueurStatus({ enabled: isBestUiJoueurEnabled() });
  }
  return {
    feature_status: BEST_UI_JOUEUR_LAST_STATUS.feature_status,
    hidden_elements: [...BEST_UI_JOUEUR_LAST_STATUS.hidden_elements],
    shown_elements: [...BEST_UI_JOUEUR_LAST_STATUS.shown_elements],
    errors: [...BEST_UI_JOUEUR_LAST_STATUS.errors]
  };
}

function isBestUiJoueurActiveForLocalPlayer() {
  return isBestUiJoueurEnabled() && !game.user?.isGM;
}

function isBestUiJoueurHotbarCollapsed() {
  return Boolean(game.settings?.get?.(MODULE_ID, SETTING_BEST_UI_JOUEUR_HOTBAR_COLLAPSED));
}

function ensureBestUiJoueurStyleElement() {
  if (!document?.head) return null;
  let styleEl = document.getElementById(BEST_UI_JOUEUR_STYLE_ELEMENT_ID);
  if (!(styleEl instanceof HTMLStyleElement)) {
    styleEl = document.createElement("style");
    styleEl.id = BEST_UI_JOUEUR_STYLE_ELEMENT_ID;
    document.head.append(styleEl);
  }
  const css = `
#hotbar {
  position: relative;
}
#hotbar.${BEST_UI_JOUEUR_HOTBAR_COLLAPSED_CLASS} {
  width: auto;
  min-width: 0;
}
#hotbar.${BEST_UI_JOUEUR_HOTBAR_COLLAPSED_CLASS} #action-bar,
#hotbar.${BEST_UI_JOUEUR_HOTBAR_COLLAPSED_CLASS} #hotbar-controls-right {
  display: none !important;
}
#hotbar.${BEST_UI_JOUEUR_HOTBAR_COLLAPSED_CLASS} #hotbar-controls-left {
  gap: 0;
}
#hotbar.${BEST_UI_JOUEUR_HOTBAR_COLLAPSED_CLASS} #hotbar-controls-left > button:not(#${BEST_UI_JOUEUR_HOTBAR_TOGGLE_BUTTON_ID}) {
  display: none !important;
}
#${BEST_UI_JOUEUR_HOTBAR_TOGGLE_BUTTON_ID} {
  position: relative;
}
#hotbar:not(.${BEST_UI_JOUEUR_HOTBAR_COLLAPSED_CLASS}) #${BEST_UI_JOUEUR_HOTBAR_TOGGLE_BUTTON_ID} {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translate(-50%, -65%);
  z-index: 5;
}
`.trim();
  if (styleEl.textContent !== css) styleEl.textContent = css;
  return styleEl;
}

function getBestUiJoueurHotbarElement() {
  const element = ui?.hotbar?.element;
  return (element instanceof HTMLElement) ? element : null;
}

function getBestUiJoueurSidebarElement() {
  const element = ui?.sidebar?.element;
  return (element instanceof HTMLElement) ? element : null;
}

function setBestUiJoueurManagedInlineVisibility(element, visible) {
  if (!(element instanceof HTMLElement)) return false;
  const marker = "bjdBestUiManagedHidden";
  const prevKey = "bjdBestUiPrevDisplay";
  if (visible) {
    if (element.dataset?.[marker] === "true") {
      const previous = Object.prototype.hasOwnProperty.call(element.dataset, prevKey) ? element.dataset[prevKey] : "";
      if (previous) element.style.display = previous;
      else element.style.removeProperty("display");
      delete element.dataset[marker];
      delete element.dataset[prevKey];
    }
    return true;
  }

  if (element.dataset?.[marker] !== "true") {
    element.dataset[marker] = "true";
    element.dataset[prevKey] = element.style.display || "";
  }
  element.style.display = "none";
  return true;
}

function getBestUiJoueurHotbarToggleButtonState() {
  const collapsed = isBestUiJoueurHotbarCollapsed();
  return collapsed
    ? {
      collapsed,
      iconToAdd: "fa-angles-up",
      iconToRemove: "fa-angles-down",
      label: "Afficher la barre de macros"
    }
    : {
      collapsed,
      iconToAdd: "fa-angles-down",
      iconToRemove: "fa-angles-up",
      label: "Reduire la barre de macros"
    };
}

async function onBestUiJoueurHotbarToggleClick(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  try {
    await game.settings.set(MODULE_ID, SETTING_BEST_UI_JOUEUR_HOTBAR_COLLAPSED, !isBestUiJoueurHotbarCollapsed());
  } catch (error) {
    console.error(`[${MODULE_ID}] best-ui-joueur hotbar toggle failed`, error);
    ui.notifications?.error?.("Best UI Joueur: impossible de modifier la barre de macros.");
  }
}

function ensureBestUiJoueurHotbarToggleButton(hotbarElement, errors = []) {
  if (!(hotbarElement instanceof HTMLElement)) {
    errors.push("E_UI_ELEMENT_NOT_FOUND: hotbar introuvable.");
    return null;
  }

  const controlsLeft = hotbarElement.querySelector("#hotbar-controls-left");
  if (!(controlsLeft instanceof HTMLElement)) {
    errors.push("E_UI_ELEMENT_NOT_FOUND: conteneur de controles gauche de la hotbar introuvable.");
    return null;
  }

  let button = hotbarElement.querySelector(`#${BEST_UI_JOUEUR_HOTBAR_TOGGLE_BUTTON_ID}`);
  if (!(button instanceof HTMLButtonElement)) {
    button = document.createElement("button");
    button.type = "button";
    button.id = BEST_UI_JOUEUR_HOTBAR_TOGGLE_BUTTON_ID;
    button.className = "ui-control fa-solid fa-angles-down icon";
    button.dataset.action = BEST_UI_JOUEUR_HOTBAR_TOGGLE_ACTION;
    button.dataset.tooltip = "";
    button.addEventListener("click", onBestUiJoueurHotbarToggleClick);
    controlsLeft.append(button);
  } else if (!button.dataset.bjdBestUiBound) {
    button.addEventListener("click", onBestUiJoueurHotbarToggleClick);
  }
  button.dataset.bjdBestUiBound = "true";

  const state = getBestUiJoueurHotbarToggleButtonState();
  button.classList.remove(state.iconToRemove);
  button.classList.add(state.iconToAdd);
  button.setAttribute("aria-label", state.label);
  button.dataset.tooltipText = state.label;
  return button;
}

function removeBestUiJoueurHotbarToggleButton(hotbarElement) {
  if (!(hotbarElement instanceof HTMLElement)) return;
  const button = hotbarElement.querySelector(`#${BEST_UI_JOUEUR_HOTBAR_TOGGLE_BUTTON_ID}`);
  if (button instanceof HTMLElement) button.remove();
}

function applyBestUiJoueurHotbarChrome() {
  const errors = [];
  ensureBestUiJoueurStyleElement();

  const hotbarElement = getBestUiJoueurHotbarElement();
  if (!(hotbarElement instanceof HTMLElement)) {
    if (isBestUiJoueurActiveForLocalPlayer()) {
      errors.push("E_UI_ELEMENT_NOT_FOUND: hotbar introuvable.");
    }
    return { errors };
  }

  if (!isBestUiJoueurActiveForLocalPlayer()) {
    hotbarElement.classList.remove(BEST_UI_JOUEUR_HOTBAR_COLLAPSED_CLASS);
    removeBestUiJoueurHotbarToggleButton(hotbarElement);
    return { errors };
  }

  ensureBestUiJoueurHotbarToggleButton(hotbarElement, errors);
  hotbarElement.classList.toggle(BEST_UI_JOUEUR_HOTBAR_COLLAPSED_CLASS, isBestUiJoueurHotbarCollapsed());
  return { errors };
}

function isBestUiJoueurSearchAndHighlightButton(button) {
  if (!(button instanceof HTMLElement)) return false;
  const tabId = normalizeBestUiJoueurName(button.dataset?.tab);
  if (BEST_UI_JOUEUR_SIDEBAR_SEARCH_TAB_ALIASES.includes(tabId)) return true;
  const ariaLabel = normalizeBestUiJoueurName(button.getAttribute("aria-label"));
  const tooltipText = normalizeBestUiJoueurName(button.dataset?.tooltipText);
  const text = normalizeBestUiJoueurName(button.textContent);
  return [ariaLabel, tooltipText, text].some(value => value.includes("search and highlight"));
}

function getBestUiJoueurSidebarTabButtons(sidebarElement) {
  if (!(sidebarElement instanceof HTMLElement)) return [];
  return Array.from(sidebarElement.querySelectorAll("nav.tabs [data-tab]"))
    .filter(button => button instanceof HTMLElement);
}

function applyBestUiJoueurSidebarChrome() {
  const errors = [];
  const sidebarElement = getBestUiJoueurSidebarElement();

  if (!(sidebarElement instanceof HTMLElement)) {
    if (isBestUiJoueurActiveForLocalPlayer()) {
      errors.push("E_UI_ELEMENT_NOT_FOUND: menu de droite (sidebar) introuvable.");
    }
    return { errors };
  }

  const buttons = getBestUiJoueurSidebarTabButtons(sidebarElement);
  if (buttons.length === 0) {
    if (isBestUiJoueurActiveForLocalPlayer()) {
      errors.push("E_UI_ELEMENT_NOT_FOUND: onglets du menu de droite introuvables.");
    }
    return { errors };
  }

  const localMode = isBestUiJoueurActiveForLocalPlayer();
  const hotbarCollapsed = isBestUiJoueurHotbarCollapsed();
  let macrosButtonHidden = false;

  for (const button of buttons) {
    const tabId = normalizeBestUiJoueurName(button.dataset?.tab);
    const listItem = button.closest("li");
    if (!(listItem instanceof HTMLElement)) continue;

    let shouldHide = false;
    if (localMode) {
      if (BEST_UI_JOUEUR_SIDEBAR_TABS_ALWAYS_HIDDEN.includes(tabId)) shouldHide = true;
      if (tabId === "macros" && hotbarCollapsed) {
        shouldHide = true;
        macrosButtonHidden = true;
      }
      if (isBestUiJoueurSearchAndHighlightButton(button)) shouldHide = true;
    }

    setBestUiJoueurManagedInlineVisibility(listItem, !shouldHide);
  }

  if (localMode && macrosButtonHidden && (ui?.sidebar?.tabGroups?.primary === "macros")) {
    try {
      if (typeof ui.sidebar.changeTab === "function") {
        ui.sidebar.changeTab("chat", "primary");
      }
    } catch (error) {
      console.warn(`[${MODULE_ID}] best-ui-joueur failed to switch sidebar tab from macros`, error);
      errors.push("E_UI_SIDEBAR_TAB_SWITCH_FAILED: impossible de quitter l'onglet macros masque.");
    }
  }

  return { errors };
}

function applyBestUiJoueurAuxiliaryUiChrome() {
  const hotbarResult = applyBestUiJoueurHotbarChrome();
  const sidebarResult = applyBestUiJoueurSidebarChrome();
  return {
    errors: normalizeBestUiJoueurErrorMessages([...(hotbarResult.errors || []), ...(sidebarResult.errors || [])])
  };
}

async function refreshBestUiJoueurAuxiliaryUiChrome() {
  return applyBestUiJoueurAuxiliaryUiChrome();
}

function queueBestUiJoueurAuxiliaryUiChromeRefresh({ reportReason = "" } = {}) {
  if (reportReason) BEST_UI_JOUEUR_AUX_REFRESH_REPORT_REASON = String(reportReason);
  if (BEST_UI_JOUEUR_AUX_REFRESH_PROMISE) {
    BEST_UI_JOUEUR_AUX_REFRESH_QUEUED = true;
    return BEST_UI_JOUEUR_AUX_REFRESH_PROMISE;
  }

  BEST_UI_JOUEUR_AUX_REFRESH_PROMISE = (async () => {
    do {
      BEST_UI_JOUEUR_AUX_REFRESH_QUEUED = false;
      await refreshBestUiJoueurAuxiliaryUiChrome();
      if (BEST_UI_JOUEUR_AUX_REFRESH_REPORT_REASON) {
        const reason = BEST_UI_JOUEUR_AUX_REFRESH_REPORT_REASON;
        BEST_UI_JOUEUR_AUX_REFRESH_REPORT_REASON = "";
        reportBestUiJoueurStatusChange(reason);
      }
      if (BEST_UI_JOUEUR_AUX_REFRESH_QUEUED) {
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
      }
    } while (BEST_UI_JOUEUR_AUX_REFRESH_QUEUED);
  })().finally(() => {
    BEST_UI_JOUEUR_AUX_REFRESH_PROMISE = null;
  });

  return BEST_UI_JOUEUR_AUX_REFRESH_PROMISE;
}

function getBestUiJoueurUserRoleValue(roleName, fallback) {
  const value = Number(CONST?.USER_ROLES?.[roleName]);
  return Number.isInteger(value) ? value : fallback;
}

function buildBestUiJoueurRoleRange(minRole, maxRole) {
  const start = Number(minRole);
  const end = Number(maxRole);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return [];
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  const roles = [];
  for (let role = low; role <= high; role += 1) roles.push(role);
  return roles;
}

function normalizeBestUiJoueurRoleList(values) {
  const gmRole = getBestUiJoueurUserRoleValue("GAMEMASTER", 4);
  const normalized = [...new Set(
    (Array.isArray(values) ? values : [])
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value >= 0 && value <= gmRole)
  )];
  normalized.sort((a, b) => a - b);
  return normalized;
}

function areBestUiJoueurRoleListsEqual(left = [], right = []) {
  const a = normalizeBestUiJoueurRoleList(left);
  const b = normalizeBestUiJoueurRoleList(right);
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function getBestUiJoueurDefaultPermissionRoles(permissionId) {
  const permission = CONST?.USER_PERMISSIONS?.[permissionId];
  const gmRole = getBestUiJoueurUserRoleValue("GAMEMASTER", 4);
  const defaultRole = Number(permission?.defaultRole);
  if (!Number.isInteger(defaultRole)) return [gmRole];
  return buildBestUiJoueurRoleRange(defaultRole, gmRole);
}

function getBestUiJoueurEffectivePermissionRoles(permissionId, permissionsConfig = null) {
  const source = (permissionsConfig && typeof permissionsConfig === "object") ? permissionsConfig : (game.permissions || {});
  const explicit = source?.[permissionId];
  if (Array.isArray(explicit)) return normalizeBestUiJoueurRoleList(explicit);
  return normalizeBestUiJoueurRoleList(getBestUiJoueurDefaultPermissionRoles(permissionId));
}

function getBestUiJoueurDrawingPermissionState() {
  const raw = game.settings?.get?.(MODULE_ID, SETTING_BEST_UI_JOUEUR_DRAWING_PERMISSION_STATE);
  if (!raw || typeof raw !== "object") return {};
  return {
    version: Number(raw.version) || 0,
    playerRoleAdded: raw.playerRoleAdded === true,
    trustedRoleAdded: raw.trustedRoleAdded === true,
    keyExisted: raw.keyExisted === true
  };
}

async function setBestUiJoueurDrawingPermissionState(state = {}) {
  const payload = {
    version: Number(state.version) || BEST_UI_JOUEUR_PERMISSION_STATE_VERSION,
    playerRoleAdded: state.playerRoleAdded === true,
    trustedRoleAdded: state.trustedRoleAdded === true,
    keyExisted: state.keyExisted === true
  };
  await game.settings.set(MODULE_ID, SETTING_BEST_UI_JOUEUR_DRAWING_PERMISSION_STATE, payload);
}

async function syncBestUiJoueurDrawingCreatePermission(enabled) {
  const errors = [];
  const desired = Boolean(enabled);

  if (!game.ready || !game.user?.isGM) {
    return { changed: false, errors };
  }

  const playerRole = getBestUiJoueurUserRoleValue("PLAYER", 1);
  const trustedRole = getBestUiJoueurUserRoleValue("TRUSTED", 2);
  const permissionId = BEST_UI_JOUEUR_DRAWING_PERMISSION_ID;
  const currentPermissions = foundry.utils.deepClone(game.settings?.get?.("core", "permissions") || {});
  const hasExplicitKey = Object.prototype.hasOwnProperty.call(currentPermissions, permissionId);
  const currentRoles = getBestUiJoueurEffectivePermissionRoles(permissionId, currentPermissions);
  const permissionState = getBestUiJoueurDrawingPermissionState();

  if (desired) {
    let nextRoles = [...currentRoles];
    let permissionsChanged = false;
    let trustedRoleAdded = permissionState.trustedRoleAdded === true;
    let stateChanged = permissionState.playerRoleAdded === true;
    let keyExisted = permissionState.keyExisted === true;

    // Migration cleanup: previous module versions granted DRAWING_CREATE to regular PLAYER.
    if (permissionState.playerRoleAdded && nextRoles.includes(playerRole)) {
      nextRoles = nextRoles.filter(role => role !== playerRole);
      permissionsChanged = true;
    }

    if (!nextRoles.includes(trustedRole)) {
      nextRoles = normalizeBestUiJoueurRoleList([...nextRoles, trustedRole]);
      permissionsChanged = true;
      trustedRoleAdded = true;
      stateChanged = true;
      keyExisted = hasExplicitKey;
    } else {
      nextRoles = normalizeBestUiJoueurRoleList(nextRoles);
      if (!trustedRoleAdded) keyExisted = false;
    }

    if (permissionsChanged) {
      const defaultRoles = normalizeBestUiJoueurRoleList(getBestUiJoueurDefaultPermissionRoles(permissionId));
      if (!keyExisted && areBestUiJoueurRoleListsEqual(nextRoles, defaultRoles)) {
        if (hasExplicitKey) {
          delete currentPermissions[permissionId];
        }
      } else {
        currentPermissions[permissionId] = nextRoles;
      }

      try {
        await game.settings.set("core", "permissions", currentPermissions);
      } catch (error) {
        console.error(`[${MODULE_ID}] best-ui-joueur failed to grant DRAWING_CREATE`, error);
        errors.push("E_CORE_PERMISSION_UPDATE_FAILED: impossible d'activer la permission DRAWING_CREATE pour les joueurs de confiance.");
        return { changed: false, errors };
      }
    }

    try {
      if (permissionsChanged || stateChanged || permissionState.version < BEST_UI_JOUEUR_PERMISSION_STATE_VERSION) {
        await setBestUiJoueurDrawingPermissionState({
          playerRoleAdded: false,
          trustedRoleAdded,
          keyExisted
        });
      }
    } catch (error) {
      console.warn(`[${MODULE_ID}] best-ui-joueur permission state save failed`, error);
      errors.push("E_PERMISSION_STATE_SAVE_FAILED: etat de permission dessin impossible a enregistrer.");
    }
    return { changed: permissionsChanged, errors };
  }

  if (!permissionState.playerRoleAdded && !permissionState.trustedRoleAdded) return { changed: false, errors };

  const nextRoles = normalizeBestUiJoueurRoleList(
    currentRoles.filter(role => {
      if (permissionState.playerRoleAdded && role === playerRole) return false;
      if (permissionState.trustedRoleAdded && role === trustedRole) return false;
      return true;
    })
  );
  const defaultRoles = normalizeBestUiJoueurRoleList(getBestUiJoueurDefaultPermissionRoles(permissionId));
  const nextPermissions = foundry.utils.deepClone(currentPermissions);
  let permissionsChanged = false;

  if (!permissionState.keyExisted && areBestUiJoueurRoleListsEqual(nextRoles, defaultRoles)) {
    if (hasExplicitKey) {
      delete nextPermissions[permissionId];
      permissionsChanged = true;
    }
  } else {
    const currentExplicitRoles = hasExplicitKey ? normalizeBestUiJoueurRoleList(currentPermissions[permissionId]) : [];
    if (!hasExplicitKey || !areBestUiJoueurRoleListsEqual(currentExplicitRoles, nextRoles)) {
      nextPermissions[permissionId] = nextRoles;
      permissionsChanged = true;
    }
  }

  if (permissionsChanged) {
    try {
      await game.settings.set("core", "permissions", nextPermissions);
    } catch (error) {
      console.error(`[${MODULE_ID}] best-ui-joueur failed to restore DRAWING_CREATE`, error);
      errors.push("E_CORE_PERMISSION_RESTORE_FAILED: impossible de restaurer la permission DRAWING_CREATE.");
      return { changed: false, errors };
    }
  }

  try {
    await setBestUiJoueurDrawingPermissionState({
      playerRoleAdded: false,
      trustedRoleAdded: false,
      keyExisted: false
    });
  } catch (error) {
    console.warn(`[${MODULE_ID}] best-ui-joueur permission state clear failed`, error);
    errors.push("E_PERMISSION_STATE_CLEAR_FAILED: etat de permission dessin impossible a reinitialiser.");
  }
  return { changed: permissionsChanged, errors };
}

function normalizeBestUiJoueurName(value) {
  return String(value || "").trim().toLowerCase();
}

function getBestUiJoueurControlsArray(controls) {
  if (Array.isArray(controls)) return controls;
  if (controls && typeof controls === "object") return Object.values(controls);
  return [];
}

function getBestUiJoueurToolsArray(control) {
  const tools = control?.tools;
  if (Array.isArray(tools)) return tools;
  if (tools && typeof tools.values === "function") return Array.from(tools.values());
  if (tools && typeof tools === "object") return Object.values(tools);
  return [];
}

function findBestUiJoueurControl(controls, aliases = []) {
  const list = getBestUiJoueurControlsArray(controls);
  if (list.length === 0) return null;
  const aliasSet = new Set(aliases.map(normalizeBestUiJoueurName).filter(Boolean));
  if (aliasSet.size === 0) return null;
  return list.find(control => aliasSet.has(normalizeBestUiJoueurName(control?.name || control?.layer)));
}

function findBestUiJoueurTool(control, aliases = []) {
  const tools = getBestUiJoueurToolsArray(control);
  if (tools.length === 0) return null;
  const aliasSet = new Set(aliases.map(normalizeBestUiJoueurName).filter(Boolean));
  if (aliasSet.size === 0) return null;
  return tools.find(tool => aliasSet.has(normalizeBestUiJoueurName(tool?.name || tool?.id)));
}

function setBestUiJoueurVisibility(target, visible) {
  if (!target || typeof target !== "object") return false;
  target.visible = Boolean(visible);
  return true;
}

function canLocalPlayerUseBestUiJoueurDrawings() {
  if (!game.user) {
    return {
      ok: false,
      error: "E_USER_NOT_FOUND: utilisateur local introuvable pour valider l'outil de dessin."
    };
  }
  if (game.user.isGM) return { ok: true };
  if (typeof game.user.can !== "function") return { ok: true };

  try {
    const canCreate = Boolean(game.user.can("DRAWING_CREATE"));
    if (canCreate) return { ok: true };
    return {
      ok: false,
      error: "E_PERMISSION_DRAWING_CREATE: Outil de dessin non accessible pour le joueur (permission DRAWING_CREATE manquante)."
    };
  } catch (error) {
    console.warn(`[${MODULE_ID}] best-ui-joueur permission check failed`, error);
    return { ok: true };
  }
}

function applyBestUiJoueurToPlayerSceneControls(controls) {
  const errors = [];
  const hiddenElements = [];
  const shownElements = [];
  const list = getBestUiJoueurControlsArray(controls);

  if (list.length === 0) {
    errors.push("E_SCENE_CONTROLS_UNAVAILABLE: controles de scene indisponibles.");
    return cacheBestUiJoueurStatus({
      enabled: true,
      hiddenElements,
      shownElements,
      errors
    });
  }

  const templatesControl = findBestUiJoueurControl(list, BEST_UI_JOUEUR_CONTROL_ALIASES.templates);
  if (templatesControl) {
    setBestUiJoueurVisibility(templatesControl, false);
    hiddenElements.push(
      "gabarits_circulaires",
      "gabarits_coniques",
      "gabarits_rectangulaires",
      "gabarits_lineaires"
    );
  } else {
    const measureControl = findBestUiJoueurControl(list, BEST_UI_JOUEUR_CONTROL_ALIASES.measure);
    if (measureControl) {
      for (const [elementId, aliases] of Object.entries(BEST_UI_JOUEUR_TEMPLATE_TOOL_ALIASES)) {
        const tool = findBestUiJoueurTool(measureControl, aliases);
        if (!tool) {
          errors.push(`E_TOOL_NOT_FOUND: ${elementId} introuvable dans l'outil de mesure/gabarit.`);
          continue;
        }
        setBestUiJoueurVisibility(tool, false);
        hiddenElements.push(elementId);
      }
    } else {
      errors.push("E_CONTROL_NOT_FOUND: controle de gabarits introuvable.");
    }
  }

  const notesControl = findBestUiJoueurControl(list, BEST_UI_JOUEUR_CONTROL_ALIASES.notes);
  if (!notesControl) {
    errors.push("E_CONTROL_NOT_FOUND: icone_notes (controle des notes) introuvable.");
  } else {
    setBestUiJoueurVisibility(notesControl, false);
    hiddenElements.push("icone_notes");
  }

  const drawingsControl = findBestUiJoueurControl(list, BEST_UI_JOUEUR_CONTROL_ALIASES.drawings);
  if (!drawingsControl) {
    errors.push("E_CONTROL_NOT_FOUND: outil_dessin (controle dessins) introuvable.");
  } else {
    const permission = canLocalPlayerUseBestUiJoueurDrawings();
    if (!permission.ok) {
      errors.push(permission.error);
    } else {
      setBestUiJoueurVisibility(drawingsControl, true);
      shownElements.push("outil_dessin");
      for (const [toolName, aliases] of Object.entries(BEST_UI_JOUEUR_DRAWING_REQUIRED_TOOLS)) {
        const tool = findBestUiJoueurTool(drawingsControl, aliases);
        if (!tool) {
          errors.push(`E_TOOL_NOT_FOUND: drawings.${toolName} introuvable.`);
          continue;
        }
        if ((toolName === "clear") && (tool.visible === false) && !game.user?.isGM) {
          errors.push("E_PERMISSION_DRAWING_CLEAR: suppression de tous les dessins non autorisee pour ce joueur.");
          continue;
        }
        setBestUiJoueurVisibility(tool, true);
      }
    }
  }

  return cacheBestUiJoueurStatus({
    enabled: true,
    hiddenElements,
    shownElements,
    errors
  });
}

function applyBestUiJoueurSceneControlOverrides(controls) {
  if (!isBestUiJoueurEnabled()) {
    return cacheBestUiJoueurStatus({
      enabled: false,
      hiddenElements: [],
      shownElements: [],
      errors: []
    });
  }

  if (game.user?.isGM) {
    return cacheBestUiJoueurStatus({
      enabled: true
    });
  }

  return applyBestUiJoueurToPlayerSceneControls(controls);
}

async function refreshBestUiJoueurSceneControlsUi() {
  const controlsApp = ui?.controls;
  if (!controlsApp) return;
  try {
    if (typeof controlsApp.render !== "function") return;
    await controlsApp.render({ reset: true });
  } catch (error) {
    console.warn(`[${MODULE_ID}] best-ui-joueur refresh failed`, error);
  }
}

function validateBestUiJoueurLocalState() {
  if (!isBestUiJoueurEnabled()) {
    return cacheBestUiJoueurStatus({
      enabled: false,
      hiddenElements: [],
      shownElements: [],
      errors: []
    });
  }

  if (game.user?.isGM) {
    return cacheBestUiJoueurStatus({ enabled: true });
  }

  const controls = ui?.controls?.controls;
  const controlList = getBestUiJoueurControlsArray(controls);
  if (controlList.length === 0) {
    return cacheBestUiJoueurStatus({
      enabled: true,
      hiddenElements: [],
      shownElements: [],
      errors: ["E_UI_NOT_READY: controles de scene non charges pour validation locale."]
    });
  }

  return applyBestUiJoueurToPlayerSceneControls(controls);
}

function reportBestUiJoueurStatusChange(reason = "state") {
  const status = validateBestUiJoueurLocalState();
  const auxiliaryUi = applyBestUiJoueurAuxiliaryUiChrome();
  const mergedErrors = normalizeBestUiJoueurErrorMessages([...(status.errors || []), ...(auxiliaryUi.errors || [])]);
  const normalized = mergedErrors.length > 0
    ? cacheBestUiJoueurStatus({
      enabled: status.feature_status === "activated",
      hiddenElements: status.hidden_elements,
      shownElements: status.shown_elements,
      errors: mergedErrors
    })
    : status;
  const level = normalized.errors.length > 0 ? "warn" : "info";
  console[level](`[${MODULE_ID}] best-ui-joueur ${reason}`, normalized);
  return normalized;
}

async function setBestUiJoueurFeatureEnabled(enabled) {
  const desired = Boolean(enabled);
  const errors = [];

  if (!game.user?.isGM) {
    errors.push("E_PERMISSION_WORLD_SETTING: seul le MJ peut changer l'etat de Best UI Joueur.");
    const current = getCachedBestUiJoueurStatus();
    return cacheBestUiJoueurStatus({
      enabled: current.feature_status === "activated",
      hiddenElements: current.hidden_elements,
      shownElements: current.shown_elements,
      errors: [...current.errors, ...errors]
    });
  }

  try {
    await game.settings.set(MODULE_ID, SETTING_ENABLE_BEST_UI_JOUEUR, desired);
  } catch (error) {
    console.error(`[${MODULE_ID}] best-ui-joueur setting update failed`, error);
    errors.push("E_SETTING_UPDATE_FAILED: mise a jour du parametre Best UI Joueur impossible.");
  }

  const permissionSync = await syncBestUiJoueurDrawingCreatePermission(desired);
  errors.push(...normalizeBestUiJoueurErrorMessages(permissionSync.errors));

  await refreshBestUiJoueurSceneControlsUi();
  const auxiliaryUi = await refreshBestUiJoueurAuxiliaryUiChrome();
  errors.push(...normalizeBestUiJoueurErrorMessages(auxiliaryUi?.errors || []));
  const status = reportBestUiJoueurStatusChange(desired ? "activated" : "deactivated");
  if (errors.length === 0) return status;

  return cacheBestUiJoueurStatus({
    enabled: status.feature_status === "activated",
    hiddenElements: status.hidden_elements,
    shownElements: status.shown_elements,
    errors: [...status.errors, ...errors]
  });
}

async function activateBestUiJoueur() {
  return setBestUiJoueurFeatureEnabled(true);
}

async function deactivateBestUiJoueur() {
  return setBestUiJoueurFeatureEnabled(false);
}

function getBestUiJoueurStatus() {
  return reportBestUiJoueurStatusChange("status");
}


function registerModuleSettings() {
  game.settings.register(MODULE_ID, SETTING_BEST_UI_JOUEUR_DRAWING_PERMISSION_STATE, {
    name: "Best UI Joueur - Drawing Permission State",
    scope: "world",
    config: false,
    type: Object,
    default: {
      version: BEST_UI_JOUEUR_PERMISSION_STATE_VERSION,
      playerRoleAdded: false,
      trustedRoleAdded: false,
      keyExisted: false
    }
  });

  game.settings.register(MODULE_ID, SETTING_BEST_UI_JOUEUR_HOTBAR_COLLAPSED, {
    name: "Best UI Joueur - Hotbar Collapsed",
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    onChange: () => {
      void queueBestUiJoueurAuxiliaryUiChromeRefresh({ reportReason: "hotbar-toggle" });
    }
  });

  game.settings.register(MODULE_ID, SETTING_ENABLE_BEST_UI_JOUEUR, {
    name: t("BJD.Settings.BestUiJoueur.Name", "Best UI Joueur"),
    hint: t(
      "BJD.Settings.BestUiJoueur.Hint",
      "Cache les gabarits et les notes pour les joueurs, et affiche l'outil de dessin si les permissions Foundry le permettent."
    ),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: value => {
      const enabled = Boolean(value);
      void (async () => {
        try {
          const permissionSync = await syncBestUiJoueurDrawingCreatePermission(enabled);
          const syncErrors = normalizeBestUiJoueurErrorMessages(permissionSync.errors);
          await refreshBestUiJoueurSceneControlsUi();
          const auxiliaryUi = await refreshBestUiJoueurAuxiliaryUiChrome();
          const uiChromeErrors = normalizeBestUiJoueurErrorMessages(auxiliaryUi?.errors || []);
          const status = reportBestUiJoueurStatusChange(enabled ? "activated" : "deactivated");
          const mergedErrors = normalizeBestUiJoueurErrorMessages([...status.errors, ...(syncErrors || []), ...uiChromeErrors]);
          if (mergedErrors.length > 0) {
            cacheBestUiJoueurStatus({
              enabled,
              hiddenElements: status.hidden_elements,
              shownElements: status.shown_elements,
              errors: mergedErrors
            });
            ui.notifications?.warn?.(`Best UI Joueur: ${mergedErrors[0]}`);
          }
        } catch (error) {
          console.error(`[${MODULE_ID}] best-ui-joueur onChange failed`, error);
          ui.notifications?.error?.("Best UI Joueur: synchronisation des permissions impossible.");
        }
      })();
    }
  });
}

Hooks.once("init", () => {
  registerModuleSettings();

  const api = {
    activateBestUiJoueur,
    deactivateBestUiJoueur,
    getBestUiJoueurStatus
  };

  const module = game.modules?.get?.(MODULE_ID);
  if (module) module.api = api;
});

Hooks.once("ready", async () => {
  const bestUiPermissionSync = await syncBestUiJoueurDrawingCreatePermission(isBestUiJoueurEnabled());
  if (bestUiPermissionSync.errors.length > 0) {
    console.warn(`[${MODULE_ID}] best-ui-joueur ready permission sync warnings`, bestUiPermissionSync.errors);
  }
  await refreshBestUiJoueurAuxiliaryUiChrome();
});

Hooks.on("getSceneControlButtons", controls => {
  applyBestUiJoueurSceneControlOverrides(controls);
});

Hooks.on("renderHotbar", () => {
  void queueBestUiJoueurAuxiliaryUiChromeRefresh();
});

Hooks.on("renderSidebar", () => {
  void queueBestUiJoueurAuxiliaryUiChromeRefresh();
});

Hooks.on("changeSidebarTab", () => {
  void queueBestUiJoueurAuxiliaryUiChromeRefresh();
});

export {
  activateBestUiJoueur,
  deactivateBestUiJoueur,
  getBestUiJoueurStatus
};
