"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Loader2, ArrowLeft, PenTool, Download } from "lucide-react";
import Link from "next/link";

export default function DocumentSignerPage() {
    const params = useParams();
    const router = useRouter();
    const docId = params.id as string;

    const sigPad = useRef<any>(null);
    const documentRef = useRef<HTMLDivElement>(null);

    const [documentData, setDocumentData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [signing, setSigning] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchDoc() {
            try {
                const res = await fetch(`/api/family/documents/${docId}`);
                if (res.ok) {
                    const data = await res.json();
                    setDocumentData(data);
                } else {
                    setError("Documento no encontrado o no autorizado.");
                }
            } catch (err) {
                setError("Error cargando documento.");
            } finally {
                setLoading(false);
            }
        }
        fetchDoc();
    }, [docId]);

    const handleClear = () => {
        sigPad.current?.clear();
    };

    const handleSignAndSeal = async () => {
        if (sigPad.current?.isEmpty()) {
            setError("Por favor dibuje su firma en el recuadro antes de continuar.");
            return;
        }

        setSigning(true);
        setError("");

        try {
            // 1. Extraer la firma vectorial en Base64
            const signatureBase64 = sigPad.current.getTrimmedCanvas().toDataURL("image/png");

            // 2. Enviar la firma al servidor para sellar la BD
            const res = await fetch(`/api/family/documents/${docId}/sign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signatureData: signatureBase64 })
            });

            if (!res.ok) {
                throw new Error("No se pudo sellar el documento.");
            }

            // 3. (Opcional) Convertir el HTML en PDF Visual Combinando la Firma
            // Usamos html2canvas y jspdf para armar el descargable
            if (documentRef.current) {
                const canvas = await html2canvas(documentRef.current, { scale: 2 });
                const imgData = canvas.toDataURL("image/png");
                const pdf = new jsPDF("p", "mm", "a4");
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

                // Agregar la firma al PDF visualmente
                pdf.text("Firma Electrónica:", 15, pdfHeight - 40);
                pdf.addImage(signatureBase64, "PNG", 15, pdfHeight - 35, 50, 25);

                // pdf.save(\`Contrato_\${documentData.title}.pdf\`); 
                // Descomentar lo anterior si queremos que se descargue automático.
            }

            router.push("/family/documents?success=true");
            router.refresh();

        } catch (err: any) {
            setError(err.message);
            setSigning(false);
        }
    };

    if (loading) {
        return <div className="p-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;
    }

    if (error && !documentData) {
        return <div className="p-20 text-center text-red-500 font-bold">{error}</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            <Link href="/family/documents" className="inline-flex items-center gap-2 text-blue-600 font-medium hover:underline">
                <ArrowLeft className="w-4 h-4" /> Volver a Documentos
            </Link>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">

                {/* Document Content Renderizado desde la BD */}
                <div
                    ref={documentRef}
                    className="p-8 md:p-12 bg-white"
                    dangerouslySetInnerHTML={{ __html: documentData.content }}
                />

                {/* Zona de Firma Interactiva */}
                {documentData.status === "PENDING" ? (
                    <div className="bg-slate-50 p-6 md:p-10 border-t border-gray-200">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800 mb-4">
                            <PenTool className="w-5 h-5 text-blue-600" />
                            Trazar Firma Electrónica
                        </h3>

                        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl overflow-hidden shadow-sm relative">
                            <SignatureCanvas
                                ref={sigPad}
                                penColor="black"
                                canvasProps={{ className: "w-full h-48 cursor-crosshair" }}
                            />
                            <button
                                onClick={handleClear}
                                className="absolute top-2 right-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-md transition"
                            >
                                Limpiar
                            </button>
                        </div>

                        {error && <p className="text-red-500 mt-2 text-sm font-medium">{error}</p>}

                        <button
                            onClick={handleSignAndSeal}
                            disabled={signing}
                            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                            {signing ? "Sellando Documento Legal..." : "Aceptar y Firmar Electrónicamente"}
                        </button>
                        <p className="text-xs text-center text-gray-400 mt-4">
                            *Tus trazos biomecánicos e IP serán anclados digitalmente para validación legal corporativa.
                        </p>
                    </div>
                ) : (
                    <div className="bg-emerald-50 p-8 border-t border-emerald-100 text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <h3 className="text-2xl font-bold text-emerald-800">Documento Firmado</h3>
                        <p className="text-emerald-700 font-medium mb-6">Este documento ya fue sellado el {new Date(documentData.signedAt).toLocaleDateString()}</p>

                        <div className="bg-white p-4 inline-block rounded-xl shadow-inner border border-gray-200 mb-6">
                            <img src={documentData.signatureData} alt="Firma Electrónica" className="max-h-24 mx-auto filter grayscale opacity-90" />
                            <p className="border-t border-gray-300 mt-2 pt-1 text-xs text-gray-400 font-mono tracking-widest">FIRMA AUTORIZADA</p>
                        </div>

                        <div>
                            <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-lg inline-flex items-center gap-2 transition">
                                <Download className="w-5 h-5" /> Descargar Copia
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
