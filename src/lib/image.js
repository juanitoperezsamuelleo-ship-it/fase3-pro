// Comprime una foto a JPEG ≤ ~200 KB para guardarla en Firestore (límite 1 MB por documento).
export function compressImage(file, maxSide = 1400, maxBytes = 200 * 1024) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let side = maxSide;
      let q = 0.82;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const render = () => {
        const k = Math.min(1, side / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * k);
        canvas.height = Math.round(img.height * k);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", q);
      };
      let out = render();
      let tries = 0;
      while (out.length * 0.75 > maxBytes && tries < 8) {
        if (q > 0.5) q -= 0.1; else side = Math.round(side * 0.8);
        out = render();
        tries++;
      }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
    img.src = url;
  });
}
