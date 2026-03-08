import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !session.user.headquartersId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { patientId, title } = await req.json();

        if (!patientId || !title) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch Patient Info to inject into the template
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                familyMembers: true
            }
        });

        if (!patient) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        // We assume the Primary Family Member is the first one, or null if there is none
        const primaryFamilyMember = patient.familyMembers.length > 0 ? patient.familyMembers[0] : null;

        // 2. Build the HTML/Markdown Contract Template
        const currentDate = new Date().toLocaleDateString("es-ES", { year: 'numeric', month: 'long', day: 'numeric' });

        let htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="text-align: center; color: #1e3a8a;">${title}</h1>
        <p style="text-align: right; color: #666;">Fecha: <strong>${currentDate}</strong></p>
        
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        
        <h3 style="color: #1e3a8a;">1. Partes Involucradas</h3>
        <p>Por la presente, la Administración Clínica (Zendity Network) y el Familiar/Encargado responsable acuerdan los términos para el cuidado asistido del Residente.</p>
        
        <ul style="background: #f8fafc; padding: 15px 30px; border-radius: 8px;">
          <li><strong>Nombre del Residente:</strong> ${patient.name}</li>
          <li><strong>Cuarto/Habitación:</strong> ${patient.roomNumber || "No Asignado"}</li>
          <li><strong>Familiar Responsable:</strong> ${primaryFamilyMember ? primaryFamilyMember.name : "_________________________"}</li>
        </ul>

        <h3 style="color: #1e3a8a;">2. Acuerdos y Relevos</h3>
        <p>El Familiar responsable comprende y autoriza a la facilidad geriátrica a proveer cuidados de Actividades de la Vida Diaria (ADLs), administración de medicamentos (eMAR) y protocolos de Triage de emergencia según sea documentado en el sistema <strong>Zendity</strong>.</p>
        <p>Este documento releva a la institución de responsabilidades derivadas de condiciones médicas preexistentes no reportadas durante el protocolo de admisión.</p>

        <h3 style="color: #1e3a8a;">3. Firmas Legales</h3>
        <p>Al plasmar su firma biométrica o vectorial a continuación, el Familiar Responsable acepta bajo la ley los términos y condiciones del presente <i>${title}</i>.</p>
        
        <!-- El canvas de firma se insertará dinámicamente en el render PDF -->
      </div>
    `;

        // 3. Create the LegalDocument in the Database
        const document = await prisma.legalDocument.create({
            data: {
                headquartersId: session.user.headquartersId,
                title: title,
                content: htmlContent,
                patientId: patient.id,
                familyMemberId: primaryFamilyMember ? primaryFamilyMember.id : null,
                status: "PENDING"
            }
        });

        return NextResponse.json({ success: true, document });

    } catch (error) {
        console.error("[INTAKE_GENERATE_POST]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
