/* =====================================================================
   INSTELLINGEN
   Pas hier locaties, aanrijtijden en de variatie per oefening aan.
   Let op: laat komma's, aanhalingstekens en haakjes staan.
   ===================================================================== */

/* ---------------- LOCATIES ----------------
   Hier kun je adressen toevoegen of aanpassen.
   naam:      wat de student in de lijst ziet
   adres:     het volledige adres (staat op het toetsenscherm)
   herken:    woorden waarop de meldkamer het adres goedkeurt (kleine letters)
   bevestig:  wat de meldkamer terugzegt als het adres goed is
   Laat 'naam' leeg ('') voor een plek die nog niet in gebruik is.
   ambulanceNa: na hoeveel minuten:seconden de ambulance aankomt, bijv. '6:00'
   kort:true:   kort scenario met weinig vragen en korte instructies */
const SCENARIOS = [
  { naam:'De Haagse Hogeschool, kort', adres:'Johanna Westerdijkplein 75, Den Haag', kort:true,   // kort: weinig vragen, korte instructies
    herken:['haagse hogeschool','haagse school','haagse hoge school','hogeschool','westerdijk','westdijk','wester dijk','westerdijkplein'],
    bevestig:'Haagse Hogeschool, begrepen.',
    // soms leest de meldkamer het adres ter controle voor, en soms bewust met een fout
    controleGoed:'Johanna Westerdijkplein 75 in Den Haag, klopt dat?',
    controleFout:'Zei u de Westerdijkstraat in Den Haag?',
    ambulanceNa:'3:15' },   // ambulance na 3:15 (vanaf het opnemen)
  { naam:'De Haagse Hogeschool, lang', adres:'Johanna Westerdijkplein 75, Den Haag',
    herken:['haagse hogeschool','haagse school','haagse hoge school','hogeschool','westerdijk','westdijk','wester dijk','westerdijkplein'],
    bevestig:'De Haagse Hogeschool aan het Johanna Westerdijkplein in Den Haag, begrepen.',
    // soms leest de meldkamer het adres ter controle voor, en soms bewust met een fout
    controleGoed:'Johanna Westerdijkplein 75 in Den Haag, klopt dat?',
    controleFout:'Zei u de Westerdijkstraat in Den Haag?',
    ambulanceNa:'6:00' },   // ambulance na 6:00
  { naam:'', adres:'', herken:[], bevestig:'', controleGoed:'', controleFout:'' },
  { naam:'', adres:'', herken:[], bevestig:'', controleGoed:'', controleFout:'' },
  { naam:'', adres:'', herken:[], bevestig:'', controleGoed:'', controleFout:'' },
  { naam:'', adres:'', herken:[], bevestig:'', controleGoed:'', controleFout:'' }
];
const AMBULANCE_NA_MINUTEN = 8;   // standaard aanrijtijd als een locatie geen eigen 'ambulanceNa' heeft
const VRAAG_WAT_NA_SECONDEN = 80; // wanneer de meldkamer vraagt wat er gebeurd is (tijdens het reanimeren)

/* ---------------- VARIATIE PER OEFENING (alleen lang scenario) ----------------
   Een kans van 0.25 betekent: gemiddeld 1 op de 4 oefeningen. 0 = nooit, 1 = altijd. */
const KANS_GEEN_AED       = 0.25; // er is geen AED in de buurt beschikbaar
const KANS_ADRESCONTROLE  = 0.5;  // de meldkamer leest het adres ter controle voor
const KANS_FOUT_ADRES     = 0.5;  // ... en doet dat dan bewust fout (student moet verbeteren)
const KANS_LEEFTIJD       = 0.5;  // de meldkamer vraagt de leeftijd

const MAX_MINUTEN = 12;           // veiligheidsgrens: na zoveel minuten reanimeren stopt de oefening vanzelf

/* ---------------- UITSPRAAK ---------------- */
// hoe de stem woorden moet uitspreken: 112 als losse cijfers, AED als losse letters (aa-ee-dee)
// Elke stem spreekt afkortingen anders uit; kies op het eerste scherm wat het natuurlijkst klinkt.
const AED_VARIANTEN=['A E D','A.E.D.','A-E-D','aa ee dee','aeedee'];
const AED_STANDAARD='A.E.D.';   // zo spreekt de meldkamer 'AED' uit, tenzij je op het eerste scherm iets anders kiest
