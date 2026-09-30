/* =====================================================================
   TEKSTEN VAN DE MELDKAMER
   Hier staat alles wat de 112-centralist en de meldkamer ambulance zeggen.

   Zo pas je een tekst aan:
   - Verander alleen wat tussen de dubbele aanhalingstekens "..." staat.
   - Laat de naam ervoor (bijv. doorverbinden:) en de komma erachter staan.
   - Gebruik binnen een tekst geen dubbele aanhalingstekens; enkele '...' mogen wel.

   Deze woorden tussen accolades vult de app zelf in:
     {hij} {hem} {zijn}  wordt zij / haar als het slachtoffer een vrouw is
     {door}              "Volg de instructies van de AED." of "Blijf doordrukken."
     {adres} {straat}    het adres van de gekozen locatie
   Schrijf 112 en AED gewoon zo; de app spreekt ze goed uit.
   ===================================================================== */

/* ---------- Vragen van de meldkamer ----------
   vraag: de volledige vraag. kort: als de meldkamer de vraag herhaalt. */
const VRAGEN = {
  // 112-centralist neemt op
  opening: { vraag:"112, wie wilt u spreken: ambulance, brandweer of politie?", kort:"Ambulance, brandweer of politie?" },
  // adres (112-centralist)
  address: { vraag:"Wat is het adres? Straat, huisnummer en plaats.", kort:"Wat is het adres?" },
  // meldkamer ambulance neemt op, adres nog onbekend
  ambOpen: { vraag:"Meldkamer ambulance. Waar bent u precies? Noem straat, huisnummer en plaats.", kort:"Waar bent u precies?" },
  // reageert hij?
  unresp: { vraag:"Reageert {hij} als u {hem} aanspreekt en aan {zijn} schouders schudt?", kort:"Reageert {hij}?" },
  // ademt hij normaal?
  breath: { vraag:"Ademt {hij} normaal? Kijk en luister.", kort:"Ademt {hij} normaal?" },
  // klopt het adres?
  confirm: { vraag:"Klopt het adres?", kort:"Klopt het adres?" },
  // kort scenario: reactie en ademhaling in één vraag
  combo: { vraag:"Reageert {hij} en ademt {hij} normaal?", kort:"Reageert {hij} en ademt {hij} normaal?" },
  // weet de beller hoe reanimeren moet?
  know: { vraag:"U gaat reanimeren. Weet u hoe dat moet?", kort:"Weet u hoe u moet reanimeren?" },
};

