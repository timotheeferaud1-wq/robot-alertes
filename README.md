# Robot d'alertes

Chaque soir de semaine, le robot récupère les vrais cours de clôture (Yahoo Finance),
applique tes règles et t'envoie un **mail uniquement quand un signal apparaît** :

- **Signal d'achat** : la moyenne 50 jours repasse au-dessus de la moyenne 200 jours.
- **Signal de vente** : elle repasse en dessous.
- **Baisse** : le prix passe pour la première fois sous -10 % ou -20 % de son plus haut d'un an.

La page d'accueil affiche un tableau de bord de tous les actifs surveillés.
Le robot ne passe **aucun ordre** : c'est toi qui décides et qui agis chez ton courtier.

## Modifier les actifs ou les règles

Tout se passe dans `config.ts`. Après modification, pousse sur GitHub et Vercel redéploie tout seul.

## Mise en ligne (≈ 15 minutes, gratuit)

1. **Resend (envoi des mails)** : crée un compte gratuit sur resend.com avec l'adresse
   où tu veux recevoir les alertes, puis crée une clé API (menu *API Keys*).
2. **GitHub** : crée un nouveau dépôt `robot-alertes` et envoie-y ce dossier
   (bouton *uploading an existing file*, ou `git init && git add . && git commit -m "init" && git push`).
3. **Vercel** : *Add New → Project*, importe le dépôt `robot-alertes`.
   Avant de cliquer sur *Deploy*, ajoute dans *Environment Variables* :
   - `RESEND_API_KEY` : ta clé Resend
   - `EMAIL_DESTINATAIRE` : l'adresse de ton compte Resend
   - `CRON_SECRET` : un long mot de passe aléatoire de ton choix
   - `MOT_DE_PASSE_SITE` : le mot de passe pour ouvrir le tableau de bord (n'importe quel identifiant + ce mot de passe)
   - `PORTEFEUILLE` (facultatif) : tes positions, voir plus bas
4. Déploie. La tâche planifiée (dans `vercel.json`) se déclenche du lundi au vendredi
   entre 22 h et 23 h UTC (23 h – minuit à Paris en hiver), après la clôture des marchés.

## Tester l'envoi d'un mail tout de suite

Dans le Terminal, en remplaçant les deux valeurs :

```
curl -H "Authorization: Bearer TON_CRON_SECRET" "https://TON-PROJET.vercel.app/api/check?test=1"
```

Tu dois recevoir un mail de test avec la vue d'ensemble des actifs.

## Lancer en local

```
npm install
cp .env.example .env.local   # puis remplis les valeurs
npm run dev                  # http://localhost:3000
```

## Bilan du soir

Avec `ENVOI_QUOTIDIEN = true` dans `config.ts`, tu reçois un mail chaque soir de semaine, signal ou pas.
Pour chaque actif, le bilan indique, **dans les situations passées comparables à aujourd'hui**
(même tendance, même écart au plus haut), à quelle fréquence le prix était plus haut
1 mois, 3 mois, 6 mois et 1 an plus tard. C'est une statistique sur le passé, pas une prévision.

## Mon portefeuille (lecture seule)

Ajoute dans Vercel une variable `PORTEFEUILLE` au format JSON (une ligne par position) :

```
[{"symbole":"CW8.PA","nom":"MSCI World","quantite":2,"prixRevient":520.5},
 {"symbole":"AAPL","nom":"Apple","quantite":5,"prixRevient":180}]
```

Les symboles sont ceux de finance.yahoo.com. Le portefeuille n'est jamais écrit dans le code
ni sur GitHub, et il ne s'affiche que si `MOT_DE_PASSE_SITE` est défini.
Après un changement de variable, relance un déploiement dans Vercel (*Deployments* → *Redeploy*).
