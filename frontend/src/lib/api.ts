import type {
  Booking,
  Cinema,
  City,
  Hall,
  LoginResponse,
  Movie,
  RefreshResponse,
  Seat,
  Session,
  UserProfile,
} from "./types";

const API_PREFIX = "/api";
const PROFILE_STORAGE_KEY = "cinemax_user_profile";
const AUTH_PATH_PREFIXES = [
  "/booking",
  "/cities/admin",
  "/movies/admin",
  "/sessions/admin",
  "/halls/admin",
  "/ai",
];

type RequestOptions = RequestInit & {
  skipJsonHeader?: boolean;
  skipAuthRetry?: boolean;
};

export interface CityPayload {
  city_name: string;
}

export interface CinemaPayload {
  city_id: number;
  cinema_name: string;
  cinema_address?: string;
}

export interface MoviePayload {
  title: string;
  description?: string;
  duration_min: number;
  genre?: string;
  poster_url?: string;
  release_year?: number;
  rating?: number;
  director?: string;
  writer?: string;
  country?: string;
  budget_amount?: number;
  budget_currency?: string;
  main_actors?: string[];
}

export interface HallPayload {
  cinema_id: number;
  hall_name: string;
  rows_count: number;
  seats_per_row: number;
}

export interface SessionPayload {
  hall_id: number;
  movie_id: number;
  start_time: string;
  price: number;
}

export interface OccupancyPredictionPayload {
  session_id: number;
}

export interface OccupancyPredictionResponse {
  predicted_occupancy_rate: number;
}

export function updateProfile(payload: { full_name?: string; email?: string }) {
    return apiRequest("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

export function fetchFeaturedMovies(cinemaId: number) {
    return apiRequest<Movie[]>(`/movies/featured?cinema_id=${cinemaId}`);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const CACHE_TTL_MS = 45_000;

let citiesCache: CacheEntry<City[]> | null = null;
let citiesInFlight: Promise<City[]> | null = null;

const cinemasByCityCache = new Map<number, CacheEntry<Cinema[]>>();
const cinemasByCityInFlight = new Map<number, Promise<Cinema[]>>();

let moviesCache: CacheEntry<Movie[]> | null = null;
let moviesInFlight: Promise<Movie[]> | null = null;

const hallsByCinemaCache = new Map<number, CacheEntry<Hall[]>>();
const hallsByCinemaInFlight = new Map<number, Promise<Hall[]>>();

const hallByIdCache = new Map<number, CacheEntry<Hall>>();
const hallByIdInFlight = new Map<number, Promise<Hall>>();

function makeCacheEntry<T>(data: T): CacheEntry<T> {
  return { data, expiresAt: Date.now() + CACHE_TTL_MS };
}

function readCache<T>(entry: CacheEntry<T> | null | undefined): T | null {
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry.data;
}

function invalidateCitiesAndCinemasCache() {
  citiesCache = null;
  citiesInFlight = null;
  cinemasByCityCache.clear();
  cinemasByCityInFlight.clear();
}

function invalidateMoviesCache() {
  moviesCache = null;
  moviesInFlight = null;
}

function invalidateHallsCache(cinemaId?: number) {
  if (typeof cinemaId === "number" && Number.isFinite(cinemaId)) {
    hallsByCinemaCache.delete(cinemaId);
    hallsByCinemaInFlight.delete(cinemaId);
  } else {
    hallsByCinemaCache.clear();
    hallsByCinemaInFlight.clear();
  }
  hallByIdCache.clear();
  hallByIdInFlight.clear();
}

function mapCreateBookingBadRequestMessage(detail: string): string {
  const normalized = detail.toLowerCase();
  if (normalized.includes("session already started")) {
    return "Сеанс уже начался. Выберите другой сеанс.";
  }
  if (normalized.includes("already booked")) {
    return "Часть выбранных мест уже занята. Обновите схему зала и выберите свободные места.";
  }
  if (normalized.includes("is not in this hall")) {
    return "Выбрано место не из этого зала. Обновите схему мест и попробуйте снова.";
  }
  return detail || "Не удалось оформить бронь. Проверьте выбранные места и время сеанса.";
}

function mapDeleteMovieBadRequestMessage(detail: string): string {
  const normalized = detail.toLowerCase();
  if (normalized.includes("cannot delete movie with existing sessions")) {
    return "Нельзя удалить фильм, пока для него существуют сеансы. Сначала удалите связанные сеансы.";
  }
  return detail || "Не удалось удалить фильм.";
}

function parseActorsValue(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const normalized = value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const normalized = parsed
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => item.length > 0);
        return normalized.length > 0 ? normalized : null;
      }
    } catch {
    }
    const fallback = trimmed.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
    return fallback.length > 0 ? fallback : null;
  }
  return null;
}

