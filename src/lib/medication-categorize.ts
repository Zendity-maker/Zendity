/**
 * src/lib/medication-categorize.ts
 *
 * Categorización heurística de medicamentos por nombre.
 *
 * Cubre los 20 patrones más comunes en hogares de ancianos en PR:
 * antihipertensivos, antidiabéticos, anticoagulantes, antidepresivos, etc.
 *
 * USO:
 *   import { categorizeMedication } from '@/lib/medication-categorize';
 *   const cat = categorizeMedication('Losartan 50mg');  // → 'Antihipertensivo'
 *
 * Si no encuentra match → devuelve "Sin clasificar" (mejor que "Intake Draft").
 */

interface CategoryPattern {
    category: string;
    patterns: RegExp[];
}

const PATTERNS: CategoryPattern[] = [
    {
        category: 'Antihipertensivo',
        patterns: [
            /\blosartan\b/i, /\blisinopril\b/i, /\benalapril\b/i, /\bcaptopril\b/i,
            /\bamlodipin/i, /\bnifedipin/i, /\bvalsartan\b/i, /\bcarvedilol\b/i,
            /\bmetoprolol\b/i, /\batenolol\b/i, /\bbisoprolol\b/i, /\bpropranolol\b/i,
            /\bhydralazin/i, /\bhidralazin/i, /\bhydrochlorothiaz/i, /\bhctz\b/i,
            /\bdiltiazem\b/i, /\bverapamil\b/i, /\bclonidin/i,
        ],
    },
    {
        category: 'Antidiabético',
        patterns: [
            /\bmetformin/i, /\bglipizid/i, /\bgliburi/i, /\bglimepirid/i,
            /\binsulin/i, /\bsitaglipt/i, /\blinaglipt/i, /\bdapaglifloz/i,
            /\bempaglifloz/i, /\bjanuvi/i, /\bjardianc/i, /\bjentadueto\b/i,
            /\bsaxendai?\b/i, /\bsemaglutid/i, /\bozempic\b/i,
        ],
    },
    {
        category: 'Anticoagulante',
        patterns: [
            /\bwarfarin/i, /\bcoumadin\b/i, /\bapixaban\b/i, /\beliquis\b/i,
            /\brivaroxaban\b/i, /\bxarelto\b/i, /\bdabigatran\b/i, /\bpradaxa\b/i,
            /\benoxaparin\b/i, /\blovenox\b/i, /\bheparin/i, /\bclopidogrel\b/i,
            /\bplavix\b/i, /\baspirin/i, /\bbayer\b/i,
        ],
    },
    {
        category: 'Antidepresivo',
        patterns: [
            /\bsertralin/i, /\bzoloft\b/i, /\bfluoxetin/i, /\bprozac\b/i,
            /\bcitalopram\b/i, /\bescitalopram\b/i, /\blexapro\b/i, /\bcelexa\b/i,
            /\bparoxetin/i, /\bpaxil\b/i, /\bvenlafaxin/i, /\beffexor\b/i,
            /\bduloxetin/i, /\bcymbalta\b/i, /\bmirtazapin/i, /\btrazodon/i,
            /\bbupropion\b/i, /\bwellbutrin\b/i,
        ],
    },
    {
        category: 'Ansiolítico/Hipnótico',
        patterns: [
            /\balprazolam\b/i, /\bxanax\b/i, /\blorazepam\b/i, /\bativan\b/i,
            /\bclonazepam\b/i, /\bklonopin\b/i, /\bdiazepam\b/i, /\bvalium\b/i,
            /\btemazepam\b/i, /\bzolpidem\b/i, /\bambien\b/i, /\beszopiclon/i,
            /\blunesta\b/i, /\bbuspiron/i,
        ],
    },
    {
        category: 'Antipsicótico',
        patterns: [
            /\bquetiapin/i, /\bseroquel\b/i, /\brisperidon/i, /\brisperdal\b/i,
            /\bolanzapin/i, /\bzyprexa\b/i, /\baripiprazol\b/i, /\babilify\b/i,
            /\bhaloperidol\b/i, /\bhaldol\b/i, /\bclozapin/i,
        ],
    },
    {
        category: 'Demencia/Alzheimer',
        patterns: [
            /\bdonepezil\b/i, /\baricept\b/i, /\bmemantin/i, /\bnamenda\b/i,
            /\brivastigmin/i, /\bexelon\b/i, /\bgalantamin/i,
        ],
    },
    {
        category: 'Analgésico',
        patterns: [
            /\bacetaminofen\b/i, /\bacetaminoph/i, /\btylenol\b/i, /\bibuprof/i,
            /\badvil\b/i, /\bmotrin\b/i, /\bnaproxen\b/i, /\baleve\b/i,
            /\btramadol\b/i, /\bcodein/i, /\bmorfin/i, /\boxicod/i, /\boxycod/i,
            /\bgabapentin\b/i, /\bneurontin\b/i, /\bpregabalin\b/i, /\blyrica\b/i,
        ],
    },
    {
        category: 'Antibiótico',
        patterns: [
            /\bamoxicilin/i, /\bamoxil\b/i, /\bazitromicin/i, /\bzithromax\b/i,
            /\bcefal[ex][ix]/i, /\bciprofloxac/i, /\blevofloxac/i, /\blevaquin\b/i,
            /\bdoxiciclin/i, /\bclindamicin/i, /\bmetronidazol\b/i, /\bflagyl\b/i,
            /\btrimetoprim/i, /\bbactrim\b/i, /\bnitrofuranto/i,
        ],
    },
    {
        category: 'Diurético',
        patterns: [
            /\bfurosemid/i, /\blasix\b/i, /\bbumetanid/i, /\bspironolacton/i,
            /\baldactone\b/i, /\btriamteren/i, /\bdyazide\b/i,
        ],
    },
    {
        category: 'Estatina',
        patterns: [
            /\batorvastat/i, /\blipitor\b/i, /\bsimvastat/i, /\bzocor\b/i,
            /\brosuvastat/i, /\bcrestor\b/i, /\bpravastat/i,
        ],
    },
    {
        category: 'Tiroides',
        patterns: [
            /\blevotiroxin/i, /\bsynthroid\b/i, /\barmour\b/i, /\bliotironin/i,
            /\bmetimazol\b/i,
        ],
    },
    {
        category: 'Antiulceroso',
        patterns: [
            /\bomeprazol\b/i, /\bprilosec\b/i, /\bpantoprazol\b/i, /\bprotonix\b/i,
            /\besomeprazol\b/i, /\bnexium\b/i, /\branitidin/i, /\bzantac\b/i,
            /\bfamotidin/i, /\bpepcid\b/i,
        ],
    },
    {
        category: 'Antiasmático/EPOC',
        patterns: [
            /\bsalbutamol\b/i, /\balbuterol\b/i, /\bventolin\b/i, /\bmontelukast\b/i,
            /\bsingulair\b/i, /\btiotropium\b/i, /\bspiriva\b/i, /\bfluticason/i,
            /\bbudesonid/i, /\bsymbicort\b/i,
        ],
    },
    {
        category: 'Vitamina/Suplemento',
        patterns: [
            /\bvitamin/i, /\b\bb12\b/i, /\bd3\b/i, /\bcalcio\b/i, /\bcalcium\b/i,
            /\bhierro\b/i, /\biron\b/i, /\bferro/i, /\bmagnesi/i, /\bensure\b/i,
            /\bbiotin/i, /\bfolic/i, /\bácido fólico/i,
        ],
    },
    {
        category: 'Antiparkinsoniano',
        patterns: [
            /\blevodopa\b/i, /\bcarbidopa\b/i, /\bsinemet\b/i, /\bpramipexol\b/i,
            /\bropinirol\b/i,
        ],
    },
    {
        category: 'Anticonvulsivante',
        patterns: [
            /\bvalproat/i, /\bdivalproex\b/i, /\bdepakote\b/i, /\bcarbamazepin\b/i,
            /\btegretol\b/i, /\bfenitoin\b/i, /\bdilantin\b/i, /\blamotrigin\b/i,
            /\blamictal\b/i, /\blevetiracetam\b/i, /\bkeppra\b/i,
        ],
    },
];

