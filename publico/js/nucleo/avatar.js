// Avatar guía accesible para actividades y acompañamiento pedagógico

const ESTADOS = ['reposo', 'hablando', 'pensando', 'celebrando'];
const CLAVE_VOZ = 'avatarVozActiva';
const CLAVE_OCULTO = 'avatarOculto';

let avatar = null;
let globo = null;
let botonVoz = null;
let botonMostrar = null;
let vozActiva = false;
let textoActual = '';
let temporizadorEstado = null;

function preferencia(clave, valorPredeterminado = false) {
  try {
    const valor = localStorage.getItem(clave);
    return valor === null ? valorPredeterminado : valor === 'true';
  } catch {
    return valorPredeterminado;
  }
}

function guardarPreferencia(clave, valor) {
  try { localStorage.setItem(clave, String(valor)); } catch { /* Preferencia opcional. */ }
}

function actualizarBotonVoz() {
  if (!botonVoz) return;
  botonVoz.textContent = vozActiva ? 'Silenciar' : 'Activar voz';
  botonVoz.setAttribute('aria-pressed', String(vozActiva));
}

function mostrarAvatar(mostrar) {
  if (!avatar || !botonMostrar) return;
  avatar.hidden = !mostrar;
  botonMostrar.hidden = mostrar;
  document.body.classList.toggle('avatar-guia-activa', mostrar);
  guardarPreferencia(CLAVE_OCULTO, !mostrar);
  if (!mostrar && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function vozEspanol() {
  const voces = window.speechSynthesis?.getVoices?.() || [];
  return voces.find((voz) => voz.lang?.toLowerCase() === 'es-ec')
    || voces.find((voz) => voz.lang?.toLowerCase().startsWith('es-'))
    || voces.find((voz) => voz.lang?.toLowerCase().startsWith('es'))
    || null;
}

export function cambiarEstado(estado = 'reposo') {
  if (!ESTADOS.includes(estado)) return;
  clearTimeout(temporizadorEstado);
  if (!avatar) return;
  ESTADOS.forEach((nombre) => avatar.classList.remove(`avatar-guia--${nombre}`));
  avatar.classList.add(`avatar-guia--${estado}`);
}

export function decir(texto) {
  textoActual = String(texto || '').replace(/\$/g, '').trim();
  if (globo) globo.textContent = textoActual;
  if (!avatar || avatar.hidden || !textoActual) return;

  cambiarEstado('hablando');
  temporizadorEstado = setTimeout(() => cambiarEstado('reposo'), 3000);

  if (!vozActiva || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  window.speechSynthesis.cancel();
  const lectura = new SpeechSynthesisUtterance(textoActual);
  const voz = vozEspanol();
  if (voz) lectura.voice = voz;
  lectura.lang = voz?.lang || 'es-EC';
  lectura.onend = () => cambiarEstado('reposo');
  lectura.onerror = () => cambiarEstado('reposo');
  window.speechSynthesis.speak(lectura);
}

export function montarAvatar() {
  if (avatar?.isConnected) return avatar;

  vozActiva = preferencia(CLAVE_VOZ, false);
  avatar = document.createElement('aside');
  avatar.id = 'avatar-guia';
  avatar.className = 'avatar-guia avatar-guia--reposo';
  avatar.setAttribute('aria-label', 'Avatar guía');
  avatar.innerHTML = `
    <div class="avatar-guia__globo">
      <p class="avatar-guia__texto" aria-live="polite"></p>
      <div class="avatar-guia__acciones">
        <button type="button" class="btn btn--texto btn--pequeno" data-avatar-voz>Activar voz</button>
        <button type="button" class="btn btn--texto btn--pequeno" data-avatar-ocultar>Ocultar</button>
      </div>
    </div>
    <div class="avatar-guia__personaje" aria-hidden="true">
      <svg class="avatar-guia__svg" viewBox="0 0 180 220" xmlns="http://www.w3.org/2000/svg">
        <path class="avatar-guia__antena" d="M90 34V18M90 18l-12-9M90 18l12-9"/>
        <circle class="avatar-guia__estrella" cx="90" cy="18" r="8"/>
        <rect class="avatar-guia__cabeza" x="36" y="38" width="108" height="92" rx="42"/>
        <path class="avatar-guia__oreja" d="M37 67L19 56v47l22-12M143 67l18-11v47l-22-12"/>
        <g class="avatar-guia__ojos">
          <ellipse cx="69" cy="80" rx="11" ry="14"/>
          <ellipse cx="111" cy="80" rx="11" ry="14"/>
          <circle class="avatar-guia__brillo" cx="72" cy="76" r="3"/>
          <circle class="avatar-guia__brillo" cx="114" cy="76" r="3"/>
        </g>
        <path class="avatar-guia__boca" d="M70 105Q90 120 110 105"/>
        <path class="avatar-guia__cuerpo" d="M52 127Q90 108 128 127l12 72H40z"/>
        <path class="avatar-guia__detalle" d="M72 151h36M78 166h24"/>
        <path class="avatar-guia__brazo avatar-guia__brazo--izq" d="M51 142L23 174l17 11"/>
        <path class="avatar-guia__brazo avatar-guia__brazo--der" d="M129 142l28 32-17 11"/>
        <path class="avatar-guia__pie" d="M57 198l-15 13h35M123 198l15 13h-35"/>
      </svg>
    </div>`;

  botonMostrar = document.createElement('button');
  botonMostrar.type = 'button';
  botonMostrar.className = 'btn btn--primario avatar-guia__mostrar';
  botonMostrar.textContent = 'Mostrar guía';
  botonMostrar.hidden = true;
  botonMostrar.addEventListener('click', () => {
    mostrarAvatar(true);
    if (textoActual) decir(textoActual);
  });

  globo = avatar.querySelector('.avatar-guia__texto');
  botonVoz = avatar.querySelector('[data-avatar-voz]');
  botonVoz.addEventListener('click', () => {
    vozActiva = !vozActiva;
    guardarPreferencia(CLAVE_VOZ, vozActiva);
    actualizarBotonVoz();
    if (vozActiva && textoActual) decir(textoActual);
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  });
  avatar.querySelector('[data-avatar-ocultar]').addEventListener('click', () => mostrarAvatar(false));

  document.body.append(avatar, botonMostrar);
  actualizarBotonVoz();
  mostrarAvatar(!preferencia(CLAVE_OCULTO, false));
  return avatar;
}

export default { montarAvatar, decir, cambiarEstado };
