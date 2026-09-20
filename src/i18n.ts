// feature: exam-variants
//
// Every string a person can read, in both languages, in one table.
//
// The English text is also written into index.html, so the page reads
// correctly before any script runs -- that is what keeps the warning on the
// page when the bundle fails to load.  Switching to Greek replaces those text
// nodes; switching back restores them from `en`, and a test holds the two
// copies of the English identical.
//
// Keys are sentence-sized rather than fragment-sized on purpose.  A sentence
// cut into "lead" and "rest" around a <strong> can only be reassembled in
// languages that share English word order, and Greek does not.

export type Lang = 'en' | 'el';
export type Params = Record<string, string | number>;

export const LANGS: readonly Lang[] = ['en', 'el'];
export const DEFAULT_LANG: Lang = 'en';

const EN: Record<string, string> = {
  // -- page -------------------------------------------------------------
  'page.title': 'testmess — shuffled exam variants',
  'page.description':
    'Turn one multiple-choice test in Word into any number of shuffled variants, '
    + 'student copy and professor copy. Runs entirely in your browser.',

  // -- the standing warning ---------------------------------------------
  'banner.lead': 'Check every paper before you use it.',
  'banner.rest':
    'This tool is free software, provided with no warranty of any kind. It can '
    + 'get a shuffle, an answer key or a document wrong — you are responsible '
    + 'for checking what it produces.',
  'banner.full': 'Read the full notice',

  // -- the notice --------------------------------------------------------
  'notice.title': 'Before you use this tool',
  'notice.warranty':
    'testmess is provided free of charge, “as is” and “as available”, without '
    + 'warranty of any kind.',
  'notice.warranty.detail':
    'That includes, without limitation, any express or implied warranty of '
    + 'merchantability, fitness for a particular purpose, accuracy, or '
    + 'non-infringement.',
  'notice.errors':
    'It is software, and software gets things wrong. It may misread a question '
    + 'or an answer key, shuffle an option wrongly, point a key at the wrong '
    + 'answer, drop or alter part of your document, or produce a file that Word '
    + 'cannot open.',
  'notice.errors.emph': 'Such failures are not always obvious at a glance.',
  'notice.check':
    'You must check every document it produces — every student copy and every '
    + 'answer key — before you print, distribute, sit or grade an examination '
    + 'with it.',
  'notice.check.detail': 'Do not rely on it unchecked.',
  'notice.liability':
    'To the fullest extent permitted by applicable law, the authors and '
    + 'contributors accept no liability for any loss or damage of any kind '
    + 'arising out of or in connection with this tool or anything it produces, '
    + 'including without limitation misprinted or misgraded examinations, '
    + 'incorrect marks or results, wasted time, lost or corrupted documents, or '
    + 'any direct, indirect, incidental, special, consequential or exemplary '
    + 'damages, whether in contract, tort (including negligence) or otherwise, '
    + 'and whether or not the possibility of such damage was known.',
  'notice.responsibility':
    'You are responsible for the documents you process with it and for '
    + 'following the rules of your school, university or employer. Nothing in '
    + 'this notice excludes or limits any liability that cannot lawfully be '
    + 'excluded or limited under the law that applies to you; if any part of '
    + 'this notice is held unenforceable, the rest continues to apply.',
  'notice.accept.text': 'By continuing you accept this notice and the terms of the',
  'notice.accept.licence': 'MIT licence',
  'notice.accept.refuse': 'If you do not accept them, close this page.',
  'notice.prevail':
    'This notice is also published in Greek; if the two differ, the English '
    + 'text prevails.',
  'notice.accept': 'I understand — continue',

  // -- header ------------------------------------------------------------
  'app.tagline':
    'One multiple-choice test in Word, any number of shuffled variants — each '
    + 'written twice: a student copy (questions and options) and a professor '
    + 'copy (the same paper, plus the answer key on its own last page).',
  'app.privacy':
    'Your test never leaves this tab. There is no upload and no server: the '
    + 'documents are read, shuffled and written here, on your computer.',

  // -- step 1 ------------------------------------------------------------
  'step1.title': 'Choose the test',
  'step1.choose': 'Choose a .docx file',
  'step1.drag': 'or drag it here',
  'samples.summary': 'First time here? Start from a sample test',
  'samples.intro':
    'New to this? Start from a sample. Load one to see what comes out; download '
    + 'one and open it in Word to see exactly how a test has to be laid out — '
    + 'how questions are numbered, how options are marked, and the Answer Key '
    + 'page at the end. Save a copy, type your own questions over the top, and '
    + 'you have a document this program can read.',
  'samples.latin': 'Latin markers',
  'samples.greek': 'Greek markers',
  'samples.nokey': 'Greek markers, no answer key',
  'samples.load': 'Load it',
  'samples.download': 'Download the .docx',
  'samples.note':
    'All three are the same ten questions. Two are marked in different '
    + 'alphabets — the markers in your own test are used as they are, so a '
    + 'Greek-lettered paper stays Greek-lettered. The third has no answer key '
    + 'page at all, and makes student copies only.',

  // -- step 2 ------------------------------------------------------------
  'step2.title': 'Settings',
  'step2.variants': 'Variants',
  'step2.seed': 'Seed',
  'step2.optional': '(optional)',
  'step2.seedPlaceholder': 'leave empty for a new one',
  'step2.scrub': 'Remove author details from the papers',
  'step2.scrub.detail':
    '— Word stores the name of whoever wrote and last saved the document inside '
    + 'the file itself, and a copy handed to a class carries it. Untick to keep '
    + "the source's metadata as it is.",
  'step2.seedHint':
    'The same seed always produces exactly the same papers, which is what you '
    + 'want if you have to reprint one of them later. The seed used is shown '
    + 'with the results.',

  // -- step 3 ------------------------------------------------------------
  'step3.title': 'Build the papers',
  'step3.caution': 'Read what comes out before it reaches a student.',
  'step3.caution.detail':
    'Check a paper against its answer key, and check that the equations look '
    + 'right in Word.',
  'step3.generate': 'Generate variants',
  'step3.download': 'Download papers.zip',

  // -- what the page says while it works ---------------------------------
  'status.reading': 'Reading it…',
  'status.source': '{count} questions, options marked {markers}',
  'status.source.titled': '{title} — {count} questions, options marked {markers}',
  'status.haskey':
    'Answer key found: every variant gets a student copy and a professor copy.',
  'status.failed': 'This document could not be read.',
  'status.building': 'Building the papers…',
  'status.ready':
    '{variants} variants ready: {papers} documents. Hand out the student '
    + 'copies; the professor copies carry the key.',
  'status.ready.nokey':
    '{variants} variants ready: {papers} student copies. There are no professor '
    + 'copies, because this test came without an answer key.',
  'status.nokey':
    'No answer key page: student copies only, one per variant, and no key to '
    + 'hand out by mistake.',
  'status.warning':
    'Careful: this document contains {what}, which are part of the file and '
    + 'will be carried into the papers. Remove them in Word (Review tab) first '
    + 'if the class should not see them.',
  'warning.comments': 'comments',
  'warning.tracked': 'tracked changes',
  'warning.and': 'and',
  'results.variant': 'Variant',
  'results.files': 'Files',
  'results.key': 'Answer key',
  'results.nokey': 'none in the source',
  'results.seed': 'Seed {seed} — type it into the seed box to rebuild exactly these papers.',
  'download.button': 'Download {name} ({papers} papers)',

  // -- footer ------------------------------------------------------------
  'footer.equations':
    'Equations written with the Word equation editor survive untouched: every '
    + 'stem and option is carried as the raw paragraph markup from your '
    + 'document, and the only thing rewritten is the label in front of it.',
  'footer.disclaimer':
    'Provided as is, without warranty of any kind; no liability is accepted for '
    + 'its output or for anything arising from its use.',
  'footer.full': 'Full notice',
  'footer.source': 'Source code',
  'footer.licence': 'MIT licence',

  // -- what this program writes into a document --------------------------
  // The professor copy's banner, and the key heading used only where the
  // source has none of its own.  The one place where the page's language
  // reaches the paper.
  'paper.banner': 'Variant {index} - Professor copy (with answer key)',
  'paper.key': 'Answer Key',

  // -- errors ------------------------------------------------------------
  // Raised with a code and parameters rather than a sentence, so the person
  // who has to act on them reads them in their own language.
  'error.not-a-docx': 'not a Word document: no word/document.xml inside',
  'error.unreadable': 'could not read {source}: {detail}',
  'error.no-questions': 'no questions found in {source}',
  'error.too-few-options': 'question {number} has {count} option(s)',
  'error.duplicate-markers': 'question {number} has duplicate option markers: {markers}',
  'error.no-key-entry': 'no answer key entry for question {number}',
  'error.key-not-an-option':
    'the key for question {number} is {answer}, which is not one of {markers}',
  'error.count-too-small': 'the number of variants must be at least 1',
  'error.sample': 'could not load the sample ({name})',
  'error.not-an-archive': 'that file is not a Word document (it is not even a ZIP archive)',
  'error.too-large': 'that file is larger than {limit} MB',
  'error.unpacks-too-large': '{name} unpacks to more than this page will handle',
  'error.zip64': 'zip64 archives are not supported',
  'error.encrypted': '{name} is encrypted',
  'error.unsupported-method': '{name} uses unsupported compression method {method}',
  'error.corrupt': '{name} is corrupt (checksum mismatch)',
  'error.corrupt-directory': 'corrupt central directory at entry {index}',
  'error.corrupt-header': 'corrupt local header for {name}',
  'error.not-well-formed': 'not well-formed XML: {detail}',
  'error.no-body': 'word/document.xml has no <w:body>',
  'error.lost-answer': 'question {number} lost its answer while shuffling',
};

