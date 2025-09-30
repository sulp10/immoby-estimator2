"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import CompetitorCard from "./components/CompetitorCard";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// --- Utility ---
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const monthsIT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

// Persist some fields locally (no secrets)
const useLocalStorage = <T,>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
};

// --- Types for AIRROI response (subset) ---
interface CompetitorListing {
  listing_info: {
    listing_id: number;
    listing_name: string;
    listing_type: string;
    room_type: string;
    cover_photo_url: string;
    photos_count: number;
  };
  host_info: {
    host_id: number;
    host_name: string;
    cohost_ids: number[];
    cohost_names: string[];
    superhost: boolean;
  };
  location_info: {
    latitude: number;
    longitude: number;
    country_code: string;
    country: string;
    region: string;
    locality: string;
    district: string;
  };
  property_details: {
    guests: number;
    bedrooms: number;
    beds: number;
    baths: number;
    registration: boolean;
    registration_details: string;
    amenities: string[];
  };
  booking_settings: {
    instant_book: boolean;
    min_nights: number;
    cancellation_policy: string;
  };
  pricing_info: {
    currency: string;
    cleaning_fee: number;
    extra_guest_fee: number;
  };
  ratings: {
    num_reviews: number;
    rating_overall: number;
    rating_accuracy: number;
    rating_checkin: number;
    rating_cleanliness: number;
    rating_communication: number;
    rating_location: number;
    rating_value: number;
  };
  performance_metrics: {
    ttm_revenue: number;
    ttm_avg_rate: number;
    ttm_occupancy: number;
    ttm_adjusted_occupancy: number;
    ttm_revpar: number;
    ttm_adjusted_revpar: number;
    ttm_total_days: number;
    ttm_available_days: number;
    ttm_blocked_days: number;
    ttm_days_reserved: number;
    l90d_revenue: number;
    l90d_avg_rate: number;
    l90d_occupancy: number;
    l90d_adjusted_occupancy: number;
    l90d_revpar: number;
    l90d_adjusted_revpar: number;
    l90d_total_days: number;
    l90d_available_days: number;
    l90d_blocked_days: number;
    l90d_days_reserved: number;
  };
}

interface AirRoiEstimate {
  occupancy?: number; // 0..1
  average_daily_rate?: number; // ADR
  monthly_revenue_distributions?: Array<number | null> | null; // 12 items
  comparable_listings?: CompetitorListing[] | null;
}

type TipoStruttura = "Appartamento" | "Affittacamere" | "B&B";
type StatoImmobile = "Ottimo" | "Buono" | "Discreto" | "Mediocre";

const stateFactorMap: Record<StatoImmobile, number> = {
  Ottimo: 1.1,
  Buono: 1,
  Discreto: 0.95,
  Mediocre: 0.5,
};

const typeFactorMap: Record<TipoStruttura, number> = {
  Appartamento: 1.3,
  Affittacamere: 2.2,
  "B&B": 2.2,
};