function normalizeMovie(rawMovie: Movie): Movie {
  const movieWithUnknownActors = rawMovie as Movie & { main_actors?: unknown };
  return {
    ...rawMovie,
    main_actors: parseActorsValue(movieWithUnknownActors.main_actors),
  };
}

function mapBackend500Message(path: string, currentMessage: string): string {
  const isProtectedRoute = AUTH_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (!isProtectedRoute) return currentMessage;
  const normalized = currentMessage.toLowerCase();
  if (normalized.includes("tokenpayload") || normalized.includes("int() argument")) {
    return "Сервер не смог проверить токен (внутренняя ошибка авторизации в бэке). Это не ошибка фронта.";
  }
  if (normalized === "ошибка запроса" || normalized === "error") {
    return "Внутренняя ошибка бэка на защищенном эндпоинте. Проверьте backend traceback (обычно проблема в auth/deps).";
  }
  return currentMessage;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipJsonHeader, skipAuthRetry, headers, ...rest } = options;

  const requestHeaders = new Headers(headers ?? {});
  if (!skipJsonHeader && !requestHeaders.has("Content-Type") && rest.body) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    credentials: "include",
    ...rest,
    headers: requestHeaders,
  });

  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown = null;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else if (response.status !== 204) {
    payload = await response.text();
  }

  if (!response.ok) {
    let message = "Ошибка запроса";
    if (typeof payload === "string" && payload.trim()) {
      message = payload;
    } else if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      message = typeof detail === "string" ? detail : message;
    }
    if (response.status === 500) {
      message = mapBackend500Message(path, message);
    }
    if (response.status === 400 && path.startsWith("/movies/admin/movies") && rest.method?.toUpperCase() === "DELETE") {
      message = mapDeleteMovieBadRequestMessage(message);
    }

    const error = new ApiError(message, response.status, payload);
    const isAuthRoute = path.startsWith("/auth/");
    const isProtectedRoute = AUTH_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
    const hasLocalProfile = Boolean(localStorage.getItem(PROFILE_STORAGE_KEY));
    const canRetryWithRefresh =
        !skipAuthRetry &&
        !isAuthRoute &&
        hasLocalProfile &&
        (error.status === 401 || error.status === 403 || (error.status === 500 && isProtectedRoute));

    if (canRetryWithRefresh) {
      try {
        await apiRequest<RefreshResponse>("/auth/refresh", {
          method: "POST",
          skipAuthRetry: true,
        });
        return await apiRequest<T>(path, { ...options, skipAuthRetry: true });
      } catch {
        // return original error
      }
    }

    throw error;
  }

  return payload as T;
}

export function getErrorMessage(error: unknown, fallback = "Произошла ошибка"): string {
  if (error instanceof ApiError) {
    const detail = error.message?.trim() || fallback;
    return `Ошибка ${error.status}: ${detail}`;
  }
  if (error instanceof Error) {
    return `Ошибка: ${error.message || fallback}`;
  }
  return fallback;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiRequest("/auth/change-password", {
    method: "PUT",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
}

export async function probeAdminAccess(): Promise<boolean> {
  try {
    await apiRequest<{ message: string }>("/cities/admin/cities/-1", { method: "DELETE" });
    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) return false;
      if (error.status === 404 || error.status === 400 || error.status === 422) return true;
    }
    throw error;
  }
}