const EL: Record<string, string> = {
  // -- page -------------------------------------------------------------
  'page.title': 'testmess — παραλλαγές διαγωνίσματος',
  'page.description':
    'Μετατρέψτε ένα διαγώνισμα πολλαπλής επιλογής σε Word σε όσες παραλλαγές '
    + 'θέλετε, με αντίτυπο μαθητή και αντίτυπο καθηγητή. Εκτελείται εξ ολοκλήρου '
    + 'στον browser σας.',

  // -- the standing warning ---------------------------------------------
  'banner.lead': 'Ελέγξτε κάθε φυλλάδιο πριν το χρησιμοποιήσετε.',
  'banner.rest':
    'Το εργαλείο αυτό είναι ελεύθερο λογισμικό και παρέχεται χωρίς καμία '
    + 'εγγύηση. Μπορεί να κάνει λάθος στην ανακατανομή, στις απαντήσεις ή στο '
    + 'ίδιο το έγγραφο — η ευθύνη του ελέγχου είναι δική σας.',
  'banner.full': 'Διαβάστε ολόκληρη τη δήλωση',

  // -- the notice --------------------------------------------------------
  'notice.title': 'Πριν χρησιμοποιήσετε αυτό το εργαλείο',
  'notice.warranty':
    'Το testmess διατίθεται δωρεάν, «ως έχει» και «ως είναι διαθέσιμο», χωρίς '
    + 'καμία απολύτως εγγύηση.',
  'notice.warranty.detail':
    'Αυτό περιλαμβάνει, ενδεικτικά και όχι περιοριστικά, κάθε ρητή ή σιωπηρή '
    + 'εγγύηση εμπορευσιμότητας, καταλληλότητας για συγκεκριμένο σκοπό, '
    + 'ακρίβειας ή μη προσβολής δικαιωμάτων τρίτων.',
  'notice.errors':
    'Είναι λογισμικό, και το λογισμικό κάνει λάθη. Μπορεί να διαβάσει λάθος μια '
    + 'ερώτηση ή τις απαντήσεις, να ανακατέψει λανθασμένα τις επιλογές, να '
    + 'δείξει ως σωστή λάθος απάντηση, να παραλείψει ή να αλλοιώσει μέρος του '
    + 'εγγράφου σας, ή να παραγάγει αρχείο που το Word δεν μπορεί να ανοίξει.',
  'notice.errors.emph': 'Τέτοια σφάλματα δεν είναι πάντα εμφανή με την πρώτη ματιά.',
  'notice.check':
    'Οφείλετε να ελέγχετε κάθε έγγραφο που παράγει — κάθε αντίτυπο μαθητή και '
    + 'κάθε φύλλο απαντήσεων — πριν εκτυπώσετε, διανείμετε, διεξαγάγετε ή '
    + 'βαθμολογήσετε διαγώνισμα με αυτό.',
  'notice.check.detail': 'Μην το εμπιστεύεστε χωρίς έλεγχο.',
  'notice.liability':
    'Στο μέγιστο βαθμό που επιτρέπει το εφαρμοστέο δίκαιο, οι δημιουργοί και οι '
    + 'συνεισφέροντες δεν φέρουν καμία ευθύνη για οποιαδήποτε απώλεια ή ζημία '
    + 'προκύψει από ή σε σχέση με το εργαλείο αυτό ή με οτιδήποτε παράγει, '
    + 'ενδεικτικά για λανθασμένα εκτυπωμένα ή λανθασμένα βαθμολογημένα '
    + 'διαγωνίσματα, εσφαλμένους βαθμούς ή αποτελέσματα, χαμένο χρόνο, '
    + 'απολεσθέντα ή κατεστραμμένα έγγραφα, ούτε για οποιαδήποτε άμεση, έμμεση, '
    + 'παρεπόμενη, ειδική, αποθετική ή παραδειγματική ζημία, είτε εκ συμβάσεως '
    + 'είτε εξ αδικοπραξίας (συμπεριλαμβανομένης της αμέλειας) είτε άλλως, '
    + 'ανεξαρτήτως του αν είχε γνωστοποιηθεί το ενδεχόμενο τέτοιας ζημίας.',
  'notice.responsibility':
    'Είστε υπεύθυνος ή υπεύθυνη για τα έγγραφα που επεξεργάζεστε με αυτό και '
    + 'για την τήρηση των κανόνων του σχολείου, του πανεπιστημίου ή του εργοδότη '
    + 'σας. Καμία διάταξη της παρούσας δήλωσης δεν αποκλείει ούτε περιορίζει '
    + 'ευθύνη που δεν επιτρέπεται νομίμως να αποκλειστεί ή να περιοριστεί κατά '
    + 'το δίκαιο που σας διέπει· αν κάποιο μέρος της παρούσας κριθεί ανίσχυρο, '
    + 'τα υπόλοιπα εξακολουθούν να ισχύουν.',
  'notice.accept.text':
    'Συνεχίζοντας, αποδέχεστε την παρούσα δήλωση και τους όρους της',
  'notice.accept.licence': 'άδειας MIT',
  'notice.accept.refuse': 'Αν δεν τους αποδέχεστε, κλείστε τη σελίδα.',
  'notice.prevail':
    'Η παρούσα δήλωση είναι μετάφραση· σε περίπτωση απόκλισης υπερισχύει το '
    + 'αγγλικό κείμενο.',
  'notice.accept': 'Κατάλαβα — συνέχεια',

  // -- header ------------------------------------------------------------
  'app.tagline':
    'Ένα διαγώνισμα πολλαπλής επιλογής σε Word, όσες παραλλαγές θέλετε — και '
    + 'καθεμία γραμμένη δύο φορές: αντίτυπο μαθητή (ερωτήσεις και επιλογές) και '
    + 'αντίτυπο καθηγητή (το ίδιο φυλλάδιο, συν τις απαντήσεις σε δική τους '
    + 'τελευταία σελίδα).',
  'app.privacy':
    'Το διαγώνισμά σας δεν φεύγει ποτέ από αυτή την καρτέλα. Δεν υπάρχει '
    + 'ανέβασμα ούτε διακομιστής: τα έγγραφα διαβάζονται, ανακατεύονται και '
    + 'γράφονται εδώ, στον υπολογιστή σας.',

  // -- step 1 ------------------------------------------------------------
  'step1.title': 'Επιλέξτε το διαγώνισμα',
  'step1.choose': 'Επιλέξτε αρχείο .docx',
  'step1.drag': 'ή σύρετέ το εδώ',
  'samples.summary': 'Πρώτη φορά εδώ; Ξεκινήστε από ένα δείγμα διαγώνισμα',
  'samples.intro':
    'Πρώτη φορά; Ξεκινήστε από ένα δείγμα. Φορτώστε ένα για να δείτε τι βγαίνει· '
    + 'κατεβάστε ένα και ανοίξτε το στο Word για να δείτε ακριβώς πώς πρέπει να '
    + 'είναι στημένο ένα διαγώνισμα — πώς αριθμούνται οι ερωτήσεις, πώς '
    + 'σημειώνονται οι επιλογές και τη σελίδα των απαντήσεων στο τέλος. '
    + 'Αποθηκεύστε ένα αντίγραφο, γράψτε από πάνω τις δικές σας ερωτήσεις, και '
    + 'έχετε ένα έγγραφο που το πρόγραμμα μπορεί να διαβάσει.',
  'samples.latin': 'Λατινικοί δείκτες',
  'samples.greek': 'Ελληνικοί δείκτες',
  'samples.nokey': 'Ελληνικοί δείκτες, χωρίς απαντήσεις',
  'samples.load': 'Φόρτωσέ το',
  'samples.download': 'Κατεβάστε το .docx',
  'samples.note':
    'Και τα τρία δείγματα έχουν τις ίδιες δέκα ερωτήσεις. Τα δύο είναι '
    + 'σημειωμένα σε διαφορετικά αλφάβητα — οι δείκτες του δικού σας '
    + 'διαγωνίσματος χρησιμοποιούνται όπως είναι, οπότε ένα ελληνικό φυλλάδιο '
    + 'μένει ελληνικό. Το τρίτο δεν έχει καθόλου σελίδα απαντήσεων και παράγει '
    + 'μόνο αντίτυπα μαθητή.',

  // -- step 2 ------------------------------------------------------------
  'step2.title': 'Ρυθμίσεις',
  'step2.variants': 'Παραλλαγές',
  'step2.seed': 'Σπόρος',
  'step2.optional': '(προαιρετικό)',
  'step2.seedPlaceholder': 'αφήστε το κενό για καινούργιο',
  'step2.scrub': 'Αφαίρεση των στοιχείων του συντάκτη από τα φυλλάδια',
  'step2.scrub.detail':
    '— Το Word αποθηκεύει μέσα στο ίδιο το αρχείο το όνομα όποιου το έγραψε και '
    + 'το αποθήκευσε τελευταίος, και ένα αντίγραφο που μοιράζεται σε τάξη το '
    + 'μεταφέρει. Ξετικάρετέ το για να κρατήσετε τα μεταδεδομένα ως έχουν.',
  'step2.seedHint':
    'Ο ίδιος σπόρος δίνει πάντα ακριβώς τα ίδια φυλλάδια — αυτό χρειάζεστε αν '
    + 'πρέπει να ξανατυπώσετε κάποιο αργότερα. Ο σπόρος που χρησιμοποιήθηκε '
    + 'εμφανίζεται μαζί με τα αποτελέσματα.',

  // -- step 3 ------------------------------------------------------------
  'step3.title': 'Φτιάξτε τα φυλλάδια',
  'step3.caution': 'Διαβάστε ό,τι βγαίνει πριν φτάσει σε μαθητή.',
  'step3.caution.detail':
    'Αντιπαραβάλετε ένα φυλλάδιο με τις απαντήσεις του και ελέγξτε ότι οι '
    + 'εξισώσεις φαίνονται σωστά στο Word.',
  'step3.generate': 'Δημιουργία παραλλαγών',
  'step3.download': 'Κατεβάστε το papers.zip',

  // -- what the page says while it works ---------------------------------
  'status.reading': 'Ανάγνωση…',
  'status.source': '{count} ερωτήσεις, επιλογές με δείκτες {markers}',
  'status.source.titled':
    '{title} — {count} ερωτήσεις, επιλογές με δείκτες {markers}',
  'status.haskey':
    'Βρέθηκαν απαντήσεις: κάθε παραλλαγή παίρνει αντίτυπο μαθητή και αντίτυπο '
    + 'καθηγητή.',
  'status.failed': 'Το έγγραφο δεν μπόρεσε να διαβαστεί.',
  'status.building': 'Δημιουργία των φυλλαδίων…',
  'status.ready':
    '{variants} παραλλαγές έτοιμες: {papers} έγγραφα. Μοιράστε τα αντίτυπα '
    + 'μαθητή· τα αντίτυπα καθηγητή έχουν τις απαντήσεις.',
  'status.ready.nokey':
    '{variants} παραλλαγές έτοιμες: {papers} αντίτυπα μαθητή. Δεν υπάρχουν '
    + 'αντίτυπα καθηγητή, επειδή το διαγώνισμα δεν είχε φύλλο απαντήσεων.',
  'status.nokey':
    'Χωρίς σελίδα απαντήσεων: μόνο αντίτυπα μαθητή, ένα ανά παραλλαγή, και '
    + 'καμία απάντηση για να μοιραστεί κατά λάθος.',
  'status.warning':
    'Προσοχή: το έγγραφο περιέχει {what}, που είναι μέρος του αρχείου και θα '
    + 'μεταφερθούν στα φυλλάδια. Αν δεν πρέπει να τα δει η τάξη, αφαιρέστε τα '
    + 'πρώτα από το Word (καρτέλα «Αναθεώρηση»).',
  'warning.comments': 'σχόλια',
  'warning.tracked': 'καταγεγραμμένες αλλαγές',
  'warning.and': 'και',
  'results.variant': 'Παραλλαγή',
  'results.files': 'Αρχεία',
  'results.key': 'Απαντήσεις',
  'results.nokey': 'δεν υπάρχουν στο έγγραφο',
  'results.seed':
    'Σπόρος {seed} — γράψτε τον στο πεδίο «Σπόρος» για να ξαναφτιάξετε ακριβώς '
    + 'αυτά τα φυλλάδια.',
  'download.button': 'Κατεβάστε το {name} ({papers} έγγραφα)',

  // -- footer ------------------------------------------------------------
  'footer.equations':
    'Οι εξισώσεις που γράφτηκαν με τον επεξεργαστή εξισώσεων του Word μένουν '
    + 'ανέπαφες: κάθε εκφώνηση και κάθε επιλογή μεταφέρεται ως η ίδια η '
    + 'σήμανση της παραγράφου από το έγγραφό σας, και το μόνο που ξαναγράφεται '
    + 'είναι ο δείκτης μπροστά της.',
  'footer.disclaimer':
    'Παρέχεται ως έχει, χωρίς καμία εγγύηση· δεν αναλαμβάνεται καμία ευθύνη για '
    + 'τα αποτελέσματά του ή για οτιδήποτε προκύψει από τη χρήση του.',
  'footer.full': 'Ολόκληρη η δήλωση',
  'footer.source': 'Πηγαίος κώδικας',
  'footer.licence': 'Άδεια MIT',

  // -- what this program writes into a document --------------------------
  'paper.banner': 'Παραλλαγή {index} — Αντίτυπο καθηγητή (με τις απαντήσεις)',
  'paper.key': 'Απαντήσεις',

  // -- errors ------------------------------------------------------------
  'error.not-a-docx': 'δεν είναι έγγραφο Word: δεν περιέχει word/document.xml',
  'error.unreadable': 'δεν ήταν δυνατή η ανάγνωση του {source}: {detail}',
  'error.no-questions': 'δεν βρέθηκαν ερωτήσεις στο {source}',
  'error.too-few-options': 'η ερώτηση {number} έχει {count} επιλογή/ές',
  'error.duplicate-markers':
    'η ερώτηση {number} έχει διπλούς δείκτες επιλογών: {markers}',
  'error.no-key-entry': 'δεν υπάρχει απάντηση για την ερώτηση {number}',
  'error.key-not-an-option':
    'η απάντηση της ερώτησης {number} είναι {answer}, που δεν είναι καμία από '
    + 'τις {markers}',
  'error.count-too-small': 'οι παραλλαγές πρέπει να είναι τουλάχιστον 1',
  'error.sample': 'δεν ήταν δυνατή η φόρτωση του δείγματος ({name})',
  'error.not-an-archive':
    'το αρχείο αυτό δεν είναι έγγραφο Word (δεν είναι καν αρχείο ZIP)',
  'error.too-large': 'το αρχείο είναι μεγαλύτερο από {limit} MB',
  'error.unpacks-too-large':
    'το {name} αποσυμπιέζεται σε περισσότερα από όσα αντέχει η σελίδα',
  'error.zip64': 'τα αρχεία zip64 δεν υποστηρίζονται',
  'error.encrypted': 'το {name} είναι κρυπτογραφημένο',
  'error.unsupported-method':
    'το {name} χρησιμοποιεί μη υποστηριζόμενη μέθοδο συμπίεσης {method}',
  'error.corrupt': 'το {name} είναι κατεστραμμένο (ασυμφωνία αθροίσματος ελέγχου)',
  'error.corrupt-directory': 'κατεστραμμένος κατάλογος αρχείων στην εγγραφή {index}',
  'error.corrupt-header': 'κατεστραμμένη τοπική κεφαλίδα για το {name}',
  'error.not-well-formed': 'μη έγκυρο XML: {detail}',
  'error.no-body': 'το word/document.xml δεν έχει <w:body>',
  'error.lost-answer': 'η ερώτηση {number} έχασε την απάντησή της κατά την ανακατανομή',
};

export const STRINGS: Record<Lang, Record<string, string>> = { en: EN, el: EL };

/** Substitute {name} placeholders. A missing parameter is left visible. */
export function format(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (
    name in params ? String(params[name]) : whole
  ));
}

export function t(lang: Lang, key: string, params: Params = {}): string {
  const template = STRINGS[lang][key] ?? STRINGS[DEFAULT_LANG][key] ?? key;
  return format(template, params);
}

/**
 * Which language to open in: ?lang= if somebody was sent a link, otherwise
 * the browser's own preference, otherwise English.
 *
 * Nothing is remembered between visits, here as everywhere else on this page.
 * A link with ?lang=el is how a Greek page gets passed on.
 */
export function detectLanguage(
  search = globalThis.location?.search ?? '',
  languages: readonly string[] = globalThis.navigator?.languages ?? [],
): Lang {
  const asked = new URLSearchParams(search).get('lang');
  if (asked && (LANGS as readonly string[]).includes(asked)) {
    return asked as Lang;
  }
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if ((LANGS as readonly string[]).includes(base)) {
      return base as Lang;
    }
  }
  return DEFAULT_LANG;
}
