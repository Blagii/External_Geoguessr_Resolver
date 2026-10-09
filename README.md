# 🌍 External GeoGuessr Resolver (Steam + Browser + Android Flutter App)

Kompletan sistem koji ti omogućava da **igraš GeoGuessr na kompjuteru** (bilo preko **Steam verzije** ili u **web pretraživaču**), dok na **Android telefonu u posebnoj Flutter aplikaciji** u realnom vremenu gledaš tačnu lokaciju trenutne runde (interaktivna mapa sa pinom, država, regija, okrug, grad, ulica, poštanski broj i tačne koordinate).

Na ekranu kompjutera se **ništa ne prikazuje** u toku igre, pa ekran izgleda potpuno čisto (npr. tokom deljenja ekrana na Discord-u).

---

## 📁 Struktura projekta

| Folder / Fajl | Opis |
| :--- | :--- |
| **[`flutter_app/`](flutter_app/)** | **Android Flutter aplikacija** — prikazuje interaktivnu mapu (`flutter_map` + OpenStreetMap) i detalje o lokaciji u realnom vremenu bez otvaranja pretraživača. |
| **[`Steam_Resolver/`](Steam_Resolver/)** | **Skripta za Steam verziju GeoGuessr-a** — hvata Street View koordinate direktno iz Steam igre na Windows-u i šalje ih na Android aplikaciju. |
| **[`Extension/Extension.js`](Extension/Extension.js)** | **Tampermonkey skripta za Browser verziju** — hvata koordinate dok igraš na `geoguessr.com` u pretraživaču (Chrome, Edge, Brave, Opera, Firefox). |
| **[`Server/server.py`](Server/server.py)** | **FastAPI WebSocket server** — opcioni lokalni server ako želiš da sve radi u tvojoj lokalnoj Wi-Fi mreži bez zavisnosti od eksternog servera. |
| **[`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml)** | **GitHub Actions workflow** — automatski kompajlira Flutter kod u instalacioni `.apk` fajl za Android direktno na GitHub-u. |
| **[`frontend/`](frontend/)** | Originalni Next.js web interfejs (opciono, zamenjen Flutter aplikacijom). |

---

## 📱 DEO 1: Instalacija Android Flutter aplikacije

Aplikaciju za Android telefon možeš preuzeti već skompajliranu preko GitHub-a (bez instaliranja ikakvih alata na kompjuteru) ili je sam napraviti pomoću Flutter-a.

### Opcija A: Preuzimanje `.apk` fajla direktno sa GitHub-a (Najlakše)

1. Otvori svoj repozitorijum na GitHub-u i klikni na tab **Actions** na vrhu stranice.
2. Ako prvi put otvaraš Actions na forkovanom repozitorijumu, klikni na zeleno dugme **"I understand my workflows, go ahead and enable them"**.
3. Sa leve strane izaberi workflow **Build Android APK**.
   - Build se pokreće automatski pri svakoj izmeni u `flutter_app/`, a možeš ga pokrenuti i ručno klikom na **Run workflow** $\rightarrow$ **Run workflow**.
4. Sačekaj 2–3 minuta dok build ne dobije zelenu kvačicu ✅.
5. Klikni na završeni build i na dnu stranice u sekciji **Artifacts** klikni na **`GeoResolver-Android-APK`**.
6. Preuzeće ti se `.zip` arhiva — raspakuj je i unutra ćeš dobiti **`app-release.apk`**.
7. Prebaci `app-release.apk` na svoj Android telefon i instaliraj aplikaciju.

### Opcija B: Ručno pravljenje `.apk` fajla na kompjuteru (pomoću Flutter SDK-a)

Ako na kompjuteru imaš instaliran Flutter SDK:

```bash
cd flutter_app

# 1. Generiši Android sistemske fajlove
flutter create . --platforms=android --org com.georesolver

# 2. Preuzmi zavisnosti
flutter pub get

# 3. Napravi release APK
flutter build apk --release
```
> **Napomena za ručni build:** U fajlu `flutter_app/android/app/src/main/AndroidManifest.xml` proveri da li iznad `<application>` stoji `<uses-permission android:name="android.permission.INTERNET"/>` i unutar `<application>` atribut `android:usesCleartextTraffic="true"` (GitHub Actions workflow ovo dodaje automatski).

### Kako se koristi Android aplikacija:
1. Otvori instaliranu aplikaciju **GeoGuessr Live Viewer** na telefonu.
2. U polju **User ID Token** je već unapred podešen podrazumevani kod:
   ```text
   11111111-1111-4111-8111-111111111111
   ```
   *(Ako koristiš stariju verziju APK-a gde polje nije popunjeno, samo nalepi taj kod jednom — aplikacija ga trajno pamti).*
3. Klikni na zeleno dugme **Connect**.
4. Na ekranu će pisati **"Waiting for game info"** sve dok na kompjuteru ne uđeš u rundu. Čim runda počne, pojaviće se mapa sa tačnim pinom i svi podaci o lokaciji (država, regija, grad, ulica, poštanski broj).

---

## 🎮 DEO 2: Igranje preko STEAM verzije GeoGuessr-a (`Steam_Resolver`)

Pošto Steam verzija GeoGuessr-a radi kao posebna desktop aplikacija (a ne u pretraživaču), koristi se skripta iz foldera **[`Steam_Resolver/`](Steam_Resolver/)**.

### Preduslov:
* Na kompjuteru moraš imati instaliran **Python** ([python.org/downloads](https://www.python.org/downloads/)).
* Prilikom instalacije Python-a obavezno štikliraj opciju **"Add Python to PATH"** na dnu prozora.

### Korak 1: Prva instalacija (radi se samo jednom)
1. Preuzmi repozitorijum (ili folder `Steam_Resolver`) na svoj kompjuter.
2. Otvori folder `Steam_Resolver` i dvoklikni na **`1_INSTALL_FIRST_TIME.bat`**.
3. Skripta će uraditi 3 stvari:
   - Instaliraće `mitmproxy` biblioteku.
   - Generisaće lokalni SSL sertifikat.
   - Otvoriće Windows prozor koji pita da li želiš da dodaš sertifikat u Trusted Root — klikni **Yes (Da)**.

### Korak 2: Pokretanje pre igranja na Steam-u (svaki put kad igraš)
1. Otvori folder `Steam_Resolver` i dvoklikni na **`2_START_STEAM_RESOLVER.bat`**.
2. Otvoriće se crni prozor sa porukom:
   ```text
   ==========================================================
     GeoGuessr Steam Edition Resolver je AKTIVAN!
     User ID (na telefonu): 11111111-1111-4111-8111-111111111111
   ==========================================================
   ```
3. Ostavi taj prozor uključen u pozadini i pokreni **GeoGuessr na Steam-u**.
4. Na Android telefonu u aplikaciji klikni **Connect**.
5. Čim uđeš u rundu (Solo, Duels, Party...), u prozoru na kompjuteru će se ispisati:
   ```text
   [+] Lokacija pronadjena (StreetView RPC): 50.450175, 30.524103 -> Slanje na telefon...
   [OK] Poslato na Android aplikaciju! (50.450175, 30.524103)
   ```
   A na tvom telefonu će se istog trenutka pomeriti mapa na tu lokaciju i ispisati država, grad i ulica!

### Korak 3: Završetak igranja
* Kada završiš sa igranjem, samo zatvori crni prozor (`X` ili `Ctrl + C`).
* Skripta [`Steam_Resolver/run.py`](Steam_Resolver/run.py) ima ugrađen automatski čistač (watchdog) koji sam gasi lokalni Windows proxy čim se prozor zatvori.
* U slučaju da nekad ručno želiš da proveriš da li je proxy ugašen, možeš dvokliknuti na **`3_STOP_PROXY.bat`**.

---

## 🌐 DEO 3: Igranje u Web Pretraživaču na kompjuteru (`Extension/Extension.js`)

Ako GeoGuessr igraš u pretraživaču na `https://www.geoguessr.com`, ne moraš da pokrećeš `Steam_Resolver`, već koristiš **Tampermonkey** skriptu.

### Korak 1: Instaliraj i podesi Tampermonkey u browseru
1. Instaliraj **Tampermonkey** ekstenziju za svoj browser ([tampermonkey.net](https://www.tampermonkey.net/)).
2. **Obavezno za Chrome, Edge, Brave i Opera (Manifest V3):**
   - Otvori `chrome://extensions` (ili `edge://extensions` / `brave://extensions`).
   - U **gornjem desnom uglu** uključi **Developer mode** (Režim za programere).
   - Pronađi **Tampermonkey**, klikni na **Details** (Detalji) i uključi **Allow User Scripts** (Dozvoli korisničke skripte).

### Korak 2: Ubaci skriptu
1. Klikni na ikonicu **Tampermonkey** u browseru $\rightarrow$ **Create a new script...**
2. Obriši sve što piše u editoru i nalepi ceo sadržaj fajla **[`Extension/Extension.js`](Extension/Extension.js)**.
3. Pritisni **`Ctrl + S`** (ili **File $\rightarrow$ Save**) da sačuvaš skriptu.
4. Otvori ili osveži (`F5`) stranicu **[https://www.geoguessr.com](https://www.geoguessr.com)**.
5. Skripta automatski koristi isti podrazumevani ID (`11111111-1111-4111-8111-111111111111`) kao i Android aplikacija — samo na telefonu klikni **Connect** i igraj!

---

## 🖥️ DEO 4: Opciono — Korišćenje sopstvenog lokalnog servera (`Server/server.py`)

Podrazumevano, i Steam skripta i Browser skripta i Android aplikacija komuniciraju preko javnog servera (`georesolver.0x978.com`).
Međutim, ako taj javni server ikada bude nedostupan ili želiš da sve radi 100% lokalno u tvojoj kući (PC i Android na istom Wi-Fi-ju):

1. **Pokreni lokalni server na kompjuteru:**
   ```bash
   cd Server
   pip install fastapi uvicorn requests websockets
   python server.py
   ```
   *(Server će se pokrenuti na portu `8000`, a `Steam_Resolver` već automatski šalje koordinate i na `http://127.0.0.1:8000/coords`!).*

2. **Saznaj lokalnu IP adresu svog kompjutera:**
   - Otvori Command Prompt (`cmd`) i ukucaj `ipconfig`.
   - Pogledaj stavku **IPv4 Address** (npr. `192.168.1.15`).

3. **Poveži se iz Android aplikacije na svoj kompjuter:**
   - Na početnom ekranu Android aplikacije klikni na **"Podesi sopstveni / lokalni server (opciono)"**.
   - Upiši IP adresu svog kompjutera i port, npr.:
     ```text
     192.168.1.15:8000
     ```
   - Klikni **Connect**.

---

## 🛠️ Rešavanje čestih problema (Troubleshooting)

| Problem | Rešenje |
| :--- | :--- |
| **U Steam Resolveru piše `<urlopen error timed out>`** | Koristiš staru verziju `steam_resolver.py`. Preuzmi najnoviji [`Steam_Resolver/steam_resolver.py`](Steam_Resolver/steam_resolver.py) koji ima `DIRECT_OPENER` (`ProxyHandler({})`) i zaobilazi lokalni proxy. |
| **Steam GeoGuessr kaže da nema internet konekciju dok radi `Steam_Resolver`** | Nisi pokrenuo **`1_INSTALL_FIRST_TIME.bat`** ili nisi kliknuo **Yes** kada je Windows pitao za instalaciju `mitmproxy` sertifikata. Pokreni `1_INSTALL_FIRST_TIME.bat` ponovo. |
| **Zatvorio sam `Steam_Resolver` a u browseru ne radi internet** | Pokreni **`Steam_Resolver/3_STOP_PROXY.bat`** koji jednim klikom vraća Windows Proxy na isključeno (`0`). |
| **Na telefonu stoji `Waiting for game info` i kad počne runda** | Proveri da li je u Android aplikaciji unet tačno ID `11111111-1111-4111-8111-111111111111`. Ako igraš u browseru, proveri da li je uključen **Developer mode** u `chrome://extensions` i osveži GeoGuessr stranicu (`F5`). |
| **Kako da promenim User ID ako više ljudi koristi u isto vreme?** | Promeni konstantu `USER_ID` u [`Steam_Resolver/steam_resolver.py`](Steam_Resolver/steam_resolver.py) (ili `userId` u [`Extension/Extension.js`](Extension/Extension.js)) u bilo koji drugi UUID (npr. `22222222-2222-4222-8222-222222222222`) i taj isti kod unesi u aplikaciju na telefonu. |
