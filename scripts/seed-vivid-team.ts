import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Iniciando inyección de personal oficial en NeonDB...");

    // 1. Obtener Sede principal (Vivid Senior Living Cupey)
    let hq = await prisma.headquarters.findFirst();
    if (!hq) {
        hq = await prisma.headquarters.create({
            data: {
                name: "Vivid Senior Living Cupey",
                licenseActive: true,
                licenseExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            }
        });
        console.log("Sede Vivid Cupey ha sido inicializada.");
    } else {
        console.log(`Sede vinculada: ${hq.name}`);
    }

    const defaultPin = "1234";

    const officialStaff = [
        // Celia aparecía como enfermera y recepcionista/admin. 
        // En Prisma el rol ADMIN le da poderes totales en el dashboard.
        { name: "Celia Sierra", email: "sierracelia55@gmail.com", role: "ADMIN", pinCode: defaultPin },
        { name: "Andres Flores", email: "andrestyflores@gmail.com", role: "DIRECTOR", pinCode: defaultPin },
        { name: "Yeray Flores", email: "yerayzamilf@gmail.com", role: "CAREGIVER", pinCode: defaultPin },
        // Mariangelie no tenía rol especificado, le asignamos Cuidadora (puede cambiarse luego).
        { name: "Mariangelie Carmona", email: "mariangelierivera1047@gmail.com", role: "CAREGIVER", pinCode: defaultPin },
        { name: "Joaneliz Rosario", email: "joanelizrosario739@gmail.com", role: "CAREGIVER", pinCode: defaultPin },
        { name: "Zuleika Valcarcel", email: "valcárcelleylanis@icloud.com", role: "CAREGIVER", pinCode: defaultPin }, // Corregido el tilde si causa issues, idealmente email limpio: valcarcelleylanis... lo dejamos así si iCloud lo permite.
    ];

    for (const st of officialStaff) {
        // Limpiamos formato: a veces los celulares mandan la primera letra del mail en mayúscula.
        const cleanEmail = st.email.toLowerCase().trim();

        const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });

        if (existing) {
            await prisma.user.update({
                where: { email: cleanEmail },
                data: {
                    name: st.name,
                    role: st.role as any,
                    pinCode: st.pinCode
                }
            });
            console.log(`[ACTUALIZADO] ${st.name} (${st.role}) -> ${cleanEmail}`);
        } else {
            await prisma.user.create({
                data: {
                    name: st.name,
                    email: cleanEmail,
                    role: st.role as any,
                    pinCode: st.pinCode,
                    headquartersId: hq.id,
                }
            });
            console.log(`[CREADO] ${st.name} (${st.role}) -> ${cleanEmail}`);
        }
    }

    console.log("\n✅ Carga Completa. Todo el personal de Vivid Cupey está ahora en Producción.");
}

main()
    .catch((e) => {
        console.error("❌ Error al inyectar personal:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
