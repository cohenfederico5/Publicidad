// ======================================================
// FRESQUITO'S — Google Apps Script
// ======================================================
// El script vive en la cuenta personal de Fede y abre la planilla de la
// cuenta de Fresquito's por ID, desde afuera. Por eso no aparece dentro
// de la planilla.
//
// Cómo actualizarlo:
// 1. script.google.com → abrir el proyecto → pegar este código entero
// 2. Cargar las DOS propiedades (ver abajo)
// 3. Implementar → "Administrar implementaciones" → lápiz de editar
//    → Versión: "Nueva versión" → Implementar
//    ⚠️ Así y NO con "Nueva implementación": la URL se mantiene igual
//       y no hay que tocar index.html ni admin.html.
// ======================================================
//
// LAS PROPIEDADES
// Ni la clave ni el ID de la planilla van escritos acá: este archivo está
// en un repo público. Se cargan en:
//   Configuración del proyecto (engranaje) → Propiedades del script
//
//   ADMIN_PASSWORD  → la clave para entrar al panel
//   SHEET_ID        → el ID de la planilla de suscriptores
//   NOTIF_EMAIL     → a dónde llegan los avisos de formularios nuevos
//                     (si se deja vacía, simplemente no se manda nada)
//
// Para cambiar cualquiera de las tres se edita ese valor y listo: no hace
// falta volver a implementar.
// ======================================================

// Acciones que puede llamar cualquiera desde la web pública (index.html).
var ACCIONES_PUBLICAS = ['save_suscriptor', 'save_mayorista'];

// Límite de caracteres por campo, para que nadie llene la planilla de basura.
var MAX_CAMPO = 2000;

function getSS_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Falta cargar la propiedad SHEET_ID');
  return SpreadsheetApp.openById(id);
}


// ------------------------------------------------------
// AVISOS POR MAIL
// ------------------------------------------------------
// Se llaman DESPUÉS de guardar en la planilla y van envueltos en try/catch:
// si el mail falla, el dato ya quedó guardado igual. Nunca perder un
// suscriptor por culpa de una notificación.

function escapeHtml_(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function avisar_(asunto, htmlBody, responderA) {
  try {
    var dest = PropertiesService.getScriptProperties().getProperty('NOTIF_EMAIL');
    if (!dest) return;

    var opciones = {
      to: dest,
      subject: asunto,
      htmlBody: htmlBody + PIE_MAIL,
      name: "Fresquito's"
    };
    // Así se puede contestar el mail y le llega directo a la persona.
    if (responderA && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responderA)) {
      opciones.replyTo = responderA;
    }
    MailApp.sendEmail(opciones);

  } catch (err) {
    console.error('No se pudo mandar el aviso: ' + err);
  }
}

var PIE_MAIL =
  '<p style="margin-top:28px;padding-top:14px;border-top:1px solid #E0D4A0;' +
  'font-family:Arial,sans-serif;font-size:12px;color:#8B7355;">' +
  'Aviso automático de fresquitos.com.ar · ' +
  '<a href="https://fresquitos.com.ar/admin.html" style="color:#C85C4A;">Abrir el panel</a></p>';

function avisarSuscriptor_(email, fecha) {
  var html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;color:#2C1505;">' +
    '<p style="font-size:17px;"><b>Nuevo suscriptor en la lista de espera</b></p>' +
    '<p style="font-size:18px;"><a href="mailto:' + escapeHtml_(email) + '">' +
    escapeHtml_(email) + '</a></p>' +
    '<p style="color:#6B5B47;">' + escapeHtml_(fecha) + '</p></div>';
  avisar_('🍦 Nuevo suscriptor: ' + email, html, email);
}

