# Planche Pompes

Appli installable (PWA) pour la planche à pompes 21 en 1 (AERLANG PU3-B) : test sur la planche, plan de 7 jours aux couleurs du feuillet (pectoraux bleu, épaules rouge, dos jaune, triceps vert), échauffement guidé, minuteur de repos, suivi et progrès. Tout reste dans le téléphone (localStorage), fonctionne hors ligne.

**En ligne :** https://passcool17.github.io/planche-pompes/

## Plan
- Départ : 2 × 10 pour chaque couleur (programme de 7 jours du feuillet).
- Semaine réussie (toutes les séries atteintes, pas « Difficile ») : +1 répétition/série (45 ans et plus) ou +2.
- À 2 × 15 : passage à 3 × 10, puis même progression.
- Semaine 4 allégée (2 séries, environ −30 %), puis le cycle suivant repart du niveau atteint.
- Test sur la planche optionnel : la cible ne dépasse pas 75 % du dernier max (jamais sous 2 × 10).

## Développement
```
npm install
npm run dev
npm run build
```
Déploiement automatique sur GitHub Pages à chaque push sur `main`.

Ces conseils ne remplacent pas un avis médical.
