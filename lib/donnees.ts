import YahooFinance from "yahoo-finance2";
import { ACTIFS } from "../config";
import { analyser, type Analyse, type Point } from "./analyse";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** Récupère ~2 ans de cours de clôture journaliers (ajustés des dividendes). */
export async function historique(symbole: string): Promise<Point[]> {
  const debut = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000);
  const res = await yahooFinance.chart(symbole, { period1: debut, interval: "1d" });
  return res.quotes
    .map((q) => ({ date: new Date(q.date), prix: (q.adjclose ?? q.close) as number }))
    .filter((p) => typeof p.prix === "number" && Number.isFinite(p.prix));
}

export type Resultat = Analyse | { symbole: string; nom: string; erreur: string };

/** Analyse tous les actifs de la configuration. Une erreur sur un actif ne bloque pas les autres. */
export async function analyserTout(): Promise<Resultat[]> {
  return Promise.all(
    ACTIFS.map(async ({ symbole, nom }) => {
      try {
        return analyser(symbole, nom, await historique(symbole));
      } catch (e) {
        return { symbole, nom, erreur: e instanceof Error ? e.message : String(e) };
      }
    })
  );
}

export function estAnalyse(r: Resultat): r is Analyse {
  return !("erreur" in r);
}
