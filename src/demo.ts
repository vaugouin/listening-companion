import type { Card, Statement } from './domain';

const works: [string,string,string,number,string][] = [
  ['269','À bout de souffle','1960',7.7,'Godard'],['1423','Pierrot le fou','1965',7.4,'Godard'],['147','Les Quatre Cents Coups','1959',8.1,'Truffaut'],['1626','Jules et Jim','1962',7.7,'Truffaut'],
  ['4933','Le Mépris','1963',7.5,'Godard'],['3972','Vivre sa vie','1962',7.8,'Godard'],['8072','Bande à part','1964',7.6,'Godard'],['4576','Masculin féminin','1966',7.4,'Godard'],
  ['4416','Alphaville','1965',7.0,'Godard'],['315','La Nuit américaine','1973',8.0,'Truffaut'],['272','Tirez sur le pianiste','1960',7.4,'Truffaut'],['1712','Baisers volés','1968',7.6,'Truffaut'],
  ['499','Cléo de 5 à 7','1962',7.8,'Varda'],['804','Hiroshima mon amour','1959',7.8,'Resnais'],['4024','L’Année dernière à Marienbad','1961',7.6,'Resnais'],['2993','Les Parapluies de Cherbourg','1964',7.8,'Demy'],
  ['252','Le Beau Serge','1958',7.0,'Chabrol'],['408','Les Cousins','1959',7.2,'Chabrol'],['101','Les Demoiselles de Rochefort','1967',7.7,'Demy'],['314','La Collectionneuse','1967',7.3,'Rohmer'],
  ['157336','Interstellar','2014',8.7,'Nolan'],['27205','Inception','2010',8.8,'Nolan'],['155','The Dark Knight','2008',9.0,'Nolan'],['77','Memento','2000',8.4,'Nolan'],
  ['1124','Le Prestige','2006',8.5,'Nolan'],['374720','Dunkerque','2017',7.8,'Nolan'],['577922','Tenet','2020',7.3,'Nolan'],['872585','Oppenheimer','2023',8.3,'Nolan'],['demo-odyssee','L’Odyssée','2026',0,'Nolan'],
];
export const demoCards: Card[] = works.map(([id,title,subtitle,score,director]) => ({ entity: 'movie', id, title, subtitle, image: null, score: score || null, weighted: score, popularity: 0, description: `Exemple de la démonstration. Réalisation : ${director}. Les affiches typographiques et les notes sont illustratives.` }));
const make = (operation: Statement['operation'], property: string, value: string, label = value, named = false, topic = 'Nouvelle Vague'): Statement => ({ operation, entity: 'movie', property, value, label, named, topic, evidence: value, targetId: null });
export const demoTurns = [
  { speaker: 'Claire', text: 'Aujourd’hui, dans Hors Champ, on parle de la Nouvelle Vague. Ces films ont changé notre manière de regarder le cinéma.', statements: [make('new','mouvement','Nouvelle Vague')] },
  { speaker: 'Claire', text: 'Et chez Jean-Luc Godard, tout ça devient encore plus libre. Le montage fait partie du langage.', statements: [make('refine','réalisateur','Jean-Luc Godard','Godard')] },
  { speaker: 'Claire', text: 'Je pense évidemment à Pierrot le fou, avec ce bleu qui déborde partout.', statements: [make('refine','titre','Pierrot le fou','Pierrot le fou',true)] },
  { speaker: 'Malik', text: 'Non, chez Truffaut, c’est une autre émotion. Les Quatre Cents Coups, par exemple, me touche beaucoup plus.', statements: [make('fork','réalisateur','François Truffaut','Truffaut'),make('refine','titre','Les Quatre Cents Coups','Les Quatre Cents Coups',true)] },
  { speaker: 'Claire', text: 'Changeons de sujet. Christopher Nolan, lui, prépare L’Odyssée. Une tout autre façon de jouer avec le temps.', statements: [make('new','réalisateur','Christopher Nolan','Nolan',false,'Christopher Nolan'),make('refine','titre','L’Odyssée','L’Odyssée',true,'Christopher Nolan')] },
  { speaker: 'Malik', text: 'Pour revenir à la Nouvelle Vague, chez Godard, À bout de souffle reste le point de départ.', statements: [make('back','réalisateur','Jean-Luc Godard','Retour à Godard'),make('refine','titre','À bout de souffle','À bout de souffle',true)] },
];
export function searchDemo(criteria: {property: string; value: string}[]) {
  const title = criteria.find(c => c.property === 'titre')?.value;
  const director = criteria.find(c => c.property === 'réalisateur')?.value.split(' ').at(-1);
  return demoCards.filter(c => title ? c.title === title : director ? c.description?.includes(`: ${director}.`) : !c.description?.includes('Nolan')).sort((a,b) => b.weighted-a.weighted);
}