export async function probeCinemaAdminAccess(): Promise<boolean> {
  try {
    await apiRequest<{ message: string }>("/movies/admin/movies/-1", { method: "DELETE" });
    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) return false;
      if (error.status === 404 || error.status === 400 || error.status === 422) return true;
    }
    throw error;
  }
}

export function fetchMe() {
  return apiRequest<UserProfile>("/auth/me");
}

export function registerUser(payload: { email: string; full_name: string; password: string }) {
  return apiRequest<UserProfile>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: { email: string; password: string }) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refreshAccessToken() {
  return apiRequest<RefreshResponse>("/auth/refresh", { method: "POST" });
}

export function logoutUser() {
  return apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
}

export function fetchCities() {
  const cached = readCache(citiesCache);
  if (cached) return Promise.resolve(cached);
  if (citiesInFlight) return citiesInFlight;

  citiesInFlight = apiRequest<City[]>("/cities/")
      .then((cities) => {
        citiesCache = makeCacheEntry(cities);
        return cities;
      })
      .finally(() => { citiesInFlight = null; });

  return citiesInFlight;
}

export function createCity(payload: CityPayload) {
  return apiRequest<City>("/cities/admin/cities", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((city) => { invalidateCitiesAndCinemasCache(); return city; });
}

export function updateCity(cityId: number, payload: CityPayload) {
  return apiRequest<City>(`/cities/admin/cities/${cityId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((city) => { invalidateCitiesAndCinemasCache(); return city; });
}

export function deleteCity(cityId: number) {
  return apiRequest<{ message: string }>(`/cities/admin/cities/${cityId}`, {
    method: "DELETE",
  }).then((result) => { invalidateCitiesAndCinemasCache(); invalidateHallsCache(); return result; });
}

export function fetchCinemasByCity(cityId: number) {
  const cached = readCache(cinemasByCityCache.get(cityId));
  if (cached) return Promise.resolve(cached);

  const inFlight = cinemasByCityInFlight.get(cityId);
  if (inFlight) return inFlight;

  const request = apiRequest<Cinema[]>(`/cinemas/by-city/${cityId}`)
      .then((cinemas) => {
        cinemasByCityCache.set(cityId, makeCacheEntry(cinemas));
        return cinemas;
      })
      .finally(() => { cinemasByCityInFlight.delete(cityId); });

  cinemasByCityInFlight.set(cityId, request);
  return request;
}

export function createCinema(payload: CinemaPayload) {
  return apiRequest<Cinema>("/cinemas/admin", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((cinema) => { invalidateCitiesAndCinemasCache(); invalidateHallsCache(); return cinema; });
}

export function updateCinema(cinemaId: number, payload: CinemaPayload) {
  return apiRequest<Cinema>(`/cinemas/admin/${cinemaId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((cinema) => { invalidateCitiesAndCinemasCache(); invalidateHallsCache(cinemaId); return cinema; });
}

export function deleteCinema(cinemaId: number) {
  return apiRequest<{ message: string }>(`/cinemas/admin/${cinemaId}`, {
    method: "DELETE",
  }).then((result) => { invalidateCitiesAndCinemasCache(); invalidateHallsCache(cinemaId); return result; });
}

export function fetchMovies() {
  const cached = readCache(moviesCache);
  if (cached) return Promise.resolve(cached);
  if (moviesInFlight) return moviesInFlight;

  moviesInFlight = apiRequest<Movie[]>("/movies/")
      .then((movies) => movies.map(normalizeMovie))
      .then((movies) => {
        moviesCache = makeCacheEntry(movies);
        return movies;
      })
      .finally(() => { moviesInFlight = null; });

  return moviesInFlight;
}

export function fetchMovieById(movieId: number) {
  const cachedMovies = readCache(moviesCache);
  if (cachedMovies) {
    const cachedMovie = cachedMovies.find((movie) => movie.movie_id === movieId);
    if (cachedMovie) return Promise.resolve(cachedMovie);
  }

  return apiRequest<Movie>(`/movies/${movieId}`)
      .then(normalizeMovie)
      .then((movie) => {
        const currentMovies = readCache(moviesCache);
        if (currentMovies) {
          const index = currentMovies.findIndex((item) => item.movie_id === movie.movie_id);
          if (index >= 0) {
            currentMovies[index] = movie;
          }
          moviesCache = makeCacheEntry(currentMovies);
        }
        
        return movie;
      });
}

export function createMovie(payload: MoviePayload) {
  return apiRequest<Movie>("/movies/admin/movies", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((movie) => { invalidateMoviesCache(); return movie; });
}

export function updateMovie(movieId: number, payload: MoviePayload) {
  return apiRequest<Movie>(`/movies/admin/movies/${movieId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((movie) => { invalidateMoviesCache(); return movie; });
}

export function deleteMovie(movieId: number) {
  return apiRequest<{ message: string }>(`/movies/admin/movies/${movieId}`, {
    method: "DELETE",
  }).then((result) => { invalidateMoviesCache(); return result; });
}

export function fetchSessionsByMovie(movieId: number, date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiRequest<Session[]>(`/sessions/movies/${movieId}/sessions${query}`);
}

export function fetchSessionsByCinema(cinemaId: number, date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiRequest<Session[]>(`/sessions/cinemas/${cinemaId}/sessions${query}`);
}

export function fetchSessionById(sessionId: number) {
  return apiRequest<Session>(`/sessions/${sessionId}`);
}

export function createSession(payload: SessionPayload) {
  return apiRequest<Session>("/sessions/admin/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSession(sessionId: number, payload: SessionPayload) {
  return apiRequest<Session>(`/sessions/admin/sessions/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteSession(sessionId: number) {
  return apiRequest<{ message: string }>(`/sessions/admin/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export function fetchHallsByCinema(cinemaId: number) {
  const cached = readCache(hallsByCinemaCache.get(cinemaId));
  if (cached) return Promise.resolve(cached);

  const inFlight = hallsByCinemaInFlight.get(cinemaId);
  if (inFlight) return inFlight;

  const request = apiRequest<Hall[]>(`/halls/cinemas/${cinemaId}/halls`)
      .then((halls) => {
        hallsByCinemaCache.set(cinemaId, makeCacheEntry(halls));
        halls.forEach((hall) => { hallByIdCache.set(hall.hall_id, makeCacheEntry(hall)); });
        return halls;
      })
      .finally(() => { hallsByCinemaInFlight.delete(cinemaId); });

  hallsByCinemaInFlight.set(cinemaId, request);
  return request;
}

export function fetchHallById(hallId: number) {
  const cached = readCache(hallByIdCache.get(hallId));
  if (cached) return Promise.resolve(cached);

  const inFlight = hallByIdInFlight.get(hallId);
  if (inFlight) return inFlight;

  const request = apiRequest<Hall>(`/halls/halls/${hallId}`)
      .then((hall) => {
        hallByIdCache.set(hall.hall_id, makeCacheEntry(hall));
        return hall;
      })
      .finally(() => { hallByIdInFlight.delete(hallId); });

  hallByIdInFlight.set(hallId, request);
  return request;
}

export function createHall(payload: HallPayload) {
  return apiRequest<Hall>("/halls/admin/halls", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((hall) => { invalidateHallsCache(hall.cinema_id); return hall; });
}

export function updateHall(hallId: number, payload: HallPayload) {
  return apiRequest<Hall>(`/halls/admin/halls/${hallId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((hall) => { invalidateHallsCache(hall.cinema_id); return hall; });
}

export function deleteHall(hallId: number) {
  return apiRequest<{ message: string }>(`/halls/admin/halls/${hallId}`, {
    method: "DELETE",
  }).then((result) => { invalidateHallsCache(); return result; });
}

export function fetchSeatsByHall(hallId: number, sessionId: number) {
  return apiRequest<Seat[]>(`/halls/halls/${hallId}/seats?session_id=${sessionId}`)
      .then((seats) =>
          seats.map((seat) => ({
            ...seat,
            is_booked: seat.status === "booked" || seat.status === "paid",
          })),
      )
      .catch((error) => {
        if (error instanceof ApiError && error.status === 500) {
          throw new ApiError(
              "Сервер не смог загрузить места (ошибка 500). Возможна проблема схемы БД.",
              error.status,
              error.details,
          );
        }
        throw error;
      });
}

export function createBooking(payload: { session_id: number; seats: number[] }) {
  return apiRequest<Booking[]>("/booking/", {
    method: "POST",
    body: JSON.stringify({ session_id: payload.session_id, seat_ids: payload.seats }),
  }).catch((error) => {
    if (error instanceof ApiError && error.status === 400) {
      throw new ApiError(mapCreateBookingBadRequestMessage(error.message), error.status, error.details);
    }
    if (error instanceof ApiError && error.status === 500) {
      throw new ApiError(
          "Сервер не смог оформить бронь (ошибка 500). Проверьте подключение к БД.",
          error.status,
          error.details,
      );
    }
    throw error;
  });
}

export function fetchMyBookings() {
  return apiRequest<Booking[]>("/booking/my");
}

export function cancelBookingRequest(bookingId: number) {
  return apiRequest<{ cancelled: number[]; failed: number[] }>("/booking/cancel", {
    method: "POST",
    body: JSON.stringify({ booking_ids: [bookingId] }),
  });
}

export function cancelMultipleBookings(bookingIds: number[]) {
  return apiRequest<{ cancelled: number[]; failed: number[] }>("/booking/cancel", {
    method: "POST",
    body: JSON.stringify({ booking_ids: bookingIds }),
  });
}

export function payBooking(bookingId: number) {
  return apiRequest<{ paid: number[]; failed: number[] }>("/booking/pay", {
    method: "POST",
    body: JSON.stringify({ booking_ids: [bookingId] }),
  });
}

export function payMultipleBookings(bookingIds: number[]) {
  return apiRequest<{ paid: number[]; failed: number[] }>("/booking/pay", {
    method: "POST",
    body: JSON.stringify({ booking_ids: bookingIds }),
  });
}

export function buyTicket(payload: { session_id: number; seats: number[] }) {
  return apiRequest<Booking[]>("/booking/buy", {
    method: "POST",
    body: JSON.stringify({ session_id: payload.session_id, seat_ids: payload.seats }),
  }).catch((error) => {
    if (error instanceof ApiError && error.status === 400) {
      throw new ApiError(mapCreateBookingBadRequestMessage(error.message), error.status, error.details);
    }
    if (error instanceof ApiError && error.status === 500) {
      throw new ApiError(
          "Сервер не смог оформить билет (ошибка 500). Проверьте подключение к БД.",
          error.status,
          error.details,
      );
    }
    throw error;
  });
}

export async function predictOccupancy(payload: OccupancyPredictionPayload): Promise<OccupancyPredictionResponse> {
  const response = await fetch('/api/ai/predict-occupancy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ session_id: payload.session_id }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Predict occupancy error response:', errorText);
    throw new Error(`Ошибка ${response.status}: ${errorText}`);
  }
  return response.json();
}

export function retrainAiModel() {
  return apiRequest<{ message: string }>("/ai/admin/retrain", { method: "POST" });
}

export interface TrainingMetrics {
  mae: number;
  mape: number;
  mse: number;
  rmse: number;
  r2: number;
  trained_at: string;
}

export async function fetchTrainingHistory(): Promise<TrainingMetrics[]> {
  return apiRequest<TrainingMetrics[]>("/ai/history");
}