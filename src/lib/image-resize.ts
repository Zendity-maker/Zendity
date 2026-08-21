/**
 * Reescalado de imágenes en el cliente antes de subirlas.
 *
 * Las fotos se guardan como base64 en columna (IncidentReport, DailyLog,
 * UlcerLog), así que el tamaño del archivo es tamaño de base de datos. Una foto
 * de teléfono sin tocar son 3–8 MB; reescalada a 1200px son unos 200–400 KB.
 *
 * Esta lógica estaba copiada dentro de intake/page.tsx. Se extrae porque el
 * registro de úlceras necesita exactamente lo mismo, y porque el límite que
 * valida el servidor solo tiene sentido si el cliente reescala igual en todas
 * partes.
 */

/** Tope que aceptan los endpoints. Mantener alineado con la validación del API. */
export const MAX_FOTO_BYTES = 2_000_000;

export interface OpcionesReescalado {
    /** Lado mayor en píxeles. 1200 conserva detalle clínico sin inflar la fila. */
    maxLado?: number;
    /** 0 a 1. 0.85 es indistinguible a simple vista y pesa la mitad que 1. */
    calidad?: number;
}

/**
 * Devuelve un data URI JPEG reescalado.
 *
 * Lanza si el archivo no es una imagen legible, o si aun reescalada sigue por
 * encima del tope — mejor fallar aquí, con el residente delante, que en el
 * servidor cuando la foto ya no se puede volver a tomar.
 */
export async function reescalarImagen(
    file: File,
    { maxLado = 1200, calidad = 0.85 }: OpcionesReescalado = {}
): Promise<string> {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > h && w > maxLado) { h = Math.round((h * maxLado) / w); w = maxLado; }
                else if (h > maxLado) { w = Math.round((w * maxLado) / h); h = maxLado; }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('El navegador no pudo procesar la imagen.'));
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', calidad));
            };
            img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
            img.src = ev.target?.result as string;
        };
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.readAsDataURL(file);
    });

    if (base64.length > MAX_FOTO_BYTES) {
        throw new Error('La foto sigue siendo muy grande. Tómala de nuevo con menos resolución.');
    }
    return base64;
}
