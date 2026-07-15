  document.addEventListener("DOMContentLoaded", function () {
    const categorySelect = document.getElementById("category");
    const productDetails = document.getElementById("productDetails");
    const productForm = document.querySelector(".product-form");
    const saveBtn = document.querySelector(".save-btn");
    const savingOverlay = document.getElementById("savingOverlay");
    const savingStatus = document.getElementById("savingStatus");
    const clientErrorBox = document.getElementById("clientErrorBox");
    let categoryCustom = null;
    let categoryCustomButton = null;
    let categoryCustomMenu = null;
    let categoryOptionButtons = [];

    const MAX_IMAGE_MB = Number(productForm?.dataset.maxImageMb || 5);
    const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
    const FETCH_TIMEOUT_MS = 120000;

    const PRODUCT_NAME_MIN_CHARS = Number(productForm?.dataset.productNameMin || 3);
    const PRODUCT_NAME_MAX_CHARS = Number(productForm?.dataset.productNameMax || 80);
    const PRODUCT_NAME_MAX_SINGLE_WORD_CHARS = Number(productForm?.dataset.productNameMaxWord || 32);

    const uploadSelector = ".catalog-upload, .arrival-upload, .top-showcase-upload, .sub-upload, .variant-upload";
    const imageTools = window.OwnerProductImageTools || null;
    const imagePreprocessor = window.OwnerProductImageCropCompress || null;

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
      return element.closest(
        ".field, .category-field, .variant-card, .highlight-row, " +
        ".size-card, .custom-measurement-row"
      );
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

      const focusElement = element === categorySelect && categoryCustomButton
        ? categoryCustomButton
        : element;
      const target = getUploadBox(element) || getFieldWrapper(focusElement) || focusElement;

      target.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      window.setTimeout(() => {
        if (focusElement && typeof focusElement.focus === "function" && focusElement.type !== "file") {
          focusElement.focus({ preventScroll: true });
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

    function getSaveConfirmSummary() {
      const productName = cleanProductNameValue(document.getElementById("productName")?.value);
      const actualPrice = String(document.getElementById("actualPrice")?.value || "").trim();
      const offerPrice = String(document.getElementById("offerPrice")?.value || "").trim();

      return {
        productName: productName || "-",
        actualPrice: actualPrice ? `₹${actualPrice}` : "-",
        offerPrice: offerPrice ? `₹${offerPrice}` : "-"
      };
    }

    function askSaveConfirmation() {
      const modal = document.getElementById("saveConfirmModal");
      const submitBtn = document.getElementById("saveConfirmSubmit");
      const cancelButtons = document.querySelectorAll("[data-save-confirm-cancel]");

      if (!modal || !submitBtn) {
        return Promise.resolve(true);
      }

      const summary = getSaveConfirmSummary();

      const nameTarget = document.getElementById("saveConfirmProductName");
      const actualTarget = document.getElementById("saveConfirmActualPrice");
      const offerTarget = document.getElementById("saveConfirmOfferPrice");

      if (nameTarget) nameTarget.textContent = summary.productName;
      if (actualTarget) actualTarget.textContent = summary.actualPrice;
      if (offerTarget) offerTarget.textContent = summary.offerPrice;

      modal.hidden = false;
      modal.classList.add("is-visible");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("owner-save-confirm-open");

      return new Promise((resolve) => {
        let isResolved = false;

        function closeModal(result) {
          if (isResolved) return;
          isResolved = true;

          modal.classList.remove("is-visible");
          modal.setAttribute("aria-hidden", "true");
          modal.hidden = true;
          document.body.classList.remove("owner-save-confirm-open");

          submitBtn.removeEventListener("click", handleSubmit);
          cancelButtons.forEach((button) => {
            button.removeEventListener("click", handleCancel);
          });
          document.removeEventListener("keydown", handleKeydown);

          resolve(result);
        }

        function handleSubmit() {
          closeModal(true);
        }

        function handleCancel() {
          closeModal(false);
        }

        function handleKeydown(event) {
          if (event.key === "Escape") {
            closeModal(false);
          }
        }

        submitBtn.addEventListener("click", handleSubmit);
        cancelButtons.forEach((button) => {
          button.addEventListener("click", handleCancel);
        });
        document.addEventListener("keydown", handleKeydown);

        window.setTimeout(() => {
          submitBtn.focus();
        }, 50);
      });
    }

    function toggleProductDetails() {
      if (!categorySelect || !productDetails) return;

      if (categorySelect.value) {
        productDetails.classList.add("is-open");
      } else {
        productDetails.classList.remove("is-open");
      }
    }



    function syncCategoryDropdownSelection() {
      if (!categorySelect || !categoryCustomButton) return;

      const selectedIndex = categorySelect.selectedIndex;
      const selectedOption = selectedIndex >= 0 ? categorySelect.options[selectedIndex] : null;
      const buttonText = categoryCustomButton.querySelector(".owner-category-button-text");

      if (buttonText) {
        buttonText.textContent = selectedOption?.textContent.trim() || "Select category";
      }

      categoryOptionButtons.forEach((optionButton) => {
        const optionIndex = Number(optionButton.dataset.optionIndex);
        const isSelected = optionIndex === selectedIndex && Boolean(selectedOption?.value);

        optionButton.classList.toggle("is-selected", isSelected);
        optionButton.setAttribute("aria-selected", String(isSelected));
      });
    }

    function closeCategoryDropdown(restoreButtonFocus) {
      if (!categoryCustomButton || !categoryCustomMenu) return;

      categoryCustomMenu.classList.remove("is-open");
      categoryCustomMenu.hidden = true;
      categoryCustomButton.setAttribute("aria-expanded", "false");

      if (restoreButtonFocus) {
        categoryCustomButton.focus({ preventScroll: true });
      }
    }

    function getEnabledCategoryButtons() {
      return categoryOptionButtons.filter((button) => !button.disabled);
    }

    function focusCategoryOption(optionButton) {
      if (!optionButton) return;

      optionButton.focus({ preventScroll: true });
      optionButton.scrollIntoView({ block: "nearest" });
    }

    function openCategoryDropdown(preferredButton) {
      if (!categoryCustomButton || !categoryCustomMenu) return;

      const enabledButtons = getEnabledCategoryButtons();
      if (!enabledButtons.length) return;

      const selectedButton = categoryOptionButtons[categorySelect?.selectedIndex];
      const focusTarget = preferredButton && !preferredButton.disabled
        ? preferredButton
        : (selectedButton && !selectedButton.disabled ? selectedButton : enabledButtons[0]);

      categoryCustomMenu.hidden = false;
      categoryCustomMenu.classList.add("is-open");
      categoryCustomButton.setAttribute("aria-expanded", "true");

      window.requestAnimationFrame(() => {
        focusCategoryOption(focusTarget);
      });
    }

    function selectCategoryOption(optionIndex) {
      if (!categorySelect) return;

      const nativeOption = categorySelect.options[optionIndex];
      if (!nativeOption || nativeOption.disabled) return;

      categorySelect.selectedIndex = optionIndex;
      syncCategoryDropdownSelection();
      categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
      closeCategoryDropdown(true);
    }

    function setupCategoryCustomDropdown() {
      if (!categorySelect) return;

      categoryCustom = document.createElement("div");
      categoryCustom.className = "owner-category-custom";

      categoryCustomButton = document.createElement("button");
      categoryCustomButton.type = "button";
      categoryCustomButton.id = "ownerCategoryButton";
      categoryCustomButton.className = "owner-category-button";
      categoryCustomButton.setAttribute("aria-haspopup", "listbox");
      categoryCustomButton.setAttribute("aria-expanded", "false");
      categoryCustomButton.setAttribute("aria-controls", "ownerCategoryMenu");
      categoryCustomButton.innerHTML = '<span class="owner-category-button-text">Select category</span>';

      categoryCustomMenu = document.createElement("div");
      categoryCustomMenu.id = "ownerCategoryMenu";
      categoryCustomMenu.className = "owner-category-menu";
      categoryCustomMenu.setAttribute("role", "listbox");
      categoryCustomMenu.setAttribute("aria-labelledby", "ownerCategoryButton");
      categoryCustomMenu.hidden = true;

      categoryOptionButtons = Array.from(categorySelect.options).map((nativeOption, optionIndex) => {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.className = "owner-category-option";
        optionButton.dataset.optionIndex = String(optionIndex);
        optionButton.setAttribute("role", "option");
        optionButton.setAttribute("aria-selected", "false");
        optionButton.textContent = nativeOption.textContent.trim();
        optionButton.disabled = nativeOption.disabled;
        optionButton.tabIndex = -1;

        optionButton.addEventListener("click", function () {
          selectCategoryOption(optionIndex);
        });

        categoryCustomMenu.appendChild(optionButton);
        return optionButton;
      });

      categoryCustom.append(categoryCustomButton, categoryCustomMenu);
      categorySelect.insertAdjacentElement("afterend", categoryCustom);
      syncCategoryDropdownSelection();

      categoryCustomButton.addEventListener("click", function () {
        if (categoryCustomMenu.classList.contains("is-open")) {
          closeCategoryDropdown(false);
        } else {
          openCategoryDropdown();
        }
      });

      categoryCustomButton.addEventListener("keydown", function (event) {
        const enabledButtons = getEnabledCategoryButtons();
        if (!enabledButtons.length) return;

        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCategoryDropdown();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          openCategoryDropdown(enabledButtons[enabledButtons.length - 1]);
        } else if (event.key === "Home") {
          event.preventDefault();
          openCategoryDropdown(enabledButtons[0]);
        } else if (event.key === "End") {
          event.preventDefault();
          openCategoryDropdown(enabledButtons[enabledButtons.length - 1]);
        }
      });

      categoryCustomMenu.addEventListener("keydown", function (event) {
        const enabledButtons = getEnabledCategoryButtons();
        const currentIndex = enabledButtons.indexOf(document.activeElement);

        if (event.key === "Escape") {
          event.preventDefault();
          closeCategoryDropdown(true);
          return;
        }

        if (event.key === "Tab") {
          closeCategoryDropdown(false);
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          const focusedOption = document.activeElement.closest?.(".owner-category-option");

          if (focusedOption) {
            event.preventDefault();
            focusedOption.click();
          }
          return;
        }

        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

        event.preventDefault();

        if (event.key === "Home") {
          focusCategoryOption(enabledButtons[0]);
        } else if (event.key === "End") {
          focusCategoryOption(enabledButtons[enabledButtons.length - 1]);
        } else {
          const direction = event.key === "ArrowDown" ? 1 : -1;
          const nextIndex = currentIndex < 0
            ? 0
            : (currentIndex + direction + enabledButtons.length) % enabledButtons.length;

          focusCategoryOption(enabledButtons[nextIndex]);
        }
      });

      document.addEventListener("click", function (event) {
        if (
          categoryCustomMenu.classList.contains("is-open")
          && !categoryCustom.contains(event.target)
        ) {
          closeCategoryDropdown(false);
        }
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && categoryCustomMenu.classList.contains("is-open")) {
          event.preventDefault();
          closeCategoryDropdown(true);
        }
      });
    }

    setupCategoryCustomDropdown();

    if (categorySelect) {
      categorySelect.addEventListener("change", function () {
        clearValidationState();
        clearClientError();
        syncCategoryDropdownSelection();
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

      return input.matches('input[data-variant-image="true"]');
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
      const variantSubImage1Id = `variantSubImage1_${variantCount}`;
      const variantSubImage2Id = `variantSubImage2_${variantCount}`;
      const variantSubImage3Id = `variantSubImage3_${variantCount}`;

      const variantColorPickerId = `variantColorCode${variantCount}`;
      const variantColorTextId = `variantColorText${variantCount}`;

      card.innerHTML = `
        <div class="variant-card__top">
          <div>
            <div class="variant-card__title">
              Variant ${variantCount}
            </div>

            <div class="variant-required-note">
              Main variant image is required. Additional images are optional.
            </div>
          </div>

          <button
            type="button"
            class="remove-variant-btn"
          >
            Remove
          </button>
        </div>

        <div class="variant-grid">
          <div class="variant-image-fields">

            <div class="field">
              <label for="${variantImageId}">
                Main Variant Image *
              </label>

              <label
                class="variant-upload"
                for="${variantImageId}"
              >
                <input
                  type="file"
                  id="${variantImageId}"
                  name="variant_images"
                  accept="image/*"
                  data-variant-image="true"
                  data-variant-image-type="main"
                >

                <span>+</span>
                <small>Upload main image</small>
              </label>

              <div class="upload-limit-note">
                Required. Max ${MAX_IMAGE_MB}MB.
              </div>
            </div>

            <div class="field">
              <label for="${variantSubImage1Id}">
                Variant Sub Image 1
              </label>

              <label
                class="variant-upload"
                for="${variantSubImage1Id}"
              >
                <input
                  type="file"
                  id="${variantSubImage1Id}"
                  name="variant_sub_images_1"
                  accept="image/*"
                  data-variant-image="true"
                  data-variant-image-type="sub-1"
                >

                <span>+</span>
                <small>Upload sub image 1</small>
              </label>

              <div class="upload-limit-note">
                Optional. Max ${MAX_IMAGE_MB}MB.
              </div>
            </div>

            <div class="field">
              <label for="${variantSubImage2Id}">
                Variant Sub Image 2
              </label>

              <label
                class="variant-upload"
                for="${variantSubImage2Id}"
              >
                <input
                  type="file"
                  id="${variantSubImage2Id}"
                  name="variant_sub_images_2"
                  accept="image/*"
                  data-variant-image="true"
                  data-variant-image-type="sub-2"
                >

                <span>+</span>
                <small>Upload sub image 2</small>
              </label>

              <div class="upload-limit-note">
                Optional. Upload after Sub Image 1.
              </div>
            </div>

            <div class="field">
              <label for="${variantSubImage3Id}">
                Variant Sub Image 3
              </label>

              <label
                class="variant-upload"
                for="${variantSubImage3Id}"
              >
                <input
                  type="file"
                  id="${variantSubImage3Id}"
                  name="variant_sub_images_3"
                  accept="image/*"
                  data-variant-image="true"
                  data-variant-image-type="sub-3"
                >

                <span>+</span>
                <small>Upload sub image 3</small>
              </label>

              <div class="upload-limit-note">
                Optional. Upload after Sub Image 2.
              </div>
            </div>
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
              <input
                type="checkbox"
                name="variant_is_available"
                value="${variantCount}"
                checked
              >

              <span>Variant Available</span>
            </label>
          </div>
        </div>
      `;

      variantsList.appendChild(card);

      setupImagePreview(variantImageId);
      setupImagePreview(variantSubImage1Id);
      setupImagePreview(variantSubImage2Id);
      setupImagePreview(variantSubImage3Id);

      setupAllPriceInputs(card);

      const variantColorPicker =
        document.getElementById(variantColorPickerId);

      const variantColorText =
        document.getElementById(variantColorTextId);

      syncColorInputs(
        variantColorText,
        variantColorPicker
      );

      const removeBtn =
        card.querySelector(".remove-variant-btn");

      if (removeBtn) {
        removeBtn.addEventListener("click", function () {
          card.remove();
          refreshVariantTitles();
        });
      }

      refreshVariantTitles();

      card.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
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

    const addSizeBtn = document.getElementById("addSizeBtn");
    const addSizeBtnBottom = document.getElementById("addSizeBtnBottom");
    const sizesList = document.getElementById("sizesList");
    const sizesEmptyState = document.getElementById("sizesEmptyState");
    const sizeCardTemplate = document.getElementById("productSizeCardTemplate");
    const customMeasurementTemplate = document.getElementById("sizeCustomMeasurementTemplate");
    const defaultStockInput = document.getElementById("stockQuantity");

    let sizeCounter = 0;
    let measurementCounter = 0;
    let fallbackStockValue = String(defaultStockInput?.value || "1");

    function createStableKey(prefix, counter) {
      return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
    }

    function replaceTemplateTokens(templateHtml, replacements) {
      let output = templateHtml;

      Object.entries(replacements).forEach(([token, value]) => {
        output = output.split(token).join(String(value));
      });

      return output;
    }

    function parseMeasurementValue(input) {
      if (!input) return null;

      const raw = String(input.value || "").trim();
      if (!raw) return null;

      const value = Number(raw);
      return Number.isFinite(value) ? value : NaN;
    }

    function getSizeCards() {
      if (!sizesList) return [];
      return Array.from(sizesList.querySelectorAll("[data-size-card]"));
    }

    function updateSizesEmptyState() {
      const hasSizes = getSizeCards().length > 0;

      if (sizesEmptyState) {
        sizesEmptyState.hidden = hasSizes;
      }

      if (addSizeBtnBottom) {
        addSizeBtnBottom.hidden = !hasSizes;
      }
    }

    function syncProductStockFromSizes() {
      if (!defaultStockInput) return;

      const cards = getSizeCards();

      if (!cards.length) {
        defaultStockInput.readOnly = false;
        defaultStockInput.removeAttribute("aria-readonly");
        defaultStockInput.value = fallbackStockValue || "0";
        return;
      }

      const totalStock = cards.reduce((total, card) => {
        const stockInput = card.querySelector("[data-size-stock]");
        const stock = Number(String(stockInput?.value || "0").trim());

        if (!Number.isInteger(stock) || stock < 0) {
          return total;
        }

        return total + stock;
      }, 0);

      defaultStockInput.value = String(totalStock);
      defaultStockInput.readOnly = true;
      defaultStockInput.setAttribute("aria-readonly", "true");
    }

    function refreshSizeCards() {
      const cards = getSizeCards();

      cards.forEach((card, index) => {
        const title = card.querySelector(".size-card__title");
        const removeButton = card.querySelector("[data-remove-size]");

        if (title) {
          title.textContent = `Size ${index + 1}`;
        }

        if (removeButton) {
          removeButton.setAttribute(
            "aria-label",
            `Remove size ${index + 1}`
          );
        }
      });

      updateSizesEmptyState();
      syncProductStockFromSizes();
    }

    function syncSizeCustomMeasurementUnits(card) {
      if (!card) return;

      const sizeUnit = card.querySelector("[data-size-unit]")?.value || "in";

      card
        .querySelectorAll('select[name="size_measurement_units_custom"]')
        .forEach((unitSelect) => {
          unitSelect.value = sizeUnit;
        });
    }

    function createCustomMeasurementRow(card, values = {}) {
      if (!card || !customMeasurementTemplate) return null;

      const list = card.querySelector("[data-custom-measurements-list]");
      const sizeKey = String(card.dataset.sizeKey || "").trim();

      if (!list || !sizeKey) return null;

      measurementCounter += 1;
      const measurementKey = createStableKey(
        "measurement",
        measurementCounter
      );

      const wrapper = document.createElement("div");
      wrapper.innerHTML = replaceTemplateTokens(
        customMeasurementTemplate.innerHTML.trim(),
        {
          "__SIZE_KEY__": sizeKey,
          "__MEASUREMENT_KEY__": measurementKey
        }
      );

      const row = wrapper.firstElementChild;
      if (!row) return null;

      const labelInput = row.querySelector(
        'input[name="size_measurement_labels"]'
      );
      const valueInput = row.querySelector(
        'input[name="size_measurement_values"]'
      );
      const unitSelect = row.querySelector(
        'select[name="size_measurement_units_custom"]'
      );

      if (labelInput) {
        labelInput.value = values.label || "";
      }

      if (valueInput) {
        valueInput.value = values.value ?? "";
      }

      if (unitSelect) {
        unitSelect.value = (
          values.unit
          || card.querySelector("[data-size-unit]")?.value
          || "in"
        );
      }

      list.appendChild(row);

      row.querySelector("[data-remove-custom-measurement]")
        ?.addEventListener("click", function () {
          row.remove();
          productForm?.dispatchEvent(
            new Event("input", { bubbles: true })
          );
        });

      productForm?.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      if (!values.preventFocus) {
        window.setTimeout(() => {
          labelInput?.focus({ preventScroll: true });
        }, 50);
      }

      return row;
    }

    function createSizeCard(values = {}) {
      if (!sizesList || !sizeCardTemplate) return null;

      if (getSizeCards().length === 0 && defaultStockInput) {
        fallbackStockValue = String(defaultStockInput.value || "0");
      }

      sizeCounter += 1;
      const sizeKey = (
        values.key
        || createStableKey("size", sizeCounter)
      );

      const wrapper = document.createElement("div");
      wrapper.innerHTML = replaceTemplateTokens(
        sizeCardTemplate.innerHTML.trim(),
        {
          "__SIZE_KEY__": sizeKey,
          "__SIZE_NUMBER__": getSizeCards().length + 1
        }
      );

      const card = wrapper.firstElementChild;
      if (!card) return null;

      card.dataset.sizeKey = sizeKey;

      const sizeNameInput = card.querySelector("[data-size-name]");
      const stockInput = card.querySelector("[data-size-stock]");
      const unitSelect = card.querySelector("[data-size-unit]");
      const availableInput = card.querySelector("[data-size-available]");
      const chestInput = card.querySelector('input[name="size_chests"]');
      const waistInput = card.querySelector('input[name="size_waists"]');
      const lengthInput = card.querySelector('input[name="size_lengths"]');

      if (sizeNameInput) sizeNameInput.value = values.sizeName || "";
      if (stockInput) stockInput.value = values.stockQuantity ?? "0";
      if (unitSelect) unitSelect.value = values.measurementUnit || "in";
      if (availableInput) availableInput.checked = values.isAvailable !== false;
      if (chestInput) chestInput.value = values.chest ?? "";
      if (waistInput) waistInput.value = values.waist ?? "";
      if (lengthInput) lengthInput.value = values.length ?? "";

      sizesList.appendChild(card);

      card.querySelector("[data-remove-size]")
        ?.addEventListener("click", function () {
          card.remove();
          refreshSizeCards();
          productForm?.dispatchEvent(
            new Event("input", { bubbles: true })
          );
        });

      card.querySelector("[data-add-custom-measurement]")
        ?.addEventListener("click", function () {
          createCustomMeasurementRow(card);
        });

      unitSelect?.addEventListener("change", function () {
        syncSizeCustomMeasurementUnits(card);
      });

      stockInput?.addEventListener("input", function () {
        // Stock controls sold-out status.
        // The availability checkbox controls whether this size is shown on the product page.
        // Do not auto-hide a size just because its stock is 0; it should remain visible as Sold Out.
        syncProductStockFromSizes();
      });

      (values.customMeasurements || []).forEach((measurement) => {
        createCustomMeasurementRow(card, {
          ...measurement,
          preventFocus: Boolean(values.preventScroll)
        });
      });

      refreshSizeCards();
      productForm?.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      if (!values.preventScroll) {
        card.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

        window.setTimeout(() => {
          sizeNameInput?.focus({ preventScroll: true });
        }, 80);
      }

      return card;
    }

    function handleAddSize() {
      createSizeCard();
    }

    addSizeBtn?.addEventListener("click", handleAddSize);
    addSizeBtnBottom?.addEventListener("click", handleAddSize);

    updateSizesEmptyState();

    function collectSizeCardsState() {
      return getSizeCards().map((card) => ({
        key: card.dataset.sizeKey || "",
        sizeName: card.querySelector("[data-size-name]")?.value || "",
        stockQuantity: card.querySelector("[data-size-stock]")?.value || "0",
        measurementUnit: card.querySelector("[data-size-unit]")?.value || "in",
        chest: card.querySelector('input[name="size_chests"]')?.value || "",
        waist: card.querySelector('input[name="size_waists"]')?.value || "",
        length: card.querySelector('input[name="size_lengths"]')?.value || "",
        isAvailable: Boolean(
          card.querySelector("[data-size-available]")?.checked
        ),
        customMeasurements: Array.from(
          card.querySelectorAll("[data-custom-measurement-row]")
        ).map((row) => ({
          label: row.querySelector(
            'input[name="size_measurement_labels"]'
          )?.value || "",
          value: row.querySelector(
            'input[name="size_measurement_values"]'
          )?.value || "",
          unit: row.querySelector(
            'select[name="size_measurement_units_custom"]'
          )?.value || "in"
        }))
      }));
    }

    function restoreSizeCards(sizeCards = []) {
      if (!sizesList || !Array.isArray(sizeCards)) return;

      sizesList.innerHTML = "";

      sizeCards.forEach((sizeData) => {
        createSizeCard({
          ...sizeData,
          preventScroll: true
        });
      });

      refreshSizeCards();
    }

    window.OwnerProductSizeCards = {
      createSizeCard,
      createCustomMeasurementRow,
      collectState: collectSizeCardsState,
      restoreState: restoreSizeCards,
      refresh: refreshSizeCards
    };

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

    function validateSizes(errors) {
      const cards = getSizeCards();
      const usedSizeNames = new Set();

      cards.forEach((card, index) => {
        const sizeNumber = index + 1;
        const sizeNameInput = card.querySelector("[data-size-name]");
        const stockInput = card.querySelector("[data-size-stock]");
        const unitSelect = card.querySelector("[data-size-unit]");
        const chestInput = card.querySelector('input[name="size_chests"]');
        const waistInput = card.querySelector('input[name="size_waists"]');
        const lengthInput = card.querySelector('input[name="size_lengths"]');

        const sizeName = String(sizeNameInput?.value || "")
          .trim()
          .replace(/\s+/g, " ");

        if (sizeNameInput) {
          sizeNameInput.value = sizeName;
        }

        if (!sizeName) {
          addError(
            errors,
            sizeNameInput,
            `Size ${sizeNumber}: size name is required.`
          );
        } else if (sizeName.length > 40) {
          addError(
            errors,
            sizeNameInput,
            `Size ${sizeNumber}: size name should be under 40 characters.`
          );
        } else {
          const normalizedSizeName = sizeName.toLocaleLowerCase();

          if (usedSizeNames.has(normalizedSizeName)) {
            addError(
              errors,
              sizeNameInput,
              `Size ${sizeNumber}: duplicate size name "${sizeName}".`
            );
          }

          usedSizeNames.add(normalizedSizeName);
        }

        const rawStock = String(stockInput?.value || "").trim();
        const stock = rawStock === "" ? null : Number(rawStock);

        if (stock === null || !Number.isFinite(stock)) {
          addError(
            errors,
            stockInput,
            `Size ${sizeNumber}: available pieces are required.`
          );
        } else if (stock < 0) {
          addError(
            errors,
            stockInput,
            `Size ${sizeNumber}: available pieces cannot be negative.`
          );
        } else if (!Number.isInteger(stock)) {
          addError(
            errors,
            stockInput,
            `Size ${sizeNumber}: available pieces should be a whole number.`
          );
        }

        if (!["in", "cm"].includes(String(unitSelect?.value || ""))) {
          addError(
            errors,
            unitSelect,
            `Size ${sizeNumber}: select a valid measurement unit.`
          );
        }

        [
          { input: chestInput, label: "chest" },
          { input: waistInput, label: "waist" },
          { input: lengthInput, label: "length" }
        ].forEach(({ input, label }) => {
          const value = parseMeasurementValue(input);

          if (value === null) return;

          if (Number.isNaN(value)) {
            addError(
              errors,
              input,
              `Size ${sizeNumber}: ${label} should be a valid number.`
            );
          } else if (value <= 0) {
            addError(
              errors,
              input,
              `Size ${sizeNumber}: ${label} should be greater than 0.`
            );
          } else if (value > 99999.99) {
            addError(
              errors,
              input,
              `Size ${sizeNumber}: ${label} value is too large.`
            );
          }
        });

        const usedMeasurementLabels = new Set();
        const measurementRows = Array.from(
          card.querySelectorAll("[data-custom-measurement-row]")
        );

        measurementRows.forEach((row, measurementIndex) => {
          const measurementNumber = measurementIndex + 1;
          const labelInput = row.querySelector(
            'input[name="size_measurement_labels"]'
          );
          const valueInput = row.querySelector(
            'input[name="size_measurement_values"]'
          );
          const customUnitSelect = row.querySelector(
            'select[name="size_measurement_units_custom"]'
          );

          const label = String(labelInput?.value || "")
            .trim()
            .replace(/\s+/g, " ");
          const value = parseMeasurementValue(valueInput);

          if (labelInput) {
            labelInput.value = label;
          }

          if (!label) {
            addError(
              errors,
              labelInput,
              `Size ${sizeNumber}, custom measurement ${measurementNumber}: name is required.`
            );
          } else if (label.length > 60) {
            addError(
              errors,
              labelInput,
              `Size ${sizeNumber}, custom measurement ${measurementNumber}: name should be under 60 characters.`
            );
          } else {
            const normalizedLabel = label.toLocaleLowerCase();

            if (usedMeasurementLabels.has(normalizedLabel)) {
              addError(
                errors,
                labelInput,
                `Size ${sizeNumber}: duplicate custom measurement "${label}".`
              );
            }

            usedMeasurementLabels.add(normalizedLabel);
          }

          if (value === null || Number.isNaN(value)) {
            addError(
              errors,
              valueInput,
              `Size ${sizeNumber}, custom measurement ${measurementNumber}: enter a valid value.`
            );
          } else if (value <= 0) {
            addError(
              errors,
              valueInput,
              `Size ${sizeNumber}, custom measurement ${measurementNumber}: value should be greater than 0.`
            );
          } else if (value > 99999.99) {
            addError(
              errors,
              valueInput,
              `Size ${sizeNumber}, custom measurement ${measurementNumber}: value is too large.`
            );
          }

          if (!["in", "cm"].includes(String(customUnitSelect?.value || ""))) {
            addError(
              errors,
              customUnitSelect,
              `Size ${sizeNumber}, custom measurement ${measurementNumber}: select a valid unit.`
            );
          }
        });
      });

      syncProductStockFromSizes();
    }

    async function validateVariants(errors) {
      if (!variantsList) return;

      const cards = Array.from(
        variantsList.querySelectorAll(".variant-card")
      );

      for (const [index, card] of cards.entries()) {
        const variantNumber = index + 1;

        const imageInput = card.querySelector(
          'input[name="variant_images"]'
        );

        const subImage1Input = card.querySelector(
          'input[name="variant_sub_images_1"]'
        );

        const subImage2Input = card.querySelector(
          'input[name="variant_sub_images_2"]'
        );

        const subImage3Input = card.querySelector(
          'input[name="variant_sub_images_3"]'
        );

        const colorNameInput = card.querySelector(
          'input[name="variant_color_names"]'
        );

        const colorCodeInput = card.querySelector(
          'input[name="variant_color_codes"]'
        );

        const actualPriceInput = card.querySelector(
          'input[name="variant_actual_prices"]'
        );

        const offerPriceInput = card.querySelector(
          'input[name="variant_offer_prices"]'
        );

        const imageFile = await getSelectedFileFromInput(
          imageInput
        );

        const subImage1 = await getSelectedFileFromInput(
          subImage1Input
        );

        const subImage2 = await getSelectedFileFromInput(
          subImage2Input
        );

        const subImage3 = await getSelectedFileFromInput(
          subImage3Input
        );

        const colorName = String(
          colorNameInput?.value || ""
        ).trim();

        const colorCode = String(
          colorCodeInput?.value || ""
        ).trim();

        if (!imageFile) {
          addError(
            errors,
            imageInput,
            `Variant ${variantNumber}: main image is required.`
          );
        } else {
          try {
            validateImageFile(
              imageFile,
              `Variant ${variantNumber} main image`
            );
          } catch (error) {
            addError(
              errors,
              imageInput,
              error.message
            );
          }
        }

        const optionalImages = [
          {
            input: subImage1Input,
            file: subImage1,
            label: `Variant ${variantNumber} sub image 1`
          },
          {
            input: subImage2Input,
            file: subImage2,
            label: `Variant ${variantNumber} sub image 2`
          },
          {
            input: subImage3Input,
            file: subImage3,
            label: `Variant ${variantNumber} sub image 3`
          }
        ];

        optionalImages.forEach((imageItem) => {
          if (!imageItem.file) return;

          try {
            validateImageFile(
              imageItem.file,
              imageItem.label
            );
          } catch (error) {
            addError(
              errors,
              imageItem.input,
              error.message
            );
          }
        });

        if (subImage2 && !subImage1) {
          addError(
            errors,
            subImage2Input,
            `Variant ${variantNumber}: upload Sub Image 1 before Sub Image 2.`
          );
        }

        if (subImage3 && !subImage2) {
          addError(
            errors,
            subImage3Input,
            `Variant ${variantNumber}: upload Sub Image 2 before Sub Image 3.`
          );
        }

        if (!colorName) {
          addError(
            errors,
            colorNameInput,
            `Variant ${variantNumber}: color name is required.`
          );
        } else if (colorName.length > 80) {
          addError(
            errors,
            colorNameInput,
            `Variant ${variantNumber}: color name should be under 80 characters.`
          );
        }

        if (!isValidHexColor(colorCode)) {
          addError(
            errors,
            colorCodeInput,
            `Variant ${variantNumber}: enter a valid color code like #2f6b45.`
          );
        }

        const actual = numberValue(actualPriceInput);
        const offer = numberValue(offerPriceInput);

        if (actual !== null) {
          if (Number.isNaN(actual)) {
            addError(
              errors,
              actualPriceInput,
              `Variant ${variantNumber}: actual price should be a valid number.`
            );
          } else if (actual < 0) {
            addError(
              errors,
              actualPriceInput,
              `Variant ${variantNumber}: actual price cannot be negative.`
            );
          }
        }

        if (offer !== null) {
          if (Number.isNaN(offer)) {
            addError(
              errors,
              offerPriceInput,
              `Variant ${variantNumber}: offer price should be a valid number.`
            );
          } else if (offer < 0) {
            addError(
              errors,
              offerPriceInput,
              `Variant ${variantNumber}: offer price cannot be negative.`
            );
          } else if (
            actual !== null
            && !Number.isNaN(actual)
            && offer > actual
          ) {
            addError(
              errors,
              offerPriceInput,
              `Variant ${variantNumber}: offer price cannot be greater than actual price.`
            );
          }
        }
      }
    }

    async function validateFormOrThrow() {
      const errors = [];

      clearValidationState();

      await validateBaseProduct(errors);
      await validateOptionalSequentialImages(errors);
      validateSizes(errors);
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

      const cards = Array.from(
        variantsList.querySelectorAll(".variant-card")
      );

      const output = [];

      for (const [index, card] of cards.entries()) {
        const imageInput = card.querySelector(
          'input[name="variant_images"]'
        );

        const subImage1Input = card.querySelector(
          'input[name="variant_sub_images_1"]'
        );

        const subImage2Input = card.querySelector(
          'input[name="variant_sub_images_2"]'
        );

        const subImage3Input = card.querySelector(
          'input[name="variant_sub_images_3"]'
        );

        const colorNameInput = card.querySelector(
          'input[name="variant_color_names"]'
        );

        const colorCodeInput = card.querySelector(
          'input[name="variant_color_codes"]'
        );

        const actualPriceInput = card.querySelector(
          'input[name="variant_actual_prices"]'
        );

        const offerPriceInput = card.querySelector(
          'input[name="variant_offer_prices"]'
        );

        const availableInput = card.querySelector(
          'input[name="variant_is_available"]'
        );

        cleanPriceInput(actualPriceInput);
        cleanPriceInput(offerPriceInput);

        output.push({
          index,
          label: `Variant ${index + 1}`,

          file: await getSelectedFileFromInput(
            imageInput
          ),

          subImage1: await getSelectedFileFromInput(
            subImage1Input
          ),

          subImage2: await getSelectedFileFromInput(
            subImage2Input
          ),

          subImage3: await getSelectedFileFromInput(
            subImage3Input
          ),

          colorName: String(
            colorNameInput?.value || ""
          ).trim(),

          colorCode: String(
            colorCodeInput?.value || ""
          ).trim(),

          actualPrice: String(
            actualPriceInput?.value || ""
          ).trim(),

          offerPrice: String(
            offerPriceInput?.value || ""
          ).trim(),

          isAvailable:
            availableInput && availableInput.checked
              ? "1"
              : "0"
        });
      }

      return output;
    }

    async function buildProductCreateFormData() {
      syncProductStockFromSizes();

      const formData = new FormData(productForm);

      sequentialImageInputs.forEach((item) => {
        formData.delete(item.fieldName);
      });

      formData.delete("variant_images");
      formData.delete("variant_sub_images_1");
      formData.delete("variant_sub_images_2");
      formData.delete("variant_sub_images_3");
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

    async function uploadSingleVariant(
      productId,
      variantItem,
      index,
      total
    ) {
      const uploadUrlTemplate =
        productForm.dataset.variantUploadUrlTemplate;

      if (!uploadUrlTemplate) {
        throw new Error(
          "Variant upload URL is missing. Please check product form template."
        );
      }

      const uploadUrl = uploadUrlTemplate.replace(
        "/0/",
        `/${productId}/`
      );

      const formData = new FormData();

      const csrfToken =
        document.querySelector(
          "[name=csrfmiddlewaretoken]"
        )?.value || "";

      formData.append(
        "csrfmiddlewaretoken",
        csrfToken
      );

      formData.append(
        "image",
        variantItem.file
      );

      if (variantItem.subImage1) {
        formData.append(
          "sub_image_1",
          variantItem.subImage1
        );
      }

      if (variantItem.subImage2) {
        formData.append(
          "sub_image_2",
          variantItem.subImage2
        );
      }

      if (variantItem.subImage3) {
        formData.append(
          "sub_image_3",
          variantItem.subImage3
        );
      }

      formData.append(
        "color_name",
        variantItem.colorName
      );

      formData.append(
        "color_code",
        variantItem.colorCode
      );

      formData.append(
        "actual_price",
        variantItem.actualPrice
      );

      formData.append(
        "offer_price",
        variantItem.offerPrice
      );

      formData.append(
        "is_available",
        variantItem.isAvailable
      );

      setSavingStatus(
        `Uploading ${variantItem.label} (${index + 1}/${total})...`
      );

      const response = await fetchWithTimeout(
        uploadUrl,
        {
          method: "POST",
          body: formData,
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          }
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch (error) {
        throw new Error(
          `${variantItem.label} upload failed. Server returned an invalid response.`
        );
      }

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message
          || `${variantItem.label} upload failed.`
        );
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
          await imagePreprocessor?.whenIdle?.();
          cleanAllPriceInputs();
          await validateFormOrThrow();

          const canSaveProduct = await askSaveConfirmation();

          if (!canSaveProduct) {
            return;
          }

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