/* ---------- Alle andere zinnen ---------- */
const TEKST = {

  // ===== Algemeen =====
  doorMetAed: "Volg de instructies van de AED.",
  doorZonderAed: "Blijf doordrukken.",
  blijfAanLijn: "Ik blijf aan de lijn.",
  hoortUMij: "Hallo, hoort u mij?",

  // ===== 112-centralist en doorverbinden =====
  doorverbinden: "Ik verbind u door met de ambulance.",
  andereDienst: "Voor iemand die onwel is heeft u de ambulance nodig. Ik verbind u door met de ambulance.",
  dienstOpnieuw: "Wie wilt u spreken: ambulance, brandweer of politie?",
  meldkamerAmbulance: "Meldkamer ambulance.",

  // ===== Meldkamer ambulance: vragen en bevestigingen =====
  ambOpenKort: "Meldkamer ambulance. Waar bent u precies?",
  weetHoeKort: "Weet u hoe u moet reanimeren?",
  weetHoeAlBezig: "U bent al aan het reanimeren. Weet u hoe het moet?",
  nogEensSchudden: "Controleer het nog een keer: schud stevig aan {zijn} schouders. Reageert {hij}?",
  happenGeenAdem: "Af en toe happen of snurken is geen normale ademhaling.",
  adresGenoteerd: "Ik heb het adres genoteerd.",
  adresVerbeterd: "Excuses, het {straat}. Genoteerd.",
  enHetAdres: "En wat is het adres?",
  alGestart: "U bent al gestart met reanimeren, heel goed.",
  alGestartKort: "Goed.",

  // ===== Start van de reanimatie (lang scenario) =====
  stuurMetAed: "Ik stuur twee ambulances. Fijn dat de AED er al is: volg de instructies van de AED.",
  stuurAedGehaald: "Ik stuur twee ambulances en alarmeer ook burgerhulpverleners. Goed dat er al een AED wordt gehaald.",
  stuurGeenAed: "Ik stuur twee ambulances. Er is op dit moment helaas geen AED in de buurt beschikbaar, de ambulance neemt er een mee.",
  stuurAed: "Ik stuur twee ambulances en alarmeer burgerhulpverleners met een AED.",
  luidspreker: "Zet uw telefoon op de luidspreker en leg hem naast u neer.",
  hoeAlBezig: "Goed, gaat u door. U doet het goed.",
  hoeWeetHet: "Goed. Begint u maar, ik blijf aan de lijn.",
  hoeUitleg: "Ik help u. Leg uw handen op elkaar, midden op de borst. Druk met gestrekte armen vijf tot zes centimeter diep, ongeveer twee keer per seconde, en laat de borst steeds helemaal terugkomen. Begin nu.",
  wisselMetHulp: "Er is nog iemand bij u: wissel ongeveer elke twee minuten van wie er drukt, liefst tijdens de analyse van de AED.",
  collegaWeg: "U bent nu alleen bij de persoon. Zeg het zodra uw collega terug is.",
  vraagAed: "Is er een AED ter plaatse, of wordt die gehaald?",

  // ===== Start van de reanimatie (kort scenario) =====
  kortStuurMetAed: "Twee ambulances zijn onderweg. Volg de AED.",
  kortStuurGeenAed: "Twee ambulances zijn onderweg, zij nemen een AED mee.",
  kortStuur: "Twee ambulances en burgerhulpverleners met een AED zijn onderweg.",
  kortLuidspreker: "Zet de telefoon op de luidspreker.",
  kortHoeAlBezig: "Ga door.",
  kortHoeWeetHet: "Begint u maar.",
  kortHoeUitleg: "Handen midden op de borst, armen gestrekt, stevig en snel drukken. Begin nu.",
  kortWissel: "Wissel elke twee minuten.",
  kortVraagAed: "Is er een AED?",

  // ===== Coaching tijdens het reanimeren (lang scenario; in het korte scenario alleen de wissel-zinnen) =====
  coach30s: "Blijf stevig en snel drukken, ongeveer twee keer per seconde. Ik blijf aan de lijn.",
  coach70s: "Gaat het nog? We doen dit stap voor stap. De hulp is onderweg.",
  coachBijnaTweeMinuten: "Het is bijna twee minuten. Wissel straks van wie er drukt, snel en zonder pauze.",
  coachHoudVol: "Houd vol, de hulp komt eraan. Ik blijf aan de lijn.",
  coachGaatHetNog: "Gaat het nog? Zeg het als u moe wordt.",
  coachWissel: "Weer twee minuten. Wissel als dat kan, zonder pauze.",

  // ===== Hulp bij de beller =====
  helpersErbij: "Duidelijk, er is nog iemand bij u. Laat die persoon zo nodig helpen of straks het drukken overnemen. Wissel ongeveer elke twee minuten, liefst tijdens de analyse van de AED.",
  helpersCollegaWeg: "Duidelijk, u bent nu alleen bij de persoon. Blijf reanimeren en houd de telefoon op de luidspreker. Zeg het zodra uw collega terug is.",
  helpersAlleen: "Duidelijk, u bent alleen. Ik blijf aan de lijn. {door}",

  // ===== Vragen tijdens het reanimeren (lang scenario) =====
  vraagTerugbel: "Voor als de verbinding wegvalt: op welk nummer kan ik u terugbellen?",
  vraagNaamNaNummer: "Dank u. En wat is uw naam?",
  vraagNaamGeenNummer: "Dat is goed. En wat is uw naam?",
  naamDank: "Dank u. U doet het goed.",
  vraagWatGebeurd: "Weet u wat er gebeurd is?",
  watDank: "Dank u, dat geef ik door aan de ambulance.",
  vraagLeeftijd: "Hoe oud is {hij} ongeveer?",
  leeftijdDank: "Dank u. De hulp is onderweg.",
  weetNiet: "Dat weet ik niet precies. De hulp is onderweg en ik blijf aan de lijn. {door}",

  // ===== AED =====
  aedAntwoordNeeMetHulp: "Ik heb burgerhulpverleners met een AED gealarmeerd. Laat iemand kijken of er in het gebouw een AED hangt en die halen.",
  aedAntwoordNeeAlleen: "Blijf bij de persoon en ga door met reanimeren. Ik heb burgerhulpverleners met een AED gealarmeerd.",
  aedAntwoordJa: "Goed. {door}",
  aedHaalVlakbij: "Haal die AED en kom meteen terug naar de persoon. Zet hem aan en volg de gesproken aanwijzingen.",
  aedWaarBlijftGehaald: "Ik hoor u. Blijf nu drukken. Zodra iemand terugkomt, vertel me dat; dan help ik u met de AED.",
  aedWaarBlijftGeenAed: "Er is op dit moment geen AED in de buurt beschikbaar. De ambulance neemt er een mee. {door}",
  aedWaarBlijft: "Ik heb burgerhulpverleners met een AED gealarmeerd. Is er in het gebouw een AED, laat die dan halen als er iemand is die dat kan. {door}",
  aedGehaaldAlleen: "Duidelijk, de AED wordt gehaald en u bent nu alleen bij de persoon. Blijf reanimeren. Zeg het zodra uw collega terug is.",
  aedGehaaldMetHulp: "Goed, de AED is onderweg en er is nog iemand bij u. Laat die zo nodig helpen of straks het drukken overnemen.",
  aedGehaaldWieNog: "Goed dat de AED wordt gehaald. Is er nu nog iemand anders bij u?",
  aedErMetHulp: "Laat de AED aanzetten en de elektroden aanbrengen, terwijl u zo veel mogelijk doorgaat met drukken. Volg de gesproken aanwijzingen.",
  aedErAlleen: "Zet de AED aan. Maak de borstkas vrij en plak de elektroden volgens de afbeeldingen. Volg de gesproken instructies.",
  aedPlakkenMetHulp: "Goed. Ga zo veel mogelijk door met drukken terwijl de elektroden worden geplakt. Daarna volgt u de gesproken aanwijzingen.",
  aedPlakkenAlleen: "Goed. Volg de gesproken aanwijzingen van de AED. Ik blijf aan de lijn.",
  aedAnalyse: "Raak de persoon nu niet aan, en zorg dat niemand anders dat doet.",
  aedSchok: "Zorg dat niemand de persoon aanraakt. Volg de AED voor de schok en ga daarna direct verder met reanimeren.",
  aedSchokGegeven: "Goed. Ga direct weer verder met reanimeren, zoals de AED zegt.",
  aedGeenSchok: "Volg de AED en ga direct verder met reanimeren.",
  aedDoorgaan: "Ja. Ga door met drukken, en beademen als u dat kunt. Ik blijf aan de lijn.",
  tekenenBeweegt: "Wat doet {hij} precies? Opent {hij} de ogen, reageert {hij} duidelijk en ademt {hij} normaal? Bij twijfel gaat u door met reanimeren.",
  tekenenAdemtWeer: "Blijf bij {hem} en controleer de ademhaling en reactie voortdurend. Houd de luchtweg vrij. Laat de AED aan en de elektroden zitten. Vertel het meteen als het slechter gaat. Stopt het normale ademen, begin dan direct weer met reanimeren.",

  // ===== Ambulance komt aan =====
  sireneMetHulp: "Ik hoor de sirene, de ambulance is er bijna. Laat iemand hen opvangen en de weg wijzen. Ga door tot het ambulanceteam het overneemt.",
  sireneAlleen: "Ik hoor de sirene, de ambulance is er bijna. Blijf bij de persoon en ga door tot het ambulanceteam het overneemt.",
  ambulanceBijU: "De ambulance is bij u. Vertel de hulpverleners kort wat er is gebeurd, wanneer de reanimatie begon en wat de AED heeft aangegeven. Laat hen de zorg overnemen. Ik hang nu op.",

  // ===== Tips voor de student (alleen zichtbaar in de uitslag, niet uitgesproken) =====
  tipAndereDienst: "Bij iemand die niet reageert vraag je om de ambulance.",
  tipMeteenAmbulance: "Zeg meteen 'ambulance'. Dat scheelt tijd.",
  tipHapt: "Hij reageert niet en hapt af en toe naar adem: dat is geen normale ademhaling.",
  tipReageerdeNiet: "Hij reageerde niet op aanspreken en schudden.",
  tipHappen: "Af en toe happen of snurken is geen normale ademhaling. Twijfel? Dan niet normaal.",
  tipAdresFout: "De meldkamer herhaalde het adres verkeerd. Luister goed en verbeter het meteen.",
  tipAdresEerst: "Het adres is: {adres}. De meldkamer vraagt dit altijd als eerste.",
};

