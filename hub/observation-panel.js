/*
 * Stage 3C, Registrar Observation Protocol (HUMAN decision and approved copy), unchanged; moved out of index.html in Stage 3H.
 * Two voices: the Registrar asks, the personal record holds Dan's own note. hub.js puts this markup into the page only
 * when statistics are available (analytics.js), and shows it only while no choice has been made (or from OBSERVATION
 * PREFERENCES). While statistics are switched off it is not part of the document at all, for people, assistive technology
 * and search engines alike. The choice never changes the visitor's access.
 */
window.CATHEDRAL_OBSERVATION = {
  panel: `
    <section class="observation" id="observation" aria-labelledby="observation-title" hidden>
      <div class="observation-registrar">
        <p class="observation-label" id="observation-title">REGISTRAR · OBSERVATION PROTOCOL</p>
        <div class="observation-text" id="observation-text">
          <p>Visitor.</p>
          <p>The system requests authorization to record your passage through this terminal.</p>
          <p>Your decision will not affect your access.</p>
          <p>Awaiting HUMAN authorization.</p>
        </div>
        <div class="observation-text observation-response" id="observation-response" hidden></div>
      </div>
      <article class="obs-record">
        <h3 class="rec-heading">
          <button type="button" class="obs-toggle" id="observation-note-toggle" aria-expanded="false" aria-controls="observation-note">
            <span class="rec-line"><span class="rec-id">PERSONAL MESSAGE</span><span class="rec-sep" aria-hidden="true"> · </span><span class="rec-title">FROM THE CREATOR</span></span>
            <span class="rec-sub">A note from the human behind the terminal</span>
            <span class="rec-state" aria-hidden="true"></span>
          </button>
        </h3>
        <div class="rec-body" id="observation-note" role="region" aria-labelledby="observation-note-toggle" hidden>
          <div class="rec-body-inner">
            <p>Hi, I'm Dan.</p>
            <p>I wrote a little statistics script for this website because I thought it would be fun to build.</p>
            <p>And I just think it's fun to see what people click on. Which pages they visit, which records they open, and how long they stick around.</p>
            <p>That's really it.</p>
            <p>There's no advertising company behind this. No marketing profiles. It's my own experiment, using Google Apps Script and a spreadsheet to collect the results.</p>
            <p>If you're happy to let me see how people use the site, click YES.</p>
            <p>If not, click NO. You still get the exact same website.</p>
            <p>Thanks for visiting!</p>
            <p>— Dan</p>
          </div>
        </div>
      </article>
      <div class="observation-actions">
      <div class="observation-choices" role="group" aria-labelledby="observation-title">
        <button type="button" class="welcome-action welcome-action-primary observation-choice" data-observation="yes" aria-pressed="false">YES · ALLOW STATS</button>
        <button type="button" class="welcome-action welcome-action-primary observation-choice" data-observation="no" aria-pressed="false">NO · THANKS</button>
      </div>
      <p class="observation-current" id="observation-current" hidden></p>
      <div class="observation-foot">
        <a class="observation-privacy" href="privacy/">WHAT GETS RECORDED? · PRIVACY DETAILS</a>
        <button type="button" class="observation-close" hidden>Close</button>
      </div>
      </div>
    </section>
`,
  preferences: `<button type="button" class="observation-preferences" id="observation-preferences" hidden>OBSERVATION PREFERENCES</button>`
};
