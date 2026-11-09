import { analyserTout, estAnalyse } from "../lib/donnees";
import { REGLES } from "../config";

export const revalidate = 3600; // les données sont rafraîchies au plus une fois par heure

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

export default async function Page() {
  const resultats = await analyserTout();

  return (
    <main>
      <h1>Robot d&apos;alertes</h1>
      <p className="sous-titre">
        Règles : moyennes mobiles {REGLES.mmCourte}/{REGLES.mmLongue} jours · alertes à{" "}
        {REGLES.seuilsBaisse.map((s) => `-${s * 100} %`).join(" et ")} du plus haut d&apos;un an
      </p>

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
              <p className="prix">{r.prix.toFixed(2)}</p>
              <dl>
                <dt>MM {REGLES.mmCourte} j</dt>
                <dd>{r.mmCourte.toFixed(2)}</dd>
                <dt>MM {REGLES.mmLongue} j</dt>
                <dd>{r.mmLongue.toFixed(2)}</dd>
                <dt>vs plus haut 1 an</dt>
                <dd className={r.baisseDepuisPlusHaut < -0.1 ? "rouge" : ""}>{pct(r.baisseDepuisPlusHaut)}</dd>
                <dt>Clôture du</dt>
                <dd>{r.date.toLocaleDateString("fr-FR")}</dd>
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

      <p className="mention">
        Signaux automatiques basés sur tes règles, pas des conseils d&apos;investissement. C&apos;est toi qui décides et
        qui passes les ordres.
      </p>
    </main>
  );
}
