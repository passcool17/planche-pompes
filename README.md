# Planche Pompes

Appli installable (PWA) pour la planche à pompes 21 en 1 (AERLANG PU3-B) : test sur la planche, plan de 7 jours aux couleurs du feuillet (pectoraux bleu, épaules rouge, dos jaune, triceps vert), échauffement guidé, minuteur de repos, suivi et progrès. Tout reste dans le téléphone (localStorage), fonctionne hors ligne.

**En ligne :** https://passcool17.github.io/planche-pompes/

## Plan
- Départ : niveau 1, 2 × 10 pour chaque couleur (programme de 7 jours du feuillet).
- 3 niveaux par couleur : 1 = poignées vers le bord extérieur, 3 = vers le centre (notre classement, pas celui du feuillet). Chaque niveau a une position par défaut et parfois une 2e au choix.
- Semaine réussie (toutes les séries atteintes, pas « Difficile ») : +1 répétition/série (45 ans et plus) ou +2.
- Semaine réussie à 2 × 15 : niveau suivant, retour à 2 × 10. Au niveau 3, après 2 × 15 : 3 × 10.
- Semaine 4 allégée (2 séries, environ −30 %), puis le cycle suivant repart du niveau atteint.
- Test sur la planche optionnel : la cible ne dépasse pas 75 % du dernier max fait au même niveau (jamais sous 2 × 10).

## Développement
```
npm install
npm run dev
npm run build
```
Déploiement automatique sur GitHub Pages à chaque push sur `main`.

Ces conseils ne remplacent pas un avis médical.
