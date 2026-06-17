import { redirect } from 'next/navigation';

// Hub compartido — /coordinator/residents redirige al directorio de
// residentes corporativo. El perfil aplica filtro de tabs por rol
// (COORDINATOR-puro ve subset reducido) en T10.
export default function CoordinatorResidentsRedirect() {
    redirect('/corporate/medical/patients');
}
