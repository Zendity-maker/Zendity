import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import PrintButton from './PrintButton';

interface EmergencyCardMedication {
  name: string;
  category: string | null;
  dosage: string | null;
  route: string | null;
  frequency: string | null;
  instructions: string | null;
}

interface EmergencyCard {
  id: string;
  name: string;
  roomNumber: string | null;
  dateOfBirth: string | null;
  photoUrl: string | null;
  allergiesText: string;
  diagnoses: string | null;
  diet: string | null;
  needsDialysis: boolean;
  preferredHospital: string | null;
  insurancePlanName: string | null;
  insurancePolicyNumber: string | null;
  medicareNumber: string | null;
  medicaidNumber: string | null;
  medications: EmergencyCardMedication[];
  primaryFamilyMember: {
    name: string;
    phone: string;
    relationship: string;
  } | null;
  headquarters: {
    name: string;
    phone: string | null;
  } | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No especificado';
  try {
    return new Date(dateStr).toLocaleDateString('es-PR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default async function EmergencyPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  let card: EmergencyCard | null = null;
  let fetchError = false;

  try {
    const res = await fetch(`${base}/api/corporate/patients/${id}/emergency-card`, {
      cache: 'no-store',
      headers: {
        Cookie: cookieHeader,
      },
    });

    if (!res.ok) {
      fetchError = true;
    } else {
      const json = await res.json();
      if (json.success && json.card) {
        card = json.card as EmergencyCard;
      } else {
        fetchError = true;
      }
    }
  } catch {
    fetchError = true;
  }

  const now = new Date();
  const generatedDate = now.toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const currentYear = now.getFullYear();

  if (fetchError || !card) {
    return (
      <div className="min-h-screen bg-white p-8 font-sans flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg font-semibold">
            No se pudo cargar la tarjeta de emergencia.
          </p>
          <p className="text-slate-500 mt-2 text-sm">
            Verifique que el paciente existe y que tiene los permisos necesarios.
          </p>
        </div>
      </div>
    );
  }

  const allergiesIsNone = card.allergiesText.toLowerCase().startsWith('ninguna');

  return (
    <div className="min-h-screen bg-white p-8 font-sans max-w-3xl mx-auto">
      {/* Print CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .no-print { display: none !important; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `,
        }}
      />

      {/* Top bar — no-print controls */}
      <div className="no-print flex items-center justify-between mb-6">
        <PrintButton />
        <span className="text-xs text-slate-400">
          Vista previa — use el botón para imprimir o guardar como PDF
        </span>
      </div>

      {/* Title */}
      <div className="text-center mb-2">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight uppercase">
          Tarjeta de Emergencia
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          GENERADO: {generatedDate} &mdash; CONFIDENCIAL
        </p>
      </div>

      <hr className="border-slate-300 mb-6" />

      {/* Header — photo + name + room + dob + HQ */}
      <div className="flex items-center gap-5 mb-6">
        {card.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.photoUrl}
            alt={`Foto de ${card.name}`}
            className="w-20 h-20 rounded-full object-cover border-2 border-slate-300 flex-shrink-0"
          />
        )}
        <div>
          <h2 className="text-3xl font-bold text-slate-900">{card.name}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-600">
            {card.roomNumber && (
              <span>
                <span className="font-semibold">Habitación:</span> {card.roomNumber}
              </span>
            )}
            <span>
              <span className="font-semibold">Fecha de nacimiento:</span>{' '}
              {formatDate(card.dateOfBirth)}
            </span>
            {card.headquarters && (
              <span>
                <span className="font-semibold">Sede:</span> {card.headquarters.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ALERGIAS */}
      <section
        className={`rounded-lg border-2 p-4 mb-5 ${
          allergiesIsNone
            ? 'border-green-500 bg-green-50'
            : 'border-red-500 bg-red-50'
        }`}
      >
        <h3
          className={`text-xs font-bold uppercase tracking-widest mb-1 ${
            allergiesIsNone ? 'text-green-700' : 'text-red-700'
          }`}
        >
          Alergias
        </h3>
        <p
          className={`text-sm font-bold ${
            allergiesIsNone ? 'text-green-800' : 'text-red-900'
          }`}
        >
          {card.allergiesText}
        </p>
      </section>

      {/* Medicamentos Activos */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
          Medicamentos Activos
        </h3>
        {card.medications.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Sin medicamentos activos.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="px-3 py-2 font-semibold text-slate-700 border border-slate-200">
                  Medicamento
                </th>
                <th className="px-3 py-2 font-semibold text-slate-700 border border-slate-200">
                  Categoría
                </th>
                <th className="px-3 py-2 font-semibold text-slate-700 border border-slate-200">
                  Dosis
                </th>
                <th className="px-3 py-2 font-semibold text-slate-700 border border-slate-200">
                  Frecuencia
                </th>
              </tr>
            </thead>
            <tbody>
              {card.medications.map((med, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                >
                  <td className="px-3 py-2 border border-slate-200 font-medium text-slate-800">
                    {med.name}
                  </td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">
                    {med.category || '—'}
                  </td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">
                    {med.dosage || '—'}{med.route ? ` (${med.route})` : ''}
                  </td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">
                    {med.frequency || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Diagnósticos */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
          Diagnósticos
        </h3>
        <p className="text-sm text-slate-800">{card.diagnoses || 'No especificado'}</p>
      </section>

      {/* Dieta + Diálisis */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <section className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
            Dieta
          </h3>
          <p className="text-sm text-slate-800">{card.diet || 'Regular'}</p>
        </section>
        <section className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
            Diálisis
          </h3>
          <p
            className={`text-sm font-semibold ${
              card.needsDialysis ? 'text-red-700' : 'text-green-700'
            }`}
          >
            {card.needsDialysis ? 'Sí' : 'No'}
          </p>
        </section>
      </div>

      {/* Contacto de Emergencia */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
          Contacto de Emergencia
        </h3>
        {card.primaryFamilyMember ? (
          <div className="text-sm text-slate-800">
            <span className="font-semibold">{card.primaryFamilyMember.name}</span>
            {card.primaryFamilyMember.relationship && (
              <span className="text-slate-500">
                {' '}
                ({card.primaryFamilyMember.relationship})
              </span>
            )}
            {card.primaryFamilyMember.phone && (
              <span className="ml-3 text-teal-700 font-medium">
                {card.primaryFamilyMember.phone}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No registrado.</p>
        )}
      </section>

      {/* Hospital Preferido */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
          Hospital Preferido
        </h3>
        <p className="text-sm text-slate-800">
          {card.preferredHospital || 'No especificado'}
        </p>
      </section>

      {/* Seguro */}
      <section className="mb-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
          Información de Seguro
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-700">
          {card.insurancePlanName && (
            <div>
              <span className="font-semibold">Plan:</span> {card.insurancePlanName}
            </div>
          )}
          {card.insurancePolicyNumber && (
            <div>
              <span className="font-semibold">Póliza:</span> {card.insurancePolicyNumber}
            </div>
          )}
          {card.medicareNumber && (
            <div>
              <span className="font-semibold">Medicare:</span> {card.medicareNumber}
            </div>
          )}
          {card.medicaidNumber && (
            <div>
              <span className="font-semibold">Medicaid:</span> {card.medicaidNumber}
            </div>
          )}
          {!card.insurancePlanName &&
            !card.insurancePolicyNumber &&
            !card.medicareNumber &&
            !card.medicaidNumber && (
              <p className="col-span-2 text-slate-400 italic">
                No hay información de seguro registrada.
              </p>
            )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-4 text-center">
        <p className="text-xs text-slate-400 leading-relaxed">
          Este documento contiene información clínica confidencial. Uso exclusivo del
          personal autorizado de{' '}
          <span className="font-semibold text-slate-500">
            {card.headquarters?.name ?? 'Zéndity'}
          </span>
          .{' '}
          <span className="font-semibold text-teal-600">Zéndity</span> &copy;{' '}
          {currentYear}
        </p>
      </footer>
    </div>
  );
}
