// publico/js/nucleo/pdf.js
// Generación y descarga de diplomas y certificados en formato PDF (jsPDF)

import * as api from './api.js';
import * as util from './util.js';

// Carga asíncrona de jsPDF desde cdnjs si no se encuentra en el entorno global
async function asegurarJsPDF() {
  if (typeof window === "undefined") {
    throw new Error("jsPDF solo está disponible en el entorno del navegador");
  }

  if (window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }
  if (window.jsPDF) {
    return window.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const id = "script-cdn-jspdf";
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.onload = () => {
        const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
        if (jsPDF) resolve(jsPDF);
        else reject(new Error("No se pudo inicializar jsPDF"));
      };
      script.onerror = () => reject(new Error("Error al cargar la librería jsPDF desde CDN"));
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", () => {
        const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
        if (jsPDF) resolve(jsPDF);
        else reject(new Error("No se pudo inicializar jsPDF"));
      });
      script.addEventListener("error", () => reject(new Error("Error al cargar jsPDF")));
    }
  });
}

function hexARgb(hex, defecto = [0, 0, 0]) {
  if (!hex || typeof hex !== 'string') return defecto;
  let limpio = hex.replace('#', '').trim();
  if (limpio.length === 3) {
    limpio = limpio.split('').map((c) => c + c).join('');
  }
  if (limpio.length !== 6) return defecto;
  const num = parseInt(limpio, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function leerTokensCSS() {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const estilos = root && window.getComputedStyle ? window.getComputedStyle(root) : null;
  const val = (variable, defecto) => (estilos ? estilos.getPropertyValue(variable).trim() : "") || defecto;

  return {
    primario: val("--primario", "#002e45"),
    secundario: val("--secundario", "#264763"),
    acento: val("--acento", "#ff6900"),
    texto: val("--texto", "#182d3e"),
    textoSuave: val("--texto-suave", "#627586"),
    fondo: val("--fondo", "#f5f7f8"),
    superficie: val("--superficie", "#ffffff"),
    borde: val("--borde", "#dfe7ec")
  };
}

/**
 * Genera y descarga un diploma A4 horizontal.
 * @param {Object} opciones
 * @param {"cumplimiento" | "nivel-quiz"} [opciones.tipo="cumplimiento"]
 * @param {string} [opciones.temaId]
 * @param {number} [opciones.nivel]
 * @returns {Promise<{ codigo: string }>}
 */
export async function generarDiploma({ tipo = "cumplimiento", temaId, nivel } = {}) {
  // 1. Solicitar o recuperar el certificado desde la API
  const cert = await api.llamar("POST", "/api/certificados", { tipo, temaId, nivel });

  if (!cert || !cert.codigo) {
    throw new Error("Respuesta inválida del servidor al emitir el certificado");
  }

  // 2. Asegurar la librería jsPDF
  const JsPdfClass = await asegurarJsPDF();

  // 3. Obtener colores desde las variables de tokens.css
  const colores = leerTokensCSS();

  // 4. Crear documento A4 apaisado (297 mm x 210 mm)
  const doc = new JsPdfClass({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const ancho = 297;
  const alto = 210;
  const centroX = ancho / 2;

  // Fondo
  doc.setFillColor(...hexARgb(colores.superficie));
  doc.rect(0, 0, ancho, alto, "F");

  // Marco exterior
  doc.setDrawColor(...hexARgb(colores.primario));
  doc.setLineWidth(1.4);
  doc.rect(10, 10, ancho - 20, alto - 20);

  // Marco interior
  doc.setDrawColor(...hexARgb(colores.acento));
  doc.setLineWidth(0.6);
  doc.rect(13, 13, ancho - 26, alto - 26);

  // Ornamentos en las 4 esquinas del marco interior
  doc.setFillColor(...hexARgb(colores.primario));
  const esquinas = [
    [13, 13],
    [ancho - 13, 13],
    [13, alto - 13],
    [ancho - 13, alto - 13]
  ];
  for (const [ex, ey] of esquinas) {
    doc.rect(ex - 2, ey - 2, 4, 4, "F");
  }

  // Nombre de la plataforma
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...hexARgb(colores.primario));
  doc.text("ECOSISTEMA EDUCATIVO DIGITAL", centroX, 34, { align: "center" });

  // Subtítulo del reconocimiento
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...hexARgb(colores.acento));
  doc.text("DIPLOMA DE MÉRITO Y ACREDITACIÓN", centroX, 43, { align: "center" });

  // Línea divisoria decorativa
  doc.setDrawColor(...hexARgb(colores.acento));
  doc.setLineWidth(0.5);
  doc.line(80, 48, ancho - 80, 48);

  // "Otorgado a"
  doc.setFont("helvetica", "italic");
  doc.setFontSize(13);
  doc.setTextColor(...hexARgb(colores.textoSuave));
  doc.text("El presente reconocimiento es otorgado a:", centroX, 62, { align: "center" });

  // Nombre del estudiante
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.setTextColor(...hexARgb(colores.primario));
  doc.text(cert.nombreCompleto || "Estudiante", centroX, 78, { align: "center" });

  // Línea bajo el nombre
  doc.setDrawColor(...hexARgb(colores.secundario));
  doc.setLineWidth(0.4);
  doc.line(60, 83, ancho - 60, 83);

  // Detalle del logro
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...hexARgb(colores.texto));
  const textoDetalle = cert.detalle || "Por haber completado satisfactoriamente los requisitos del programa formativo.";
  const lineasDetalle = doc.splitTextToSize(textoDetalle, 220);
  doc.text(lineasDetalle, centroX, 96, { align: "center" });

  // Fecha larga
  const fechaTexto = util.fechaLarga(cert.fecha) || "Ecuador";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...hexARgb(colores.textoSuave));
  doc.text(`Fecha de emisión: ${fechaTexto}`, centroX, 126, { align: "center" });

  // Firmas institucionales
  doc.setDrawColor(...hexARgb(colores.borde));
  doc.setLineWidth(0.4);
  doc.line(55, 153, 115, 153);
  doc.line(ancho - 115, 153, ancho - 55, 153);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...hexARgb(colores.primario));
  doc.text("Coordinación Académica", 85, 159, { align: "center" });
  doc.text("Comité Evaluador", ancho - 85, 159, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...hexARgb(colores.textoSuave));
  doc.text("Ecosistema Educativo", 85, 164, { align: "center" });
  doc.text("Acreditación Digital", ancho - 85, 164, { align: "center" });

  // Código y enlace de verificación
  const origin = typeof window !== 'undefined' ? window.location.origin : "";
  const rutaVerificar = `${origin}/paginas/verificar.html?codigo=${encodeURIComponent(cert.codigo)}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...hexARgb(colores.primario));
  doc.text(`Código de verificación: ${cert.codigo}`, centroX, 178, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...hexARgb(colores.textoSuave));
  doc.text(`Verifica la autenticidad en: ${rutaVerificar}`, centroX, 184, { align: "center" });

  // Descarga del PDF
  doc.save(`diploma-${cert.codigo}.pdf`);

  return { codigo: cert.codigo };
}

export default {
  generarDiploma
};