/* ---------- Antwoorden op vragen en opmerkingen van de student tijdens het reanimeren ----------
   herken:   woorden waarop de meldkamer reageert, gescheiden door een | (bijv. /moe|zwaar|kan niet meer/).
             Kleine letters, en de lijst begint en eindigt met een schuine streep /.
   antwoord: wat de meldkamer dan zegt.
   metHulp / alleen: twee versies, afhankelijk van of er nog iemand bij de beller is.
   altijd:true  de meldkamer antwoordt ook als de AED al aan staat (anders alleen bij een echte vraag).
   De bovenste regel die past wint, dus zet specifieke regels boven algemene. */
const ANTWOORDEN = [
  { herken:/stop de oefening|einde oefening|oefening stoppen/, soort:'stop' },
  { herken:/ambulance is (er|hier|binnen|gearriveerd|aangekomen)|ambulance staat|hulpverleners zijn er|ambulancepersoneel|ambulance neemt|ambulanceteam is/, soort:'overdracht',
    antwoord:"Fijn. Vertel de hulpverleners waar de persoon ligt, en geef kort door wanneer u hem aantrof, wanneer de reanimatie begon en wat de AED heeft aangegeven. Laat hen de zorg overnemen. Ik hang nu op." },
  { herken:/aanrij|hoe lang (duurt|nog)|hoe ver|wanneer (is|zijn|komt|komen)|waar blijft de ambulance|hoelang/,
    antwoord:"De ambulances zijn met spoed onderweg. Een exacte tijd kan ik niet geven. Ik blijf aan de lijn. {door}", altijd:true },
  { herken:/politie/,
    antwoord:"Ik stuur ook de politie ter ondersteuning. De politie heeft vaak een AED bij zich.", altijd:true },
  { herken:/brandweer/,
    antwoord:"De brandweer komt ook, die kan helpen met reanimeren.", altijd:true },
  { herken:/met z.?n (twee|drie)|met ons (twee|drie)|tweede|collega|nog iemand|iemand bij (me|mij|ons)|iemand helpt|er is hulp|bhv.?er (is|komt)|nog een bhv|alleen|terug|niemand/, soort:'helpers', altijd:true },
  { herken:/kan (niet|geen) beadem|wil niet beadem|niet beademen|zonder beadem/,
    antwoord:"Dat is goed. Blijf zonder onderbreking borstcompressies geven. Ik blijf aan de lijn.", altijd:true },
  { herken:/borst.{0,20}(niet omhoog|komt niet|gaat niet)/,
    antwoord:"Kantel het hoofd iets verder achterover en til de kin op. Probeer het nog één keer en ga dan direct verder met drukken.", altijd:true },
  { herken:/(weet niet hoe|hoe moet ik) .{0,10}beadem|beadem.{0,20}(hoe|uitleg)/,
    antwoord:"Kantel het hoofd achterover en til de kin op. Na dertig keer drukken geeft u twee rustige beademingen, tot u de borstkas ziet omhoogkomen. Ga dan direct verder met drukken.", altijd:true },
  { herken:/beadem|mond op mond|blazen|lucht in|30.?2|dertig.{0,6}twee|pocket ?mask|masker/,
    antwoord:"Ga daarmee door: dertig keer drukken en twee keer beademen, met zo kort mogelijke pauzes. Lukt beademen niet, dan alleen drukken.", altijd:true },
  { herken:/tel kwijt|kwijt met tellen|weet niet meer hoeveel/,
    antwoord:"Dat geeft niet. Blijf stevig en snel drukken, ongeveer twee keer per seconde.", altijd:true },
  { herken:/doe ik het goed|klopt het|is dit goed/,
    antwoord:"Blijf in een stevig ritme drukken, ongeveer twee keer per seconde. Laat de borstkas na elke keer helemaal terugveren." },
  { herken:/waar (moet ik )?drukken|welke plek|hoe (moet|doe) ik/,
    antwoord:"Midden op de borstkas, handen op elkaar, armen gestrekt. Vijf tot zes centimeter diep, ongeveer twee keer per seconde." },
  { herken:/breken|kapot|pijn doen/,
    antwoord:"Ik begrijp dat het spannend is. De persoon reageert niet en ademt niet normaal. Blijf op de borstkas drukken, ik begeleid u.", altijd:true },
  { herken:/mag ik stoppen|moet ik stoppen|kan ik stoppen|stoppen\?/,
    antwoord:"Nee, ga door tot de AED zegt dat u moet stoppen of tot de ambulance het overneemt.", altijd:true },
  { herken:/overgeven|braakt|spuugt|kotst|braaksel/,
    antwoord:"Draai het hoofd even opzij en maak de mond schoon. Is {hij} duidelijk bij bewustzijn en ademt {hij} normaal? Zo niet, ga direct weer verder.", altijd:true },
  { herken:/opvangen|wijzen|ingang|slagboom|receptie|lift|omstanders|mensen om|toeschouwers/,
    metHulp:"Goed. Laat iemand bij de ingang staan om de ambulance de weg te wijzen.",
    alleen:"U blijft bij de persoon. Ik geef de ingang door aan de ambulance.", altijd:true },
  { herken:/hoort u mij|hoor je mij|bent u (er )?nog|ben je er nog|hallo/,
    antwoord:"Ja, ik hoor u. Ik blijf aan de lijn.", altijd:true },
  { herken:/bloed/,
    antwoord:"Ga door met reanimeren, dat is nu het belangrijkste. De ambulance kijkt daar straks naar." },
  { herken:/pacemaker|bultje/,
    antwoord:"De AED kan gewoon gebruikt worden. Plak de elektrode niet op het zichtbare apparaat, maar er iets naast, en volg de AED.", altijd:true },
  { herken:/zwanger/,
    antwoord:"Ga gewoon door met reanimeren. Ik geef het door aan de ambulance.", altijd:true },
  { herken:/\bnat\b|regen|water|plas/,
    antwoord:"Droog de plekken voor de elektroden snel af, zodat ze goed contact maken. Plak ze en volg de AED.", altijd:true },
  { herken:/borsthaar|behaard|haren/,
    antwoord:"Scheer of trek het haar weg waar de elektroden komen, als er een scheermesje bij de AED zit. Anders stevig aandrukken.", altijd:true },
  { herken:/sieraden|ketting|piercing|\bbh\b|beugel/,
    antwoord:"Zorg dat de elektroden niet op metaal komen. Schuif het opzij en plak op de blote huid.", altijd:true },
  { herken:/baby|kind|kindje|peuter/,
    antwoord:"Dit oefenscenario is voor een volwassene. Voor kinderen en baby's gelden andere instructies; die oefent u apart.", altijd:true },
  { herken:/bedankt|dank je|dank u/,
    antwoord:"Graag gedaan. Ik blijf aan de lijn.", altijd:true },
  { herken:/overne|wissel|afloss|neemt het|nemen het/,
    metHulp:"Goed. Wissel snel en ga meteen door, zonder pauze.",
    alleen:"Is er iemand bij u gekomen? Laat die het drukken dan overnemen, zonder pauze.", altijd:true },
  { herken:/moe|kan niet meer|zwaar|uitgeput/,
    metHulp:"Laat de ander het drukken overnemen, snel en zonder pauze.",
    alleen:"Ik hoor dat het zwaar is. Blijf doen wat u kunt. Zodra iemand bij u komt, laat die het drukken overnemen. Ik blijf aan de lijn.", altijd:true },
  { herken:/hoe lang|wanneer|ambulance|komt er/,
    antwoord:"De ambulances zijn onderweg. Ga door tot de hulpverleners het van u overnemen.", altijd:true },
  { herken:/hoe diep|hoe hard|hoe snel/,
    antwoord:"Vijf tot zes centimeter diep, ongeveer twee keer per seconde. Laat de borstkas steeds helemaal terugkomen." },
  { herken:/rib|kraak|knap/,
    antwoord:"Dat kan gebeuren. Ga gewoon door, dat is nu het belangrijkste.", altijd:true },
  { herken:/bang|eng|spannend|help/,
    antwoord:"Ik blijf aan de lijn. We doen dit stap voor stap.", altijd:true }
];
