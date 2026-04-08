'use client';
import jsPDF from 'jspdf';

const TEAL = '#1D9E75';
const TEAL_DARK = '#0F6E56';
const GOLD = '#C9A84C';
const GOLD_LIGHT = '#E8C97A';
const SLATE = '#0F172A';
const SLATE2 = '#1E293B';
const WHITE = '#FFFFFF';
const OFF_WHITE = '#F8F6F0';
const GRAY = '#94A3B8';

function drawUniversityCertificate(doc: jsPDF, W: number, H: number) {
    // Cream background
    doc.setFillColor(OFF_WHITE);
    doc.rect(0, 0, W, H, 'F');

    // Outer gold border
    doc.setDrawColor(GOLD);
    doc.setLineWidth(3);
    doc.rect(8, 8, W - 16, H - 16);

    // Inner gold border
    doc.setDrawColor(GOLD_LIGHT);
    doc.setLineWidth(0.8);
    doc.rect(12, 12, W - 24, H - 24);

    // Corner ornaments
    const corners = [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]];
    corners.forEach(([cx, cy]) => {
        doc.setFillColor(GOLD);
        doc.circle(cx, cy, 2.5, 'F');
        doc.setFillColor(GOLD_LIGHT);
        doc.circle(cx, cy, 1.2, 'F');
    });

    // Top teal decorative band
    doc.setFillColor(TEAL_DARK);
    doc.rect(12, 12, W - 24, 18, 'F');

    // Bottom teal band
    doc.setFillColor(TEAL_DARK);
    doc.rect(12, H - 30, W - 24, 18, 'F');
}

