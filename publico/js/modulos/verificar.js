// publico/js/modulos/verificar.js
// Validación y comprobación pública de certificados mediante código

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Verificar Certificado", roles: [] });

const form = document.getElementById("form-verificar");
const inputCodigo = document.getElementById("codigo-input");
const btnVerificar = document.getElementById("btn-verificar");
const contenedorResultado = document.getElementById("resultado-verificacion");

async function verificarCodigo(codigoBruto) {
  const codigo = (codigoBruto || "").trim().toUpperCase();
  if (!codigo) {
    ui.aviso("Por favor ingresa un código para verificar", "advertencia");
    inputCodigo.focus();
    return;
  }

  try {
    btnVerificar.disabled = true;
    contenedorResultado.innerHTML = `
      <div class="cargando-contenedor">
        <div class="cargando-spinner" aria-hidden="true"></div>
        <p>Consultando validez del certificado...</p>
      </div>
    `;

    const res = await api.llamar("GET", `/api/certificados/verificar/${encodeURIComponent(codigo)}`);

    if (res && res.valido) {
      const fechaTexto = res.fecha ? util.fechaLarga(res.fecha) : "Fecha no registrada";
      contenedorResultado.innerHTML = `
        <div class="resultado-caja resultado-caja--exito">
          <div class="resultado-encabezado">
            <div class="resultado-icono" aria-hidden="true">✓</div>
            <h2 class="resultado-estado-titulo">Certificado Auténtico y Válido</h2>
          </div>
          <p>El código consultado corresponde a un diploma legítimo emitido por la plataforma.</p>
          <div class="resultado-detalles">
            <div class="resultado-fila">
              <span class="resultado-etiqueta">Código:</span>
              <span class="resultado-valor resultado-valor--codigo">${ui.escapar(codigo)}</span>
            </div>
            <div class="resultado-fila">
              <span class="resultado-etiqueta">Titular:</span>
              <span class="resultado-valor">${ui.escapar(res.nombreCompleto || "Estudiante")}</span>
            </div>
            <div class="resultado-fila">
              <span class="resultado-etiqueta">Mérito / Reconocimiento:</span>
              <span class="resultado-valor">${ui.escapar(res.detalle || "Acreditación académica")}</span>
            </div>
            <div class="resultado-fila">
              <span class="resultado-etiqueta">Fecha de emisión:</span>
              <span class="resultado-valor">${ui.escapar(fechaTexto)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      contenedorResultado.innerHTML = `
        <div class="resultado-caja resultado-caja--error">
          <div class="resultado-encabezado">
            <div class="resultado-icono" aria-hidden="true">✕</div>
            <h2 class="resultado-estado-titulo">Certificado No Encontrado o Inválido</h2>
          </div>
          <p>
            No se encontró ningún registro activo asociado al código
            <strong>${ui.escapar(codigo)}</strong>.
            Asegúrate de haber ingresado todos los caracteres correctamente, incluyendo guiones.
          </p>
        </div>
      `;
    }
  } catch (err) {
    contenedorResultado.innerHTML = `
      <div class="resultado-caja resultado-caja--error">
        <div class="resultado-encabezado">
          <div class="resultado-icono" aria-hidden="true">!</div>
          <h2 class="resultado-estado-titulo">Error en la consulta</h2>
        </div>
        <p>${ui.escapar(err.message || "Ocurrió un error al consultar el servidor.")}</p>
      </div>
    `;
  } finally {
    btnVerificar.disabled = false;
  }
}

// Escuchar envío del formulario
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    verificarCodigo(inputCodigo.value);
  });
}

// Si la URL contiene el parámetro ?codigo=, ejecutar automáticamente
const codigoInicial = util.parametro("codigo");
if (codigoInicial) {
  inputCodigo.value = codigoInicial.trim();
  verificarCodigo(codigoInicial);
}
