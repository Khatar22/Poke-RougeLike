// modules/utils.js
export const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const loadJSON = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load ' + url);
  return res.json();
};

// Загружает изображение и возвращает HTMLImageElement.
// Если файл не найден, вызывает onError (если передан).
export const loadImage = (path, onLoad = null, onError = null) => {

  const img = new Image();
  img.onload = () => { if (onLoad) onLoad(img); };
  img.onerror = () => { if (onError) onError(img); };
  img.src = path;
  return img;
};

export const logTo = (selector, msg) => {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent += msg + '\n';
  el.scrollTop = el.scrollHeight;
};


