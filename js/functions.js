/* =========================================================================
   Formula Builder — function catalog
   Each entry:
     id   : Excel (English) name
     gs   : Google Sheets name with Italian locale (verified on Google's
            Italian function list + Italian help pages). When the two Google
            sources disagree the English name is kept (Sheets always accepts
            English names) and `gsf` is set to true.
     cat  : category id
     t    : [it, en] friendly title
     d    : [it, en] description
     a    : fixed arguments          r : repeating group {a:[...], min}
     tl   : arguments after the repeating group
     ex   : example (written in Excel syntax, converted live for Sheets)
     exd  : [it, en] what the example does
     tip  : [it, en] optional tip
   Argument: { n:[it,en], d:[it,en], opt, ch:[options], def, kind:'name' }
   ========================================================================= */
(function () {
  'use strict';

  const YESNO_EXACT = [
    { l: ['Corrispondenza esatta', 'Exact match'], v: 'FALSE' },
    { l: ['Corrispondenza approssimativa', 'Approximate match'], v: 'TRUE' }
  ];

  const CATEGORIES = [
    { id: 'basic',  n: ['Elementi base', 'Basics'],              color: '#64748b', icon: '◆' },
    { id: 'logic',  n: ['Logica', 'Logic'],                      color: '#8b5cf6', icon: '?' },
    { id: 'math',   n: ['Matematica', 'Math'],                   color: '#2563eb', icon: '∑' },
    { id: 'stats',  n: ['Statistica e conteggi', 'Statistics'],  color: '#0d9488', icon: '#' },
    { id: 'text',   n: ['Testo', 'Text'],                        color: '#ea580c', icon: 'Aa' },
    { id: 'lookup', n: ['Ricerca', 'Lookup'],                    color: '#16a34a', icon: '⌕' },
    { id: 'date',   n: ['Date e ore', 'Date & time'],            color: '#db2777', icon: '◷' },
    { id: 'info',   n: ['Controlli', 'Checks'],                  color: '#475569', icon: 'i' },
    { id: 'array',  n: ['Elenchi e avanzate', 'Arrays & advanced'], color: '#4f46e5', icon: '⧉' }
  ];

  const A = (it, en, dit, den, extra) => Object.assign({ n: [it, en], d: [dit, den] }, extra || {});

  const F = [
    /* ------------------------------ LOGIC ------------------------------ */
    { id: 'IF', gs: 'SE', cat: 'logic',
      t: ['Se… allora… altrimenti', 'If… then… else'],
      d: ['Controlla una condizione: se è vera restituisce un valore, se è falsa ne restituisce un altro.',
          'Checks a condition: returns one value if it is true and another if it is false.'],
      a: [A('condizione', 'condition', 'La domanda da verificare, ad esempio A1>10.', 'The question to test, e.g. A1>10.'),
          A('se vero', 'if true', 'Cosa restituire quando la condizione è vera.', 'What to return when the condition is true.'),
          A('se falso', 'if false', 'Cosa restituire quando la condizione è falsa. Se lo lasci vuoto restituisce FALSO.', 'What to return when the condition is false. If empty it returns FALSE.', { opt: true })],
      ex: 'IF(A1>=18,"Adult","Minor")',
      exd: ['Se in A1 c\'è un numero maggiore o uguale a 18 scrive "Adult", altrimenti "Minor".', 'If A1 is 18 or more it shows "Adult", otherwise "Minor".'],
      tip: ['Per più di due casi usa IFS oppure collega un altro SE dentro "se falso".', 'For more than two cases use IFS, or plug another IF into "if false".'] },

    { id: 'IFS', gs: 'IFS', cat: 'logic',
      t: ['Più condizioni in fila', 'Several conditions in a row'],
      d: ['Controlla le condizioni una dopo l\'altra e restituisce il valore della prima che risulta vera.',
          'Checks the conditions one after another and returns the value of the first one that is true.'],
      r: { min: 1, a: [A('condizione', 'condition', 'Una condizione da verificare.', 'A condition to test.'),
                       A('valore', 'value', 'Il risultato se questa condizione è la prima vera.', 'The result if this is the first true condition.')] },
      ex: 'IFS(A1>=90,"A",A1>=70,"B",TRUE,"C")',
      exd: ['Restituisce "A" sopra 90, "B" sopra 70, altrimenti "C" (l\'ultima condizione VERO fa da "in tutti gli altri casi").', 'Returns "A" from 90, "B" from 70, otherwise "C" (the last TRUE condition works as "in every other case").'],
      tip: ['Metti come ultima condizione VERO per avere un valore di riserva.', 'Use TRUE as the last condition to get a fallback value.'] },

    { id: 'SWITCH', gs: 'SWITCH', cat: 'logic',
      t: ['Scegli in base al valore', 'Pick by matching value'],
      d: ['Confronta un valore con un elenco di casi e restituisce il risultato del caso uguale.',
          'Compares a value with a list of cases and returns the result of the matching case.'],
      a: [A('valore da confrontare', 'value to compare', 'Il valore da controllare, ad esempio una cella.', 'The value to check, for example a cell.')],
      r: { min: 1, a: [A('caso', 'case', 'Un possibile valore.', 'A possible value.'),
                       A('risultato', 'result', 'Cosa restituire se il valore è uguale a questo caso.', 'What to return if the value equals this case.')] },
      tl: [A('predefinito', 'default', 'Cosa restituire se nessun caso corrisponde.', 'What to return when no case matches.', { opt: true })],
      ex: 'SWITCH(A1,1,"Monday",2,"Tuesday","Other")',
      exd: ['Se A1 vale 1 scrive "Monday", se vale 2 "Tuesday", altrimenti "Other".', 'If A1 is 1 it shows "Monday", if 2 "Tuesday", otherwise "Other".'] },

    { id: 'AND', gs: 'E', cat: 'logic',
      t: ['Tutte vere?', 'Are all true?'],
      d: ['Restituisce VERO solo se tutte le condizioni sono vere.', 'Returns TRUE only if every condition is true.'],
      r: { min: 2, a: [A('condizione', 'condition', 'Una condizione da verificare.', 'A condition to test.')] },
      ex: 'AND(A1>0,A1<100)',
      exd: ['VERO se A1 è compreso tra 0 e 100 (esclusi).', 'TRUE if A1 is between 0 and 100 (exclusive).'],
      tip: ['Si usa spesso come condizione dentro un SE.', 'It is often used as the condition of an IF.'] },

    { id: 'OR', gs: 'O', cat: 'logic',
      t: ['Almeno una vera?', 'Is any true?'],
      d: ['Restituisce VERO se almeno una delle condizioni è vera.', 'Returns TRUE if at least one condition is true.'],
      r: { min: 2, a: [A('condizione', 'condition', 'Una condizione da verificare.', 'A condition to test.')] },
      ex: 'OR(A1="Saturday",A1="Sunday")',
      exd: ['VERO se in A1 c\'è "Saturday" oppure "Sunday".', 'TRUE if A1 contains "Saturday" or "Sunday".'] },

    { id: 'NOT', gs: 'NON', cat: 'logic',
      t: ['Il contrario', 'The opposite'],
      d: ['Inverte il risultato: VERO diventa FALSO e FALSO diventa VERO.', 'Flips the result: TRUE becomes FALSE and FALSE becomes TRUE.'],
      a: [A('condizione', 'condition', 'La condizione da invertire.', 'The condition to flip.')],
      ex: 'NOT(ISBLANK(A1))',
      exd: ['VERO se A1 NON è vuota.', 'TRUE if A1 is NOT empty.'] },

    { id: 'XOR', gs: 'XOR', cat: 'logic',
      t: ['Solo una delle due', 'Exactly one of them'],
      d: ['Restituisce VERO se un numero dispari di condizioni è vero (con due condizioni: solo una delle due).', 'Returns TRUE when an odd number of conditions are true (with two: exactly one of them).'],
      r: { min: 2, a: [A('condizione', 'condition', 'Una condizione da verificare.', 'A condition to test.')] },
      ex: 'XOR(A1>10,B1>10)',
      exd: ['VERO se solo una tra A1 e B1 supera 10.', 'TRUE if only one of A1 and B1 is above 10.'] },

    { id: 'IFERROR', gs: 'SE.ERRORE', cat: 'logic',
      t: ['Se c\'è un errore…', 'If there is an error…'],
      d: ['Restituisce il valore normale, ma se questo produce un errore (#N/D, #DIV/0! ecc.) restituisce l\'alternativa.', 'Returns the value, but if it produces an error (#N/A, #DIV/0! etc.) it returns the alternative.'],
      a: [A('valore', 'value', 'Il calcolo che potrebbe dare errore.', 'The calculation that might fail.'),
          A('se errore', 'if error', 'Cosa mostrare al posto dell\'errore.', 'What to show instead of the error.')],
      ex: 'IFERROR(A1/B1,0)',
      exd: ['Divide A1 per B1; se B1 è zero mostra 0 invece di #DIV/0!.', 'Divides A1 by B1; if B1 is zero it shows 0 instead of #DIV/0!.'] },

    { id: 'IFNA', gs: 'SE.NON.DISP.', cat: 'logic',
      t: ['Se non trovato…', 'If not found…'],
      d: ['Come SE.ERRORE ma intercetta solo l\'errore #N/D, tipico delle ricerche che non trovano nulla.', 'Like IFERROR but only catches #N/A, the typical "not found" error of lookups.'],
      a: [A('valore', 'value', 'Il calcolo, di solito una ricerca.', 'The calculation, usually a lookup.'),
          A('se non trovato', 'if not found', 'Cosa mostrare al posto di #N/D.', 'What to show instead of #N/A.')],
      ex: 'IFNA(VLOOKUP(A1,D:E,2,FALSE),"Not found")',
      exd: ['Cerca A1 nella colonna D; se non esiste scrive "Not found".', 'Looks up A1 in column D; if missing shows "Not found".'] },

    /* ------------------------------ MATH ------------------------------- */
    { id: 'SUM', gs: 'SOMMA', cat: 'math',
      t: ['Somma', 'Add up'],
      d: ['Somma tutti i numeri indicati: celle, intervalli o valori.', 'Adds up all the given numbers: cells, ranges or values.'],
      r: { min: 1, a: [A('numero', 'number', 'Un numero, una cella o un intervallo come A1:A10.', 'A number, a cell or a range like A1:A10.')] },
      ex: 'SUM(A1:A10)', exd: ['Somma i valori da A1 ad A10.', 'Adds the values from A1 to A10.'] },

    { id: 'SUMIF', gs: 'SOMMA.SE', cat: 'math',
      t: ['Somma con una condizione', 'Sum with one condition'],
      d: ['Somma solo le celle che rispettano un criterio.', 'Adds only the cells that match a criterion.'],
      a: [A('intervallo da controllare', 'range to check', 'Le celle su cui verificare il criterio.', 'The cells where the criterion is checked.'),
          A('criterio', 'criterion', 'La condizione, ad esempio ">100" oppure "Roma".', 'The condition, e.g. ">100" or "Rome".'),
          A('intervallo da sommare', 'range to sum', 'Le celle da sommare. Se vuoto somma il primo intervallo.', 'The cells to add. If empty, the first range is added.', { opt: true })],
      ex: 'SUMIF(A2:A20,"Rome",B2:B20)',
      exd: ['Somma i valori di B dove in A c\'è "Rome".', 'Adds the B values where A contains "Rome".'],
      tip: ['Il criterio va tra virgolette se contiene simboli, es. ">100". Per unirlo a una cella usa ">"&A1.', 'Quote the criterion when it has symbols, e.g. ">100". To use a cell write ">"&A1.'] },

    { id: 'SUMIFS', gs: 'SOMMA.PIÙ.SE', cat: 'math',
      t: ['Somma con più condizioni', 'Sum with several conditions'],
      d: ['Somma le celle che rispettano tutti i criteri indicati.', 'Adds the cells that match all the given criteria.'],
      a: [A('intervallo da sommare', 'range to sum', 'Le celle con i numeri da sommare.', 'The cells with the numbers to add.')],
      r: { min: 1, a: [A('intervallo criterio', 'criteria range', 'Le celle da controllare.', 'The cells to check.'),
                       A('criterio', 'criterion', 'La condizione per quell\'intervallo.', 'The condition for that range.')] },
      ex: 'SUMIFS(C2:C20,A2:A20,"Rome",B2:B20,">100")',
      exd: ['Somma C dove A è "Rome" e B è maggiore di 100.', 'Adds C where A is "Rome" and B is above 100.'],
      tip: ['Attenzione: qui l\'intervallo da sommare è il PRIMO argomento, al contrario di SOMMA.SE.', 'Careful: here the range to sum comes FIRST, unlike SUMIF.'] },

    { id: 'PRODUCT', gs: 'PRODOTTO', cat: 'math',
      t: ['Moltiplica tutto', 'Multiply all'],
      d: ['Moltiplica tra loro tutti i numeri indicati.', 'Multiplies all the given numbers together.'],
      r: { min: 1, a: [A('numero', 'number', 'Un numero, una cella o un intervallo.', 'A number, a cell or a range.')] },
      ex: 'PRODUCT(A1,B1,2)', exd: ['Calcola A1 × B1 × 2.', 'Calculates A1 × B1 × 2.'] },

    { id: 'ROUND', gs: 'ARROTONDA', cat: 'math',
      t: ['Arrotonda', 'Round'],
      d: ['Arrotonda un numero al numero di decimali scelto (regola classica: da 5 in su per eccesso).', 'Rounds a number to the chosen number of decimals (classic rule: 5 and up rounds up).'],
      a: [A('numero', 'number', 'Il numero da arrotondare.', 'The number to round.'),
          A('decimali', 'decimals', 'Quante cifre decimali tenere. 0 = numero intero.', 'How many decimals to keep. 0 = whole number.')],
      ex: 'ROUND(A1,2)', exd: ['Arrotonda A1 a due decimali.', 'Rounds A1 to two decimals.'] },

    { id: 'ROUNDUP', gs: 'ARROTONDA.PER.ECC', cat: 'math',
      t: ['Arrotonda per eccesso', 'Round up'],
      d: ['Arrotonda sempre verso l\'alto (lontano dallo zero).', 'Always rounds up (away from zero).'],
      a: [A('numero', 'number', 'Il numero da arrotondare.', 'The number to round.'),
          A('decimali', 'decimals', 'Quante cifre decimali tenere.', 'How many decimals to keep.')],
      ex: 'ROUNDUP(A1,0)', exd: ['Porta A1 al numero intero superiore.', 'Rounds A1 up to the next whole number.'] },

    { id: 'ROUNDDOWN', gs: 'ARROTONDA.PER.DIF', cat: 'math',
      t: ['Arrotonda per difetto', 'Round down'],
      d: ['Arrotonda sempre verso il basso (verso lo zero).', 'Always rounds down (toward zero).'],
      a: [A('numero', 'number', 'Il numero da arrotondare.', 'The number to round.'),
          A('decimali', 'decimals', 'Quante cifre decimali tenere.', 'How many decimals to keep.')],
      ex: 'ROUNDDOWN(A1,1)', exd: ['Taglia A1 a un decimale.', 'Cuts A1 to one decimal.'] },

    { id: 'INT', gs: 'INT', cat: 'math',
      t: ['Parte intera', 'Whole part'],
      d: ['Arrotonda per difetto all\'intero più vicino (con i negativi va verso il basso: -2,5 diventa -3).', 'Rounds down to the nearest integer (negatives go down: -2.5 becomes -3).'],
      a: [A('numero', 'number', 'Il numero.', 'The number.')],
      ex: 'INT(A1/100)', exd: ['Quante centinaia intere ci sono in A1.', 'How many whole hundreds are in A1.'] },

    { id: 'MOD', gs: 'MOD', gsf: true, cat: 'math',
      t: ['Resto della divisione', 'Remainder'],
      d: ['Restituisce il resto della divisione tra due numeri.', 'Returns the remainder of a division.'],
      a: [A('dividendo', 'number', 'Il numero da dividere.', 'The number to divide.'),
          A('divisore', 'divisor', 'Il numero per cui dividere.', 'The number to divide by.')],
      ex: 'MOD(A1,2)', exd: ['0 se A1 è pari, 1 se è dispari.', '0 if A1 is even, 1 if odd.'] },

    { id: 'ABS', gs: 'ASS', cat: 'math',
      t: ['Valore assoluto', 'Absolute value'],
      d: ['Toglie il segno meno: restituisce il numero sempre positivo.', 'Removes the minus sign: always returns a positive number.'],
      a: [A('numero', 'number', 'Il numero.', 'The number.')],
      ex: 'ABS(A1-B1)', exd: ['La differenza tra A1 e B1, sempre positiva.', 'The difference between A1 and B1, always positive.'] },

    { id: 'POWER', gs: 'POTENZA', cat: 'math',
      t: ['Elevamento a potenza', 'Power'],
      d: ['Eleva un numero a una potenza (come il simbolo ^).', 'Raises a number to a power (same as ^).'],
      a: [A('base', 'base', 'Il numero da elevare.', 'The number to raise.'),
          A('esponente', 'exponent', 'La potenza.', 'The power.')],
      ex: 'POWER(2,10)', exd: ['2 elevato alla 10 = 1024.', '2 to the 10th = 1024.'] },

    { id: 'SQRT', gs: 'RADQ', cat: 'math',
      t: ['Radice quadrata', 'Square root'],
      d: ['Restituisce la radice quadrata di un numero positivo.', 'Returns the square root of a positive number.'],
      a: [A('numero', 'number', 'Il numero (non negativo).', 'The number (not negative).')],
      ex: 'SQRT(A1)', exd: ['La radice quadrata di A1.', 'The square root of A1.'] },

    { id: 'RAND', gs: 'CASUALE', cat: 'math',
      t: ['Numero casuale 0–1', 'Random 0–1'],
      d: ['Restituisce un numero casuale tra 0 e 1. Cambia a ogni ricalcolo.', 'Returns a random number between 0 and 1. It changes at every recalculation.'],
      a: [], ex: 'RAND()*100', exd: ['Un numero casuale tra 0 e 100.', 'A random number between 0 and 100.'] },

    { id: 'RANDBETWEEN', gs: 'CASUALE.TRA', cat: 'math',
      t: ['Intero casuale tra due valori', 'Random whole number'],
      d: ['Restituisce un numero intero casuale tra un minimo e un massimo (inclusi).', 'Returns a random whole number between a minimum and a maximum (included).'],
      a: [A('minimo', 'bottom', 'Il valore più basso possibile.', 'The lowest possible value.'),
          A('massimo', 'top', 'Il valore più alto possibile.', 'The highest possible value.')],
      ex: 'RANDBETWEEN(1,6)', exd: ['Simula il lancio di un dado.', 'Simulates a dice roll.'] },

    { id: 'SEQUENCE', gs: 'SEQUENCE', cat: 'math',
      t: ['Elenco di numeri in sequenza', 'Number sequence'],
      d: ['Crea un elenco di numeri consecutivi che si espande nelle celle sotto (e a destra).', 'Creates a list of consecutive numbers that spills into the cells below (and to the right).'],
      a: [A('righe', 'rows', 'Quante righe.', 'How many rows.'),
          A('colonne', 'columns', 'Quante colonne (predefinito 1).', 'How many columns (default 1).', { opt: true }),
          A('inizio', 'start', 'Da che numero partire (predefinito 1).', 'Starting number (default 1).', { opt: true }),
          A('passo', 'step', 'Di quanto aumentare ogni volta (predefinito 1).', 'How much to add each time (default 1).', { opt: true })],
      ex: 'SEQUENCE(10)', exd: ['I numeri da 1 a 10 in colonna.', 'The numbers 1 to 10 in a column.'],
      tip: ['Le celle sotto devono essere vuote, altrimenti compare un errore di espansione.', 'The cells below must be empty, otherwise you get a spill error.'] },

    /* ---------------------------- STATISTICS --------------------------- */
    { id: 'AVERAGE', gs: 'MEDIA', cat: 'stats',
      t: ['Media', 'Average'],
      d: ['Calcola la media aritmetica dei numeri (ignora celle vuote e testo).', 'Calculates the arithmetic mean (ignores empty cells and text).'],
      r: { min: 1, a: [A('numero', 'number', 'Un numero, una cella o un intervallo.', 'A number, a cell or a range.')] },
      ex: 'AVERAGE(B2:B30)', exd: ['La media dei valori da B2 a B30.', 'The average of B2 to B30.'] },

    { id: 'AVERAGEIF', gs: 'MEDIA.SE', cat: 'stats',
      t: ['Media con una condizione', 'Average with one condition'],
      d: ['Calcola la media solo delle celle che rispettano un criterio.', 'Averages only the cells that match a criterion.'],
      a: [A('intervallo da controllare', 'range to check', 'Le celle su cui verificare il criterio.', 'The cells where the criterion is checked.'),
          A('criterio', 'criterion', 'La condizione, es. ">0".', 'The condition, e.g. ">0".'),
          A('intervallo media', 'average range', 'Le celle di cui fare la media. Se vuoto usa il primo intervallo.', 'The cells to average. If empty the first range is used.', { opt: true })],
      ex: 'AVERAGEIF(A2:A20,"Rome",B2:B20)', exd: ['Media di B dove A è "Rome".', 'Average of B where A is "Rome".'] },

    { id: 'AVERAGEIFS', gs: 'MEDIA.PIÙ.SE', cat: 'stats',
      t: ['Media con più condizioni', 'Average with several conditions'],
      d: ['Calcola la media delle celle che rispettano tutti i criteri.', 'Averages the cells that match all criteria.'],
      a: [A('intervallo media', 'average range', 'Le celle con i numeri.', 'The cells with the numbers.')],
      r: { min: 1, a: [A('intervallo criterio', 'criteria range', 'Le celle da controllare.', 'The cells to check.'),
                       A('criterio', 'criterion', 'La condizione.', 'The condition.')] },
      ex: 'AVERAGEIFS(C2:C20,A2:A20,"Rome",B2:B20,"2026")', exd: ['Media di C per Rome nel 2026.', 'Average of C for Rome in 2026.'] },

    { id: 'COUNT', gs: 'CONTA.NUMERI', cat: 'stats',
      t: ['Conta i numeri', 'Count numbers'],
      d: ['Conta quante celle contengono un numero.', 'Counts how many cells contain a number.'],
      r: { min: 1, a: [A('valore', 'value', 'Una cella o un intervallo.', 'A cell or a range.')] },
      ex: 'COUNT(A1:A100)', exd: ['Quanti numeri ci sono tra A1 e A100.', 'How many numbers are in A1:A100.'] },

    { id: 'COUNTA', gs: 'CONTA.VALORI', cat: 'stats',
      t: ['Conta le celle piene', 'Count non-empty'],
      d: ['Conta quante celle non sono vuote (numeri, testo, qualsiasi cosa).', 'Counts how many cells are not empty (numbers, text, anything).'],
      r: { min: 1, a: [A('valore', 'value', 'Una cella o un intervallo.', 'A cell or a range.')] },
      ex: 'COUNTA(A:A)', exd: ['Quante celle piene ci sono nella colonna A.', 'How many filled cells are in column A.'] },

    { id: 'COUNTBLANK', gs: 'CONTA.VUOTE', cat: 'stats',
      t: ['Conta le celle vuote', 'Count empty'],
      d: ['Conta quante celle di un intervallo sono vuote.', 'Counts how many cells in a range are empty.'],
      a: [A('intervallo', 'range', 'Le celle da controllare.', 'The cells to check.')],
      ex: 'COUNTBLANK(B2:B50)', exd: ['Quante celle vuote ci sono in B2:B50.', 'How many empty cells are in B2:B50.'] },

    { id: 'COUNTIF', gs: 'CONTA.SE', cat: 'stats',
      t: ['Conta con una condizione', 'Count with one condition'],
      d: ['Conta le celle che rispettano un criterio.', 'Counts the cells that match a criterion.'],
      a: [A('intervallo', 'range', 'Le celle da controllare.', 'The cells to check.'),
          A('criterio', 'criterion', 'La condizione, es. "Sì" oppure ">=18".', 'The condition, e.g. "Yes" or ">=18".')],
      ex: 'COUNTIF(B2:B50,">=18")', exd: ['Quante persone hanno 18 anni o più.', 'How many people are 18 or older.'] },

    { id: 'COUNTIFS', gs: 'CONTA.PIÙ.SE', cat: 'stats',
      t: ['Conta con più condizioni', 'Count with several conditions'],
      d: ['Conta le righe che rispettano tutti i criteri.', 'Counts the rows that match all criteria.'],
      r: { min: 1, a: [A('intervallo criterio', 'criteria range', 'Le celle da controllare.', 'The cells to check.'),
                       A('criterio', 'criterion', 'La condizione.', 'The condition.')] },
      ex: 'COUNTIFS(A2:A50,"Rome",B2:B50,">=18")', exd: ['Quante persone di Rome hanno almeno 18 anni.', 'How many people from Rome are at least 18.'] },

    { id: 'MAX', gs: 'MAX', cat: 'stats',
      t: ['Valore più alto', 'Largest value'],
      d: ['Restituisce il numero più grande.', 'Returns the largest number.'],
      r: { min: 1, a: [A('numero', 'number', 'Un numero, una cella o un intervallo.', 'A number, a cell or a range.')] },
      ex: 'MAX(B2:B30)', exd: ['Il valore massimo in B2:B30.', 'The highest value in B2:B30.'],
      tip: ['MAX(0;A1) è un trucco per non andare mai sotto zero.', 'MAX(0,A1) is a trick to never go below zero.'] },

    { id: 'MIN', gs: 'MIN', cat: 'stats',
      t: ['Valore più basso', 'Smallest value'],
      d: ['Restituisce il numero più piccolo.', 'Returns the smallest number.'],
      r: { min: 1, a: [A('numero', 'number', 'Un numero, una cella o un intervallo.', 'A number, a cell or a range.')] },
      ex: 'MIN(B2:B30)', exd: ['Il valore minimo in B2:B30.', 'The lowest value in B2:B30.'] },

    { id: 'MEDIAN', gs: 'MEDIANA', cat: 'stats',
      t: ['Valore centrale', 'Median'],
      d: ['Restituisce il valore che sta in mezzo quando i numeri sono in ordine.', 'Returns the middle value when the numbers are sorted.'],
      r: { min: 1, a: [A('numero', 'number', 'Un numero, una cella o un intervallo.', 'A number, a cell or a range.')] },
      ex: 'MEDIAN(B2:B30)', exd: ['La mediana di B2:B30.', 'The median of B2:B30.'] },

    { id: 'LARGE', gs: 'GRANDE', cat: 'stats',
      t: ['Il k-esimo più grande', 'k-th largest'],
      d: ['Restituisce il primo, secondo, terzo… valore più grande.', 'Returns the 1st, 2nd, 3rd… largest value.'],
      a: [A('intervallo', 'array', 'Le celle con i numeri.', 'The cells with the numbers.'),
          A('posizione', 'k', '1 = il più grande, 2 = il secondo più grande…', '1 = largest, 2 = second largest…')],
      ex: 'LARGE(B2:B30,2)', exd: ['Il secondo valore più alto.', 'The second highest value.'] },

    { id: 'SMALL', gs: 'PICCOLO', cat: 'stats',
      t: ['Il k-esimo più piccolo', 'k-th smallest'],
      d: ['Restituisce il primo, secondo, terzo… valore più piccolo.', 'Returns the 1st, 2nd, 3rd… smallest value.'],
      a: [A('intervallo', 'array', 'Le celle con i numeri.', 'The cells with the numbers.'),
          A('posizione', 'k', '1 = il più piccolo, 2 = il secondo più piccolo…', '1 = smallest, 2 = second smallest…')],
      ex: 'SMALL(B2:B30,1)', exd: ['Il valore più basso.', 'The lowest value.'] },

    /* ------------------------------- TEXT ------------------------------ */
    { id: 'CONCATENATE', gs: 'CONCATENA', cat: 'text',
      t: ['Unisci testi', 'Join texts'],
      d: ['Unisce più testi in uno solo, nell\'ordine indicato.', 'Joins several texts into one, in order.'],
      r: { min: 2, a: [A('testo', 'text', 'Un testo, una cella o un numero.', 'A text, a cell or a number.')] },
      ex: 'CONCATENATE(A1," ",B1)', exd: ['Nome e cognome separati da uno spazio.', 'First and last name separated by a space.'],
      tip: ['Lo stesso risultato si ottiene con il blocco "Unisci testo (&)".', 'You get the same result with the "Join text (&)" block.'] },

    { id: 'TEXTJOIN', gs: 'TEXTJOIN', cat: 'text',
      t: ['Unisci con separatore', 'Join with separator'],
      d: ['Unisce più testi mettendo tra uno e l\'altro un separatore, ad esempio ", ".', 'Joins texts with a separator between them, for example ", ".'],
      a: [A('separatore', 'delimiter', 'Cosa mettere tra i testi, es. ", ".', 'What to put between texts, e.g. ", ".'),
          A('salta vuote', 'ignore empty', 'Se ignorare le celle vuote.', 'Whether to skip empty cells.', { ch: [{ l: ['Sì, salta le vuote', 'Yes, skip empty'], v: 'TRUE' }, { l: ['No, includile', 'No, include them'], v: 'FALSE' }], def: 0 })],
      r: { min: 1, a: [A('testo', 'text', 'Un testo, una cella o un intervallo.', 'A text, a cell or a range.')] },
      ex: 'TEXTJOIN(", ",TRUE,A1:A5)', exd: ['I valori di A1:A5 separati da virgola.', 'The values of A1:A5 separated by commas.'] },

    { id: 'LEFT', gs: 'SINISTRA', cat: 'text',
      t: ['Primi caratteri', 'First characters'],
      d: ['Prende i primi caratteri a sinistra di un testo.', 'Takes the first characters from the left of a text.'],
      a: [A('testo', 'text', 'Il testo.', 'The text.'),
          A('quanti', 'how many', 'Quanti caratteri prendere (predefinito 1).', 'How many characters (default 1).', { opt: true })],
      ex: 'LEFT(A1,3)', exd: ['I primi 3 caratteri di A1.', 'The first 3 characters of A1.'] },

    { id: 'RIGHT', gs: 'DESTRA', cat: 'text',
      t: ['Ultimi caratteri', 'Last characters'],
      d: ['Prende gli ultimi caratteri a destra di un testo.', 'Takes the last characters from the right of a text.'],
      a: [A('testo', 'text', 'Il testo.', 'The text.'),
          A('quanti', 'how many', 'Quanti caratteri prendere (predefinito 1).', 'How many characters (default 1).', { opt: true })],
      ex: 'RIGHT(A1,4)', exd: ['Gli ultimi 4 caratteri di A1.', 'The last 4 characters of A1.'] },

    { id: 'MID', gs: 'STRINGA.ESTRAI', cat: 'text',
      t: ['Pezzo di testo', 'Part of a text'],
      d: ['Prende un pezzo di testo a partire da una posizione.', 'Takes a piece of text starting at a position.'],
      a: [A('testo', 'text', 'Il testo.', 'The text.'),
          A('da posizione', 'start', 'Da quale carattere iniziare (1 = il primo).', 'Which character to start from (1 = first).'),
          A('quanti', 'how many', 'Quanti caratteri prendere.', 'How many characters.')],
      ex: 'MID(A1,4,2)', exd: ['Due caratteri di A1 a partire dal quarto.', 'Two characters of A1 starting at the fourth.'] },

    { id: 'LEN', gs: 'LUNGHEZZA', cat: 'text',
      t: ['Lunghezza del testo', 'Text length'],
      d: ['Conta quanti caratteri ha un testo (spazi compresi).', 'Counts how many characters a text has (spaces included).'],
      a: [A('testo', 'text', 'Il testo.', 'The text.')],
      ex: 'LEN(A1)', exd: ['Il numero di caratteri in A1.', 'The number of characters in A1.'] },

    { id: 'UPPER', gs: 'MAIUSC', cat: 'text',
      t: ['Tutto maiuscolo', 'All caps'],
      d: ['Trasforma il testo in lettere maiuscole.', 'Turns the text into capital letters.'],
      a: [A('testo', 'text', 'Il testo.', 'The text.')], ex: 'UPPER(A1)', exd: ['A1 in maiuscolo.', 'A1 in capitals.'] },

    { id: 'LOWER', gs: 'MINUSC', cat: 'text',
      t: ['Tutto minuscolo', 'All lowercase'],
      d: ['Trasforma il testo in lettere minuscole.', 'Turns the text into lowercase letters.'],
      a: [A('testo', 'text', 'Il testo.', 'The text.')], ex: 'LOWER(A1)', exd: ['A1 in minuscolo.', 'A1 in lowercase.'] },

    { id: 'PROPER', gs: 'MAIUSC.INIZ', cat: 'text',
      t: ['Iniziali maiuscole', 'Capitalize words'],
      d: ['Mette la prima lettera di ogni parola in maiuscolo.', 'Capitalizes the first letter of every word.'],
      a: [A('testo', 'text', 'Il testo.', 'The text.')], ex: 'PROPER(A1)', exd: ['"mario rossi" diventa "Mario Rossi".', '"john smith" becomes "John Smith".'] },

    { id: 'TRIM', gs: 'ANNULLA.SPAZI', cat: 'text',
      t: ['Togli spazi in più', 'Remove extra spaces'],
      d: ['Elimina gli spazi all\'inizio, alla fine e quelli doppi in mezzo.', 'Removes spaces at the start, at the end and double spaces in between.'],
      a: [A('testo', 'text', 'Il testo.', 'The text.')], ex: 'TRIM(A1)', exd: ['A1 ripulito dagli spazi superflui.', 'A1 cleaned of extra spaces.'] },

    { id: 'SUBSTITUTE', gs: 'SOSTITUISCI', cat: 'text',
      t: ['Sostituisci parole', 'Replace words'],
      d: ['Sostituisce un testo con un altro ovunque compaia.', 'Replaces a text with another wherever it appears.'],
      a: [A('testo', 'text', 'Il testo di partenza.', 'The original text.'),
          A('da cercare', 'old text', 'Cosa sostituire.', 'What to replace.'),
          A('sostituisci con', 'new text', 'Con cosa sostituirlo.', 'What to put instead.'),
          A('quale ricorrenza', 'instance', 'Solo la n-esima volta (vuoto = tutte).', 'Only the n-th occurrence (empty = all).', { opt: true })],
      ex: 'SUBSTITUTE(A1,".",",")', exd: ['Sostituisce tutti i punti con virgole.', 'Replaces every dot with a comma.'] },

    { id: 'REPLACE', gs: 'RIMPIAZZA', cat: 'text',
      t: ['Sostituisci per posizione', 'Replace by position'],
      d: ['Sostituisce una parte di testo indicando posizione e lunghezza.', 'Replaces part of a text given its position and length.'],
      a: [A('testo', 'text', 'Il testo di partenza.', 'The original text.'),
          A('da posizione', 'start', 'Da quale carattere iniziare.', 'Which character to start from.'),
          A('quanti', 'how many', 'Quanti caratteri togliere.', 'How many characters to remove.'),
          A('nuovo testo', 'new text', 'Il testo da inserire.', 'The text to insert.')],
      ex: 'REPLACE(A1,1,3,"***")', exd: ['Copre i primi 3 caratteri con asterischi.', 'Covers the first 3 characters with asterisks.'] },

    { id: 'FIND', gs: 'TROVA', cat: 'text',
      t: ['Trova posizione (maiusc. esatte)', 'Find position (case-sensitive)'],
      d: ['Restituisce la posizione di un testo dentro un altro, distinguendo maiuscole e minuscole.', 'Returns the position of a text inside another, case-sensitive.'],
      a: [A('cosa cercare', 'find text', 'Il testo da trovare.', 'The text to find.'),
          A('dove cercare', 'within text', 'Il testo in cui cercare.', 'The text to search in.'),
          A('da posizione', 'start', 'Da quale carattere iniziare (predefinito 1).', 'Where to start (default 1).', { opt: true })],
      ex: 'FIND("@",A1)', exd: ['La posizione della chiocciola in un indirizzo email.', 'The position of the @ in an email address.'] },

    { id: 'SEARCH', gs: 'RICERCA', cat: 'text',
      t: ['Cerca posizione', 'Search position'],
      d: ['Come TROVA ma non distingue maiuscole e minuscole e accetta i caratteri jolly * e ?.', 'Like FIND but not case-sensitive and accepts the wildcards * and ?.'],
      a: [A('cosa cercare', 'find text', 'Il testo da trovare.', 'The text to find.'),
          A('dove cercare', 'within text', 'Il testo in cui cercare.', 'The text to search in.'),
          A('da posizione', 'start', 'Da quale carattere iniziare (predefinito 1).', 'Where to start (default 1).', { opt: true })],
      ex: 'ISNUMBER(SEARCH("rome",A1))', exd: ['VERO se A1 contiene "rome" in qualsiasi forma.', 'TRUE if A1 contains "rome" in any case.'] },

    { id: 'TEXT', gs: 'TESTO', cat: 'text',
      t: ['Formatta come testo', 'Format as text'],
      d: ['Trasforma un numero o una data in testo con il formato scelto.', 'Turns a number or date into text with the chosen format.'],
      a: [A('valore', 'value', 'Il numero o la data.', 'The number or date.'),
          A('formato', 'format', 'Il codice di formato, es. "0.00" o "dd/mm/yyyy".', 'The format code, e.g. "0.00" or "dd/mm/yyyy".')],
      ex: 'TEXT(A1,"dd/mm/yyyy")', exd: ['La data in A1 scritta come giorno/mese/anno.', 'The date in A1 written as day/month/year.'],
      tip: ['I codici di formato dipendono dalla lingua del foglio: in un foglio italiano la data si scrive "gg/mm/aaaa".', 'Format codes depend on the sheet language: an Italian sheet uses "gg/mm/aaaa" for dates.'] },

    { id: 'VALUE', gs: 'VALUE', gsf: true, cat: 'text',
      t: ['Testo in numero', 'Text to number'],
      d: ['Converte un testo che rappresenta un numero in un vero numero.', 'Converts a text that looks like a number into a real number.'],
      a: [A('testo', 'text', 'Il testo da convertire.', 'The text to convert.')],
      ex: 'VALUE(LEFT(A1,3))', exd: ['I primi 3 caratteri di A1 come numero.', 'The first 3 characters of A1 as a number.'] },

    { id: 'REPT', gs: 'RIPETI', cat: 'text',
      t: ['Ripeti testo', 'Repeat text'],
      d: ['Ripete un testo un certo numero di volte.', 'Repeats a text a number of times.'],
      a: [A('testo', 'text', 'Il testo da ripetere.', 'The text to repeat.'),
          A('volte', 'times', 'Quante volte.', 'How many times.')],
      ex: 'REPT("★",A1)', exd: ['Tante stelline quante ne indica A1.', 'As many stars as A1 says.'] },

    { id: 'CHAR', gs: 'CODICE.CARATT', cat: 'text',
      t: ['Carattere da codice', 'Character from code'],
      d: ['Restituisce il carattere corrispondente a un codice. CODICE.CARATT(10) è l\'a capo.', 'Returns the character for a code. CHAR(10) is a line break.'],
      a: [A('codice', 'number', 'Il codice del carattere.', 'The character code.')],
      ex: 'A1&CHAR(10)&B1', exd: ['A1 e B1 su due righe (attiva "Testo a capo").', 'A1 and B1 on two lines (turn on "Wrap text").'] },

    { id: 'EXACT', gs: 'IDENTICO', cat: 'text',
      t: ['Testi identici?', 'Exactly equal?'],
      d: ['VERO se i due testi sono identici, maiuscole comprese.', 'TRUE if the two texts are identical, including case.'],
      a: [A('testo 1', 'text 1', 'Il primo testo.', 'The first text.'),
          A('testo 2', 'text 2', 'Il secondo testo.', 'The second text.')],
      ex: 'EXACT(A1,B1)', exd: ['Confronta A1 e B1 in modo preciso.', 'Compares A1 and B1 exactly.'] },

    /* ------------------------------ LOOKUP ----------------------------- */
    { id: 'VLOOKUP', gs: 'CERCA.VERT', cat: 'lookup',
      t: ['Cerca in verticale', 'Vertical lookup'],
      d: ['Cerca un valore nella prima colonna di una tabella e restituisce il valore di un\'altra colonna della stessa riga.', 'Looks for a value in the first column of a table and returns a value from another column of the same row.'],
      a: [A('cosa cercare', 'lookup value', 'Il valore da trovare.', 'The value to find.'),
          A('tabella', 'table', 'La tabella, la prima colonna è quella in cui cerca.', 'The table; its first column is searched.'),
          A('numero colonna', 'column number', 'Quale colonna restituire (1 = la prima della tabella).', 'Which column to return (1 = first of the table).'),
          A('tipo di ricerca', 'match type', 'Quasi sempre "corrispondenza esatta".', 'Almost always "exact match".', { opt: true, ch: YESNO_EXACT, def: 0 })],
      ex: 'VLOOKUP(A2,Prices!A:C,3,FALSE)', exd: ['Cerca A2 nel foglio Prices e restituisce la terza colonna.', 'Looks up A2 in the Prices sheet and returns the third column.'],
      tip: ['Con "approssimativa" la prima colonna deve essere ordinata: in caso di dubbio scegli sempre "esatta".', 'With "approximate" the first column must be sorted: when in doubt choose "exact".'] },

    { id: 'HLOOKUP', gs: 'CERCA.ORIZZ', cat: 'lookup',
      t: ['Cerca in orizzontale', 'Horizontal lookup'],
      d: ['Come CERCA.VERT ma cerca nella prima riga e restituisce un valore della stessa colonna.', 'Like VLOOKUP but searches the first row and returns a value from the same column.'],
      a: [A('cosa cercare', 'lookup value', 'Il valore da trovare.', 'The value to find.'),
          A('tabella', 'table', 'La tabella, la prima riga è quella in cui cerca.', 'The table; its first row is searched.'),
          A('numero riga', 'row number', 'Quale riga restituire (1 = la prima).', 'Which row to return (1 = first).'),
          A('tipo di ricerca', 'match type', 'Quasi sempre "corrispondenza esatta".', 'Almost always "exact match".', { opt: true, ch: YESNO_EXACT, def: 0 })],
      ex: 'HLOOKUP("March",A1:M5,3,FALSE)', exd: ['Trova la colonna "March" e restituisce la terza riga.', 'Finds the "March" column and returns row 3.'] },

    { id: 'XLOOKUP', gs: 'XLOOKUP', gsf: true, cat: 'lookup',
      t: ['Ricerca moderna', 'Modern lookup'],
      d: ['Cerca un valore in un elenco e restituisce l\'elemento corrispondente di un altro elenco. Più semplice e flessibile di CERCA.VERT.', 'Finds a value in a list and returns the matching item from another list. Simpler and more flexible than VLOOKUP.'],
      a: [A('cosa cercare', 'lookup value', 'Il valore da trovare.', 'The value to find.'),
          A('dove cercare', 'lookup array', 'La colonna (o riga) in cui cercare.', 'The column (or row) to search.'),
          A('cosa restituire', 'return array', 'La colonna (o riga) da cui prendere il risultato.', 'The column (or row) to return from.'),
          A('se non trovato', 'if not found', 'Cosa mostrare se non c\'è.', 'What to show if missing.', { opt: true }),
          A('tipo di corrispondenza', 'match mode', 'Esatta, oppure il più vicino.', 'Exact, or nearest.', { opt: true, ch: [
            { l: ['Esatta', 'Exact'], v: '0' },
            { l: ['Esatta o la più piccola successiva', 'Exact or next smaller'], v: '-1' },
            { l: ['Esatta o la più grande successiva', 'Exact or next larger'], v: '1' },
            { l: ['Con caratteri jolly (* ?)', 'Wildcards (* ?)'], v: '2' }], def: -1 })],
      ex: 'XLOOKUP(A2,Products!A:A,Products!C:C,"Not found")', exd: ['Cerca A2 nella colonna A di Products e restituisce la colonna C.', 'Finds A2 in column A of Products and returns column C.'] },

    { id: 'INDEX', gs: 'INDICE', cat: 'lookup',
      t: ['Valore in posizione', 'Value at position'],
      d: ['Restituisce il valore di una tabella alla riga e colonna indicate.', 'Returns the value of a table at the given row and column.'],
      a: [A('tabella', 'array', 'L\'intervallo di celle.', 'The range of cells.'),
          A('riga', 'row', 'Il numero di riga dentro l\'intervallo.', 'The row number inside the range.'),
          A('colonna', 'column', 'Il numero di colonna (se l\'intervallo ha più colonne).', 'The column number (if the range has several columns).', { opt: true })],
      ex: 'INDEX(B2:B100,MATCH("Rossi",A2:A100,0))', exd: ['La classica coppia INDICE + CONFRONTA: trova "Rossi" in A e restituisce B.', 'The classic INDEX + MATCH pair: finds "Rossi" in A and returns B.'] },

    { id: 'MATCH', gs: 'CONFRONTA', cat: 'lookup',
      t: ['Posizione in un elenco', 'Position in a list'],
      d: ['Restituisce in che posizione si trova un valore all\'interno di un elenco.', 'Returns the position of a value inside a list.'],
      a: [A('cosa cercare', 'lookup value', 'Il valore da trovare.', 'The value to find.'),
          A('elenco', 'lookup array', 'La colonna o riga in cui cercare.', 'The column or row to search.'),
          A('tipo di ricerca', 'match type', 'Quasi sempre "esatta".', 'Almost always "exact".', { opt: true, ch: [
            { l: ['Esatta', 'Exact'], v: '0' },
            { l: ['Minore o uguale (elenco crescente)', 'Less or equal (ascending list)'], v: '1' },
            { l: ['Maggiore o uguale (elenco decrescente)', 'Greater or equal (descending list)'], v: '-1' }], def: 0 })],
      ex: 'MATCH("Rossi",A2:A100,0)', exd: ['In che riga dell\'elenco si trova "Rossi".', 'Which row of the list contains "Rossi".'] },

    { id: 'CHOOSE', gs: 'SCEGLI', cat: 'lookup',
      t: ['Scegli dall\'elenco', 'Pick from list'],
      d: ['Restituisce l\'elemento in posizione N di un elenco di valori.', 'Returns item number N from a list of values.'],
      a: [A('posizione', 'index', 'Quale elemento: 1 = il primo.', 'Which item: 1 = the first.')],
      r: { min: 2, a: [A('valore', 'value', 'Un elemento dell\'elenco.', 'An item of the list.')] },
      ex: 'CHOOSE(WEEKDAY(A1,2),"Mon","Tue","Wed","Thu","Fri","Sat","Sun")', exd: ['Il nome del giorno della data in A1.', 'The day name of the date in A1.'] },

    { id: 'ROW', gs: 'RIF.RIGA', cat: 'lookup',
      t: ['Numero di riga', 'Row number'],
      d: ['Restituisce il numero di riga di una cella (o della cella stessa se vuoto).', 'Returns the row number of a cell (or of the current cell if empty).'],
      a: [A('cella', 'reference', 'La cella. Vuoto = la cella della formula.', 'The cell. Empty = the formula cell.', { opt: true })],
      ex: 'ROW()-1', exd: ['Una numerazione progressiva che salta l\'intestazione.', 'A running number that skips the header.'] },

    { id: 'COLUMN', gs: 'RIF.COLONNA', cat: 'lookup',
      t: ['Numero di colonna', 'Column number'],
      d: ['Restituisce il numero di colonna di una cella (A = 1).', 'Returns the column number of a cell (A = 1).'],
      a: [A('cella', 'reference', 'La cella. Vuoto = la cella della formula.', 'The cell. Empty = the formula cell.', { opt: true })],
      ex: 'COLUMN(C1)', exd: ['Restituisce 3.', 'Returns 3.'] },

    { id: 'ROWS', gs: 'RIGHE', cat: 'lookup',
      t: ['Quante righe', 'How many rows'],
      d: ['Conta quante righe ha un intervallo.', 'Counts the rows in a range.'],
      a: [A('intervallo', 'range', 'L\'intervallo.', 'The range.')], ex: 'ROWS(A2:A50)', exd: ['Restituisce 49.', 'Returns 49.'] },

    { id: 'COLUMNS', gs: 'COLONNE', cat: 'lookup',
      t: ['Quante colonne', 'How many columns'],
      d: ['Conta quante colonne ha un intervallo.', 'Counts the columns in a range.'],
      a: [A('intervallo', 'range', 'L\'intervallo.', 'The range.')], ex: 'COLUMNS(A1:F1)', exd: ['Restituisce 6.', 'Returns 6.'] },

    { id: 'INDIRECT', gs: 'INDIRECT', gsf: true, cat: 'lookup',
      t: ['Riferimento da testo', 'Reference from text'],
      d: ['Trasforma un testo come "B5" o "Foglio2!A1" in un vero riferimento di cella.', 'Turns a text like "B5" or "Sheet2!A1" into a real cell reference.'],
      a: [A('riferimento come testo', 'reference text', 'Il testo con l\'indirizzo della cella.', 'The text with the cell address.')],
      ex: 'INDIRECT("B"&A1)', exd: ['Il valore della colonna B alla riga indicata in A1.', 'The value of column B at the row written in A1.'] },

    { id: 'OFFSET', gs: 'SCARTO', cat: 'lookup',
      t: ['Spostati di righe/colonne', 'Shift by rows/columns'],
      d: ['Restituisce un riferimento spostato di un certo numero di righe e colonne rispetto a una cella.', 'Returns a reference shifted by some rows and columns from a cell.'],
      a: [A('cella di partenza', 'reference', 'Da dove partire.', 'Where to start.'),
          A('righe', 'rows', 'Di quante righe spostarsi (negativo = in su).', 'Rows to move (negative = up).'),
          A('colonne', 'cols', 'Di quante colonne spostarsi (negativo = a sinistra).', 'Columns to move (negative = left).'),
          A('altezza', 'height', 'Quante righe deve avere il risultato.', 'Rows in the result.', { opt: true }),
          A('larghezza', 'width', 'Quante colonne deve avere il risultato.', 'Columns in the result.', { opt: true })],
      ex: 'SUM(OFFSET(A1,0,0,5,1))', exd: ['Somma le prime 5 celle della colonna A.', 'Adds the first 5 cells of column A.'] },

    /* ------------------------------- DATE ------------------------------ */
    { id: 'TODAY', gs: 'OGGI', cat: 'date',
      t: ['Data di oggi', 'Today\'s date'],
      d: ['Restituisce la data di oggi. Si aggiorna ogni giorno.', 'Returns today\'s date. It updates every day.'],
      a: [], ex: 'TODAY()-A1', exd: ['Quanti giorni sono passati dalla data in A1.', 'How many days have passed since the date in A1.'] },

    { id: 'NOW', gs: 'ADESSO', cat: 'date',
      t: ['Data e ora attuali', 'Current date and time'],
      d: ['Restituisce data e ora attuali.', 'Returns the current date and time.'],
      a: [], ex: 'NOW()', exd: ['La data e l\'ora di adesso.', 'The date and time right now.'] },

    { id: 'DATE', gs: 'DATA', cat: 'date',
      t: ['Crea una data', 'Build a date'],
      d: ['Crea una data a partire da anno, mese e giorno.', 'Builds a date from year, month and day.'],
      a: [A('anno', 'year', 'L\'anno, es. 2026.', 'The year, e.g. 2026.'),
          A('mese', 'month', 'Il mese da 1 a 12.', 'The month from 1 to 12.'),
          A('giorno', 'day', 'Il giorno del mese.', 'The day of the month.')],
      ex: 'DATE(YEAR(A1),12,31)', exd: ['Il 31 dicembre dello stesso anno della data in A1.', 'December 31st of the same year as A1.'] },

    { id: 'YEAR', gs: 'ANNO', cat: 'date',
      t: ['Anno di una data', 'Year of a date'],
      d: ['Estrae l\'anno da una data.', 'Gets the year from a date.'],
      a: [A('data', 'date', 'La data.', 'The date.')], ex: 'YEAR(TODAY())-YEAR(A1)', exd: ['Differenza di anni tra oggi e A1.', 'Years between today and A1.'] },

    { id: 'MONTH', gs: 'MESE', cat: 'date',
      t: ['Mese di una data', 'Month of a date'],
      d: ['Estrae il mese (1–12) da una data.', 'Gets the month (1–12) from a date.'],
      a: [A('data', 'date', 'La data.', 'The date.')], ex: 'MONTH(A1)', exd: ['Il numero del mese di A1.', 'The month number of A1.'] },

    { id: 'DAY', gs: 'GIORNO', cat: 'date',
      t: ['Giorno di una data', 'Day of a date'],
      d: ['Estrae il giorno del mese (1–31) da una data.', 'Gets the day of the month (1–31) from a date.'],
      a: [A('data', 'date', 'La data.', 'The date.')], ex: 'DAY(A1)', exd: ['Il giorno del mese di A1.', 'The day of the month of A1.'] },

    { id: 'WEEKDAY', gs: 'WEEKDAY', cat: 'date',
      t: ['Giorno della settimana', 'Day of the week'],
      d: ['Restituisce il giorno della settimana come numero.', 'Returns the day of the week as a number.'],
      a: [A('data', 'date', 'La data.', 'The date.'),
          A('tipo', 'type', 'Da dove iniziare a contare.', 'Where counting starts.', { opt: true, ch: [
            { l: ['1 = domenica … 7 = sabato', '1 = Sunday … 7 = Saturday'], v: '1' },
            { l: ['1 = lunedì … 7 = domenica', '1 = Monday … 7 = Sunday'], v: '2' },
            { l: ['0 = lunedì … 6 = domenica', '0 = Monday … 6 = Sunday'], v: '3' }], def: -1 })],
      ex: 'WEEKDAY(A1,2)>5', exd: ['VERO se la data in A1 cade nel fine settimana.', 'TRUE if the date in A1 is on a weekend.'] },

    { id: 'HOUR', gs: 'ORA', cat: 'date',
      t: ['Ora di un orario', 'Hour of a time'],
      d: ['Estrae l\'ora (0–23) da un orario.', 'Gets the hour (0–23) from a time.'],
      a: [A('orario', 'time', 'L\'orario o la data con ora.', 'The time or date-time.')], ex: 'HOUR(NOW())', exd: ['L\'ora attuale.', 'The current hour.'] },

    { id: 'MINUTE', gs: 'MINUTO', cat: 'date',
      t: ['Minuti di un orario', 'Minute of a time'],
      d: ['Estrae i minuti (0–59) da un orario.', 'Gets the minutes (0–59) from a time.'],
      a: [A('orario', 'time', 'L\'orario.', 'The time.')], ex: 'MINUTE(A1)', exd: ['I minuti dell\'orario in A1.', 'The minutes of the time in A1.'] },

    { id: 'EDATE', gs: 'DATA.MESE', cat: 'date',
      t: ['Aggiungi mesi', 'Add months'],
      d: ['Restituisce la data che cade N mesi prima o dopo.', 'Returns the date N months before or after.'],
      a: [A('data', 'start date', 'La data di partenza.', 'The starting date.'),
          A('mesi', 'months', 'Quanti mesi aggiungere (negativo = togliere).', 'How many months to add (negative = subtract).')],
      ex: 'EDATE(A1,6)', exd: ['La scadenza a 6 mesi dalla data in A1.', 'The date 6 months after A1.'] },

    { id: 'EOMONTH', gs: 'EOMONTH', gsf: true, cat: 'date',
      t: ['Fine del mese', 'End of month'],
      d: ['Restituisce l\'ultimo giorno del mese, N mesi prima o dopo una data.', 'Returns the last day of the month, N months before or after a date.'],
      a: [A('data', 'start date', 'La data di partenza.', 'The starting date.'),
          A('mesi', 'months', '0 = questo mese, 1 = il prossimo…', '0 = this month, 1 = next…')],
      ex: 'EOMONTH(TODAY(),0)', exd: ['L\'ultimo giorno del mese corrente.', 'The last day of the current month.'] },

    { id: 'DATEDIF', gs: 'DATA.DIFF', cat: 'date',
      t: ['Differenza tra date', 'Difference between dates'],
      d: ['Calcola anni, mesi o giorni completi tra due date. Perfetta per calcolare l\'età.', 'Calculates complete years, months or days between two dates. Perfect for ages.'],
      a: [A('data inizio', 'start date', 'La data più vecchia.', 'The earlier date.'),
          A('data fine', 'end date', 'La data più recente.', 'The later date.'),
          A('unità', 'unit', 'Cosa contare.', 'What to count.', { ch: [
            { l: ['Anni completi', 'Complete years'], v: '"Y"' },
            { l: ['Mesi completi', 'Complete months'], v: '"M"' },
            { l: ['Giorni', 'Days'], v: '"D"' },
            { l: ['Mesi oltre gli anni', 'Months beyond years'], v: '"YM"' },
            { l: ['Giorni oltre i mesi', 'Days beyond months'], v: '"MD"' }], def: 0 })],
      ex: 'DATEDIF(A1,TODAY(),"Y")', exd: ['L\'età di chi è nato nella data in A1.', 'The age of someone born on the date in A1.'],
      tip: ['In Excel non compare nei suggerimenti, ma funziona.', 'Excel does not suggest it while typing, but it works.'] },

    { id: 'NETWORKDAYS', gs: 'NETWORKDAYS', gsf: true, cat: 'date',
      t: ['Giorni lavorativi', 'Working days'],
      d: ['Conta i giorni lavorativi (lunedì–venerdì) tra due date, escludendo eventuali festività.', 'Counts working days (Monday–Friday) between two dates, excluding optional holidays.'],
      a: [A('data inizio', 'start date', 'La prima data.', 'The first date.'),
          A('data fine', 'end date', 'L\'ultima data.', 'The last date.'),
          A('festività', 'holidays', 'Un intervallo con le date festive da escludere.', 'A range with holiday dates to exclude.', { opt: true })],
      ex: 'NETWORKDAYS(A1,B1,H2:H20)', exd: ['Giorni lavorativi tra A1 e B1 senza le festività in H.', 'Working days between A1 and B1 without the holidays in H.'] },

    /* ------------------------------- INFO ------------------------------ */
    { id: 'ISBLANK', gs: 'VAL.VUOTO', cat: 'info',
      t: ['La cella è vuota?', 'Is the cell empty?'],
      d: ['VERO se la cella è completamente vuota.', 'TRUE if the cell is completely empty.'],
      a: [A('cella', 'value', 'La cella da controllare.', 'The cell to check.')], ex: 'IF(ISBLANK(A1),"Missing",A1)', exd: ['Scrive "Missing" se A1 è vuota.', 'Shows "Missing" if A1 is empty.'] },

    { id: 'ISNUMBER', gs: 'VAL.NUMERO', cat: 'info',
      t: ['È un numero?', 'Is it a number?'],
      d: ['VERO se il valore è un numero.', 'TRUE if the value is a number.'],
      a: [A('valore', 'value', 'Il valore da controllare.', 'The value to check.')], ex: 'ISNUMBER(A1)', exd: ['VERO se in A1 c\'è un numero.', 'TRUE if A1 contains a number.'] },

    { id: 'ISTEXT', gs: 'VAL.TESTO', cat: 'info',
      t: ['È un testo?', 'Is it text?'],
      d: ['VERO se il valore è un testo.', 'TRUE if the value is text.'],
      a: [A('valore', 'value', 'Il valore da controllare.', 'The value to check.')], ex: 'ISTEXT(A1)', exd: ['VERO se in A1 c\'è del testo.', 'TRUE if A1 contains text.'] },

    { id: 'ISERROR', gs: 'VAL.ERRORE', cat: 'info',
      t: ['È un errore?', 'Is it an error?'],
      d: ['VERO se il valore è un errore di qualsiasi tipo.', 'TRUE if the value is any kind of error.'],
      a: [A('valore', 'value', 'Il valore o calcolo da controllare.', 'The value or calculation to check.')], ex: 'ISERROR(A1/B1)', exd: ['VERO se la divisione dà errore.', 'TRUE if the division fails.'] },

    { id: 'NA', gs: 'NON.DISP', cat: 'info',
      t: ['Valore non disponibile', 'Not available'],
      d: ['Restituisce di proposito l\'errore #N/D, utile per i grafici o per segnalare dati mancanti.', 'Returns the #N/A error on purpose, useful for charts or to flag missing data.'],
      a: [], ex: 'IF(A1="",NA(),A1)', exd: ['Mostra #N/D quando A1 è vuota.', 'Shows #N/A when A1 is empty.'] },

    /* ------------------------------ ARRAYS ----------------------------- */
    { id: 'FILTER', gs: 'FILTER', cat: 'array',
      t: ['Filtra un elenco', 'Filter a list'],
      d: ['Restituisce solo le righe di una tabella che rispettano una condizione. Il risultato si espande nelle celle vicine.', 'Returns only the rows of a table that match a condition. The result spills into nearby cells.'],
      a: [A('tabella', 'array', 'Le righe da filtrare.', 'The rows to filter.'),
          A('condizione', 'include', 'Una condizione su una colonna, es. B2:B50>100.', 'A condition on a column, e.g. B2:B50>100.'),
          A('se vuoto', 'if empty', 'Cosa mostrare se nessuna riga corrisponde.', 'What to show when no row matches.', { opt: true })],
      ex: 'FILTER(A2:C50,C2:C50>100,"None")', exd: ['Le righe in cui la colonna C supera 100.', 'The rows where column C is above 100.'],
      gsnote: ['In Google Fogli FILTER non ha il valore "se vuoto": la formula viene avvolta automaticamente in SE.ERRORE.', 'Google Sheets FILTER has no "if empty" value: the formula is wrapped in IFERROR automatically.'] },

    { id: 'SORT', gs: 'SORT', cat: 'array',
      t: ['Ordina un elenco', 'Sort a list'],
      d: ['Restituisce una copia ordinata di una tabella. Il risultato si espande nelle celle vicine.', 'Returns a sorted copy of a table. The result spills into nearby cells.'],
      a: [A('tabella', 'array', 'Le righe da ordinare.', 'The rows to sort.'),
          A('colonna', 'sort column', 'Il numero della colonna per cui ordinare (1 = la prima).', 'The column number to sort by (1 = first).', { opt: true }),
          A('ordine', 'order', 'Crescente o decrescente.', 'Ascending or descending.', { opt: true, ch: [
            { l: ['Crescente (A→Z, 1→9)', 'Ascending (A→Z, 1→9)'], v: 'ASC' },
            { l: ['Decrescente (Z→A, 9→1)', 'Descending (Z→A, 9→1)'], v: 'DESC' }], def: -1 })],
      ex: 'SORT(A2:C50,3,-1)', exd: ['La tabella ordinata dalla colonna 3, dal più alto al più basso.', 'The table sorted by column 3, highest first.'],
      gsnote: ['Excel indica l\'ordine con 1 / -1, Fogli con VERO / FALSO: il blocco lo converte da solo.', 'Excel uses 1 / -1 for the order, Sheets uses TRUE / FALSE: the block converts it for you.'] },

    { id: 'UNIQUE', gs: 'UNIQUE', cat: 'array',
      t: ['Togli i duplicati', 'Remove duplicates'],
      d: ['Restituisce l\'elenco senza ripetizioni.', 'Returns the list without repetitions.'],
      a: [A('elenco', 'array', 'Le celle con i valori.', 'The cells with the values.')],
      ex: 'SORT(UNIQUE(A2:A100))', exd: ['L\'elenco dei valori di A, senza doppioni e in ordine.', 'The values of A, without duplicates and sorted.'] },

    { id: 'LET', gs: 'LET', cat: 'array',
      t: ['Dai un nome ai calcoli', 'Name your calculations'],
      d: ['Assegna dei nomi (variabili) a valori o calcoli, poi li usa nel risultato finale. Rende le formule lunghe più leggibili e veloci.', 'Assigns names (variables) to values or calculations, then uses them in the final result. Makes long formulas easier to read and faster.'],
      r: { min: 1, a: [A('nome', 'name', 'Il nome della variabile (senza spazi, non come una cella).', 'The variable name (no spaces, not like a cell address).', { kind: 'name' }),
                       A('valore', 'value', 'Il valore o calcolo da ricordare con quel nome.', 'The value or calculation stored under that name.')] },
      tl: [A('risultato', 'result', 'Il calcolo finale, che può usare i nomi.', 'The final calculation, which can use the names.')],
      ex: 'LET(total,SUM(A1:A10),IF(total>100,"High","Low"))', exd: ['Calcola il totale una volta sola e lo usa nel SE.', 'Calculates the total once and uses it in the IF.'],
      tip: ['Per usare una variabile scrivi semplicemente il suo nome in un campo, oppure usa il blocco "Nome".', 'To use a variable just type its name in a field, or use the "Name" block.'] },

    { id: 'LAMBDA', gs: 'LAMBDA', cat: 'array',
      t: ['Funzione personalizzata', 'Custom function'],
      d: ['Crea una piccola funzione con dei parametri. Si usa dentro MAP, BYROW, REDUCE ecc.', 'Creates a small function with parameters. It is used inside MAP, BYROW, REDUCE etc.'],
      r: { min: 1, a: [A('parametro', 'parameter', 'Il nome di un parametro.', 'The name of a parameter.', { kind: 'name' })] },
      tl: [A('calcolo', 'calculation', 'Cosa calcolare usando i parametri.', 'What to calculate using the parameters.')],
      ex: 'MAP(A1:A5,LAMBDA(x,x*2))', exd: ['Raddoppia ogni valore di A1:A5.', 'Doubles every value in A1:A5.'] },

    { id: 'MAP', gs: 'MAP', cat: 'array',
      t: ['Applica a ogni elemento', 'Apply to each item'],
      d: ['Applica una LAMBDA a ogni valore di un elenco e restituisce l\'elenco dei risultati.', 'Applies a LAMBDA to every value of a list and returns the list of results.'],
      a: [A('elenco', 'array', 'I valori da elaborare.', 'The values to process.'),
          A('lambda', 'lambda', 'Una LAMBDA con un parametro.', 'A LAMBDA with one parameter.')],
      ex: 'MAP(A1:A5,LAMBDA(x,UPPER(x)))', exd: ['Ogni valore di A1:A5 in maiuscolo.', 'Each value of A1:A5 in capitals.'] },

    { id: 'BYROW', gs: 'BYROW', gsf: true, cat: 'array',
      t: ['Calcola per ogni riga', 'Calculate per row'],
      d: ['Applica una LAMBDA a ogni riga di una tabella (es. il massimo di ogni riga).', 'Applies a LAMBDA to each row of a table (e.g. the max of each row).'],
      a: [A('tabella', 'array', 'La tabella.', 'The table.'),
          A('lambda', 'lambda', 'Una LAMBDA con un parametro (la riga).', 'A LAMBDA with one parameter (the row).')],
      ex: 'BYROW(A2:D10,LAMBDA(row,SUM(row)))', exd: ['Il totale di ogni riga.', 'The total of each row.'] },

    { id: 'BYCOL', gs: 'BYCOL', gsf: true, cat: 'array',
      t: ['Calcola per ogni colonna', 'Calculate per column'],
      d: ['Applica una LAMBDA a ogni colonna di una tabella.', 'Applies a LAMBDA to each column of a table.'],
      a: [A('tabella', 'array', 'La tabella.', 'The table.'),
          A('lambda', 'lambda', 'Una LAMBDA con un parametro (la colonna).', 'A LAMBDA with one parameter (the column).')],
      ex: 'BYCOL(A2:D10,LAMBDA(col,MAX(col)))', exd: ['Il massimo di ogni colonna.', 'The maximum of each column.'] },

    { id: 'REDUCE', gs: 'REDUCE', gsf: true, cat: 'array',
      t: ['Accumula un risultato', 'Accumulate a result'],
      d: ['Scorre un elenco e aggiorna un accumulatore a ogni passo, restituendo il valore finale.', 'Walks through a list updating an accumulator at each step, returning the final value.'],
      a: [A('valore iniziale', 'initial value', 'Da dove parte l\'accumulatore.', 'The starting value of the accumulator.'),
          A('elenco', 'array', 'I valori da scorrere.', 'The values to walk through.'),
          A('lambda', 'lambda', 'Una LAMBDA con due parametri: accumulatore e valore.', 'A LAMBDA with two parameters: accumulator and value.')],
      ex: 'REDUCE(0,A1:A10,LAMBDA(acc,v,IF(v>0,acc+v,acc)))', exd: ['Somma solo i valori positivi.', 'Adds only the positive values.'] },

    { id: 'MAKEARRAY', gs: 'MAKEARRAY', gsf: true, cat: 'array',
      t: ['Crea una tabella calcolata', 'Build a calculated table'],
      d: ['Crea una tabella di righe × colonne calcolando ogni cella con una LAMBDA.', 'Builds a rows × columns table calculating each cell with a LAMBDA.'],
      a: [A('righe', 'rows', 'Quante righe.', 'How many rows.'),
          A('colonne', 'columns', 'Quante colonne.', 'How many columns.'),
          A('lambda', 'lambda', 'Una LAMBDA con due parametri: riga e colonna.', 'A LAMBDA with two parameters: row and column.')],
      ex: 'MAKEARRAY(10,10,LAMBDA(r,c,r*c))', exd: ['La tavola pitagorica 10×10.', 'A 10×10 multiplication table.'] }
  ];

  /* Special building blocks (non-function nodes) */
  const BLOCKS = [
    { id: '@num',  t: ['Numero', 'Number'],             d: ['Un numero fisso, ad esempio 10 oppure 3,5.', 'A fixed number, for example 10 or 3.5.'] },
    { id: '@text', t: ['Testo', 'Text'],                d: ['Un testo fisso. Le virgolette vengono aggiunte da sole.', 'A fixed text. Quotes are added automatically.'] },
    { id: '@ref',  t: ['Cella o intervallo', 'Cell or range'], d: ['Un riferimento come A1, B2:B20, A:A oppure Foglio2!C3. Usa il $ per bloccarlo (es. $A$1).', 'A reference like A1, B2:B20, A:A or Sheet2!C3. Use $ to lock it (e.g. $A$1).'] },
    { id: '@bool', t: ['Vero / Falso', 'True / False'], d: ['Il valore logico VERO o FALSO.', 'The logical value TRUE or FALSE.'] },
    { id: '@name', t: ['Nome (variabile)', 'Name (variable)'], d: ['Il nome di una variabile creata con LET o di un parametro di LAMBDA.', 'The name of a variable created with LET or of a LAMBDA parameter.'] },
    { id: '@math', t: ['Calcolo', 'Arithmetic'],        d: ['Somma, sottrae, moltiplica, divide o eleva a potenza due valori.', 'Adds, subtracts, multiplies, divides or raises two values to a power.'] },
    { id: '@cmp',  t: ['Confronto', 'Comparison'],      d: ['Confronta due valori (uguale, diverso, maggiore, minore…) e restituisce VERO o FALSO. Si collega di solito alla condizione di un SE.', 'Compares two values (equal, not equal, greater, less…) and returns TRUE or FALSE. Usually plugged into the condition of an IF.'] },
    { id: '@join', t: ['Unisci testo (&)', 'Join text (&)'], d: ['Unisce due o più valori in un unico testo, con il simbolo &.', 'Joins two or more values into one text with the & symbol.'] },
    { id: '@neg',  t: ['Cambia segno / %', 'Negate / %'],   d: ['Mette il segno meno davanti a un valore, oppure lo trasforma in percentuale (%).', 'Puts a minus sign in front of a value, or turns it into a percentage (%).'] },
    { id: '@fn',   t: ['Altra funzione', 'Other function'], d: ['Qualsiasi funzione non presente nell\'elenco: scrivi il nome e aggiungi gli argomenti.', 'Any function not in the list: type its name and add arguments.'] }
  ];

  const MATH_OPS = [
    { v: '+', l: ['+  più', '+  plus'] },
    { v: '-', l: ['−  meno', '−  minus'] },
    { v: '*', l: ['×  per', '×  times'] },
    { v: '/', l: ['÷  diviso', '÷  divided by'] },
    { v: '^', l: ['^  elevato a', '^  to the power of'] }
  ];
  const CMP_OPS = [
    { v: '=',  l: ['=  uguale a', '=  equal to'] },
    { v: '<>', l: ['≠  diverso da', '≠  not equal to'] },
    { v: '>',  l: ['>  maggiore di', '>  greater than'] },
    { v: '>=', l: ['≥  maggiore o uguale a', '≥  greater or equal'] },
    { v: '<',  l: ['<  minore di', '<  less than'] },
    { v: '<=', l: ['≤  minore o uguale a', '≤  less or equal'] }
  ];

  const byId = {};
  const byAnyName = {};
  F.forEach(f => {
    byId[f.id] = f;
    byAnyName[f.id.toUpperCase()] = f;
    byAnyName[f.gs.toUpperCase()] = f;
  });
  // Italian aliases that Google documents in at least one place (accepted by the importer)
  const EXTRA_ALIASES = { 'RESTO': 'MOD', 'CERCA.X': 'XLOOKUP', 'INDIRETTO': 'INDIRECT', 'FINE.MESE': 'EOMONTH',
    'GIORNI.LAVORATIVI.TOT': 'NETWORKDAYS', 'VALORE': 'VALUE', 'PERRIGA': 'BYROW', 'PERCOL': 'BYCOL',
    'RIDUCI': 'REDUCE', 'CREAMATRICE': 'MAKEARRAY', 'SE.NON.DISP': 'IFNA', 'SEQUENZA': 'SEQUENCE',
    'FILTRO': 'FILTER', 'DATA.DIFF': 'DATEDIF', 'GIORNO.SETTIMANA': 'WEEKDAY' };
  Object.keys(EXTRA_ALIASES).forEach(k => { byAnyName[k] = byId[EXTRA_ALIASES[k]]; });

  window.FB_CATALOG = { CATEGORIES, FUNCTIONS: F, BLOCKS, MATH_OPS, CMP_OPS, byId, byAnyName };
})();
