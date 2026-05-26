import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import type { Movie } from "./types";

const FALLBACK_POSTERS = [
  "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1080&q=80",
];

const FALLBACK_BACKDROPS = [
  "https://images.unsplash.com/photo-1485095329183-d0797cdc5676?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1517602302552-471fe67acf66?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?auto=format&fit=crop&w=1600&q=80",
];

export function formatDuration(minutes: number): string {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours > 0) {
    return `${hours}ч ${mins}м`;
  }
  return `${mins}м`;
}

export function formatFullDate(isoDate: string): string {
  return format(parseISO(isoDate), "d MMMM yyyy", { locale: ru });
}

export function formatOnlyDate(isoDate: string): string {
  return format(parseISO(isoDate), "yyyy-MM-dd");
}

export function formatTime(isoDate: string): string {
  return format(parseISO(isoDate), "HH:mm");
}

export function formatRubles(amount: number): string {
  const safeValue = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(safeValue);
}

export function getMoviePoster(movie: Movie): string {
  if (movie.poster_url) {
    return movie.poster_url;
  }
  const index = movie.movie_id % FALLBACK_POSTERS.length;
  return FALLBACK_POSTERS[index];
}

export function getMovieBackdrop(movie: Movie): string {
  if (movie.poster_url) {
    return movie.poster_url;
  }
  const index = movie.movie_id % FALLBACK_BACKDROPS.length;
  return FALLBACK_BACKDROPS[index];
}

export function getMovieAgeLabel(movie: Movie): string {
  if (movie.age_rating) {
    return movie.age_rating;
  }
  return "0+";
}
