# GeoGuessr Steam Edition Resolver (PC $\rightarrow$ Android App)

Pošto **Steam verzija GeoGuessr-a** ne radi u browseru (pa nema Tampermonkey ekstenzije), napravljena je posebna skripta u ovom folderu (`Steam_Resolver/`) koja na kompjuteru automatski hvata koordinate direktno iz **Steam igre** i šalje ih na tvoju **Android Flutter aplikaciju**.

---

## Kako se koristi (Samo 2 koraka):

### 1. Prvi put (samo jednom):
1. Preuzmi folder `Steam_Resolver` na svoj kompjuter (moraš imati instaliran [Python](https://www.python.org/downloads/)).
2. Dvoklikni na **`1_INSTALL_FIRST_TIME.bat`**.
3. Kada te Windows pita da li želiš da instaliraš lokalni sertifikat (`mitmproxy`), klikni **Yes (Da)**.

### 2. Svaki put kad igraš GeoGuessr na Steam-u:
1. Dvoklikni na **`2_START_STEAM_RESOLVER.bat`** (ostavi taj crni prozor uključen u pozadini).
2. Pokreni **GeoGuessr na Steam-u** na kompjuteru.
3. Na Android telefonu otvori **GeoGuessr Live Viewer** aplikaciju, unesi kod:
   `11111111-1111-4111-8111-111111111111`
   i klikni **Connect**.
4. Čim uđeš u partiju na Steam-u, telefon će odmah pokazati tačnu lokaciju na mapi, državu, grad i ulicu!
5. Kada završiš sa igranjem, samo zatvori crni prozor na kompjuteru (skripta sama automatski gasi lokalni proxy čim se prozor zatvori).
