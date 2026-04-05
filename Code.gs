// ======================================================
// FRESQUITO'S — Google Apps Script
// ======================================================
// Cómo desplegarlo:
// 1. Abrí script.google.com → Nuevo proyecto
// 2. Pegá este código (reemplazando el contenido existente)
// 3. Clic en "Implementar" → "Nueva implementación"
// 4. Tipo: "Aplicación web"
//    - Ejecutar como: Yo (tu cuenta)
//    - Quién tiene acceso: Cualquier persona
// 5. Copiá la URL que te da y pegala en index.html y admin.html
//    donde dice: const APPS_SCRIPT_URL = 'PEGAR_URL_AQUI';
// ======================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === 'save_suscriptor') {
      const sheet = getOrCreateSheet(ss, 'Suscriptores', ['Email', 'Fecha']);
      sheet.appendRow([data.email, data.fecha]);

    } else if (data.action === 'save_mayorista') {
      const sheet = getOrCreateSheet(ss, 'Mayoristas',
        ['ID', 'Nombre', 'Email', 'Teléfono', 'Tipo de negocio', 'Mensaje', 'Fecha', 'Estado']);
      sheet.appendRow([data.id, data.nombre, data.email, data.telefono,
                       data.tipo, data.mensaje, data.fecha, data.estado]);

    } else if (data.action === 'update_estado') {
      const sheet = ss.getSheetByName('Mayoristas');
      if (sheet) {
        const vals = sheet.getDataRange().getValues();
        for (let i = 1; i < vals.length; i++) {
          if (String(vals[i][0]) === String(data.id)) {
            sheet.getRange(i + 1, 8).setValue(data.estado);
            break;
          }
        }
      }

    } else if (data.action === 'delete_suscriptor') {
      const sheet = ss.getSheetByName('Suscriptores');
      if (sheet) {
        const vals = sheet.getDataRange().getValues();
        for (let i = vals.length - 1; i >= 1; i--) {
          if (vals[i][0] === data.email) { sheet.deleteRow(i + 1); break; }
        }
      }

    } else if (data.action === 'delete_mayorista') {
      const sheet = ss.getSheetByName('Mayoristas');
      if (sheet) {
        const vals = sheet.getDataRange().getValues();
        for (let i = vals.length - 1; i >= 1; i--) {
          if (String(vals[i][0]) === String(data.id)) { sheet.deleteRow(i + 1); break; }
        }
      }

    } else if (data.action === 'clear_suscriptores') {
      const sheet = ss.getSheetByName('Suscriptores');
      if (sheet && sheet.getLastRow() > 1)
        sheet.deleteRows(2, sheet.getLastRow() - 1);

    } else if (data.action === 'clear_mayoristas') {
      const sheet = ss.getSheetByName('Mayoristas');
      if (sheet && sheet.getLastRow() > 1)
        sheet.deleteRows(2, sheet.getLastRow() - 1);
    }

    return ContentService.createTextOutput('ok');

  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.toString());
  }
}

function doGet(e) {
  const tipo = e.parameter.tipo;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    if (tipo === 'suscriptores') {
      const sheet = ss.getSheetByName('Suscriptores');
      if (!sheet || sheet.getLastRow() <= 1) return jsonOut([]);
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      return jsonOut(rows.map(r => ({ email: r[0], fecha: r[1] })));

    } else if (tipo === 'mayoristas') {
      const sheet = ss.getSheetByName('Mayoristas');
      if (!sheet || sheet.getLastRow() <= 1) return jsonOut([]);
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
      return jsonOut(rows.map(r => ({
        id: r[0], nombre: r[1], email: r[2], telefono: r[3],
        tipo: r[4], mensaje: r[5], fecha: r[6], estado: r[7]
      })));
    }

    return jsonOut({ error: 'tipo no reconocido' });

  } catch (err) {
    return jsonOut({ error: err.toString() });
  }
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}
