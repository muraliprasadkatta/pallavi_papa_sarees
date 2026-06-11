(function () {
  "use strict";

  const DEFAULT_UPLOAD_SELECTOR =
    ".catalog-upload, .arrival-upload, .top-showcase-upload, .sub-upload, .variant-upload";

  let activeColorPick = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getUploadBox(input, uploadSelector = DEFAULT_UPLOAD_SELECTOR) {
    if (!input) return null;
    return input.closest(uploadSelector);
  }

  function isVariantImageInput(input) {
    if (!input) return false;
    return input.matches('input[name="variant_images"], input[data-variant-image="true"]');
  }

  function validateImageFile(file, label = "Selected image", maxImageMb = 5) {
    if (!file) return;

    const maxImageBytes = maxImageMb * 1024 * 1024;

    if (!file.type || !file.type.startsWith("image/")) {
      throw new Error(`${label} should be a valid image file.`);
    }

    if (file.size > maxImageBytes) {
      throw new Error(`${label} should be under ${maxImageMb}MB.`);
    }
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

  function rgbToHex(r, g, b) {
    return `#${[r, g, b]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function ensureImageZoomModal() {
    let modal = document.getElementById("ownerImageZoomModal");

    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "ownerImageZoomModal";
    modal.className = "owner-image-zoom";
    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;

    modal.innerHTML = `
      <button type="button" class="owner-image-zoom__close" aria-label="Close image preview">&times;</button>
      <div class="owner-image-zoom__frame">
        <img class="owner-image-zoom__img" alt="Image preview">
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector(".owner-image-zoom__close");

    if (closeBtn) {
      closeBtn.addEventListener("click", closeImageZoom);
    }

    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        closeImageZoom();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeImageZoom();
        stopActiveColorPickMode();
      }
    });

    return modal;
  }

  function openImageZoom(image) {
    if (!image || !image.src) return;

    const modal = ensureImageZoomModal();
    const modalImg = modal.querySelector(".owner-image-zoom__img");

    if (!modalImg) return;

    modalImg.src = image.src;
    modalImg.alt = image.alt || "Image preview";

    modal.hidden = false;
    modal.classList.add("is-visible");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("owner-image-zoom-open");
  }

  function closeImageZoom() {
    const modal = document.getElementById("ownerImageZoomModal");
    if (!modal) return;

    const modalImg = modal.querySelector(".owner-image-zoom__img");

    modal.classList.remove("is-visible");
    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;
    document.body.classList.remove("owner-image-zoom-open");

    if (modalImg) {
      modalImg.removeAttribute("src");
    }
  }

  function ensureUploadPreviewControls(input, box, options = {}) {
    if (!input || !box) return;

    const colorButtonText = options.colorButtonText || (
      isVariantImageInput(input) ? "Pick variant color" : "Pick product color"
    );

    let controls = box.querySelector(".upload-preview-actions");

    if (!controls) {
      controls = document.createElement("div");
      controls.className = "upload-preview-actions";
      box.appendChild(controls);
    }

    let colorBtn = controls.querySelector(".upload-color-pick-btn");

    if (!colorBtn) {
      colorBtn = document.createElement("button");
      colorBtn.type = "button";
      colorBtn.className = "upload-color-pick-btn";
      controls.appendChild(colorBtn);
    }

    colorBtn.textContent = colorButtonText;

    if (colorBtn.dataset.bound !== "1") {
      colorBtn.dataset.bound = "1";

      colorBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        startImageColorPickFromInput(input, options);
      });
    }

    let removeBtn = controls.querySelector(".upload-remove-btn");

    if (!removeBtn) {
      removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "upload-remove-btn";
      removeBtn.setAttribute("aria-label", "Remove selected image");
      removeBtn.innerHTML = "&times;";
      controls.appendChild(removeBtn);
    }

    if (removeBtn.dataset.bound !== "1") {
      removeBtn.dataset.bound = "1";

      removeBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        clearUploadPreview(input, options);
        input.value = "";
        input.dataset.explicitRemove = "1";

        input.dispatchEvent(new Event("change", { bubbles: true }));

        if (typeof options.onRemove === "function") {
          options.onRemove(input);
        }
      });
    }
  }

  function renderUploadPreviewFromFile(input, file, options = {}) {
    if (!input || !file) return;

    const box = getUploadBox(input, options.uploadSelector);
    if (!box) return;

    const previewUrl = URL.createObjectURL(file);
    renderUploadPreviewFromUrl(input, previewUrl, file.name || "Selected image", {
      ...options,
      revokeUrlOnLoad: true
    });
  }

  function renderUploadPreviewFromUrl(input, imageUrl, label = "Selected image", options = {}) {
    if (!input || !imageUrl) return;

    const box = getUploadBox(input, options.uploadSelector);
    if (!box) return;

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

    if (options.revokeUrlOnLoad) {
      previewImg.onload = function () {
        URL.revokeObjectURL(imageUrl);
      };
    } else {
      previewImg.onload = null;
    }

    previewImg.src = imageUrl;
    fileName.textContent = label;

    box.classList.add("has-preview");
    box.classList.remove("is-invalid-upload");

    ensureUploadPreviewControls(input, box, options);

    if (typeof options.onPreviewRendered === "function") {
      options.onPreviewRendered(input, box);
    }
  }

  function clearUploadPreview(input, options = {}) {
    if (!input) return;

    const box = getUploadBox(input, options.uploadSelector);
    if (!box) return;

    const previewImg = box.querySelector(".upload-preview-img");
    const fileName = box.querySelector(".upload-preview-layer");
    const controls = box.querySelector(".upload-preview-actions");

    if (previewImg) previewImg.remove();
    if (fileName) fileName.remove();
    if (controls) controls.remove();

    box.classList.remove("has-preview");
    box.classList.remove("is-color-pick-mode");

    delete box.dataset.draftFileKey;

    if (activeColorPick?.input === input) {
      stopActiveColorPickMode();
    }
  }

  function getImagePixelPosition(event, image) {
    const rect = image.getBoundingClientRect();

    const clientX = event.clientX;
    const clientY = event.clientY;

    const style = window.getComputedStyle(image);
    const objectFit = style.objectFit || "fill";

    let drawnWidth = rect.width;
    let drawnHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    const naturalRatio = image.naturalWidth / image.naturalHeight;
    const boxRatio = rect.width / rect.height;

    if (objectFit === "cover") {
      if (naturalRatio > boxRatio) {
        drawnHeight = rect.height;
        drawnWidth = rect.height * naturalRatio;
        offsetX = (rect.width - drawnWidth) / 2;
      } else {
        drawnWidth = rect.width;
        drawnHeight = rect.width / naturalRatio;
        offsetY = (rect.height - drawnHeight) / 2;
      }
    }

    if (objectFit === "contain") {
      if (naturalRatio > boxRatio) {
        drawnWidth = rect.width;
        drawnHeight = rect.width / naturalRatio;
        offsetY = (rect.height - drawnHeight) / 2;
      } else {
        drawnHeight = rect.height;
        drawnWidth = rect.height * naturalRatio;
        offsetX = (rect.width - drawnWidth) / 2;
      }
    }

    const displayX = clientX - rect.left - offsetX;
    const displayY = clientY - rect.top - offsetY;

    const x = Math.max(
      0,
      Math.min(image.naturalWidth - 1, Math.round((displayX / drawnWidth) * image.naturalWidth))
    );

    const y = Math.max(
      0,
      Math.min(image.naturalHeight - 1, Math.round((displayY / drawnHeight) * image.naturalHeight))
    );

    return { x, y };
  }

  function pickColorFromPreviewImage(event, image, textInput, pickerInput) {
    if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) {
      throw new Error("Image preview is not ready yet. Please try again.");
    }

    const { x, y } = getImagePixelPosition(event, image);

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pixel = context.getImageData(x, y, 1, 1).data;
    const hexValue = rgbToHex(pixel[0], pixel[1], pixel[2]);

    setPickedColor(hexValue, textInput, pickerInput);

    return hexValue;
  }

  function setPickedColor(hexValue, textInput, pickerInput) {
    if (!hexValue || !textInput || !pickerInput) return;

    textInput.value = hexValue;
    pickerInput.value = hexValue;

    textInput.dispatchEvent(new Event("input", { bubbles: true }));
    textInput.dispatchEvent(new Event("change", { bubbles: true }));
    pickerInput.dispatchEvent(new Event("input", { bubbles: true }));
    pickerInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getColorTargetForImageInput(input, options = {}) {
    if (typeof options.getColorTargetForImageInput === "function") {
      const customTarget = options.getColorTargetForImageInput(input);
      if (customTarget) return customTarget;
    }

    if (isVariantImageInput(input)) {
      const card = input.closest(".variant-card");
      const textInput = card?.querySelector('input[name="variant_color_codes"]') || null;
      const pickerInput = card?.querySelector('.color-row input[type="color"]') || null;

      return {
        textInput,
        pickerInput,
        label: "variant color",
        statusMessage: "Tap on this variant image to pick the variant color."
      };
    }

    return {
      textInput: document.getElementById("colorCodeText"),
      pickerInput: document.getElementById("colorCode"),
      label: "product color",
      statusMessage: "Tap on the highlighted image to pick the product color."
    };
  }

  function startImageColorPickFromInput(input, options = {}) {
    if (!input) return;

    const box = getUploadBox(input, options.uploadSelector);
    const previewImage = box?.querySelector(".upload-preview-img");

    if (!box || !previewImage) {
      if (typeof options.onError === "function") {
        options.onError("Please upload an image first, then pick color from it.", input);
      } else {
        alert("Please upload an image first, then pick color from it.");
      }
      return;
    }

    const target = getColorTargetForImageInput(input, options);

    if (!target.textInput || !target.pickerInput) {
      if (typeof options.onError === "function") {
        options.onError("Color input was not found for this image.", input);
      } else {
        alert("Color input was not found for this image.");
      }
      return;
    }

    stopActiveColorPickMode();

    activeColorPick = {
      input,
      box,
      textInput: target.textInput,
      pickerInput: target.pickerInput,
      label: target.label
    };

    box.classList.add("is-color-pick-mode");

    if (typeof options.onStatus === "function") {
      options.onStatus(target.statusMessage || "Tap on the highlighted image to pick color.");
    }

    box.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function stopActiveColorPickMode(message = "", options = {}) {
    if (activeColorPick?.box) {
      activeColorPick.box.classList.remove("is-color-pick-mode");
    }

    activeColorPick = null;

    if (message && typeof options.onStatus === "function") {
      options.onStatus(message);
    }
  }

  function handleImageColorPickClick(event, image, input, options = {}) {
    if (!activeColorPick) return false;

    if (activeColorPick.input !== input) {
      if (typeof options.onStatus === "function") {
        options.onStatus("Color pick mode is active. Please tap the highlighted image only.");
      }
      return true;
    }

    try {
      const pickedColor = pickColorFromPreviewImage(
        event,
        image,
        activeColorPick.textInput,
        activeColorPick.pickerInput
      );

      const label = activeColorPick.label || "color";
      stopActiveColorPickMode();

      if (typeof options.onStatus === "function") {
        options.onStatus(`Selected ${pickedColor} for ${label}.`);
      }

      if (typeof options.onColorPicked === "function") {
        options.onColorPicked(pickedColor, input);
      }
    } catch (error) {
      if (typeof options.onError === "function") {
        options.onError(error.message || "Could not pick color from image.", input);
      } else {
        alert(error.message || "Could not pick color from image.");
      }
    }

    return true;
  }

  function setupImagePreview(input, options = {}) {
    if (!input) return;

    const box = getUploadBox(input, options.uploadSelector);
    if (!box) return;

    box.addEventListener(
      "click",
      function (event) {
        if (!box.classList.contains("has-preview")) return;

        const removeButton = event.target.closest(".upload-remove-btn");
        const colorButton = event.target.closest(".upload-color-pick-btn");

        if (removeButton || colorButton) {
          event.preventDefault();
          event.stopPropagation();

          if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
          }

          if (removeButton) {
            clearUploadPreview(input, options);
            input.value = "";
            input.dataset.explicitRemove = "1";
            input.dispatchEvent(new Event("change", { bubbles: true }));

            if (typeof options.onRemove === "function") {
              options.onRemove(input);
            }

            return;
          }

          if (colorButton) {
            startImageColorPickFromInput(input, options);
            return;
          }
        }

        const previewImage = event.target.closest(".upload-preview-img");

        event.preventDefault();
        event.stopPropagation();

        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }

        if (previewImage) {
          if (handleImageColorPickClick(event, previewImage, input, options)) return;
          openImageZoom(previewImage);
        }
      },
      true
    );

    if (box.dataset.ownerImageToolsObserverReady !== "1") {
      box.dataset.ownerImageToolsObserverReady = "1";

      const observer = new MutationObserver(function () {
        if (box.classList.contains("has-preview") && box.querySelector(".upload-preview-img")) {
          ensureUploadPreviewControls(input, box, options);
        }
      });

      observer.observe(box, {
        childList: true,
        subtree: false
      });
    }

    input.addEventListener("change", function (event) {
      const file = this.files && this.files[0];

      if (!file) {
        if (this.dataset.explicitRemove === "1") {
          delete this.dataset.explicitRemove;
          return;
        }

        event.stopPropagation();
        return;
      }

      try {
        validateImageFile(file, options.label || "Selected image", options.maxImageMb || 5);
      } catch (error) {
        event.stopPropagation();
        this.value = "";

        if (typeof options.onError === "function") {
          options.onError(error.message, this);
        } else {
          alert(error.message);
        }

        return;
      }

      renderUploadPreviewFromFile(this, file, options);
    });
  }

  function setupImagePreviews(inputIds = [], options = {}) {
    inputIds.forEach((inputId) => {
      const input = typeof inputId === "string" ? document.getElementById(inputId) : inputId;
      setupImagePreview(input, options);
    });
  }

  window.OwnerProductImageTools = {
    escapeHtml,
    getUploadBox,
    isVariantImageInput,
    validateImageFile,
    syncColorInputs,
    renderUploadPreviewFromFile,
    renderUploadPreviewFromUrl,
    clearUploadPreview,
    setupImagePreview,
    setupImagePreviews,
    startImageColorPickFromInput,
    stopActiveColorPickMode,
    handleImageColorPickClick,
    openImageZoom,
    closeImageZoom
  };
})();
