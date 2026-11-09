import YahooFinance from "yahoo-finance2";
import { ACTIFS } from "../config";
import { analyser, type Analyse, type Point } from "./analyse";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** Récupère tout l'historique disponible de cours de clôture journaliers (ajustés des dividendes). */
export async function historique(symbole: string): Promise<Point[]> {
  const res = await yahooFinance.chart(symbole, { period1: "1985-01-01", interval: "1d" });
  return res.quotes
    .map((q) => ({ date: new Date(q.date), prix: (q.adjclose ?? q.close) as number }))
    .filter((p) => typeof p.prix === "number" && Number.isFinite(p.prix) && p.prix > 0);
}

export type Resultat = Analyse | { symbole: string; nom: string; erreur: string };

export async function analyserUn(symbole: string, nom: string): Promise<Resultat> {
  try {
    return analyser(symbole, nom, await historique(symbole));
  } catch (e) {
    return { symbole, nom, erreur: e instanceof Error ? e.message : String(e) };
  }
}

/** Analyse tous les actifs de la configuration. Une erreur sur un actif ne bloque pas les autres. */
export async function analyserTout(): Promise<Resultat[]> {
  return Promise.all(ACTIFS.map(({ symbole, nom }) => analyserUn(symbole, nom)));
}

export function estAnalyse(r: Resultat): r is Analyse {
  return !("erreur" in r);
}
