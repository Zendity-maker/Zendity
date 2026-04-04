import jsPDF from "jspdf";

export function generateZendityCertificate(
    employeeName: string,
    courseTitle: string,
    completionDate: string
) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210;

    // Fondo
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, H, "F");

    // Borde decorativo exterior
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(1.5);
    doc.rect(8, 8, W - 16, H - 16, "S");

    // Borde interior fino
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(0.3);
    doc.rect(12, 12, W - 24, H - 24, "S");

    // Header — ZENDITY
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(93, 202, 165);
    doc.text("ZENDITY", W / 2, 32, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Healthcare Management Platform", W / 2, 38, { align: "center" });

    // Línea separadora
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(0.3);
    doc.line(60, 43, W - 60, 43);

    // Título del certificado
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("CERTIFICA QUE", W / 2, 56, { align: "center" });

    // Nombre del empleado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text(employeeName, W / 2, 76, { align: "center" });

    // Línea bajo el nombre
    const nameWidth = doc.getTextWidth(employeeName);
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(0.5);
    doc.line((W - nameWidth) / 2, 80, (W + nameWidth) / 2, 80);

    // Texto de completación
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("ha completado satisfactoriamente el curso oficial", W / 2, 93, { align: "center" });

    // Título del curso
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(93, 202, 165);
    const splitTitle = doc.splitTextToSize(courseTitle, 200);
    doc.text(splitTitle, W / 2, 107, { align: "center" });

    // Texto adicional
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("de la serie oficial de protocolos operativos de Zendity Academy", W / 2, 126, { align: "center" });

    // Footer — fecha y sello
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(0.3);
    doc.line(60, 152, W - 60, 152);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`Fecha de emisión: ${completionDate}`, W / 2, 160, { align: "center" });
    doc.text("Este certificado valida la capacitación del personal en los protocolos operativos de Zendity.", W / 2, 166, { align: "center" });

    // Sello ZENDITY CERTIFIED
    doc.setFillColor(29, 158, 117);
    doc.circle(W / 2, 185, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text("ZENDITY", W / 2, 183, { align: "center" });
    doc.text("CERTIFIED", W / 2, 187, { align: "center" });

    doc.save(`Certificado_Zendity_${employeeName.replace(/\s/g, "_")}_${courseTitle.slice(0, 20).replace(/\s/g, "_")}.pdf`);
}

export function generateZendityMasterCertificate(employeeName: string, completionDate: string) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210;

    // Fondo premium oscuro con degradado visual
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, W, H, "F");

    // Franja decorativa superior
    doc.setFillColor(29, 158, 117);
    doc.rect(0, 0, W, 3, "F");

    // Franja decorativa inferior
    doc.setFillColor(29, 158, 117);
    doc.rect(0, H - 3, W, 3, "F");

    // Borde dorado
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(2);
    doc.rect(10, 10, W - 20, H - 20, "S");

    doc.setDrawColor(93, 202, 165);
    doc.setLineWidth(0.4);
    doc.rect(14, 14, W - 28, H - 28, "S");

    // ZENDITY ACADEMY
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(93, 202, 165);
    doc.text("ZENDITY ACADEMY", W / 2, 30, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Healthcare Management Platform  •  Certificación Oficial de Personal", W / 2, 37, { align: "center" });

    // Línea
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(0.5);
    doc.line(50, 43, W - 50, 43);

    // CERTIFICADO MAESTRO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(29, 158, 117);
    doc.text("CERTIFICADO MAESTRO DE PERSONAL ADIESTRADO EN ZENDITY", W / 2, 53, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Otorgado con distinción a", W / 2, 63, { align: "center" });

    // Nombre
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.setTextColor(255, 255, 255);
    doc.text(employeeName, W / 2, 83, { align: "center" });

    const nameWidth = doc.getTextWidth(employeeName);
    doc.setDrawColor(93, 202, 165);
    doc.setLineWidth(0.7);
    doc.line((W - nameWidth) / 2, 87, (W + nameWidth) / 2, 87);

    // Texto descriptivo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("por haber completado con éxito la Serie Oficial Completa de Protocolos Operativos", W / 2, 99, { align: "center" });

    // Los 8 cursos en dos columnas
    const cursos = [
        "1. Proceso de Cierre de Turno",
        "2. Admisión de Residentes",
        "3. Administración de Medicamentos — eMAR",
        "4. Respuesta a Incidentes de Caída",
        "5. Handover de Enfermería",
        "6. Uso de Zendi AI",
        "7. Acceso, Roles y Gestión de Usuarios",
        "8. Planta Física y Mantenimiento"
    ];

    doc.setFontSize(7.5);
    doc.setTextColor(93, 202, 165);
    cursos.slice(0, 4).forEach(function(c, i) {
        doc.text("✓ " + c, 55, 112 + i * 8);
    });
    cursos.slice(4).forEach(function(c, i) {
        doc.text("✓ " + c, W / 2 + 10, 112 + i * 8);
    });

    // Línea
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(0.3);
    doc.line(50, 152, W - 50, 152);

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`Fecha de emisión: ${completionDate}`, W / 2, 161, { align: "center" });
    doc.text("Este certificado acredita al portador como Personal Adiestrado en Zendity conforme a los estándares operativos del sistema.", W / 2, 167, { align: "center" });

    // Sello maestro
    doc.setFillColor(29, 158, 117);
    doc.circle(W / 2, 183, 12, "F");
    doc.setFillColor(10, 15, 30);
    doc.circle(W / 2, 183, 9, "F");
    doc.setFillColor(29, 158, 117);
    doc.circle(W / 2, 183, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4);
    doc.setTextColor(255, 255, 255);
    doc.text("MASTER", W / 2, 181.5, { align: "center" });
    doc.text("CERT", W / 2, 184.5, { align: "center" });

    doc.save(`Certificado_Maestro_Zendity_${employeeName.replace(/\s/g, "_")}.pdf`);
}