function drawSeal(doc: jsPDF, cx: number, cy: number, r: number, label: string, sublabel: string) {
    // Outer ring
    doc.setDrawColor(GOLD);
    doc.setLineWidth(1.5);
    doc.circle(cx, cy, r, 'S');

    // Middle ring
    doc.setDrawColor(GOLD_LIGHT);
    doc.setLineWidth(0.5);
    doc.circle(cx, cy, r - 3, 'S');

    // Inner fill
    doc.setFillColor(TEAL_DARK);
    doc.circle(cx, cy, r - 5, 'F');

    // Inner ring
    doc.setDrawColor(GOLD_LIGHT);
    doc.setLineWidth(0.3);
    doc.circle(cx, cy, r - 5, 'S');

    // Seal text
    doc.setTextColor(GOLD_LIGHT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(label, cx, cy - 3, { align: 'center' });
    doc.setFontSize(5.5);
    doc.text(sublabel, cx, cy + 3, { align: 'center' });
    doc.setFontSize(5);
    doc.text('ZENDITY', cx, cy + 8, { align: 'center' });
}

function drawDivider(doc: jsPDF, y: number, W: number) {
    const mx = W / 2;
    doc.setDrawColor(GOLD);
    doc.setLineWidth(0.3);
    doc.line(30, y, mx - 15, y);
    doc.line(mx + 15, y, W - 30, y);
    doc.setFillColor(GOLD);
    doc.circle(mx, y, 1.5, 'F');
    doc.circle(mx - 12, y, 0.8, 'F');
    doc.circle(mx + 12, y, 0.8, 'F');
}

export function generateZendityCertificate(
    employeeName: string,
    courseTitle: string,
    completionDate: string
) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297;
    const H = 210;

    drawUniversityCertificate(doc, W, H);

    // Institution header in teal band
    doc.setTextColor(GOLD_LIGHT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ZENDITY HEALTHCARE MANAGEMENT PLATFORM', W / 2, 23, { align: 'center' });

    // Academy subtitle
    doc.setFillColor(OFF_WHITE);
    doc.setTextColor(TEAL_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('ACADEMIA DE EXCELENCIA OPERATIVA', W / 2, 42, { align: 'center' });

    drawDivider(doc, 48, W);

    // Certificate declaration
    doc.setTextColor(SLATE2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Este certificado se otorga a quien a continuacion se menciona, en reconocimiento a haber', W / 2, 60, { align: 'center' });
    doc.text('completado satisfactoriamente el programa de capacitacion y superado la evaluacion oficial.', W / 2, 67, { align: 'center' });

    // Employee name
    doc.setFont('times', 'italic');
    doc.setFontSize(32);
    doc.setTextColor(SLATE);
    doc.text(employeeName, W / 2, 92, { align: 'center' });

    // Name underline
    const nameWidth = doc.getTextWidth(employeeName);
    doc.setDrawColor(GOLD);
    doc.setLineWidth(0.8);
    doc.line(W / 2 - nameWidth / 2 - 5, 95, W / 2 + nameWidth / 2 + 5, 95);

    drawDivider(doc, 103, W);

    // Course label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(GRAY);
    doc.text('por haber completado y aprobado el curso oficial', W / 2, 113, { align: 'center' });

    // Course title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(TEAL_DARK);
    doc.text(courseTitle.toUpperCase(), W / 2, 126, { align: 'center' });

    // Course underline
    const ctWidth = doc.getTextWidth(courseTitle.toUpperCase());
    doc.setDrawColor(TEAL);
    doc.setLineWidth(0.5);
    doc.line(W / 2 - ctWidth / 2, 129, W / 2 + ctWidth / 2, 129);

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(GRAY);
    doc.text(`Otorgado el ${completionDate}`, W / 2, 142, { align: 'center' });

    // Signature line — left
    doc.setDrawColor(SLATE2);
    doc.setLineWidth(0.3);
    doc.line(40, 165, 110, 165);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(SLATE2);
    doc.text('Andres Flores', 75, 170, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(GRAY);
    doc.text('Director — Zendity', 75, 175, { align: 'center' });

    // Seal — center
    drawSeal(doc, W / 2, 162, 18, 'CERTIFICADO', 'OFICIAL');

    // Signature line — right
    doc.setDrawColor(SLATE2);
    doc.setLineWidth(0.3);
    doc.line(187, 165, 257, 165);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(SLATE2);
    doc.text('Sede Certificadora', 222, 170, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(GRAY);
    doc.text('Vivid Senior Living Cupey', 222, 175, { align: 'center' });

    // Bottom band text
    doc.setTextColor(GOLD_LIGHT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('ZENDITY · Healthcare Management Platform · app.zendity.com · Puerto Rico', W / 2, H - 18, { align: 'center' });

    doc.save(`Certificado_Zendity_${employeeName}_${courseTitle}.pdf`);
}

export function generateZendityMasterCertificate(
    employeeName: string,
    completionDate: string
) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297;
    const H = 210;

    drawUniversityCertificate(doc, W, H);

    // Institution header
    doc.setTextColor(GOLD_LIGHT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ZENDITY HEALTHCARE MANAGEMENT PLATFORM', W / 2, 23, { align: 'center' });

    // Master title
    doc.setTextColor(TEAL_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ACADEMIA DE EXCELENCIA OPERATIVA', W / 2, 40, { align: 'center' });

    // Gold master badge
    doc.setFillColor(GOLD);
    doc.roundedRect(W / 2 - 38, 44, 76, 8, 2, 2, 'F');
    doc.setTextColor(SLATE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('CERTIFICADO MAESTRO — SERIE COMPLETA DE PROTOCOLOS', W / 2, 49.5, { align: 'center' });

    drawDivider(doc, 56, W);

    // Declaration
    doc.setTextColor(SLATE2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Con especial distincion, se certifica que el profesional que a continuacion se indica ha completado', W / 2, 65, { align: 'center' });
    doc.text('la Serie Oficial Completa de Protocolos de Zendity, demostrando dominio operativo y clinico integral.', W / 2, 72, { align: 'center' });

    // Employee name
    doc.setFont('times', 'italic');
    doc.setFontSize(30);
    doc.setTextColor(SLATE);
    doc.text(employeeName, W / 2, 92, { align: 'center' });

    const nameWidth = doc.getTextWidth(employeeName);
    doc.setDrawColor(GOLD);
    doc.setLineWidth(1);
    doc.line(W / 2 - nameWidth / 2 - 5, 95, W / 2 + nameWidth / 2 + 5, 95);

    drawDivider(doc, 101, W);

    // Courses — two columns
    const courses = [
        'Cierre de Turno', 'Admision de Residentes',
        'eMAR Digital', 'Protocolo de Caidas',
        'Handover Clinico', 'Zendi AI',
        'Acceso y Roles', 'Mantenimiento'
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const col1X = 55;
    const col2X = 165;
    let rowY = 112;

    for (let i = 0; i < courses.length; i += 2) {
        // Left
        doc.setFillColor(TEAL);
        doc.circle(col1X - 6, rowY - 1.5, 1.5, 'F');
        doc.setTextColor(SLATE2);
        doc.text(courses[i], col1X, rowY, { align: 'left' });

        // Right
        if (courses[i + 1]) {
            doc.setFillColor(TEAL);
            doc.circle(col2X - 6, rowY - 1.5, 1.5, 'F');
            doc.setTextColor(SLATE2);
            doc.text(courses[i + 1], col2X, rowY, { align: 'left' });
        }
        rowY += 8;
    }

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(GRAY);
    doc.text(`Serie completada el ${completionDate}`, W / 2, 152, { align: 'center' });

    // Signatures
    doc.setDrawColor(SLATE2);
    doc.setLineWidth(0.3);
    doc.line(35, 168, 105, 168);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(SLATE2);
    doc.text('Andres Flores', 70, 173, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(GRAY);
    doc.text('Director — Zendity', 70, 178, { align: 'center' });

    // Master seal — center, larger
    drawSeal(doc, W / 2, 165, 22, 'CERTIFICADO', 'MAESTRO');

    doc.setDrawColor(SLATE2);
    doc.setLineWidth(0.3);
    doc.line(192, 168, 262, 168);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(SLATE2);
    doc.text('Sede Certificadora', 227, 173, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(GRAY);
    doc.text('Vivid Senior Living Cupey', 227, 178, { align: 'center' });

    // Bottom band
    doc.setTextColor(GOLD_LIGHT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('ZENDITY · Healthcare Management Platform · app.zendity.com · Puerto Rico', W / 2, H - 18, { align: 'center' });

    doc.save(`Certificado_Maestro_Zendity_${employeeName}.pdf`);
}
