import { redirect } from 'next/navigation';

// Hub compartido — /coordinator/messages redirige al panel unificado.
// El gating real vive en /corporate/family-messages (page) +
// /api/corporate/family-messages (endpoint, ya con COORDINATOR en
// ALLOWED_ROLES). Esto evita duplicar UI.
export default function CoordinatorMessagesRedirect() {
    redirect('/corporate/family-messages');
}
