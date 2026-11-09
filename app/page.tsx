import { analyserTout, estAnalyse } from "../lib/donnees";
import { journalMails } from "../lib/mail";
import { REGLES } from "../config";

export const revalidate = 900; // rafraîchi au plus toutes les 15 minutes

const pct = (x: number) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)} %`;
const jour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const couleur = (x: number | null) => (x === null ? "" : x > 0 ? "vert" : x < 0 ? "rouge" : "");

const STATUTS: Record<string, string> = {
  delivered: "✅ Délivré",
  sent: "📤 Envoyé",
  queued: "⏳ En file",
  opened: "👀 Ouvert",
  clicked: "🖱️ Cliqué",
  bounced: "❌ Rejeté",
  failed: "❌ Échec",
  delivery_delayed: "⏳ Retardé",
  complained: "⚠️ Signalé spam",
  suppressed: "🚫 Bloqué",
};

const ICONES = { croisement_haussier: "🟢", croisement_baissier: "🔴", baisse: "🟠" } as const;

export default async function Page() {
  const [resultats, journal] = await Promise.all([analyserTout(), journalMails()]);
  const analyses = resultats.filter(estAnalyse);

  const tousLesSignaux = analyses
    .flatMap((a) => a.historique.map((s) => ({ ...s, nom: a.nom })))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <main>
      <h1>Robot d&apos;alertes</h1>
      <p className="sous-titre">
        Règles : moyennes mobiles {REGLES.mmCourte}/{REGLES.mmLongue} jours · alertes à{" "}
        {REGLES.seuilsBaisse.map((s) => `-${s * 100} %`).join(" et ")} du plus haut d&apos;un an
      </p>

      {/* ---------- Cartes du jour ---------- */}
      <div className="grille">
        {resultats.map((r) =>
          estAnalyse(r) ? (
            <div key={r.symbole} className="carte">
              <div className="entete">
                <h2>{r.nom}</h2>
                <span className={`badge ${r.tendance === "haussière" ? "hausse" : "baisse"}`}>
                  {r.tendance === "haussière" ? "▲ Tendance haussière" : "▼ Tendance baissière"}
                </span>
              </div>
              <p className="prix">
                {r.prix.toFixed(2)} <small className={couleur(r.recap.derniereSeance)}>{pct(r.recap.derniereSeance)}</small>
              </p>
              <dl>
                <dt>MM {REGLES.mmCourte} j</dt>
                <dd>{r.mmCourte.toFixed(2)}</dd>
                <dt>MM {REGLES.mmLongue} j</dt>
                <dd>{r.mmLongue.toFixed(2)}</dd>
                <dt>vs plus haut 1 an</dt>
                <dd className={r.baisseDepuisPlusHaut < -0.1 ? "rouge" : ""}>{pct(r.baisseDepuisPlusHaut)}</dd>
                <dt>Clôture du</dt>
                <dd>{jour(r.date)}</dd>
              </dl>
              {r.evenements.map((e) => (
                <p key={e.titre} className="signal">
                  🔔 <b>{e.titre}</b>
                  <br />
                  {e.detail}
                </p>
              ))}
            </div>
          ) : (
            <div key={r.symbole} className="carte">
              <h2>{r.nom}</h2>
              <p className="rouge">Erreur : {r.erreur}</p>
            </div>
          )
        )}
      </div>

      {/* ---------- Récap des séances ---------- */}
      <section>
        <h2 className="titre-section">Récap des séances</h2>
        <div className="tableau">
          <table>
            <thead>
              <tr>
                <th>Actif</th>
                <th>Dernière séance</th>
                <th>5 jours</th>
                <th>1 mois</th>
                <th>Depuis janvier</th>
                <th>20 séances</th>
                <th>60 séances</th>
                <th>Meilleure / pire (60 s.)</th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((a) => (
                <tr key={a.symbole}>
                  <td className="nom">{a.nom}</td>
                  <td className={couleur(a.recap.derniereSeance)}>{pct(a.recap.derniereSeance)}</td>
                  <td className={couleur(a.recap.semaine)}>{pct(a.recap.semaine)}</td>
                  <td className={couleur(a.recap.mois)}>{pct(a.recap.mois)}</td>
                  <td className={couleur(a.recap.depuisJanvier)}>{pct(a.recap.depuisJanvier)}</td>
                  <td>
                    <span className="vert">{a.recap.positives20} ▲</span> · <span className="rouge">{a.recap.negatives20} ▼</span>
                  </td>
                  <td>
                    <span className="vert">{a.recap.positives60} ▲</span> · <span className="rouge">{a.recap.negatives60} ▼</span>
                  </td>
                  <td>
                    <span className="vert">{pct(a.recap.meilleure.variation)}</span> ({jour(a.recap.meilleure.date)})
                    <br />
                    <span className="rouge">{pct(a.recap.pire.variation)}</span> ({jour(a.recap.pire.date)})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bandes">
          {analyses.map((a) => (
            <div key={a.symbole} className="bande">
              <span className="nom">{a.nom}</span>
              <div className="cases" aria-label="20 dernières séances">
                {a.recap.seances.map((s) => (
                  <span
                    key={s.date.toISOString()}
                    className={`case ${s.variation > 0 ? "c-vert" : s.variation < 0 ? "c-rouge" : ""}`}
                    title={`${jour(s.date)} : ${pct(s.variation)}`}
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="legende">Les 20 dernières séances, de la plus ancienne à la plus récente. Survole une case pour voir la variation.</p>
        </div>
      </section>

      {/* ---------- Historique des signaux ---------- */}
      <section>
        <h2 className="titre-section">Historique des signaux (12 derniers mois)</h2>
        <div className="explication">
          <p>
            <b>🟢 Signal d&apos;achat</b> : la moyenne {REGLES.mmCourte} jours repasse au-dessus de la {REGLES.mmLongue} jours.
            La tendance de fond redevient haussière. Signal lent, qui arrive souvent après le début du rebond.
          </p>
          <p>
            <b>🔴 Signal de vente</b> : l&apos;inverse. La tendance de fond devient baissière. Il protège des longues chutes, mais
            peut faire sortir juste avant un rebond.
          </p>
          <p>
            <b>🟠 Baisse depuis le plus haut</b> : le prix a perdu {REGLES.seuilsBaisse.map((s) => `${s * 100} %`).join(" ou ")}{" "}
            par rapport à son plus haut d&apos;un an. Ce n&apos;est ni un signal d&apos;achat ni de vente : c&apos;est un moment
            pour regarder le contexte de près.
          </p>
          <p>
            Les colonnes « 1 mois après » et « depuis » montrent ce qu&apos;a fait le marché après chaque signal : c&apos;est ce
            qui te permet de juger si les règles valent quelque chose.
          </p>
        </div>

        {tousLesSignaux.length === 0 ? (
          <p className="vide">Aucun signal sur les 12 derniers mois.</p>
        ) : (
          <div className="tableau">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Actif</th>
                  <th>Signal</th>
                  <th>Prix</th>
                  <th>1 mois après</th>
                  <th>Depuis</th>
                </tr>
              </thead>
              <tbody>
                {tousLesSignaux.map((s) => (
                  <tr key={`${s.nom}-${s.date.toISOString()}-${s.type}-${s.titre}`}>
                    <td>{jour(s.date)}</td>
                    <td className="nom">{s.nom}</td>
                    <td>
                      {ICONES[s.type]} {s.titre}
                    </td>
                    <td>{s.prix.toFixed(2)}</td>
                    <td className={couleur(s.perf1Mois)}>{s.perf1Mois === null ? "—" : pct(s.perf1Mois)}</td>
                    <td className={couleur(s.perfDepuis)}>{pct(s.perfDepuis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Journal des mails ---------- */}
      <section>
        <h2 className="titre-section">Journal des mails envoyés</h2>
        {journal.erreur ? (
          <p className="rouge">Impossible de lire le journal : {journal.erreur}</p>
        ) : journal.lignes.length === 0 ? (
          <p className="vide">Aucun mail envoyé pour l&apos;instant.</p>
        ) : (
          <div className="tableau">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sujet</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {journal.lignes.map((l) => (
                  <tr key={`${l.date.toISOString()}-${l.sujet}`}>
                    <td>
                      {l.date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td>{l.sujet}</td>
                    <td>{STATUTS[l.statut] ?? l.statut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mention">
        Signaux automatiques basés sur tes règles, pas des conseils d&apos;investissement. C&apos;est toi qui décides et
        qui passes les ordres.
      </p>
    </main>
  );
}
