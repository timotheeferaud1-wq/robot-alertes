import { analyserTout, estAnalyse } from "../../../lib/donnees";
import { construireMail, envoyerMail } from "../../../lib/mail";
import { analyserPortefeuille } from "../../../lib/portefeuille";
import { ENVOI_QUOTIDIEN } from "../../../config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Appelée chaque soir par Vercel (voir vercel.json).
 * Vercel envoie automatiquement l'en-tête « Authorization: Bearer <CRON_SECRET> ».
 * Pour tester à la main : /api/check?test=1 avec le même en-tête → envoie un mail tout de suite.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ erreur: "Non autorisé" }, { status: 401 });
  }

  const test = new URL(req.url).searchParams.get("test") === "1";
  const resultats = await analyserTout();
  const portefeuille = await analyserPortefeuille(resultats);
  const nbSignaux = resultats.filter(estAnalyse).reduce((n, a) => n + a.evenements.length, 0);
  const nbErreurs = resultats.filter((r) => !estAnalyse(r)).length;

  let mailEnvoye = false;
  let erreurMail: string | undefined;
  if (ENVOI_QUOTIDIEN || nbSignaux > 0 || nbErreurs > 0 || test) {
    const { sujet, html } = construireMail(resultats, { test, portefeuille });
    const sujetFinal = nbErreurs === resultats.length && !test ? "⚠️ Robot d'alertes : erreur de récupération des cours" : sujet;
    try {
      await envoyerMail(sujetFinal, html);
      mailEnvoye = true;
    } catch (e) {
      erreurMail = e instanceof Error ? e.message : String(e);
    }
  }

  // Résumé léger (sans les courbes ni le détail du portefeuille)
  const resume = resultats.map((r) =>
    estAnalyse(r)
      ? { symbole: r.symbole, prix: r.prix, tendance: r.tendance, signaux: r.evenements.map((e) => e.titre) }
      : r
  );
  return Response.json(
    { date: new Date().toISOString(), nbSignaux, nbErreurs, mailEnvoye, erreurMail, resultats: resume },
    { status: erreurMail ? 500 : 200 }
  );
}
