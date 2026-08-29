/**
 * Ventanas en las que Zéndity no estuvo disponible para el personal.
 *
 * POR QUE EXISTE. El 28-ago-2026, un cambio mío en el guardia de navegación
 * dejó la pantalla de login sin redirigir después de autenticar: las
 * credenciales se validaban, la sesión se creaba, y nadie llevaba a la persona
 * a su pantalla. Quien ya tenía sesión abierta siguió trabajando; quien tenía
 * que entrar de nuevo se quedó fuera casi ocho horas.
 *
 * El problema no acaba cuando se arregla el login. Zéndity castiga por lo que
 * NO se registró:
 *
 *   - /api/cron/vitals-reminder descuenta 2 puntos por cada orden de vitales
 *     vencida sin completar. Al restaurarse el acceso había 51 vencidas en la
 *     ventana, sin penalizar: 64 puntos contra Mariangelie y 38 contra Krystal.
 *   - /api/care/postural descuenta 5 puntos cuando pasan más de 135 minutos
 *     desde la última rotación. La primera rotación que alguien registre tras
 *     la caída arrastra el hueco entero — y castiga justo a quien lo está
 *     cerrando.
 *
 * Castigar a alguien por no usar un sistema al que no podía entrar no es medir
 * desempeño. Es cobrarle a la persona equivocada.
 *
 * COMO SE USA. Los cálculos de penalidad consultan solapaConSinServicio() y se
 * saltan la deducción. El premio NO se toca: quien registró a tiempo dentro de
 * lo que pudo, se lo gana igual.
 *
 * Las fechas van en UTC. Puerto Rico es AST (UTC-4) todo el año, sin horario
 * de verano.
 */

export interface VentanaSinServicio {
    desde: Date;
    hasta: Date;
    motivo: string;
}

export const VENTANAS_SIN_SERVICIO: VentanaSinServicio[] = [
    {
        // 14:24 AST — se despliega el cambio que rompe el login.
        desde: new Date('2026-08-28T18:24:00Z'),
        // Sábado 29-ago 18:01 AST — se despliega el arreglo y Andrés confirma
        // que entra. Se deja hasta las 20:00 AST: entre el despliegue y que
        // cada tableta recargue el JavaScript viejo pasa un rato.
        //
        // La primera versión de esta ventana cerraba el viernes a las 23:00,
        // porque di por hecho que la caída había sido de una tarde. Fueron 28
        // HORAS: viernes 14:24 → sábado 18:01. Comprobado contra las fechas de
        // los commits, no de memoria.
        hasta: new Date('2026-08-30T00:00:00Z'),
        motivo: 'Login sin redirección tras autenticar (despliegue c57a123). 28 horas — viernes 14:24 a sábado 18:01. El personal que tenía que entrar de nuevo no podía.',
    },
];

/** ¿Este instante cae dentro de una ventana sin servicio? */
export function sinServicio(momento: Date): boolean {
    return VENTANAS_SIN_SERVICIO.some(v => momento >= v.desde && momento <= v.hasta);
}

/**
 * ¿El periodo [desde, hasta] toca alguna ventana sin servicio?
 *
 * Para las penalidades por hueco —rotación, sobre todo— lo que importa no es
 * dónde cae el registro sino si el HUECO atraviesa la caída. La rotación que
 * se hace a las 23:00 después de una caída de 8 horas no es un descuido de
 * quien la hace.
 */
export function solapaConSinServicio(desde: Date, hasta: Date): boolean {
    return VENTANAS_SIN_SERVICIO.some(v => desde <= v.hasta && hasta >= v.desde);
}

/** El motivo, para dejarlo escrito en la nota en vez de callar la excepción. */
export function motivoSinServicio(desde: Date, hasta: Date): string | null {
    return VENTANAS_SIN_SERVICIO.find(v => desde <= v.hasta && hasta >= v.desde)?.motivo ?? null;
}