/**
 * Devuelve la categoría más probable de un medicamento por su nombre.
 * Si no encuentra match → 'Sin clasificar'.
 */
export function categorizeMedication(name: string): string {
    if (!name) return 'Sin clasificar';
    const trimmed = name.trim();
    for (const { category, patterns } of PATTERNS) {
        if (patterns.some((re) => re.test(trimmed))) {
            return category;
        }
    }
    return 'Sin clasificar';
}

/**
 * Normaliza el nombre de un medicamento: trim + Capitalización propia
 * (primera letra mayúscula, resto preservado para preservar mg/HCL/etc).
 */
export function normalizeMedicationName(raw: string): string {
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    if (!trimmed) return '';
    // Si está todo en mayúsculas, capitalizamos solo la primera letra de cada palabra
    if (trimmed === trimmed.toUpperCase()) {
        return trimmed
            .toLowerCase()
            .split(' ')
            .map((w, i) => {
                // Preserva sufijos comunes como "HCL", "ER", "XR", "IR" en mayúsculas
                if (/^(hcl|er|xr|ir|cr|sr|la|od|mg|ml|mcg|iu)$/i.test(w)) return w.toUpperCase();
                // Si la palabra contiene un número (ej. "10mg"), preserva
                if (/\d/.test(w)) return w;
                return w.charAt(0).toUpperCase() + w.slice(1);
            })
            .join(' ');
    }
    // Ya está en case mixto — preservar y solo asegurar primera mayúscula
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
