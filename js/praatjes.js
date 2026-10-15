/*
 Praatjes met Mark en Johan (stap 192, gevraagd: "Kan je voor missies tussendoor of na het spel zorgen dat je Johan en Mark kan
 vinden. Mark Molenkrite 15. Johan bij zijn huis. Ze geven diverse random dialogen als je probeert te praten. Los van het naar
 voetbal gaan en op de bank zitten. Johan heeft het bijv over binnenkort weer naar Yugo gaan, is een restaurant. Mark heeft het over
 GTA 6 die uitkomt in november, spelletjesavond organiseren met het gezin, kaasfonduen binnenkort.").

 Hier alleen de gesprekken en het kiezen; js/verhaal.js zet Mark op de stoep van Molenkrite 15 en Johan op zijn oprit aan het
 Kruirad 62 (als ze niet ergens anders nodig zijn) en speelt een praatje af met E. Na het einde zit Mark binnen op de bank: daar is
 het keuze 3, naast de wedstrijd en de bank.

 Een regel is [wie, tekst] met wie = 'm' (Mark), 'j' (Johan) of 'e' (Erik). Geen verhaal erin: de praatjes moeten tussen elke
 twee missies kunnen, en na het einde.
*/
export const PRAATJES = {
  mark: [
    [['m', 'Heb je het gehoord? GTA 6 komt in november uit. Ik heb hem al besteld.'], ['e', 'Wij wonen er toch al in?'], ['m', 'Haha. Maar daar heb je tenminste geen buren die om zeven uur gaan boren.']],
    [['m', 'Zaterdag organiseer ik een spelletjesavond met het gezin. Monopoly, Kolonisten, en de kinderen willen Mario Kart.'], ['e', 'Ik neem chips mee.'], ['m', 'Neem twee zakken mee. Bij Monopoly wordt er altijd ruzie gemaakt, dan heb je wat te knabbelen.']],
    [['m', 'Binnenkort kaasfondue. Het stel staat al klaar, nu nog Gruyère en een stokbrood of drie.'], ['e', 'Als ik mijn brood maar niet in de pan laat vallen.'], ['m', 'Dan geef jij een rondje. Zo zijn de regels.']],
    [['m', 'November, Erik. GTA 6. Ik neem die week vrij.'], ['e', 'De hele week?'], ['m', 'Ik heb het al met mijn vrouw besproken. Nou ja, ik heb het gezegd. Besproken is een groot woord.']],
    [['m', 'Ik twijfel nog: na de kaasfondue een spelletjesavond, of andersom?'], ['e', 'Eerst eten. Met een lege maag verlies je met Risk.'], ['m', 'Daar zit wat in.']],
    [['m', 'Zondag Formule 1. Kom je kijken? Ik maak tosti\'s.'], ['e', 'Met ham en kaas?'], ['m', 'Met ham, kaas en ketchup. Ik ben geen barbaar.']],
    [['m', 'De Golf moet binnenkort naar de APK. Hopelijk keuren ze hem nog één jaar.'], ['e', 'Die roest houdt hem bij elkaar.'], ['m', 'Zeg dat maar niet tegen de monteur.']],
    [['m', 'Ik ben begonnen met hardlopen. Twee rondjes om de Molenkrite en ik ben kapot.'], ['e', 'Twee rondjes?'], ['m', 'Nou ja, anderhalf. Dan loop ik terug.']],
    [['m', 'In augustus is het weer Sneekweek. Muziek op de Kaden, en de hele stad op het water.'], ['e', 'En jij op het terras.'], ['m', 'Iemand moet op de boten letten.']],
    [['m', 'Mijn schoonmoeder is zondag jarig. Een kringverjaardag. Koffie, gebak, en dan drie uur over het weer.'], ['e', 'Sterkte.'], ['m', 'Ik neem mijn telefoon mee en ga "even naar de wc".']],
    [['m', 'Bij de Poiesz hebben ze bier in de aanbieding. Ik heb er voor de spelletjesavond meteen twee kratten gehaald.'], ['e', 'Voor de kinderen?'], ['m', 'Die krijgen limonade. Het bier is voor als ik verlies.']],
    [['m', 'De schutting achter wiebelt. Ik moet nog naar de bouwmarkt voor schroeven.'], ['e', 'Dat zeg je al een maand.'], ['m', 'En hij staat nog steeds. Dus zo erg is het niet.']],
    [['m', 'Als het ooit weer gaat vriezen, gaat de Elfstedentocht door Sneek. Dan sta ik vooraan bij de brug.'], ['e', 'Met snert?'], ['m', 'Met snert in een thermoskan en een warme chocomel voor de kinderen.']],
    [['m', 'Weet je wat ik in GTA 6 als eerste ga doen? Gewoon een uur rondrijden met de radio aan.'], ['e', 'Dat doe je hier toch ook?'], ['m', 'Hier moet ik zelf tanken.']],
    [['m', 'We gaan deze zomer met de caravan naar Frankrijk. Twaalf uur rijden met drie kinderen achterin.'], ['e', 'Neem een tablet mee voor ze.'], ['m', 'Drie tablets, Erik. Anders wordt het oorlog.']],
  ],
  johan: [
    [['j', 'We moeten binnenkort weer eens naar Yugo. Mixed grill, ćevapčići, en die rakija van het huis.'], ['e', 'Jij trakteert.'], ['j', 'Wie het laatst bij de auto is, betaalt.']],
    [['j', 'Heb je de nieuwe kaart van Yugo gezien? Ze hebben nu ook pljeskavica met kaas erin.'], ['e', 'Zaterdag?'], ['j', 'Ik reserveer voor zeven uur. Kom met honger.']],
    [['j', 'Bij Yugo krijg je zo veel vlees dat je de dag erna nog vol zit. Daarom ga ik er altijd op vrijdag heen.'], ['e', 'Slim.'], ['j', 'Dan heb je het hele weekend om bij te komen.']],
    [['j', 'Zondagochtend ga ik vissen aan de Geeuw. Vorige keer ving ik een snoek van tachtig centimeter.'], ['e', 'Tachtig?'], ['j', 'Nou, zestig. Maar hij vocht als een tachtiger.']],
    [['j', 'Vrijdag darten in het café. Ik gooi nog steeds geen 180, maar het bier is goed.'], ['e', 'Wat is je hoogste?'], ['j', '140. Eén keer. Er was niemand bij, maar het was echt zo.']],
    [['j', 'Ik ben lid geworden van de sportschool. Tot nu toe twee keer geweest.'], ['e', 'In hoeveel tijd?'], ['j', 'Drie maanden. Maar ik heb wel een mooie bidon gekocht.']],
    [['j', 'De buurman is al drie weken aan het verbouwen. Elke ochtend om zeven uur gaat de boormachine aan.'], ['e', 'Ga eens langs.'], ['j', 'Heb ik gedaan. Nu boort hij om half acht. Vooruitgang.']],
    [['j', 'Op Radio Tinga draaien ze tegenwoordig Sultans of Swing. Wat een gitaar, man.'], ['e', 'Mark zet hem in de auto keihard.'], ['j', 'Mark zingt mee. Vals. Dat is het probleem.']],
    [['j', 'Gisteren pannenkoeken gebakken. Met spek en stroop, dat blijft de beste.'], ['e', 'En de eerste?'], ['j', 'De eerste mislukt altijd. Die eet je zelf boven de pan op.']],
    [['j', 'Ik denk erover een sloepje te kopen. Op een zomeravond over het Sneekermeer.'], ['e', 'Kun je wel varen?'], ['j', 'Hoe moeilijk kan het zijn? Gas erop en niet tegen de brug aan.']],
    [['j', 'Klaverjassen vanavond? Mark zegt dat hij het kan, maar hij verzaakt elke keer.'], ['e', 'Ik speel met jou.'], ['j', 'Afgesproken. Dan zetten we Mark tegenover zijn schoonmoeder.']],
    [['j', 'Ik wil een weekendje naar Texel. Fietsen, vis eten, een beetje uitwaaien.'], ['e', 'In je eentje?'], ['j', 'Met de fiets van de buurman. Die is toch aan het verbouwen.']],
    [['j', 'Na Yugo nemen we altijd nog een ijsje op de terugweg. Traditie.'], ['e', 'Na al dat vlees?'], ['j', 'IJs past altijd. Dat gaat in een ander vakje.']],
  ],
};

/*
 Een praatje kiezen: willekeurig, maar niet een van de laatste `n` (zo hoor je niet twee keer achter elkaar hetzelfde).
 `recent` is een rij met indexen die hier wordt bijgewerkt.
*/
export function kiesPraatje(lijst, recent, n = 4, r = Math.random) {
  const kan = lijst.map((_, i) => i).filter(i => !recent.includes(i));
  const i = kan.length ? kan[Math.floor(r() * kan.length)] : Math.floor(r() * lijst.length);
  recent.push(i);
  while (recent.length > Math.min(n, lijst.length - 1)) recent.shift();
  return i;
}