// Funzione per generare il PDF del report
const generatePDF = async (
  result: AirRoiEstimate,
  address: string,
  bedrooms: number,
  baths: number,
  guests: number,
  tipoStruttura: TipoStruttura,
  statoImmobile: StatoImmobile,
  currency: "native" | "usd"
) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const availableWidth = pageWidth - 40; // Available width for text (considering 20mm margins on each side)
  let yPosition = 20;

  // Helper functions
  const checkNewPage = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - 20) {
      pdf.addPage();
      yPosition = 20;
    }
  };

  const formatCurrency = (n?: number | null) => {
    if (typeof n !== "number") return "n/d";
    const isUSD = currency === "usd";
    const symbol = isUSD ? "$" : "€";
    return `${symbol}${n.toFixed(2)}`;
  };

  // Calculate annual gross yield exactly like in webapp
  const calculateAnnualGrossYield = () => {
    if (typeof result?.occupancy !== "number" || typeof result?.average_daily_rate !== "number") return null;
    const a = stateFactorMap[statoImmobile];
    const b = typeFactorMap[tipoStruttura];
    const value = 360 * result.occupancy * result.average_daily_rate * a * b;
    return value;
  };

  // Header with logo
  try {
    const headerImg = new Image();
    headerImg.src = '/Header_pdf.png';
    await new Promise((resolve, reject) => {
      headerImg.onload = resolve;
      headerImg.onerror = reject;
    });
    
    // Add header image
    const headerHeight = 25;
    const headerWidth = (headerImg.width * headerHeight) / headerImg.height;
    const headerX = (pageWidth - headerWidth) / 2;
    
    pdf.addImage(headerImg, 'PNG', headerX, yPosition, headerWidth, headerHeight);
    yPosition += headerHeight + 15;
  } catch (error) {
    // Fallback to text if image fails
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("Immoby - Report di Stima", pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
  }

  // Property Information Section
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(51, 51, 51);
  pdf.text("INFORMAZIONI PROPRIETÀ", 20, yPosition);
  yPosition += 12;

  // Property details in a clean layout
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(68, 68, 68);
  
  const propertyData = [
    ["Indirizzo:", address],
    ["Camere da letto:", bedrooms.toString()],
    ["Bagni:", baths.toString()],
    ["Ospiti:", guests.toString()],
    ["Tipo struttura:", tipoStruttura],
    ["Stato immobile:", statoImmobile]
  ];

  propertyData.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 25, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, 80, yPosition);
    yPosition += 7;
  });

  yPosition += 10;

  // Main Metrics Section
  checkNewPage(60);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(51, 51, 51);
  pdf.text("METRICHE PRINCIPALI", 20, yPosition);
  yPosition += 12;

  const occupancy = result.occupancy || 0;
  const adr = result.average_daily_rate || 0;
  const annualGrossYield = calculateAnnualGrossYield();

  // Metrics in boxes
  pdf.setFillColor(248, 249, 250);
  pdf.rect(20, yPosition, pageWidth - 40, 35, 'F');
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(68, 68, 68);
  pdf.text("Tasso di Occupazione:", 25, yPosition + 8);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${(occupancy * 100).toFixed(2)}%`, 25, yPosition + 16);

  pdf.setFont("helvetica", "bold");
  pdf.text("Tariffa Media Giornaliera:", 25, yPosition + 26);
  pdf.setFont("helvetica", "normal");
  pdf.text(formatCurrency(adr), 25, yPosition + 34);

  // Annual gross yield in red (highlighted)
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(220, 53, 69); // Red color like in webapp
  pdf.text("Rendimento Annuo Lordo:", 110, yPosition + 8);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(formatCurrency(annualGrossYield), 110, yPosition + 20);

  yPosition += 45;

  // Competitor Analysis Section
  if (result.comparable_listings && result.comparable_listings.length > 0) {
    checkNewPage(40);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(51, 51, 51);
    pdf.text("ANALISI COMPETITOR", 20, yPosition);
    yPosition += 15;

    const competitorsToShow = result.comparable_listings.slice(0, 10);
    
    for (let index = 0; index < competitorsToShow.length; index++) {
      const competitor = competitorsToShow[index];
      checkNewPage(85);
      
      // Competitor box with increased height for image below text and multi-line titles
      pdf.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 249, index % 2 === 0 ? 255 : 250);
      pdf.rect(20, yPosition, pageWidth - 40, 85, 'F');
      
      // Try to load competitor image for later positioning below text
      let imageData = null;
      if (competitor.listing_info.cover_photo_url) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = competitor.listing_info.cover_photo_url;
          
          await new Promise((resolve, reject) => {
            img.onload = () => {
              try {
                // Create a canvas to convert the image
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                
                imageData = canvas.toDataURL('image/jpeg', 0.7);
              } catch (error) {
                console.log(`Could not process image for competitor ${index + 1}`);
              }
              resolve(null);
            };
            img.onerror = () => resolve(null);
            
            // Timeout after 2 seconds
            setTimeout(() => resolve(null), 2000);
          });
        } catch (error) {
          console.log(`Could not load image for competitor ${index + 1}`);
        }
      }
      
      // Enhanced intelligent text wrapping function
      const wrapText = (text: string, maxWidth: number, fontSize: number, maxLines: number = 10, maxCharsPerLine: number = 45) => {
        pdf.setFontSize(fontSize);
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const testWidth = pdf.getTextWidth(testLine);
          
          // Check both width and character count constraints
          if (testWidth <= maxWidth && testLine.length <= maxCharsPerLine) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = word;
              
              // Check if we've reached max lines
              if (lines.length >= maxLines) {
                break;
              }
            } else {
              // Word is too long, truncate it more aggressively
              let truncatedWord = word;
              while ((pdf.getTextWidth(truncatedWord + "...") > maxWidth || truncatedWord.length > maxCharsPerLine - 3) && truncatedWord.length > 1) {
                truncatedWord = truncatedWord.substring(0, truncatedWord.length - 1);
              }
              lines.push(truncatedWord + "...");
              currentLine = '';
              
              // Check if we've reached max lines
              if (lines.length >= maxLines) {
                break;
              }
            }
          }
        }
        
        if (currentLine && lines.length < maxLines) {
          // Final check: ensure the last line fits both width and character constraints
          while ((pdf.getTextWidth(currentLine) > maxWidth || currentLine.length > maxCharsPerLine) && currentLine.length > 1) {
            currentLine = currentLine.substring(0, currentLine.length - 1) + "...";
          }
          lines.push(currentLine);
        }
        
        // Truncate to maxLines if necessary
        if (lines.length > maxLines) {
          lines.splice(maxLines);
          if (lines.length > 0) {
            let lastLine = lines[lines.length - 1];
            if (lastLine.length > 3) {
              lines[lines.length - 1] = lastLine.substring(0, lastLine.length - 3) + "...";
            }
          }
        }
        
        return lines;
      };
      
      // Function to convert text to sentence case (first letter uppercase, rest lowercase)
      const toSentenceCase = (text: string): string => {
        if (!text) return text;
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      };
      
      // Apply sentence case to the competitor title
      const nameText = toSentenceCase(competitor.listing_info.listing_name);
      
      // Try different font sizes to fit the content optimally with strict 2-line limit
      let titleFontSize = 10; // Start smaller
      let titleLines: string[] = [];
      
      // Find optimal font size (between 7 and 10) with strict line limit and character limit
      for (let fontSize = 10; fontSize >= 7; fontSize--) {
        titleLines = wrapText(nameText, availableWidth, fontSize, 2, 40); // Strict 2-line limit with 40 chars per line
        if (titleLines.length <= 2) {
          titleFontSize = fontSize;
          break;
        }
      }
      
      // Final safety check - ensure we never exceed 2 lines
      if (titleLines.length > 2) {
        titleLines = titleLines.slice(0, 2);
      }
      
      // Render title lines
      pdf.setFontSize(titleFontSize);
      let currentY = yPosition + 8;
      titleLines.forEach((line, lineIndex) => {
        pdf.text(line, 30, currentY);
        currentY += titleFontSize * 1.1; // Reduced line height
      });
      
      // Adjust yPosition based on title height
      const titleHeight = titleLines.length * titleFontSize * 1.2;
      let contentStartY = yPosition + Math.max(16, titleHeight + 4);
      
      // Property details with intelligent wrapping (max 2 lines)
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(68, 68, 68);
      
      const detailsText = `${competitor.listing_info.listing_type} • ${competitor.property_details.guests} ospiti • ${competitor.property_details.bedrooms} camere • ${competitor.property_details.baths} bagni`;
      const detailsLines = wrapText(detailsText, availableWidth, 8, 2, 50); // 50 chars per line for details
      
      detailsLines.forEach((line, index) => {
        pdf.text(line, 30, contentStartY + (index * 9));
      });
      
      let currentContentY = contentStartY + (detailsLines.length * 9);
      
      // Performance metrics with wrapping (max 2 lines)
      const metricsText = `Tariffa: ${formatCurrency(competitor.performance_metrics.ttm_avg_rate)} • Occupazione: ${((competitor.performance_metrics.ttm_occupancy || 0) * 100).toFixed(1)}% • Recensioni: ${competitor.ratings.num_reviews} (${competitor.ratings.rating_overall?.toFixed(1) || 'N/A'}/5)`;
      const metricsLines = wrapText(metricsText, availableWidth, 8, 2, 50); // 50 chars per line for metrics
      
      metricsLines.forEach((line, index) => {
        pdf.text(line, 30, currentContentY + (index * 9));
      });
      
      currentContentY += metricsLines.length * 9;
      
      // Amenities with wrapping (first 4 to save space, max 2 lines)
      if (competitor.property_details.amenities && competitor.property_details.amenities.length > 0) {
        const amenitiesText = `Servizi: ${competitor.property_details.amenities.slice(0, 4).join(', ')}${competitor.property_details.amenities.length > 4 ? '...' : ''}`;
        const amenitiesLines = wrapText(amenitiesText, availableWidth, 8, 2, 50); // 50 chars per line for amenities
        
        amenitiesLines.forEach((line, index) => {
          pdf.text(line, 30, currentContentY + (index * 9));
        });
        
        currentContentY += amenitiesLines.length * 9;
      }
      
      // Additional info line with wrapping (max 1 line)
      const additionalInfo = [];
      if (competitor.booking_settings.instant_book) additionalInfo.push("Prenotazione Istantanea");
      if (competitor.booking_settings.min_nights > 1) additionalInfo.push(`Min ${competitor.booking_settings.min_nights} notti`);
      if (competitor.property_details.registration) additionalInfo.push("Registrato");
      
      if (additionalInfo.length > 0) {
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        const additionalText = additionalInfo.join(' • ');
        const additionalLines = wrapText(additionalText, availableWidth, 7, 1, 60); // 60 chars per line for additional info (smaller font)
        
        additionalLines.forEach((line, index) => {
          pdf.text(line, 30, currentContentY + (index * 8));
        });
        
        currentContentY += additionalLines.length * 8;
      }
      
      // Add competitor image below all text content with page break check
      let imageHeight = 0;
      if (imageData) {
        try {
          const imgWidth = 35; // Slightly smaller
          const imgHeight = 26; // Slightly smaller
          const imgX = 30; // Align with text left margin
          const imgY = currentContentY + 6; // Position below all text content
          
          // Check if image would fit on current page
          if (imgY + imgHeight > pageHeight - 30) {
            // Image would be cut off, move to next page
            pdf.addPage();
            yPosition = 20;
            
            // Recalculate positions for new page
            currentY = yPosition + 8;
            titleLines.forEach((line, lineIndex) => {
              pdf.setFontSize(titleFontSize);
              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(51, 51, 51);
              pdf.text(line, 30, currentY);
              currentY += titleFontSize * 1.1;
            });
            
            const newTitleHeight = titleLines.length * titleFontSize * 1.1;
            let newContentStartY = yPosition + Math.max(16, newTitleHeight + 4);
            
            // Re-render all text content on new page
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(68, 68, 68);
            
            let newCurrentContentY = newContentStartY;
            
            // Re-render details
            detailsLines.forEach((line, index) => {
              pdf.text(line, 30, newCurrentContentY + (index * 9));
            });
            newCurrentContentY += detailsLines.length * 9;
            
            // Re-render metrics
            metricsLines.forEach((line, index) => {
              pdf.text(line, 30, newCurrentContentY + (index * 9));
            });
            newCurrentContentY += metricsLines.length * 9;
            
            // Re-render amenities if they exist
            if (competitor.property_details.amenities && competitor.property_details.amenities.length > 0) {
              const amenitiesText = `Servizi: ${competitor.property_details.amenities.slice(0, 4).join(', ')}${competitor.property_details.amenities.length > 4 ? '...' : ''}`;
              const amenitiesLines = wrapText(amenitiesText, availableWidth, 8, 2, 50); // 50 chars per line for amenities
              
              amenitiesLines.forEach((line, index) => {
                pdf.text(line, 30, newCurrentContentY + (index * 9));
              });
              newCurrentContentY += amenitiesLines.length * 9;
            }
            
            // Re-render additional info
            const additionalInfo = [];
            if (competitor.booking_settings.instant_book) additionalInfo.push("Prenotazione Istantanea");
            if (competitor.booking_settings.min_nights > 1) additionalInfo.push(`Min ${competitor.booking_settings.min_nights} notti`);
            if (competitor.property_details.registration) additionalInfo.push("Registrato");
            
            if (additionalInfo.length > 0) {
              pdf.setFontSize(7);
              pdf.setTextColor(100, 100, 100);
              const additionalText = additionalInfo.join(' • ');
              const additionalLines = wrapText(additionalText, availableWidth, 7, 1, 60); // 60 chars per line for additional info
              
              additionalLines.forEach((line, index) => {
                pdf.text(line, 30, newCurrentContentY + (index * 8));
              });
              newCurrentContentY += additionalLines.length * 8;
            }
            
            // Now add image on new page
            pdf.addImage(imageData, 'JPEG', imgX, newCurrentContentY + 6, imgWidth, imgHeight);
            imageHeight = imgHeight + 8;
            currentContentY = newCurrentContentY;
          } else {
            // Image fits on current page
            pdf.addImage(imageData, 'JPEG', imgX, imgY, imgWidth, imgHeight);
            imageHeight = imgHeight + 8;
          }
        } catch (error) {
          console.warn('Error adding competitor image:', error);
        }
      }
      
      // Calculate dynamic spacing for next competitor (more compact)
      const totalContentHeight = Math.max(titleHeight + (currentContentY - contentStartY) + imageHeight, 50);
      yPosition += totalContentHeight + 10;
    }
  }

  // Chart capture
  const chartElement = document.querySelector('.recharts-wrapper');
  if (chartElement) {
    try {
      checkNewPage(120);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(51, 51, 51);
      pdf.text("DISTRIBUZIONE RICAVI MENSILI", 20, yPosition);
      yPosition += 15;

      const canvas = await html2canvas(chartElement as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 40;
      const imgHeight = Math.min((canvas.height * imgWidth) / canvas.width, 100);
      
      pdf.addImage(imgData, 'PNG', 20, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 15;
    } catch (error) {
      console.error('Error capturing chart:', error);
    }
  }

  // Footer
  checkNewPage(20);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(128, 128, 128);
  const now = new Date();
  const footerText = `Report generato il ${now.toLocaleDateString('it-IT')} alle ${now.toLocaleTimeString('it-IT')} | Immoby Analytics Platform`;
  pdf.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save PDF with new naming format
  const today = new Date();
  const dateStr = today.toLocaleDateString('it-IT', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  }).replace(/\//g, '-');
  pdf.save(`Immoby ${dateStr}.pdf`);
};

export default function Page() {
  // Address → Geocode (server-side via /api/geocode)
  const [address, setAddress] = useLocalStorage<string>("addr", "");
  const [geocodeChoices, setGeocodeChoices] = useState<any[]>([]);
  const [chosenPlaceId, setChosenPlaceId] = useState<string>("");

  // Coordinates (from geocoding or manual)
  const [lat, setLat] = useLocalStorage<string>("lat", "");
  const [lng, setLng] = useLocalStorage<string>("lng", "");

  // Listing params
  const [bedrooms, setBedrooms] = useLocalStorage<number>("bedrooms", 2);
const [baths, setBaths] = useLocalStorage<number>("baths", 1.5);
const [guests, setGuests] = useLocalStorage<number>("guests", 4);
// Stati di input come stringhe per permettere campo vuoto durante l'editing
const [bedroomsInput, setBedroomsInput] = useState<string>(String(bedrooms));
const [bathsInput, setBathsInput] = useState<string>(String(baths));
const [guestsInput, setGuestsInput] = useState<string>(String(guests));
useEffect(() => { setBedroomsInput(String(bedrooms)); }, [bedrooms]);
useEffect(() => { setBathsInput(String(baths)); }, [baths]);
useEffect(() => { setGuestsInput(String(guests)); }, [guests]);

  const [currency, setCurrency] = useLocalStorage<"native" | "usd">("currency", "native");
  const [tipoStruttura, setTipoStruttura] = useLocalStorage<TipoStruttura>("tipoStruttura", "Appartamento");
  const [statoImmobile, setStatoImmobile] = useLocalStorage<StatoImmobile>("statoImmobile", "Buono");

  // UI state
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isHydrated, setIsHydrated] = useState(false);
  // Consenso privacy obbligatorio
  const [consent, setConsent] = useLocalStorage<boolean>("consent_privacy", false);
  const [clientId, setClientId] = useLocalStorage<string>("client_id", "");

  useEffect(() => {
    if (!clientId) {
      try {
        // Genera un identificatore anonimo stabile lato client
        setClientId((crypto as any)?.randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      } catch {
        setClientId(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
      }
    }
  }, [clientId]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Results
  const [result, setResult] = useState<AirRoiEstimate | null>(null);

  // Competitor display controls
  const [sortKey, setSortKey] = useLocalStorage<"price" | "occupancy" | "rating">("sortKey", "price");
  const [showAllCompetitors, setShowAllCompetitors] = useState(false);

  // --- Validation ---
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!isHydrated) return errs;
    // validazione coordinate
    const nlat = Number(lat);
    const nlng = Number(lng);
    if (!Number.isFinite(nlat) || nlat < -90 || nlat > 90) errs.push("Latitudine non valida (deve essere tra −90 e 90).");
    if (!Number.isFinite(nlng) || nlng < -180 || nlng > 180) errs.push("Longitudine non valida (deve essere tra −180 e 180).");
    // validazione parametri: considerare vuoto
    if (bedroomsInput === "") errs.push("Inserisci il numero di camere.");
    else if (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 20) errs.push("Il numero di camere deve essere tra 0 e 20.");
    if (bathsInput === "") errs.push("Inserisci il numero di bagni.");
    else if (isNaN(baths) || baths < 0.5 || baths > 20) errs.push("Il numero di bagni deve essere compreso tra 0.5 e 20.");
    if (guestsInput === "") errs.push("Inserisci il numero di ospiti.");
    else if (!Number.isInteger(guests) || guests < 1 || guests > 30) errs.push("Il numero massimo di ospiti deve essere tra 1 e 30.");
    return errs;
  }, [isHydrated, lat, lng, bedrooms, baths, guests, bedroomsInput, bathsInput, guestsInput]);

  useEffect(() => {
    console.log('Validation check - lat:', lat, 'lng:', lng, 'errors:', errors);
    if (errors.length === 0) {
      setStatus("Parametri validi. Puoi effettuare la richiesta.");
      setError("");
    } else {
      setStatus("");
      setError(errors[0]);
    }
  }, [errors, lat, lng]);

  // --- Geocoding via backend proxy ---
  const recordConsent = async (next: boolean, overrideAddress?: string) => {
    if (!next) return;
    try {
      // Assicura uno user_id stabile anche se non è stato ancora inizializzato
      let uid = clientId;
      if (!uid && typeof window !== "undefined") {
        uid = localStorage.getItem("client_id") || "";
        if (!uid) {
          uid = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          localStorage.setItem("client_id", uid);
        }
        setClientId(uid);
      }

      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          userId: uid || undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          address: (overrideAddress ?? address) || '',
        }),
      });
    } catch (e) {
      console.warn('Consent logging failed', e);
    }
  };

  const doGeocode = async () => {
    setResult(null);
    setGeocodeChoices([]);
    setChosenPlaceId("");
    if (!consent) {
      setStatus("");
      setError("Per procedere devi accettare la Privacy Policy.");
      return;
    }
    if (!address.trim()) {
      setError("Inserisci un indirizzo da geocodificare.");
      return;
    }
    setError("");
    // Scopo/parametri minimi
    setStatus(`Scopo: geocodifica indirizzo; Parametri minimi: address=${address.trim()}`);
    setLoadingGeo(true);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      let data: any = {};
      try {
        data = await res.json();
      } catch {}
      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }
      if (!Array.isArray(data.results) || data.results.length === 0)
        throw new Error("Nessun risultato per l'indirizzo specificato.");
      
      // Popola sempre geocodeChoices con tutti i risultati
      console.log('Geocode results:', data.results.length, data.results);
      setGeocodeChoices(data.results);
      
      if (data.results.length === 1) {
        // Se c'è un solo risultato, selezionalo automaticamente
        const result = data.results[0];
        setChosenPlaceId(result.place_id);
        const loc = result.geometry.location;
        setLat(String(loc.lat));
        setLng(String(loc.lng));
        // Imposta l'indirizzo formattato e aggiorna il consenso con l'indirizzo
        setAddress(result.formatted_address);
        recordConsent(true, result.formatted_address);
        setStatus("Risultato trovato. Conferma la selezione o modifica le coordinate.");
      } else {
        setStatus(`Trovati ${data.results.length} risultati: seleziona quello corretto.`);
      }
    } catch (e: any) {
      setError(`Errore geocodifica: ${e?.message || e}`);
      setStatus("");
    } finally {
      setLoadingGeo(false);
    }
  };

  const chooseGeocode = (placeId: string) => {
    const chosen = geocodeChoices.find((r) => r.place_id === placeId);
    if (!chosen) return;
    const loc = chosen.geometry.location;
    console.log('Setting coordinates - lat:', loc.lat, 'lng:', loc.lng);
    setLat(String(loc.lat));
    setLng(String(loc.lng));
    setChosenPlaceId(placeId);
    // Aggiorna l'indirizzo formattato e registra nuovamente il consenso con l'indirizzo
    setAddress(chosen.formatted_address);
    recordConsent(true, chosen.formatted_address);
    setStatus("Indirizzo selezionato. Coordinate impostate.");
    setError("");
  };

  // --- AIRROI Estimate via backend proxy ---
  const doEstimate = async () => {
    setResult(null);
    if (!consent) {
      setError("Per procedere devi accettare la Privacy Policy.");
      setStatus("");
      return;
    }
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }
    setLoadingEstimate(true);
    // Scopo/parametri minimi
    setStatus("Scopo: stima AIRROI; Parametri minimi: lat, lng, bedrooms, baths, guests, currency");
    setError("");

    const qs = new URLSearchParams({
      lat: String(Number(lat)),
      lng: String(Number(lng)),
      bedrooms: String(Math.trunc(bedrooms)),
      baths: String(Number(baths)),
      guests: String(Math.trunc(guests)),
      currency,
    });

    try {
      const res = await fetch(`/api/estimate?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }
      const payload: AirRoiEstimate = {
        occupancy: typeof data.occupancy === "number" ? data.occupancy : undefined,
        average_daily_rate: typeof data.average_daily_rate === "number" ? data.average_daily_rate : undefined,
        monthly_revenue_distributions: Array.isArray(data.monthly_revenue_distributions)
          ? data.monthly_revenue_distributions
          : null,
        comparable_listings: Array.isArray(data.comparable_listings) ? data.comparable_listings as CompetitorListing[] : null,
      };
      setResult(payload);
      setStatus("Richiesta riuscita. Dati aggiornati.");
    } catch (e: any) {
      setError(`Errore: ${e?.message || e}`);
      setStatus("");
    } finally {
      setLoadingEstimate(false);
    }
  };

  // Derived data for chart
  const chartData = useMemo(() => {
    const dist = result?.monthly_revenue_distributions;
    if (!dist || dist.length !== 12) return [] as { month: string; perc: number }[];
    return dist.map((v, i) => ({ month: monthsIT[i], perc: v ? v * 100 : 0 }));
  }, [result]);

  const fmtCurrency = (n?: number | null) => {
    if (typeof n !== "number") return "n/d";
    const isUSD = currency === "usd";
    const symbol = isUSD ? "$" : "€"; // simple best-effort
    return `${symbol}${n.toFixed(2)}`;
  };
  const fmtPercent = (f?: number | null) => (typeof f === "number" ? `${(f * 100).toFixed(2)}%` : "n/d");

  // Annual gross yield
  const annualGrossYield = useMemo(() => {
    if (typeof result?.occupancy !== "number" || typeof result?.average_daily_rate !== "number") return null;
    const a = stateFactorMap[statoImmobile];
    const b = typeFactorMap[tipoStruttura];
    const value = 360 * result.occupancy * result.average_daily_rate * a * b;
    return value;
  }, [result, statoImmobile, tipoStruttura]);

  // Derived data for competitor listings
  const sortedCompetitors = useMemo(() => {
    if (!result?.comparable_listings) return [];
    const list = [...result.comparable_listings];
    list.sort((a, b) => {
      if (sortKey === "price") {
        const priceA = a.performance_metrics.ttm_avg_rate || 0;
        const priceB = b.performance_metrics.ttm_avg_rate || 0;
        return priceB - priceA; // desc
      } else if (sortKey === "occupancy") {
        const occA = a.performance_metrics.ttm_occupancy || 0;
        const occB = b.performance_metrics.ttm_occupancy || 0;
        return occB - occA; // desc
      } else if (sortKey === "rating") {
        const ratingA = a.ratings.rating_overall || 0;
        const ratingB = b.ratings.rating_overall || 0;
        return ratingB - ratingA; // desc
      }
      return 0;
    });
    return list;
  }, [result?.comparable_listings, sortKey]);

  const displayedCompetitors = showAllCompetitors ? sortedCompetitors : sortedCompetitors.slice(0, 6);





  return (
    <div className="app">
      <div className="container">
        <div className="logo-container">
          <img src="/logo.gif?v=2" alt="Logo" className="logo" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Header_pdf.png'; }} />
        </div>

        {/* Consenso Privacy */}
        <div className="card" style={isHydrated ? { borderColor: consent ? '#4caf50' : '#e53935' } : undefined}>
          <h2 className="section-title">Consenso Privacy</h2>
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => { const v = e.target.checked; setConsent(v); recordConsent(v); }}
            />
            <span>
              Confermo di aver letto e accettato la <a href="/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              Senza consenso non è possibile eseguire geolocalizzazione né la stima.
            </span>
          </label>
          {!isHydrated ? null : (!consent && (
            <p className="status-err" style={{ marginTop: '6px' }}>Devi acconsentire alla Privacy Policy per procedere.</p>
          ))}
        </div>

        {/* Form */}
        <div className="grid">
          {/* Colonna sinistra: Indirizzo & Geo */}
          <div className="card">
            <h2 className="section-title">1) Indirizzo e Geocodifica</h2>
            <label className="label">Indirizzo (via, numero civico, città)</label>
            <input
              className="input"
              placeholder="Es. Via Giulia 123, Roma"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button onClick={doGeocode} disabled={isHydrated ? (!consent || loadingGeo) : undefined} className="button primary">
              {loadingGeo ? "Geocodifica..." : "Localizza immobile"}
            </button>
            {geocodeChoices.length > 0 && (() => {
              console.log('Rendering address selection with', geocodeChoices.length, 'choices');
              return (
                <div className="address-selection">
                <div className="address-selection-header">
                  <h3 className="address-selection-title">
                    {geocodeChoices.length === 1 
                      ? "Risultato trovato - Conferma l'indirizzo:" 
                      : `${geocodeChoices.length} risultati trovati - Seleziona l'indirizzo corretto:`
                    }
                  </h3>
                </div>
                <div className="address-options">
                  {geocodeChoices.map((r) => {
                    const addressComponents = r.address_components || [];
                    const types = r.types || [];
                    const placeType = types.find((t: string) => 
                      ['street_address', 'route', 'locality', 'administrative_area_level_1', 'country'].includes(t)
                    ) || types[0] || 'address';
                    
                    // Estrai componenti utili dell'indirizzo
                    const streetNumber = addressComponents.find((c: any) => c.types.includes('street_number'))?.long_name || '';
                    const route = addressComponents.find((c: any) => c.types.includes('route'))?.long_name || '';
                    const locality = addressComponents.find((c: any) => c.types.includes('locality'))?.long_name || '';
                    const adminArea = addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'))?.long_name || '';
                    const country = addressComponents.find((c: any) => c.types.includes('country'))?.long_name || '';
                    
                    const shortAddress = [streetNumber, route].filter(Boolean).join(' ');
                    const locationInfo = [locality, adminArea, country].filter(Boolean).join(', ');
                    
                    return (
                      <div 
                        key={r.place_id} 
                        className={`address-option ${chosenPlaceId === r.place_id ? "selected" : ""}`}
                        onClick={() => chooseGeocode(r.place_id)}
                      >
                        <input 
                          type="radio" 
                          name="address-choice" 
                          checked={chosenPlaceId === r.place_id} 
                          onChange={() => chooseGeocode(r.place_id)}
                          className="address-option-radio"
                        />
                        <div className="address-option-content">
                          <div className="address-option-main">
                            {shortAddress || r.formatted_address}
                          </div>
                          <div className="address-option-details">
                            {locationInfo && <div>{locationInfo}</div>}
                            {r.geometry?.location && (
                              <div>
                                Coordinate: {r.geometry.location.lat.toFixed(6)}, {r.geometry.location.lng.toFixed(6)}
                              </div>
                            )}
                          </div>
                          <span className="address-option-type">
                            {placeType.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              );
            })()}
          </div>

          {/* Colonna centrale: Coordinate & Parametri */}
          <div className="card">
            <h2 className="section-title">2) Coordinate & Parametri</h2>
            <div className="grid-2">
              <div>
                <label className="label">Latitudine (−90..90)</label>
                <input className="input" inputMode="decimal" value={lat} readOnly placeholder="41.9028" />
              </div>
              <div>
                <label className="label">Longitudine (−180..180)</label>
                <input className="input" inputMode="decimal" value={lng} readOnly placeholder="12.4964" />
              </div>
            </div>

            <div className="grid-3">
              <div>
                <label className="label">Camere (0..20)</label>
                <input type="number" className="input" value={bedroomsInput} placeholder="es. 2" onChange={(e) => {
                  const v = e.target.value;
                  setBedroomsInput(v);
                  if (v === "") return; // lascia vuoto durante editing
                  const n = parseInt(v, 10);
                  if (!Number.isNaN(n)) setBedrooms(clamp(n, 0, 20));
                }} />
              </div>
              <div>
                <label className="label">Bagni (0.5..20)</label>
                <input type="number" step="0.5" className="input" value={bathsInput} placeholder="es. 1.5" onChange={(e) => {
                  const v = e.target.value;
                  setBathsInput(v);
                  if (v === "") return;
                  const n = parseFloat(v);
                  if (!Number.isNaN(n)) setBaths(clamp(n, 0.5, 20));
                }} />
              </div>
              <div>
                <label className="label">Ospiti (1..30)</label>
                <input type="number" className="input" value={guestsInput} placeholder="es. 4" onChange={(e) => {
                  const v = e.target.value;
                  setGuestsInput(v);
                  if (v === "") return;
                  const n = parseInt(v, 10);
                  if (!Number.isNaN(n)) setGuests(clamp(n, 1, 30));
                }} />
              </div>
            </div>

            <div className="grid-3">
              <div>
                <label className="label">Valuta</label>
                <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                  <option value="native">native</option>
                  <option value="usd">usd</option>
                </select>
              </div>
              <div>
                <label className="label">Tipo di struttura</label>
                <select className="select" value={tipoStruttura} onChange={(e) => setTipoStruttura(e.target.value as any)}>
                  <option value="Appartamento">Appartamento</option>
                  <option value="Affittacamere">Affittacamere</option>
                  <option value="B&B">B&B</option>
                </select>
              </div>
              <div>
                <label className="label">Stato dell’immobile</label>
                <select className="select" value={statoImmobile} onChange={(e) => setStatoImmobile(e.target.value as any)}>
                  <option value="Ottimo">Ottimo</option>
                  <option value="Buono">Buono</option>
                  <option value="Discreto">Discreto</option>
                  <option value="Mediocre">Mediocre</option>
                </select>
              </div>
            </div>
          </div>

          {/* Colonna destra: Submit */}
          <div className="card">
            <h2 className="section-title">3) Stima</h2>
            <button 
              onClick={doEstimate} 
              disabled={isHydrated ? (!consent || loadingEstimate || errors.length > 0 || bedroomsInput === "" || bathsInput === "" || guestsInput === "") : undefined} 
              className="button primary"
            >
              {loadingEstimate ? "Richiesta in corso..." : "Calcola guadagni"}
            </button>
            {isHydrated && status && <p className="status-ok">{status}</p>}
            {isHydrated && error && <p className="status-err">{error}</p>}
          </div>
        </div>

        {/* Results */}
        <div className="grid-results">
          <div className="card">
            <h3 className="section-title">Occupancy</h3>
            <p className="kpi">{fmtPercent(result?.occupancy)}</p>
          </div>
          <div className="card">
            <h3 className="section-title">ADR</h3>
            <p className="kpi">{fmtCurrency(result?.average_daily_rate)}</p>
          </div>
          <div className="card">
            <h3 className="section-title">Annunci comparabili</h3>
            <p className="kpi">{Array.isArray(result?.comparable_listings) ? result!.comparable_listings!.length : 0}</p>
            <p className="hint">Numero di listing usati per la stima.</p>
          </div>
          <div className="card">
            <h3 className="section-title">Rendimento annuo lordo</h3>
            <p className="kpi highlight">{annualGrossYield == null ? "n/d" : fmtCurrency(annualGrossYield)}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-title">Distribuzione revenue mensile</h3>
            <span className="hint">Quote % che sommano ≈ 100</span>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(192, 192, 192, 0.2)" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#b8b8b8', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(192, 192, 192, 0.3)' }}
                  tickLine={{ stroke: 'rgba(192, 192, 192, 0.3)' }}
                />
                <YAxis 
                  unit="%" 
                  tick={{ fill: '#b8b8b8', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(192, 192, 192, 0.3)' }}
                  tickLine={{ stroke: 'rgba(192, 192, 192, 0.3)' }}
                />
                <Tooltip 
                  formatter={(v: any) => `${Number(v).toFixed(1)}%`}
                  contentStyle={{
                    backgroundColor: 'rgba(25, 25, 25, 0.95)',
                    border: '1px solid rgba(192, 192, 192, 0.4)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    boxShadow: '0 0 20px rgba(192, 192, 192, 0.3)',
                    backdropFilter: 'blur(10px)'
                  }}
                  labelStyle={{ color: '#d3d3d3' }}
                />
                <Bar 
                  dataKey="perc" 
                  fill="url(#metallicGradient)"
                  stroke="rgba(192, 192, 192, 0.8)"
                  strokeWidth={1.5}
                  radius={[4, 4, 0, 0]}
                />
                <defs>
                  <linearGradient id="metallicGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f8f8ff" stopOpacity={0.9} />
                    <stop offset="20%" stopColor="#e6e6fa" stopOpacity={0.8} />
                    <stop offset="40%" stopColor="#d3d3d3" stopOpacity={0.7} />
                    <stop offset="60%" stopColor="#c0c0c0" stopOpacity={0.8} />
                    <stop offset="80%" stopColor="#a9a9a9" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#808080" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="goldAccent" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffd700" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="#ffed4e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#ffd700" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(!result || chartData.length === 0) && (<p className="hint">Esegui una stima per visualizzare il grafico.</p>)}
        </div>

        {/* Raw JSON response */}
        <div className="card">
          <h3 className="section-title">Dati completi restituiti da AIRROI</h3>
          <pre className="code">
            {result ? JSON.stringify(result, null, 2) : "Nessun dato. Esegui una stima."}
          </pre>
        </div>

        {/* Competitor listings */}
        {result?.comparable_listings && sortedCompetitors.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="section-title">Competitor ({sortedCompetitors.length})</h3>
              <div className="controls">
                <label className="label">Ordina per</label>
                <select className="select" value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}>
                  <option value="price">Prezzo medio</option>
                  <option value="occupancy">Occupazione</option>
                  <option value="rating">Rating</option>
                </select>
              </div>
            </div>
            <div className="competitors-grid">
              {displayedCompetitors.map((competitor, idx) => (
                <CompetitorCard 
                  key={competitor.listing_info.listing_id || idx} 
                  competitor={competitor}
                  currency={currency}
                />
              ))}
            </div>
            {sortedCompetitors.length > 6 && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button 
                  className="button"
                  onClick={() => setShowAllCompetitors(!showAllCompetitors)}
                >
                  {showAllCompetitors ? 'Mostra meno' : `Mostra tutti (${sortedCompetitors.length})`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pulsante PDF */}
        {result && (
          <div style={{ textAlign: 'center', margin: '30px 0' }}>
            <button 
              className="button pdf-button"
              onClick={() => generatePDF(
                result,
                address,
                bedrooms,
                baths,
                guests,
                tipoStruttura,
                statoImmobile,
                currency
              )}
            >
              📄 SCARICA PDF
            </button>
          </div>
        )}
    
      </div>
    </div>
  );
}