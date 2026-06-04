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

  const uploadSelector = ".catalog-upload, .arrival-upload, .top-showcase-upload, .sub-upload, .variant-upload";

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

    let errorTarget = wrapper || uploadBox || element.parentElement;
    if (!errorTarget) return;

    let errorText = errorTarget.querySelector(":scope > .field-error-text");

    if (!errorText) {
      errorText = document.createElement("div");
      errorText.className = "field-error-text";
      errorTarget.appendChild(errorText);
    }

    errorText.textContent = message;
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
    if (savingStatus) {
      savingStatus.textContent = message;
    }
  }

  function showSavingOverlay(message) {
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

  function validateImageFile(file, label) {
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      throw new Error(`${label} should be a valid image file.`);
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`${label} should be under ${MAX_IMAGE_MB}MB.`);
    }
  }

  function setupImagePreview(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const box = getUploadBox(input);
    if (!box) return;

    input.addEventListener("change", function () {
      clearClientError();

      const file = this.files && this.files[0];

      if (!file) {
        clearUploadPreview(this);
        return;
      }

      try {
        validateImageFile(file, "Selected image");
      } catch (error) {
        clearUploadPreview(this);
        setFieldError(this, error.message);
        showClientError(error.message);
        return;
      }

      const previewUrl = URL.createObjectURL(file);

      let previewImg = box.querySelector(".upload-preview-img");
      if (!previewImg) {
        previewImg = document.createElement("img");
        previewImg.className = "upload-preview-img";
        previewImg.alt = "Selected image preview";
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
      fileName.textContent = file.name;
      box.classList.add("has-preview");
      box.classList.remove("is-invalid-upload");

      const wrapper = getFieldWrapper(input);
      if (wrapper) {
        wrapper.classList.remove("is-invalid");
        const errorText = wrapper.querySelector(":scope > .field-error-text");
        if (errorText) errorText.remove();
      }
    });
  }

  function clearUploadPreview(input) {
    if (!input) return;

    const box = getUploadBox(input);
    if (!box) return;

    input.value = "";

    const previewImg = box.querySelector(".upload-preview-img");
    const fileName = box.querySelector(".upload-preview-layer");

    if (previewImg) previewImg.remove();
    if (fileName) fileName.remove();

    box.classList.remove("has-preview");
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
      clearUploadPreview(arrivalCardInput);
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
      clearUploadPreview(topShowcaseInput);
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

  const addVariantBtn = document.getElementById("addVariantBtn");
  const variantsList = document.getElementById("variantsList");
  let variantCount = 0;

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
              type="number"
              name="variant_actual_prices"
              placeholder="Example: 2499"
              min="0"
              step="0.01"
            >
          </div>

          <div class="field">
            <label>Offer Price</label>
            <input
              type="number"
              name="variant_offer_prices"
              placeholder="Example: 1999"
              min="0"
              step="0.01"
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

  function numberValue(input) {
    if (!input) return null;
    const raw = String(input.value || "").trim();

    if (!raw) return null;

    const value = Number(raw);

    if (!Number.isFinite(value)) return NaN;

    return value;
  }

  function addError(errors, element, message) {
    errors.push({ element, message });
    setFieldError(element, message);
  }

  function validateBaseProduct(errors) {
    const mainImage = document.getElementById("mainImage");
    const productName = document.getElementById("productName");
    const actualPrice = document.getElementById("actualPrice");
    const offerPrice = document.getElementById("offerPrice");
    const stockQuantity = document.getElementById("stockQuantity");
    const colorCodeText = document.getElementById("colorCodeText");

    if (!categorySelect || !String(categorySelect.value || "").trim()) {
      addError(errors, categorySelect, "Please select a product category.");
    }

    if (!mainImage || !mainImage.files || !mainImage.files[0]) {
      addError(errors, mainImage, "Please upload the main catalog image.");
    } else {
      try {
        validateImageFile(mainImage.files[0], "Main catalog image");
      } catch (error) {
        addError(errors, mainImage, error.message);
      }
    }

    if (!productName || !String(productName.value || "").trim()) {
      addError(errors, productName, "Please enter product name.");
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

  function validateOptionalSequentialImages(errors) {
    sequentialImageInputs.forEach((item) => {
      const input = document.getElementById(item.inputId);
      const file = input && input.files && input.files[0];

      if (!file) return;

      try {
        validateImageFile(file, item.label);
      } catch (error) {
        addError(errors, input, error.message);
      }
    });
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

  function validateVariants(errors) {
    if (!variantsList) return;

    const cards = Array.from(variantsList.querySelectorAll(".variant-card"));

    cards.forEach((card, index) => {
      const imageInput = card.querySelector('input[name="variant_images"]');
      const colorNameInput = card.querySelector('input[name="variant_color_names"]');
      const colorCodeInput = card.querySelector('input[name="variant_color_codes"]');
      const actualPriceInput = card.querySelector('input[name="variant_actual_prices"]');
      const offerPriceInput = card.querySelector('input[name="variant_offer_prices"]');

      const imageFile = imageInput && imageInput.files && imageInput.files[0];
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
    });
  }

  function validateFormOrThrow() {
    const errors = [];

    clearValidationState();

    validateBaseProduct(errors);
    validateOptionalSequentialImages(errors);
    validateHighlights(errors);
    validateVariants(errors);

    if (!errors.length) return;

    const firstError = errors[0];
    const message = errors.length === 1
      ? firstError.message
      : `Please fix ${errors.length} errors before saving.`;

    const error = new Error(message);
    error.firstElement = firstError.element;
    throw error;
  }

  function getSelectedSequentialImages() {
    return sequentialImageInputs
      .map((item) => {
        const input = document.getElementById(item.inputId);
        const file = input && input.files && input.files[0];

        if (!file) return null;

        return {
          ...item,
          file
        };
      })
      .filter(Boolean);
  }

  function buildProductCreateFormData() {
    const formData = new FormData(productForm);

    sequentialImageInputs.forEach((item) => {
      formData.delete(item.fieldName);
    });

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
      body: buildProductCreateFormData(),
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

    return data.product_id;
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

  if (productForm) {
    productForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearClientError();

      try {
        validateFormOrThrow();

        showSavingOverlay("Saving product details, main image, and variants...");

        const selectedImages = getSelectedSequentialImages();
        const productId = await createProductFirst();

        for (let index = 0; index < selectedImages.length; index += 1) {
          await uploadSingleImage(productId, selectedImages[index], index, selectedImages.length);
        }

        setSavingStatus("Product saved successfully. Redirecting...");
        window.location.href = productForm.dataset.successUrl;

      } catch (error) {
        hideSavingOverlay();

        const message = error.message || "Something went wrong. Please try again.";
        showClientError(message, error.errors);

        if (error.firstElement) {
          scrollToElement(error.firstElement);
        }
      }
    });
  }
});
