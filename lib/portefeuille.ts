import { analyserUn, estAnalyse, type Resultat } from "./donnees";
import type { Analyse } from "./analyse";

/**
 * Le portefeuille est lu dans la variable d'environnement PORTEFEUILLE (dans Vercel),
 * pour qu'il ne soit jamais écrit dans le code ni visible sur GitHub. Format JSON :
 *
 * [{"symbole":"CW8.PA","nom":"MSCI World","quantite":2,"prixRevient":520.5}]
 *
 * Lecture seule : le robot ne fait que regarder, il ne passe aucun ordre.
 */
type PositionSaisie = { symbole: string; nom?: string; quantite: number; prixRevient: number };

export type LignePortefeuille = {
  symbole: string;
  nom: string;
  quantite: number;
  prixRevient: number;
  analyse?: Analyse;
  erreur?: string;
  valeur: number | null;
  plusValue: number | null;
  plusValuePct: number | null;
  poids: number | null;
};

export function lirePositions(): { positions: PositionSaisie[]; erreur?: string } {
  const brut = process.env.PORTEFEUILLE;
  if (!brut) return { positions: [] };
  if (!process.env.MOT_DE_PASSE_SITE) {
    return {
      positions: [],
      erreur: "Portefeuille masqué : ajoute d'abord la variable MOT_DE_PASSE_SITE dans Vercel pour protéger la page.",
    };
  }
  try {
    const data = JSON.parse(brut);
    if (!Array.isArray(data)) throw new Error("ce doit être une liste [ ... ]");
    const positions = data.map((p, k) => {
      if (typeof p.symbole !== "string" || typeof p.quantite !== "number" || typeof p.prixRevient !== "number") {
        throw new Error(`ligne ${k + 1} : il faut symbole (texte), quantite et prixRevient (nombres)`);
      }
      return p as PositionSaisie;
    });
    return { positions };
  } catch (e) {
    return { positions: [], erreur: `Variable PORTEFEUILLE illisible : ${e instanceof Error ? e.message : e}` };
  }
}

/** Valorise le portefeuille. Réutilise les analyses déjà faites pour les actifs surveillés. */
export async function analyserPortefeuille(dejaFaites: Resultat[]) {
  const { positions, erreur } = lirePositions();
  if (positions.length === 0) return { lignes: [] as LignePortefeuille[], erreur, total: 0, totalRevient: 0 };

  const cache = new Map(dejaFaites.map((r) => [r.symbole, r]));
  const lignes: LignePortefeuille[] = await Promise.all(
    positions.map(async (p) => {
      const r = cache.get(p.symbole) ?? (await analyserUn(p.symbole, p.nom ?? p.symbole));
      const nom = p.nom ?? (estAnalyse(r) ? r.nom : p.symbole);
      if (!estAnalyse(r)) {
        return { ...p, nom, erreur: r.erreur, valeur: null, plusValue: null, plusValuePct: null, poids: null };
      }
      const valeur = r.prix * p.quantite;
      const revient = p.prixRevient * p.quantite;
      return {
        ...p,
        nom,
        analyse: r,
        valeur,
        plusValue: valeur - revient,
        plusValuePct: valeur / revient - 1,
        poids: null,
      };
    })
  );

  const total = lignes.reduce((s, l) => s + (l.valeur ?? 0), 0);
  const totalRevient = lignes.filter((l) => l.valeur !== null).reduce((s, l) => s + l.prixRevient * l.quantite, 0);
  for (const l of lignes) if (l.valeur !== null && total > 0) l.poids = l.valeur / total;
  return { lignes, erreur, total, totalRevient };
}
