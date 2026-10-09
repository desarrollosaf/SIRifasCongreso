// Utilidades para los nombres de SAF (s_usuario).
// En SAF muchos registros traen el nombre completo en "Nombre" con el orden
// "PATERNO MATERNO NOMBRES" y A_Paterno/A_Materno vacíos.

const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'SAN', 'SANTA', 'MC', 'MAC', 'VAN', 'VON', 'DA', 'DI', 'DO', 'DOS']);

const limpiar = (s: string | null | undefined) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Igual que buildNombreCompleto de SIAdministracion: evita duplicar apellidos
export const nombreCompleto = (nombre?: string | null, paterno?: string | null, materno?: string | null): string => {
    const n = limpiar(nombre), p = limpiar(paterno), m = limpiar(materno);
    if (p && n.toUpperCase().startsWith(p.toUpperCase() + ' ')) return n;
    return [n, p, m].filter(Boolean).join(' ');
};

// "JUAN CARLOS" → "Juan Carlos" (respeta acentos y partículas en minúscula)
export const tipoTitulo = (s: string): string => s.toLocaleLowerCase('es-MX')
    .split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p.toUpperCase())) ? p : p.charAt(0).toLocaleUpperCase('es-MX') + p.slice(1))
    .join(' ');

// Saca un apellido del inicio (con sus partículas: "DE LOS SANTOS", "DEL VALLE")
const tomarApellido = (palabras: string[]): string[] => {
    const apellido: string[] = [];
    while (palabras.length > 1 && PARTICULAS.has(palabras[0].toUpperCase())) apellido.push(palabras.shift()!);
    if (palabras.length) apellido.push(palabras.shift()!);
    return apellido;
};

// Nombre(s) de pila para saludar en pantalla: "¡Felicidades, Omar Salvador!"
export const nombrePila = (nombre?: string | null, paterno?: string | null, materno?: string | null): string | null => {
    const n = limpiar(nombre), p = limpiar(paterno);
    if (!n) return null;
    // Apellidos en sus propias columnas: "Nombre" ya es el nombre de pila
    if (p && !n.toUpperCase().startsWith(p.toUpperCase() + ' ')) return tipoTitulo(n);

    // Todo junto en "PATERNO MATERNO NOMBRES"
    const palabras = n.split(' ');
    if (palabras.length <= 2) return tipoTitulo(palabras[palabras.length - 1]);
    const resto = [...palabras];
    tomarApellido(resto);
    if (resto.length > 1) tomarApellido(resto);
    return tipoTitulo((resto.length ? resto : [palabras[palabras.length - 1]]).join(' '));
};
