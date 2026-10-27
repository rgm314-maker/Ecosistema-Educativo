// publico/js/nucleo/util.js
// Funciones de utilidad comunes

export function normalizar(texto) {
  if (!texto) return "";
  return String(texto)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u0302\u0304-\u036f]/g, "")
    .normalize("NFC");
}

export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function fechaLarga(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Guayaquil"
  }).format(fecha);
}

export function fechaRelativa(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return "";

  const ahora = new Date();
  const diffSeg = Math.round((fecha.getTime() - ahora.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("es-EC", { numeric: "auto" });

  const absSeg = Math.abs(diffSeg);
  if (absSeg < 60) {
    return rtf.format(diffSeg, "second");
  }

  const diffMin = Math.round(diffSeg / 60);
  const absMin = Math.abs(diffMin);
  if (absMin < 60) {
    return rtf.format(diffMin, "minute");
  }

  const diffHoras = Math.round(diffMin / 60);
  const absHoras = Math.abs(diffHoras);
  if (absHoras < 24) {
    return rtf.format(diffHoras, "hour");
  }

  const diffDias = Math.round(diffHoras / 24);
  const absDias = Math.abs(diffDias);
  if (absDias < 30) {
    return rtf.format(diffDias, "day");
  }

  const diffMeses = Math.round(diffDias / 30);
  const absMeses = Math.abs(diffMeses);
  if (absMeses < 12) {
    return rtf.format(diffMeses, "month");
  }

  const diffAnios = Math.round(diffDias / 365);
  return rtf.format(diffAnios, "year");
}

export function parametro(nombre) {
  if (typeof window === "undefined" || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

export function formatoBasico(texto) {
  if (!texto) return "";

  const seguro = String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const bloques = seguro.replace(/\r\n/g, "\n").split(/\n{2,}/);

  const htmlBloques = bloques.map((bloque) => {
    const lineas = bloque.split("\n");
    const esLista = lineas.every((linea) => linea.trim().startsWith("- "));

    if (esLista) {
      const items = lineas
        .map((linea) => {
          const contenido = linea.trim().slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
          return `<li>${contenido}</li>`;
        })
        .join("");
      return `<ul>${items}</ul>`;
    }

    const parrafo = lineas
      .map((linea) => linea.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"))
      .join("<br>");
    return `<p>${parrafo}</p>`;
  });

  return htmlBloques.join("");
}
