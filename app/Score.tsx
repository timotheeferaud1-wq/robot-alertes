import type { Score } from "../lib/analyse";

const pct = (x: number) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)} %`;

/** Le « bilan du soir » : ce qui s'est passé historiquement dans une situation comparable à aujourd'hui. */
export default function ScoreHistorique({ score }: { score: Score | null }) {
  if (!score) {
    return <p className="vide">Pas encore assez d&apos;historique pour calculer des statistiques fiables sur cet actif.</p>;
  }
  const meilleure = score.echeances.reduce((a, b) => (b.tauxHausse > a.tauxHausse ? b : a));

  return (
    <div className="score">
      <p className="situation">
        <b>Situation actuelle :</b> {score.situation}.
      </p>
      <div className="jauges">
        {score.echeances.map((e) => (
          <div key={e.libelle} className="jauge">
            <span className="jauge-libelle">à {e.libelle}</span>
            <span className={`jauge-valeur ${e.tauxHausse >= 0.6 ? "vert" : e.tauxHausse < 0.5 ? "rouge" : ""}`}>
              {Math.round(e.tauxHausse * 100)} %
            </span>
            <span className="jauge-barre">
              <span style={{ width: `${e.tauxHausse * 100}%` }} />
            </span>
            <span className="jauge-detail">
              médiane {pct(e.medianePerf)}
              <br />
              mauvais cas {pct(e.pireCas)}
            </span>
          </div>
        ))}
      </div>
      <p className="lecture">
        Depuis {score.depuis.getFullYear()}, dans cette situation, le prix était plus haut{" "}
        <b>
          {meilleure.libelle} plus tard dans {Math.round(meilleure.tauxHausse * 100)} % des cas
        </b>{" "}
        ({meilleure.nbCas.toLocaleString("fr-FR")} séances comparables). « Mauvais cas » : 1 fois sur 20, c&apos;était pire
        que ce chiffre. C&apos;est une statistique sur le passé, pas une prévision.
      </p>
    </div>
  );
}
