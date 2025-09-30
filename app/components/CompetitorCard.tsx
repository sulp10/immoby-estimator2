"use client";

import React, { useState } from "react";

// Interfaccia per i dati del competitor basata sulla struttura del file output_airroi.txt
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

interface CompetitorCardProps {
  competitor: CompetitorListing;
  currency: "native" | "usd";
}

const CompetitorCard: React.FC<CompetitorCardProps> = ({ competitor, currency }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Funzione per formattare la valuta
  const fmtCurrency = (n?: number | null) => {
    if (typeof n !== "number") return "n/d";
    const isUSD = currency === "usd";
    const symbol = isUSD ? "$" : "€";
    return `${symbol}${n.toFixed(2)}`;
  };

  // Funzione per formattare le percentuali
  const fmtPercent = (f?: number | null) => 
    (typeof f === "number" ? `${(f * 100).toFixed(1)}%` : "n/d");

  // Funzione per formattare il rating con stelle
  const formatRating = (rating: number) => {
    const stars = "★".repeat(Math.floor(rating)) + "☆".repeat(5 - Math.floor(rating));
    return `${stars} ${rating.toFixed(2)}`;
  };

  // Gestione dell'errore di caricamento immagine
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjFGNUY5Ii8+CjxwYXRoIGQ9Ik04NSA2MEwxMTUgOTBMMTM1IDcwTDE2NSAxMDBIMzVMNjUgNzBMODUgNjBaIiBmaWxsPSIjQ0JENUUxIi8+CjxjaXJjbGUgY3g9IjY1IiBjeT0iNDAiIHI9IjEwIiBmaWxsPSIjQ0JENUUxIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjc3NDhGIiBmb250LXNpemU9IjEyIj5JbW1hZ2luZSBub24gZGlzcG9uaWJpbGU8L3RleHQ+Cjwvc3ZnPg==";
  };

  return (
    <div className="competitor-card">
      <div 
        className="competitor-card-header" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="competitor-image-container">
          <img 
            src={competitor.listing_info.cover_photo_url} 
            alt={competitor.listing_info.listing_name}
            className="competitor-image"
            onError={handleImageError}
          />
        </div>
        
        <div className="competitor-basic-info">
          <h4 className="competitor-title">{competitor.listing_info.listing_name}</h4>
          <div className="competitor-price">
            <span className="price-label">Prezzo medio:</span>
            <span className="price-value">{fmtCurrency(competitor.performance_metrics.ttm_avg_rate)}</span>
          </div>
          <div className="competitor-occupancy">
            <span className="occupancy-label">Occupancy:</span>
            <span className="occupancy-value">{fmtPercent(competitor.performance_metrics.ttm_occupancy)}</span>
          </div>
        </div>
        
        <div className="competitor-expand-icon">
          <svg 
            className={`expand-arrow ${isExpanded ? 'expanded' : ''}`} 
            width="20" 
            height="20" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="competitor-card-details">
          {/* Informazioni generali */}
          <div className="detail-section">
            <h5 className="detail-section-title">Informazioni Generali</h5>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Tipo:</span>
                <span className="detail-value">{competitor.listing_info.listing_type}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ospiti:</span>
                <span className="detail-value">{competitor.property_details.guests}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Camere:</span>
                <span className="detail-value">{competitor.property_details.bedrooms}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Letti:</span>
                <span className="detail-value">{competitor.property_details.beds}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Bagni:</span>
                <span className="detail-value">{competitor.property_details.baths}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Località:</span>
                <span className="detail-value">{competitor.location_info.locality}, {competitor.location_info.region}</span>
              </div>
            </div>
          </div>

          {/* Host e valutazioni */}
          <div className="detail-section">
            <h5 className="detail-section-title">Host e Valutazioni</h5>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Host:</span>
                <span className="detail-value">
                  {competitor.host_info.host_name}
                  {competitor.host_info.superhost && <span className="superhost-badge">★ Superhost</span>}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Recensioni:</span>
                <span className="detail-value">{competitor.ratings.num_reviews}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Valutazione:</span>
                <span className="detail-value">{formatRating(competitor.ratings.rating_overall)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Pulizia:</span>
                <span className="detail-value">{competitor.ratings.rating_cleanliness.toFixed(1)}/5</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Posizione:</span>
                <span className="detail-value">{competitor.ratings.rating_location.toFixed(1)}/5</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Rapporto qualità/prezzo:</span>
                <span className="detail-value">{competitor.ratings.rating_value.toFixed(1)}/5</span>
              </div>
            </div>
          </div>

          {/* Prenotazioni e prezzi */}
          <div className="detail-section">
            <h5 className="detail-section-title">Prenotazioni e Prezzi</h5>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Prenotazione istantanea:</span>
                <span className="detail-value">{competitor.booking_settings.instant_book ? "Sì" : "No"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Notti minime:</span>
                <span className="detail-value">{competitor.booking_settings.min_nights}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Politica cancellazione:</span>
                <span className="detail-value">{competitor.booking_settings.cancellation_policy}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tassa pulizia:</span>
                <span className="detail-value">{fmtCurrency(competitor.pricing_info.cleaning_fee)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Revenue annuo:</span>
                <span className="detail-value">{fmtCurrency(competitor.performance_metrics.ttm_revenue)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">RevPAR:</span>
                <span className="detail-value">{fmtCurrency(competitor.performance_metrics.ttm_revpar)}</span>
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="detail-section">
            <h5 className="detail-section-title">Servizi e Comfort</h5>
            <div className="amenities-grid">
              {competitor.property_details.amenities.map((amenity, index) => (
                <span key={index} className="amenity-tag">{amenity}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitorCard;