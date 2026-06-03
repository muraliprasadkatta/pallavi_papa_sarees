
  const categorySelect = document.getElementById("category");
  const productDetails = document.getElementById("productDetails");

  function toggleProductDetails() {
    if (categorySelect.value) {
      productDetails.classList.add("is-open");
    } else {
      productDetails.classList.remove("is-open");
    }
  }

  categorySelect.addEventListener("change", toggleProductDetails);
  toggleProductDetails();

  function setupImagePreview(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const box = input.closest(".catalog-upload, .arrival-upload, .top-showcase-upload, .sub-upload, .variant-upload");
    if (!box) return;

    input.addEventListener("change", function () {
      const file = this.files && this.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Please select an image file only.");
        this.value = "";
        return;
      }

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

      previewImg.src = URL.createObjectURL(file);
      fileName.textContent = file.name;
      box.classList.add("has-preview");
    });
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

  function clearUploadPreview(input) {
    if (!input) return;

    const box = input.closest(".catalog-upload, .arrival-upload, .top-showcase-upload, .sub-upload, .variant-upload");
    if (!box) return;

    input.value = "";

    const previewImg = box.querySelector(".upload-preview-img");
    const fileName = box.querySelector(".upload-preview-layer");

    if (previewImg) {
      previewImg.remove();
    }

    if (fileName) {
      fileName.remove();
    }

    box.classList.remove("has-preview");
  }

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
  const topShowcaseCheckboxes = document.querySelectorAll(".top-showcase-checkbox");

  function hasAnyTopShowcaseChecked() {
    return Array.from(topShowcaseCheckboxes).some((checkbox) => checkbox.checked);
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

  if (colorPicker && colorText) {
    colorPicker.addEventListener("input", function () {
      colorText.value = this.value;
    });

    colorText.addEventListener("input", function () {
      if (/^#[0-9A-Fa-f]{6}$/.test(this.value.trim())) {
        colorPicker.value = this.value.trim();
      }
    });
  }

  const addVariantBtn = document.getElementById("addVariantBtn");
  const variantsList = document.getElementById("variantsList");
  let variantCount = 0;

  function createVariantCard() {
    variantCount += 1;

    const card = document.createElement("div");
    card.className = "variant-card";
    card.dataset.variantIndex = String(variantCount);

    const variantImageId = `variantImage${variantCount}`;
    const variantColorPickerId = `variantColorCode${variantCount}`;
    const variantColorTextId = `variantColorText${variantCount}`;

    card.innerHTML = `
      <div class="variant-card__top">
        <div class="variant-card__title">Variant ${variantCount}</div>

        <button type="button" class="remove-variant-btn">
          Remove
        </button>
      </div>

      <div class="variant-grid">
        <div class="field">
          <label for="${variantImageId}">Variant Image</label>

          <label class="variant-upload" for="${variantImageId}">
            <input
              type="file"
              id="${variantImageId}"
              name="variant_images"
              accept="image/*"
            >
            <span>+</span>
            <small>Upload variant image</small>
          </label>
        </div>

        <div class="variant-fields">
          <div class="field">
            <label>Variant Color Name</label>
            <input
              type="text"
              name="variant_color_names"
              placeholder="Example: Pink"
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

    if (variantColorPicker && variantColorText) {
      variantColorPicker.addEventListener("input", function () {
        variantColorText.value = this.value;
      });

      variantColorText.addEventListener("input", function () {
        if (/^#[0-9A-Fa-f]{6}$/.test(this.value.trim())) {
          variantColorPicker.value = this.value.trim();
        }
      });
    }

    const removeBtn = card.querySelector(".remove-variant-btn");
    removeBtn.addEventListener("click", function () {
      card.remove();
      refreshVariantTitles();
    });
  }

  function refreshVariantTitles() {
    const cards = variantsList.querySelectorAll(".variant-card");

    cards.forEach((card, index) => {
      const title = card.querySelector(".variant-card__title");
      if (title) {
        title.textContent = `Variant ${index + 1}`;
      }
    });
  }

  addVariantBtn.addEventListener("click", createVariantCard);


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
          value="${labelValue}"
          placeholder="Example: Occasion"
        >
      </div>

      <div class="field">
        <label>Highlight Value</label>
        <input
          type="text"
          name="highlight_values"
          value="${detailValue}"
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

  const productForm = document.querySelector(".product-form");
  const saveBtn = document.querySelector(".save-btn");
  const savingOverlay = document.getElementById("savingOverlay");
  const savingStatus = document.getElementById("savingStatus");
  const clientErrorBox = document.getElementById("clientErrorBox");

  const sequentialImageInputs = [
    { inputId: "arrivalCardImage", fieldName: "arrival_card_image", label: "New Arrival image" },
    { inputId: "topShowcaseImage", fieldName: "top_showcase_image", label: "Top carousel image" },
    { inputId: "subImage1", fieldName: "sub_image_1", label: "Sub image 1" },
    { inputId: "subImage2", fieldName: "sub_image_2", label: "Sub image 2" },
    { inputId: "subImage3", fieldName: "sub_image_3", label: "Sub image 3" }
  ];

  function showClientError(message, errors) {
    if (!clientErrorBox) {
      alert(message);
      return;
    }

    let html = `<strong>${message}</strong>`;

    if (errors) {
      html += "<ul>";

      Object.keys(errors).forEach((fieldName) => {
        const fieldErrors = errors[fieldName] || [];
        fieldErrors.forEach((error) => {
          html += `<li><strong>${fieldName}:</strong> ${error}</li>`;
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
    setSavingStatus(message);

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

  function validateSelectedImagesBeforeUpload() {
    const maxBytes = 5 * 1024 * 1024;
    const stockQuantityInput = document.getElementById("stockQuantity");

    if (stockQuantityInput && Number(stockQuantityInput.value || 0) < 0) {
      throw new Error("Available pieces cannot be negative.");
    }

    const inputsToCheck = ["mainImage", "arrivalCardImage", "topShowcaseImage", "subImage1", "subImage2", "subImage3"];

    for (const inputId of inputsToCheck) {
      const input = document.getElementById(inputId);
      const file = input && input.files && input.files[0];

      if (!file) continue;

      if (!file.type.startsWith("image/")) {
        throw new Error("Please select image files only.");
      }

      if (file.size > maxBytes) {
        throw new Error(`${file.name} is above 5MB. Please upload an image below 5MB.`);
      }
    }
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

    // Variant image handling can be connected later with separate variant upload flow.
    formData.delete("variant_images");

    return formData;
  }

  async function createProductFirst() {
    const response = await fetch(productForm.action, {
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
    formData.append("csrfmiddlewaretoken", document.querySelector("[name=csrfmiddlewaretoken]").value);
    formData.append("field_name", imageItem.fieldName);
    formData.append("image", imageItem.file);

    setSavingStatus(`Uploading ${imageItem.label} (${index + 1}/${total})...`);

    const response = await fetch(uploadUrl, {
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
        validateSelectedImagesBeforeUpload();

        showSavingOverlay("Saving product details and main image...");

        const selectedImages = getSelectedSequentialImages();
        const productId = await createProductFirst();

        for (let index = 0; index < selectedImages.length; index += 1) {
          await uploadSingleImage(productId, selectedImages[index], index, selectedImages.length);
        }

        setSavingStatus("Product saved successfully. Redirecting...");
        window.location.href = productForm.dataset.successUrl;

      } catch (error) {
        hideSavingOverlay();
        showClientError(error.message || "Something went wrong. Please try again.", error.errors);
      }
    });
  }

