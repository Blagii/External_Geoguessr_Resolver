# GeoGuessr Live Viewer — Flutter Android Aplikacija

Ova Flutter aplikacija zamenjuje web pretraživač na Android telefonu. Prikazuje interaktivnu mapu i sve detalje o lokaciji (država, regija, grad, ulica, poštanski broj) u realnom vremenu dok igraš GeoGuessr na kompjuteru.

---

## Opcija A: Pravljenje `.apk` fajla direktno preko GitHub-a (Bez instaliranja Flutter-a)

U repozitorijumu je podešen GitHub Actions workflow ([`.github/workflows/build-apk.yml`](../.github/workflows/build-apk.yml)) koji sam kompajlira Android aplikaciju na GitHub serverima:

1. Push-uj ove izmene na svoj GitHub repozitorijum (ili spoji Pull Request).
2. Otvori svoj repozitorijum na GitHub-u i klikni na tab **Actions** (na vrhu stranice).
3. Sa leve strane izaberi **Build Android APK**.
   - Workflow se automatski pokreće pri svakom push-u, ili možeš ručno kliknuti na dugme **Run workflow** $\rightarrow$ **Run workflow**.
4. Sačekaj 2–3 minuta da se build završi (zeleni znak ✅).
5. Klikni na završeni workflow run i na dnu stranice u sekciji **Artifacts** klikni na **`GeoResolver-Android-APK`**.
6. Preuzeće ti se `.zip` fajl u kom se nalazi **`app-release.apk`** — prebaci ga na Android telefon i instaliraj!

---

## Opcija B: Lokalno pravljenje `.apk` fajla na kompjuteru

Preuzmi ovaj repozitorijum na kompjuter na kom imaš instaliran **Flutter SDK** i pokreni sledeće komande u terminalu:

```bash
cd flutter_app

# 1. Generiši Android platform fajlove u ovom folderu (neće pregaziti lib/ ni pubspec.yaml)
flutter create . --platforms=android

# 2. Preuzmi pakete
flutter pub get
```

### Dodaj Internet dozvolu za Android
Otvori fajl `flutter_app/android/app/src/main/AndroidManifest.xml` i odmah iznad `<application ...>` dodaj:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

Takođe, u `<application ...>` tag dodaj `android:usesCleartextTraffic="true"` (kako bi aplikacija mogla da se poveže i na lokalni `ws://` server ako ga pokrećeš sa svog kompjutera):

```xml
<application
    android:label="GeoResolver"
    android:name="${applicationName}"
    android:icon="@mipmap/ic_launcher"
    android:usesCleartextTraffic="true">
```

### Pokreni na telefonu ili napravi APK:
* **Direktno instaliranje preko USB kabla:**
  ```bash
  flutter run --release
  ```
* **Ili napravi `.apk` fajl koji možeš prebaciti na telefon:**
  ```bash
  flutter build apk --release
  ```
  APK fajl će se nalaziti u:
  `flutter_app/build/app/outputs/flutter-apk/app-release.apk`

---

## 2. Kako se koristi (PC + Android aplikacija)

### Na kompjuteru (gde igraš GeoGuessr):
1. U browseru instaliraj **Tampermonkey** ekstenziju.
2. Napravi novu skriptu u Tampermonkey-u i nalepi kod iz [`../Extension/Extension.js`](../Extension/Extension.js) pa sačuvaj (`Ctrl + S`).
3. Otvori [https://www.geoguessr.com](https://www.geoguessr.com) i pritisni **`F9`** na tastaturi da vidiš svoj **User ID (UUID)**.

### Na Android telefonu (u Flutter aplikaciji):
1. Otvori **GeoGuessr Live Viewer** aplikaciju.
2. Unesi svoj **User ID Token** (aplikacija ga automatski pamti, pa ga unosiš samo prvi put).
3. Klikni **Connect**.
4. Čim krene runda na kompjuteru, mapa u aplikaciji se automatski pomera na tačnu lokaciju i ispisuju se država, grad, ulica i koordinate!

---

## 3. Opciono: Korišćenje tvog lokalnog servera na kompjuteru

Ako ne želiš da koristiš javni server (`wss://georesolver.0x978.com/ws`), možeš pokrenuti server na svom PC-ju:

1. Saznaj lokalnu IP adresu kompjutera (`ipconfig` u CMD-u, npr. `192.168.1.15`).
2. U `Extension/Extension.js` promeni liniju 34 u:
   ```javascript
   cleanFetch.fetch("http://192.168.1.15:8000/coords", {
   ```
3. Pokreni Python server na kompjuteru:
   ```bash
   cd Server
   pip install fastapi uvicorn requests websockets
   python server.py
   ```
4. U Flutter aplikaciji na početnom ekranu klikni na **"Podesi sopstveni / lokalni server (opciono)"** i upiši IP adresu svog kompjutera (npr. `192.168.1.15:8000`), pa klikni **Connect**.