function avisarMayorista_(d) {
  var fila = function(etiqueta, valor) {
    if (!valor) return '';
    return '<tr><td style="padding:6px 16px 6px 0;color:#8B7355;white-space:nowrap;' +
           'vertical-align:top;">' + etiqueta + '</td>' +
           '<td style="padding:6px 0;"><b>' + valor + '</b></td></tr>';
  };

  var tel = escapeHtml_(d.telefono);
  var telLink = tel
    ? '<a href="tel:' + tel.replace(/[^0-9+]/g, '') + '">' + tel + '</a>'
    : '';

  var html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;color:#2C1505;">' +
    '<p style="font-size:17px;"><b>Nueva consulta mayorista</b></p>' +
    '<table style="font-size:15px;border-collapse:collapse;">' +
      fila('Nombre',  escapeHtml_(d.nombre)) +
      fila('Email',   '<a href="mailto:' + escapeHtml_(d.email) + '">' + escapeHtml_(d.email) + '</a>') +
      fila('Teléfono', telLink) +
      fila('Negocio', escapeHtml_(d.tipo)) +
    '</table>';

  if (limpiar_(d.mensaje)) {
    html += '<p style="margin-top:18px;color:#8B7355;">Mensaje</p>' +
            '<p style="background:#F7F2E4;padding:14px 16px;border-left:3px solid #C85C4A;' +
            'margin:0;white-space:pre-wrap;">' + escapeHtml_(d.mensaje) + '</p>';
  }

  html += '<p style="margin-top:20px;color:#6B5B47;font-size:13px;">' +
          'Podés responder este mail y le llega directo.</p></div>';

  var asunto = '🏪 Consulta mayorista: ' + limpiar_(d.nombre);
  if (limpiar_(d.tipo)) asunto += ' (' + limpiar_(d.tipo) + ')';

  avisar_(asunto, html, d.email);
}


// ------------------------------------------------------
// AUTENTICACIÓN
// ------------------------------------------------------

function sha256_(texto) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

// Cada intento fallido cuesta unos segundos, y el costo sube si alguien
// insiste. Así una clave simple sigue aguantando: probar claves a mano o con
// un script pasa a ser lentísimo. Nunca bloquea del todo — en el peor caso
// Fede espera unos segundos de más si alguien estuvo martillando el panel.
function penalizarFallo_() {
  var cache = CacheService.getScriptCache();
  var fallos = Number(cache.get('login_fallos') || 0) + 1;
  cache.put('login_fallos', String(fallos), 300); // se olvida a los 5 minutos
  Utilities.sleep(Math.min(1000 + fallos * 500, 4000));
}

// Compara los hashes (no las claves) y siempre recorre los 64 caracteres,
// así el tiempo de respuesta no delata cuánto acertó quien prueba claves.
function claveValida_(entrada) {
  var guardada = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!guardada || typeof entrada !== 'string' || !entrada) return false;

  var a = sha256_(guardada);
  var b = sha256_(entrada);
  var dif = 0;
  for (var i = 0; i < a.length; i++) {
    dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return dif === 0;
}


