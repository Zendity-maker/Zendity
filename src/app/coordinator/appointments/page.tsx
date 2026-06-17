import { redirect } from 'next/navigation';

// Hub compartido — /coordinator/appointments redirige al panel unificado.
export default function CoordinatorAppointmentsRedirect() {
    redirect('/corporate/family-appointments');
}
