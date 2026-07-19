const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected image could not be prepared."));
    };
    image.src = url;
  });

const canvasToBlob = (canvas, type = "image/jpeg", quality = 0.9) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Evidence stamp could not be generated."))), type, quality);
  });

const fitCanvasSize = (width, height, maxDimension = 4096) => {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

const wrapCanvasText = (context, value, maxWidth) => {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const drawStamp = (context, width, height, details = {}) => {
  const scale = Math.max(0.72, Math.min(1.45, width / 1600));
  const fontSize = Math.max(18, Math.round(28 * scale));
  const lineHeight = Math.round(fontSize * 1.34);
  const padding = Math.round(24 * scale);
  const location = details.location;
  const date = new Date(location?.capturedAt || details.capturedAt || Date.now());
  const maxTextWidth = width - padding * 2;
  context.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
  const address = location?.formattedAddress && location.formattedAddress !== "Address unavailable"
    ? location.formattedAddress
    : "Address unavailable";
  const lines = [
    { text: "Safety Management System", bold: true },
    ...(location ? wrapCanvasText(context, address, maxTextWidth).slice(0, 2).map((text) => ({ text })) : []),
    { text: location
      ? `${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)} • Accuracy ±${Math.round(Number(location.accuracyMeters || 0))} m`
      : "Location not attached" },
    { text: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date) },
    { text: `Captured by: ${details.capturedBy || "Safety user"}` },
    { text: [details.siteName, details.reference].filter(Boolean).join(" • ") }
  ].filter((line) => line.text);
  const panelHeight = Math.min(Math.round(height * 0.42), padding * 2 + lines.length * lineHeight);
  const top = height - panelHeight;

  context.save();
  context.fillStyle = "rgba(2, 6, 23, 0.82)";
  context.fillRect(0, top, width, panelHeight);
  context.fillStyle = "#f97316";
  context.fillRect(0, top, width, Math.max(5, Math.round(8 * scale)));
  context.fillStyle = "#ffffff";
  context.textBaseline = "top";
  lines.forEach((line, index) => {
    context.font = `${line.bold ? 700 : 500} ${fontSize}px system-ui, -apple-system, sans-serif`;
    let rendered = line.text;
    while (context.measureText(rendered).width > maxTextWidth && rendered.length > 12) {
      rendered = `${rendered.slice(0, -2)}…`;
    }
    context.fillText(rendered, padding, top + padding + index * lineHeight);
  });
  context.restore();
};

const stampedName = (name, suffix = "stamped") => {
  const base = String(name || "evidence").replace(/\.[^.]+$/, "");
  return `${base}-${suffix}.jpg`;
};

export const stampImageFile = async (file, details) => {
  const image = await loadImage(file);
  const dimensions = fitCanvasSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  drawStamp(context, canvas.width, canvas.height, details);
  const blob = await canvasToBlob(canvas);
  return new File([blob], stampedName(file.name), { type: "image/jpeg", lastModified: Date.now() });
};

export const createVideoPoster = (file, details) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const finish = (value) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const render = async () => {
      try {
        const dimensions = fitCanvasSize(video.videoWidth || 1280, video.videoHeight || 720, 1920);
        const canvas = document.createElement("canvas");
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawStamp(context, canvas.width, canvas.height, details);
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
        finish(new File([blob], stampedName(file.name, "poster"), { type: "image/jpeg", lastModified: Date.now() }));
      } catch (_error) {
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      if (video.duration > 0.2) {
        video.currentTime = Math.min(0.25, video.duration / 2);
        video.onseeked = render;
      } else {
        render();
      }
    };
    video.src = url;
  });
