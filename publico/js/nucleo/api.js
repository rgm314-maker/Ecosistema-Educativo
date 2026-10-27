// publico/js/nucleo/api.js
// Cliente HTTP para la API del ecosistema educativo

export async function llamar(metodo, ruta, cuerpo = null) {
  const token = sessionStorage.getItem("token");
  const headers = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const opciones = {
    method: metodo,
    headers
  };

  if (cuerpo !== null && cuerpo !== undefined) {
    if (cuerpo instanceof FormData) {
      opciones.body = cuerpo;
    } else {
      headers["Content-Type"] = "application/json";
      opciones.body = JSON.stringify(cuerpo);
    }
  }

  const res = await fetch(ruta, opciones);

  if (res.status === 401) {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("usuario");
    const rutaActual = window.location.pathname;
    if (!rutaActual.endsWith("ingreso.html") && !rutaActual.endsWith("registro.html")) {
      window.location.href = "/paginas/ingreso.html";
    }
  }

  const contentType = res.headers.get("content-type") || "";
  let datos = null;
  if (contentType.includes("application/json")) {
    datos = await res.json().catch(() => null);
  } else {
    datos = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const mensaje = (datos && typeof datos === "object" && datos.error)
      ? datos.error
      : (typeof datos === "string" && datos ? datos : `Error en la petición: ${res.status} ${res.statusText}`);
    const error = new Error(mensaje);
    error.estado = res.status;
    throw error;
  }

  if (datos && typeof datos === "object" && datos.error) {
    throw new Error(datos.error);
  }

  return datos;
}

export async function listar(col, filtros = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null) {
      params.append(clave, valor);
    }
  }
  const query = params.toString();
  const ruta = `/api/${encodeURIComponent(col)}${query ? `?${query}` : ""}`;
  return llamar("GET", ruta);
}

export async function obtener(col, id) {
  return llamar("GET", `/api/${encodeURIComponent(col)}/${encodeURIComponent(id)}`);
}

export async function crear(col, datos) {
  return llamar("POST", `/api/${encodeURIComponent(col)}`, datos);
}

export async function actualizar(col, id, cambios) {
  return llamar("PUT", `/api/${encodeURIComponent(col)}/${encodeURIComponent(id)}`, cambios);
}

export async function eliminar(col, id) {
  return llamar("DELETE", `/api/${encodeURIComponent(col)}/${encodeURIComponent(id)}`);
}

export async function subir(archivo) {
  const formData = new FormData();
  formData.append("archivo", archivo);
  return llamar("POST", "/api/subidas", formData);
}

export async function ia(tarea, datos) {
  return llamar("POST", `/api/ia/${encodeURIComponent(tarea)}`, datos);
}
