import { REGLES } from "../config";

export type Point = { date: Date; prix: number };

export type TypeEvenement = "croisement_haussier" | "croisement_baissier" | "baisse";

export type Evenement = { type: TypeEvenement; titre: string; detail: string };

/** Un signal passé, avec ce que le marché a fait ensuite. */
export type SignalPasse = Evenement & {
  date: Date;
  prix: number;
  perf1Mois: number | null;
  perfDepuis: number;
};

export type Recap = {
  derniereSeance: number;
  semaine: number;
  mois: number;
  depuisJanvier: number;
  seances: { date: Date; variation: number }[];
  positives20: number;
  negatives20: number;
  positives60: number;
  negatives60: number;
  meilleure: { date: Date; variation: number };
  pire: { date: Date; variation: number };
};

/**
 * Score historique : « dans le passé, quand le marché était dans la même situation qu'aujourd'hui,
 * à quelle fréquence était-il plus haut X mois plus tard ? »
 */
export type Echeance = {
  libelle: string;
  seances: number;
  tauxHausse: number; // part des cas où le prix était plus haut à l'échéance
  medianePerf: number; // variation médiane à l'échéance
  pireCas: number; // 5 % des cas ont fait pire que ça
  nbCas: number;
};
export type Score = {
  situation: string;
  depuis: Date;
  echeances: Echeance[];
};

export type PointCourbe = { date: Date; prix: number; mmC: number; mmL: number };

export type Analyse = {
  symbole: string;
  nom: string;
  date: Date;
  prix: number;
  mmCourte: number;
  mmLongue: number;
  tendance: "haussière" | "baissière";
  plusHaut: number;
  baisseDepuisPlusHaut: number;
  evenements: Evenement[];
  historique: SignalPasse[];
  recap: Recap;
  score: Score | null;
  courbe: PointCourbe[]; // 12 derniers mois
};

/** Moyennes mobiles et écart au plus haut, calculés une fois pour toute la série. */
function indicateursSerie(prix: number[]) {
  const { mmCourte: nC, mmLongue: nL, fenetrePlusHaut } = REGLES;
  const n = prix.length;
  const mmC = new Array<number>(n).fill(NaN);
  const mmL = new Array<number>(n).fill(NaN);
  const baisse = new Array<number>(n).fill(NaN);
  const haut = new Array<number>(n).fill(NaN);
  let sC = 0;
  let sL = 0;
  const fenetre: number[] = []; // file d'indices pour le maximum glissant
  for (let i = 0; i < n; i++) {
    sC += prix[i];
    sL += prix[i];
    if (i >= nC) sC -= prix[i - nC];
    if (i >= nL) sL -= prix[i - nL];
    if (i >= nC - 1) mmC[i] = sC / nC;
    if (i >= nL - 1) mmL[i] = sL / nL;
    while (fenetre.length && prix[fenetre[fenetre.length - 1]] <= prix[i]) fenetre.pop();
    fenetre.push(i);
    if (fenetre[0] <= i - fenetrePlusHaut) fenetre.shift();
    haut[i] = prix[fenetre[0]];
    baisse[i] = prix[i] / haut[i] - 1;
  }
  return { mmC, mmL, baisse, haut };
}

type Indic = ReturnType<typeof indicateursSerie>;

function evenementsDuJour(prix: number[], ind: Indic, i: number): Evenement[] {
  const { mmCourte: nC, mmLongue: nL, seuilsBaisse } = REGLES;
  const { mmC, mmL, baisse, haut } = ind;
  const evenements: Evenement[] = [];
  if (!(i >= nL) || Number.isNaN(mmL[i - 1])) return evenements;

  if (mmC[i] > mmL[i] && mmC[i - 1] <= mmL[i - 1]) {
    evenements.push({
      type: "croisement_haussier",
      titre: "Signal d'achat : la tendance repasse à la hausse",
      detail: `La moyenne ${nC} jours (${mmC[i].toFixed(2)}) vient de repasser au-dessus de la moyenne ${nL} jours (${mmL[i].toFixed(2)}).`,
    });
  }
  if (mmC[i] < mmL[i] && mmC[i - 1] >= mmL[i - 1]) {
    evenements.push({
      type: "croisement_baissier",
      titre: "Signal de vente : la tendance passe à la baisse",
      detail: `La moyenne ${nC} jours (${mmC[i].toFixed(2)}) vient de passer sous la moyenne ${nL} jours (${mmL[i].toFixed(2)}).`,
    });
  }
  for (const s of seuilsBaisse) {
    // Pas d'alerte répétée : le prix doit être resté au-dessus du seuil tout le mois précédent.
    let auDessus = true;
    for (let j = i - 1; j >= Math.max(0, i - 21); j--) if (baisse[j] <= -s) auDessus = false;
    if (baisse[i] <= -s && auDessus) {
      evenements.push({
        type: "baisse",
        titre: `Baisse de plus de ${Math.round(s * 100)} % depuis le plus haut`,
        detail: `Prix ${prix[i].toFixed(2)}, soit ${(baisse[i] * 100).toFixed(1)} % sous le plus haut d'un an (${haut[i].toFixed(2)}).`,
      });
    }
  }
  return evenements;
}

