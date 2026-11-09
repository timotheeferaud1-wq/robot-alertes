import { REGLES } from "../config";

export type Point = { date: Date; prix: number };

export type TypeEvenement = "croisement_haussier" | "croisement_baissier" | "baisse";

export type Evenement = {
  type: TypeEvenement;
  titre: string;
  detail: string;
};

/** Un signal passé, avec ce que le marché a fait ensuite. */
export type SignalPasse = Evenement & {
  date: Date;
  prix: number;
  perf1Mois: number | null; // variation 21 séances après le signal
  perfDepuis: number; // variation entre le signal et aujourd'hui
};

/** Récapitulatif des séances récentes. */
export type Recap = {
  derniereSeance: number;
  semaine: number;
  mois: number;
  depuisJanvier: number;
  seances: { date: Date; variation: number }[]; // 20 dernières séances
  positives20: number;
  negatives20: number;
  positives60: number;
  negatives60: number;
  meilleure: { date: Date; variation: number };
  pire: { date: Date; variation: number };
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
  evenements: Evenement[]; // signaux du jour (ceux qui déclenchent un mail)
  historique: SignalPasse[]; // signaux de la dernière année, du plus récent au plus ancien
  recap: Recap;
};

function moyenne(valeurs: number[]): number {
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

function indicateurs(prix: number[], i: number) {
  const { mmCourte: nC, mmLongue: nL, fenetrePlusHaut } = REGLES;
  const mmC = moyenne(prix.slice(i - nC + 1, i + 1));
  const mmL = moyenne(prix.slice(i - nL + 1, i + 1));
  const haut = Math.max(...prix.slice(Math.max(0, i - fenetrePlusHaut + 1), i + 1));
  return { mmC, mmL, haut, baisse: prix[i] / haut - 1 };
}

/** Les signaux déclenchés le jour i (comparaison avec le jour i-1). */
function evenementsDuJour(prix: number[], i: number): Evenement[] {
  const { mmCourte: nC, mmLongue: nL, seuilsBaisse } = REGLES;
  const auj = indicateurs(prix, i);
  const hier = indicateurs(prix, i - 1);
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
    // On n'alerte que si le prix était resté au-dessus du seuil pendant tout le mois précédent
    // (évite les alertes répétées quand le prix oscille autour du seuil).
    const auDessusLeMoisDernier = Array.from({ length: 21 }, (_, k) => i - 1 - k)
      .filter((j) => j >= REGLES.mmLongue)
      .every((j) => indicateurs(prix, j).baisse > -s);
    if (auj.baisse <= -s && auDessusLeMoisDernier) {
      evenements.push({
        type: "baisse",
        titre: `Baisse de plus de ${Math.round(s * 100)} % depuis le plus haut`,
        detail: `Prix ${prix[i].toFixed(2)}, soit ${(auj.baisse * 100).toFixed(1)} % sous le plus haut d'un an (${auj.haut.toFixed(2)}).`,
      });
    }
  }
  return evenements;
}

function recapitulatif(serie: Point[]): Recap {
  const prix = serie.map((p) => p.prix);
  const n = prix.length;
  const variations = serie.slice(1).map((p, k) => ({ date: p.date, variation: p.prix / prix[k] - 1 }));
  const perf = (seances: number) => prix[n - 1] / prix[Math.max(0, n - 1 - seances)] - 1;

  const anneeEnCours = serie[n - 1].date.getFullYear();
  const idxDebutAnnee = serie.findIndex((p) => p.date.getFullYear() === anneeEnCours);
  const refJanvier = prix[Math.max(0, idxDebutAnnee - 1)];

  const derniers = (k: number) => variations.slice(-k);
  const compte = (k: number, signe: 1 | -1) => derniers(k).filter((v) => v.variation * signe > 0).length;
  const sur60 = derniers(60);

  return {
    derniereSeance: variations[variations.length - 1].variation,
    semaine: perf(5),
    mois: perf(21),
    depuisJanvier: prix[n - 1] / refJanvier - 1,
    seances: derniers(20),
    positives20: compte(20, 1),
    negatives20: compte(20, -1),
    positives60: compte(60, 1),
    negatives60: compte(60, -1),
    meilleure: sur60.reduce((a, b) => (b.variation > a.variation ? b : a)),
    pire: sur60.reduce((a, b) => (b.variation < a.variation ? b : a)),
  };
}

/** Calcule les indicateurs du dernier jour, l'historique des signaux et le récap des séances. */
export function analyser(symbole: string, nom: string, serie: Point[]): Analyse {
  const { mmLongue: nL } = REGLES;
  if (serie.length < nL + 2) {
    throw new Error(`${symbole} : pas assez d'historique (${serie.length} jours, il en faut ${nL + 2})`);
  }

  const prix = serie.map((p) => p.prix);
  const n = prix.length;
  const auj = indicateurs(prix, n - 1);

  // Historique : on rejoue les règles sur chaque séance de la dernière année
  const historique: SignalPasse[] = [];
  for (let i = Math.max(nL + 1, n - 252); i < n; i++) {
    for (const e of evenementsDuJour(prix, i)) {
      historique.push({
        ...e,
        date: serie[i].date,
        prix: prix[i],
        perf1Mois: i + 21 < n ? prix[i + 21] / prix[i] - 1 : null,
        perfDepuis: prix[n - 1] / prix[i] - 1,
      });
    }
  }
  historique.reverse();

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
    evenements: evenementsDuJour(prix, n - 1),
    historique,
    recap: recapitulatif(serie),
  };
}
