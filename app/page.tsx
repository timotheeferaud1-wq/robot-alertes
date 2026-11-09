import { analyserTout, estAnalyse } from "../lib/donnees";
import { journalMails } from "../lib/mail";
import { analyserPortefeuille } from "../lib/portefeuille";
import { REGLES } from "../config";
import Courbe from "./Courbe";
import ScoreHistorique from "./Score";

export const dynamic = "force-dynamic"; // la page est protégée par mot de passe : pas de version publique pré-générée

const pct = (x: number) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)} %`;
const eur = (x: number) => x.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
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
  const portefeuille = await analyserPortefeuille(resultats);

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

      {/* ---------- Une fiche par actif : chiffres, courbe, bilan du soir ---------- */}
      {resultats.map((r) =>
        estAnalyse(r) ? (
          <article key={r.symbole} className="fiche">
            <div className="fiche-tete">
              <div>
                <h2>{r.nom}</h2>
                <p className="prix">
                  {r.prix.toFixed(2)}{" "}
                  <small className={couleur(r.recap.derniereSeance)}>{pct(r.recap.derniereSeance)}</small>
                </p>
                <p className="discret">Clôture du {jour(r.date)}</p>
              </div>
              <div className="fiche-chiffres">
                <span className={`badge ${r.tendance === "haussière" ? "hausse" : "baisse"}`}>
                  {r.tendance === "haussière" ? "▲ Tendance haussière" : "▼ Tendance baissière"}
                </span>
                <dl>
                  <dt>MM {REGLES.mmCourte} j</dt>
                  <dd>{r.mmCourte.toFixed(2)}</dd>
                  <dt>MM {REGLES.mmLongue} j</dt>
                  <dd>{r.mmLongue.toFixed(2)}</dd>
                  <dt>vs plus haut 1 an</dt>
                  <dd className={r.baisseDepuisPlusHaut < -0.1 ? "rouge" : ""}>{pct(r.baisseDepuisPlusHaut)}</dd>
                </dl>
              </div>
            </div>

            {r.evenements.map((e) => (
              <p key={e.titre} className="signal">
                🔔 <b>{e.titre}</b>
                <br />
                {e.detail}
              </p>
            ))}

            <Courbe points={r.courbe} signaux={r.historique} mmC={REGLES.mmCourte} mmL={REGLES.mmLongue} />

            <h3 className="titre-bloc">Bilan du soir : était-il plus haut ensuite, dans le passé ?</h3>
            <ScoreHistorique score={r.score} />
          </article>
        ) : (
          <article key={r.symbole} className="fiche">
            <h2>{r.nom}</h2>
            <p className="rouge">Erreur : {r.erreur}</p>
          </article>
        )
      )}

      {/* ---------- Portefeuille (lecture seule) ---------- */}
      <section>
        <h2 className="titre-section">Mon portefeuille</h2>
        {portefeuille.erreur && <p className="rouge">{portefeuille.erreur}</p>}
        {portefeuille.lignes.length === 0 ? (
          !portefeuille.erreur && (
            <p className="vide">
              Aucune position saisie. Ajoute la variable <code>PORTEFEUILLE</code> dans Vercel (voir le README) pour suivre tes
              lignes ici.
            </p>
          )
        ) : (
          <>
            <div className="totaux">
              <div>
                <span className="discret">Valeur totale</span>
                <b>{eur(portefeuille.total)}</b>
              </div>
              <div>
                <span className="discret">Plus ou moins-value</span>
                <b className={couleur(portefeuille.total - portefeuille.totalRevient)}>
                  {eur(portefeuille.total - portefeuille.totalRevient)} (
                  {pct(portefeuille.totalRevient ? portefeuille.total / portefeuille.totalRevient - 1 : 0)})
                </b>
              </div>
            </div>
            <div className="tableau">
              <table>
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th>Quantité</th>
                    <th>Prix de revient</th>
                    <th>Cours</th>
                    <th>Valeur</th>
                    <th>Poids</th>
                    <th>+/- value</th>
                    <th>Tendance</th>
                    <th>vs plus haut</th>
                    <th>Plus haut à 1 an (passé)</th>
                  </tr>
                </thead>
                <tbody>
                  {portefeuille.lignes.map((l) => {
                    const a = l.analyse;
                    const an = a?.score?.echeances.find((e) => e.libelle === "1 an");
                    return (
                      <tr key={l.symbole}>
                        <td className="nom">{l.nom}</td>
                        <td>{l.quantite}</td>
                        <td>{l.prixRevient.toFixed(2)}</td>
                        {a ? (
                          <>
                            <td>{a.prix.toFixed(2)}</td>
                            <td>{eur(l.valeur!)}</td>
                            <td>{Math.round(l.poids! * 100)} %</td>
                            <td className={couleur(l.plusValue)}>
                              {eur(l.plusValue!)} ({pct(l.plusValuePct!)})
                            </td>
                            <td className={a.tendance === "haussière" ? "vert" : "rouge"}>
                              {a.tendance === "haussière" ? "▲ haussière" : "▼ baissière"}
                            </td>
                            <td>{pct(a.baisseDepuisPlusHaut)}</td>
                            <td>{an ? `${Math.round(an.tauxHausse * 100)} % des cas` : "—"}</td>
                          </>
                        ) : (
                          <td colSpan={7} className="rouge">
                            Erreur : {l.erreur}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="legende">
              Lecture seule : les chiffres décrivent chaque ligne avec les mêmes règles que plus haut. Ce ne sont pas des
              recommandations d&apos;achat ou de vente.
            </p>
          </>
        )}
      </section>

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
                  <tr key={`${s.nom}-${s.date.toISOString()}-${s.titre}`}>
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
        Signaux et statistiques automatiques basés sur tes règles et sur l&apos;historique, pas des conseils
        d&apos;investissement. Les performances passées ne préjugent pas des performances futures. C&apos;est toi qui décides et
        qui passes les ordres.
      </p>
    </main>
  );
}
