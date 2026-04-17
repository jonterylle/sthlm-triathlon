# Projektkontext – NewInventions

Den här filen hjälper Claude att snabbt komma in i projektet i varje ny session.
**Läs alltid den här filen först innan du börjar arbeta.**

---

## Om projektet

Vi bygger en **funktionärsapplikation för triathlon-tävlingar**. Jonas är tävlingsledare och behöver ett verktyg för att organisera och koordinera funktionärsarbetet inför, under och efter tävlingen.

Tävlingen innehåller tre grenar: **simning, cykling och löpning**.

Antal funktionärer: **70–80 personer**.

---

## Applikationstyp

- **Mobilanpassad webbapp** (mobile-first, körs i webbläsaren)
- Ska fungera smidigt på mobiltelefon för samtliga funktionärer
- Används före, under och efter tävlingen

---

## Funktioner att bygga

- [ ] Hantera funktionärer (namn, kontaktinfo, roll, pass, nödkontakt, t-shirt, mat)
- [ ] Dynamiska sektioner — tävlingsledare kan skapa/redigera/ta bort sektioner
- [ ] Tvärsektionella sektioner (t.ex. Sjukvård som spänner över hela tävlingen)
- [ ] Schemavy med Gantt-tidslinje per sektionsledare och tävlingsledare
- [ ] Automatisk konfliktdetektering vid överlappande uppdrag
- [ ] Konfliktgodkännande med kommentar (sektionsledare/tävlingsledare)
- [ ] Excel-import med kolumnmappning
- [ ] Funktionärsvy (mobilanpassad) — eget schema, roll, plats, kontakt
- [ ] Inloggning via engångslänk (magic link) till e-post
- [ ] Fyra behörighetsnivåer: Tävlingsledare, Sektionsledare, Funktionär, Läsare

## Sektioner (dynamiska, konfigurerbara av tävlingsledare)

Planerade sektioner för STHLM Triathlon 2026:
- 🏊 Simning
- 🔄 Växling 1 (sim → cykel)
- 🚴 Cykling
- 🔁 Växling 2 (cykel → löpning)
- 🏃 Löpning
- 🏥 Sjukvård (tvärsektionell — spänner över hela tävlingen)
- ⚡ Generellt

Sektioner är helt dynamiska — tävlingsledaren skapar dem i appen.

---

## Tekniska val

- **GitHub-repo:** https://github.com/jonterylle/sthlm-triathlon
- **Lokal mapp:** `C:\Users\JonasR\.claude\projects\NewInventions`
- Teknikstack: *ännu inte bestämd – diskutera med Jonas*

---

## Arbetssätt

- All kod sparas i den kopplade mappen och pushas till GitHub
- Jonas kör Claude via Cowork (desktop-app)
- Uppdatera den här filen löpande när nya beslut tas eller funktioner läggs till
- **OBS:** Claude kan inte pusha till GitHub direkt (nätverksbegränsning). Jonas kör `git push origin main` från sin dator i terminalen efter varje session.
- Claude påminner alltid Jonas om att pusha i slutet av varje session.

---

*Senast uppdaterad: April 2026*