/** Tranche d'écart au plus haut, pour comparer des situations similaires. */
function tranche(b: number): { id: number; libelle: string } {
  if (b > -0.05) return { id: 0, libelle: "à moins de 5 % de son plus haut" };
  if (b > -0.1) return { id: 1, libelle: "entre 5 et 10 % sous son plus haut" };
  if (b > -0.2) return { id: 2, libelle: "entre 10 et 20 % sous son plus haut" };
  return { id: 3, libelle: "à plus de 20 % sous son plus haut" };
}

const ECHEANCES = [
  { libelle: "1 mois", seances: 21 },
  { libelle: "3 mois", seances: 63 },
  { libelle: "6 mois", seances: 126 },
  { libelle: "1 an", seances: 252 },
];

function quantile(triees: number[], q: number) {
  return triees[Math.min(triees.length - 1, Math.max(0, Math.floor(q * (triees.length - 1))))];
}

function scoreHistorique(serie: Point[], ind: Indic): Score | null {
  const prix = serie.map((p) => p.prix);
  const n = prix.length;
  const { mmC, mmL, baisse } = ind;
  const i0 = REGLES.mmLongue;
  if (n - i0 < 600) return null; // pas assez d'historique pour que les statistiques aient un sens

  const hausseAuj = mmC[n - 1] > mmL[n - 1];
  const trancheAuj = tranche(baisse[n - 1]);
  const echeances: Echeance[] = [];

  for (const e of ECHEANCES) {
    const perfs: number[] = [];
    for (let i = i0; i + e.seances < n; i++) {
      if (mmC[i] > mmL[i] === hausseAuj && tranche(baisse[i]).id === trancheAuj.id) {
        perfs.push(prix[i + e.seances] / prix[i] - 1);
      }
    }
    if (perfs.length < 50) continue;
    perfs.sort((a, b) => a - b);
    echeances.push({
      ...e,
      tauxHausse: perfs.filter((p) => p > 0).length / perfs.length,
      medianePerf: quantile(perfs, 0.5),
      pireCas: quantile(perfs, 0.05),
      nbCas: perfs.length,
    });
  }
  if (echeances.length === 0) return null;

  return {
    situation: `tendance ${hausseAuj ? "haussière" : "baissière"}, prix ${trancheAuj.libelle}`,
    depuis: serie[i0].date,
    echeances,
  };
}

function recapitulatif(serie: Point[]): Recap {
  const prix = serie.map((p) => p.prix);
  const n = prix.length;
  const variations = serie.slice(1).map((p, k) => ({ date: p.date, variation: p.prix / prix[k] - 1 }));
  const perf = (s: number) => prix[n - 1] / prix[Math.max(0, n - 1 - s)] - 1;
  const annee = serie[n - 1].date.getFullYear();
  const idxJanvier = serie.findIndex((p) => p.date.getFullYear() === annee);
  const derniers = (k: number) => variations.slice(-k);
  const compte = (k: number, signe: 1 | -1) => derniers(k).filter((v) => v.variation * signe > 0).length;
  const sur60 = derniers(60);
  return {
    derniereSeance: variations[variations.length - 1].variation,
    semaine: perf(5),
    mois: perf(21),
    depuisJanvier: prix[n - 1] / prix[Math.max(0, idxJanvier - 1)] - 1,
    seances: derniers(20),
    positives20: compte(20, 1),
    negatives20: compte(20, -1),
    positives60: compte(60, 1),
    negatives60: compte(60, -1),
    meilleure: sur60.reduce((a, b) => (b.variation > a.variation ? b : a)),
    pire: sur60.reduce((a, b) => (b.variation < a.variation ? b : a)),
  };
}

export function analyser(symbole: string, nom: string, serie: Point[]): Analyse {
  const { mmLongue: nL } = REGLES;
  if (serie.length < nL + 25) {
    throw new Error(`${symbole} : pas assez d'historique (${serie.length} jours, il en faut ${nL + 25})`);
  }
  const prix = serie.map((p) => p.prix);
  const n = prix.length;
  const ind = indicateursSerie(prix);

  const debut12Mois = Math.max(nL + 1, n - 252);
  const historique: SignalPasse[] = [];
  for (let i = debut12Mois; i < n; i++) {
    for (const e of evenementsDuJour(prix, ind, i)) {
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

  const courbe: PointCourbe[] = [];
  for (let i = Math.max(nL - 1, n - 252); i < n; i++) {
    courbe.push({ date: serie[i].date, prix: prix[i], mmC: ind.mmC[i], mmL: ind.mmL[i] });
  }

  return {
    symbole,
    nom,
    date: serie[n - 1].date,
    prix: prix[n - 1],
    mmCourte: ind.mmC[n - 1],
    mmLongue: ind.mmL[n - 1],
    tendance: ind.mmC[n - 1] > ind.mmL[n - 1] ? "haussière" : "baissière",
    plusHaut: ind.haut[n - 1],
    baisseDepuisPlusHaut: ind.baisse[n - 1],
    evenements: evenementsDuJour(prix, ind, n - 1),
    historique,
    recap: recapitulatif(serie),
    score: scoreHistorique(serie, ind),
    courbe,
  };
}
