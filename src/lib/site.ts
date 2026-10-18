import orderTermsUrl from "@/assets/Regulamin zamówień.pdf?url";
import cookiesPolicyUrl from "@/assets/Polityka cookies.pdf?url";
import returnsPolicyUrl from "@/assets/REKLAMACJE I ZWROTY.pdf?url";
import privacyPolicyUrl from "@/assets/Polityka prywatności.pdf?url";

// Dane całej witryny. Pola oznaczone „Do uzupełnienia” czekają na prawdziwe dane
// od właściciela — nie wymyślamy telefonów, stref dostawy, cen ani linków.
export type OpeningHour = { day: string; hours: string };

export const openingHours: OpeningHour[] = [
  { day: "Poniedziałek", hours: "Zamknięte" },
  { day: "Wtorek", hours: "Zamknięte" },
  { day: "Środa", hours: "15:00–21:00" },
  { day: "Czwartek", hours: "15:00–21:00" },
  { day: "Piątek", hours: "15:00–22:00" },
  { day: "Sobota", hours: "12:00–22:00" },
  { day: "Niedziela", hours: "12:00–20:00" },
];

export type Platform = { name: string; url: string | null };

export const site = {
  name: "Wake Up House",
  addressLine1: "Parkowa 10",
  addressLine2: "36-060 Głogów Małopolski",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=Parkowa+10+36-060+G%C5%82og%C3%B3w+Ma%C5%82opolski",
  phone: "607 045 700",
  email: "bar@arkadiazone.pl",
  facebook: null as string | null,
  instagram: null as string | null,
  nip: "Do uzupełnienia — NIP i dane firmy.",
  platforms: [{ name: "Pyszne.pl", url: null }] as Platform[],
  legalDocuments: [
    { name: "Regulamin zamówień", url: orderTermsUrl },
    { name: "Polityka prywatności", url: privacyPolicyUrl },
    { name: "Polityka cookies", url: cookiesPolicyUrl },
    { name: "Reklamacje i zwroty", url: returnsPolicyUrl },
  ],
  deliveryShort:
    "Dowozimy na terenie Głogowa Małopolskiego, Bud Głogowskich, Wysokiej Głogowskiej i Rudnej Małej. Dostawa orientacyjnie 0,20 zł za kilometr trasy drogowej. Minimalna wartość zamówienia: 50 zł.",
  delivery: {
    area: "Głogów Małopolski, Budy Głogowskie, Wysoka Głogowska i Rudna Mała.",
    zones:
      "Orientacyjnie 0,20 zł za każdy kilometr trasy samochodowej od lokalu (nie odległości w linii prostej). Stawka i opłata za opakowanie 0,25 zł wymagają potwierdzenia.",
    ratePerKmPLN: 0.2,
    originCoordinates: { latitude: 50.1531905, longitude: 21.9547502 },
    minOrder: "50 zł.",
    hours: "Do uzupełnienia — godziny, w których dowozimy.",
    pickup: "Odbiór na miejscu: Parkowa 10, 36-060 Głogów Małopolski. Szczegóły do uzupełnienia.",
    time: "Do uzupełnienia — orientacyjny czas realizacji zamówienia.",
    payments: "Do uzupełnienia — dostępne formy płatności.",
  },
  about: [
    "Wake Up House to lokal przy Parkowej 10 w Głogowie Małopolski, gdzie zamawiasz burgery z wołowiny i chrupiącego fileta, pizzę na cieście z mozzarellą fior di latte, loaded fries i stripsy — wszystko przygotowywane na miejscu.",
    "Latem działa sezonowy ogródek, w którym można usiąść i zjeść na miejscu.",
    "Ten opis jest wstępny — dopracujemy go razem z Wami.",
  ],
};
