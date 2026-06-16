(function () {
  "use strict";

  const STORAGE_SUFFIX = ":common-draft-state";
  const LEGACY_STATE_SUFFIX = ":state";
  const DB_NAME = "pp_owner_common_form_drafts_db";
  const DB_VERSION = 1;
  const FILE_STORE = "draft_files";
  const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function safeJsonParse(value) {
    try {
      return JSON.parse(value || "null");
    } catch (error) {
      return null;
    }
  }

  function getStorageKey(draftKey) {
    return `${draftKey}${STORAGE_SUFFIX}`;
  }

  function getFileRecordKey(draftKey, fileKey) {
    return `${draftKey}::${fileKey}`;
  }

  function getFieldKey(form, field) {
    if (field.id) return field.id;

    const name = field.name || "";
    if (!name) return "";

    const matchingFields = Array.from(
      form.querySelectorAll(`[name="${CSS.escape(name)}"]`)
    );
    const index = matchingFields.indexOf(field);

    return index > 0 ? `${name}_${index}` : name;
  }

  function collectState(form) {
    const fields = {};
    const checkboxes = {};

    form.querySelectorAll("input, select, textarea").forEach((field) => {
      if ((!field.name && !field.id) || field.name === "csrfmiddlewaretoken") return;
      if (field.type === "file" || field.type === "radio") return;

      const key = getFieldKey(form, field);
      if (!key) return;

      if (field.type === "checkbox") {
        checkboxes[key] = {
          id: field.id || "",
          name: field.name || "",
          value: field.value || "",
          checked: Boolean(field.checked)
        };
        return;
      }

      fields[key] = {
        id: field.id || "",
        name: field.name || "",
        value: field.value || ""
      };
    });

    return { fields, checkboxes };
  }

  function stateHasMeaningfulChanges(state, baseline) {
    if (!state) return false;
    if (Object.keys(state.files || {}).length > 0) return true;

    const baselineFields = baseline?.fields || {};
    const baselineCheckboxes = baseline?.checkboxes || {};

    const fieldChanged = Object.entries(state.fields || {}).some(([key, item]) => {
      const baselineValue = baselineFields[key]?.value || "";
      return String(item?.value || "") !== String(baselineValue);
    });

    if (fieldChanged) return true;

    return Object.entries(state.checkboxes || {}).some(([key, item]) => {
      const baselineChecked = Boolean(baselineCheckboxes[key]?.checked);
      return Boolean(item?.checked) !== baselineChecked;
    });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function () {
        const db = request.result;

        if (!db.objectStoreNames.contains(FILE_STORE)) {
          db.createObjectStore(FILE_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error || new Error("Could not open draft file storage."));
      };
    });
  }

  async function saveFileRecord(record) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, "readwrite");
      transaction.objectStore(FILE_STORE).put(record);

      transaction.oncomplete = function () {
        db.close();
        resolve();
      };

      transaction.onerror = function () {
        db.close();
        reject(transaction.error || new Error("Could not save draft file."));
      };
    });
  }

  async function getFileRecord(recordId) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, "readonly");
      const request = transaction.objectStore(FILE_STORE).get(recordId);

      request.onsuccess = function () {
        db.close();
        resolve(request.result || null);
      };

      request.onerror = function () {
        db.close();
        reject(request.error || new Error("Could not read draft file."));
      };
    });
  }

  async function deleteFileRecord(recordId) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, "readwrite");
      transaction.objectStore(FILE_STORE).delete(recordId);

      transaction.oncomplete = function () {
        db.close();
        resolve();
      };

      transaction.onerror = function () {
        db.close();
        reject(transaction.error || new Error("Could not delete draft file."));
      };
    });
  }

  async function deleteDraftFiles(draftKey) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, "readwrite");
      const store = transaction.objectStore(FILE_STORE);
      const request = store.openCursor();

      request.onsuccess = function () {
        const cursor = request.result;

        if (cursor) {
          if (String(cursor.key || "").startsWith(`${draftKey}::`)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = function () {
        db.close();
        resolve();
      };

      transaction.onerror = function () {
        db.close();
        reject(transaction.error || new Error("Could not clear draft files."));
      };
    });
  }

  function convertLegacyDraft(draft, baseline) {
    if (!draft) return null;

    if (draft.fields || draft.checkboxes || draft.files) {
      return {
        version: 1,
        updatedAt: Number(draft.updatedAt) || Date.now(),
        fields: draft.fields || {},
        checkboxes: draft.checkboxes || {},
        files: draft.files || {}
      };
    }

    const fields = {};
    const checkboxes = {};
    const valueMap = {
      name: draft.name,
      slug: draft.slug,
      subtitle: draft.subtitle,
      sort_order: draft.sortOrder,
      display_after: draft.displayAfter
    };

    Object.entries(baseline.fields || {}).forEach(([key, item]) => {
      const fieldName = item.name || key;
      if (Object.prototype.hasOwnProperty.call(valueMap, fieldName)) {
        fields[key] = { ...item, value: valueMap[fieldName] || "" };
      }
    });

    Object.entries(baseline.checkboxes || {}).forEach(([key, item]) => {
      if ((item.name || key) === "is_active") {
        checkboxes[key] = {
          ...item,
          checked: draft.isActive !== false
        };
      }
    });

    return {
      version: 1,
      updatedAt: Number(draft.updatedAt) || Date.now(),
      fields,
      checkboxes,
      files: {}
    };
  }

  function setFieldValue(form, item) {
    if (!item) return;

    const field = (
      (item.id && document.getElementById(item.id)) ||
      (item.name && form.querySelector(`[name="${CSS.escape(item.name)}"]`))
    );

    if (!field || field.type === "file") return;

    field.value = item.value || "";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setCheckboxValue(form, item) {
    if (!item) return;

    let field = item.id ? document.getElementById(item.id) : null;

    if (!field && item.name) {
      const candidates = Array.from(
        form.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(item.name)}"]`)
      );
      field = candidates.find((candidate) => candidate.value === item.value) || candidates[0];
    }

    if (!field) return;

    field.checked = Boolean(item.checked);
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function restoreFiles(form, draftKey, files) {
    for (const [fileKey, fileMeta] of Object.entries(files || {})) {
      const record = await getFileRecord(getFileRecordKey(draftKey, fileKey));
      if (!record?.blob) continue;

      const input = (
        (fileMeta.inputId && document.getElementById(fileMeta.inputId)) ||
        (fileMeta.inputName && form.querySelector(
          `input[type="file"][name="${CSS.escape(fileMeta.inputName)}"]`
        ))
      );

      if (!input || typeof DataTransfer === "undefined") continue;

      const file = new File(
        [record.blob],
        record.fileName || "draft-file",
        {
          type: record.fileType || record.blob.type || "application/octet-stream",
          lastModified: record.lastModified || Date.now()
        }
      );
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function initForm(form) {
    const draftKey = form.dataset.draftKey || "";
    if (!draftKey) return;

    const storageKey = getStorageKey(draftKey);
    const maxAge = Number(form.dataset.draftMaxAgeMs || DEFAULT_MAX_AGE_MS);
    const draftLabel = form.dataset.draftLabel || "form";
    const banner = form.querySelector("[data-owner-draft-banner]");
    const baseline = collectState(form);
    let files = {};
    let saveTimer = null;
    let restoring = false;

    async function clearDraft() {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(draftKey);
      localStorage.removeItem(`${draftKey}${LEGACY_STATE_SUFFIX}`);
      files = {};

      try {
        await deleteDraftFiles(draftKey);
      } catch (error) {
        console.warn("Draft file cleanup failed:", error);
      }

      if (banner) {
        banner.hidden = true;
        banner.innerHTML = "";
      }
    }

    function saveCurrentState() {
      if (restoring) return;

      const collected = collectState(form);
      const draft = {
        version: 1,
        updatedAt: Date.now(),
        fields: collected.fields,
        checkboxes: collected.checkboxes,
        files
      };

      if (!stateHasMeaningfulChanges(draft, baseline)) {
        localStorage.removeItem(storageKey);
        return;
      }

      localStorage.setItem(storageKey, JSON.stringify(draft));
    }

    function scheduleSave() {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(saveCurrentState, 220);
    }

    async function saveChangedFile(input) {
      const fileKey = getFieldKey(form, input);
      if (!fileKey) return;

      const recordId = getFileRecordKey(draftKey, fileKey);
      const file = input.files?.[0];

      if (!file) {
        delete files[fileKey];
        await deleteFileRecord(recordId);
        saveCurrentState();
        return;
      }

      await saveFileRecord({
        id: recordId,
        draftKey,
        fileKey,
        inputId: input.id || "",
        inputName: input.name || "",
        fileName: file.name || "draft-file",
        fileType: file.type || "application/octet-stream",
        lastModified: file.lastModified || Date.now(),
        blob: file
      });

      files[fileKey] = {
        inputId: input.id || "",
        inputName: input.name || "",
        fileName: file.name || "draft-file"
      };
      saveCurrentState();
    }

    async function applyDraft(draft) {
      restoring = true;

      Object.values(draft.fields || {}).forEach((item) => setFieldValue(form, item));
      Object.values(draft.checkboxes || {}).forEach((item) => setCheckboxValue(form, item));
      await restoreFiles(form, draftKey, draft.files || {});

      restoring = false;
      files = { ...(draft.files || {}) };
      saveCurrentState();

      if (banner) {
        banner.hidden = true;
      }
    }

    function showBanner(draft) {
      if (!banner) return;

      const updatedAt = new Date(draft.updatedAt).toLocaleString();
      banner.hidden = false;
      banner.innerHTML = `
        <strong>Unsaved ${draftLabel} draft found.</strong>
        <div>Last saved: ${updatedAt}</div>
        <div class="owner-common-draft-actions">
          <button type="button" data-owner-draft-restore>Restore draft</button>
          <button type="button" data-owner-draft-delete>Delete draft</button>
        </div>
      `;

      banner.querySelector("[data-owner-draft-restore]")?.addEventListener(
        "click",
        function () {
          applyDraft(draft).catch((error) => {
            console.warn("Draft restore failed:", error);
          });
        }
      );

      banner.querySelector("[data-owner-draft-delete]")?.addEventListener(
        "click",
        function () {
          clearDraft();
        }
      );
    }

    function loadDraft() {
      let draft = safeJsonParse(localStorage.getItem(storageKey));

      if (!draft) {
        const legacyDraft = (
          safeJsonParse(localStorage.getItem(`${draftKey}${LEGACY_STATE_SUFFIX}`)) ||
          safeJsonParse(localStorage.getItem(draftKey))
        );
        draft = convertLegacyDraft(legacyDraft, baseline);
      }

      localStorage.removeItem(draftKey);
      localStorage.removeItem(`${draftKey}${LEGACY_STATE_SUFFIX}`);

      if (!draft?.updatedAt || Date.now() - Number(draft.updatedAt) > maxAge) {
        localStorage.removeItem(storageKey);
        return null;
      }

      if (!stateHasMeaningfulChanges(draft, baseline)) {
        localStorage.removeItem(storageKey);
        return null;
      }

      localStorage.setItem(storageKey, JSON.stringify(draft));
      return draft;
    }

    form.addEventListener("input", function (event) {
      if (event.target?.type !== "file") {
        scheduleSave();
      }
    });

    form.addEventListener("change", function (event) {
      const target = event.target;
      if (!target) return;

      if (target.type === "file") {
        saveChangedFile(target).catch((error) => {
          console.warn("Draft file save failed:", error);
        });
        return;
      }

      scheduleSave();
    });

    form.addEventListener("submit", function (event) {
      window.setTimeout(function () {
        if (!event.defaultPrevented) {
          clearDraft();
        }
      }, 0);
    });

    form.addEventListener("owner:draft-clear", function () {
      clearDraft();
    });

    const draft = loadDraft();
    if (draft) {
      files = { ...(draft.files || {}) };
      showBanner(draft);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-owner-draft-form]").forEach(initForm);
  });
})();
