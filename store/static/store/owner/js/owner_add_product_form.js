document.addEventListener("DOMContentLoaded", function () {
  const categorySelect = document.getElementById("category");
  const productDetails = document.getElementById("productDetails");
  const productForm = document.querySelector(".product-form");
  const saveBtn = document.querySelector(".save-btn");
  const savingOverlay = document.getElementById("savingOverlay");
  const savingStatus = document.getElementById("savingStatus");
  const clientErrorBox = document.getElementById("clientErrorBox");

  const MAX_IMAGE_MB = Number(productForm?.dataset.maxImageMb || 5);
  const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
  const FETCH_TIMEOUT_MS = 120000;

  const PRODUCT_NAME_MIN_CHARS = Number(productForm?.dataset.productNameMin || 3);
  const PRODUCT_NAME_MAX_CHARS = Number(productForm?.dataset.productNameMax || 80);
  const PRODUCT_NAME_MAX_SINGLE_WORD_CHARS = Number(productForm?.dataset.productNameMaxWord || 32);

  const uploadSelector = ".catalog-upload, .arrival-upload, .top-showcase-upload, .sub-upload, .variant-upload";
  const imageTools = window.OwnerProductImageTools || null;

  const OLD_UPLOAD_RESUME_KEY = "pp_owner_product_upload_resume";
  let isUploadingProduct = false;
  let activeColorPick = null;
  let lastProductColorImageInput = null;
try {
    localStorage.removeItem(OLD_UPLOAD_RESUME_KEY);
  } catch (error) {
    // Ignore old resume cleanup errors.
  }

  function getDraftApi() {
    return window.ProductDraftAutosave || null;
  }

  const sequentialImageInputs = [
    { inputId: "arrivalCardImage", fieldName: "arrival_card_image", label: "New Arrival image" },
    { inputId: "topShowcaseImage", fieldName: "top_showcase_image", label: "Top carousel image" },
    { inputId: "subImage1", fieldName: "sub_image_1", label: "Sub image 1" },
    { inputId: "subImage2", fieldName: "sub_image_2", label: "Sub image 2" },
    { inputId: "subImage3", fieldName: "sub_image_3", label: "Sub image 3" }
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getFieldWrapper(element) {
    if (!element) return null;
    return element.closest(".field, .category-field, .variant-card, .highlight-row");
  }

  function getUploadBox(input) {
    if (!input) return null;
    return input.closest(uploadSelector);
  }

  function getEditUrlForProduct(productId) {
    const editUrlTemplate = productForm?.dataset.editUrlTemplate || "";

    if (!productId || !editUrlTemplate) return "";

    return editUrlTemplate.replace("/0/", `/${productId}/`);
  }

  async function getFileFromDraftByInput(input) {
    if (!input) return null;

    const api = getDraftApi();
    if (!api || !input.id) return null;

    try {
      return await api.getFileByInputId(input.id);
    } catch (error) {
      console.warn("Could not read draft image:", error);
      return null;
    }
  }

  async function getSelectedFileFromInput(input) {
    if (!input) return null;

    const browserFile = input.files && input.files[0];
    if (browserFile) return browserFile;

    return getFileFromDraftByInput(input);
  }

  async function getRequiredImageFile(input, label) {
    const file = await getSelectedFileFromInput(input);

    if (!file) {
      throw new Error(`${label} is required.`);
    }

    validateImageFile(file, label);
    return file;
  }

  window.addEventListener("beforeunload", function (event) {
    if (!isUploadingProduct) return;

    event.preventDefault();
    event.returnValue = "";
  });

  function setFieldError(element, message) {
    if (!element) return;

    const wrapper = getFieldWrapper(element);
    const uploadBox = getUploadBox(element);

    if (wrapper) {
      wrapper.classList.add("is-invalid");
    }

    if (uploadBox) {
      uploadBox.classList.add("is-invalid-upload");
    }

    const errorTarget = wrapper || uploadBox || element.parentElement;
    if (!errorTarget) return;

    let errorText = errorTarget.querySelector(":scope > .field-error-text");

    if (!errorText) {
      errorText = document.createElement("div");
      errorText.className = "field-error-text";
      errorTarget.appendChild(errorText);
    }

    errorText.textContent = message;
  }

  function clearFieldError(element) {
    if (!element) return;

    const wrapper = getFieldWrapper(element);
    const uploadBox = getUploadBox(element);

    if (wrapper) {
      wrapper.classList.remove("is-invalid");
      const errorText = wrapper.querySelector(":scope > .field-error-text");
      if (errorText) errorText.remove();
    }

    if (uploadBox) {
      uploadBox.classList.remove("is-invalid-upload");
    }
  }

  function clearValidationState() {
    document.querySelectorAll(".is-invalid").forEach((item) => {
      item.classList.remove("is-invalid");
    });

    document.querySelectorAll(".is-invalid-upload").forEach((item) => {
      item.classList.remove("is-invalid-upload");
    });

    document.querySelectorAll(".field-error-text").forEach((item) => {
      item.remove();
    });
  }

  function scrollToElement(element) {
    if (!element) return;

    const target = getUploadBox(element) || getFieldWrapper(element) || element;

    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    window.setTimeout(() => {
      if (element && typeof element.focus === "function" && element.type !== "file") {
        element.focus({ preventScroll: true });
      }
    }, 350);
  }

  function showClientError(message, errors) {
    const safeMessage = message || "Please check the form and try again.";

    if (!clientErrorBox) {
      alert(safeMessage);
      return;
    }

    let html = `<strong>${escapeHtml(safeMessage)}</strong>`;

    if (errors) {
      html += "<ul>";

      Object.keys(errors).forEach((fieldName) => {
        const fieldErrors = errors[fieldName] || [];
        fieldErrors.forEach((error) => {
          html += `<li><strong>${escapeHtml(fieldName)}:</strong> ${escapeHtml(error)}</li>`;
        });
      });

      html += "</ul>";
    }

    const draftState = getDraftApi()?.getState?.();

    if (draftState && draftState.status === "server_product_created" && draftState.productId) {
      const editUrl = draftState.editUrl || getEditUrlForProduct(draftState.productId);

      if (editUrl) {
        html += `
          <div style="margin-top: 10px;">
            Product details are already saved.
            <a href="${escapeHtml(editUrl)}">Continue from edit page</a>
            and upload missing images again.
          </div>
        `;
      }
    }

    clientErrorBox.innerHTML = html;
    clientErrorBox.classList.add("is-visible");
    clientErrorBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearClientError() {
    if (!clientErrorBox) return;

    clientErrorBox.innerHTML = "";
    clientErrorBox.classList.remove("is-visible");
  }

  function setSavingStatus(message) {
    const savingStatus = document.getElementById("savingStatus");
    if (savingStatus) {
      savingStatus.textContent = message;
    }
  }

  function showSavingOverlay(message) {
    const savingOverlay = document.getElementById("savingOverlay");
    const saveBtn = document.querySelector(".save-btn");

    setSavingStatus(message || "Saving product...");

    if (savingOverlay) {
      savingOverlay.classList.add("is-visible");
      savingOverlay.setAttribute("aria-hidden", "false");
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }
  }

  function hideSavingOverlay() {
    const savingOverlay = document.getElementById("savingOverlay");
    const saveBtn = document.querySelector(".save-btn");

    if (savingOverlay) {
      savingOverlay.classList.remove("is-visible");
      savingOverlay.setAttribute("aria-hidden", "true");
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Product";
    }
  }

  function toggleProductDetails() {
    if (!categorySelect || !productDetails) return;

    if (categorySelect.value) {
      productDetails.classList.add("is-open");
    } else {
      productDetails.classList.remove("is-open");
    }
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", function () {
      clearValidationState();
      clearClientError();
      toggleProductDetails();
    });
  }

  toggleProductDetails();

  function cleanProductNameValue(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function validateProductNameValue(value) {
    const name = cleanProductNameValue(value);

    if (!name) {
      return "Please enter product name.";
    }

    if (name.length < PRODUCT_NAME_MIN_CHARS) {
      return `Product name should be at least ${PRODUCT_NAME_MIN_CHARS} characters.`;
    }

    if (name.length > PRODUCT_NAME_MAX_CHARS) {
      return `Product name should be under ${PRODUCT_NAME_MAX_CHARS} characters.`;
    }

    const longestWordLength = name
      .split(" ")
      .reduce((maxLength, word) => Math.max(maxLength, word.length), 0);

    if (longestWordLength > PRODUCT_NAME_MAX_SINGLE_WORD_CHARS) {
      return "Product name has a very long word. Please use proper spacing.";
    }

    return "";
  }

  function setupProductNameInput() {
    const productName = document.getElementById("productName");
    if (!productName) return;

    productName.addEventListener("blur", function () {
      productName.value = cleanProductNameValue(productName.value);

      const message = validateProductNameValue(productName.value);
      if (message) {
        setFieldError(productName, message);
      } else {
        clearFieldError(productName);
      }
    });

    productName.addEventListener("input", function () {
      clearFieldError(productName);
      clearClientError();
    });
  }

  setupProductNameInput();

  function validateImageFile(file, label) {
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      throw new Error(`${label} should be a valid image file.`);
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`${label} should be under ${MAX_IMAGE_MB}MB.`);
    }
  }

  function dispatchInputChange(input) {
    if (!input) return;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isVariantImageInput(input) {
    if (!input) return false;
    return input.matches('input[name="variant_images"], input[data-variant-image="true"]');
  }

  function removeSelectedUploadImage(input) {
    if (!input) return;

    stopActiveColorPickMode();
    clearUploadPreview(input);
    input.value = "";
    input.dataset.explicitRemove = "1";
    dispatchInputChange(input);
  }

  setupImagePreview("mainImage");
  setupImagePreview("arrivalCardImage");
  setupImagePreview("topShowcaseImage");
  setupImagePreview("subImage1");
  setupImagePreview("subImage2");
  setupImagePreview("subImage3");

  const isNewArrivalCheckbox = document.getElementById("isNewArrivalCheckbox");
  const arrivalCardField = document.getElementById("arrivalCardField");
  const arrivalCardInput = document.getElementById("arrivalCardImage");

  function toggleArrivalCardField() {
    if (!isNewArrivalCheckbox || !arrivalCardField) return;

    if (isNewArrivalCheckbox.checked) {
      arrivalCardField.classList.add("is-visible");
    } else {
      arrivalCardField.classList.remove("is-visible");
      removeSelectedUploadImage(arrivalCardInput);
    }
  }

  if (isNewArrivalCheckbox) {
    isNewArrivalCheckbox.addEventListener("change", toggleArrivalCardField);
  }

  toggleArrivalCardField();

  const topShowcaseField = document.getElementById("topShowcaseField");
  const topShowcaseInput = document.getElementById("topShowcaseImage");
  const topShowcaseCheckboxes = Array.from(document.querySelectorAll(".top-showcase-checkbox"));

  function hasAnyTopShowcaseChecked() {
    return topShowcaseCheckboxes.some((checkbox) => checkbox.checked);
  }

  function toggleTopShowcaseField() {
    if (!topShowcaseField) return;

    if (hasAnyTopShowcaseChecked()) {
      topShowcaseField.classList.add("is-visible");
    } else {
      topShowcaseField.classList.remove("is-visible");
      removeSelectedUploadImage(topShowcaseInput);
    }
  }

  topShowcaseCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", toggleTopShowcaseField);
  });

  toggleTopShowcaseField();

  const colorPicker = document.getElementById("colorCode");
  const colorText = document.getElementById("colorCodeText");

  function isValidHexColor(value) {
    const color = String(value || "").trim();
    return color === "" || /^#?[0-9A-Fa-f]{3}$/.test(color) || /^#?[0-9A-Fa-f]{6}$/.test(color);
  }

  function syncColorInputs(textInput, pickerInput) {
    if (!textInput || !pickerInput) return;

    pickerInput.addEventListener("input", function () {
      textInput.value = this.value;
    });

    textInput.addEventListener("input", function () {
      const value = this.value.trim();

      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        pickerInput.value = value;
      }

      if (/^[0-9A-Fa-f]{6}$/.test(value)) {
        pickerInput.value = `#${value}`;
      }
    });
  }

  syncColorInputs(colorText, colorPicker);

  const pickMainImageColorBtn = document.getElementById("pickMainImageColorBtn");
  const imageColorPickStatus = document.getElementById("imageColorPickStatus");
  const productColorImageInputIds = [
    "mainImage",
    "subImage1",
    "subImage2",
    "subImage3",
    "arrivalCardImage",
    "topShowcaseImage"
  ];


  if (pickMainImageColorBtn) {
    pickMainImageColorBtn.textContent = "Pick color from uploaded image";
  }

  function setImageColorPickStatus(message) {
    if (imageColorPickStatus) {
      imageColorPickStatus.textContent = message;
    }
  }

  function findFirstProductColorInputWithPreview() {
    const lastBox = getUploadBox(lastProductColorImageInput);

    if (lastProductColorImageInput && lastBox?.querySelector(".upload-preview-img")) {
      return lastProductColorImageInput;
    }

    for (const inputId of productColorImageInputIds) {
      const input = document.getElementById(inputId);
      const box = getUploadBox(input);

      if (input && box?.querySelector(".upload-preview-img")) {
        return input;
      }
    }

    return null;
  }

  function setupProductColorPickButton() {
    if (!pickMainImageColorBtn) return;

    pickMainImageColorBtn.addEventListener("click", function () {
      const input = findFirstProductColorInputWithPreview();

      if (!input) {
        showClientError("Please upload main/sub image first, then pick color.");
        scrollToElement(document.getElementById("mainImage"));
        return;
      }

      startImageColorPickFromInput(input);
    });

    document.addEventListener(
      "click",
      function (event) {
        if (!activeColorPick) return;

        if (event.target.closest(uploadSelector)) return;
        if (event.target.closest("#ownerImageZoomModal")) return;

        setImageColorPickStatus("Color pick mode is still active. Tap the highlighted image or press Esc to cancel.");
      },
      true
    );
  }

  setupProductColorPickButton();

  /* COMMON IMAGE TOOLS BRIDGE
     Keep add-product save/upload logic here.
     Route only preview, zoom, remove, and color-pick through owner_product_image_tools.js.
  */
  function getImageToolOptions() {
    return {
      uploadSelector,
      maxImageMb: MAX_IMAGE_MB,

      onError(message, input) {
        if (input) {
          setFieldError(input, message);
          scrollToElement(input);
        }

        showClientError(message);
      },

      onStatus(message) {
        setImageColorPickStatus(message);
      },

      onPreviewRendered(input) {
        if (!isVariantImageInput(input)) {
          lastProductColorImageInput = input;
        }

        const wrapper = getFieldWrapper(input);
        if (wrapper) {
          wrapper.classList.remove("is-invalid");

          const errorText = wrapper.querySelector(":scope > .field-error-text");
          if (errorText) errorText.remove();
        }

        const box = getUploadBox(input);
        if (box) {
          box.classList.remove("is-invalid-upload");
        }

        clearClientError();
      },

      onRemove(input) {
        if (lastProductColorImageInput === input) {
          lastProductColorImageInput = null;
        }
      },

      onColorPicked(pickedColor, input) {
        const card = input?.closest(".variant-card") || null;
        const textInput = isVariantImageInput(input)
          ? card?.querySelector('input[name="variant_color_codes"]')
          : colorText;

        if (textInput) {
          clearFieldError(textInput);
        }

        clearClientError();
      }
    };
  }

  function renderUploadPreview(input, file) {
    if (!imageTools) return;

    imageTools.renderUploadPreviewFromFile(input, file, getImageToolOptions());
  }

  function clearUploadPreview(input) {
    if (!imageTools) return;

    imageTools.clearUploadPreview(input, getImageToolOptions());

    if (lastProductColorImageInput === input) {
      lastProductColorImageInput = null;
    }
  }

  function setupImagePreview(inputId) {
    if (!imageTools) return;

    const input = typeof inputId === "string" ? document.getElementById(inputId) : inputId;
    imageTools.setupImagePreview(input, getImageToolOptions());
  }

  function startImageColorPickFromInput(input) {
    if (!imageTools) return;

    if (!isVariantImageInput(input)) {
      lastProductColorImageInput = input;
    }

    imageTools.startImageColorPickFromInput(input, getImageToolOptions());
  }

  function stopActiveColorPickMode(message = "") {
    if (!imageTools) return;

    imageTools.stopActiveColorPickMode(message, getImageToolOptions());
  }

  function handleImageColorPickClick(event, image, input) {
    if (!imageTools) return false;

    return imageTools.handleImageColorPickClick(event, image, input, getImageToolOptions());
  }

  function openImageZoom(image) {
    if (!imageTools) return;

    imageTools.openImageZoom(image);
  }

  function closeImageZoom() {
    if (!imageTools) return;

    imageTools.closeImageZoom();
  }
  const addVariantBtn = document.getElementById("addVariantBtn");
  const variantsList = document.getElementById("variantsList");
  let variantCount = 0;

  function cleanPriceValue(value) {
    const raw = String(value || "").trim();
    const beforeDecimal = raw.split(".")[0];

    return beforeDecimal.replace(/[^\d]/g, "");
  }

  function cleanPriceInput(input) {
    if (!input) return;

    const cleaned = cleanPriceValue(input.value);

    if (input.value !== cleaned) {
      input.value = cleaned;
    }
  }

  function setupPriceInput(input) {
    if (!input) return;

    if (input.dataset.priceInputReady === "1") return;
    input.dataset.priceInputReady = "1";

    input.addEventListener("input", function () {
      cleanPriceInput(input);
    });

    input.addEventListener("paste", function () {
      window.setTimeout(() => {
        cleanPriceInput(input);
      }, 0);
    });

    input.addEventListener(
      "wheel",
      function (event) {
        event.preventDefault();
        input.blur();
      },
      { passive: false }
    );
  }

  function setupAllPriceInputs(scope = document) {
    setupPriceInput(document.getElementById("actualPrice"));
    setupPriceInput(document.getElementById("offerPrice"));

    scope
      .querySelectorAll('input[name="variant_actual_prices"], input[name="variant_offer_prices"]')
      .forEach((input) => {
        setupPriceInput(input);
      });
  }

  function cleanAllPriceInputs() {
    document
      .querySelectorAll('#actualPrice, #offerPrice, input[name="variant_actual_prices"], input[name="variant_offer_prices"]')
      .forEach((input) => {
        cleanPriceInput(input);
      });
  }

  function numberValue(input) {
    if (!input) return null;

    cleanPriceInput(input);

    const raw = String(input.value || "").trim();

    if (!raw) return null;

    const value = Number(raw);

    if (!Number.isFinite(value)) return NaN;

    return value;
  }

  function createVariantCard() {
    if (!variantsList) return;

    variantCount += 1;

    const card = document.createElement("div");
    card.className = "variant-card";
    card.dataset.variantIndex = String(variantCount);

    const variantImageId = `variantImage${variantCount}`;
    const variantColorPickerId = `variantColorCode${variantCount}`;
    const variantColorTextId = `variantColorText${variantCount}`;

    card.innerHTML = `
      <div class="variant-card__top">
        <div>
          <div class="variant-card__title">Variant ${variantCount}</div>
          <div class="variant-required-note">Variant image is required.</div>
        </div>

        <button type="button" class="remove-variant-btn">
          Remove
        </button>
      </div>

      <div class="variant-grid">
        <div class="field">
          <label for="${variantImageId}">Variant Image *</label>

          <label class="variant-upload" for="${variantImageId}">
            <input
              type="file"
              id="${variantImageId}"
              name="variant_images"
              accept="image/*"
              data-variant-image="true"
            >
            <span>+</span>
            <small>Upload variant image</small>
          </label>
          <div class="upload-limit-note">Required. Max ${MAX_IMAGE_MB}MB.</div>
        </div>

        <div class="variant-fields">
          <div class="field">
            <label>Variant Color Name *</label>
            <input
              type="text"
              name="variant_color_names"
              placeholder="Example: Pink"
              data-variant-color-name="true"
            >
          </div>

          <div class="field">
            <label>Variant Color Code</label>
            <div class="color-row">
              <input
                type="text"
                id="${variantColorTextId}"
                name="variant_color_codes"
                value="#8f1731"
                placeholder="#8f1731"
              >
              <input
                type="color"
                id="${variantColorPickerId}"
                value="#8f1731"
                aria-label="Pick variant color"
              >
            </div>
          </div>

          <div class="field">
            <label>Actual Price</label>
            <input
              type="text"
              name="variant_actual_prices"
              placeholder="Example: 2499"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
            >
          </div>

          <div class="field">
            <label>Offer Price</label>
            <input
              type="text"
              name="variant_offer_prices"
              placeholder="Example: 1999"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
            >
          </div>

          <label class="check-field">
            <input type="checkbox" name="variant_is_available" value="${variantCount}" checked>
            <span>Variant Available</span>
          </label>
        </div>
      </div>
    `;

    variantsList.appendChild(card);

    setupImagePreview(variantImageId);
    setupAllPriceInputs(card);

    const variantColorPicker = document.getElementById(variantColorPickerId);
    const variantColorText = document.getElementById(variantColorTextId);
    syncColorInputs(variantColorText, variantColorPicker);
const removeBtn = card.querySelector(".remove-variant-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        card.remove();
        refreshVariantTitles();
      });
    }

    refreshVariantTitles();

    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function refreshVariantTitles() {
    if (!variantsList) return;

    const cards = variantsList.querySelectorAll(".variant-card");

    cards.forEach((card, index) => {
      const title = card.querySelector(".variant-card__title");
      const checkbox = card.querySelector('input[name="variant_is_available"]');

      if (title) {
        title.textContent = `Variant ${index + 1}`;
      }

      if (checkbox) {
        checkbox.value = String(index + 1);
      }
    });
  }

  if (addVariantBtn) {
    addVariantBtn.addEventListener("click", createVariantCard);
  }

  const addHighlightBtn = document.getElementById("addHighlightBtn");
  const highlightsList = document.getElementById("highlightsList");

  function createHighlightRow(labelValue = "", detailValue = "") {
    if (!highlightsList) return;

    const row = document.createElement("div");
    row.className = "highlight-row";

    row.innerHTML = `
      <div class="field">
        <label>Highlight Label</label>
        <input
          type="text"
          name="highlight_labels"
          value="${escapeHtml(labelValue)}"
          placeholder="Example: Occasion"
        >
      </div>

      <div class="field">
        <label>Highlight Value</label>
        <input
          type="text"
          name="highlight_values"
          value="${escapeHtml(detailValue)}"
          placeholder="Example: Daily Wear / Office Wear"
        >
      </div>

      <button type="button" class="remove-highlight-btn" aria-label="Remove highlight">
        Remove
      </button>
    `;

    highlightsList.appendChild(row);
  }

  function setupHighlightRemoveButtons() {
    if (!highlightsList) return;

    highlightsList.addEventListener("click", function (event) {
      const removeBtn = event.target.closest(".remove-highlight-btn");
      if (!removeBtn) return;

      const row = removeBtn.closest(".highlight-row");
      if (row) {
        row.remove();
      }
    });
  }

  if (addHighlightBtn) {
    addHighlightBtn.addEventListener("click", function () {
      createHighlightRow();
    });
  }

  setupHighlightRemoveButtons();
  setupAllPriceInputs();

  function addError(errors, element, message) {
    errors.push({ element, message });
    setFieldError(element, message);
  }

  async function validateBaseProduct(errors) {
    const mainImage = document.getElementById("mainImage");
    const productName = document.getElementById("productName");
    const actualPrice = document.getElementById("actualPrice");
    const offerPrice = document.getElementById("offerPrice");
    const stockQuantity = document.getElementById("stockQuantity");
    const colorCodeText = document.getElementById("colorCodeText");

    if (!categorySelect || !String(categorySelect.value || "").trim()) {
      addError(errors, categorySelect, "Please select a product category.");
    }

    try {
      await getRequiredImageFile(mainImage, "Main catalog image");
    } catch (error) {
      addError(errors, mainImage, error.message || "Please upload the main catalog image.");
    }

    if (productName) {
      productName.value = cleanProductNameValue(productName.value);
    }

    const productNameError = validateProductNameValue(productName?.value);

    if (productNameError) {
      addError(errors, productName, productNameError);
    }

    const actual = numberValue(actualPrice);
    const offer = numberValue(offerPrice);
    const stock = numberValue(stockQuantity);

    if (actual === null || Number.isNaN(actual)) {
      addError(errors, actualPrice, "Please enter actual price.");
    } else if (actual <= 0) {
      addError(errors, actualPrice, "Actual price should be greater than 0.");
    }

    if (offer !== null) {
      if (Number.isNaN(offer)) {
        addError(errors, offerPrice, "Offer price should be a valid number.");
      } else if (offer < 0) {
        addError(errors, offerPrice, "Offer price cannot be negative.");
      } else if (actual !== null && !Number.isNaN(actual) && offer > actual) {
        addError(errors, offerPrice, "Offer price cannot be greater than actual price.");
      }
    }

    if (stock !== null) {
      if (Number.isNaN(stock)) {
        addError(errors, stockQuantity, "Available pieces should be a valid number.");
      } else if (stock < 0) {
        addError(errors, stockQuantity, "Available pieces cannot be negative.");
      } else if (!Number.isInteger(stock)) {
        addError(errors, stockQuantity, "Available pieces should be a whole number.");
      }
    }

    if (colorCodeText && !isValidHexColor(colorCodeText.value)) {
      addError(errors, colorCodeText, "Enter a valid color code like #2f6b45.");
    }
  }

  async function validateOptionalSequentialImages(errors) {
    for (const item of sequentialImageInputs) {
      const input = document.getElementById(item.inputId);
      const file = await getSelectedFileFromInput(input);

      if (!file) continue;

      try {
        validateImageFile(file, item.label);
      } catch (error) {
        addError(errors, input, error.message);
      }
    }
  }

  function validateHighlights(errors) {
    if (!highlightsList) return;

    const rows = Array.from(highlightsList.querySelectorAll(".highlight-row"));

    rows.forEach((row, index) => {
      const labelInput = row.querySelector('input[name="highlight_labels"]');
      const valueInput = row.querySelector('input[name="highlight_values"]');

      const label = String(labelInput?.value || "").trim();
      const value = String(valueInput?.value || "").trim();

      if (!label && !value) return;

      if (!label) {
        addError(errors, labelInput, `Highlight ${index + 1}: label is required when value is entered.`);
      }

      if (!value) {
        addError(errors, valueInput, `Highlight ${index + 1}: value is required when label is entered.`);
      }

      if (label.length > 80) {
        addError(errors, labelInput, `Highlight ${index + 1}: label should be under 80 characters.`);
      }

      if (value.length > 180) {
        addError(errors, valueInput, `Highlight ${index + 1}: value should be under 180 characters.`);
      }
    });
  }

  async function validateVariants(errors) {
    if (!variantsList) return;

    const cards = Array.from(variantsList.querySelectorAll(".variant-card"));

    for (const [index, card] of cards.entries()) {
      const imageInput = card.querySelector('input[name="variant_images"]');
      const colorNameInput = card.querySelector('input[name="variant_color_names"]');
      const colorCodeInput = card.querySelector('input[name="variant_color_codes"]');
      const actualPriceInput = card.querySelector('input[name="variant_actual_prices"]');
      const offerPriceInput = card.querySelector('input[name="variant_offer_prices"]');

      const imageFile = await getSelectedFileFromInput(imageInput);
      const colorName = String(colorNameInput?.value || "").trim();
      const colorCode = String(colorCodeInput?.value || "").trim();

      if (!imageFile) {
        addError(errors, imageInput, `Variant ${index + 1}: image is required.`);
      } else {
        try {
          validateImageFile(imageFile, `Variant ${index + 1} image`);
        } catch (error) {
          addError(errors, imageInput, error.message);
        }
      }

      if (!colorName) {
        addError(errors, colorNameInput, `Variant ${index + 1}: color name is required.`);
      }

      if (colorName.length > 80) {
        addError(errors, colorNameInput, `Variant ${index + 1}: color name should be under 80 characters.`);
      }

      if (!isValidHexColor(colorCode)) {
        addError(errors, colorCodeInput, `Variant ${index + 1}: enter a valid color code like #2f6b45.`);
      }

      const actual = numberValue(actualPriceInput);
      const offer = numberValue(offerPriceInput);

      if (actual !== null) {
        if (Number.isNaN(actual)) {
          addError(errors, actualPriceInput, `Variant ${index + 1}: actual price should be a valid number.`);
        } else if (actual < 0) {
          addError(errors, actualPriceInput, `Variant ${index + 1}: actual price cannot be negative.`);
        }
      }

      if (offer !== null) {
        if (Number.isNaN(offer)) {
          addError(errors, offerPriceInput, `Variant ${index + 1}: offer price should be a valid number.`);
        } else if (offer < 0) {
          addError(errors, offerPriceInput, `Variant ${index + 1}: offer price cannot be negative.`);
        } else if (actual !== null && !Number.isNaN(actual) && offer > actual) {
          addError(errors, offerPriceInput, `Variant ${index + 1}: offer price cannot be greater than actual price.`);
        }
      }
    }
  }

  async function validateFormOrThrow() {
    const errors = [];

    clearValidationState();

    await validateBaseProduct(errors);
    await validateOptionalSequentialImages(errors);
    validateHighlights(errors);
    await validateVariants(errors);

    if (!errors.length) return;

    const firstError = errors[0];
    const message = errors.length === 1
      ? firstError.message
      : `Please fix ${errors.length} errors before saving.`;

    const error = new Error(message);
    error.firstElement = firstError.element;
    throw error;
  }

  async function getSelectedSequentialImages() {
    const output = [];

    for (const item of sequentialImageInputs) {
      const input = document.getElementById(item.inputId);
      const file = await getSelectedFileFromInput(input);

      if (!file) continue;

      output.push({
        ...item,
        file
      });
    }

    return output;
  }

  async function getSelectedVariants() {
    if (!variantsList) return [];

    const cards = Array.from(variantsList.querySelectorAll(".variant-card"));
    const output = [];

    for (const [index, card] of cards.entries()) {
      const imageInput = card.querySelector('input[name="variant_images"]');
      const colorNameInput = card.querySelector('input[name="variant_color_names"]');
      const colorCodeInput = card.querySelector('input[name="variant_color_codes"]');
      const actualPriceInput = card.querySelector('input[name="variant_actual_prices"]');
      const offerPriceInput = card.querySelector('input[name="variant_offer_prices"]');
      const availableInput = card.querySelector('input[name="variant_is_available"]');

      cleanPriceInput(actualPriceInput);
      cleanPriceInput(offerPriceInput);

      output.push({
        index,
        label: `Variant ${index + 1}`,
        file: await getSelectedFileFromInput(imageInput),
        colorName: String(colorNameInput?.value || "").trim(),
        colorCode: String(colorCodeInput?.value || "").trim(),
        actualPrice: String(actualPriceInput?.value || "").trim(),
        offerPrice: String(offerPriceInput?.value || "").trim(),
        isAvailable: availableInput && availableInput.checked ? "1" : "0"
      });
    }

    return output;
  }

  async function buildProductCreateFormData() {
    const formData = new FormData(productForm);

    sequentialImageInputs.forEach((item) => {
      formData.delete(item.fieldName);
    });

    formData.delete("variant_images");
    formData.delete("variant_color_names");
    formData.delete("variant_color_codes");
    formData.delete("variant_actual_prices");
    formData.delete("variant_offer_prices");
    formData.delete("variant_is_available");

    const mainImageInput = document.getElementById("mainImage");
    const mainImageFile = await getSelectedFileFromInput(mainImageInput);

    if (mainImageFile) {
      formData.delete("main_image");
      formData.append("main_image", mainImageFile, mainImageFile.name || "main-image");
    }

    return formData;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      return response;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Request is taking too long. Please check internet/server and try again.");
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function createProductFirst() {
    const response = await fetchWithTimeout(productForm.action, {
      method: "POST",
      body: await buildProductCreateFormData(),
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error("Server returned an invalid response. Please try again.");
    }

    if (!response.ok || !data.ok) {
      const error = new Error(data.message || "Product save failed.");
      error.errors = data.errors;
      throw error;
    }

    return data;
  }

  async function uploadSingleImage(productId, imageItem, index, total) {
    const uploadUrlTemplate = productForm.dataset.uploadUrlTemplate;
    const uploadUrl = uploadUrlTemplate.replace("/0/", `/${productId}/`);

    const formData = new FormData();
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]")?.value || "";

    formData.append("csrfmiddlewaretoken", csrfToken);
    formData.append("field_name", imageItem.fieldName);
    formData.append("image", imageItem.file);

    setSavingStatus(`Uploading ${imageItem.label} (${index + 1}/${total})...`);

    const response = await fetchWithTimeout(uploadUrl, {
      method: "POST",
      body: formData,
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`${imageItem.label} upload failed. Invalid server response.`);
    }

    if (!response.ok || !data.ok) {
      throw new Error(data.message || `${imageItem.label} upload failed.`);
    }

    return data;
  }

  async function uploadSingleVariant(productId, variantItem, index, total) {
    const uploadUrlTemplate = productForm.dataset.variantUploadUrlTemplate;

    if (!uploadUrlTemplate) {
      throw new Error("Variant upload URL is missing. Please check product form template.");
    }

    const uploadUrl = uploadUrlTemplate.replace("/0/", `/${productId}/`);

    const formData = new FormData();
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]")?.value || "";

    formData.append("csrfmiddlewaretoken", csrfToken);
    formData.append("image", variantItem.file);
    formData.append("color_name", variantItem.colorName);
    formData.append("color_code", variantItem.colorCode);
    formData.append("actual_price", variantItem.actualPrice);
    formData.append("offer_price", variantItem.offerPrice);
    formData.append("is_available", variantItem.isAvailable);

    setSavingStatus(`Uploading ${variantItem.label} (${index + 1}/${total})...`);

    const response = await fetchWithTimeout(uploadUrl, {
      method: "POST",
      body: formData,
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`${variantItem.label} upload failed. Server returned an invalid response.`);
    }

    if (!response.ok || !data.ok) {
      throw new Error(data.message || `${variantItem.label} upload failed.`);
    }

    return data;
  }

  if (productForm) {
    productForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearClientError();

      let productId = null;
      let editUrl = "";

      try {
        cleanAllPriceInputs();
        await validateFormOrThrow();

        isUploadingProduct = true;
        showSavingOverlay("Saving product details and main image...");

        const selectedImages = await getSelectedSequentialImages();
        const selectedVariants = await getSelectedVariants();

        const productCreateData = await createProductFirst();

        productId = productCreateData.product_id;
        editUrl = productCreateData.edit_url || getEditUrlForProduct(productId);

        if (!productId) {
          throw new Error("Product was saved, but product ID was not received. Please check dashboard.");
        }

        getDraftApi()?.markServerProductCreated?.({
          productId,
          editUrl,
          productName: cleanProductNameValue(document.getElementById("productName")?.value)
        });

        if (selectedImages.length > 0) {
          setSavingStatus("Uploading extra product images...");
        }

        for (let index = 0; index < selectedImages.length; index += 1) {
          await uploadSingleImage(productId, selectedImages[index], index, selectedImages.length);
        }

        if (selectedVariants.length > 0) {
          setSavingStatus("Uploading product variants...");
        }

        for (let index = 0; index < selectedVariants.length; index += 1) {
          await uploadSingleVariant(productId, selectedVariants[index], index, selectedVariants.length);
        }

        await getDraftApi()?.clearDraft?.();
        isUploadingProduct = false;

        setSavingStatus("Product saved successfully. Redirecting...");
        window.location.href = productForm.dataset.successUrl;

      } catch (error) {
        isUploadingProduct = false;
        hideSavingOverlay();

        if (productId) {
          getDraftApi()?.markServerProductCreated?.({
            productId,
            editUrl: editUrl || getEditUrlForProduct(productId),
            productName: cleanProductNameValue(document.getElementById("productName")?.value)
          });
        }

        getDraftApi()?.renderDraftBanner?.();

        const message = error.message || "Something went wrong. Please try again.";
        showClientError(message, error.errors);

        if (error.firstElement) {
          scrollToElement(error.firstElement);
        }
      }
    });
  }
});



