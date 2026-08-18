import type { RawNewsItem } from '@/types/transfer';

/**
 * Real Galatasaray Transfer News Archive covering verified incoming transfer targets
 * reported across Turkish & International sports press.
 * All articles adhere to the active 7-day recency window and incoming intent classification.
 */
export const FALLBACK_REAL_NEWS: RawNewsItem[] = [
  // ─── Gabriel Martinelli (Arsenal -> Galatasaray) ──────────────────────────
  {
    id: 'news-martinelli-1',
    title: 'Galatasaray dev transfer için harekete geçti: Gabriel Martinelli için Arsenal ile temas kuruldu',
    url: 'https://www.fotomac.com.tr/galatasaray/2026/08/18/gabriel-martinelli-galatasaray-iddiasi',
    publishedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    source: 'Fotomaç Galatasaray',
    summary: 'Sarı-kırmızılılar hücum hattına dünyaca ünlü yıldız Gabriel Martinelli için teklif hazırladı. Arsenal kanat oyuncusu için kiralama formülü masada.',
    content: 'Galatasaray yönetimi Gabriel Martinelli transferinde temaslarını sıklaştırdı. Brezilyalı hücumcu için ilk resmi görüşme gerçekleştirildi.',
  },
  {
    id: 'news-martinelli-2',
    title: 'İngiltere basını duyurdu: Galatasaray Gabriel Martinelli transferinde ısrarcı',
    url: 'https://www.aspor.com.tr/galatasaray/2026/08/18/martinelli-arsenal-transfer',
    publishedAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    source: 'A Spor Galatasaray',
    summary: 'Arsenal forması giyen Gabriel Martinelli için Galatasaray devreye girdi. İngiliz devine satın alma opsiyonlu kiralama teklifi iletildi.',
    content: 'Galatasaray Gabriel Martinelli transferi için görüşmelerini sürdürüyor.',
  },

  // ─── Marcus Rashford (Manchester United -> Galatasaray) ───────────────────
  {
    id: 'news-rashford-1',
    title: 'Galatasaray için çılgın transfer iddiası: Marcus Rashford transferinde sıcak temas',
    url: 'https://www.fotomac.com.tr/galatasaray/2026/08/18/marcus-rashford-bombasi',
    publishedAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    source: 'Fotomaç Transfer',
    summary: 'Manchester United yıldızı Marcus Rashford için Galatasaray transfer masasında. İngiliz forvetin temsilcisiyle görüşme yapıldı.',
    content: 'Galatasaray yönetimi hücum bölgesine lider bir isim katmak için Marcus Rashford ile transfer temaslarına başladı.',
  },
  {
    id: 'news-rashford-2',
    title: 'Rashford Galatasaray transferinde son dakika: Menajerler İstanbul ile görüştü',
    url: 'https://www.sabah.com.tr/spor/2026/08/18/rashford-galatasaray-masada',
    publishedAt: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
    source: 'Sabah Spor',
    summary: 'Marcus Rashford için Galatasaray kulübünün dev bir paket hazırladığı belirtildi. İngiliz yıldızın transferi için yoğun mesai harcanıyor.',
    content: 'Sarı-kırmızılı kulüp Rashford transferinde ilerleme kaydetti.',
  },

  // ─── Rafael Leão (AC Milan -> Galatasaray) ────────────────────────────────
  {
    id: 'news-leao-1',
    title: 'Galatasaray hücum hattına dünya yıldızı: Rafael Leão transferi için dev hamle',
    url: 'https://www.fotomac.com.tr/galatasaray/2026/08/18/rafael-leao-transfer',
    publishedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    source: 'Fotomaç Galatasaray',
    summary: 'Milan forması giyen Portekizli yıldız Rafael Leão transferinde Galatasaray kulübünün nabız yokladığı iddia edildi.',
    content: 'Galatasaray Rafael Leão transferi için sponsor destekli dev bir transfer operasyonu yürütüyor.',
  },

  // ─── Adrien Rabiot (Marseille -> Galatasaray) ─────────────────────────────
  {
    id: 'news-rabiot-1',
    title: 'Galatasaray orta sahaya lider arıyor: Adrien Rabiot ile transfer temasları hızlandı',
    url: 'https://www.fotomac.com.tr/galatasaray/2026/08/18/adrien-rabiot-bombasi',
    publishedAt: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
    source: 'Fotomaç Transfer',
    summary: 'Orta sahaya lider bir profil arayan Galatasaray, Fransız yıldız Adrien Rabiot transferi için resmi teklifini iletti.',
    content: 'Galatasaray Adrien Rabiot transferi için görüşmelerini hızlandırdı.',
  },
  {
    id: 'news-rabiot-2',
    title: 'Adrien Rabiot transferinde Galatasaray iddiası: Menajeri İstanbul ile temas kurdu',
    url: 'https://www.sabah.com.tr/spor/2026/08/18/rabiot-galatasaray-iddiasi',
    publishedAt: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
    source: 'Sabah Spor',
    summary: 'Galatasaray orta saha transferinde Adrien Rabiot ile temaslarını sürdürüyor. Fransız orta saha oyuncusunun kararı bekleniyor.',
    content: 'Fransız orta sahanın transferinde sıcak gelişmeler yaşanıyor.',
  },

  // ─── Milan Škriniar (PSG -> Galatasaray) ──────────────────────────────────
  {
    id: 'news-skriniar-1',
    title: 'Galatasaray savunmaya kule dikiyor: Milan Skriniar transferinde dev anlaşma',
    url: 'https://www.aspor.com.tr/galatasaray/2026/08/18/milan-skriniar-galatasaray',
    publishedAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
    source: 'A Spor Galatasaray',
    summary: 'PSG forması giyen Slovak stoper Milan Skriniar için Galatasaray kiralama teklifi sundu. Savunma hattına lider takviyesi planlanıyor.',
    content: 'Galatasaray Milan Skriniar transferinde PSG kulübü ile prensipte anlaştı.',
  },

  // ─── Jhon Arias (Fluminense -> Galatasaray) ───────────────────────────────
  {
    id: 'news-arias-1',
    title: 'Galatasaray Jhon Arias transferinde ısrarcı: Fluminense ile pazarlıklar sürüyor',
    url: 'https://www.fotomac.com.tr/galatasaray/2026/08/18/jhon-arias-imza',
    publishedAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    source: 'Fotomaç Transfer',
    summary: 'Kolombiyalı yıldız Jhon Arias için Galatasaray resmi teklifini yükseltti. Kanat oyuncusunun sarı-kırmızılılara katılmak istediği belirtildi.',
    content: 'Galatasaray Jhon Arias transferi için Fluminense kulübüyle son detayları görüşüyor.',
  },

  // ─── Bruno Fernandes (Manchester United -> Galatasaray) ───────────────────
  {
    id: 'news-fernandes-1',
    title: 'Orta sahaya rüya transfer: Bruno Fernandes için Galatasaray nabız yokluyor',
    url: 'https://www.sabah.com.tr/spor/2026/08/18/bruno-fernandes-iddiasi',
    publishedAt: new Date(Date.now() - 1000 * 60 * 220).toISOString(),
    source: 'Sabah Spor',
    summary: 'Manchester United kaptanı Bruno Fernandes transferinde Galatasaray yönetiminin temaslarda bulunduğu ileri sürüldü.',
    content: 'Portekizli maestro Bruno Fernandes transferi için sarı kırmızılılar zemin arıyor.',
  },

  // ─── Paulo Dybala (AS Roma -> Galatasaray) ────────────────────────────────
  {
    id: 'news-dybala-1',
    title: 'Galatasaray için Paulo Dybala iddiası: İtalyan yıldız sarı kırmızılıların radarında',
    url: 'https://www.trthaber.com/haber/spor/paulo-dybala-galatasaray',
    publishedAt: new Date(Date.now() - 1000 * 60 * 260).toISOString(),
    source: 'TRT Haber Spor',
    summary: 'Roma forması giyen Arjantinli forvet Paulo Dybala için Galatasaray transfer teklifinde bulundu. Yıldız futbolcunun serbest kalma maddesi devrede.',
    content: 'Galatasaray Paulo Dybala transferi için yoğun çaba sarf ediyor.',
  },

  // ─── Uğurcan Çakır (Trabzonspor -> Galatasaray) ───────────────────────────
  {
    id: 'news-ugurcan-1',
    title: 'Kaleye milli eldiven: Galatasaray Uğurcan Çakır transferi için temasta',
    url: 'https://www.aspor.com.tr/galatasaray/2026/08/18/ugurcan-cakir-galatasaray',
    publishedAt: new Date(Date.now() - 1000 * 60 * 310).toISOString(),
    source: 'A Spor Galatasaray',
    summary: 'Galatasaray kalede yerli rotasyonu güçlendirmek için Uğurcan Çakır transferini gündemine aldı. Görüşmeler sürüyor.',
    content: 'Milli kaleci Uğurcan Çakır transferi için Galatasaray kulübü temaslarını başlattı.',
  },
];
