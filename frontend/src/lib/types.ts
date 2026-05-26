export interface UserProfile {
  user_id?: number;
  email: string;
  full_name: string;
  role?: "client" | "admin" | "cinema_admin" | "guest";
  is_active?: boolean;
  created_at?: string;
}

export interface City {
  city_id: number;
  city_name: string;
}

export interface Cinema {
  city_id: number;
  city_name: string;
  cinema_id: number;
  cinema_name: string;
  cinema_address?: string | null;
}

export interface Movie {
  movie_id: number;
  title: string;
  description?: string | null;
  duration_min: number;
  genre?: string | null;
  poster_url?: string | null;
  release_year?: number | null;
  rating?: number | null;
  director?: string | null;
  writer?: string | null;
  country?: string | null;
  budget_amount?: number | null;
  budget_currency?: string | null;
  main_actors?: string[] | null;
  age_rating?: string | null;
}

export interface Hall {
  hall_id: number;
  cinema_id: number;
  hall_name: string;
  rows_count: number;
  seats_per_row: number;
  total_seats: number;
}

export interface Session {
  session_id: number;
  hall_id: number;
  movie_id: number;
  start_time: string;
  price: number;
  available_seats: number;
  hall_name?: string | null;
  movie_title?: string | null;
  total_seats?: number | null;
}

export interface Seat {
  seat_id: number;
  row_letter: string;
  seat_number: number;
  status: "free" | "booked" | "paid";
  is_booked: boolean;
}

export interface BookingSeat {
  seat_id: number;
  row_letter: string;
  seat_number: number;
}

export interface Booking {
  session_id: number;
  booking_id: number;
  booking_time: string;
  status: string;
  total_price: number;
  seat: BookingSeat;
  is_paid: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
}