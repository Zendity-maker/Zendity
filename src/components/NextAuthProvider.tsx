"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";

/**
 * LA SESIÓN SE REFRESCA SOLA MIENTRAS LA TABLETA ESTÉ EN USO.
 *
 * Esto era `<SessionProvider>` pelado. Sin `refetchInterval`, next-auth solo
 * llama a `/api/auth/session` al montar y al volver a la pestaña — y una
 * tableta que se queda abierta y visible durante todo el turno no hace ni una
 * cosa ni la otra. Con `maxAge: 8h` en el JWT, a las ocho horas de haber
 * entrado todo lo que escribiera devolvía 401.
 *
 * Medido el 29-sep-2026: la mediana del turno es 7,69 h y 236 de 1.062 turnos
 * pasan de 8 h. El fallo no era raro: era el turno largo, que es justo el día
 * en que una cuidadora menos necesita pelearse con la pantalla.
 *
 * Cinco minutos es barato —una petición pequeña— y con `updateAge: 30min` en
 * auth.ts basta para que el JWT se re-firme antes de caducar.
 *
 * `refetchOnWindowFocus` vuelve a comprobar al recuperar la pestaña, que es
 * cuando la tableta lleva un rato bloqueada en el bolsillo de la bata.
 */
export const NextAuthProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
            {children}
        </SessionProvider>
    );
};
