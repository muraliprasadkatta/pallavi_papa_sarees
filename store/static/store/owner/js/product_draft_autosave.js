(function () {
  "use strict";

  const DB_NAME = "pp_owner_product_drafts_db";
  const DB_VERSION = 1;
  const FILE_STORE = "draft_files";
  const DEFAULT_MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  let activeForm = null;
  let activeDraftKey = "";
  let activeDraft = null;
  let restoreApplied = false;

  function now() {
    return Date.now();
  }

  function safeJsonParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isDraftEnabled(form) {
    return form && form.dataset.draftEnabled === "true" && form.dataset.draftKey;
  }

  function getDraftKey(form = activeForm) {
    return form?.dataset.draftKey || "";
  }

  function getDraftMode(form = activeForm) {
    return form?.dataset.draftMode || "add";
  }

  function getProductId(form = activeForm) {
    return form?.dataset.productId || "";
  }

  function getDraftStorageKey(draftKey) {
    return `${draftKey}:state`;
  }

  function getFileStoreKey(draftKey, fileKey) {
    return `${draftKey}::${fileKey}`;
  }

  function getFileKey(input) {
    if (!input) return "";

    if (input.id) return input.id;

    const name = input.getAttribute("name") || "file";
    const index = Array.from(document.querySelectorAll(`input[type="file"][name="${CSS.escape(name)}"]`)).indexOf(input);

    return index >= 0 ? `${name}_${index}` : name;
  }

  function getFieldKey(field) {
    if (!field) return "";

    if (field.id) return field.id;

    const name = field.getAttribute("name") || "";
    if (!name) return "";

    const sameNameFields = Array.from(activeForm.querySelectorAll(`[name="${CSS.escape(name)}"]`));
    const index = sameNameFields.indexOf(field);

    return index > 0 ? `${name}_${index}` : name;
  }

  function getUploadBox(input) {
    if (!input) return null;

    return input.closest(
      ".catalog-upload, .arrival-upload, .top-showcase-upload, .sub-upload, .variant-upload"
    );
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
        reject(request.error || new Error("Could not open draft storage."));
      };
    });
  }

  async function putFileRecord(record) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, "readwrite");
      const store = transaction.objectStore(FILE_STORE);

      store.put(record);

      transaction.oncomplete = function () {
        db.close();
        resolve();
      };

      transaction.onerror = function () {
        db.close();
        reject(transaction.error || new Error("Could not save draft image."));
      };
    });
  }

  async function getFileRecord(draftKey, fileKey) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, "readonly");
      const store = transaction.objectStore(FILE_STORE);
      const request = store.get(getFileStoreKey(draftKey, fileKey));

      request.onsuccess = function () {
        db.close();
        resolve(request.result || null);
      };

      request.onerror = function () {
        db.close();
        reject(request.error || new Error("Could not read draft image."));
      };
    });
  }

  async function deleteFileRecord(draftKey, fileKey) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, "readwrite");
      const store = transaction.objectStore(FILE_STORE);

      store.delete(getFileStoreKey(draftKey, fileKey));

      transaction.oncomplete = function () {
        db.close();
        resolve();
      };

      transaction.onerror = function () {
        db.close();
        reject(transaction.error || new Error("Could not delete draft image."));
      };
    });
  }

  async function deleteAllFilesForDraft(draftKey) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, "readwrite");
      const store = transaction.objectStore(FILE_STORE);
      const request = store.openCursor();

      request.onsuccess = function () {
        const cursor = request.result;

        if (cursor) {
          const key = String(cursor.key || "");

          if (key.startsWith(`${draftKey}::`)) {
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
        reject(transaction.error || new Error("Could not clear draft images."));
      };
    });
  }

  function createEmptyDraft(form) {
    return {
      version: 1,
      status: "local_draft",
      mode: getDraftMode(form),
      productId: getProductId(form) || null,
      editUrl: "",
      updatedAt: now(),
      fields: {},
      checkboxes: {},
      files: {},
      highlights: [],
      variants: []
    };
  }

  function loadDraft(form = activeForm) {
    const draftKey = getDraftKey(form);
    if (!draftKey) return null;

    const draft = safeJsonParse(localStorage.getItem(getDraftStorageKey(draftKey)));

    if (!draft || !draft.updatedAt) return null;

    const maxAge = Number(form?.dataset.draftMaxAgeMs || DEFAULT_MAX_DRAFT_AGE_MS);
    const expired = now() - Number(draft.updatedAt) > maxAge;

    if (expired) {
      clearDraft(draftKey);
      return null;
    }

    return draft;
  }

  function saveDraft(draft) {
    if (!activeDraftKey || !draft) return;

    const nextDraft = {
    ...draft,
    updatedAt: now()
    };

    localStorage.setItem(getDraftStorageKey(activeDraftKey), JSON.stringify(nextDraft));

    activeDraft = nextDraft;
  }

  function updateDraft(partial) {
    const draft = activeDraft || loadDraft(activeForm) || createEmptyDraft(activeForm);

    saveDraft({
      ...draft,
      ...partial
    });
  }

  function collectNormalFields() {
    if (!activeForm) return {};

    const fields = {};

    activeForm
      .querySelectorAll("input, select, textarea")
      .forEach((field) => {
        if (!field.name && !field.id) return;
        if (field.type === "file") return;
        if (field.type === "checkbox") return;
        if (field.type === "radio") return;
        if (field.name === "csrfmiddlewaretoken") return;

        const key = getFieldKey(field);
        if (!key) return;

        fields[key] = {
          name: field.name || "",
          id: field.id || "",
          value: field.value || ""
        };
      });

    return fields;
  }

  function collectCheckboxes() {
    if (!activeForm) return {};

    const checkboxes = {};

    activeForm
      .querySelectorAll('input[type="checkbox"]')
      .forEach((field) => {
        const key = getFieldKey(field);
        if (!key) return;

        checkboxes[key] = {
          name: field.name || "",
          id: field.id || "",
          checked: Boolean(field.checked),
          value: field.value || ""
        };
      });

    return checkboxes;
  }

  function collectHighlights() {
    const highlightsList = document.getElementById("highlightsList");
    if (!highlightsList) return [];

    return Array.from(highlightsList.querySelectorAll(".highlight-row")).map((row) => {
      const labelInput = row.querySelector('input[name="highlight_labels"]');
      const valueInput = row.querySelector('input[name="highlight_values"]');

      return {
        label: labelInput?.value || "",
        value: valueInput?.value || ""
      };
    });
  }

  function collectVariants() {
    const variantsList = document.getElementById("variantsList");
    if (!variantsList) return [];

    return Array.from(variantsList.querySelectorAll(".variant-card")).map((card) => {
      const imageInput = card.querySelector('input[name="variant_images"]');
      const colorNameInput = card.querySelector('input[name="variant_color_names"]');
      const colorCodeInput = card.querySelector('input[name="variant_color_codes"]');
      const actualPriceInput = card.querySelector('input[name="variant_actual_prices"]');
      const offerPriceInput = card.querySelector('input[name="variant_offer_prices"]');
      const availableInput = card.querySelector('input[name="variant_is_available"]');

      return {
        imageInputId: imageInput?.id || "",
        imageFileKey: imageInput ? getFileKey(imageInput) : "",
        colorName: colorNameInput?.value || "",
        colorCode: colorCodeInput?.value || "",
        actualPrice: actualPriceInput?.value || "",
        offerPrice: offerPriceInput?.value || "",
        isAvailable: Boolean(availableInput?.checked)
      };
    });
  }

  function saveFormState() {
    if (!activeForm || !activeDraftKey) return;

    const draft = activeDraft || loadDraft(activeForm) || createEmptyDraft(activeForm);

    saveDraft({
      ...draft,
      fields: collectNormalFields(),
      checkboxes: collectCheckboxes(),
      highlights: collectHighlights(),
      variants: collectVariants(),
      mode: getDraftMode(activeForm),
      productId: draft.productId || getProductId(activeForm) || null
    });
  }

  async function saveFileInput(input) {
    if (!input || !activeDraftKey) return;

    const file = input.files && input.files[0];
    const fileKey = getFileKey(input);

    if (!fileKey) return;

    const draft = activeDraft || loadDraft(activeForm) || createEmptyDraft(activeForm);
    const files = { ...(draft.files || {}) };

    if (!file) {
      delete files[fileKey];
      await deleteFileRecord(activeDraftKey, fileKey);
      saveDraft({ ...draft, files });
      return;
    }

    await putFileRecord({
      id: getFileStoreKey(activeDraftKey, fileKey),
      draftKey: activeDraftKey,
      fileKey,
      inputId: input.id || "",
      inputName: input.name || "",
      fileName: file.name || "image",
      fileType: file.type || "application/octet-stream",
      fileSize: file.size || 0,
      lastModified: file.lastModified || now(),
      blob: file,
      updatedAt: now()
    });

    files[fileKey] = {
      fileKey,
      inputId: input.id || "",
      inputName: input.name || "",
      fileName: file.name || "image",
      fileType: file.type || "application/octet-stream",
      fileSize: file.size || 0,
      lastModified: file.lastModified || now()
    };

    saveDraft({
      ...draft,
      files,
      variants: collectVariants()
    });
  }

  function setFieldValue(fieldInfo) {
    if (!fieldInfo) return;

    let field = null;

    if (fieldInfo.id) {
      field = document.getElementById(fieldInfo.id);
    }

    if (!field && fieldInfo.name) {
      field = activeForm.querySelector(`[name="${CSS.escape(fieldInfo.name)}"]`);
    }

    if (!field || field.type === "file") return;

    field.value = fieldInfo.value || "";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setCheckboxValue(checkboxInfo) {
    if (!checkboxInfo) return;

    let field = null;

    if (checkboxInfo.id) {
      field = document.getElementById(checkboxInfo.id);
    }

    if (!field && checkboxInfo.name) {
      const candidates = Array.from(
        activeForm.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(checkboxInfo.name)}"]`)
      );

      field = candidates.find((item) => item.value === checkboxInfo.value) || candidates[0];
    }

    if (!field) return;

    field.checked = Boolean(checkboxInfo.checked);
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function ensureHighlightRows(count) {
    const highlightsList = document.getElementById("highlightsList");
    const addHighlightBtn = document.getElementById("addHighlightBtn");

    if (!highlightsList || !addHighlightBtn) return;

    let rows = highlightsList.querySelectorAll(".highlight-row").length;

    while (rows < count) {
      addHighlightBtn.click();
      rows += 1;
    }
  }

  function restoreHighlights(highlights) {
    if (!Array.isArray(highlights) || !highlights.length) return;

    const highlightsList = document.getElementById("highlightsList");
    if (!highlightsList) return;

    ensureHighlightRows(highlights.length);

    const rows = Array.from(highlightsList.querySelectorAll(".highlight-row"));

    highlights.forEach((item, index) => {
      const row = rows[index];
      if (!row) return;

      const labelInput = row.querySelector('input[name="highlight_labels"]');
      const valueInput = row.querySelector('input[name="highlight_values"]');

      if (labelInput) labelInput.value = item.label || "";
      if (valueInput) valueInput.value = item.value || "";
    });
  }

  function ensureVariantRows(count) {
    const variantsList = document.getElementById("variantsList");
    const addVariantBtn = document.getElementById("addVariantBtn");

    if (!variantsList || !addVariantBtn) return;

    let rows = variantsList.querySelectorAll(".variant-card").length;

    while (rows < count) {
      addVariantBtn.click();
      rows += 1;
    }
  }

  function restoreVariants(variants) {
    if (!Array.isArray(variants) || !variants.length) return;

    const variantsList = document.getElementById("variantsList");
    if (!variantsList) return;

    ensureVariantRows(variants.length);

    const cards = Array.from(variantsList.querySelectorAll(".variant-card"));

    variants.forEach((item, index) => {
      const card = cards[index];
      if (!card) return;

      const colorNameInput = card.querySelector('input[name="variant_color_names"]');
      const colorCodeInput = card.querySelector('input[name="variant_color_codes"]');
      const actualPriceInput = card.querySelector('input[name="variant_actual_prices"]');
      const offerPriceInput = card.querySelector('input[name="variant_offer_prices"]');
      const availableInput = card.querySelector('input[name="variant_is_available"]');
      const colorPicker = card.querySelector('input[type="color"]');

      if (colorNameInput) colorNameInput.value = item.colorName || "";
      if (colorCodeInput) colorCodeInput.value = item.colorCode || "";
      if (actualPriceInput) actualPriceInput.value = item.actualPrice || "";
      if (offerPriceInput) offerPriceInput.value = item.offerPrice || "";
      if (availableInput) availableInput.checked = item.isAvailable !== false;

      if (colorPicker && item.colorCode && /^#[0-9A-Fa-f]{6}$/.test(item.colorCode)) {
        colorPicker.value = item.colorCode;
      }
    });
  }

  async function restoreFilePreview(fileKey, fileMeta) {
    if (!fileKey || !fileMeta) return;

    const record = await getFileRecord(activeDraftKey, fileKey);
    if (!record || !record.blob) return;

    let input = null;

    if (fileMeta.inputId) {
      input = document.getElementById(fileMeta.inputId);
    }

    if (!input && fileMeta.inputName) {
      input = activeForm.querySelector(`input[type="file"][name="${CSS.escape(fileMeta.inputName)}"]`);
    }

    if (!input) return;

    const box = getUploadBox(input);
    if (!box) return;

    const previewUrl = URL.createObjectURL(record.blob);

    let previewImg = box.querySelector(".upload-preview-img");
    if (!previewImg) {
      previewImg = document.createElement("img");
      previewImg.className = "upload-preview-img";
      previewImg.alt = "Draft image preview";
      box.appendChild(previewImg);
    }

    let fileName = box.querySelector(".upload-preview-layer");
    if (!fileName) {
      fileName = document.createElement("div");
      fileName.className = "upload-preview-layer";
      box.appendChild(fileName);
    }

    previewImg.onload = function () {
      URL.revokeObjectURL(previewUrl);
    };

    previewImg.src = previewUrl;
    fileName.textContent = `${record.fileName || "Draft image"} (draft)`;
    box.classList.add("has-preview");
    box.classList.remove("is-invalid-upload");
    box.dataset.draftFileKey = fileKey;
  }

  async function restoreFilePreviews(draft) {
    const files = draft?.files || {};
    const entries = Object.entries(files);

    for (const [fileKey, fileMeta] of entries) {
      await restoreFilePreview(fileKey, fileMeta);
    }
  }

  async function applyDraft(draft) {
    if (!activeForm || !draft) return;

    restoreApplied = true;

    Object.values(draft.fields || {}).forEach(setFieldValue);
    Object.values(draft.checkboxes || {}).forEach(setCheckboxValue);

    restoreHighlights(draft.highlights || []);
    restoreVariants(draft.variants || []);

    await restoreFilePreviews(draft);

    activeDraft = draft;
    saveFormState();
  }

  function getResumeBox() {
    return document.getElementById("clientResumeBox");
  }

  function renderDraftBanner() {
    const box = getResumeBox();
    if (!box) return;

    const draft = loadDraft(activeForm);

    if (!draft) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }

    const isServerCreated = draft.status === "server_product_created" && draft.productId;
    const fileCount = Object.keys(draft.files || {}).length;
    const updatedDate = draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : "";

    box.hidden = false;

    if (isServerCreated) {
      const editUrl = draft.editUrl || "";

      box.innerHTML = `
        <strong>Saved product upload was interrupted.</strong>
        <div>Product ID: ${escapeHtml(draft.productId)}. Uploaded product already exists.</div>
        <div>Continue from edit page and upload missing images if needed.</div>
        <div style="margin-top: 10px;">
          ${
            editUrl
              ? `<a href="${escapeHtml(editUrl)}">Continue editing saved product</a>`
              : ""
          }
          <button type="button" data-draft-dismiss style="margin-left: 8px;">Dismiss</button>
        </div>
      `;
    } else {
      box.innerHTML = `
        <strong>Unsaved product draft found.</strong>
        <div>Draft images: ${fileCount}. Last saved: ${escapeHtml(updatedDate)}</div>
        <div style="margin-top: 10px;">
          <button type="button" data-draft-restore>Restore draft</button>
          <button type="button" data-draft-clear style="margin-left: 8px;">Delete draft</button>
        </div>
      `;
    }

    const restoreBtn = box.querySelector("[data-draft-restore]");
    const clearBtn = box.querySelector("[data-draft-clear]");
    const dismissBtn = box.querySelector("[data-draft-dismiss]");

    if (restoreBtn) {
      restoreBtn.addEventListener("click", async function () {
        const latestDraft = loadDraft(activeForm);

        if (latestDraft) {
          await applyDraft(latestDraft);
        }

        box.hidden = true;
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", async function () {
        await clearDraft(activeDraftKey);
        renderDraftBanner();
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener("click", function () {
        box.hidden = true;
      });
    }
  }

  function setupFormListeners() {
    if (!activeForm) return;

    activeForm.addEventListener("input", function (event) {
      const target = event.target;

      if (!target || target.type === "file") return;

      window.clearTimeout(activeForm.__draftInputTimer);
      activeForm.__draftInputTimer = window.setTimeout(saveFormState, 250);
    });

    activeForm.addEventListener("change", async function (event) {
      const target = event.target;

      if (!target) return;

      if (target.type === "file") {
        try {
          await saveFileInput(target);
        } catch (error) {
          console.warn("Draft image save failed:", error);
        }

        saveFormState();
        return;
      }

      saveFormState();
    });

    document.addEventListener("click", function (event) {
      if (
        event.target.closest("#addHighlightBtn") ||
        event.target.closest("#addVariantBtn") ||
        event.target.closest(".remove-highlight-btn") ||
        event.target.closest(".remove-variant-btn")
      ) {
        window.setTimeout(saveFormState, 150);
      }
    });
  }

  async function getFileByFileKey(fileKey) {
    if (!activeDraftKey || !fileKey) return null;

    const record = await getFileRecord(activeDraftKey, fileKey);

    if (!record || !record.blob) return null;

    return new File(
      [record.blob],
      record.fileName || "draft-image",
      {
        type: record.fileType || record.blob.type || "application/octet-stream",
        lastModified: record.lastModified || now()
      }
    );
  }

  async function getFileByInputId(inputId) {
    const draft = activeDraft || loadDraft(activeForm);
    const files = draft?.files || {};

    const match = Object.values(files).find((item) => item.inputId === inputId);

    if (!match) return null;

    return getFileByFileKey(match.fileKey);
  }

  async function getFileByInputName(inputName) {
    const draft = activeDraft || loadDraft(activeForm);
    const files = draft?.files || {};

    const match = Object.values(files).find((item) => item.inputName === inputName);

    if (!match) return null;

    return getFileByFileKey(match.fileKey);
  }

  async function getFilesByInputName(inputName) {
    const draft = activeDraft || loadDraft(activeForm);
    const files = draft?.files || {};

    const matches = Object.values(files).filter((item) => item.inputName === inputName);
    const output = [];

    for (const item of matches) {
      const file = await getFileByFileKey(item.fileKey);

      if (file) {
        output.push({
          file,
          fileKey: item.fileKey,
          inputId: item.inputId || "",
          inputName: item.inputName || ""
        });
      }
    }

    return output;
  }

  function markServerProductCreated({ productId, editUrl, productName } = {}) {
    if (!productId) return;

    const draft = activeDraft || loadDraft(activeForm) || createEmptyDraft(activeForm);

    saveDraft({
      ...draft,
      status: "server_product_created",
      productId,
      editUrl: editUrl || draft.editUrl || "",
      productName: productName || draft.productName || ""
    });
  }

  async function clearDraft(draftKey = activeDraftKey) {
    if (!draftKey) return;

    localStorage.removeItem(getDraftStorageKey(draftKey));

    try {
      await deleteAllFilesForDraft(draftKey);
    } catch (error) {
      console.warn("Draft files clear failed:", error);
    }

    if (draftKey === activeDraftKey) {
      activeDraft = null;
      renderDraftBanner();
    }
  }

    async function init() {
    activeForm = document.querySelector(".product-form");

    if (!isDraftEnabled(activeForm)) return;

    activeDraftKey = getDraftKey(activeForm);
    activeDraft = loadDraft(activeForm);

    setupFormListeners();
    renderDraftBanner();

    if (!activeDraft) {
        saveFormState();
    }
    }

    window.ProductDraftAutosave = {
    init,
    loadDraft: function () {
        return loadDraft(activeForm);
    },
    saveFormState,
    clearDraft: function () {
        return clearDraft(activeDraftKey);
    },
    markServerProductCreated,
    getFileByFileKey,
    getFileByInputId,
    getFileByInputName,
    getFilesByInputName,
    applyDraft,
    renderDraftBanner,
    getState: function () {
        return activeDraft || loadDraft(activeForm);
    },
    wasRestoreApplied: function () {
        return restoreApplied;
    }
    };

    document.addEventListener("DOMContentLoaded", function () {
    window.setTimeout(init, 80);
    });
    })();