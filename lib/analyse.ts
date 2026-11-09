import { REGLES } from "../config";

export type Point = { date: Date; prix: number };

export type Evenement = {
  type: "croisement_haussier" | "croisement_baissier" | "baisse";
  titre: string;
  detail: string;
};

export type Analyse = {
  symbole: string;
  nom: string;
  date: Date;
  prix: number;
  mmCourte: number;
  mmLongue: number;
  tendance: "haussière" | "baissière";
  plusHaut: number;
  baisseDepuisPlusHaut: number; // ex. -0.12 pour -12 %
  evenements: Evenement[];
};

function moyenne(valeurs: number[]): number {
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

/** Calcule les indicateurs du dernier jour et compare avec la veille pour détecter les signaux. */
export function analyser(symbole: string, nom: string, serie: Point[]): Analyse {
  const { mmCourte: nC, mmLongue: nL, seuilsBaisse, fenetrePlusHaut } = REGLES;
  if (serie.length < nL + 2) {
    throw new Error(`${symbole} : pas assez d'historique (${serie.length} jours, il en faut ${nL + 2})`);
  }

  const prix = serie.map((p) => p.prix);
  const n = prix.length;

  // Indicateurs pour le jour "i" (i = n-1 aujourd'hui, n-2 hier)
  const indic = (i: number) => {
    const mmC = moyenne(prix.slice(i - nC + 1, i + 1));
    const mmL = moyenne(prix.slice(i - nL + 1, i + 1));
    const haut = Math.max(...prix.slice(Math.max(0, i - fenetrePlusHaut + 1), i + 1));
    return { mmC, mmL, haut, baisse: prix[i] / haut - 1 };
  };

  const auj = indic(n - 1);
  const hier = indic(n - 2);
  const evenements: Evenement[] = [];

  if (auj.mmC > auj.mmL && hier.mmC <= hier.mmL) {
    evenements.push({
      type: "croisement_haussier",
      titre: "Signal d'achat : la tendance repasse à la hausse",
      detail: `La moyenne ${nC} jours (${auj.mmC.toFixed(2)}) vient de repasser au-dessus de la moyenne ${nL} jours (${auj.mmL.toFixed(2)}).`,
    });
  }
  if (auj.mmC < auj.mmL && hier.mmC >= hier.mmL) {
    evenements.push({
      type: "croisement_baissier",
      titre: "Signal de vente : la tendance passe à la baisse",
      detail: `La moyenne ${nC} jours (${auj.mmC.toFixed(2)}) vient de passer sous la moyenne ${nL} jours (${auj.mmL.toFixed(2)}).`,
    });
  }
  for (const s of seuilsBaisse) {
    if (auj.baisse <= -s && hier.baisse > -s) {
      evenements.push({
        type: "baisse",
        titre: `Baisse de plus de ${Math.round(s * 100)} % depuis le plus haut`,
        detail: `Prix ${prix[n - 1].toFixed(2)}, soit ${(auj.baisse * 100).toFixed(1)} % sous le plus haut d'un an (${auj.haut.toFixed(2)}).`,
      });
    }
  }

  return {
    symbole,
    nom,
    date: serie[n - 1].date,
    prix: prix[n - 1],
    mmCourte: auj.mmC,
    mmLongue: auj.mmL,
    tendance: auj.mmC > auj.mmL ? "haussière" : "baissière",
    plusHaut: auj.haut,
    baisseDepuisPlusHaut: auj.baisse,
    evenements,
  };
}