// ------------------------------------------------------
// ENTRADA
// ------------------------------------------------------

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var accion = data.action;

    // Todo lo que no sea público exige la clave del panel.
    if (ACCIONES_PUBLICAS.indexOf(accion) === -1 && !claveValida_(data.token)) {
      penalizarFallo_();
      return jsonOut({ ok: false, error: 'no autorizado' });
    }

    var ss = getSS_();

    // --- Público ---
    if (accion === 'save_suscriptor') {
      if (!emailValido_(data.email)) return jsonOut({ ok: false, error: 'email inválido' });
      var hojaS = getOrCreateSheet(ss, 'Suscriptores', ['Email', 'Fecha']);
      hojaS.appendRow([limpiar_(data.email), limpiar_(data.fecha)]);
      avisarSuscriptor_(limpiar_(data.email), limpiar_(data.fecha));
      return jsonOut({ ok: true });
    }

    if (accion === 'save_mayorista') {
      if (!emailValido_(data.email)) return jsonOut({ ok: false, error: 'email inválido' });
      if (!limpiar_(data.nombre)) return jsonOut({ ok: false, error: 'falta el nombre' });
      var hojaM = getOrCreateSheet(ss, 'Mayoristas',
        ['ID', 'Nombre', 'Email', 'Teléfono', 'Tipo de negocio', 'Mensaje', 'Fecha', 'Estado']);
      hojaM.appendRow([
        limpiar_(data.id), limpiar_(data.nombre), limpiar_(data.email),
        limpiar_(data.telefono), limpiar_(data.tipo), limpiar_(data.mensaje),
        limpiar_(data.fecha), 'pendiente'
      ]);
      avisarMayorista_(data);
      return jsonOut({ ok: true });
    }

    // --- Sólo con clave ---
    if (accion === 'login') {
      return jsonOut({ ok: true });
    }

    if (accion === 'list_suscriptores') {
      return jsonOut({ ok: true, datos: leerSuscriptores_(ss) });
    }

    if (accion === 'list_mayoristas') {
      return jsonOut({ ok: true, datos: leerMayoristas_(ss) });
    }

    if (accion === 'update_estado') {
      var hojaEst = ss.getSheetByName('Mayoristas');
      if (hojaEst) {
        var vals = hojaEst.getDataRange().getValues();
        for (var i = 1; i < vals.length; i++) {
          if (String(vals[i][0]) === String(data.id)) {
            hojaEst.getRange(i + 1, 8).setValue(
              data.estado === 'contactado' ? 'contactado' : 'pendiente');
            break;
          }
        }
      }
      return jsonOut({ ok: true });
    }

    if (accion === 'delete_suscriptor') {
      var hojaDS = ss.getSheetByName('Suscriptores');
      if (hojaDS) {
        var valsDS = hojaDS.getDataRange().getValues();
        for (var j = valsDS.length - 1; j >= 1; j--) {
          if (valsDS[j][0] === data.email) { hojaDS.deleteRow(j + 1); break; }
        }
      }
      return jsonOut({ ok: true });
    }

    if (accion === 'delete_mayorista') {
      var hojaDM = ss.getSheetByName('Mayoristas');
      if (hojaDM) {
        var valsDM = hojaDM.getDataRange().getValues();
        for (var k = valsDM.length - 1; k >= 1; k--) {
          if (String(valsDM[k][0]) === String(data.id)) { hojaDM.deleteRow(k + 1); break; }
        }
      }
      return jsonOut({ ok: true });
    }

    if (accion === 'clear_suscriptores') {
      var hojaCS = ss.getSheetByName('Suscriptores');
      if (hojaCS && hojaCS.getLastRow() > 1) hojaCS.deleteRows(2, hojaCS.getLastRow() - 1);
      return jsonOut({ ok: true });
    }

    if (accion === 'clear_mayoristas') {
      var hojaCM = ss.getSheetByName('Mayoristas');
      if (hojaCM && hojaCM.getLastRow() > 1) hojaCM.deleteRows(2, hojaCM.getLastRow() - 1);
      return jsonOut({ ok: true });
    }

    return jsonOut({ ok: false, error: 'acción no reconocida' });

  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// Antes doGet devolvía la lista de emails a cualquiera que abriera la URL.
// Ahora los datos salen únicamente por doPost y con clave.
function doGet(e) {
  return jsonOut({ ok: false, error: 'no autorizado' });
}


// ------------------------------------------------------
// AUXILIARES
// ------------------------------------------------------

function leerSuscriptores_(ss) {
  var sheet = ss.getSheetByName('Suscriptores');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()
    .map(function(r) { return { email: r[0], fecha: r[1] }; });
}

function leerMayoristas_(ss) {
  var sheet = ss.getSheetByName('Mayoristas');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues()
    .map(function(r) {
      return {
        id: r[0], nombre: r[1], email: r[2], telefono: r[3],
        tipo: r[4], mensaje: r[5], fecha: r[6], estado: r[7]
      };
    });
}

function limpiar_(v) {
  if (v == null) return '';
  return String(v).slice(0, MAX_CAMPO);
}

function emailValido_(v) {
  var s = limpiar_(v).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}
