(function () {
  "use strict";

  const INPUT_CONFIG = {
    main: {
      width: 1600,
      height: 2000,
      maxBytes: 350 * 1024,
      label: "Main image"
    },
    sub: {
      width: 900,
      height: 1125,
      maxBytes: 180 * 1024,
      label: "Sub image"
    }
  };

  const PROCESSING_SELECTOR = 'input[type="file"][data-owner-image-process]';
  const CONTROL_SELECTOR = "[data-owner-image-fit-control]";
  const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
  const originalFiles = new WeakMap();
  const pendingTasks = new Set();

  function getConfig(input) {
    return INPUT_CONFIG[input?.dataset.ownerImageProcess] || null;
  }

  function getModeInput(input) {
    const inputId = input?.dataset.imageFitModeInput;
    return inputId ? document.getElementById(inputId) : null;
  }

  function getMode(input) {
    return getModeInput(input)?.value === "crop" ? "crop" : "contain";
  }

  function getControlForInput(input) {
    const modeInput = getModeInput(input);
    return modeInput?.closest(CONTROL_SELECTOR) || null;
  }

  function getControlInputs(control) {
    return String(control?.dataset.inputIds || "")
      .split(",")
      .map((inputId) => document.getElementById(inputId.trim()))
      .filter(Boolean);
  }

  function setControlStatus(control, message, state = "") {
    if (!control) return;

    const status = control.querySelector("[data-image-process-status]");
    if (status) {
      status.textContent = message;
      status.dataset.state = state;
    }
  }

  function syncControlMode(control, mode) {
    if (!control) return;

    control.querySelectorAll("[data-image-fit-mode]").forEach((button) => {
      const isActive = button.dataset.imageFitMode === mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function syncControlProcessing(control) {
    if (!control) return;

    const isProcessing = getControlInputs(control).some(
      (input) => input.dataset.ppImageProcessing === "1"
    );

    control.classList.toggle("is-processing", isProcessing);
    control.querySelectorAll("[data-image-fit-mode]").forEach((button) => {
      button.disabled = isProcessing;
    });
  }

  function formatKilobytes(bytes) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }

  function isProcessedFile(file) {
    return Boolean(
      file &&
      file.type === "image/webp" &&
      /-pp-(?:contain|crop)\.webp$/i.test(file.name || "")
    );
  }

  function loadImage(file) {
    if ("createImageBitmap" in window) {
      return createImageBitmap(file, { imageOrientation: "from-image" })
        .catch(() => createImageBitmap(file));
    }

    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = function () {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not read this image."));
      };

      image.src = objectUrl;
    });
  }

  function getSourceSize(source) {
    return {
      width: source.width || source.naturalWidth,
      height: source.height || source.naturalHeight
    };
  }

  function drawCover(context, source, width, height, overscan = 1) {
    const sourceSize = getSourceSize(source);
    const scale = Math.max(width / sourceSize.width, height / sourceSize.height) * overscan;
    const drawWidth = sourceSize.width * scale;
    const drawHeight = sourceSize.height * scale;

    context.drawImage(
      source,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
  }

  function drawContain(context, source, width, height) {
    const sourceSize = getSourceSize(source);
    const inset = Math.max(18, Math.round(Math.min(width, height) * 0.025));
    const availableWidth = width - inset * 2;
    const availableHeight = height - inset * 2;
    const scale = Math.min(
      availableWidth / sourceSize.width,
      availableHeight / sourceSize.height
    );
    const drawWidth = sourceSize.width * scale;
    const drawHeight = sourceSize.height * scale;

    context.save();
    context.shadowColor = "rgba(57, 25, 31, 0.16)";
    context.shadowBlur = Math.max(12, Math.round(width * 0.018));
    context.drawImage(
      source,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
    context.restore();
  }

  function renderImageToCanvas(source, config, mode) {
    const canvas = document.createElement("canvas");
    canvas.width = config.width;
    canvas.height = config.height;

    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true
    });

    if (!context) {
      throw new Error("Image processing is not supported in this browser.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    if (mode === "crop") {
      context.fillStyle = "#fffaf6";
      context.fillRect(0, 0, config.width, config.height);
      drawCover(context, source, config.width, config.height);
      return canvas;
    }

    context.fillStyle = "#f8eee8";
    context.fillRect(0, 0, config.width, config.height);

    context.save();
    context.filter = `blur(${Math.max(18, Math.round(config.width * 0.025))}px) saturate(0.78)`;
    context.globalAlpha = 0.46;
    drawCover(context, source, config.width, config.height, 1.08);
    context.restore();

    context.fillStyle = "rgba(255, 250, 246, 0.58)";
    context.fillRect(0, 0, config.width, config.height);
    drawContain(context, source, config.width, config.height);

    return canvas;
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("This browser could not create the WebP image."));
          }
        },
        "image/webp",
        quality
      );
    });
  }

  async function compressCanvas(canvas, maxBytes) {
    const qualities = [0.84, 0.78, 0.72, 0.66, 0.60, 0.54, 0.48, 0.42, 0.36];
    let smallestBlob = null;

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, quality);

      if (!smallestBlob || blob.size < smallestBlob.size) {
        smallestBlob = blob;
      }

      if (blob.size <= maxBytes) {
        return blob;
      }
    }

    return smallestBlob;
  }

  function makeProcessedFile(blob, originalFile, mode) {
    const sourceName = String(originalFile?.name || "product-image")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 55) || "product-image";

    return new File(
      [blob],
      `${sourceName}-pp-${mode}.webp`,
      {
        type: "image/webp",
        lastModified: Date.now()
      }
    );
  }

  function replaceInputFile(input, file) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  }

  function dispatchReadyChange(input) {
    input.dataset.ppImageReady = "1";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function createProcessedFile(file, config, mode) {
    const source = await loadImage(file);

    try {
      const canvas = renderImageToCanvas(source, config, mode);
      const blob = await compressCanvas(canvas, config.maxBytes);

      if (!blob) {
        throw new Error("Image compression did not return a file.");
      }

      canvas.width = 1;
      canvas.height = 1;

      return makeProcessedFile(blob, file, mode);
    } finally {
      if (typeof source.close === "function") {
        source.close();
      }
    }
  }

  async function processAndAssign(input, sourceFile) {
    const config = getConfig(input);
    const control = getControlForInput(input);
    const mode = getMode(input);

    if (!config || !sourceFile) return;

    input.dataset.ppImageProcessing = "1";
    syncControlProcessing(control);
    setControlStatus(
      control,
      `${config.label} is being resized and compressed...`,
      "processing"
    );

    try {
      const processedFile = await createProcessedFile(sourceFile, config, mode);
      replaceInputFile(input, processedFile);
      dispatchReadyChange(input);

      const modeLabel = mode === "crop" ? "Fill frame" : "Full image";
      setControlStatus(
        control,
        `${modeLabel} ready: ${config.width} x ${config.height}, ${formatKilobytes(processedFile.size)} WebP.`,
        "success"
      );
    } catch (error) {
      console.warn("Browser image preparation failed; using server fallback:", error);
      replaceInputFile(input, sourceFile);
      input.dataset.ppImageBypass = "1";
      input.dispatchEvent(new Event("change", { bubbles: true }));
      setControlStatus(
        control,
        "Browser preparation was unavailable. The server will process this image safely.",
        "warning"
      );
    } finally {
      delete input.dataset.ppImageProcessing;
      syncControlProcessing(control);
    }
  }

  function trackTask(task) {
    pendingTasks.add(task);
    task.finally(() => pendingTasks.delete(task));
    return task;
  }

  function handleFileChange(event) {
    const input = event.currentTarget;
    const file = input.files && input.files[0];

    if (input.dataset.ppImageReady === "1") {
      delete input.dataset.ppImageReady;
      return;
    }

    if (input.dataset.ppImageBypass === "1") {
      delete input.dataset.ppImageBypass;
      return;
    }

    if (!file) {
      originalFiles.delete(input);
      setControlStatus(
        getControlForInput(input),
        "Choose Full image to keep everything, or Fill frame for a close crop."
      );
      return;
    }

    if (isProcessedFile(file)) {
      return;
    }

    if (!file.type.startsWith("image/") || file.size > MAX_SOURCE_BYTES) {
      return;
    }

    event.stopImmediatePropagation();
    originalFiles.set(input, file);
    trackTask(processAndAssign(input, file));
  }

  async function handleModeChange(control, mode) {
    const modeInputId = control.dataset.modeInputId;
    const modeInput = modeInputId ? document.getElementById(modeInputId) : null;
    const inputs = getControlInputs(control);
    const hasUnavailableDraftFile = inputs.some((input) => {
      const uploadBox = input.closest(
        ".catalog-upload, .arrival-upload, .top-showcase-upload, .sub-upload, .variant-upload"
      );
      return uploadBox?.dataset.draftFileKey && !originalFiles.has(input);
    });

    if (hasUnavailableDraftFile) {
      setControlStatus(
        control,
        "Select the image again before changing its fit mode.",
        "warning"
      );
      return;
    }

    if (modeInput) {
      modeInput.value = mode;
      modeInput.dispatchEvent(new Event("input", { bubbles: true }));
      modeInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    syncControlMode(control, mode);

    const selectedInputs = inputs.filter((input) => originalFiles.has(input));
    if (!selectedInputs.length) {
      setControlStatus(
        control,
        mode === "crop"
          ? "Fill frame will crop the edges to use the complete card."
          : "Full image keeps the complete saree visible with a soft background."
      );
      return;
    }

    for (const input of selectedInputs) {
      await processAndAssign(input, originalFiles.get(input));
    }
  }

  function setupControl(control) {
    const modeInputId = control.dataset.modeInputId;
    const modeInput = modeInputId ? document.getElementById(modeInputId) : null;
    const initialMode = modeInput?.value === "crop" ? "crop" : "contain";

    syncControlMode(control, initialMode);

    control.addEventListener("click", function (event) {
      const button = event.target.closest("[data-image-fit-mode]");
      if (!button || button.disabled) return;

      const mode = button.dataset.imageFitMode === "crop" ? "crop" : "contain";
      if (mode === (modeInput?.value || "contain")) return;

      trackTask(handleModeChange(control, mode));
    });
  }

  async function whenIdle() {
    while (pendingTasks.size) {
      await Promise.all(Array.from(pendingTasks));
    }
  }

  function init() {
    document.querySelectorAll(PROCESSING_SELECTOR).forEach((input) => {
      input.addEventListener("change", handleFileChange, true);
    });

    document.querySelectorAll(CONTROL_SELECTOR).forEach(setupControl);
  }

  window.OwnerProductImageCropCompress = {
    whenIdle,
    isProcessing: function () {
      return pendingTasks.size > 0;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
