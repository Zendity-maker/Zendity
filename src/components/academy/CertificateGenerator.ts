import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateZendityCertificate = async (userName: string, courseTitle: string, date: string) => {
    // 1. Crear un contenedor temporal oculto en el DOM
    const certContainer = document.createElement("div");
    certContainer.style.position = "absolute";
    certContainer.style.left = "-9999px";
    certContainer.style.width = "1056px"; // Tamaño Carta (Landscape)
    certContainer.style.height = "816px";
    certContainer.style.backgroundColor = "#ffffff";
    certContainer.style.display = "flex";
    certContainer.style.justifyContent = "center";
    certContainer.style.alignItems = "center";
    document.body.appendChild(certContainer);

    // 2. CSS Injectado para el Certificado Oficial Zendity
    certContainer.innerHTML = `
        <div style="width: 1000px; height: 760px; border: 15px solid #1e1b4b; padding: 40px; position: relative; background: linear-gradient(135deg, white 0%, #f1f5f9 100%); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center; box-sizing: border-box;">
            
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 10px; background: linear-gradient(90deg, #4f46e5, #06b6d4);"></div>
            
            <div style="margin-top: 40px; display: flex; flex-direction: column; align-items: center;">
                <div style="display: flex; align-items: center; gap: 15px; justify-content: center;">
                    <img src="/brand/zendity_icon_primary.svg" style="height: 55px; width: auto;" crossorigin="anonymous" />
                    <h1 style="font-size: 55px; font-weight: 900; color: #1e1b4b; margin: 0; letter-spacing: -1px;">ZENDITY ACADEMY</h1>
                </div>
                <p style="font-size: 16px; color: #64748b; text-transform: uppercase; letter-spacing: 4px; font-weight: bold; margin-top: 10px;">Centro Oficial de Excelencia Operativa</p>
            </div>

            <div style="margin-top: 80px;">
                <p style="font-size: 20px; color: #475569; margin-bottom: 20px;">Este documento certifica que</p>
                <h2 style="font-size: 60px; font-weight: bold; color: #0f172a; margin: 0; border-bottom: 2px solid #cbd5e1; display: inline-block; padding-bottom: 10px; min-width: 60%;">
                    ${userName}
                </h2>
            </div>

            <div style="margin-top: 40px;">
                <p style="font-size: 20px; color: #475569; margin-bottom: 20px;">ha completado satisfactoriamente los requisitos y acreditado el dominio del curso oficial:</p>
                <h3 style="font-size: 30px; font-weight: bold; color: #4f46e5; margin: 0;">${courseTitle}</h3>
            </div>

            <div style="margin-top: 80px; display: flex; justify-content: space-around; align-items: flex-end;">
                <div style="text-align: center;">
                    <div style="border-bottom: 1px solid #94a3b8; width: 250px; margin: 0 auto 10px auto;"></div>
                    <p style="font-size: 14px; color: #475569; font-weight: bold;">Director Académico Zendity</p>
                </div>
                
                <div style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid #4f46e5; display: flex; align-items: center; justify-content: center; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                    <div style="text-align: center;">
                        <span style="font-size: 24px; font-weight: 900; color: #1e1b4b;">VERIFIED</span>
                    </div>
                </div>

                <div style="text-align: center;">
                    <p style="font-size: 18px; color: #1e1b4b; font-weight: bold; margin-bottom: 5px;">${date}</p>
                    <div style="border-bottom: 1px solid #94a3b8; width: 250px; margin: 0 auto 10px auto;"></div>
                    <p style="font-size: 14px; color: #475569; font-weight: bold;">Fecha de Autenticación</p>
                </div>
            </div>

            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 10px; background: linear-gradient(90deg, #06b6d4, #4f46e5);"></div>
        </div>
    `;

    try {
        const canvas = await html2canvas(certContainer, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF("l", "pt", "letter");
        pdf.addImage(imgData, "PNG", 0, 0, 792, 612); // Puntos de tamaño carta horizontal
        pdf.save(`Zendity_Certified_${userName.replace(/\s+/g, '_')}_${courseTitle.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
        console.error("Error generating certificate", e);
        alert("Fallo al generar el diploma en PDF.");
    } finally {
        document.body.removeChild(certContainer);
    }
};
