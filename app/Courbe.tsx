import type { PointCourbe, SignalPasse } from "../lib/analyse";

const L = 640;
const H = 230;
const M = { haut: 12, droite: 52, bas: 24, gauche: 8 };

/** Courbe du prix et des deux moyennes mobiles sur 12 mois, avec les signaux passés. Pur SVG, rendu côté serveur. */
export default function Courbe({ points, signaux, mmC, mmL }: { points: PointCourbe[]; signaux: SignalPasse[]; mmC: number; mmL: number }) {
  if (points.length < 2) return null;
  const valeurs = points.flatMap((p) => [p.prix, p.mmC, p.mmL]).filter(Number.isFinite);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const marge = (max - min) * 0.06 || 1;
  const yMin = min - marge;
  const yMax = max + marge;
  const t0 = points[0].date.getTime();
  const t1 = points[points.length - 1].date.getTime();

  const x = (d: Date) => M.gauche + ((d.getTime() - t0) / (t1 - t0)) * (L - M.gauche - M.droite);
  const y = (v: number) => M.haut + (1 - (v - yMin) / (yMax - yMin)) * (H - M.haut - M.bas);
  const trace = (cle: "prix" | "mmC" | "mmL") =>
    points
      .filter((p) => Number.isFinite(p[cle]))
      .map((p, k) => `${k ? "L" : "M"}${x(p.date).toFixed(1)},${y(p[cle]).toFixed(1)}`)
      .join(" ");

  // Graduations : 4 niveaux de prix, et le début de chaque trimestre
  const niveaux = [0, 1, 2, 3].map((k) => yMin + ((k + 0.5) / 4) * (yMax - yMin));
  const mois: Date[] = [];
  const d = new Date(points[0].date);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  while (d.getTime() < t1) {
    if (d.getMonth() % 3 === 0) mois.push(new Date(d));
    d.setMonth(d.getMonth() + 1);
  }
  const couleurSignal = { croisement_haussier: "var(--hausse)", croisement_baissier: "var(--baisse)", baisse: "var(--orange)" };
  const dernier = points[points.length - 1];

  return (
    <figure className="courbe">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Prix et moyennes mobiles sur 12 mois">
        {niveaux.map((v) => (
          <g key={v}>
            <line x1={M.gauche} x2={L - M.droite} y1={y(v)} y2={y(v)} style={{ stroke: "var(--bordure)" }} />
            <text x={L - M.droite + 6} y={y(v) + 4} className="axe">
              {v.toFixed(v > 1000 ? 0 : 1)}
            </text>
          </g>
        ))}
        {mois.map((m) => (
          <text key={m.toISOString()} x={x(m)} y={H - 6} className="axe" textAnchor="middle">
            {m.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}
          </text>
        ))}
        <path d={trace("mmL")} fill="none" style={{ stroke: "var(--bleu)", strokeWidth: 1.6 }} />
        <path d={trace("mmC")} fill="none" style={{ stroke: "var(--accent)", strokeWidth: 1.6 }} />
        <path d={trace("prix")} fill="none" style={{ stroke: "var(--texte)", strokeWidth: 1.4 }} />
        {signaux
          .filter((s) => s.date.getTime() >= t0)
          .map((s) => (
            <circle
              key={`${s.date.toISOString()}-${s.titre}`}
              cx={x(s.date)}
              cy={y(s.prix)}
              r={4.5}
              style={{ fill: couleurSignal[s.type], stroke: "var(--carte)", strokeWidth: 1.5 }}
            >
              <title>{`${s.date.toLocaleDateString("fr-FR")} : ${s.titre}`}</title>
            </circle>
          ))}
        <circle cx={x(dernier.date)} cy={y(dernier.prix)} r={3} style={{ fill: "var(--texte)" }} />
      </svg>
      <figcaption className="legende-courbe">
        <span><i style={{ background: "var(--texte)" }} /> Prix</span>
        <span><i style={{ background: "var(--accent)" }} /> MM {mmC} j</span>
        <span><i style={{ background: "var(--bleu)" }} /> MM {mmL} j</span>
        <span><b style={{ background: "var(--hausse)" }} /> achat</span>
        <span><b style={{ background: "var(--baisse)" }} /> vente</span>
        <span><b style={{ background: "var(--orange)" }} /> baisse</span>
      </figcaption>
    </figure>
  );
}
