import { Resend } from "resend";
import { estAnalyse, type Resultat } from "./donnees";
import type { LignePortefeuille } from "./portefeuille";

const pct = (x: number) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)} %`;
const eur = (x: number) => x.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const vert = "#1f8a4c";
const rouge = "#c8382b";
const c = (x: number) => (x > 0 ? vert : x < 0 ? rouge : "#222");

type Portefeuille = { lignes: LignePortefeuille[]; total: number; totalRevient: number };

export function construireMail(resultats: Resultat[], options: { test?: boolean; portefeuille?: Portefeuille } = {}) {
  const { test = false, portefeuille } = options;
  const analyses = resultats.filter(estAnalyse);
  const avecSignal = analyses.filter((a) => a.evenements.length > 0);
  const date = analyses[0]?.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) ?? "";

  const sujet = test
    ? "🧪 Robot d'alertes : mail de test"
    : avecSignal.length > 0
      ? `🔔 ${avecSignal.length} signal${avecSignal.length > 1 ? "s" : ""} ce soir : ${avecSignal.map((a) => a.nom).join(", ")}`
      : `📊 Bilan du soir, ${date}`;

  const blocsSignaux = avecSignal
    .map(
      (a) => `
      <div style="border-left:4px solid #e4572e;padding:8px 14px;margin:14px 0;background:#fdf3f0">
        <h3 style="margin:0 0 6px">${a.nom}</h3>
        ${a.evenements.map((e) => `<p style="margin:4px 0"><b>${e.titre}</b><br>${e.detail}</p>`).join("")}
      </div>`
    )
    .join("");

  const blocsActifs = resultats
    .map((r) => {
      if (!estAnalyse(r)) return `<p style="color:${rouge}"><b>${r.nom}</b> : erreur (${r.erreur})</p>`;
      const ech = r.score?.echeances ?? [];
      return `
      <div style="border:1px solid #e5e3de;border-radius:10px;padding:12px 14px;margin:10px 0">
        <div style="font-weight:700">${r.nom}</div>
        <div style="font-size:20px;font-weight:700;margin:4px 0">${r.prix.toFixed(2)}
          <span style="font-size:14px;color:${c(r.recap.derniereSeance)}">${pct(r.recap.derniereSeance)}</span></div>
        <div style="font-size:13px;color:#555">Tendance ${r.tendance} · ${pct(r.baisseDepuisPlusHaut)} vs plus haut 1 an · 1 mois ${pct(r.recap.mois)}</div>
        ${
          r.score
            ? `<div style="font-size:13px;margin-top:8px">Dans le passé, dans la même situation (${r.score.situation}), le prix était plus haut :
               ${ech.map((e) => `<b>${Math.round(e.tauxHausse * 100)} %</b> des cas à ${e.libelle}`).join(" · ")}</div>`
            : ""
        }
      </div>`;
    })
    .join("");

  const blocPortefeuille =
    portefeuille && portefeuille.lignes.length > 0
      ? `<h3>Mon portefeuille</h3>
         <p style="font-size:15px">Valeur : <b>${eur(portefeuille.total)}</b> ·
           <span style="color:${c(portefeuille.total - portefeuille.totalRevient)}">
           ${eur(portefeuille.total - portefeuille.totalRevient)}
           (${pct(portefeuille.totalRevient ? portefeuille.total / portefeuille.totalRevient - 1 : 0)})</span></p>
         <table cellpadding="6" style="border-collapse:collapse;width:100%;font-size:13px">
           <tr style="background:#f3f3f3"><th align="left">Ligne</th><th align="right">Valeur</th><th align="right">+/- value</th><th align="left">Tendance</th></tr>
           ${portefeuille.lignes
             .map((l) =>
               l.analyse
                 ? `<tr><td>${l.nom}</td><td align="right">${eur(l.valeur!)}</td>
                    <td align="right" style="color:${c(l.plusValue!)}">${pct(l.plusValuePct!)}</td><td>${l.analyse.tendance}</td></tr>`
                 : `<tr><td>${l.nom}</td><td colspan="3" style="color:${rouge}">Erreur : ${l.erreur}</td></tr>`
             )
             .join("")}
         </table>`
      : "";

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:620px;color:#222">
    <h2 style="margin-bottom:4px">${test ? "Mail de test du robot" : "Bilan du soir"}</h2>
    <p style="color:#777;margin-top:0">${date}</p>
    ${blocsSignaux || `<p>Aucun nouveau signal aujourd'hui.</p>`}
    <h3>Les marchés surveillés</h3>
    ${blocsActifs}
    ${blocPortefeuille}
    <p style="color:#888;font-size:12px;margin-top:20px">
      Signaux et statistiques automatiques basés sur tes règles et sur l'historique, pas des conseils d'investissement.
      Les performances passées ne préjugent pas des performances futures. C'est toi qui décides et qui passes l'ordre.
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
