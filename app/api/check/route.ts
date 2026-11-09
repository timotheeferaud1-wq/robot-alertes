import { analyserTout, estAnalyse } from "../../../lib/donnees";
import { construireMail, envoyerMail } from "../../../lib/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Appelée chaque soir par Vercel (voir vercel.json).
 * Vercel envoie automatiquement l'en-tête « Authorization: Bearer <CRON_SECRET> ».
 * Pour tester à la main : /api/check?test=1 avec le même en-tête → envoie un mail même sans signal.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ erreur: "Non autorisé" }, { status: 401 });
  }

  const test = new URL(req.url).searchParams.get("test") === "1";
  const resultats = await analyserTout();
  const nbSignaux = resultats.filter(estAnalyse).reduce((n, a) => n + a.evenements.length, 0);
  const nbErreurs = resultats.filter((r) => !estAnalyse(r)).length;

  let mailEnvoye = false;
  let erreurMail: string | undefined;
  if (nbSignaux > 0 || nbErreurs > 0 || test) {
    const { sujet, html } = construireMail(resultats, test);
    try {
      await envoyerMail(nbSignaux === 0 && nbErreurs > 0 && !test ? "⚠️ Robot d'alertes : erreur de récupération" : sujet, html);
      mailEnvoye = true;
    } catch (e) {
      erreurMail = e instanceof Error ? e.message : String(e);
    }
  }

  return Response.json(
    { date: new Date().toISOString(), nbSignaux, nbErreurs, mailEnvoye, erreurMail, resultats },
    { status: erreurMail ? 500 : 200 }
  );
}
