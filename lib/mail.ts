import { Resend } from "resend";
import { estAnalyse, type Resultat } from "./donnees";

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

export function construireMail(resultats: Resultat[], test = false) {
  const analyses = resultats.filter(estAnalyse);
  const avecSignal = analyses.filter((a) => a.evenements.length > 0);

  const sujet = test
    ? "🧪 Robot d'alertes : mail de test"
    : `📈 ${avecSignal.length} signal${avecSignal.length > 1 ? "s" : ""} : ${avecSignal.map((a) => a.nom).join(", ")}`;

  const blocsSignaux = avecSignal
    .map(
      (a) => `
      <div style="border-left:4px solid #e4572e;padding:8px 14px;margin:14px 0;background:#fdf3f0">
        <h3 style="margin:0 0 6px">${a.nom}</h3>
        ${a.evenements.map((e) => `<p style="margin:4px 0"><b>${e.titre}</b><br>${e.detail}</p>`).join("")}
      </div>`
    )
    .join("");

  const lignes = resultats
    .map((r) =>
      estAnalyse(r)
        ? `<tr><td>${r.nom}</td><td align="right">${r.prix.toFixed(2)}</td><td>${r.tendance}</td><td align="right">${pct(r.baisseDepuisPlusHaut)}</td></tr>`
        : `<tr><td>${r.nom}</td><td colspan="3" style="color:#b00">Erreur : ${r.erreur}</td></tr>`
    )
    .join("");

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:620px;color:#222">
    <h2>${test ? "Mail de test du robot" : "Nouveaux signaux ce soir"}</h2>
    ${blocsSignaux || "<p>Aucun nouveau signal aujourd'hui.</p>"}
    <h3>Vue d'ensemble</h3>
    <table cellpadding="6" style="border-collapse:collapse;width:100%;font-size:14px">
      <tr style="background:#f3f3f3"><th align="left">Actif</th><th align="right">Prix</th><th align="left">Tendance</th><th align="right">vs plus haut 1 an</th></tr>
      ${lignes}
    </table>
    <p style="color:#888;font-size:12px;margin-top:20px">
      Ce mail est un signal automatique basé sur tes règles, pas un conseil d'investissement.
      C'est toi qui décides et qui passes l'ordre chez ton courtier.
    </p>
  </div>`;

  return { sujet, html };
}

export type LigneJournal = { date: Date; sujet: string; statut: string };

/** Les derniers mails envoyés par le robot, lus directement chez Resend (aucune base de données nécessaire). */
export async function journalMails(limite = 30): Promise<{ lignes: LigneJournal[]; erreur?: string }> {
  if (!process.env.RESEND_API_KEY) return { lignes: [], erreur: "Clé Resend non configurée" };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.list({ limit: limite });
    if (error || !data) return { lignes: [], erreur: error?.message ?? "Réponse vide de Resend" };
    return {
      lignes: data.data.map((m) => ({ date: new Date(m.created_at), sujet: m.subject, statut: m.last_event })),
    };
  } catch (e) {
    return { lignes: [], erreur: e instanceof Error ? e.message : String(e) };
  }
}

export async function envoyerMail(sujet: string, html: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_EXPEDITEUR || "Robot Alertes <onboarding@resend.dev>",
    to: process.env.EMAIL_DESTINATAIRE!,
    subject: sujet,
    html,
  });
  if (error) throw new Error(`Envoi du mail impossible : ${error.message}`);
}
