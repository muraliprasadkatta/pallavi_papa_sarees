(function () {
  "use strict";

  const STORAGE_KEY = "pp_owner_home_row_add_draft";
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function loadDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!draft || !draft.updatedAt) return null;

      if (Date.now() - Number(draft.updatedAt) > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return draft;
    } catch (error) {
      return null;
    }
  }

  function init() {
    const form = document.querySelector("form.owner-row-card");
    if (!form) return;

    const fields = {
      name: form.querySelector('[name="name"]'),
      slug: form.querySelector('[name="slug"]'),
      subtitle: form.querySelector('[name="subtitle"]'),
      sortOrder: form.querySelector('[name="sort_order"]'),
      isActive: form.querySelector('[name="is_active"]')
    };

    let saveTimer = null;

    function saveDraft() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        updatedAt: Date.now(),
        name: fields.name?.value || "",
        slug: fields.slug?.value || "",
        subtitle: fields.subtitle?.value || "",
        sortOrder: fields.sortOrder?.value || "",
        isActive: Boolean(fields.isActive?.checked)
      }));
    }

    function scheduleSave() {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(saveDraft, 200);
    }

    function applyDraft(draft) {
      if (fields.name) fields.name.value = draft.name || "";
      if (fields.slug) fields.slug.value = draft.slug || "";
      if (fields.subtitle) fields.subtitle.value = draft.subtitle || "";
      if (fields.sortOrder) fields.sortOrder.value = draft.sortOrder || "";
      if (fields.isActive) fields.isActive.checked = draft.isActive !== false;
      saveDraft();
    }

    function showRestoreBanner(draft) {
      const banner = document.createElement("div");
      banner.className = "owner-form-error owner-home-row-draft-banner";
      banner.innerHTML = `
        <strong>Unsaved home row draft found.</strong>
        <div class="owner-home-row-draft-actions">
          <button type="button" data-home-row-draft-restore>Restore draft</button>
          <button type="button" data-home-row-draft-clear>Delete draft</button>
        </div>
      `;

      form.prepend(banner);

      banner.querySelector("[data-home-row-draft-restore]").addEventListener("click", function () {
        applyDraft(draft);
        banner.remove();
      });

      banner.querySelector("[data-home-row-draft-clear]").addEventListener("click", function () {
        localStorage.removeItem(STORAGE_KEY);
        banner.remove();
      });
    }

    form.addEventListener("input", scheduleSave);
    form.addEventListener("change", scheduleSave);
    form.addEventListener("submit", function () {
      localStorage.removeItem(STORAGE_KEY);
    });

    const draft = loadDraft();
    const hasServerValues = Boolean(
      fields.name?.value || fields.slug?.value || fields.subtitle?.value
    );

    if (draft && !hasServerValues) {
      showRestoreBanner(draft);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();