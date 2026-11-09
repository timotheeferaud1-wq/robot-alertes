// =====================================================================
//  CONFIGURATION DU ROBOT — c'est le seul fichier à modifier au quotidien
// =====================================================================

/** Les actifs surveillés chaque soir (symboles Yahoo Finance). */
export const ACTIFS = [
  { symbole: "CW8.PA", nom: "MSCI World (CW8, éligible PEA)" },
  { symbole: "^GSPC", nom: "S&P 500" },
  { symbole: "^IXIC", nom: "Nasdaq Composite" },
  // Pour en ajouter un, cherche son symbole sur finance.yahoo.com, par ex. :
  // { symbole: "AAPL", nom: "Apple" },
];

/**
 * true  : un « bilan du soir » est envoyé chaque soir de semaine, signal ou pas.
 * false : un mail seulement quand un nouveau signal apparaît.
 */
export const ENVOI_QUOTIDIEN = true;

/** Les règles qui déclenchent une alerte. */
export const REGLES = {
  /** Moyennes mobiles (en jours de bourse) pour détecter les changements de tendance. */
  mmCourte: 50,
  mmLongue: 200,

  /** Alerte quand le prix passe pour la première fois sous ces baisses depuis son plus haut. */
  seuilsBaisse: [0.1, 0.2], // -10 % et -20 %

  /** Période sur laquelle on cherche le « plus haut » (252 jours de bourse ≈ 1 an). */
  fenetrePlusHaut: 252,
};
